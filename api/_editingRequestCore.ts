const ALLOWED_EDITING_MOMENTS = new Set(["Entrega", "Evento", "Agência", "Agencia"]);
const EDITING_RESPONSIBLE_USER_ID = 68685168;
const EDITING_PRIORITY_LABEL = "Critical ⚠️";

type EditingLogContext = {
  requestId: string;
  caseId?: string;
  stageId?: string;
  subitemId?: string;
};

export const serializeEditingRequestError = (error: unknown) => {
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

const createRequestId = () =>
  `edit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const logInfo = (context: EditingLogContext, step: string, data: Record<string, unknown> = {}) => {
  console.log("[Editing Request]", JSON.stringify({
    level: "info",
    requestId: context.requestId,
    caseId: context.caseId,
    stageId: context.stageId,
    subitemId: context.subitemId,
    step,
    ...data,
  }));
};

const logError = (context: EditingLogContext, step: string, error: unknown, data: Record<string, unknown> = {}) => {
  console.error("[Editing Request]", JSON.stringify({
    level: "error",
    requestId: context.requestId,
    caseId: context.caseId,
    stageId: context.stageId,
    subitemId: context.subitemId,
    step,
    error: serializeEditingRequestError(error),
    ...data,
  }));
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

const mondayRequest = async (
  query: string,
  variables: Record<string, unknown>,
  context: EditingLogContext,
  step: string
) => {
  const mondayToken = process.env.MONDAY_TOKEN;
  if (!mondayToken) throw new Error("MONDAY_TOKEN ausente.");

  logInfo(context, `${step}:request`, {
    variableKeys: Object.keys(variables),
  });

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
    logError(context, `${step}:response_error`, data, {
      status: response.status,
      mondayErrors: data.errors || null,
    });
    const errorMessage =
      data.errors?.map((error: any) => {
        const path = Array.isArray(error.path) ? ` path=${error.path.join(".")}` : "";
        return `${error.message || "Erro sem mensagem"}${path}`;
      }).join(" | ") ||
      data.error ||
      `Falha no Monday. HTTP ${response.status}`;
    throw new Error(errorMessage);
  }
  logInfo(context, `${step}:success`, {
    status: response.status,
  });
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

const isSupportedMaterialColumnType = (type: string) =>
  ["link", "long_text", "long-text", "text"].includes(type);

const createMaterialUpdate = async (
  subitemId: string,
  materialUrl: string,
  context: EditingLogContext,
  reason: string
) => {
  const body = [
    "Material para edição:",
    materialUrl,
    "",
    `Fallback automático: ${reason}`,
  ].join("\n");

  await mondayRequest(
    `mutation ($itemId: ID!, $body: String!) {
      create_update(item_id: $itemId, body: $body) { id }
    }`,
    {
      itemId: String(subitemId),
      body,
    },
    context,
    "create_material_update_fallback"
  );
};

const updateEditingSubitemColumns = async (
  subitemId: string,
  boardId: string | null | undefined,
  materialUrl: string | null | undefined,
  context: EditingLogContext
) => {
  if (!boardId) return { skipped: true, reason: "subitem_board_id_ausente" };

  const columnsData = await mondayRequest(
    `query ($boardIds: [ID!]) {
      boards(ids: $boardIds) {
        columns { id title type settings_str }
      }
    }`,
    { boardIds: [String(boardId)] },
    context,
    "fetch_subitem_board_columns"
  );
  const columns: { id: string; title: string; type: string; settings_str?: string | null }[] =
    columnsData?.data?.boards?.[0]?.columns || [];

  logInfo(context, "subitem_board_columns_loaded", {
    boardId: String(boardId),
    columns: columns.map(column => ({
      id: column.id,
      title: column.title,
      type: column.type,
    })),
  });

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

  const updates: { role: string; id: string; title: string; type: string; value: unknown; createLabels: boolean }[] = [];

  if (priorityColumn) {
    const priorityIndex = findStatusLabelIndex(priorityColumn, EDITING_PRIORITY_LABEL);
    updates.push({
      role: "priority",
      id: priorityColumn.id,
      title: priorityColumn.title,
      type: priorityColumn.type,
      value: Number.isFinite(priorityIndex) ? { index: priorityIndex } : { label: EDITING_PRIORITY_LABEL },
      createLabels: priorityColumn.type === "status" || priorityColumn.type === "color",
    });
  }

  if (responsibleColumn) {
    updates.push({
      role: "responsible",
      id: responsibleColumn.id,
      title: responsibleColumn.title,
      type: responsibleColumn.type,
      value: {
        personsAndTeams: [{ id: EDITING_RESPONSIBLE_USER_ID, kind: "person" }],
      },
      createLabels: false,
    });
  }

  if (deadlineColumn) {
    updates.push({
      role: "deadline",
      id: deadlineColumn.id,
      title: deadlineColumn.title,
      type: deadlineColumn.type,
      value: { date: getTodayDate() },
      createLabels: false,
    });
  }

  if (materialColumn && materialUrl && isSupportedMaterialColumnType(materialColumn.type)) {
    let value: unknown;
    if (materialColumn.type === "link") {
      value = { url: materialUrl, text: "Material para edição" };
    } else if (materialColumn.type === "long_text" || materialColumn.type === "long-text") {
      value = { text: materialUrl };
    } else {
      value = materialUrl;
    }
    updates.push({
      role: "material",
      id: materialColumn.id,
      title: materialColumn.title,
      type: materialColumn.type,
      value,
      createLabels: false,
    });
  } else if (materialColumn && materialUrl) {
    logInfo(context, "material_column_unsupported_type", {
      columnId: materialColumn.id,
      columnTitle: materialColumn.title,
      columnType: materialColumn.type,
    });
    updates.push({
      role: "material",
      id: materialColumn.id,
      title: materialColumn.title,
      type: materialColumn.type,
      value: materialUrl,
      createLabels: false,
    });
  } else if (!materialColumn && materialUrl) {
    logInfo(context, "material_column_not_found_using_update_fallback", {
      materialUrl,
    });
    updates.push({
      role: "material",
      id: "monday_update",
      title: "Update do subitem",
      type: "update",
      value: materialUrl,
      createLabels: false,
    });
  }

  if (updates.length === 0) {
    logInfo(context, "no_columns_found", {
      expectedColumns: ["Priority", "Responsável", "Prazo do criativo", "Material para Edição"],
    });
    return { skipped: true, reason: "colunas_nao_encontradas" };
  }

  logInfo(context, "editing_columns_prepared", {
    updates: updates.map(update => ({
      role: update.role,
      id: update.id,
      title: update.title,
      type: update.type,
      createLabels: update.createLabels,
      valueShape: typeof update.value === "object" && update.value !== null ? Object.keys(update.value as Record<string, unknown>) : typeof update.value,
    })),
  });

  const mutation = `mutation ($boardId: ID!, $itemId: ID!, $columnValues: JSON!, $createLabels: Boolean) {
      change_multiple_column_values(
        board_id: $boardId,
        item_id: $itemId,
        column_values: $columnValues,
        create_labels_if_missing: $createLabels
      ) { id }
    }`;

  const results = [];
  for (const update of updates) {
    try {
      if (update.role === "material" && update.type === "update" && typeof update.value === "string") {
        await createMaterialUpdate(subitemId, update.value, context, "coluna Material para Edição não encontrada");
      } else if (update.role === "material" && !isSupportedMaterialColumnType(update.type) && typeof update.value === "string") {
        await createMaterialUpdate(
          subitemId,
          update.value,
          context,
          `coluna "${update.title}" tem tipo incompatível: ${update.type}`
        );
      } else {
        await mondayRequest(
          mutation,
          {
            boardId: String(boardId),
            itemId: String(subitemId),
            columnValues: JSON.stringify({ [update.id]: update.value }),
            createLabels: update.createLabels,
          },
          context,
          `update_column:${update.role}:${update.title}`
        );
      }
      results.push({
        role: update.role,
        id: update.id,
        title: update.title,
        type: update.type,
        ok: true,
        fallback: update.role === "material" && !isSupportedMaterialColumnType(update.type) ? "update" : null,
      });
    } catch (error) {
      logError(context, `update_column_failed:${update.role}:${update.title}`, error, {
        columnId: update.id,
        columnType: update.type,
      });
      if (update.role === "material" && typeof update.value === "object" && update.value && "url" in update.value) {
        try {
          await createMaterialUpdate(
            subitemId,
            String((update.value as { url: string }).url),
            context,
            `erro ao preencher coluna "${update.title}": ${serializeEditingRequestError(error)}`
          );
          results.push({
            role: update.role,
            id: update.id,
            title: update.title,
            type: update.type,
            ok: true,
            fallback: "update",
            warning: serializeEditingRequestError(error),
          });
          continue;
        } catch (fallbackError) {
          logError(context, "material_update_fallback_failed", fallbackError, {
            originalError: serializeEditingRequestError(error),
          });
        }
      }
      results.push({
        role: update.role,
        id: update.id,
        title: update.title,
        type: update.type,
        ok: false,
        error: serializeEditingRequestError(error),
      });
    }
  }

  const failed = results.filter(result => !result.ok);
  logInfo(context, "editing_columns_finished", {
    successCount: results.length - failed.length,
    failedCount: failed.length,
    results,
  });

  return {
    skipped: false,
    updatedColumns: results.filter(result => result.ok).map(result => result.id),
    results,
    failed,
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

  return error ? serializeEditingRequestError(error) : null;
};

export const requestStageEditing = async (body: any) => {
  const token = String(body?.token || "").trim();
  const caseId = String(body?.caseId || "").trim();
  const stageId = String(body?.stageId || "").trim();
  const context: EditingLogContext = {
    requestId: createRequestId(),
    caseId,
    stageId,
  };

  logInfo(context, "start", {
    hasToken: Boolean(token),
  });

  if (!token) return { status: 400, body: { error: "Token ausente." } };
  if (!caseId) return { status: 400, body: { error: "caseId ausente." } };
  if (!stageId) return { status: 400, body: { error: "stageId ausente." } };

  const supabase = await getSupabaseAdmin();
  logInfo(context, "supabase_ready");
  const client = await getClientByToken(supabase, token);
  logInfo(context, "client_loaded", {
    clientId: client.id,
    clientName: client.name,
  });

  const { data: caseRow, error: caseError } = await supabase
    .from("cases")
    .select("id, patient_name, client_id, monday_item_id")
    .eq("id", caseId)
    .eq("client_id", client.id)
    .maybeSingle();
  if (caseError) throw caseError;
  if (!caseRow) return { status: 404, body: { error: "Caso nao encontrado." } };
  if (!caseRow.monday_item_id) return { status: 400, body: { error: "Este paciente ainda nao tem item no Monday." } };
  logInfo(context, "case_loaded", {
    mondayItemId: caseRow.monday_item_id,
    patientName: caseRow.patient_name,
  });

  const { data: stageRow, error: stageError } = await supabase
    .from("case_stages")
    .select("id, case_id, stage_name, moment, drive_folder_id")
    .eq("id", stageId)
    .eq("case_id", caseId)
    .maybeSingle();
  if (stageError) throw stageError;
  if (!stageRow) return { status: 404, body: { error: "Etapa nao encontrada." } };
  if (!ALLOWED_EDITING_MOMENTS.has(String(stageRow.moment || ""))) {
    return { status: 400, body: { error: "A edição só pode ser solicitada a partir da fase Entrega." } };
  }
  logInfo(context, "stage_loaded", {
    stageName: stageRow.stage_name,
    moment: stageRow.moment,
    driveFolderId: stageRow.drive_folder_id || null,
  });

  const { data: fileRows, error: filesError } = await supabase
    .from("case_files")
    .select("id, drive_file_id, web_view_link, web_content_link, file_name")
    .eq("stage_id", stageId);
  if (filesError) throw filesError;
  if (!fileRows || fileRows.length === 0) {
    return { status: 400, body: { error: "Envie ao menos um arquivo nesta etapa antes de mandar para edição." } };
  }
  logInfo(context, "files_loaded", {
    filesCount: fileRows.length,
    fileNames: fileRows.map((file: any) => file.file_name).slice(0, 10),
  });

  const materialUrl =
    getDriveFolderUrl(stageRow.drive_folder_id) ||
    fileRows.map(getDriveFileUrl).find(Boolean) ||
    null;
  logInfo(context, "material_url_resolved", {
    hasMaterialUrl: Boolean(materialUrl),
    materialUrlType: stageRow.drive_folder_id ? "folder" : "file",
  });

  const existingData = await mondayRequest(
    `query ($itemIds: [ID!]) {
      items(ids: $itemIds) {
        subitems { id name board { id } }
      }
    }`,
    { itemIds: [String(caseRow.monday_item_id)] },
    context,
    "fetch_existing_subitems"
  );
  const taskName = `Edição - ${stageRow.stage_name}`;
  const subitems = existingData?.data?.items?.[0]?.subitems || [];
  const existingSubitem = subitems.find((subitem: any) => normalizeKey(subitem.name) === normalizeKey(taskName));

  const subitem = existingSubitem || (await mondayRequest(
    `mutation ($parentItemId: ID!, $itemName: String!) {
      create_subitem(parent_item_id: $parentItemId, item_name: $itemName) { id board { id } }
    }`,
    {
      parentItemId: String(caseRow.monday_item_id),
      itemName: taskName,
    },
    context,
    "create_editing_subitem"
  ))?.data?.create_subitem;

  const subitemId = subitem?.id;
  if (!subitemId) throw new Error("Monday nao retornou o ID do subelemento de edicao.");
  context.subitemId = String(subitemId);
  logInfo(context, "subitem_ready", {
    existing: Boolean(existingSubitem),
    subitemId,
    subitemBoardId: subitem?.board?.id || null,
    taskName,
  });

  const columnUpdate = await updateEditingSubitemColumns(subitemId, subitem?.board?.id, materialUrl, context);
  const persistWarning = await persistEditingRequest(supabase, {
    clientId: Number(client.id),
    caseId: String(caseRow.id),
    stageId: String(stageRow.id),
    mondayItemId: String(caseRow.monday_item_id),
    mondaySubitemId: String(subitemId),
    stageName: String(stageRow.stage_name),
    materialUrl,
  });
  if (persistWarning) {
    logError(context, "persist_editing_request_warning", persistWarning);
  } else {
    logInfo(context, "persist_editing_request_success");
  }

  return {
    status: existingSubitem ? 200 : 201,
    body: {
      ok: true,
      existing: Boolean(existingSubitem),
      subitemId,
      columnUpdate,
      persistWarning,
      requestId: context.requestId,
    },
  };
};
