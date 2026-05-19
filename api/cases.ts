import type { VercelRequest, VercelResponse } from "@vercel/node";

const DEFAULT_MONDAY_CASE_BOARD_ID = "18054403734";
const MONDAY_CASES_GROUP_TITLE = "##CASOS ACOMPANHADOS NAS CLÍNICAS";
const MONDAY_CASE_TYPE_LABEL = "Caso";

const CASE_STAGE_DEFINITIONS = [
  { title: "Fotos Intraorais do Antes", moment: "Planejamento", legacyTitles: ["01. (CADEIRA) Fotos intraorais do antes (4 fotos)"] },
  { title: "Vídeo Panorâmico do Antes", moment: "Planejamento", legacyTitles: ["02. (CADEIRA OU ESTÚDIO) Vídeo Panorâmico do Antes", "02. (ESTUDIO) Video panoramico do antes"] },
  { title: "Retrato Extraoral do Antes", moment: "Planejamento", legacyTitles: ["03. (ESTUDIO) Fotos EXTRAORAIS do antes (2 fotos)"] },
  { title: "Vídeo Expectativa", moment: "Planejamento", legacyTitles: ["04. (ESTUDIO) Video expectativa (paciente)"] },
  { title: "Imagens 3D do Planejamento", moment: "Procedimento", legacyTitles: ["05. (COMPUTADOR) Imagens 3D do Planejamento", "05. Imagens 3D - Planejamento do laboratorio (escaneamento)"] },
  { title: "Vídeos do Procedimento", moment: "Procedimento", legacyTitles: ["06. Videos do procedimento"] },
  { title: "Fotos Detalhes das Próteses", moment: "Procedimento", legacyTitles: ["07. Fotos DETALHES em macro das proteses fora da boca"] },
  { title: "Imagens 3D, Tomografia e RX", moment: "Procedimento", legacyTitles: ["08. Imagens 3D - Tomografia e RX"] },
  { title: "Fotos Intraorais do Depois", moment: "Entrega", legacyTitles: ["09. (NA CADEIRA) - Fotos intraorais do depois (4 fotos)"] },
  { title: "Vídeo da Entrega", moment: "Entrega", legacyTitles: ["10. (CONSULTORIO) Video da entrega (reacao da paciente no espelho)"] },
  { title: "Retratos do Depois", moment: "Entrega", legacyTitles: ["11. (ESTUDIO) Retratos do depois (posados)"] },
  { title: "Fotos em Close do Sorriso", moment: "Entrega", legacyTitles: ["12. (ESTUDIO) - Fotos em close do sorriso"] },
  { title: "Fotos em Close Artísticas do Sorriso", moment: "Entrega", legacyTitles: ["13. (ESTUDIO) Fotos em close artisticas do sorriso"] },
  { title: "Vídeo Resultado", moment: "Entrega", legacyTitles: ["14. (ESTUDIO) Video RESULTADO risada gostosa"] },
  { title: "Vídeo Depoimento", moment: "Entrega", legacyTitles: ["15. (ESTUDIO) Video DEPOIMENTO paciente"] },
  { title: "Vídeo Feedback Emocional da Doutora", moment: "Entrega", legacyTitles: ["16. (ESTUDIO) Video FEEDBACK EMOCIONAL da dra. pos entrega"] },
  { title: "Depoimento Produzido", moment: "Evento", legacyTitles: ["17. Video DEPOIMENTO produzido - videomaker"] },
  { title: "Retratos Atualizados Lifestyle", moment: "Evento", legacyTitles: ["18. (ESTUDIO) Retratos atualizados do paciente com sorriso novo"] },
  { title: "O Brinde da Vitória", moment: "Evento", legacyTitles: ["19. Foto com o Doutor (O Brinde da Vitoria)"] },
  { title: "Vídeo de Explicação Técnica", moment: "Agência", legacyTitles: ["10. Explicação do caso com dr."] },
] as const;

const getLegacyStageTitles = (stage: typeof CASE_STAGE_DEFINITIONS[number]) =>
  "legacyTitles" in stage ? stage.legacyTitles : [];

const getCaseStageDefinition = (title: string) =>
  CASE_STAGE_DEFINITIONS.find(stage => stage.title === title || getLegacyStageTitles(stage).includes(title));

const getCaseStageMoment = (title: string) =>
  getCaseStageDefinition(title)?.moment || "Planejamento";

const getCanonicalCaseStageTitle = (title: string) =>
  getCaseStageDefinition(title)?.title || title;

const getCaseStageExpectedItems = (title: string) =>
  [];

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

