import React from 'react';
import { CasePatient, CaseStage } from '../../types';
import { CASE_STAGE_DEFINITIONS, CASE_STAGE_MOMENTS, getCanonicalCaseStageTitle } from '../../utils/caseConstants';
import { uploadStageFilesToDrive, UploadProgressInfo } from '../../services/driveUploadService';
import { formatDate, getPatientProgress } from './caseUiUtils';
import CaseStageCard from './CaseStageCard';

interface CasePatientDetailProps {
  patient: CasePatient;
  onBack: () => void;
  onRefreshPatient: (patientId: string) => Promise<void>;
  onDeletePatient: (patient: CasePatient) => Promise<void>;
  onUploadStageFiles?: (stage: CaseStage, files: File[], onProgress?: (info: UploadProgressInfo) => void) => Promise<void>;
  readyTestimonialCount?: number;
  onOpenTestimonials?: (patient: CasePatient) => void;
  onRequestStageEditing?: (stage: CaseStage) => Promise<void>;
}

const momentVisuals: Record<string, { bar: string; badge: string; panel: string; label: string }> = {
  Planejamento: {
    bar: 'bg-emerald-400',
    badge: 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200',
    panel: 'border-emerald-200 bg-emerald-50/30',
    label: 'Antes e briefing',
  },
  Procedimento: {
    bar: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-900 ring-1 ring-amber-200',
    panel: 'border-amber-200 bg-amber-50/30',
    label: 'Durante o tratamento',
  },
  Entrega: {
    bar: 'bg-rose-500',
    badge: 'bg-rose-100 text-rose-900 ring-1 ring-rose-200',
    panel: 'border-rose-200 bg-rose-50/30',
    label: 'Resultado e reação',
  },
  Evento: {
    bar: 'bg-sky-500',
    badge: 'bg-sky-100 text-sky-900 ring-1 ring-sky-200',
    panel: 'border-sky-200 bg-sky-50/30',
    label: 'Conteúdo produzido',
  },
  Agência: {
    bar: 'bg-violet-500',
    badge: 'bg-violet-100 text-violet-900 ring-1 ring-violet-200',
    panel: 'border-violet-200 bg-violet-50/30',
    label: 'Edição e técnica',
  },
};

const phaseHeaderThemes: Record<string, { gradient: string; accent: string; muted: string }> = {
  Planejamento: {
    gradient: 'from-[#f6fffb] via-[#d8fbec] to-[#81e6bd]',
    accent: '#10b981',
    muted: '#287860',
  },
  Procedimento: {
    gradient: 'from-[#fffaf0] via-[#ffe9b8] to-[#ffc857]',
    accent: '#f59e0b',
    muted: '#8a5a06',
  },
  Entrega: {
    gradient: 'from-[#fff2f7] via-[#ffc9df] to-[#ff73a6]',
    accent: '#ec4899',
    muted: '#9b1d59',
  },
  Evento: {
    gradient: 'from-[#f2fbff] via-[#d5f1ff] to-[#8ecfff]',
    accent: '#0ea5e9',
    muted: '#176389',
  },
  Agência: {
    gradient: 'from-[#fbf7ff] via-[#eadfff] to-[#bba2ff]',
    accent: '#8b5cf6',
    muted: '#5b3f96',
  },
};

