import type { VercelRequest, VercelResponse } from "@vercel/node";

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

  if (req.method === "OPTIONS") return res.status(200).end();
  if (!isAuthorized(req)) return res.status(401).json({ error: "Senha admin invalida." });

  try {
    const supabase = await getSupabaseAdmin();

    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("admin_notifications")
        .select("*")
        .order("published_at", { ascending: false });
      if (error) throw error;
      return res.status(200).json({ notifications: data || [] });
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

    return res.status(405).json({ error: "Metodo nao permitido." });
  } catch (error) {
    return res.status(500).json({
      error: "Falha na API de notificacoes.",
      details: serializeApiError(error),
    });
  }
}
