import { CasePatient } from '../../types';
import { CASE_STAGE_TITLES } from '../../utils/caseConstants';

export type CaseThumbnail = {
  src: string;
};

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

type StageFile = CasePatient['stages'][number]['files'][number];

const isImageFile = (file: StageFile) => {
  if (file.type?.startsWith('image/')) return true;
  return isImageUrl(file.name, file.public_url);
};

const getThumbnailCandidate = (url: string): CaseThumbnail => {
  try {
    const parsed = new URL(url, window.location.origin);
    const fileId = getDriveFileId(parsed);
    return fileId ? { src: getGoogleDriveThumbnailUrl(fileId) } : { src: url };
  } catch {
    return { src: url };
  }
};

const getDriveFileId = (url: URL) => {
  if (url.hostname === 'drive.google.com') {
    const pathMatch = url.pathname.match(/\/file\/d\/([^/]+)/);
    return url.searchParams.get('id') || pathMatch?.[1] || null;
  }
  return null;
};

const getGoogleDriveThumbnailUrl = (fileId: string) =>
  `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w800`;

const THUMBNAIL_PRIORITY_STAGES = [
  '18. (ESTUDIO) Retratos atualizados do paciente com sorriso novo',
  '11. (ESTUDIO) Retratos do depois (posados)',
  '19. Foto com o Doutor (O Brinde da Vitoria)',
  '13. (ESTUDIO) Fotos em close artisticas do sorriso',
  '12. (ESTUDIO) - Fotos em close do sorriso',
  '09. (NA CADEIRA) - Fotos intraorais do depois (4 fotos)',
  '03. (ESTUDIO) Fotos EXTRAORAIS do antes (2 fotos)',
  '01. (CADEIRA) Fotos intraorais do antes (4 fotos)',
];

const isTechnicalStageForThumbnail = (title: string) =>
  /(tomografia|rx|3d|computador|procedimento|detalhes|proteses|pr[oó]teses|laborat[oó]rio|escaneamento)/i.test(title);

const pickStageImage = (stage: CasePatient['stages'][number]) =>
  stage.files.find(isImageFile);

/** Returns the thumbnail URL for a patient card:
 * Prefer patient/smile photos and avoid technical images such as RX, tomography and 3D files.
 */
export const getCaseThumbnail = (patient: CasePatient): CaseThumbnail | null => {
  for (const stageTitle of THUMBNAIL_PRIORITY_STAGES) {
    const stage = patient.stages.find(s => s.title === stageTitle);
    if (!stage) continue;
    const imageFile = pickStageImage(stage);
    if (imageFile) return getThumbnailCandidate(imageFile.public_url);
  }

  for (const stage of patient.stages.filter(stage => !isTechnicalStageForThumbnail(stage.title))) {
    const file = pickStageImage(stage);
    if (file) return getThumbnailCandidate(file.public_url);
  }

  for (const stage of patient.stages) {
    const file = pickStageImage(stage);
    if (file) return getThumbnailCandidate(file.public_url);
  }

  return null;
};
