import type { VercelRequest, VercelResponse } from "@vercel/node";

const ALLOWED_EDITING_MOMENTS = new Set(["Entrega", "Evento", "Agência", "Agencia"]);
const EDITING_RESPONSIBLE_USER_ID = 68685168;
const EDITING_PRIORITY_LABEL = "Critical ⚠️";

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

const getTodayDate = () => new Date().toISOString().slice(0, 10);

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

const updateEditingSubitemColumns = async (subitemId: string, boardId?: string | null, materialUrl?: string | null) => {
  if (!boardId) return { skipped: true, reason: "subitem_board_id_ausente" };

  const columnsQuery = `query ($boardIds: [ID!]) {
    boards(ids: $boardIds) {
      columns { id title type settings_str }
    }
  }`;
  const columnsData = await mondayRequest(columnsQuery, { boardIds: [String(boardId)] });
  const columns: { id: string; title: string; type: string; settings_str?: string | null }[] =
    columnsData?.data?.boards?.[0]?.columns || [];

  const findColumn = (names: string[], types: string[] = []) => {
    const matches = columns.filter(column => names.some(name => normalizeKey(column.title) === normalizeKey(name)));
    if (matches.length === 0) return undefined;
    return matches.find(column => types.includes(column.type)) || matches[0];
  };

  const priorityColumn = findColumn(["Priority", "Prioridade"], ["status", "color"]);
  const responsibleColumn = findColumn(["Responsável", "Responsavel", "Pessoa", "Pessoa responsável", "Pessoa responsavel"], ["people", "person"]);
  const deadlineColumn = findColumn(["Prazo do criativo", "Prazo", "Data", "Deadline"], ["date"]);
  const materialColumn = findColumn(
    ["Material para Edição", "Material para Edicao", "#Material para Edição", "#Material para Edicao", "Material", "Link do Drive", "Drive"],
    ["link", "long_text", "long-text", "text"]
  );

  const columnValues: Record<string, unknown> = {};

  if (priorityColumn) {
    const priorityIndex = findStatusLabelIndex(priorityColumn, EDITING_PRIORITY_LABEL);
    columnValues[priorityColumn.id] = Number.isFinite(priorityIndex)
      ? { index: priorityIndex }
      : { label: EDITING_PRIORITY_LABEL };
  }

  if (responsibleColumn) {
    columnValues[responsibleColumn.id] = {
      personsAndTeams: [{ id: EDITING_RESPONSIBLE_USER_ID, kind: "person" }],
    };
  }

  if (deadlineColumn) {
    columnValues[deadlineColumn.id] = { date: getTodayDate() };
  }

  if (materialColumn && materialUrl) {
    if (materialColumn.type === "link") {
      columnValues[materialColumn.id] = { url: materialUrl, text: "Material para edição" };
    } else if (materialColumn.type === "long_text" || materialColumn.type === "long-text") {
      columnValues[materialColumn.id] = { text: materialUrl };
    } else {
      columnValues[materialColumn.id] = materialUrl;
    }
  }

  if (Object.keys(columnValues).length === 0) {
    return { skipped: true, reason: "colunas_nao_encontradas" };
  }

  const updateMutation = `mutation ($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
    change_multiple_column_values(
      board_id: $boardId,
      item_id: $itemId,
      column_values: $columnValues,
      create_labels_if_missing: false
    ) { id }
  }`;
  await mondayRequest(updateMutation, {
    boardId: String(boardId),
    itemId: String(subitemId),
    columnValues: JSON.stringify(columnValues),
  });

  return {
    skipped: false,
    updatedColumns: Object.keys(columnValues),
  };
};

const getDriveFolderUrl = (folderId?: string | null) =>
  folderId ? `https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}` : null;

const getDriveFileUrl = (file: any) => {
  if (file?.web_view_link) return file.web_view_link;
  if (file?.drive_file_id) return `https://drive.google.com/file/d/${encodeURIComponent(file.drive_file_id)}/view`;
  if (file?.web_content_link) return file.web_content_link;
  return null;
};

