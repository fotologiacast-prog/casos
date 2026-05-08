import type { VercelRequest, VercelResponse } from "@vercel/node";

type MondayAsset = {
  id: string;
  name: string;
  public_url: string;
};

type MondaySubitem = {
  id: string;
  name: string;
  assets?: MondayAsset[];
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
    .select("id")
    .eq("case_public_token", token)
    .eq("active", true)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Cliente nao encontrado.");
  return data;
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
    const message = data.errors?.map((error: any) => error.message).join(" ");
    throw new Error(message || `Falha ao consultar Monday. HTTP ${response.status}`);
  }

  return data;
};

const makeContentDisposition = (fileName: string) => {
  const fallback = fileName.replace(/[^\w.\- ]+/g, "_").trim() || "depoimento";
  return `attachment; filename="${fallback.replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Metodo nao permitido." });

  try {
    const token = String(req.query.token || "").trim();
    const itemId = String(req.query.itemId || "").trim();
    const subitemId = String(req.query.subitemId || "").trim();
    const assetId = String(req.query.assetId || "").trim();

    if (!token || !itemId || !subitemId || !assetId) {
      return res.status(400).json({ error: "Parametros de download ausentes." });
    }

    const supabase = await getSupabaseAdmin();
    const client = await getClientByToken(supabase, token);

    const { data: caseRow, error: caseError } = await supabase
      .from("cases")
      .select("id")
      .eq("client_id", client.id)
      .eq("monday_item_id", itemId)
      .maybeSingle();

    if (caseError) throw caseError;
    if (!caseRow) return res.status(404).json({ error: "Caso nao encontrado para este cliente." });

    const query = `query ($itemIds: [ID!]) {
      items(ids: $itemIds) {
        id
        subitems {
          id
          name
          assets { id name public_url }
        }
      }
    }`;

    const mondayData = await mondayFetch(query, { itemIds: [itemId] });
    const subitems: MondaySubitem[] = mondayData?.data?.items?.[0]?.subitems || [];
    const subitem = subitems.find(item => String(item.id) === subitemId);
    const asset = subitem?.assets?.find(item => String(item.id) === assetId);

    if (!asset?.public_url) {
      return res.status(404).json({ error: "Arquivo nao encontrado no Monday." });
    }

    const fileResponse = await fetch(asset.public_url);
    if (!fileResponse.ok) {
      throw new Error(`Falha ao baixar arquivo do Monday. HTTP ${fileResponse.status}`);
    }

    const contentType = fileResponse.headers.get("content-type") || "application/octet-stream";
    const buffer = Buffer.from(await fileResponse.arrayBuffer());

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", String(buffer.length));
    res.setHeader("Content-Disposition", makeContentDisposition(asset.name || "depoimento"));
    return res.status(200).send(buffer);
  } catch (error) {
    return res.status(500).json({
      error: "Falha ao baixar depoimento.",
      details: serializeApiError(error),
    });
  }
}
