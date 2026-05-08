import type { VercelRequest, VercelResponse } from "@vercel/node";

const getSupabaseAdmin = async () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase admin env vars ausentes.");
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(supabaseUrl, serviceRoleKey);
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "DELETE") return res.status(405).json({ error: "Método não permitido." });

  try {
    const { driveFileId, caseFileId, stageId } = req.body || {};

    if (!caseFileId) return res.status(400).json({ error: "caseFileId é obrigatório." });

    const supabase = await getSupabaseAdmin();

    let actualDriveFileId = driveFileId;
    if (!actualDriveFileId) {
      const { data: fileData } = await supabase
        .from("case_files")
        .select("drive_file_id")
        .eq("id", caseFileId)
        .single();
      if (fileData?.drive_file_id) {
        actualDriveFileId = fileData.drive_file_id;
      }
    }

    // 1. Delete from Google Drive (best-effort, non-blocking)
    if (actualDriveFileId) {
      try {
        const { getGoogleAccessToken } = await import("./_googleDrive.js");
        const accessToken = await getGoogleAccessToken();
        const driveRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(actualDriveFileId)}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        if (!driveRes.ok && driveRes.status !== 204 && driveRes.status !== 404) {
          const text = await driveRes.text();
          console.warn("[drive-delete] Drive returned non-ok:", driveRes.status, text);
        }
      } catch (driveErr) {
        console.warn("[drive-delete] Falha ao deletar do Drive (ignorando):", driveErr);
      }
    }

    // 2. Delete from Supabase case_files table
    const { error: dbError } = await supabase
      .from("case_files")
      .delete()
      .eq("id", caseFileId);

    if (dbError) throw dbError;

    // 3. Check if the stage still has files; if not, revert status to 'Fazer'
    if (stageId) {
      const { data: remaining } = await supabase
        .from("case_files")
        .select("id")
        .eq("stage_id", stageId)
        .limit(1);

      if (!remaining || remaining.length === 0) {
        await supabase
          .from("case_stages")
          .update({ status: "Fazer" })
          .eq("id", stageId);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({
      error: "Falha ao excluir arquivo.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
