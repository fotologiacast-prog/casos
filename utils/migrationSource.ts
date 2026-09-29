import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHash, timingSafeEqual } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

// Temporary, read-only bridge for the Eleve migration. Remove after cutover.
// The secret itself is not stored in this repository.
const KEY_SHA256 = "cf360efaa688837b80f77ebe75c5b38c6bcafb9ef63db7d511805d6f0e88c87a";
const CLIENT_ID = 1;
const CLIENT_NAME = "Eleve Farroupilha";
const MAX_RANGE_BYTES = 4_000_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function authorized(value: string | string[] | undefined) {
  if (typeof value !== "string") return false;
  const actual = createHash("sha256").update(value).digest();
  const expected = Buffer.from(KEY_SHA256, "hex");
  return timingSafeEqual(actual, expected);
}

export async function migrationSourceHandler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET" && req.method !== "HEAD")
    return res.status(405).json({ error: "Method not allowed" });
  if (!authorized(req.headers["x-impact-migration-key"]))
    return res.status(401).json({ error: "Unauthorized" });

  const id = typeof req.headers["x-impact-file-id"] === "string" ? req.headers["x-impact-file-id"] : "";
  if (!UUID.test(id)) return res.status(400).json({ error: "Invalid file ID", received_length: id.length, route_version: 4 });

  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) throw new Error("Supabase configuration missing");
    const { createClient } = await import("@supabase/supabase-js");
    const db = createClient(supabaseUrl, serviceKey);
    const { data: client, error: clientError } = await db
      .from("clients")
      .select("id,name,active")
      .eq("id", CLIENT_ID)
      .maybeSingle();
    if (clientError) throw clientError;
    if (!client || client.name !== CLIENT_NAME || !client.active)
      return res.status(403).json({ error: "Migration source unavailable" });

    const { data: file, error: fileError } = await db
      .from("case_files")
      .select("id,client_id,drive_file_id,size_bytes,mime_type")
      .eq("id", id)
      .eq("client_id", CLIENT_ID)
      .maybeSingle();
    if (fileError) throw fileError;
    if (!file?.drive_file_id || !Number.isSafeInteger(Number(file.size_bytes)) || Number(file.size_bytes) <= 0)
      return res.status(404).json({ error: "File unavailable" });

    const { getGoogleAccessToken, getDriveFile, getDriveMediaResponse } =
      await import("../api/_googleDrive.js");
    const token = await getGoogleAccessToken({ preferOAuth: true });
    const size = Number(file.size_bytes);
    if (req.method === "HEAD") {
      const remote = await getDriveFile(token, file.drive_file_id);
      if (Number(remote.size) !== size)
        return res.status(409).json({ error: "Source size mismatch" });
      res.setHeader("Content-Length", String(size));
      res.setHeader("Content-Type", file.mime_type || "application/octet-stream");
      return res.status(200).end();
    }

    const range = req.headers.range;
    const match = typeof range === "string" && /^bytes=(\d+)-(\d+)$/.exec(range);
    if (!match) return res.status(416).json({ error: "A bounded byte range is required" });
    const start = Number(match[1]);
    const end = Number(match[2]);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
        start < 0 || end < start || end >= size || end - start + 1 > MAX_RANGE_BYTES)
      return res.status(416).json({ error: "Invalid byte range" });

    const remote = await getDriveMediaResponse(token, file.drive_file_id, `bytes=${start}-${end}`);
    const expectedRange = `bytes ${start}-${end}/${size}`;
    if (remote.status !== 206 || remote.headers.get("content-range") !== expectedRange ||
        Number(remote.headers.get("content-length")) !== end - start + 1 || !remote.body)
      return res.status(502).json({ error: "Unexpected source response" });

    res.status(206);
    res.setHeader("Content-Type", file.mime_type || "application/octet-stream");
    res.setHeader("Content-Range", expectedRange);
    res.setHeader("Content-Length", String(end - start + 1));
    res.setHeader("Accept-Ranges", "bytes");
    await pipeline(Readable.fromWeb(remote.body as any), res);
  } catch (error) {
    console.error("[migration-source] Failed:", error);
    if (!res.headersSent) res.status(502).json({ error: "Migration source unavailable" });
    else res.destroy();
  }
}
