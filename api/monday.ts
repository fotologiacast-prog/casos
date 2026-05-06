import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Configuração básica de CORS para o backend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, API-Version');

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Apenas método POST é permitido." });
  }

  const MONDAY_TOKEN = process.env.MONDAY_TOKEN;
  if (!MONDAY_TOKEN) {
    console.error("[MONDAY PROXY] Erro: Variável MONDAY_TOKEN não encontrada no ambiente.");
    return res.status(500).json({ error: "Configuração ausente: MONDAY_TOKEN não definido na Vercel." });
  }

  try {
    console.log("[MONDAY PROXY] Enviando query para Monday.com...");
    const response = await fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: {
        "Authorization": MONDAY_TOKEN.trim(),
        "Content-Type": "application/json",
        "API-Version": "2024-10",
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    console.log(`[MONDAY PROXY] Monday respondeu com Status: ${response.status}`);

    if (data.errors) {
      console.error("[MONDAY PROXY] Erros retornados pelo Monday:", JSON.stringify(data.errors));
    }

    return res.status(response.status).json(data);
  } catch (error) {
    console.error("[MONDAY PROXY] ERRO CRÍTICO:", error);
    return res.status(500).json({ 
      error: "Falha interna no Proxy do Backend", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
}
