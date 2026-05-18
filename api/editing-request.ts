import type { VercelRequest, VercelResponse } from "@vercel/node";

const serializeApiError = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    return [record.code, record.message, record.details, record.hint].filter(Boolean).map(String).join(" ");
  }
  return String(error);
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Metodo nao permitido.",
      details: `Endpoint /api/editing-request aceita apenas POST. Recebido: ${req.method || "desconhecido"}.`,
    });
  }

  try {
    const { requestStageEditing } = await import("./_editingRequestCore.js");
    const result = await requestStageEditing(req.body);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return res.status(500).json({
      error: "Falha ao mandar para edição.",
      details: serializeApiError(error),
    });
  }
}
