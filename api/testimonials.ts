import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchMondayItemsInBatches } from "./_mondayBatching.ts";

type MondayAsset = {
  id: string;
  name: string;
  public_url: string;
};

type MondayColumnValue = {
  id: string;
  text?: string | null;
  value?: string | null;
  column?: { title?: string | null } | null;
};

type MondaySubitem = {
  id: string;
  name: string;
  board?: { id?: string | null } | null;
  assets?: MondayAsset[];
  column_values?: MondayColumnValue[];
};

type MondayItem = {
  id: string;
  name: string;
  subitems?: MondaySubitem[];
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

const normalizeKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^#+\s*/, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();

const pickStatus = (columns: MondayColumnValue[] = []) => {
  const statusColumn = columns.find(column => {
    const title = (column.column?.title || column.id || "").toLowerCase();
    return title.includes("status") || title.includes("situacao") || title.includes("situação");
  });
  return statusColumn?.text || null;
};

const normalizeColumnTitle = normalizeKey;

const pickColumnText = (columns: MondayColumnValue[] = [], aliases: string[]) => {
  const normalizedAliases = aliases.map(normalizeColumnTitle);
  const column = columns.find(item => {
    const title = normalizeColumnTitle(item.column?.title || item.id || "");
    return normalizedAliases.includes(title);
  });
  return column?.text || null;
};

const pickCreativeType = (columns: MondayColumnValue[] = []) =>
  pickColumnText(columns, [
    "Tipo de criativo",
    "#Tipo de criativo",
    "Tipo do criativo",
    "#Tipo do criativo",
  ]);

const pickRating = (columns: MondayColumnValue[] = []) => {
  const column = columns.find(item => {
    const title = normalizeColumnTitle(item.column?.title || item.id || "");
    return ["avaliacao", "avaliacao do criativo"].includes(title);
  });
  if (!column) return null;
  const textRating = Number(String(column.text || "").match(/\d+/)?.[0] || "");
  if (Number.isFinite(textRating) && textRating > 0) return Math.min(5, Math.max(1, textRating));
  try {
    const parsed = JSON.parse(column.value || "{}");
    const raw = parsed.rating ?? parsed.value ?? parsed.index;
    const valueRating = Number(raw);
    return Number.isFinite(valueRating) && valueRating > 0 ? Math.min(5, Math.max(1, valueRating)) : null;
  } catch {
    return null;
  }
};

const calculateAge = (birthDate: string | null) => {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
};

const normalizeAssets = (assets: MondayAsset[] = []) =>
  assets
    .filter(asset => asset?.id && asset?.name && asset?.public_url)
    .map(asset => {
      return {
        id: String(asset.id),
        name: String(asset.name),
        public_url: String(asset.public_url),
      };
    });

const syncEditedRequests = async (
  supabase: any,
  requests: { mondaySubitemId: string; creativeType?: string | null; assetCount: number }[]
) => {
  const uniqueRequests = Array.from(
    new Map(requests.map(request => [String(request.mondaySubitemId), request])).values()
  ).filter(request => request.mondaySubitemId);

  if (uniqueRequests.length === 0) return;

  await Promise.allSettled(uniqueRequests.map(async request => {
    const { error } = await supabase
      .from("case_editing_requests")
      .update({
        status: "edited",
        edited_at: new Date().toISOString(),
        creative_type: request.creativeType || null,
        edited_material_count: request.assetCount,
      })
      .eq("monday_subitem_id", String(request.mondaySubitemId));

    if (error) throw error;
  })).then(results => {
    const failed = results.filter(result => result.status === "rejected");
    if (failed.length > 0) {
      console.warn("[Testimonials] Nao foi possivel sincronizar alguns pedidos editados no Supabase.", failed);
    }
  });
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Metodo nao permitido." });

  try {
    const token = String(req.query.token || "").trim();
    if (!token) return res.status(400).json({ error: "Token ausente." });

    const supabase = await getSupabaseAdmin();
    const client = await getClientByToken(supabase, token);

    const { data: cases, error: casesError } = await supabase
      .from("cases")
      .select("id, patient_name, birth_date, age, gender, procedure, monday_item_id, created_at")
      .eq("client_id", client.id)
      .not("monday_item_id", "is", null)
      .order("created_at", { ascending: false });

    if (casesError) throw casesError;

    const caseRows = cases || [];
    const mondayItemIds = Array.from(new Set(caseRows.map((item: any) => String(item.monday_item_id || "").trim()).filter(Boolean)));

    if (mondayItemIds.length === 0) {
      return res.status(200).json({ testimonials: [] });
    }

    const query = `query ($itemIds: [ID!]) {
      items(ids: $itemIds) {
        id
        name
        subitems {
          id
          name
          board { id }
          assets { id name public_url }
          column_values {
            id
            text
            value
            column { title }
          }
        }
      }
    }`;

    const items = await fetchMondayItemsInBatches<MondayItem>(mondayItemIds, async itemIds => {
      const mondayData = await mondayFetch(query, { itemIds });
      return mondayData?.data?.items || [];
    });
    const casesByMondayItemId = new Map(caseRows.map((item: any) => [String(item.monday_item_id), item]));

    const editedRequestsToSync: { mondaySubitemId: string; creativeType?: string | null; assetCount: number }[] = [];
    const testimonials = items.flatMap(item => {
      const caseRow = casesByMondayItemId.get(String(item.id));
      if (!caseRow) return [];

      return (item.subitems || []).flatMap(subitem => {
        const assets = normalizeAssets(subitem.assets || []);
        if (assets.length === 0) return [];
        const status = pickStatus(subitem.column_values || []);
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
        
        if (!isReadyStatus) return [];

        const creativeType = pickCreativeType(subitem.column_values || []);
        const rating = pickRating(subitem.column_values || []);
        if (normalizeKey(subitem.name).startsWith("edicao") && isReadyStatus) {
          editedRequestsToSync.push({
            mondaySubitemId: String(subitem.id),
            creativeType,
            assetCount: assets.length,
          });
        }

        return [{
          id: `${caseRow.id}-${subitem.id}`,
          caseId: caseRow.id,
          patientName: caseRow.patient_name,
          mondayItemName: item.name,
          patientAge: calculateAge(caseRow.birth_date) ?? caseRow.age ?? null,
          patientBirthDate: caseRow.birth_date,
          patientGender: caseRow.gender,
          patientProcedure: caseRow.procedure,
          caseCreatedAt: caseRow.created_at,
          mondayItemId: String(item.id),
          subitemId: String(subitem.id),
          title: subitem.name,
          status,
          creativeType,
          rating,
          assets,
        }];
      });
    });

    await syncEditedRequests(supabase, editedRequestsToSync);

    return res.status(200).json({ testimonials });
  } catch (error) {
    return res.status(500).json({
      error: "Falha na API de depoimentos.",
      details: serializeApiError(error),
    });
  }
}
