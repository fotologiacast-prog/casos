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

const serializeApiError = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    return [record.code, record.message, record.details, record.hint].filter(Boolean).map(String).join(" ");
  }
  return String(error);
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "Metodo nao permitido." });

  try {
    const token = String(req.method === "GET" ? req.query.token || "" : req.body?.token || "").trim();
    if (!token) return res.status(400).json({ error: "Token ausente." });

    const supabase = await getSupabaseAdmin();
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id")
      .eq("case_public_token", token)
      .eq("active", true)
      .maybeSingle();

    if (clientError) throw clientError;
    if (!client) return res.status(404).json({ error: "Cliente nao encontrado." });

    if (req.method === "POST") {
      const notificationIds = Array.isArray(req.body?.notificationIds)
        ? req.body.notificationIds.map(String).filter(Boolean)
        : [];
      const uniqueIds = Array.from(new Set(notificationIds));
      if (uniqueIds.length === 0) return res.status(200).json({ ok: true });

      const { error: readError } = await supabase
        .from("admin_notification_reads")
        .upsert(
          uniqueIds.map(notificationId => ({
            notification_id: notificationId,
            client_id: Number(client.id),
            read_at: new Date().toISOString(),
          })),
          { onConflict: "notification_id,client_id" }
        );
      if (readError) throw readError;
      return res.status(200).json({ ok: true });
    }

    const { data, error } = await supabase
      .from("admin_notifications")
      .select("id, title, body, media_url, cta_label, cta_url, published_at")
      .eq("active", true)
      .or(`audience.eq.all,client_id.eq.${Number(client.id)}`)
      .order("published_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    const notifications = data || [];
    const notificationIds = notifications.map((item: any) => String(item.id)).filter(Boolean);
    let readByNotificationId = new Map<string, string>();

    if (notificationIds.length > 0) {
      const { data: reads, error: readsError } = await supabase
        .from("admin_notification_reads")
        .select("notification_id, read_at")
        .eq("client_id", Number(client.id))
        .in("notification_id", notificationIds);
      if (readsError) throw readsError;
      readByNotificationId = new Map((reads || []).map((read: any) => [String(read.notification_id), read.read_at]));
    }

    return res.status(200).json({
      notifications: notifications.map((item: any) => ({
        ...item,
        read_at: readByNotificationId.get(String(item.id)) || null,
      })),
    });
  } catch (error) {
    return res.status(500).json({
      error: "Falha na API de notificacoes.",
      details: serializeApiError(error),
    });
  }
}
