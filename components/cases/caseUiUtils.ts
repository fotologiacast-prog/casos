import { CasePatient } from '../../types';
import { CASE_STAGE_TITLES } from '../../utils/caseConstants';

export const getCapturedCount = (patient: CasePatient) =>
  patient.stages.filter(stage => stage.status === 'Capturado' || stage.files.length > 0).length;

export const getTotalStageCount = (patient: CasePatient) =>
  patient.stages.length || CASE_STAGE_TITLES.length;

export const getPatientProgress = (patient: CasePatient) => {
  const captured = getCapturedCount(patient);
  const total = getTotalStageCount(patient);
  return {
    captured,
    total,
    percentage: total > 0 ? Math.round((captured / total) * 100) : 0,
  };
};

export const getPatientStatus = (patient: CasePatient) => {
  const { captured, total } = getPatientProgress(patient);
  if (captured >= total && total > 0) return 'Completo';
  if (captured > 0) return 'Em andamento';
  return 'Com pendencias';
};

export const formatDate = (date: Date | null) => {
  if (!date) return 'Sem data';
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const formatMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};
