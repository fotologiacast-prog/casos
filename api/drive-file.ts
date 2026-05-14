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
    const metadata = await getDriveFile(accessToken, fileId);

    const streamResponse = async (sourceResponse: Response, contentTypeFallback?: string | null) => {
      const sourceContentType = sourceResponse.headers.get("content-type");
      const contentType = !sourceContentType || sourceContentType === "application/octet-stream"
        ? contentTypeFallback || "application/octet-stream"
        : sourceContentType;
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "private, max-age=1800");
      res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(metadata.name || "arquivo")}`);
      res.setHeader("Accept-Ranges", sourceResponse.headers.get("accept-ranges") || "bytes");

      if (sourceResponse.headers.has("content-range")) {
        res.setHeader("Content-Range", sourceResponse.headers.get("content-range")!);
      }
      if (sourceResponse.headers.has("content-length")) {
        res.setHeader("Content-Length", sourceResponse.headers.get("content-length")!);
      }

      res.status(sourceResponse.status);
      if (req.method === "HEAD") return res.end();
      if (!sourceResponse.body) return res.end();

      const reader = sourceResponse.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      return res.end();
    };

    if (req.query.thumbnail === "1") {
      if (!metadata.thumbnailLink) {
        if (String(metadata.mimeType || "").startsWith("image/")) {
          const imageResponse = await getDriveMediaResponse(accessToken, fileId, req.headers.range);
          return streamResponse(imageResponse, metadata.mimeType);
        }
        return res.status(404).end();
      }

      let thumbnailResponse = await fetch(metadata.thumbnailLink);
      if (!thumbnailResponse.ok) {
        thumbnailResponse = await fetch(metadata.thumbnailLink, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      }
      if (!thumbnailResponse.ok) return res.status(thumbnailResponse.status).end();

      return streamResponse(thumbnailResponse, "image/jpeg");
    }

    const driveResponse = await getDriveMediaResponse(accessToken, fileId, req.headers.range);
    res.setHeader("Cache-Control", "private, max-age=3600");
    return streamResponse(driveResponse, metadata.mimeType);
  } catch (error) {
    console.error("[Drive Proxy Error]", error);
    return res.status(500).json({
      error: "Falha ao carregar arquivo do Drive.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
