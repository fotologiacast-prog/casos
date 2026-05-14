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

const getEnvStatus = () => ({
  hasSupabaseUrl: Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
  hasSupabaseServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  hasAdminPassword: Boolean(process.env.ADMIN_PASSWORD),
  hasDriveRootFolderId: Boolean(process.env.DRIVE_ROOT_FOLDER_ID || process.env.VITE_DRIVE_ROOT_FOLDER_ID),
  hasGoogleServiceAccount: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 || process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
});

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
  const accessToken = await getGoogleAccessToken();
  const folder = await findOrCreateDriveFolder(accessToken, rootFolderId, sanitizeDriveFolderName(payload.name));
  return {
    ...payload,
    drive_folder_id: folder.id,
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

  try {
    if (req.method === "GET" && String(req.query.health || "") === "1") {
      return res.status(200).json({ ok: true, env: getEnvStatus() });
    }

    const supabase = await getSupabaseAdmin();

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

    return res.status(405).json({ error: "Metodo nao permitido." });
  } catch (error) {
    const message = (error as any)?.message || (error as any)?.details || String(error);
    return res.status(500).json({
      error: "Falha na API de clientes.",
      details: message,
    });
  }
}