const toDateString = (value: string | null) => {
  if (!value) return null;
  const trimmed = String(value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
};

const serializeApiError = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const parts = [
      record.code,
      record.message,
      record.details,
      record.hint,
    ]
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

const createCaseRequestId = () =>
  `case_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const logCaseInfo = (requestId: string, step: string, data: Record<string, unknown> = {}) => {
  console.log("[Cases Monday]", JSON.stringify({
    level: "info",
    requestId,
    step,
    ...data,
  }));
};

const logCaseError = (requestId: string, step: string, error: unknown, data: Record<string, unknown> = {}) => {
  console.error("[Cases Monday]", JSON.stringify({
    level: "error",
    requestId,
    step,
    error: serializeApiError(error),
    ...data,
  }));
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const makeStageKey = (title: string) =>
  title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

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

const ensureCaseStages = async (supabase: any, caseRows: any[], existingStages: any[]) => {
  const missingRows = caseRows.flatMap(caseRow => {
    const caseStages = existingStages.filter(stage => stage.case_id === caseRow.id);
    const existingKeys = new Set(caseStages.map(stage => stage.stage_key));
    const existingNames = new Set(caseStages.map(stage => stage.stage_name));

    return CASE_STAGE_DEFINITIONS
      .filter(stage => {
        const names = [stage.title, ...getLegacyStageTitles(stage)];
        return !existingKeys.has(makeStageKey(stage.title)) && !names.some(name => existingNames.has(name));
      })
      .map((stage, index) => ({
        case_id: caseRow.id,
        stage_key: makeStageKey(stage.title),
        stage_name: stage.title,
        moment: stage.moment,
        sort_order: index + 1,
        status: "fazer",
      }));
  });

  if (missingRows.length === 0) return existingStages;

  const { error } = await supabase
    .from("case_stages")
    .upsert(missingRows, { onConflict: "case_id,stage_key" });
  if (error) throw error;

  const caseIds = caseRows.map(caseRow => caseRow.id);
  const { data, error: reloadError } = await supabase
    .from("case_stages")
    .select("*")
    .in("case_id", caseIds);
  if (reloadError) throw reloadError;
  return data || [];
};

const normalizeCasePayload = (body: any) => ({
  patient_name: String(body.name || body.patient_name || "").trim(),
  birth_date: toDateString(body.birthDate || body.birth_date || null),
  gender: body.gender ? String(body.gender).trim() : null,
  procedure: body.procedure ? String(body.procedure).trim() : null,
  dentist_responsible: body.dentistResponsible || body.dentist_responsible ? String(body.dentistResponsible || body.dentist_responsible).trim() : null,
  notes: body.notes ? String(body.notes).trim() : null,
});

const getDirectDriveFileUrl = (fileId: string) =>
  `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;

const isMissingSupabaseSchema = (error: any) => {
  const text = [error?.code, error?.message, error?.details].filter(Boolean).join(" ");
  return /PGRST204|PGRST205|42P01|case_stage_usage_locks/i.test(text);
};

const mapCaseRows = (caseRows: any[] = [], stageRows: any[] = [], fileRows: any[] = [], usageLockRows: any[] = [], editingRequestRows: any[] = []) =>
  caseRows.map(caseRow => {
    const usageLocksByStageId = new Map(
      usageLockRows
        .filter(lock => lock.case_id === caseRow.id)
        .map(lock => [String(lock.stage_id), lock])
    );
    const stages = stageRows
      .filter(stage => stage.case_id === caseRow.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(stage => {
        const usageLock = usageLocksByStageId.get(String(stage.id));
        return {
          id: stage.id,
          boardId: caseRow.monday_item_id || caseRow.id,
          parentItemId: caseRow.id,
          title: getCanonicalCaseStageTitle(stage.stage_name),
          moment: getCaseStageMoment(stage.stage_name) || stage.moment,
          expectedItems: getCaseStageExpectedItems(stage.stage_name),
          status: stage.status === "capturado" ? "Capturado" : "Fazer",
          statusColumnId: stage.monday_subitem_id || "",
          filesColumnId: stage.drive_folder_id || "",
          usageLock: usageLock ? {
            id: usageLock.id,
            editingRequestId: usageLock.editing_request_id,
            stageName: usageLock.stage_name,
            lockedAt: usageLock.locked_at,
            lockedBy: usageLock.locked_by,
          } : null,
          files: fileRows
            .filter(file => file.stage_id === stage.id)
            .map(file => ({
              id: file.id,
              name: file.file_name,
              public_url: file.web_content_link || (file.drive_file_id ? getDirectDriveFileUrl(file.drive_file_id) : file.web_view_link || "#"),
              type: file.mime_type || undefined,
              createdAt: file.created_at || undefined,
            })),
        };
      });

    const editingRequests = editingRequestRows
      .filter(r => String(r.case_id) === String(caseRow.id))
      .sort((a: any, b: any) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())
      .map((r: any) => ({
        id: r.id,
        stageId: r.stage_id,
        stageName: r.stage_name,
        status: r.status || 'pending',
        creativeType: r.creative_type,
        sentAt: r.sent_at,
        editedAt: r.edited_at,
        materialUrl: r.material_url,
      }));

    return {
      id: caseRow.id,
      boardId: caseRow.monday_item_id || caseRow.id,
      name: caseRow.patient_name,
      clientName: caseRow.clients?.name || "",
      age: calculateAge(caseRow.birth_date) ?? caseRow.age,
      birthDate: caseRow.birth_date,
      gender: caseRow.gender,
      procedure: caseRow.procedure,
      procedureDescription: caseRow.procedure_description,
      dentistResponsible: caseRow.dentist_responsible,
      notes: caseRow.notes,
      mondayItemId: caseRow.monday_item_id,
      driveFolderId: caseRow.drive_folder_id,
      createdAt: caseRow.created_at,
      stages,
      editingRequests,
    };
  });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const token = String(req.query.token || req.body?.token || "").trim();
    if (!token) return res.status(400).json({ error: "Token ausente." });

    const supabase = await getSupabaseAdmin();
    const client = await getClientByToken(supabase, token);

    if (req.method === "GET") {
      const { data: cases, error: casesError } = await supabase
        .from("cases")
        .select("*, clients(name)")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false });
      if (casesError) throw casesError;

      const caseIds = (cases || []).map(item => item.id);
      let { data: stages, error: stagesError } = caseIds.length
        ? await supabase.from("case_stages").select("*").in("case_id", caseIds)
        : { data: [], error: null };
      if (stagesError) throw stagesError;
      if ((cases || []).length > 0) {
        stages = await ensureCaseStages(supabase, cases || [], stages || []);
      }

      const { data: files, error: filesError } = caseIds.length
        ? await supabase.from("case_files").select("*").in("case_id", caseIds)
        : { data: [], error: null };
      if (filesError) throw filesError;

      const { data: usageLocks, error: usageLocksError } = caseIds.length
        ? await supabase.from("case_stage_usage_locks").select("*").in("case_id", caseIds)
        : { data: [], error: null };
      if (usageLocksError && !isMissingSupabaseSchema(usageLocksError)) throw usageLocksError;

      const { data: editingRequests, error: editingReqError } = caseIds.length
        ? await supabase.from("case_editing_requests").select("id, case_id, stage_id, stage_name, status, creative_type, sent_at, edited_at, material_url").in("case_id", caseIds).order("sent_at", { ascending: false }).limit(100)
        : { data: [], error: null };
      if (editingReqError && !isMissingSupabaseSchema(editingReqError)) {
        console.warn("[Cases] Falha ao buscar editing requests (tabela pode nao existir):", editingReqError);
      }

      return res.status(200).json({ cases: mapCaseRows(cases || [], stages || [], files || [], usageLocksError ? [] : usageLocks || [], editingReqError ? [] : editingRequests || []) });
    }

    if (req.method === "POST") {
      if (String(req.body?.action || "") === "request_editing") {
        const { requestStageEditing } = await import("./_editingRequestCore.js");
        const result = await requestStageEditing(req.body);
        return res.status(result.status).json(result.body);
      }

      const payload = normalizeCasePayload(req.body);
      if (!payload.patient_name) return res.status(400).json({ error: "Nome do paciente e obrigatorio." });

      let caseDriveFolderId: string | null = null;
      if (client.drive_folder_id && (process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 || process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_REFRESH_TOKEN)) {
        const { findOrCreateDriveFolder, getGoogleAccessToken, sanitizeDriveFolderName } = await import("./_googleDrive.js");
        const accessToken = await getGoogleAccessToken({ preferOAuth: true });
        const folder = await findOrCreateDriveFolder(
          accessToken,
          client.drive_folder_id,
          sanitizeDriveFolderName(payload.patient_name)
        );
        caseDriveFolderId = folder.id;
      }

      const { data: createdCase, error: caseError } = await supabase
        .from("cases")
        .insert([{
          client_id: client.id,
          ...payload,
          age: calculateAge(payload.birth_date),
          drive_folder_id: caseDriveFolderId,
          status: "em_andamento",
        }])
        .select()
        .single();
      if (caseError) throw caseError;

      const stageRows = CASE_STAGE_DEFINITIONS.map((stage, index) => ({
        case_id: createdCase.id,
        stage_key: makeStageKey(stage.title),
        stage_name: stage.title,
        moment: stage.moment,
        sort_order: index + 1,
        status: "fazer",
      }));

      const { error: stagesError } = await supabase.from("case_stages").insert(stageRows);
      if (stagesError) throw stagesError;

      // --- Monday.com integration (non-blocking) ---
      let mondayResult: any = { success: false, skipped: true };
      const mondayToken = process.env.MONDAY_TOKEN;
      const mondayBoardId = DEFAULT_MONDAY_CASE_BOARD_ID;
      if (mondayToken && mondayBoardId) {
        const caseRequestId = createCaseRequestId();
        mondayResult.requestId = caseRequestId;
        mondayResult.skipped = false;
        try {
          logCaseInfo(caseRequestId, "start", {
            caseId: createdCase.id,
            patientName: payload.patient_name,
            clientId: client.id,
            clientName: client.name,
            boardId: mondayBoardId,
          });
          // Fetch board columns and groups to build column values
          const colsResponse = await fetch("https://api.monday.com/v2", {
            method: "POST",
            headers: {
              Authorization: mondayToken.trim(),
              "Content-Type": "application/json",
              "API-Version": "2024-10",
            },
            body: JSON.stringify({
              query: `query ($boardIds: [ID!]) { boards(ids: $boardIds) { columns { id title type settings_str } groups { id title } } }`,
              variables: { boardIds: [String(mondayBoardId)] },
            }),
          });
          const colsData = await colsResponse.json();
          if (colsData.errors) {
            mondayResult.colsError = colsData.errors;
            logCaseError(caseRequestId, "fetch_board_columns_error", colsData.errors);
          }
          
          const columns: { id: string; title: string; type: string; settings_str?: string | null }[] = colsData?.data?.boards?.[0]?.columns || [];
          const groups: { id: string; title: string }[] = colsData?.data?.boards?.[0]?.groups || [];
          logCaseInfo(caseRequestId, "board_metadata_loaded", {
            columns: columns.map(column => ({
              id: column.id,
              title: column.title,
              type: column.type,
            })),
            groups: groups.map(group => ({
              id: group.id,
              title: group.title,
            })),
          });

          const normalizeKey = (v: string) =>
            v
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .trim()
              .toLowerCase()
              .replace(/^#+/, "")
              .replace(/[^a-z0-9]+/g, " ")
              .trim();

          const readOnlyTypes = ["formula", "creation_log", "last_updated", "auto_number", "item_id", "progress", "lookup", "board_relation", "subtasks", "mirror"];
          const findCol = (colNames: string | string[], preferredTypes: string[] = []) => {
            const names = Array.isArray(colNames) ? colNames : [colNames];
            const matches = columns.filter((c) => names.some(name => normalizeKey(c.title) === normalizeKey(name)));
            if (matches.length === 0) return undefined;

            const writableMatches = matches.filter((c) => !readOnlyTypes.includes(c.type));
            const preferredMatch = writableMatches.find((c) => preferredTypes.includes(c.type));
            return preferredMatch || writableMatches[0] || matches[0];
          };

          const getColumnSettings = (col: { settings_str?: string | null }) => {
            try {
              return JSON.parse(col.settings_str || "{}");
            } catch {
              return {};
            }
          };

          const findStatusLabelIndex = (col: { settings_str?: string | null }, label: string) => {
            const settings = getColumnSettings(col);
            const labels = settings?.labels;
            if (!labels || typeof labels !== "object") return null;
            const target = normalizeKey(label);
            const match = Object.entries(labels).find(([, value]) => normalizeKey(String(value)) === target);
            return match ? Number(match[0]) : null;
          };

          const getStatusLabelNames = (col: { settings_str?: string | null }) => {
            const settings = getColumnSettings(col);
            const labels = settings?.labels;
            if (!labels || typeof labels !== "object") return [];
            return Object.values(labels).map(String).filter(Boolean);
          };

          const getStatusLabelsWithIndex = (col: { settings_str?: string | null }) => {
            const settings = getColumnSettings(col);
            const labels = settings?.labels;
            if (!labels || typeof labels !== "object") return [];
            return Object.entries(labels).map(([index, label]) => ({
              index,
              label: String(label),
              normalized: normalizeKey(String(label)),
            }));
          };

          const targetGroup = groups.find(group => {
            const title = normalizeKey(group.title);
            return group.title.trim() === MONDAY_CASES_GROUP_TITLE ||
              title === normalizeKey(MONDAY_CASES_GROUP_TITLE) ||
              title === "casos acompanhados nas clinicas" ||
              (title.includes("casos acompanhados") && title.includes("clinicas"));
          });

          const columnUpdates: { id: string; title: string; value: unknown; role?: string; type?: string; sourceText?: string }[] = [];

          const set = (colNames: string | string[], value: unknown, preferredTypes: string[] = []) => {
            const names = Array.isArray(colNames) ? colNames : [colNames];
            const col = findCol(names, preferredTypes);
            const isCliente = names.some(name => normalizeKey(name) === "cliente");
            if (!col) {
              if (isCliente) {
                mondayResult.clientLabelWarning = {
                  requestedLabel: value ? String(value).trim() : "",
                  columnTitle: "Cliente",
                  availableLabels: [],
                  message: "Coluna Cliente nao encontrada no board do Monday.",
                };
                logCaseError(caseRequestId, "client_column_not_found", "Coluna Cliente nao encontrada.", {
                  requestedLabel: value ? String(value).trim() : "",
                  aliases: names,
                  availableColumnTitles: columns.map(column => column.title),
                });
              }
              return;
            }
            if (value === undefined || value === null || String(value).trim() === "") {
              if (isCliente) {
                logCaseError(caseRequestId, "client_label_empty", "Valor do Cliente está vazio.", {
                  rawValue: value,
                  clientName: client.name,
                  caseClientLabel: client.case_client_label || null,
                  mondayClientLabel: client.monday_client_label || null,
                });
              }
              return;
            }
            
            // Prevent updating read-only/auto-calculated columns
            if (readOnlyTypes.includes(col.type)) {
              console.log(`[Cases API] Ignorando coluna "${names.join(", ")}" porque o tipo "${col.type}" é somente leitura.`);
              if (isCliente) {
                logCaseError(caseRequestId, "client_column_readonly", "Coluna Cliente é somente leitura.", {
                  columnId: col.id,
                  columnTitle: col.title,
                  columnType: col.type,
                });
              }
              return;
            }

            const text = String(value).trim();
            const type = col.type;
            let formattedValue: unknown;
            if (type === "status" || type === "color") {
              const labelIndex = findStatusLabelIndex(col, text);
              if (isCliente && !Number.isFinite(labelIndex)) {
                // Label not found by index — log warning but still try by text label
                console.warn(`[Cases API] Label de Cliente "${text}" nao encontrada por indice. Tentando por label direta.`);
                mondayResult.clientLabelWarning = {
                  requestedLabel: text,
                  columnTitle: col.title,
                  availableLabels: getStatusLabelNames(col),
                  message: `Label de Cliente "${text}" nao encontrada por indice. Enviando label direta.`,
                };
              }
              if (isCliente) {
                const labels = getStatusLabelsWithIndex(col);
                logCaseInfo(caseRequestId, "client_column_match", {
                  requestedLabel: text,
                  normalizedRequestedLabel: normalizeKey(text),
                  columnId: col.id,
                  columnTitle: col.title,
                  columnType: col.type,
                  matchedLabelIndex: Number.isFinite(labelIndex) ? labelIndex : null,
                  availableLabels: labels,
                });
              }
              // Always try to set — by index if found, by label text as fallback
              formattedValue = Number.isFinite(labelIndex) ? { index: labelIndex } : { label: text };
            }
            else if (type === "dropdown") formattedValue = { labels: text.split(",").map(item => item.trim()).filter(Boolean) };
            else if (type === "date") formattedValue = { date: text };
            else if (type === "long_text" || type === "long-text") formattedValue = { text };
            else if (type === "numbers" || type === "numeric") formattedValue = text;
            else formattedValue = text;

            columnUpdates.push({
              id: col.id,
              title: col.title,
              value: formattedValue,
              role: isCliente ? "client" : normalizeKey(names[0] || col.title),
              type: col.type,
              sourceText: text,
            });
          };

          const clientLabel = client.monday_client_label || client.case_client_label || client.name || "";
          const dentistResponsible = String(payload.dentist_responsible || "").trim();
          logCaseInfo(caseRequestId, "client_label_resolved", {
            clientLabel,
            clientName: client.name,
            caseClientLabel: client.case_client_label || null,
            mondayClientLabel: client.monday_client_label || null,
          });
          set(["Cliente", "#Cliente"], clientLabel, ["status", "color", "dropdown", "text"]);
          set(["Tipo", "#Tipo"], MONDAY_CASE_TYPE_LABEL, ["status", "color", "dropdown", "text"]);
          set(["Nascimento", "#Nascimento", "Data de nascimento"], payload.birth_date);
          set(["Data do Planejamento", "#Data do Planejamento", "Data de planejamento"], new Date().toISOString().slice(0, 10));
          set(["Idade", "#Idade"], calculateAge(payload.birth_date));
          if (payload.gender) set(["Sexo", "#Sexo", "Genero", "Gênero"], payload.gender, ["status", "color", "dropdown", "text"]);
          if (payload.procedure) set(["Procedimentos", "#Procedimentos", "Procedimento"], payload.procedure, ["dropdown", "status", "color", "text"]);
          if (dentistResponsible) set(["Dentista Responsável", "#Dentista Responsável", "Dentista Responsavel", "#Dentista Responsavel"], dentistResponsible, ["text", "long_text", "status", "color", "dropdown"]);
          if (caseDriveFolderId) {
            const driveCol = findCol(["Drive do cliente", "#Drive do cliente", "Drive", "Pasta Drive"], ["link", "text"]);
            if (driveCol) {
              const driveUrl = `https://drive.google.com/drive/folders/${caseDriveFolderId}`;
              columnUpdates.push({
                id: driveCol.id,
                title: driveCol.title,
                value: driveCol.type === "link" ? { url: driveUrl, text: "Abrir Drive" } : driveUrl,
                role: "drive",
                type: driveCol.type,
                sourceText: driveUrl,
              });
            }
          }

          if (!targetGroup) {
            throw new Error(`Grupo "${MONDAY_CASES_GROUP_TITLE}" nao encontrado no board ${mondayBoardId}.`);
          }

          const clientColumnUpdates = columnUpdates.filter(update => normalizeKey(update.title) === "cliente");
          const otherColumnUpdates = columnUpdates.filter(update => normalizeKey(update.title) !== "cliente");
          logCaseInfo(caseRequestId, "column_updates_prepared", {
            clientColumnUpdates: clientColumnUpdates.map(update => ({
              id: update.id,
              title: update.title,
              type: update.type,
              sourceText: update.sourceText,
              valueShape: typeof update.value === "object" && update.value !== null ? Object.keys(update.value as Record<string, unknown>) : typeof update.value,
            })),
            otherColumnCount: otherColumnUpdates.length,
          });

          const createMutation = `mutation ($boardId: ID!, $groupId: String!, $itemName: String!) {
            create_item(
              board_id: $boardId,
              group_id: $groupId,
              item_name: $itemName
            ) { id }
          }`;

          const createResponse = await fetch("https://api.monday.com/v2", {
            method: "POST",
            headers: {
              Authorization: mondayToken.trim(),
              "Content-Type": "application/json",
              "API-Version": "2024-10",
            },
            body: JSON.stringify({
              query: createMutation,
              variables: {
                boardId: String(mondayBoardId),
                groupId: targetGroup.id,
                itemName: payload.patient_name,
              },
            }),
          });

          const createData = await createResponse.json();
          if (!createResponse.ok || createData.errors) {
            logCaseError(caseRequestId, "create_item_error", createData, {
              status: createResponse.status,
            });
            throw new Error(createData.errors?.map((error: any) => error.message).join(" ") || `Falha ao criar item no Monday. HTTP ${createResponse.status}`);
          }
          const mondayItemId = createData?.data?.create_item?.id;

          if (mondayItemId) {
            mondayResult.success = true;
            mondayResult.itemId = mondayItemId;
            mondayResult.groupId = targetGroup.id;
            logCaseInfo(caseRequestId, "item_created", {
              mondayItemId,
              groupId: targetGroup.id,
            });
            // Save monday_item_id back to the case row (best-effort)
            await supabase
              .from("cases")
              .update({ monday_item_id: mondayItemId })
              .eq("id", createdCase.id);

            console.log(`[Cases API] Monday item criado: ${mondayItemId} para caso ${createdCase.id}`);

            const columnErrors: { column: string; error: string; role?: string; id?: string; type?: string }[] = [];
            const changeColumnMutation = `mutation ($boardId: ID!, $itemId: ID!, $columnValues: JSON!, $createLabels: Boolean) {
              change_multiple_column_values(
                board_id: $boardId,
                item_id: $itemId,
                column_values: $columnValues,
                create_labels_if_missing: $createLabels
              ) { id }
            }`;

            const updateMondayColumns = async (updates: typeof columnUpdates, createLabels = false) => {
              if (updates.length === 0) return;
              const columnValues = updates.reduce<Record<string, unknown>>((acc, update) => {
                acc[update.id] = update.value;
                return acc;
              }, {});
              const isClientUpdate = updates.some(update => update.role === "client");
              logCaseInfo(caseRequestId, isClientUpdate ? "update_client_column_request" : "update_other_columns_request", {
                createLabels,
                updates: updates.map(update => ({
                  role: update.role,
                  id: update.id,
                  title: update.title,
                  type: update.type,
                  sourceText: update.sourceText,
                  value: update.value,
                })),
                columnValues,
              });
              const updateResponse = await fetch("https://api.monday.com/v2", {
                method: "POST",
                headers: {
                  Authorization: mondayToken.trim(),
                  "Content-Type": "application/json",
                  "API-Version": "2024-10",
                },
                body: JSON.stringify({
                  query: changeColumnMutation,
                  variables: {
                    boardId: String(mondayBoardId),
                    itemId: String(mondayItemId),
                    columnValues: JSON.stringify(columnValues),
                    createLabels,
                  },
                }),
              });
              const updateData = await updateResponse.json().catch(() => ({}));
              if (!updateResponse.ok || updateData.errors) {
                logCaseError(caseRequestId, isClientUpdate ? "update_client_column_error" : "update_other_columns_error", updateData, {
                  status: updateResponse.status,
                  createLabels,
                  updates: updates.map(update => ({
                    role: update.role,
                    id: update.id,
                    title: update.title,
                    type: update.type,
                    sourceText: update.sourceText,
                  })),
                });
                updates.forEach((update) => columnErrors.push({
                  column: update.title,
                  role: update.role,
                  id: update.id,
                  type: update.type,
                  error: updateData.errors?.map((error: any) => error.message).join(" ") || `HTTP ${updateResponse.status}`,
                }));
              } else {
                logCaseInfo(caseRequestId, isClientUpdate ? "update_client_column_success" : "update_other_columns_success", {
                  response: updateData,
                });
              }
            };

            // Update client column first (with create_labels_if_missing: true as safety net)
            await updateMondayColumns(clientColumnUpdates, true);

            const verifyClientColumn = async (step: string) => {
              if (clientColumnUpdates.length === 0) {
                logCaseError(caseRequestId, `${step}_missing`, "Nenhuma atualização preparada para Cliente.", {
                  clientLabel,
                });
                return null;
              }
              const clientUpdate = clientColumnUpdates[0];
              const verifyResponse = await fetch("https://api.monday.com/v2", {
                method: "POST",
                headers: {
                  Authorization: mondayToken.trim(),
                  "Content-Type": "application/json",
                  "API-Version": "2024-10",
                },
                body: JSON.stringify({
                  query: `query ($itemIds: [ID!]) {
                    items(ids: $itemIds) {
                      id
                      column_values(ids: ["${clientUpdate.id}"]) {
                        id
                        text
                        value
                        column { title type }
                      }
                    }
                  }`,
                  variables: {
                    itemIds: [String(mondayItemId)],
                  },
                }),
              });
              const verifyData = await verifyResponse.json().catch(() => ({}));
              const verification = verifyData?.data?.items?.[0]?.column_values?.[0] || null;
              if (!verifyResponse.ok || verifyData.errors) {
                logCaseError(caseRequestId, `${step}_error`, verifyData, {
                  status: verifyResponse.status,
                  clientColumnId: clientUpdate.id,
                });
              } else {
                logCaseInfo(caseRequestId, `${step}_success`, {
                  clientColumnId: clientUpdate.id,
                  verification,
                });
              }
              return verification;
            };

            if (clientColumnUpdates.length > 0) {
              mondayResult.clientColumnVerification = await verifyClientColumn("verify_client_column_after_client_update");
            } else {
              logCaseError(caseRequestId, "client_column_update_missing", "Nenhuma atualização preparada para Cliente.", {
                clientLabel,
              });
            }

            // Always update remaining columns regardless of client column result
            await updateMondayColumns(otherColumnUpdates, false);
            mondayResult.clientColumnFinalVerification = await verifyClientColumn("verify_client_column_after_other_updates");

            if (clientColumnUpdates.length > 0) {
              await wait(2500);
              const delayedVerification = await verifyClientColumn("verify_client_column_after_delay");
              mondayResult.clientColumnDelayedVerification = delayedVerification;
              const delayedText = String(delayedVerification?.text || "").trim();

              if (normalizeKey(delayedText) !== normalizeKey(clientLabel)) {
                logCaseError(caseRequestId, "client_column_overwritten_detected", "Cliente mudou depois do update inicial.", {
                  expected: clientLabel,
                  received: delayedText,
                  verification: delayedVerification,
                });
                await updateMondayColumns(clientColumnUpdates, true);
                await wait(700);
                mondayResult.clientColumnRepairVerification = await verifyClientColumn("verify_client_column_after_repair");
              } else {
                logCaseInfo(caseRequestId, "client_column_stable_after_delay", {
                  expected: clientLabel,
                  received: delayedText,
                });
              }
            }

            if (columnErrors.length > 0) {
              mondayResult.columnErrors = columnErrors;
              console.warn("[Cases API] Item criado no Monday, mas algumas colunas nao atualizaram.", JSON.stringify(columnErrors));
            }

            if (payload.notes) {
              const updateResponse = await fetch("https://api.monday.com/v2", {
                method: "POST",
                headers: {
                  Authorization: mondayToken.trim(),
                  "Content-Type": "application/json",
                  "API-Version": "2024-10",
                },
                body: JSON.stringify({
                  query: `mutation ($itemId: ID!, $body: String!) { create_update(item_id: $itemId, body: $body) { id } }`,
                  variables: {
                    itemId: String(mondayItemId),
                    body: payload.notes,
                  },
                }),
              });
              const updateData = await updateResponse.json().catch(() => ({}));
              if (!updateResponse.ok || updateData.errors) {
                mondayResult.updateError = updateData.errors || updateData;
              }
            }

          } else {
            mondayResult.error = createData;
            console.warn("[Cases API] Monday nao retornou item ID.", JSON.stringify(createData));
          }
        } catch (mondayError) {
          mondayResult.error = mondayError instanceof Error ? mondayError.message : String(mondayError);
          // Non-blocking: log the error but don't fail the whole request
          console.error("[Cases API] Falha ao criar item no Monday (nao bloqueante):", mondayError);
        }
      }
      // --- fim Monday.com integration ---

      return res.status(201).json({ caseId: createdCase.id, monday: mondayResult });
    }

    if (req.method === "PUT") {
      const caseId = String(req.query.caseId || req.body?.caseId || "").trim();
      if (!caseId) return res.status(400).json({ error: "caseId ausente." });

      const { data: existingCase, error: caseError } = await supabase
        .from("cases")
        .select("*")
        .eq("id", caseId)
        .eq("client_id", client.id)
        .maybeSingle();
      if (caseError) throw caseError;
      if (!existingCase) return res.status(404).json({ error: "Caso nao encontrado." });

      const payload = normalizeCasePayload(req.body);
      if (!payload.patient_name) return res.status(400).json({ error: "Nome do paciente e obrigatorio." });

      // Rename Google Drive folder if name changed
      if (existingCase.drive_folder_id && existingCase.patient_name !== payload.patient_name && (process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 || process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_REFRESH_TOKEN)) {
        try {
          const { getGoogleAccessToken, sanitizeDriveFolderName, updateDriveFolderName } = await import("./_googleDrive.js");
          const accessToken = await getGoogleAccessToken({ preferOAuth: true });
          await updateDriveFolderName(
            accessToken,
            existingCase.drive_folder_id,
            sanitizeDriveFolderName(payload.patient_name)
          );
        } catch (driveErr) {
          console.error("[Cases API] Falha ao renomear pasta no Drive:", driveErr);
        }
      }

      // Update in Supabase
      const { data: updatedCase, error: updateError } = await supabase
        .from("cases")
        .update({
          patient_name: payload.patient_name,
          birth_date: payload.birth_date,
          gender: payload.gender,
          procedure: payload.procedure,
          dentist_responsible: payload.dentist_responsible,
          notes: payload.notes,
          age: calculateAge(payload.birth_date),
        })
        .eq("id", caseId)
        .eq("client_id", client.id)
        .select()
        .single();
      if (updateError) throw updateError;

      // Monday.com integration (non-blocking)
      let mondayResult: any = { success: false, skipped: true };
      const mondayToken = process.env.MONDAY_TOKEN;
      const mondayBoardId = DEFAULT_MONDAY_CASE_BOARD_ID;
      if (mondayToken && mondayBoardId && existingCase.monday_item_id) {
        mondayResult.skipped = false;
        try {
          // 1. Rename item in Monday if name changed
          if (existingCase.patient_name !== payload.patient_name) {
            await fetch("https://api.monday.com/v2", {
              method: "POST",
              headers: {
                Authorization: mondayToken.trim(),
                "Content-Type": "application/json",
                "API-Version": "2024-10",
              },
              body: JSON.stringify({
                query: `mutation ($boardId: ID!, $itemId: ID!, $newName: String!) { rename_item(board_id: $boardId, item_id: $itemId, new_name: $newName) { id } }`,
                variables: {
                  boardId: String(mondayBoardId),
                  itemId: String(existingCase.monday_item_id),
                  newName: payload.patient_name,
                },
              }),
            });
          }

          // 2. Fetch board columns to map other column updates
          const colsResponse = await fetch("https://api.monday.com/v2", {
            method: "POST",
            headers: {
              Authorization: mondayToken.trim(),
              "Content-Type": "application/json",
              "API-Version": "2024-10",
            },
            body: JSON.stringify({
              query: `query ($boardIds: [ID!]) { boards(ids: $boardIds) { columns { id title type settings_str } } }`,
              variables: { boardIds: [String(mondayBoardId)] },
            }),
          });
          const colsData = await colsResponse.json();
          const columns: { id: string; title: string; type: string; settings_str?: string | null }[] = colsData?.data?.boards?.[0]?.columns || [];

          const normalizeKey = (v: string) =>
            v
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .trim()
              .toLowerCase()
              .replace(/^#+/, "")
              .replace(/[^a-z0-9]+/g, " ")
              .trim();

          const readOnlyTypes = ["formula", "creation_log", "last_updated", "auto_number", "item_id", "progress", "lookup", "board_relation", "subtasks", "mirror"];
          const findCol = (colNames: string | string[], preferredTypes: string[] = []) => {
            const names = Array.isArray(colNames) ? colNames : [colNames];
            const matches = columns.filter((c) => names.some(name => normalizeKey(c.title) === normalizeKey(name)));
            if (matches.length === 0) return undefined;
            const writableMatches = matches.filter((c) => !readOnlyTypes.includes(c.type));
            const preferredMatch = writableMatches.find((c) => preferredTypes.includes(c.type));
            return preferredMatch || writableMatches[0] || matches[0];
          };

          const getColumnSettings = (col: { settings_str?: string | null }) => {
            try {
              return JSON.parse(col.settings_str || "{}");
            } catch {
              return {};
            }
          };

          const findStatusLabelIndex = (col: { settings_str?: string | null }, label: string) => {
            const settings = getColumnSettings(col);
            const labels = settings?.labels;
            if (!labels || typeof labels !== "object") return null;
            const target = normalizeKey(label);
            const match = Object.entries(labels).find(([, value]) => normalizeKey(String(value)) === target);
            return match ? Number(match[0]) : null;
          };

          const columnUpdates: { id: string; title: string; value: unknown }[] = [];
          const set = (colNames: string | string[], value: unknown, preferredTypes: string[] = []) => {
            const names = Array.isArray(colNames) ? colNames : [colNames];
            const col = findCol(names, preferredTypes);
            if (!col) return;
            if (value === undefined || value === null || String(value).trim() === "") return;
            
            const text = String(value).trim();
            const type = col.type;
            let formattedValue: unknown;
            if (type === "status" || type === "color") {
              const labelIndex = findStatusLabelIndex(col, text);
              formattedValue = Number.isFinite(labelIndex) ? { index: labelIndex } : { label: text };
            }
            else if (type === "dropdown") formattedValue = { labels: text.split(",").map(item => item.trim()).filter(Boolean) };
            else if (type === "date") formattedValue = { date: text };
            else if (type === "long_text" || type === "long-text") formattedValue = { text };
            else if (type === "numbers" || type === "numeric") formattedValue = text;
            else formattedValue = text;

            columnUpdates.push({ id: col.id, title: col.title, value: formattedValue });
          };

          const dentistResponsible = String(payload.dentist_responsible || "").trim();
          set(["Nascimento", "#Nascimento", "Data de nascimento"], payload.birth_date);
          set(["Idade", "#Idade"], calculateAge(payload.birth_date));
          if (payload.gender) set(["Sexo", "#Sexo", "Genero", "Gênero"], payload.gender, ["status", "color", "dropdown", "text"]);
          if (payload.procedure) set(["Procedimentos", "#Procedimentos", "Procedimento"], payload.procedure, ["dropdown", "status", "color", "text"]);
          if (dentistResponsible) set(["Dentista Responsável", "#Dentista Responsável", "Dentista Responsavel", "#Dentista Responsavel"], dentistResponsible, ["text", "long_text", "status", "color", "dropdown"]);

          if (columnUpdates.length > 0) {
            const columnValues = columnUpdates.reduce<Record<string, unknown>>((acc, update) => {
              acc[update.id] = update.value;
              return acc;
            }, {});

            await fetch("https://api.monday.com/v2", {
              method: "POST",
              headers: {
                Authorization: mondayToken.trim(),
                "Content-Type": "application/json",
                "API-Version": "2024-10",
              },
              body: JSON.stringify({
                query: `mutation ($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
                  change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $columnValues) { id }
                }`,
                variables: {
                  boardId: String(mondayBoardId),
                  itemId: String(existingCase.monday_item_id),
                  columnValues: JSON.stringify(columnValues),
                },
              }),
            });
          }

          // 3. Add Monday update update/timeline note only if notes changed
          if (payload.notes && existingCase.notes !== payload.notes) {
            await fetch("https://api.monday.com/v2", {
              method: "POST",
              headers: {
                Authorization: mondayToken.trim(),
                "Content-Type": "application/json",
                "API-Version": "2024-10",
              },
              body: JSON.stringify({
                query: `mutation ($itemId: ID!, $body: String!) { create_update(item_id: $itemId, body: $body) { id } }`,
                variables: {
                  itemId: String(existingCase.monday_item_id),
                  body: `[Atualização] ${payload.notes}`,
                },
              }),
            });
          }

          mondayResult.success = true;
        } catch (mondayError) {
          console.error("[Cases API] Falha ao atualizar Monday (nao bloqueante):", mondayError);
          mondayResult.error = mondayError instanceof Error ? mondayError.message : String(mondayError);
        }
      }

      return res.status(200).json({ caseId: updatedCase.id, monday: mondayResult });
    }

    if (req.method === "DELETE") {
      const caseId = String(req.query.caseId || req.body?.caseId || "").trim();
      if (!caseId) return res.status(400).json({ error: "caseId ausente." });

      const { data: existingCase, error: caseError } = await supabase
        .from("cases")
        .select("*")
        .eq("id", caseId)
        .eq("client_id", client.id)
        .maybeSingle();
      if (caseError) throw caseError;
      if (!existingCase) return res.status(404).json({ error: "Caso nao encontrado." });

      if (existingCase.monday_item_id && process.env.MONDAY_TOKEN) {
        const mondayToken = process.env.MONDAY_TOKEN;
        const deleteResponse = await fetch("https://api.monday.com/v2", {
          method: "POST",
          headers: {
            Authorization: mondayToken.trim(),
            "Content-Type": "application/json",
            "API-Version": "2024-10",
          },
          body: JSON.stringify({
            query: `mutation ($itemId: ID!) { delete_item(item_id: $itemId) { id } }`,
            variables: { itemId: String(existingCase.monday_item_id) },
          }),
        });
        const deleteData = await deleteResponse.json().catch(() => ({}));
        if (!deleteResponse.ok || deleteData.errors) {
          throw new Error(deleteData.errors?.map((error: any) => error.message).join(" ") || "Falha ao excluir item no Monday.");
        }
      }

      if (existingCase.drive_folder_id && (process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 || process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_REFRESH_TOKEN)) {
        const { deleteDriveFile, getGoogleAccessToken } = await import("./_googleDrive.js");
        const accessToken = await getGoogleAccessToken({ preferOAuth: true });
        await deleteDriveFile(accessToken, existingCase.drive_folder_id);
      }

      const { error: deleteError } = await supabase
        .from("cases")
        .delete()
        .eq("id", caseId)
        .eq("client_id", client.id);
      if (deleteError) throw deleteError;

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Metodo nao permitido." });
  } catch (error) {
    return res.status(500).json({
      error: "Falha na API de casos.",
      details: serializeApiError(error),
    });
  }
}
