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
  'Retratos do Depois',
  'Retrato Extraoral do Antes',
  '11. (ESTUDIO) Retratos do depois (posados)',
  '03. (ESTUDIO) Fotos EXTRAORAIS do antes (2 fotos)',
  'Retratos Atualizados Lifestyle',
  '19. Foto com o Doutor (O Brinde da Vitoria)',
  '13. (ESTUDIO) Fotos em close artisticas do sorriso',
  '12. (ESTUDIO) - Fotos em close do sorriso',
  '09. (NA CADEIRA) - Fotos intraorais do depois (4 fotos)',
  '18. (ESTUDIO) Retratos atualizados do paciente com sorriso novo',
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

// --- Production Status ---

export type ProductionStatus =
  | 'sem_material'
  | 'material_parcial'
  | 'pronto_para_edicao'
  | 'enviado_para_edicao'
  | 'em_edicao'
  | 'material_pronto';

const EDITING_ELIGIBLE_MOMENTS = new Set(['Entrega', 'Evento', 'Agência', 'Agencia']);

export const getProductionStatus = (
  patient: CasePatient,
  readyTestimonialCount = 0,
): ProductionStatus => {
  // Material pronto (edited content available)
  if (readyTestimonialCount > 0) return 'material_pronto';

  // Check for usage locks (editing requests)
  const hasUsageLock = patient.stages.some(s => s.usageLock?.editingRequestId);
  if (hasUsageLock) return 'em_edicao';

  // Check editing-eligible stages for files
  const editableStages = patient.stages.filter(
    s => EDITING_ELIGIBLE_MOMENTS.has(String(s.moment || '')),
  );
  const editableWithFiles = editableStages.filter(s => s.files.length > 0);

  if (editableWithFiles.length > 0) return 'pronto_para_edicao';

  // Check material progress
  const captured = getCapturedCount(patient);
  if (captured === 0) return 'sem_material';

  return 'material_parcial';
};

export const productionStatusConfig: Record<
  ProductionStatus,
  { label: string; shortLabel: string; className: string; iconColor: string }
> = {
  sem_material: {
    label: 'Sem material enviado',
    shortLabel: 'Sem material',
    className: 'bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200',
    iconColor: '#71717a',
  },
  material_parcial: {
    label: 'Material parcial',
    shortLabel: 'Parcial',
    className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    iconColor: '#d97706',
  },
  pronto_para_edicao: {
    label: 'Pronto para edição',
    shortLabel: 'Pronto p/ edição',
    className: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
    iconColor: '#0284c7',
  },
  enviado_para_edicao: {
    label: 'Enviado para edição',
    shortLabel: 'Enviado',
    className: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
    iconColor: '#7c3aed',
  },
  em_edicao: {
    label: 'Em edição pela agência',
    shortLabel: 'Em edição',
    className: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
    iconColor: '#e11d48',
  },
  material_pronto: {
    label: 'Material pronto disponível',
    shortLabel: 'Material pronto',
    className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    iconColor: '#059669',
  },
};

export interface ProductionSummary {
  awaitingMaterial: number;
  readyToSend: number;
  inEditing: number;
  materialsReady: number;
}

export const getProductionSummary = (
  patients: CasePatient[],
  readyTestimonialCounts: Record<string, number> = {},
): ProductionSummary => {
  const summary: ProductionSummary = {
    awaitingMaterial: 0,
    readyToSend: 0,
    inEditing: 0,
    materialsReady: 0,
  };

  for (const patient of patients) {
    const status = getProductionStatus(patient, readyTestimonialCounts[patient.id] || 0);
    switch (status) {
      case 'sem_material':
      case 'material_parcial':
        summary.awaitingMaterial++;
        break;
      case 'pronto_para_edicao':
        summary.readyToSend++;
        break;
      case 'enviado_para_edicao':
      case 'em_edicao':
        summary.inEditing++;
        break;
      case 'material_pronto':
        summary.materialsReady++;
        break;
    }
  }

  return summary;
};
