import type { VercelRequest, VercelResponse } from "@vercel/node";

const getSupabaseAdmin = async () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase admin env vars ausentes.");
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(supabaseUrl, serviceRoleKey);
};

const getStageContext = async (supabase: any, stageId: string) => {
  const { data, error } = await supabase
    .from("case_stages")
    .select("*, cases(*, clients(*))")
    .eq("id", stageId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Etapa nao encontrada.");
  return data;
};

const ensureStageFolder = async (input: {
  accessToken: string;
  supabase: any;
  stage: any;
}) => {
  if (input.stage.drive_folder_id) return input.stage.drive_folder_id as string;

  const caseFolderId = input.stage.cases?.drive_folder_id;
  if (!caseFolderId) throw new Error("Pasta do paciente no Drive nao encontrada.");

  const currentStageName = String(input.stage.stage_name || "").trim();
  const stageName = /^\d{2}\./.test(currentStageName)
    ? currentStageName
    : `${String(input.stage.sort_order).padStart(2, "0")} ${currentStageName}`;
  const { findOrCreateDriveFolder, sanitizeDriveFolderName } = await import("./_googleDrive.js");
  const folder = await findOrCreateDriveFolder(input.accessToken, caseFolderId, sanitizeDriveFolderName(stageName));

  const { error } = await input.supabase
    .from("case_stages")
    .update({ drive_folder_id: folder.id })
    .eq("id", input.stage.id);
  if (error) throw error;

  return folder.id;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Metodo nao permitido." });

  try {
    const action = String(req.body?.action || "").trim();
    const stageId = String(req.body?.stageId || "").trim();
    if (!stageId) return res.status(400).json({ error: "stageId ausente." });

    const supabase = await getSupabaseAdmin();
    const {
      getDriveFile,
      getGoogleAccessToken,
      startDriveResumableUpload,
    } = await import("./_googleDrive.js");
    const accessToken = await getGoogleAccessToken({ preferOAuth: true });
    const stage = await getStageContext(supabase, stageId);

    if (action === "start") {
      const fileName = String(req.body?.fileName || "").trim();
      const mimeType = String(req.body?.mimeType || "application/octet-stream").trim();
      const sizeBytes = req.body?.sizeBytes ? Number(req.body.sizeBytes) : undefined;
      if (!fileName) return res.status(400).json({ error: "Nome do arquivo ausente." });

      const folderId = await ensureStageFolder({ accessToken, supabase, stage });
      const origin = req.headers.origin || req.headers.host ? `https://${req.headers.host}` : "*";
      const uploadUrl = await startDriveResumableUpload({
        accessToken,
        folderId,
        fileName,
        mimeType,
        sizeBytes,
        origin,
      });

      return res.status(200).json({ uploadUrl, folderId });
    }

    if (action === "complete") {
      const driveFileId = String(req.body?.driveFileId || "").trim();
      if (!driveFileId) return res.status(400).json({ error: "driveFileId ausente." });

      const { ensureDriveFilePublic, getDirectDriveFileUrl } = await import("./_googleDrive.js");
      await ensureDriveFilePublic(accessToken, driveFileId);
      const driveFile = await getDriveFile(accessToken, driveFileId);
      const directFileUrl = getDirectDriveFileUrl(driveFile.id);
      const filePayload = {
        client_id: stage.cases.client_id,
        case_id: stage.case_id,
        stage_id: stage.id,
        drive_file_id: driveFile.id,
        file_name: driveFile.name,
        mime_type: driveFile.mimeType,
        size_bytes: driveFile.size ? Number(driveFile.size) : null,
        web_view_link: driveFile.webViewLink,
        web_content_link: directFileUrl,
      };

      const { data: insertedFile, error: fileError } = await supabase
        .from("case_files")
        .upsert([filePayload], { onConflict: "drive_file_id" })
        .select()
        .single();
      if (fileError) throw fileError;

      const { error: stageError } = await supabase
        .from("case_stages")
        .update({ status: "capturado" })
        .eq("id", stage.id);
      if (stageError) throw stageError;

      return res.status(200).json({ file: insertedFile });
    }

    return res.status(400).json({ error: "Acao invalida." });
  } catch (error) {
    return res.status(500).json({
      error: "Falha no upload para Drive.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
