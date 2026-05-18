import type { VercelRequest, VercelResponse } from "@vercel/node";

type MondayAsset = {
  id: string;
  name: string;
  public_url: string;
};

type MondayColumnValue = {
  id: string;
  text?: string | null;
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

const getColumnSettings = (column: { settings_str?: string | null }) => {
  try {
    return JSON.parse(column.settings_str || "{}");
  } catch {
    return {};
  }
};

const findStatusLabelIndex = (column: { settings_str?: string | null }, label: string) => {
  const settings = getColumnSettings(column);
  const labels = settings?.labels;
  if (!labels || typeof labels !== "object") return null;
  const target = normalizeKey(label);
  const match = Object.entries(labels).find(([, value]) => normalizeKey(String(value)) === target);
  return match ? Number(match[0]) : null;
};

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

const markEditingSubitemsAsEdited = async (
  subitems: { id: string; name: string; boardId?: string | null; status?: string | null; statusColumnId?: string | null; assetsCount: number }[]
) => {
  const pending = subitems.filter(subitem =>
    subitem.assetsCount > 0 &&
    normalizeKey(subitem.name).startsWith("edicao") &&
    normalizeKey(subitem.status || "") !== "editado" &&
    subitem.boardId &&
    subitem.statusColumnId
  );

  if (pending.length === 0) return new Map<string, string>();

  const boardIds = Array.from(new Set(pending.map(subitem => String(subitem.boardId))));
  const columnsData = await mondayFetch(
    `query ($boardIds: [ID!]) {
      boards(ids: $boardIds) {
        id
        columns { id title type settings_str }
      }
    }`,
    { boardIds }
  );

  const boards = columnsData?.data?.boards || [];
  const columnsByBoardId = new Map<string, { id: string; title: string; type: string; settings_str?: string | null }[]>(
    boards.map((board: any) => [String(board.id), board.columns || []])
  );
  const updatedStatuses = new Map<string, string>();

  await Promise.allSettled(pending.map(async subitem => {
    const columns = columnsByBoardId.get(String(subitem.boardId)) || [];
    const statusColumn = columns.find(column =>
      String(column.id) === String(subitem.statusColumnId) ||
      ((column.type === "status" || column.type === "color") &&
        ["status", "situacao", "situacao da tarefa"].some(alias => normalizeKey(column.title).includes(alias)))
    );
    if (!statusColumn) return;

    const editadoIndex = findStatusLabelIndex(statusColumn, "Editado");
    const value = Number.isFinite(editadoIndex) ? { index: editadoIndex } : { label: "Editado" };
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
        boardId: String(subitem.boardId),
        itemId: String(subitem.id),
        columnValues: JSON.stringify({ [String(statusColumn.id)]: value }),
      }
    );
    updatedStatuses.set(String(subitem.id), "Editado");
  }));

  return updatedStatuses;
};

const syncEditedRequests = async (supabase: any, mondaySubitemIds: string[]) => {
  const ids = Array.from(new Set(mondaySubitemIds.map(String).filter(Boolean)));
  if (ids.length === 0) return;

  const { error } = await supabase
    .from("case_editing_requests")
    .update({
      status: "edited",
      edited_at: new Date().toISOString(),
    })
    .in("monday_subitem_id", ids);

  if (error) {
    console.warn("[Testimonials] Nao foi possivel sincronizar pedidos editados no Supabase.", error);
  }
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
            column { title }
          }
        }
      }
    }`;

    const mondayData = await mondayFetch(query, { itemIds: mondayItemIds });
    const items: MondayItem[] = mondayData?.data?.items || [];
    const casesByMondayItemId = new Map(caseRows.map((item: any) => [String(item.monday_item_id), item]));
    const subitemStatusUpdates = await markEditingSubitemsAsEdited(
      items.flatMap(item => (item.subitems || []).map(subitem => ({
        id: String(subitem.id),
        name: subitem.name,
        boardId: subitem.board?.id,
        status: pickStatus(subitem.column_values || []),
        statusColumnId: (subitem.column_values || []).find(column => {
          const title = normalizeKey(column.column?.title || column.id || "");
          return title.includes("status") || title.includes("situacao") || title.includes("situacao");
        })?.id || null,
        assetsCount: normalizeAssets(subitem.assets || []).length,
      })))
    );

    const editedRequestSubitemIds: string[] = [];
    const testimonials = items.flatMap(item => {
      const caseRow = casesByMondayItemId.get(String(item.id));
      if (!caseRow) return [];

      return (item.subitems || []).flatMap(subitem => {
        const assets = normalizeAssets(subitem.assets || []);
        if (assets.length === 0) return [];
        const status = subitemStatusUpdates.get(String(subitem.id)) || pickStatus(subitem.column_values || []);
        if (normalizeKey(subitem.name).startsWith("edicao") && normalizeKey(status || "") === "editado") {
          editedRequestSubitemIds.push(String(subitem.id));
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
          creativeType: pickCreativeType(subitem.column_values || []),
          assets,
        }];
      });
    });

    await syncEditedRequests(supabase, editedRequestSubitemIds);

    return res.status(200).json({ testimonials });
  } catch (error) {
    return res.status(500).json({
      error: "Falha na API de depoimentos.",
      details: serializeApiError(error),
    });
  }
}
