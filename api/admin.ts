import type { VercelRequest, VercelResponse } from "@vercel/node";

const DEFAULT_MONDAY_CASE_BOARD_ID = "18054403734";
const DEFAULT_MONDAY_WEBHOOK_EVENT = "change_subitem_column_value";

const getSupabaseAdmin = async () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin env vars ausentes.");
  }

  const { createClient } = await import("@supabase/supabase-js");
  return createClient(supabaseUrl, serviceRoleKey);
};

const isAuthorized = (req: VercelRequest) => {
  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (!configuredPassword) return false;

  const headerPassword = req.headers["x-admin-password"];
  return headerPassword === configuredPassword;
};

const serializeApiError = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    return [record.code, record.message, record.details, record.hint].filter(Boolean).map(String).join(" ");
  }
  return String(error);
};

const mondayAdminFetch = async (query: string, variables: Record<string, unknown>) => {
  const mondayToken = process.env.MONDAY_TOKEN;
  if (!mondayToken) throw new Error("MONDAY_TOKEN ausente.");

  const response = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: {
      Authorization: mondayToken.trim(),
      "Content-Type": "application/json",
      "API-Version": "2024-10",
    },
    body: JSON.stringify({ query, variables }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.errors) {
    const message = data.errors?.map((error: any) => {
      const path = Array.isArray(error.path) ? ` path=${error.path.join(".")}` : "";
      return `${error.message || "Erro sem mensagem"}${path}`;
    }).join(" | ");
    throw new Error(message || `Falha no Monday. HTTP ${response.status}`);
  }

  return data;
};

const withProtocol = (value: string) => {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const buildMondayWebhookUrl = (req: VercelRequest, body: any) => {
  const configuredUrl = String(body?.webhook_url || process.env.MONDAY_WEBHOOK_URL || "").trim();
  const baseUrl =
    configuredUrl ||
    process.env.PUBLIC_APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    (req.headers.host ? `https://${req.headers.host}` : "");

  const secret = process.env.MONDAY_WEBHOOK_SECRET;
  if (!secret) throw new Error("MONDAY_WEBHOOK_SECRET ausente.");
  if (!baseUrl) throw new Error("URL publica do Vercel ausente. Configure MONDAY_WEBHOOK_URL ou VERCEL_PROJECT_PRODUCTION_URL.");

  const url = new URL("/api/monday-webhook", withProtocol(baseUrl));
  url.searchParams.set("secret", secret);
  return url.toString();
};

// Client specific helpers
const normalizeClientPayload = (body: any) => ({
  name: String(body.name || "").trim(),
  boardId: DEFAULT_MONDAY_CASE_BOARD_ID,
  case_public_token: String(body.case_public_token || "").trim(),
  case_board_id: DEFAULT_MONDAY_CASE_BOARD_ID,
  case_client_label: body.case_client_label || body.monday_client_label ? String(body.case_client_label || body.monday_client_label).trim() : null,
  monday_board_id: DEFAULT_MONDAY_CASE_BOARD_ID,
  monday_client_label: body.monday_client_label || body.case_client_label ? String(body.monday_client_label || body.case_client_label).trim() : null,
  drive_folder_id: body.drive_folder_id ? String(body.drive_folder_id).trim() : null,
  portal_password: body.portal_password ? String(body.portal_password).trim() : null,
  active: body.active !== false,
});

const validateClientPayload = (payload: ReturnType<typeof normalizeClientPayload>) => {
  if (!payload.name) return "Nome do cliente e obrigatorio.";
  if (!payload.boardId) return "Board ID do Monday e obrigatorio.";
  if (!payload.case_public_token) return "Token publico e obrigatorio.";
  return null;
};

const ensureClientDriveFolder = async (payload: ReturnType<typeof normalizeClientPayload>) => {
  if (payload.drive_folder_id) return payload;

  const rootFolderId = process.env.DRIVE_ROOT_FOLDER_ID || process.env.VITE_DRIVE_ROOT_FOLDER_ID;
  if (!rootFolderId) return payload;
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 && !process.env.GOOGLE_SERVICE_ACCOUNT_JSON && !process.env.GOOGLE_REFRESH_TOKEN) return payload;

  const { findOrCreateDriveFolder, getGoogleAccessToken, sanitizeDriveFolderName } = await import("./_googleDrive.js");
  const accessToken = await getGoogleAccessToken({ preferOAuth: true });
  const folder = await findOrCreateDriveFolder(accessToken, rootFolderId, sanitizeDriveFolderName(payload.name));
  return {
    ...payload,
    drive_folder_id: folder.id,
  };
};

