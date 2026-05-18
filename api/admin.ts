import type { VercelRequest, VercelResponse } from "@vercel/node";

const DEFAULT_MONDAY_CASE_BOARD_ID = "18054403734";

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

    return res.status(400).json({ error: "Modulo invalido ou metodo nao suportado para este modulo." });
  } catch (error) {
    return res.status(500).json({
      error: `Falha na API de Admin (${module}).`,
      details: serializeApiError(error),
    });
  }
}
