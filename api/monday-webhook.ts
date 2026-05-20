import type { VercelRequest, VercelResponse } from "@vercel/node";

type MondayColumnValue = {
  id: string;
  text?: string | null;
  value?: string | null;
  column?: { title?: string | null; type?: string | null } | null;
};

type MondayItemDetails = {
  id: string;
  name: string;
  assets?: { id: string; name: string; public_url?: string | null }[];
  column_values?: MondayColumnValue[];
};

const serializeApiError = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const parts = [record.code, record.message, record.details, record.hint]
      .filter(Boolean)
      .map(String);
    if (parts.length > 0) return parts.join(" ");
    try {
      return JSON.stringify(error);
    } catch {
      return "Erro desconhecido.";
    }
  }
  return String(error);
};

const normalizeKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^#+\s*/, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();

const safeString = (value: unknown) => {
  const text = String(value || "").trim();
  return text || null;
};

const getSupabaseAdmin = async () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin env vars ausentes.");
  }

  const { createClient } = await import("@supabase/supabase-js");
  return createClient(supabaseUrl, serviceRoleKey);
};

const mondayFetch = async (query: string, variables: Record<string, unknown>) => {
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

const getRequestSecret = (req: VercelRequest) => {
  const headerSecret = req.headers["x-webhook-secret"];
  if (Array.isArray(headerSecret)) return headerSecret[0] || "";
  return String(headerSecret || req.query.secret || "").trim();
};

const assertWebhookSecret = (req: VercelRequest) => {
  const configuredSecret = process.env.MONDAY_WEBHOOK_SECRET;
  if (!configuredSecret) throw new Error("MONDAY_WEBHOOK_SECRET ausente.");
  if (getRequestSecret(req) !== configuredSecret) {
    const error = new Error("Webhook secret invalido.");
    (error as any).statusCode = 401;
    throw error;
  }
};

const getNestedValue = (source: any, paths: string[]) => {
  for (const path of paths) {
    const value = path.split(".").reduce((current, key) => current?.[key], source);
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return null;
};

const parseMaybeJson = (value: unknown) => {
  if (!value) return null;
  if (typeof value === "object") return value as Record<string, unknown>;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
};

const extractLabelFromValue = (value: unknown) => {
  const parsed = parseMaybeJson(value);
  const candidate = getNestedValue(parsed, [
    "label.text",
    "label",
    "value.label.text",
    "value.label",
    "text",
  ]);
  return safeString(candidate);
};

const extractEvent = (body: any) => {
  const event = body?.event || body || {};
  const valueLabel = extractLabelFromValue(event.value) || extractLabelFromValue(event.columnValue);

  return {
    eventType: safeString(getNestedValue(event, ["type", "event", "triggerEvent", "webhookEvent"])),
    boardId: safeString(getNestedValue(event, ["boardId", "board_id", "board.id"])),
    itemId: safeString(getNestedValue(event, [
      "subitemId",
      "subitem_id",
      "childItemId",
      "child_item_id",
      "itemId",
      "item_id",
      "pulseId",
      "pulse_id",
    ])),
    parentItemId: safeString(getNestedValue(event, [
      "parentItemId",
      "parent_item_id",
      "parentPulseId",
      "parent_pulse_id",
      "parentItem.id",
      "parent_item.id",
    ])),
    columnId: safeString(getNestedValue(event, ["columnId", "column_id", "column.id"])),
    columnTitle: safeString(getNestedValue(event, ["columnTitle", "column_title", "column.title"])),
    pulseName: safeString(getNestedValue(event, ["pulseName", "pulse_name", "itemName", "item_name", "name"])),
    statusText: valueLabel,
  };
};

const pickColumnText = (columns: MondayColumnValue[] = [], aliases: string[]) => {
  const normalizedAliases = aliases.map(normalizeKey);
  const column = columns.find(item => {
    const title = normalizeKey(item.column?.title || item.id || "");
    return normalizedAliases.includes(title);
  });
  return column?.text || null;
};

const pickStatus = (columns: MondayColumnValue[] = []) => {
  const statusColumn = columns.find(column => {
    const title = normalizeKey(column.column?.title || column.id || "");
    return title.includes("status") || title.includes("situacao");
  });
  return statusColumn?.text || null;
};

const pickCreativeType = (columns: MondayColumnValue[] = []) =>
  pickColumnText(columns, [
    "Tipo de criativo",
    "#Tipo de criativo",
    "Tipo do criativo",
    "#Tipo do criativo",
  ]);

const fetchMondayItemDetails = async (itemId: string): Promise<MondayItemDetails | null> => {
  const data = await mondayFetch(
    `query ($itemIds: [ID!]) {
      items(ids: $itemIds) {
        id
        name
        assets { id name public_url }
        column_values {
          id
          text
          value
          column { title type }
        }
      }
    }`,
    { itemIds: [String(itemId)] }
  );

  return data?.data?.items?.[0] || null;
};

const logWebhook = (level: "info" | "error", step: string, data: Record<string, unknown> = {}) => {
  const logger = level === "error" ? console.error : console.log;
  logger("[Monday Webhook]", JSON.stringify({ level, step, ...data }));
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Webhook-Secret");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Metodo nao permitido." });

  try {
    assertWebhookSecret(req);

    if (req.body?.challenge) {
      logWebhook("info", "challenge", { received: true });
      return res.status(200).json({ challenge: req.body.challenge });
    }

    const event = extractEvent(req.body);
    if (!event.itemId) return res.status(200).json({ ok: true, ignored: true, reason: "item_id_ausente" });

    const supabase = await getSupabaseAdmin();
    const { data: auditRow, error: auditError } = await supabase
      .from("monday_webhook_events")
      .insert([{
        event_type: event.eventType,
        board_id: event.boardId,
        item_id: event.itemId,
        parent_item_id: event.parentItemId,
        column_id: event.columnId,
        column_title: event.columnTitle,
        pulse_name: event.pulseName,
        status_text: event.statusText,
        raw_payload: req.body || {},
      }])
      .select("id")
      .single();

    if (auditError) throw auditError;
    const auditId = auditRow?.id || null;

    logWebhook("info", "event_received", {
      auditId,
      itemId: event.itemId,
      parentItemId: event.parentItemId,
      columnId: event.columnId,
      columnTitle: event.columnTitle,
      statusText: event.statusText,
    });

    const item = await fetchMondayItemDetails(event.itemId);
    if (!item) {
      await supabase
        .from("monday_webhook_events")
        .update({ processed: true, processing_error: "item_nao_encontrado" })
        .eq("id", auditId);
      return res.status(200).json({ ok: true, ignored: true, reason: "item_nao_encontrado" });
    }

    const status = pickStatus(item.column_values || []) || event.statusText;
    const creativeType = pickCreativeType(item.column_values || []);
    const assetCount = (item.assets || []).filter(asset => asset?.id).length;

    const { data: editingRequest, error: requestError } = await supabase
      .from("case_editing_requests")
      .select("id, status")
      .eq("monday_subitem_id", String(item.id))
      .maybeSingle();

    if (requestError) throw requestError;

    if (!editingRequest) {
      await supabase
        .from("monday_webhook_events")
        .update({ processed: true, processing_error: "sem_pedido_de_edicao_vinculado" })
        .eq("id", auditId);
      return res.status(200).json({ ok: true, ignored: true, reason: "sem_pedido_de_edicao_vinculado" });
    }

    const normalizedStatus = normalizeKey(status || "");
    const isReadyStatus = [
      "editado",
      "pronto",
      "concluido",
      "finalizado",
      "entregue",
      "pronto para enviar",
      "pronto p enviar",
      "pronto p/ enviar"
    ].includes(normalizedStatus);

    if (!isReadyStatus) {
      await supabase
        .from("monday_webhook_events")
        .update({ processed: true, processing_error: `status_ignorado:${status || "vazio"}` })
        .eq("id", auditId);
      return res.status(200).json({ ok: true, ignored: true, reason: "status_nao_editado", status });
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("case_editing_requests")
      .update({
        status: "edited",
        edited_at: now,
        creative_type: creativeType,
        edited_material_count: assetCount,
        monday_webhook_event_id: auditId,
        last_webhook_at: now,
      })
      .eq("id", editingRequest.id);

    if (updateError) throw updateError;

    await supabase
      .from("monday_webhook_events")
      .update({ processed: true, processing_error: null })
      .eq("id", auditId);

    logWebhook("info", "editing_request_synced", {
      auditId,
      editingRequestId: editingRequest.id,
      itemId: item.id,
      creativeType,
      assetCount,
    });

    return res.status(200).json({
      ok: true,
      synced: true,
      editingRequestId: editingRequest.id,
      creativeType,
      assetCount,
    });
  } catch (error) {
    const statusCode = Number((error as any)?.statusCode || 500);
    logWebhook("error", "failed", { error: serializeApiError(error), statusCode });
    return res.status(statusCode).json({
      error: "Falha no webhook do Monday.",
      details: serializeApiError(error),
    });
  }
}
