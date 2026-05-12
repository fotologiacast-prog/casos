import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Metodo nao permitido." });

  try {
    const fileId = String(req.query.fileId || "").trim();
    if (!fileId) return res.status(400).json({ error: "fileId ausente." });

    const { getDriveMediaResponse, getGoogleAccessToken } = await import("./_googleDrive.js");
    const accessToken = await getGoogleAccessToken();
    const driveResponse = await getDriveMediaResponse(accessToken, fileId, req.headers.range);

    const contentType = driveResponse.headers.get("content-type") || "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=3600");

    if (driveResponse.headers.has("content-range")) {
      res.setHeader("Content-Range", driveResponse.headers.get("content-range")!);
    }
    if (driveResponse.headers.has("accept-ranges")) {
      res.setHeader("Accept-Ranges", driveResponse.headers.get("accept-ranges")!);
    }
    if (driveResponse.headers.has("content-length")) {
      res.setHeader("Content-Length", driveResponse.headers.get("content-length")!);
    }

    res.status(driveResponse.status);

    if (!driveResponse.body) return res.end();

    const reader = driveResponse.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    return res.end();
  } catch (error) {
    console.error("[Drive Proxy Error]", error);
    return res.status(500).json({
      error: "Falha ao carregar arquivo do Drive.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
