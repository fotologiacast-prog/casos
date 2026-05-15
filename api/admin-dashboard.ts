import type { VercelRequest, VercelResponse } from "@vercel/node";

const getSupabaseAdmin = async () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin env vars ausentes.");
  }

  const { createClient } = await import("@supabase/supabase-js");
  return createClient(supabaseUrl, serviceRoleKey);
};

const isAuthorized = (req: VercelRequest) => {
  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (!configuredPassword) return false;

  const headerPassword = req.headers["x-admin-password"];
  return headerPassword === configuredPassword;
};

const serializeApiError = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    return [record.code, record.message, record.details, record.hint].filter(Boolean).map(String).join(" ");
  }
  return String(error);
};

const increment = (map: Map<number, number>, key: number, amount = 1) => {
  map.set(key, (map.get(key) || 0) + amount);
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Password");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Metodo nao permitido." });
  if (!isAuthorized(req)) return res.status(401).json({ error: "Senha admin invalida." });

  try {
    const supabase = await getSupabaseAdmin();

    const [clientsResult, casesResult, editingResult] = await Promise.all([
      supabase.from("clients").select("id, name, active").order("name"),
      supabase.from("cases").select("id, client_id"),
      supabase.from("case_editing_requests").select("id, client_id, status"),
    ]);

    if (clientsResult.error) throw clientsResult.error;
    if (casesResult.error) throw casesResult.error;
    if (editingResult.error) throw editingResult.error;

    const clients = clientsResult.data || [];
    const cases = casesResult.data || [];
    const editingRequests = editingResult.data || [];

    const patientsByClient = new Map<number, number>();
    const editingSentByClient = new Map<number, number>();
    const editingPendingByClient = new Map<number, number>();
    const editedReadyByClient = new Map<number, number>();

    cases.forEach((caseRow: any) => increment(patientsByClient, Number(caseRow.client_id)));

    editingRequests.forEach((request: any) => {
      const clientId = Number(request.client_id);
      const status = String(request.status || "").trim().toLowerCase();
      increment(editingSentByClient, clientId);
      if (status === "edited") {
        increment(editedReadyByClient, clientId);
      } else {
        increment(editingPendingByClient, clientId);
      }
    });

    const dashboardClients = clients.map((client: any) => {
      const id = Number(client.id);
      return {
        id,
        name: client.name,
        active: client.active !== false,
        patientsCount: patientsByClient.get(id) || 0,
        editingSentCount: editingSentByClient.get(id) || 0,
        editingPendingCount: editingPendingByClient.get(id) || 0,
        editedReadyCount: editedReadyByClient.get(id) || 0,
      };
    });

    return res.status(200).json({
      dashboard: {
        totals: {
          clients: clients.length,
          activeClients: clients.filter((client: any) => client.active !== false).length,
          patients: cases.length,
          editingSent: editingRequests.length,
          editingPending: editingRequests.filter((request: any) => String(request.status || "").trim().toLowerCase() !== "edited").length,
          editedReady: editingRequests.filter((request: any) => String(request.status || "").trim().toLowerCase() === "edited").length,
        },
        clients: dashboardClients,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: "Falha na API do dashboard.",
      details: serializeApiError(error),
    });
  }
}
