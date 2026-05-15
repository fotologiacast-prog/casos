import type { VercelRequest, VercelResponse } from "@vercel/node";

const ALLOWED_EDITING_MOMENTS = new Set(["Entrega", "Evento", "Agência", "Agencia"]);

const serializeApiError = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
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
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const getSupabaseAdmin = async () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin env vars ausentes.");
  }

  const { createClient } = await import("@supabase/supabase-js");
  return createClient(supabaseUrl, serviceRoleKey);
};

const getClientByToken = async (supabase: any, token: string) => {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("case_public_token", token)
    .eq("active", true)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Cliente nao encontrado.");
  return data;
};

const mondayRequest = async (query: string, variables: Record<string, unknown>) => {
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
    throw new Error(data.errors?.map((error: any) => error.message).join(" ") || `Falha no Monday. HTTP ${response.status}`);
  }
  return data;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Metodo nao permitido." });

  try {
    const token = String(req.body?.token || "").trim();
    const caseId = String(req.body?.caseId || "").trim();
    const stageId = String(req.body?.stageId || "").trim();

    if (!token) return res.status(400).json({ error: "Token ausente." });
    if (!caseId) return res.status(400).json({ error: "caseId ausente." });
    if (!stageId) return res.status(400).json({ error: "stageId ausente." });

    const supabase = await getSupabaseAdmin();
    const client = await getClientByToken(supabase, token);

    const { data: caseRow, error: caseError } = await supabase
      .from("cases")
      .select("id, patient_name, client_id, monday_item_id")
      .eq("id", caseId)
      .eq("client_id", client.id)
      .maybeSingle();
    if (caseError) throw caseError;
    if (!caseRow) return res.status(404).json({ error: "Caso nao encontrado." });
    if (!caseRow.monday_item_id) return res.status(400).json({ error: "Este paciente ainda nao tem item no Monday." });

    const { data: stageRow, error: stageError } = await supabase
      .from("case_stages")
      .select("id, case_id, stage_name, moment")
      .eq("id", stageId)
      .eq("case_id", caseId)
      .maybeSingle();
    if (stageError) throw stageError;
    if (!stageRow) return res.status(404).json({ error: "Etapa nao encontrada." });
    if (!ALLOWED_EDITING_MOMENTS.has(String(stageRow.moment || ""))) {
      return res.status(400).json({ error: "A edição só pode ser solicitada a partir da fase Entrega." });
    }

    const { count, error: filesError } = await supabase
      .from("case_files")
      .select("id", { count: "exact", head: true })
      .eq("stage_id", stageId);
    if (filesError) throw filesError;
    if (!count) return res.status(400).json({ error: "Envie ao menos um arquivo nesta etapa antes de mandar para edição." });

    const itemQuery = `query ($itemIds: [ID!]) {
      items(ids: $itemIds) {
        subitems { id name }
      }
    }`;
    const existingData = await mondayRequest(itemQuery, { itemIds: [String(caseRow.monday_item_id)] });
    const taskName = `Edição - ${stageRow.stage_name}`;
    const subitems = existingData?.data?.items?.[0]?.subitems || [];
    const existingSubitem = subitems.find((subitem: any) => normalizeKey(subitem.name) === normalizeKey(taskName));

    if (existingSubitem) {
      return res.status(200).json({ ok: true, existing: true, subitemId: existingSubitem.id });
    }

    const createMutation = `mutation ($parentItemId: ID!, $itemName: String!) {
      create_subitem(parent_item_id: $parentItemId, item_name: $itemName) { id }
    }`;
    const createdData = await mondayRequest(createMutation, {
      parentItemId: String(caseRow.monday_item_id),
      itemName: taskName,
    });
    const subitemId = createdData?.data?.create_subitem?.id;

    return res.status(201).json({ ok: true, existing: false, subitemId });
  } catch (error) {
    return res.status(500).json({
      error: "Falha ao mandar para edição.",
      details: serializeApiError(error),
    });
  }
}
