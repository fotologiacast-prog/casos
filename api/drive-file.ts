import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Range");
  res.setHeader("Access-Control-Expose-Headers", "Accept-Ranges, Content-Length, Content-Range, Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET" && req.method !== "HEAD") return res.status(405).json({ error: "Metodo nao permitido." });

  try {
    const fileId = String(req.query.fileId || "").trim();
    if (!fileId) return res.status(400).json({ error: "fileId ausente." });

    const { getDriveFile, getDriveMediaResponse, getGoogleAccessToken } = await import("./_googleDrive.js");
    const accessToken = await getGoogleAccessToken();

    if (req.query.thumbnail === "1") {
      const metadata = await getDriveFile(accessToken, fileId);
      if (!metadata.thumbnailLink) return res.status(404).end();

      if (req.query.proxy !== "1") {
        res.setHeader("Cache-Control", "private, max-age=300");
        res.setHeader("Location", metadata.thumbnailLink);
        return res.status(302).end();
      }

      const thumbnailResponse = await fetch(metadata.thumbnailLink, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!thumbnailResponse.ok) return res.status(thumbnailResponse.status).end();

      res.setHeader("Content-Type", thumbnailResponse.headers.get("content-type") || "image/jpeg");
      res.setHeader("Cache-Control", "private, max-age=1800");
      if (thumbnailResponse.headers.has("content-length")) {
        res.setHeader("Content-Length", thumbnailResponse.headers.get("content-length")!);
      }
      if (req.method === "HEAD") return res.status(200).end();
      if (!thumbnailResponse.body) return res.end();

      const reader = thumbnailResponse.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      return res.end();
    }

    const driveResponse = await getDriveMediaResponse(accessToken, fileId, req.headers.range);

    const contentType = driveResponse.headers.get("content-type") || "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("Accept-Ranges", driveResponse.headers.get("accept-ranges") || "bytes");

    if (driveResponse.headers.has("content-range")) {
      res.setHeader("Content-Range", driveResponse.headers.get("content-range")!);
    }
    if (driveResponse.headers.has("content-length")) {
      res.setHeader("Content-Length", driveResponse.headers.get("content-length")!);
    }

    res.status(driveResponse.status);
    if (req.method === "HEAD") return res.end();

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
