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

const isImageUrl = (name: string, url: string) =>
  /\.(png|jpe?g|jfif|webp|gif|bmp|avif|heic|heif)$/i.test(name) ||
  /\.(png|jpe?g|jfif|webp|gif|bmp|avif|heic|heif)(\?|$)/i.test(url);

const getDriveThumbnailUrl = (url: string) => {
  try {
    const parsed = new URL(url, window.location.origin);
    const fileId = parsed.pathname === '/api/drive-file' ? parsed.searchParams.get('fileId') : null;
    return fileId ? `/api/drive-file?fileId=${encodeURIComponent(fileId)}&thumbnail=1` : url;
  } catch {
    return url;
  }
};

/** Returns the thumbnail URL for a patient card:
 *  1st image from stage 11 (Entrega retratos), else 1st image from stage 3 (Planejamento extraorais).
 */
export const getCaseThumbnail = (patient: CasePatient): string | null => {
  const PRIORITY_STAGES = [
    '11. (ESTUDIO) Retratos do depois (posados)',
    '03. (ESTUDIO) Fotos EXTRAORAIS do antes (2 fotos)',
  ];

  for (const stageTitle of PRIORITY_STAGES) {
    const stage = patient.stages.find(s => s.title === stageTitle);
    if (!stage) continue;
    const imageFile = stage.files.find(f => isImageUrl(f.name, f.public_url));
    if (imageFile) return getDriveThumbnailUrl(imageFile.public_url);
  }

  // Broader fallback: any image from any Entrega or Planejamento stage
  for (const stage of patient.stages) {
    const file = stage.files.find(f => isImageUrl(f.name, f.public_url));
    if (file) return getDriveThumbnailUrl(file.public_url);
  }

  return null;
};
