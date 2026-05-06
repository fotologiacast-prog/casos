import { CasePatient } from '../types';
import { NewCasePatientPayload } from '../components/cases/NewCasePatientForm';

const mapCasePatient = (item: any): CasePatient => ({
  ...item,
  createdAt: item.createdAt ? new Date(item.createdAt) : null,
});

const readApiResponse = async (response: Response, fallbackMessage: string) => {
  const responseText = await response.text();
  let data: any = {};
  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    const details = typeof data.details === 'string' ? data.details : '';
    const message = details && data.error
      ? `${data.error} ${details}`
      : details || data.error;
    const fallback = responseText
      ? responseText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 220)
      : '';
    throw new Error(message || fallback || `${fallbackMessage} HTTP ${response.status}`);
  }

  return data;
};

export const fetchSupabaseCasePatients = async (token: string): Promise<CasePatient[]> => {
  const response = await fetch(`/api/cases?token=${encodeURIComponent(token)}`);
  const data = await readApiResponse(response, 'Falha ao buscar casos.');
  return (data.cases || []).map(mapCasePatient);
};

export const createSupabaseCasePatient = async (token: string, payload: NewCasePatientPayload): Promise<string> => {
  const response = await fetch('/api/cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, ...payload }),
  });
  const data = await readApiResponse(response, 'Falha ao criar caso.');
  
  if (data.monday && data.monday.error) {
    alert("Atenção: O paciente foi criado no Supabase, mas falhou ao enviar para o Monday.\nErro detalhado:\n" + JSON.stringify(data.monday.error, null, 2));
  } else if (data.monday && data.monday.skipped) {
    alert("Aviso: O envio para o Monday foi ignorado. Verifique se o MONDAY_BOARD_ID e MONDAY_TOKEN estão preenchidos na Vercel.");
  }
  
  return data.caseId;
};
