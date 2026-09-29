import type { VercelRequest, VercelResponse } from "@vercel/node";

type MondayColumn = {
  id: string;
  title: string;
  type: string;
};

const serializeApiError = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const parts = [record.code, record.message, record.details, record.hint]
      .filter(Boolean)
      .map(String);
    if (parts.length > 0) return parts.join(" ");
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

const getSupabaseAdmin = async () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase admin env vars ausentes.");
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

const findRatingColumn = (columns: MondayColumn[]) =>
  columns.find(column => ["avaliacao", "avaliacao do criativo"].includes(normalizeKey(column.title)));

const buildRatingValue = (column: MondayColumn, rating: number) => {
  if (column.type === "rating") return { rating };
  if (column.type === "numbers") return String(rating);
  return String(rating);
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Metodo nao permitido." });

  try {
    const token = String(req.body?.token || "").trim();
    const itemId = String(req.body?.itemId || "").trim();
    const subitemId = String(req.body?.subitemId || "").trim();
    const rating = Number(req.body?.rating);

    if (!token || !itemId || !subitemId) return res.status(400).json({ error: "Parametros ausentes." });
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Avaliacao deve ser um numero de 1 a 5." });
    }

    const supabase = await getSupabaseAdmin();
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id")
      .eq("case_public_token", token)
      .eq("active", true)
      .maybeSingle();
    if (clientError) throw clientError;
    if (!client) return res.status(404).json({ error: "Cliente nao encontrado." });

    const { data: caseRow, error: caseError } = await supabase
      .from("cases")
      .select("id")
      .eq("client_id", client.id)
      .eq("monday_item_id", itemId)
      .maybeSingle();
    if (caseError) throw caseError;
    if (!caseRow) return res.status(404).json({ error: "Caso nao encontrado para este cliente." });

    const itemData = await mondayFetch(
      `query ($itemIds: [ID!]) {
        items(ids: $itemIds) {
          subitems { id board { id } }
        }
      }`,
      { itemIds: [itemId] }
    );

    const subitem = (itemData?.data?.items?.[0]?.subitems || []).find((item: any) => String(item.id) === subitemId);
    const subitemBoardId = subitem?.board?.id;
    if (!subitemBoardId) return res.status(404).json({ error: "Subelemento nao encontrado no Monday." });

    const columnsData = await mondayFetch(
      `query ($boardIds: [ID!]) {
        boards(ids: $boardIds) {
          columns { id title type }
        }
      }`,
      { boardIds: [String(subitemBoardId)] }
    );

    const columns: MondayColumn[] = columnsData?.data?.boards?.[0]?.columns || [];
    const ratingColumn = findRatingColumn(columns);
    if (!ratingColumn) {
      return res.status(404).json({ error: "Coluna Avaliacao nao encontrada no board de subelementos." });
    }

    const value = buildRatingValue(ratingColumn, rating);
    await mondayFetch(
      `mutation ($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
        change_multiple_column_values(
          board_id: $boardId,
          item_id: $itemId,
          column_values: $columnValues,
          create_labels_if_missing: false
        ) { id }
      }`,
      {
        boardId: String(subitemBoardId),
        itemId: subitemId,
        columnValues: JSON.stringify({ [ratingColumn.id]: value }),
      }
    );

    return res.status(200).json({ ok: true, rating });
  } catch (error) {
    return res.status(500).json({
      error: "Falha ao avaliar criativo.",
      details: serializeApiError(error),
    });
  }
}
