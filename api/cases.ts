import type { VercelRequest, VercelResponse } from "@vercel/node";

const DEFAULT_MONDAY_CASE_BOARD_ID = "18054403734";

const CASE_STAGE_DEFINITIONS = [
  { title: "01. (CADEIRA) Fotos intraorais do antes (4 fotos)", moment: "Planejamento" },
  { title: "02. (ESTUDIO) Video panoramico do antes", moment: "Planejamento" },
  { title: "03. (ESTUDIO) Fotos EXTRAORAIS do antes (2 fotos)", moment: "Planejamento" },
  { title: "04. (ESTUDIO) Video expectativa (paciente)", moment: "Planejamento" },
  { title: "05. Imagens 3D - Planejamento do laboratorio (escaneamento)", moment: "Procedimento" },
  { title: "06. Videos do procedimento", moment: "Procedimento" },
  { title: "07. Fotos DETALHES em macro das proteses fora da boca", moment: "Procedimento" },
  { title: "08. Imagens 3D - Tomografia e RX", moment: "Procedimento" },
  { title: "09. (NA CADEIRA) - Fotos intraorais do depois (4 fotos)", moment: "Entrega" },
  { title: "10. (CONSULTORIO) Video da entrega (reacao da paciente no espelho)", moment: "Entrega" },
  { title: "11. (ESTUDIO) Retratos do depois (posados)", moment: "Entrega" },
  { title: "12. (ESTUDIO) - Fotos em close do sorriso", moment: "Entrega" },
  { title: "13. (ESTUDIO) Fotos em close artisticas do sorriso", moment: "Entrega" },
  { title: "14. (ESTUDIO) Video RESULTADO risada gostosa", moment: "Entrega" },
  { title: "15. (ESTUDIO) Video DEPOIMENTO paciente", moment: "Entrega" },
  { title: "16. (ESTUDIO) Video FEEDBACK EMOCIONAL da dra. pos entrega", moment: "Entrega" },
  { title: "17. Video DEPOIMENTO produzido - videomaker", moment: "Evento" },
  { title: "18. (ESTUDIO) Retratos atualizados do paciente com sorriso novo", moment: "Evento" },
  { title: "19. Foto com o Doutor (O Brinde da Vitoria)", moment: "Evento" },
] as const;

const getCaseStageDefinition = (title: string) =>
  CASE_STAGE_DEFINITIONS.find(stage => stage.title === title);

const getCaseStageMoment = (title: string) =>
  getCaseStageDefinition(title)?.moment || "Planejamento";

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
      .filter(stage => !existingKeys.has(makeStageKey(stage.title)) && !existingNames.has(stage.title))
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
  keywords: body.keywords ? String(body.keywords).trim() : null,
  notes: body.notes ? String(body.notes).trim() : null,
});

