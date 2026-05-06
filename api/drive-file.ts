import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDriveMediaResponse, getGoogleAccessToken } from "./_googleDrive";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Metodo nao permitido." });

  try {
    const fileId = String(req.query.fileId || "").trim();
    if (!fileId) return res.status(400).json({ error: "fileId ausente." });

    const accessToken = await getGoogleAccessToken();
    const driveResponse = await getDriveMediaResponse(accessToken, fileId);
    const contentType = driveResponse.headers.get("content-type") || "application/octet-stream";
    const contentLength = driveResponse.headers.get("content-length");
    const bytes = Buffer.from(await driveResponse.arrayBuffer());

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=300");
    if (contentLength) res.setHeader("Content-Length", contentLength);
    return res.status(200).send(bytes);
  } catch (error) {
    return res.status(500).json({
      error: "Falha ao carregar preview do Drive.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
