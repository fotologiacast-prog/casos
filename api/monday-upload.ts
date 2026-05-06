import type { VercelRequest, VercelResponse } from "@vercel/node";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Apenas método POST é permitido." });
  }

  const MONDAY_TOKEN = process.env.MONDAY_TOKEN;
  if (!MONDAY_TOKEN) {
    return res.status(500).json({ error: "Configuração ausente: MONDAY_TOKEN não definido." });
  }

  const contentType = req.headers["content-type"];
  if (!contentType || !contentType.includes("multipart/form-data")) {
    return res.status(400).json({ error: "Upload deve usar multipart/form-data." });
  }

  try {
    const mondayResponse = await fetch("https://api.monday.com/v2/file", {
      method: "POST",
      headers: {
        Authorization: MONDAY_TOKEN.trim(),
        "API-Version": "2024-10",
        "Content-Type": contentType,
      },
      body: req as any,
      duplex: "half" as any,
    } as RequestInit);

    const responseText = await mondayResponse.text();

    try {
      const data = JSON.parse(responseText);
      return res.status(mondayResponse.status).json(data);
    } catch (e) {
      return res.status(mondayResponse.status).send(responseText);
    }
  } catch (error) {
    return res.status(500).json({
      error: "Falha ao encaminhar upload para o Monday.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
