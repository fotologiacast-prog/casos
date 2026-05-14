import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Metodo nao permitido." });

  try {
    const { uploadUrl, fileBase64, mimeType } = req.body;
    if (!uploadUrl || !fileBase64) {
      return res.status(400).json({ error: "uploadUrl e fileBase64 sao obrigatorios." });
    }

    console.log("[Debug Proxy] Iniciando PUT para Google Drive via Backend...");
    
    // Decode base64 to Buffer
    const buffer = Buffer.from(fileBase64, "base64");

    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": mimeType || "application/octet-stream",
        "Content-Length": String(buffer.length),
      },
      body: buffer,
    });

    const text = await response.text();
    console.log(`[Debug Proxy] Google respondeu com status ${response.status}`);

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Google Drive recusou o upload via backend.",
        status: response.status,
        details: text,
      });
    }

    // Try to parse JSON if any
    try {
      const data = JSON.parse(text);
      return res.status(200).json(data);
    } catch {
      return res.status(200).send(text);
    }
  } catch (error) {
    console.error("[Debug Proxy] Erro catastrofico:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
