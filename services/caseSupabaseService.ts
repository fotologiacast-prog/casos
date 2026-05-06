import { CasePatient } from '../types';
import { NewCasePatientPayload } from '../components/cases/NewCasePatientForm';

const mapCasePatient = (item: any): CasePatient => ({
  ...item,
  createdAt: item.createdAt ? new Date(item.createdAt) : null,
});

export const fetchSupabaseCasePatients = async (token: string): Promise<CasePatient[]> => {
  const response = await fetch(`/api/cases?token=${encodeURIComponent(token)}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.details || 'Falha ao buscar casos.');
  return (data.cases || []).map(mapCasePatient);
};

export const createSupabaseCasePatient = async (token: string, payload: NewCasePatientPayload): Promise<string> => {
  const response = await fetch('/api/cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, ...payload }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.details || 'Falha ao criar caso.');
  return data.caseId;
};
