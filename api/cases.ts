import type { VercelRequest, VercelResponse } from "@vercel/node";

const CASE_STAGE_DEFINITIONS = [
  {
    title: "Planejamento",
    moment: "Planejamento",
    expectedItems: [
      "01. (CADEIRA) Fotos intraorais do antes (4 fotos)",
      "02. (ESTUDIO) Video panoramico do antes",
      "03. (ESTUDIO) Fotos EXTRAORAIS do antes (2 fotos)",
      "04. (ESTUDIO) Video expectativa (paciente)",
    ],
  },
  {
    title: "Procedimento",
    moment: "Procedimento",
    expectedItems: [
      "05. Imagens 3D - Planejamento do laboratorio (escaneamento)",
      "06. Videos do procedimento",
      "07. Fotos DETALHES em macro das proteses fora da boca",
      "08. Imagens 3D - Tomografia e RX",
    ],
  },
  {
    title: "Entrega",
    moment: "Entrega",
    expectedItems: [
      "09. (NA CADEIRA) - Fotos intraorais do depois (4 fotos)",
      "10. (CONSULTORIO) Video da entrega (reacao da paciente no espelho)",
      "11. (ESTUDIO) Retratos do depois (posados)",
      "12. (ESTUDIO) - Fotos em close do sorriso",
      "13. (ESTUDIO) Fotos em close artisticas do sorriso",
      "14. (ESTUDIO) Video RESULTADO risada gostosa",
      "15. (ESTUDIO) Video DEPOIMENTO paciente",
      "16. (ESTUDIO) Video FEEDBACK EMOCIONAL da dra. pos entrega",
    ],
  },
  {
    title: "Evento",
    moment: "Evento",
    expectedItems: [
      "17. Video DEPOIMENTO produzido - videomaker",
      "18. (ESTUDIO) Retratos atualizados do paciente com sorriso novo",
      "19. Foto com o Doutor (O Brinde da Vitoria)",
    ],
  },
] as const;

const getCaseStageDefinition = (title: string) =>
  CASE_STAGE_DEFINITIONS.find(stage => stage.title === title);

const getCaseStageMoment = (title: string) =>
  getCaseStageDefinition(title)?.moment || "Planejamento";

const getCaseStageExpectedItems = (title: string) =>
  getCaseStageDefinition(title)?.expectedItems || [];

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

const normalizeCasePayload = (body: any) => ({
  patient_name: String(body.name || body.patient_name || "").trim(),
  age: body.age ? Number(body.age) : null,
  gender: body.gender ? String(body.gender).trim() : null,
  procedure: body.procedure ? String(body.procedure).trim() : null,
  procedure_description: body.procedureDescription || body.procedure_description ? String(body.procedureDescription || body.procedure_description).trim() : null,
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
      age: caseRow.age,
      gender: caseRow.gender,
      procedure: caseRow.procedure,
      procedureDescription: caseRow.procedure_description,
      notes: caseRow.notes,
      createdAt: caseRow.created_at,
      stages,
    };
  });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
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
      const { data: stages, error: stagesError } = caseIds.length
        ? await supabase.from("case_stages").select("*").in("case_id", caseIds)
        : { data: [], error: null };
      if (stagesError) throw stagesError;

      const { data: files, error: filesError } = caseIds.length
        ? await supabase.from("case_files").select("*").in("case_id", caseIds)
        : { data: [], error: null };
      if (filesError) throw filesError;

      return res.status(200).json({ cases: mapCaseRows(cases || [], stages || [], files || []) });
    }

    if (req.method === "POST") {
      const payload = normalizeCasePayload(req.body);
      if (!payload.patient_name) return res.status(400).json({ error: "Nome do paciente e obrigatorio." });

      let caseDriveFolderId: string | null = null;
      if (client.drive_folder_id && (process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 || process.env.GOOGLE_SERVICE_ACCOUNT_JSON)) {
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
          drive_folder_id: caseDriveFolderId,
          status: "em_andamento",
        }])
        .select()
        .single();
      if (caseError) throw caseError;

      const stageRows = CASE_STAGE_DEFINITIONS.map((stage, index) => ({
        case_id: createdCase.id,
        stage_key: stage.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
        stage_name: stage.title,
        sort_order: index + 1,
        status: "fazer",
      }));

      const { error: stagesError } = await supabase.from("case_stages").insert(stageRows);
      if (stagesError) throw stagesError;

      // --- Monday.com integration (non-blocking) ---
      let mondayResult: any = { success: false, skipped: true };
      const mondayToken = process.env.MONDAY_TOKEN;
      const mondayBoardId = process.env.MONDAY_BOARD_ID || client.monday_board_id || client.case_board_id || client.board_id;
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
            v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

          const findCol = (name: string) =>
            columns.find((c) => normalizeKey(c.title) === normalizeKey(name));

          const columnValues: Record<string, unknown> = {};

          const set = (colName: string, value: unknown) => {
            const col = findCol(colName);
            if (!col || value === undefined || value === null || String(value).trim() === "") return;
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
          if (payload.age) set("Idade", payload.age);
          if (payload.gender) set("Genero", payload.gender);
          if (payload.procedure) set("Procedimento", payload.procedure);
          if (payload.procedure_description) set("Descricao do procedimento", payload.procedure_description);
          if (payload.notes) set("Observacoes", payload.notes);
          set("Data", new Date().toISOString().slice(0, 10));

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

    return res.status(405).json({ error: "Metodo nao permitido." });
  } catch (error) {
    return res.status(500).json({
      error: "Falha na API de casos.",
      details: serializeApiError(error),
    });
  }
}
