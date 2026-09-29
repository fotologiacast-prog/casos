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

const EDITING_ELIGIBLE_MOMENTS = new Set(['Entrega', 'Evento', 'Agência', 'Agencia', 'Procedimento', 'Pós-operatório']);

const normalizeStatusText = (value?: string | null) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase();

const EDITED_REQUEST_STATUSES = new Set([
  'edited',
  'editado',
  'pronto',
  'concluido',
  'finalizado',
  'entregue',
  'pronto para enviar',
  'pronto p enviar',
  'pronto p enviar',
]);

const isEditedRequestStatus = (status?: string | null) =>
  EDITED_REQUEST_STATUSES.has(normalizeStatusText(status));

export interface ProductionSignals {
  capturedCount: number;
  totalStageCount: number;
  readyMaterialsCount: number;
  readyToEditStagesCount: number;
  pendingEditingRequestsCount: number;
  hasAnyMaterial: boolean;
}

export const getProductionSignals = (
  patient: CasePatient,
  readyTestimonialCount = 0,
): ProductionSignals => {
  const capturedCount = getCapturedCount(patient);
  const totalStageCount = getTotalStageCount(patient);
  const readyToEditStagesCount = patient.stages.filter(stage =>
    EDITING_ELIGIBLE_MOMENTS.has(String(stage.moment || '')) &&
    stage.files.length > 0 &&
    !stage.usageLock?.editingRequestId
  ).length;

  const requestsById = new Map((patient.editingRequests || []).map(request => [request.id, request]));
  const pendingRequestIds = new Set(
    (patient.editingRequests || [])
      .filter(request => !isEditedRequestStatus(request.status))
      .map(request => request.id)
  );

  patient.stages.forEach(stage => {
    const requestId = stage.usageLock?.editingRequestId;
    if (!requestId) return;
    const request = requestsById.get(requestId);
    if (!request || !isEditedRequestStatus(request.status)) pendingRequestIds.add(requestId);
  });

  return {
    capturedCount,
    totalStageCount,
    readyMaterialsCount: Math.max(0, readyTestimonialCount),
    readyToEditStagesCount,
    pendingEditingRequestsCount: pendingRequestIds.size,
    hasAnyMaterial: capturedCount > 0,
  };
};

export const getProductionStatus = (
  patient: CasePatient,
  readyTestimonialCount = 0,
): ProductionStatus => {
  const signals = getProductionSignals(patient, readyTestimonialCount);
  if (signals.pendingEditingRequestsCount > 0) return 'em_edicao';
  if (signals.readyToEditStagesCount > 0) return 'pronto_para_edicao';
  if (signals.readyMaterialsCount > 0) return 'material_pronto';
  if (!signals.hasAnyMaterial) return 'sem_material';

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
    const signals = getProductionSignals(patient, readyTestimonialCounts[patient.id] || 0);
    if (signals.readyToEditStagesCount > 0) summary.readyToSend++;
    if (signals.pendingEditingRequestsCount > 0) summary.inEditing++;
    summary.materialsReady += signals.readyMaterialsCount;

    if (
      signals.readyToEditStagesCount === 0 &&
      signals.pendingEditingRequestsCount === 0 &&
      signals.readyMaterialsCount === 0
    ) {
      summary.awaitingMaterial++;
    }
  }

  return summary;
};

export const getProductionBadges = (
  patient: CasePatient,
  readyTestimonialCount = 0,
) => {
  const signals = getProductionSignals(patient, readyTestimonialCount);
  const badges: Array<{ status: ProductionStatus; label: string; count?: number }> = [];

  if (signals.readyToEditStagesCount > 0) {
    badges.push({
      status: 'pronto_para_edicao',
      label: `${signals.readyToEditStagesCount} p/ edição`,
      count: signals.readyToEditStagesCount,
    });
  }

  if (signals.pendingEditingRequestsCount > 0) {
    badges.push({
      status: 'em_edicao',
      label: `${signals.pendingEditingRequestsCount} em edição`,
      count: signals.pendingEditingRequestsCount,
    });
  }

  if (signals.readyMaterialsCount > 0) {
    badges.push({
      status: 'material_pronto',
      label: `${signals.readyMaterialsCount} pronto${signals.readyMaterialsCount === 1 ? '' : 's'}`,
      count: signals.readyMaterialsCount,
    });
  }

  if (badges.length === 0) {
    const fallbackStatus: ProductionStatus = signals.hasAnyMaterial ? 'material_parcial' : 'sem_material';
    badges.push({
      status: fallbackStatus,
      label: productionStatusConfig[fallbackStatus].shortLabel,
    });
  }

  return badges;
};
