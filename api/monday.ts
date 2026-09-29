import type { VercelRequest, VercelResponse } from "@vercel/node";

export const config = {
  api: {
    bodyParser: false,
  },
};

const isAuthorized = (req: VercelRequest) => {
  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (!configuredPassword) return false;
  return req.headers["x-admin-password"] === configuredPassword;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, API-Version, X-Admin-Password');

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Apenas método POST é permitido." });

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Senha admin invalida." });
  }

  const MONDAY_TOKEN = process.env.MONDAY_TOKEN;
  if (!MONDAY_TOKEN) return res.status(500).json({ error: "MONDAY_TOKEN não definido." });

  const contentType = req.headers["content-type"] || "";
  
  // 1. UPLOAD CASE (multipart/form-data)
  if (contentType.includes("multipart/form-data")) {
    try {
      const response = await fetch("https://api.monday.com/v2/file", {
        method: "POST",
        headers: {
          Authorization: MONDAY_TOKEN.trim(),
          "API-Version": "2024-10",
          "Content-Type": contentType,
        },
        body: req as any,
        duplex: "half" as any,
      } as RequestInit);

      const responseText = await response.text();
      try {
        const data = JSON.parse(responseText);
        return res.status(response.status).json(data);
      } catch {
        return res.status(response.status).send(responseText);
      }
    } catch (error) {
      return res.status(500).json({ error: "Falha no upload para Monday.", details: String(error) });
    }
  }

  // 2. QUERY / PLAYGROUND (application/json)
  try {
    const chunks: any[] = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const bodyStr = Buffer.concat(chunks).toString();
    const body = bodyStr ? JSON.parse(bodyStr) : {};

    const response = await fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: {
        Authorization: MONDAY_TOKEN.trim(),
        "Content-Type": "application/json",
        "API-Version": "2024-10",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: "Falha ao consultar Monday.", details: String(error) });
  }
}
