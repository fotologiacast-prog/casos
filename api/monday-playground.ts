import type { VercelRequest, VercelResponse } from "@vercel/node";

const isAuthorized = (req: VercelRequest) => {
  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (!configuredPassword) return false;
  return req.headers["x-admin-password"] === configuredPassword;
};

const serializeError = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    try {
      return JSON.stringify(error);
    } catch {
      return "Erro desconhecido.";
    }
  }
  return String(error);
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Password");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Metodo nao permitido." });

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Senha admin invalida." });
  }

  const mondayToken = process.env.MONDAY_TOKEN;
  if (!mondayToken) {
    return res.status(500).json({ error: "MONDAY_TOKEN ausente." });
  }

  const query = String(req.body?.query || "").trim();
  const variables = req.body?.variables && typeof req.body.variables === "object" ? req.body.variables : {};

  if (!query) return res.status(400).json({ error: "Query GraphQL ausente." });
  if (query.length > 12000) return res.status(400).json({ error: "Query muito grande." });

  try {
    const response = await fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: {
        Authorization: mondayToken.trim(),
        "Content-Type": "application/json",
        "API-Version": "2024-10",
      },
      body: JSON.stringify({ query, variables }),
    });

    const data = await response.json().catch(() => ({}));
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({
      error: "Falha ao consultar Monday.",
      details: serializeError(error),
    });
  }
}