// Dashboard specific helpers
const increment = (map: Map<number, number>, key: number, amount = 1) => {
  map.set(key, (map.get(key) || 0) + amount);
};

// Notification specific helpers
const cleanText = (value: unknown) => {
  const text = String(value || "").trim();
  return text || null;
};

const normalizeNotificationPayload = (body: any) => {
  const clientId = body.client_id ? Number(body.client_id) : null;
  return {
    title: String(body.title || "").trim(),
    body: cleanText(body.body),
    media_url: cleanText(body.media_url),
    cta_label: cleanText(body.cta_label),
    cta_url: cleanText(body.cta_url),
    audience: clientId ? "client" : "all",
    client_id: clientId,
    active: body.active !== false,
    published_at: body.published_at || new Date().toISOString(),
  };
};

const toArray = <T,>(value: T[] | null | undefined): T[] => Array.isArray(value) ? value : [];

const getDirectDriveFileUrl = (fileId: string) =>
  `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;

const getAdminFileUrl = (file: any) =>
  file?.web_content_link || (file?.drive_file_id ? getDirectDriveFileUrl(file.drive_file_id) : file?.web_view_link || "#");

const isImageFile = (file: any) =>
  String(file?.mime_type || file?.type || "").startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|avif|heic|heif)$/i.test(String(file?.file_name || file?.name || ""));

const normalizeStageIds = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(item => String(item || "").trim()).filter(Boolean))];
};

const fetchAdminEditingRequests = async (supabase: any) => {
  const { data: requests, error: requestsError } = await supabase
    .from("case_editing_requests")
    .select("*")
    .order("sent_at", { ascending: false })
    .limit(200);
  if (requestsError) throw requestsError;

  const requestRows = toArray<any>(requests);
  const clientIds = [...new Set(requestRows.map(request => request.client_id).filter(Boolean))];
  const caseIds = [...new Set(requestRows.map(request => request.case_id).filter(Boolean))];

  const [clientsResult, casesResult, stagesResult, filesResult, locksResult] = await Promise.all([
    clientIds.length ? supabase.from("clients").select("id, name").in("id", clientIds) : { data: [], error: null },
    caseIds.length ? supabase.from("cases").select("id, patient_name, birth_date, age, gender, procedure, created_at, client_id").in("id", caseIds) : { data: [], error: null },
    caseIds.length ? supabase.from("case_stages").select("id, case_id, stage_name, moment, sort_order, status").in("case_id", caseIds).order("sort_order", { ascending: true }) : { data: [], error: null },
    caseIds.length ? supabase.from("case_files").select("id, case_id, stage_id, file_name, mime_type, size_bytes, drive_file_id, web_view_link, web_content_link, created_at").in("case_id", caseIds) : { data: [], error: null },
    caseIds.length ? supabase.from("case_stage_usage_locks").select("*").in("case_id", caseIds) : { data: [], error: null },
  ]);

  if (clientsResult.error) throw clientsResult.error;
  if (casesResult.error) throw casesResult.error;
  if (stagesResult.error) throw stagesResult.error;
  if (filesResult.error) throw filesResult.error;
  if (locksResult.error) throw locksResult.error;

  const clientsById = new Map(toArray<any>(clientsResult.data).map(client => [Number(client.id), client]));
  const casesById = new Map(toArray<any>(casesResult.data).map(caseRow => [String(caseRow.id), caseRow]));
  const filesByStageId = new Map<string, any[]>();
  toArray<any>(filesResult.data).forEach(file => {
    const stageId = String(file.stage_id);
    filesByStageId.set(stageId, [...(filesByStageId.get(stageId) || []), file]);
  });

  const locksByStageId = new Map(toArray<any>(locksResult.data).map(lock => [String(lock.stage_id), lock]));
  const locksByRequestId = new Map<string, any[]>();
  toArray<any>(locksResult.data).forEach(lock => {
    const requestId = String(lock.editing_request_id || "");
    if (!requestId) return;
    locksByRequestId.set(requestId, [...(locksByRequestId.get(requestId) || []), lock]);
  });

  return requestRows.map(request => {
    const caseRow = casesById.get(String(request.case_id));
    const client = clientsById.get(Number(request.client_id));
    const caseStages = toArray<any>(stagesResult.data)
      .filter(stage => String(stage.case_id) === String(request.case_id))
      .map(stage => {
        const files = filesByStageId.get(String(stage.id)) || [];
        const lock = locksByStageId.get(String(stage.id));
        return {
          id: stage.id,
          name: stage.stage_name,
          moment: stage.moment,
          status: stage.status,
          sortOrder: stage.sort_order,
          isUsed: Boolean(lock && String(lock.editing_request_id || "") === String(request.id)),
          lockedByOtherRequest: Boolean(lock && String(lock.editing_request_id || "") !== String(request.id)),
          lock: lock ? {
            id: lock.id,
            editingRequestId: lock.editing_request_id,
            lockedAt: lock.locked_at,
            lockedBy: lock.locked_by,
          } : null,
          files: files.map(file => ({
            id: file.id,
            name: file.file_name,
            type: file.mime_type,
            sizeBytes: file.size_bytes,
            publicUrl: getAdminFileUrl(file),
            createdAt: file.created_at,
          })),
        };
      })
      .filter(stage => stage.files.length > 0);
    const coverFile = caseStages.flatMap(stage => stage.files).find(isImageFile) || caseStages.flatMap(stage => stage.files)[0] || null;
    const requestLocks = locksByRequestId.get(String(request.id)) || [];

    return {
      id: request.id,
      clientId: request.client_id,
      clientName: client?.name || "Cliente",
      caseId: request.case_id,
      patientName: caseRow?.patient_name || "Paciente",
      patientAge: caseRow?.age ?? null,
      patientBirthDate: caseRow?.birth_date || null,
      patientGender: caseRow?.gender || null,
      patientProcedure: caseRow?.procedure || null,
      requestedStageId: request.stage_id,
      requestedStageName: request.stage_name,
      materialUrl: request.material_url,
      status: request.status,
      creativeType: request.creative_type,
      sentAt: request.sent_at,
      editedAt: request.edited_at,
      usedStageIds: requestLocks.map(lock => lock.stage_id),
      usedCount: requestLocks.length,
      coverUrl: coverFile?.publicUrl || null,
      availableStages: caseStages,
    };
  });
};

const updateEditingRequestUsedStages = async (supabase: any, requestId: string, body: any) => {
  const usedStageIds = normalizeStageIds(body?.usedStageIds);
  const lockedBy = cleanText(body?.lockedBy) || "Editor";

  const { data: request, error: requestError } = await supabase
    .from("case_editing_requests")
    .select("id, client_id, case_id")
    .eq("id", requestId)
    .maybeSingle();
  if (requestError) throw requestError;
  if (!request) return { status: 404, body: { error: "Pedido de edicao nao encontrado." } };

  const { data: stages, error: stagesError } = usedStageIds.length
    ? await supabase
      .from("case_stages")
      .select("id, case_id, stage_name")
      .in("id", usedStageIds)
    : { data: [], error: null };
  if (stagesError) throw stagesError;

  const stageRows = toArray<any>(stages);
  const validStageIds = new Set(
    stageRows
      .filter(stage => String(stage.case_id) === String(request.case_id))
      .map(stage => String(stage.id))
  );
  const invalidStageIds = usedStageIds.filter(stageId => !validStageIds.has(stageId));
  if (invalidStageIds.length > 0) {
    return { status: 400, body: { error: "Um ou mais materiais nao pertencem ao caso deste pedido." } };
  }

  const { data: existingLocks, error: locksError } = usedStageIds.length
    ? await supabase
      .from("case_stage_usage_locks")
      .select("id, stage_id, editing_request_id, stage_name")
      .eq("case_id", request.case_id)
      .in("stage_id", usedStageIds)
    : { data: [], error: null };
  if (locksError) throw locksError;

  const lockedByOther = toArray<any>(existingLocks).filter(lock => String(lock.editing_request_id || "") !== requestId);
  if (lockedByOther.length > 0) {
    return {
      status: 409,
      body: {
        error: "Alguns materiais ja foram bloqueados em outro pedido.",
        stages: lockedByOther.map(lock => lock.stage_name || lock.stage_id),
      },
    };
  }

  const { data: ownLocks, error: ownLocksError } = await supabase
    .from("case_stage_usage_locks")
    .select("id, stage_id")
    .eq("editing_request_id", requestId);
  if (ownLocksError) throw ownLocksError;

  const usedSet = new Set(usedStageIds);
  const lockIdsToDelete = toArray<any>(ownLocks)
    .filter(lock => !usedSet.has(String(lock.stage_id)))
    .map(lock => lock.id);
  if (lockIdsToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("case_stage_usage_locks")
      .delete()
      .in("id", lockIdsToDelete);
    if (deleteError) throw deleteError;
  }

  const rows = stageRows.map(stage => ({
    client_id: request.client_id,
    case_id: request.case_id,
    stage_id: stage.id,
    editing_request_id: request.id,
    stage_name: stage.stage_name,
    locked_by: lockedBy,
    locked_at: new Date().toISOString(),
  }));

  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from("case_stage_usage_locks")
      .upsert(rows, { onConflict: "case_id,stage_id" });
    if (upsertError) throw upsertError;
  }

  return { status: 200, body: { ok: true, usedStageIds } };
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Password");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Senha admin invalida." });
  }

  const module = String(req.query.module || "").toLowerCase();

  try {
    const supabase = await getSupabaseAdmin();

    // --- CLIENTS MODULE ---
    if (module === "clients") {
      if (req.method === "GET") {
        const { data, error } = await supabase.from("clients").select("*").order("name");
        if (error) throw error;
        return res.status(200).json({ clients: data || [] });
      }

      if (req.method === "POST") {
        const payload = await ensureClientDriveFolder(normalizeClientPayload(req.body));
        const validationError = validateClientPayload(payload);
        if (validationError) return res.status(400).json({ error: validationError });

        const { data, error } = await supabase.from("clients").insert([payload]).select().single();
        if (error) throw error;
        return res.status(201).json({ client: data });
      }

      if (req.method === "PUT") {
        const id = String(req.query.id || req.body?.id || "").trim();
        if (!id) return res.status(400).json({ error: "ID do cliente ausente." });

        const payload = await ensureClientDriveFolder(normalizeClientPayload(req.body));
        const validationError = validateClientPayload(payload);
        if (validationError) return res.status(400).json({ error: validationError });

        const { data, error } = await supabase.from("clients").update(payload).eq("id", id).select().single();
        if (error) throw error;
        return res.status(200).json({ client: data });
      }

      if (req.method === "DELETE") {
        const id = String(req.query.id || "").trim();
        if (!id) return res.status(400).json({ error: "ID do cliente ausente." });

        const { error } = await supabase.from("clients").delete().eq("id", id);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }
    }

    // --- DASHBOARD MODULE ---
    if (module === "dashboard") {
      if (req.method === "GET") {
        const [clientsResult, casesResult, editingResult] = await Promise.all([
          supabase.from("clients").select("id, name, active").order("name"),
          supabase.from("cases").select("id, client_id"),
          supabase.from("case_editing_requests").select("id, client_id, status"),
        ]);

        if (clientsResult.error) throw clientsResult.error;
        if (casesResult.error) throw casesResult.error;
        if (editingResult.error) throw editingResult.error;

        const clients = clientsResult.data || [];
        const cases = casesResult.data || [];
        const editingRequests = editingResult.data || [];

        const patientsByClient = new Map<number, number>();
        const editingSentByClient = new Map<number, number>();
        const editingPendingByClient = new Map<number, number>();
        const editedReadyByClient = new Map<number, number>();

        cases.forEach((caseRow: any) => increment(patientsByClient, Number(caseRow.client_id)));

        editingRequests.forEach((request: any) => {
          const clientId = Number(request.client_id);
          const status = String(request.status || "").trim().toLowerCase();
          increment(editingSentByClient, clientId);
          if (status === "edited") {
            increment(editedReadyByClient, clientId);
          } else {
            increment(editingPendingByClient, clientId);
          }
        });

        const dashboardClients = clients.map((client: any) => {
          const id = Number(client.id);
          return {
            id,
            name: client.name,
            active: client.active !== false,
            patientsCount: patientsByClient.get(id) || 0,
            editingSentCount: editingSentByClient.get(id) || 0,
            editingPendingCount: editingPendingByClient.get(id) || 0,
            editedReadyCount: editedReadyByClient.get(id) || 0,
          };
        });

        return res.status(200).json({
          dashboard: {
            totals: {
              clients: clients.length,
              activeClients: clients.filter((client: any) => client.active !== false).length,
              patients: cases.length,
              editingSent: editingRequests.length,
              editingPending: editingRequests.filter((request: any) => String(request.status || "").trim().toLowerCase() !== "edited").length,
              editedReady: editingRequests.filter((request: any) => String(request.status || "").trim().toLowerCase() === "edited").length,
            },
            clients: dashboardClients,
          },
        });
      }
    }

    // --- NOTIFICATIONS MODULE ---
    if (module === "notifications") {
      if (req.method === "GET") {
        const [notificationsResult, readsResult, clientsResult] = await Promise.all([
          supabase.from("admin_notifications").select("*").order("published_at", { ascending: false }),
          supabase.from("admin_notification_reads").select("notification_id, client_id, read_at"),
          supabase.from("clients").select("id, active"),
        ]);
        if (notificationsResult.error) throw notificationsResult.error;
        if (readsResult.error) throw readsResult.error;
        if (clientsResult.error) throw clientsResult.error;

        const readsByNotificationId = new Map<string, any[]>();
        (readsResult.data || []).forEach((read: any) => {
          const notificationId = String(read.notification_id);
          readsByNotificationId.set(notificationId, [...(readsByNotificationId.get(notificationId) || []), read]);
        });

        const activeClientsCount = (clientsResult.data || []).filter((client: any) => client.active !== false).length;
        const notifications = (notificationsResult.data || []).map((notification: any) => {
          const reads = readsByNotificationId.get(String(notification.id)) || [];
          const lastReadAt = reads
            .map((read: any) => read.read_at)
            .filter(Boolean)
            .sort()
            .at(-1) || null;
          return {
            ...notification,
            read_count: reads.length,
            recipient_count: notification.audience === "all" || !notification.client_id ? activeClientsCount : 1,
            last_read_at: lastReadAt,
          };
        });

        return res.status(200).json({ notifications });
      }

      if (req.method === "POST") {
        const payload = normalizeNotificationPayload(req.body);
        if (!payload.title) return res.status(400).json({ error: "Titulo da notificacao e obrigatorio." });

        const { data, error } = await supabase.from("admin_notifications").insert([payload]).select().single();
        if (error) throw error;
        return res.status(201).json({ notification: data });
      }

      if (req.method === "PUT") {
        const id = String(req.query.id || req.body?.id || "").trim();
        if (!id) return res.status(400).json({ error: "ID da notificacao ausente." });

        const payload = normalizeNotificationPayload(req.body);
        if (!payload.title) return res.status(400).json({ error: "Titulo da notificacao e obrigatorio." });

        const { data, error } = await supabase
          .from("admin_notifications")
          .update(payload)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return res.status(200).json({ notification: data });
      }

      if (req.method === "DELETE") {
        const id = String(req.query.id || "").trim();
        if (!id) return res.status(400).json({ error: "ID da notificacao ausente." });

        const { error } = await supabase.from("admin_notifications").delete().eq("id", id);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }
    }

    // --- EDITING REQUESTS MODULE ---
    if (module === "editing-requests") {
      if (req.method === "GET") {
        const requests = await fetchAdminEditingRequests(supabase);
        return res.status(200).json({ requests });
      }

      if (req.method === "PUT") {
        const id = String(req.query.id || req.body?.id || "").trim();
        if (!id) return res.status(400).json({ error: "ID do pedido ausente." });

        const result = await updateEditingRequestUsedStages(supabase, id, req.body);
        return res.status(result.status).json(result.body);
      }
    }

    // --- MONDAY WEBHOOKS MODULE ---
    if (module === "monday-webhooks") {
      if (req.method === "GET") {
        const boardId = String(req.query.boardId || DEFAULT_MONDAY_CASE_BOARD_ID);
        const data = await mondayAdminFetch(
          `query ($boardIds: [ID!]) {
            boards(ids: $boardIds) {
              id
              name
              webhooks {
                id
                event
                board_id
                config
              }
            }
          }`,
          { boardIds: [boardId] }
        );

        return res.status(200).json({
          board: data?.data?.boards?.[0] || null,
          webhookUrl: buildMondayWebhookUrl(req, {}),
        });
      }

      if (req.method === "POST") {
        const boardId = String(req.body?.boardId || DEFAULT_MONDAY_CASE_BOARD_ID);
        const eventName = String(req.body?.eventName || DEFAULT_MONDAY_WEBHOOK_EVENT);
        const webhookUrl = buildMondayWebhookUrl(req, req.body);
        const config = req.body?.config || null;

        const variables: Record<string, unknown> = {
          boardId,
          url: webhookUrl,
          event: eventName,
        };

        const mutation = config
          ? `mutation ($boardId: ID!, $url: String!, $event: WebhookEventType!, $config: JSON!) {
              create_webhook(board_id: $boardId, url: $url, event: $event, config: $config) {
                id
                board_id
              }
            }`
          : `mutation ($boardId: ID!, $url: String!, $event: WebhookEventType!) {
              create_webhook(board_id: $boardId, url: $url, event: $event) {
                id
                board_id
              }
            }`;

        if (config) variables.config = JSON.stringify(config);

        const data = await mondayAdminFetch(mutation, variables);

        return res.status(201).json({
          ok: true,
          webhook: data?.data?.create_webhook,
          eventName,
          webhookUrl,
        });
      }
    }

    return res.status(400).json({ error: "Modulo invalido ou metodo nao suportado para este modulo." });
  } catch (error) {
    return res.status(500).json({
      error: `Falha na API de Admin (${module}).`,
      details: serializeApiError(error),
    });
  }
}