const persistEditingRequest = async (
  supabase: any,
  payload: {
    clientId: number;
    caseId: string;
    stageId: string;
    mondayItemId: string;
    mondaySubitemId: string;
    stageName: string;
    materialUrl: string | null;
  }
) => {
  const { error } = await supabase
    .from("case_editing_requests")
    .upsert(
      [{
        client_id: payload.clientId,
        case_id: payload.caseId,
        stage_id: payload.stageId,
        monday_item_id: payload.mondayItemId,
        monday_subitem_id: payload.mondaySubitemId,
        stage_name: payload.stageName,
        material_url: payload.materialUrl,
        status: "sent",
        sent_at: new Date().toISOString(),
      }],
      { onConflict: "case_id,stage_id" }
    );

  if (error) throw error;
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
      .select("id, case_id, stage_name, moment, drive_folder_id")
      .eq("id", stageId)
      .eq("case_id", caseId)
      .maybeSingle();
    if (stageError) throw stageError;
    if (!stageRow) return res.status(404).json({ error: "Etapa nao encontrada." });
    if (!ALLOWED_EDITING_MOMENTS.has(String(stageRow.moment || ""))) {
      return res.status(400).json({ error: "A edição só pode ser solicitada a partir da fase Entrega." });
    }

    const { data: fileRows, error: filesError } = await supabase
      .from("case_files")
      .select("id, drive_file_id, web_view_link, web_content_link, file_name")
      .eq("stage_id", stageId);
    if (filesError) throw filesError;
    if (!fileRows || fileRows.length === 0) return res.status(400).json({ error: "Envie ao menos um arquivo nesta etapa antes de mandar para edição." });

    const materialUrl =
      getDriveFolderUrl(stageRow.drive_folder_id) ||
      fileRows.map(getDriveFileUrl).find(Boolean) ||
      null;

    const itemQuery = `query ($itemIds: [ID!]) {
      items(ids: $itemIds) {
        subitems { id name board { id } }
      }
    }`;
    const existingData = await mondayRequest(itemQuery, { itemIds: [String(caseRow.monday_item_id)] });
    const taskName = `Edição - ${stageRow.stage_name}`;
    const subitems = existingData?.data?.items?.[0]?.subitems || [];
    const existingSubitem = subitems.find((subitem: any) => normalizeKey(subitem.name) === normalizeKey(taskName));

    if (existingSubitem) {
      const columnUpdate = await updateEditingSubitemColumns(existingSubitem.id, existingSubitem.board?.id, materialUrl);
      await persistEditingRequest(supabase, {
        clientId: Number(client.id),
        caseId: String(caseRow.id),
        stageId: String(stageRow.id),
        mondayItemId: String(caseRow.monday_item_id),
        mondaySubitemId: String(existingSubitem.id),
        stageName: String(stageRow.stage_name),
        materialUrl,
      });
      return res.status(200).json({ ok: true, existing: true, subitemId: existingSubitem.id, columnUpdate });
    }

    const createMutation = `mutation ($parentItemId: ID!, $itemName: String!) {
      create_subitem(parent_item_id: $parentItemId, item_name: $itemName) { id board { id } }
    }`;
    const createdData = await mondayRequest(createMutation, {
      parentItemId: String(caseRow.monday_item_id),
      itemName: taskName,
    });
    const subitem = createdData?.data?.create_subitem;
    const subitemId = subitem?.id;
    if (!subitemId) throw new Error("Monday nao retornou o ID do subelemento de edicao.");
    const columnUpdate = await updateEditingSubitemColumns(subitemId, subitem?.board?.id, materialUrl);
    await persistEditingRequest(supabase, {
      clientId: Number(client.id),
      caseId: String(caseRow.id),
      stageId: String(stageRow.id),
      mondayItemId: String(caseRow.monday_item_id),
      mondaySubitemId: String(subitemId),
      stageName: String(stageRow.stage_name),
      materialUrl,
    });

    return res.status(201).json({ ok: true, existing: false, subitemId, columnUpdate });
  } catch (error) {
    return res.status(500).json({
      error: "Falha ao mandar para edição.",
      details: serializeApiError(error),
    });
  }
}