const CasePatientDetail: React.FC<CasePatientDetailProps> = ({
  patient,
  onBack,
  onRefreshPatient,
  onDeletePatient,
  onUploadStageFiles,
  readyTestimonialCount = 0,
  onOpenTestimonials,
  onRequestStageEditing,
}) => {
  const progress = getPatientProgress(patient);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteConfirm, setDeleteConfirm] = React.useState('');
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<'all' | 'captured' | 'todo'>('all');

  const orderedStages = CASE_STAGE_DEFINITIONS.map(definition => {
    return patient.stages.find(stage => getCanonicalCaseStageTitle(stage.title) === definition.title) || {
      id: `missing-${definition.title}`,
      boardId: patient.boardId,
      parentItemId: patient.id,
      title: definition.title,
      moment: definition.moment,
      expectedItems: [],
      status: 'Fazer',
      statusColumnId: '',
      filesColumnId: '',
      files: [],
    };
  });

  const handleUpload = async (stage: CaseStage, files: File[], onProgress?: (info: UploadProgressInfo) => void) => {
    if (stage.id.startsWith('missing-')) return;
    if (onUploadStageFiles) {
      await onUploadStageFiles(stage, files, onProgress);
    } else {
      await uploadStageFilesToDrive(stage, files, onProgress);
    }
    await onRefreshPatient(patient.id);
  };

  const handleFileDeleted = (stageId: string, fileId: string) => {
    // Optimistically remove from UI; parent will refresh on next open
    void onRefreshPatient(patient.id);
  };

  const chips = [
    formatDate(patient.createdAt),
    patient.age ? `${patient.age} anos` : null,
    patient.birthDate ? `Nasc. ${formatDate(new Date(`${patient.birthDate}T00:00:00`))}` : null,
    patient.gender || null,
    patient.procedure || null,
    patient.dentistResponsible ? `DR: ${patient.dentistResponsible}` : null,
  ].filter(Boolean);

  const handleDelete = async () => {
    if (deleteConfirm !== 'Certeza') return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await onDeletePatient(patient);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Não foi possível limpar o caso.');
      setIsDeleting(false);
    }
  };

  const getMomentProgress = (moment: string) => {
    const momentStages = orderedStages.filter(s => s.moment === moment);
    const captured = momentStages.filter(s => s.status === 'Capturado' || s.files.length > 0).length;
    const total = momentStages.length;
    return {
      captured,
      total,
      percentage: Math.round((captured / total) * 100),
      isComplete: captured === total,
    };
  };

  return (
    <div className="animate-fade-in pb-14 sm:pb-20">
      {/* Compact detail toolbar */}
      <div className="sticky top-0 z-40 px-4 pt-4 lg:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between rounded-[1.75rem] border border-white/75 bg-white/60 px-4 py-3 shadow-[0_16px_44px_rgba(22,78,129,0.1)] backdrop-blur-2xl">
          <button
            onClick={onBack}
            className="impact-pill"
            type="button"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M7.793 14.707a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 0-1.414l4-4a1 1 0 1 1 1.414 1.414L5.5 9H17a1 1 0 1 1 0 2H5.5l2.293 2.293a1 1 0 0 1 0 1.414Z" clipRule="evenodd" />
            </svg>
            Casos
          </button>

          {readyTestimonialCount > 0 && (
            <button
              type="button"
              onClick={() => onOpenTestimonials?.(patient)}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-emerald-50 px-3 text-xs font-black text-emerald-700 ring-1 ring-emerald-100 transition-colors hover:bg-emerald-100"
            >
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] text-white">
                {readyTestimonialCount}
              </span>
              Prontos
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pt-6 space-y-6 sm:pt-8 sm:space-y-8 lg:px-8 lg:pt-10 lg:space-y-10">
        {/* Patient Minimal Info */}
        <div className="impact-glass flex items-start justify-between gap-4 rounded-[1.8rem] p-6 sm:p-8 lg:rounded-[2.4rem]">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#20a8f5]">Paciente</p>
            <h1 className="mt-1 text-[1.55rem] font-black leading-[1.05] tracking-tight text-[#082653] sm:text-3xl lg:text-4xl">{patient.name}</h1>
            {chips.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {chips.slice(0, 4).map(chip => (
                  <span key={chip as string} className="inline-flex items-center rounded-full bg-white/80 px-3 py-1.5 text-xs font-black text-[#5277a2] shadow-sm ring-1 ring-[#d7ebfb]">
                    {chip}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => { setDeleteOpen(true); setDeleteConfirm(''); }}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/80 text-[#6d91bb] shadow-[0_10px_24px_rgba(22,78,129,0.1)] ring-1 ring-white/80 transition-all hover:text-red-500 hover:ring-red-100"
            aria-label="Excluir caso"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="impact-glass grid grid-cols-3 gap-1 rounded-[1.7rem] p-1.5">
          {[
            { id: 'all', label: 'Todas' },
            { id: 'todo', label: 'Pendentes' },
            { id: 'captured', label: 'Capturadas' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id as any)}
              className={`min-h-11 rounded-[1.2rem] px-2 text-[10px] font-black uppercase tracking-wider transition-all sm:text-[11px] lg:min-h-12 lg:text-xs ${
                filter === item.id ? 'bg-white text-[#20a8f5] shadow-[0_8px_22px_rgba(22,78,129,0.1)]' : 'text-[#7d9bbd] hover:text-[#174579]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-black/45 p-4" role="dialog" aria-modal="true" aria-label={`Confirmar exclusao de ${patient.name}`}>
          <div className="w-full max-w-md rounded-2xl border border-red-100 bg-white p-6 shadow-2xl">
            <p className="text-[11px] font-bold uppercase tracking-widest text-red-500">Ação crítica</p>
            <h2 className="mt-2 text-xl font-bold text-zinc-950">Limpar caso de {patient.name}?</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Isso remove este paciente do Monday, do Supabase e do Drive. Para confirmar, digite <strong>Certeza</strong>.
            </p>
            <input
              name="delete-confirmation"
              value={deleteConfirm}
              onChange={event => setDeleteConfirm(event.target.value)}
              autoComplete="off"
              className="mt-4 w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm font-semibold outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
              placeholder="Digite Certeza"
            />
            {deleteError && <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" aria-live="polite">{deleteError}</p>}
            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                disabled={isDeleting}
                className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteConfirm !== 'Certeza' || isDeleting}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-40"
              >
                {isDeleting ? 'Limpando...' : 'Excluir definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}

        {/* Stages */}
        <div className="space-y-8 sm:space-y-12 lg:space-y-14">
          {CASE_STAGE_MOMENTS.map((moment, mIdx) => {
            const stages = orderedStages
              .filter(stage => stage.moment === moment)
              .filter(stage => {
                if (filter === 'captured') return stage.status === 'Capturado';
                if (filter === 'todo') return stage.status === 'Fazer';
                return true;
              });

            if (stages.length === 0) return null;
            const momentProgress = getMomentProgress(moment);
            
            const phaseTheme = phaseHeaderThemes[moment] || phaseHeaderThemes.Planejamento;

            return (
              <section key={moment} className="space-y-4 sm:space-y-6 lg:space-y-7">
                {/* Phase Header Card */}
                <div className={`relative overflow-hidden rounded-[1.75rem] border border-white/80 bg-gradient-to-br ${phaseTheme.gradient} p-5 text-white shadow-[0_22px_60px_rgba(22,78,129,0.14)] transition-all sm:rounded-[2.5rem] sm:p-8 lg:min-h-[10.6rem] lg:rounded-[2.6rem] lg:p-10`}>
                  <div className="absolute inset-0 bg-white/22" />
                  <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white/20 to-transparent" />
                  <div className="relative z-10 flex h-full items-center gap-4">
                    <div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-6 lg:gap-8">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-xl font-black text-[#0a315f] shadow-[0_12px_32px_rgba(22,78,129,0.18)] ring-8 ring-white/28 sm:h-16 sm:w-16 sm:text-2xl lg:h-20 lg:w-20 lg:text-3xl lg:ring-[12px]">
                        {mIdx + 1}
                      </div>
                      <div className="min-w-0">
                        <div
                          className="inline-flex rounded-full bg-white/38 px-3 py-0.5 text-[9px] font-black uppercase tracking-widest backdrop-blur-sm"
                          style={{ color: phaseTheme.accent }}
                        >
                          Fase
                        </div>
                        <h2 className="mt-1.5 text-[1.65rem] font-black leading-none tracking-tight text-[#082653] sm:text-3xl lg:text-4xl">{moment}</h2>
                        <p className="mt-1 text-xs font-black sm:text-sm lg:mt-2 lg:text-base" style={{ color: phaseTheme.muted }}>{momentVisuals[moment]?.label}</p>
                      </div>
                    </div>

                    {/* Circular Progress Indicator */}
                    <div className="relative hidden h-20 w-20 shrink-0 sm:block lg:h-24 lg:w-24">
                      <svg className="h-full w-full" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="16" fill="none" className="stroke-white/55" strokeWidth="3" />
                        <circle
                          cx="18"
                          cy="18"
                          r="16"
                          fill="none"
                          className="transition-all duration-1000 ease-out"
                          style={{ stroke: phaseTheme.accent }}
                          strokeWidth="3"
                          strokeDasharray={`${momentProgress.percentage}, 100`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xs font-black" style={{ color: phaseTheme.accent }}>{momentProgress.captured}/{momentProgress.total}</span>
                        <span className="text-[8px] font-bold uppercase" style={{ color: phaseTheme.muted }}>etapas</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Decorative background circle */}
                  <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-white/30 blur-3xl" />
                </div>

                <div className="space-y-4 lg:space-y-5">
                  {stages.map(stage => (
                    <CaseStageCard
                      key={stage.id}
                      index={orderedStages.findIndex(item => item.title === stage.title)}
                      stage={stage}
                      onUpload={handleUpload}
                      onFileDeleted={handleFileDeleted}
                      isPlaceholder={stage.id.startsWith('missing-')}
                      onRequestEditing={onRequestStageEditing}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CasePatientDetail;
