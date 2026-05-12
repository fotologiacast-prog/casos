import type { VercelRequest, VercelResponse } from "@vercel/node";

const getSupabase = async (useServiceRole = false) => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = useServiceRole
    ? process.env.SUPABASE_SERVICE_ROLE_KEY
    : (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY);
  if (!supabaseUrl || !key) throw new Error("Supabase env vars ausentes.");
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(supabaseUrl, key);
};

const isAdmin = (req: VercelRequest) => {
  const configured = process.env.ADMIN_PASSWORD;
  return configured && req.headers["x-admin-password"] === configured;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Password");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // GET — public: list FAQs (optionally filter by stage_type)
    if (req.method === "GET") {
      const supabase = await getSupabase(false);
      let query = supabase.from("stage_faqs").select("*").order("stage_type").order("order");
      if (req.query.stage_type) {
        const stageTypes = String(req.query.stage_type)
          .split("|")
          .map(item => item.trim())
          .filter(Boolean);
        query = stageTypes.length > 1 ? query.in("stage_type", stageTypes) : query.eq("stage_type", stageTypes[0]);
      }
      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json({ faqs: data || [] });
    }

    // Mutations require admin
    if (!isAdmin(req)) {
      return res.status(401).json({ error: "Acesso não autorizado." });
    }

    const supabase = await getSupabase(true);

    // POST — create
    if (req.method === "POST") {
      const { stage_type, title, content, image_url, order } = req.body || {};
      if (!stage_type || !title) return res.status(400).json({ error: "stage_type e title são obrigatórios." });

      // Max 3 FAQs per stage_type
      const { count } = await supabase
        .from("stage_faqs")
        .select("id", { count: "exact", head: true })
        .eq("stage_type", stage_type);
      if ((count || 0) >= 3) {
        return res.status(400).json({ error: `Limite de 3 FAQs por etapa atingido para "${stage_type}".` });
      }

      const { data, error } = await supabase
        .from("stage_faqs")
        .insert([{ stage_type, title, content: content || "", image_url: image_url || null, order: order ?? 0 }])
        .select()
        .single();
      if (error) throw error;
      return res.status(201).json({ faq: data });
    }

    // PUT — update
    if (req.method === "PUT") {
      const id = String(req.query.id || req.body?.id || "").trim();
      if (!id) return res.status(400).json({ error: "ID do FAQ ausente." });
      const { stage_type, title, content, image_url, order } = req.body || {};
      const { data, error } = await supabase
        .from("stage_faqs")
        .update({ stage_type, title, content, image_url, order })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json({ faq: data });
    }

    // DELETE
    if (req.method === "DELETE") {
      const id = String(req.query.id || "").trim();
      if (!id) return res.status(400).json({ error: "ID do FAQ ausente." });
      const { error } = await supabase.from("stage_faqs").delete().eq("id", id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Método não permitido." });
  } catch (error) {
    return res.status(500).json({
      error: "Falha na API de FAQs.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