const mapCaseRows = (caseRows: any[] = [], stageRows: any[] = [], fileRows: any[] = []) =>
  caseRows.map(caseRow => {
    const stages = stageRows
      .filter(stage => stage.case_id === caseRow.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(stage => ({
        id: stage.id,
        boardId: caseRow.monday_item_id || caseRow.id,
        parentItemId: caseRow.id,
        title: stage.stage_name,
        moment: stage.moment || getCaseStageMoment(stage.stage_name),
        expectedItems: getCaseStageExpectedItems(stage.stage_name),
        status: stage.status === "capturado" ? "Capturado" : "Fazer",
        statusColumnId: stage.monday_subitem_id || "",
        filesColumnId: stage.drive_folder_id || "",
        files: fileRows
          .filter(file => file.stage_id === stage.id)
          .map(file => ({
            id: file.id,
            name: file.file_name,
            public_url: file.mime_type?.startsWith("image/")
              ? `/api/drive-file?fileId=${encodeURIComponent(file.drive_file_id)}`
              : file.web_view_link || "#",
            type: file.mime_type || undefined,
          })),
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
      notes: caseRow.notes,
      mondayItemId: caseRow.monday_item_id,
      driveFolderId: caseRow.drive_folder_id,
      createdAt: caseRow.created_at,
      stages,
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

      return res.status(200).json({ cases: mapCaseRows(cases || [], stages || [], files || []) });
    }

    if (req.method === "POST") {
      const payload = normalizeCasePayload(req.body);
      if (!payload.patient_name) return res.status(400).json({ error: "Nome do paciente e obrigatorio." });
      if (!payload.birth_date) return res.status(400).json({ error: "Data de nascimento e obrigatoria." });

      let caseDriveFolderId: string | null = null;
      if (client.drive_folder_id && (process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 || process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_REFRESH_TOKEN)) {
        const { findOrCreateDriveFolder, getGoogleAccessToken, sanitizeDriveFolderName } = await import("./_googleDrive.js");
        const accessToken = await getGoogleAccessToken();
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
        mondayResult.skipped = false;
        try {
          // Fetch board columns to build column values
          const colsResponse = await fetch("https://api.monday.com/v2", {
            method: "POST",
            headers: {
              Authorization: mondayToken.trim(),
              "Content-Type": "application/json",
              "API-Version": "2024-10",
            },
            body: JSON.stringify({
              query: `query ($boardIds: [ID!]) { boards(ids: $boardIds) { columns { id title type } } }`,
              variables: { boardIds: [String(mondayBoardId)] },
            }),
          });
          const colsData = await colsResponse.json();
          if (colsData.errors) mondayResult.colsError = colsData.errors;
          
          const columns: { id: string; title: string; type: string }[] = colsData?.data?.boards?.[0]?.columns || [];

          const normalizeKey = (v: string) =>
            v
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .trim()
              .toLowerCase()
              .replace(/^#+/, "")
              .replace(/[^a-z0-9]+/g, " ")
              .trim();

          const findCol = (...names: string[]) =>
            columns.find((c) => names.some(name => normalizeKey(c.title) === normalizeKey(name)));

          const columnValues: Record<string, unknown> = {};

          const set = (colNames: string | string[], value: unknown) => {
            const names = Array.isArray(colNames) ? colNames : [colNames];
            const col = findCol(...names);
            if (!col || value === undefined || value === null || String(value).trim() === "") return;
            
            // Prevent updating read-only/auto-calculated columns
            const readOnlyTypes = ["formula", "creation_log", "last_updated", "auto_number", "item_id", "progress", "lookup", "board_relation", "subtasks"];
            if (readOnlyTypes.includes(col.type)) {
              console.log(`[Cases API] Ignorando coluna "${names.join(", ")}" porque o tipo "${col.type}" é somente leitura.`);
              return;
            }

            const text = String(value).trim();
            const type = col.type;
            if (type === "status" || type === "color") columnValues[col.id] = { label: text };
            else if (type === "dropdown") columnValues[col.id] = { labels: [text] };
            else if (type === "date") columnValues[col.id] = { date: text };
            else if (type === "long_text" || type === "long-text") columnValues[col.id] = { text };
            else if (type === "numbers" || type === "numeric") columnValues[col.id] = text;
            else columnValues[col.id] = text;
          };

          const clientLabel = client.monday_client_label || client.case_client_label || client.name || "";
          set("Cliente", clientLabel);
          set(["Nascimento", "#Nascimento", "Data de nascimento"], payload.birth_date);
          set(["Data do Planejamento", "#Data do Planejamento", "Data de planejamento"], new Date().toISOString().slice(0, 10));
          set(["Idade", "#Idade"], calculateAge(payload.birth_date));
          if (payload.gender) set(["Sexo", "#Sexo", "Genero", "Gênero"], payload.gender);
          if (payload.procedure) set(["Procedimentos", "#Procedimentos", "Procedimento"], payload.procedure);
          if (payload.keywords) set(["Palavras - Chave", "#Palavras - Chave", "Palavras-chave", "#Palavras-chave"], payload.keywords);
          set(["Dentista Responsável", "#Dentista Responsável", "Dentista Responsavel", "#Dentista Responsavel"], clientLabel);
          if (payload.notes) set(["Objeção principal", "#Objeção principal", "Objecao principal", "#Objecao principal"], payload.notes);
          if (caseDriveFolderId) {
            const driveCol = findCol("Drive do cliente", "#Drive do cliente", "Drive", "Pasta Drive");
            if (driveCol) {
              const driveUrl = `https://drive.google.com/drive/folders/${caseDriveFolderId}`;
              columnValues[driveCol.id] = driveCol.type === "link" ? { url: driveUrl, text: "Abrir Drive" } : driveUrl;
            }
          }

          const createMutation = `mutation ($boardId: ID!, $itemName: String!, $columnValues: JSON) {
            create_item(board_id: $boardId, item_name: $itemName, column_values: $columnValues) { id }
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
                itemName: payload.patient_name,
                columnValues: JSON.stringify(columnValues),
              },
            }),
          });

          const createData = await createResponse.json();
          const mondayItemId = createData?.data?.create_item?.id;

          if (mondayItemId) {
            mondayResult.success = true;
            mondayResult.itemId = mondayItemId;
            // Save monday_item_id back to the case row (best-effort)
            await supabase
              .from("cases")
              .update({ monday_item_id: mondayItemId })
              .eq("id", createdCase.id);

            console.log(`[Cases API] Monday item criado: ${mondayItemId} para caso ${createdCase.id}`);
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
        const accessToken = await getGoogleAccessToken();
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
