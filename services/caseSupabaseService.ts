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
  
  return data.caseId;
};

export const updateSupabaseCasePatient = async (token: string, caseId: string, payload: NewCasePatientPayload): Promise<void> => {
  const response = await fetch('/api/cases', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, caseId, ...payload }),
  });
  await readApiResponse(response, 'Falha ao atualizar caso.');
};

export const deleteSupabaseCasePatient = async (token: string, caseId: string): Promise<void> => {
  const response = await fetch('/api/cases', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, caseId }),
  });
  await readApiResponse(response, 'Falha ao limpar caso.');
};

export const requestCaseStageEditing = async (token: string, caseId: string, stageId: string, notes?: string): Promise<any> => {
  const response = await fetch('/api/cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'request_editing', token, caseId, stageId, notes }),
  });
  const data = await readApiResponse(response, 'Falha ao mandar para edição.');
  const failedColumns = Array.isArray(data?.columnUpdate?.failed) ? data.columnUpdate.failed : [];
  if (failedColumns.length > 0) {
    const fields = failedColumns
      .map((item: any) => `${item.title || item.role || item.id}: ${item.error || 'erro desconhecido'}`)
      .join(' | ');
    throw new Error(`Tarefa criada no Monday, mas falhou ao preencher campos. requestId=${data.requestId || 'sem-id'} ${fields}`);
  }
  return data;
};
