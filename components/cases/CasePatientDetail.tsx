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
};

const CasePatientDetail: React.FC<CasePatientDetailProps> = ({
  patient,
  onBack,
  onRefreshPatient,
  onDeletePatient,
  onUploadStageFiles,
  readyTestimonialCount = 0,
  onOpenTestimonials,
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

  return (
    <div className="animate-fade-in">
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="mb-5 inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 shadow-sm hover:border-zinc-400 hover:bg-zinc-50 transition-all active:scale-95"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M7.793 14.707a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 0-1.414l4-4a1 1 0 1 1 1.414 1.414L5.5 9H17a1 1 0 1 1 0 2H5.5l2.293 2.293a1 1 0 0 1 0 1.414Z" clipRule="evenodd" />
        </svg>
        Voltar
      </button>

      {/* Patient header card */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        {/* Black top bar */}
        <div className="h-2 bg-black" />

        <div className="p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Caso clínico</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 leading-tight">{patient.name}</h1>
              <div className="mt-4 flex flex-wrap gap-2">
                {chips.map((chip, i) => (
                  <span key={i} className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-700">
                    {chip}
                  </span>
                ))}
              </div>
            </div>

            {/* Progress */}
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 min-w-[200px]">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Progresso</p>
                <p className="text-sm font-bold text-zinc-900">{progress.captured}/{progress.total}</p>
              </div>
              <div className="mt-3 h-2.5 rounded-full bg-zinc-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-black transition-all duration-500"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-zinc-500">{progress.percentage}% capturado</p>
              {readyTestimonialCount > 0 && (
                <button
                  type="button"
                  onClick={() => onOpenTestimonials?.(patient)}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800 transition-colors hover:bg-emerald-100"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M1 8a2 2 0 0 1 2-2h1.5l1.447-2.17A2 2 0 0 1 7.61 3h4.78a2 2 0 0 1 1.664.89L15.5 6H17a2 2 0 0 1 2 2v6a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3V8Zm9 7a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" clipRule="evenodd" />
                  </svg>
                  Depoimento pronto
                </button>
              )}
            </div>
          </div>

          {(patient.procedureDescription || patient.notes) && (
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 border-t border-zinc-100 pt-5">
              {patient.procedureDescription && (
                <div className="rounded-xl bg-zinc-50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Descrição do procedimento</p>
                  <p className="mt-2 text-sm text-zinc-700 leading-relaxed">{patient.procedureDescription}</p>
                </div>
              )}
              {patient.notes && (
                <div className="rounded-xl bg-zinc-50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Observações</p>
                  <p className="mt-2 text-sm text-zinc-700 leading-relaxed">{patient.notes}</p>
                </div>
              )}
            </div>
          )}

          <div className="mt-5 border-t border-zinc-100 pt-4">
            <button
              type="button"
              onClick={() => {
                setDeleteOpen(true);
                setDeleteConfirm('');
                setDeleteError(null);
              }}
              className="text-xs font-semibold text-zinc-400 underline underline-offset-4 hover:text-red-600 transition-colors"
            >
              Limpar caso
            </button>
          </div>
        </div>
      </div>

      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-red-100 bg-white p-6 shadow-2xl">
            <p className="text-[11px] font-bold uppercase tracking-widest text-red-500">Ação crítica</p>
            <h2 className="mt-2 text-xl font-bold text-zinc-950">Limpar caso de {patient.name}?</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Isso remove este paciente do Monday, do Supabase e do Drive. Para confirmar, digite <strong>Certeza</strong>.
            </p>
            <input
              value={deleteConfirm}
              onChange={event => setDeleteConfirm(event.target.value)}
              className="mt-4 w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm font-semibold outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
              placeholder="Digite Certeza"
            />
            {deleteError && <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{deleteError}</p>}
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

      {/* Filter and Summary */}
      <div className="mt-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1 rounded-xl border border-zinc-200 bg-white p-1 shadow-sm">
            {[
              { id: 'all', label: 'Todas' },
              { id: 'todo', label: 'Pendentes' },
              { id: 'captured', label: 'Capturadas' },
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id as any)}
                className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${
                  filter === item.id
                    ? 'bg-zinc-900 text-white shadow-md'
                    : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {filter !== 'captured' && progress.captured < progress.total && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
            <h3 className="text-xs font-black uppercase tracking-widest text-amber-700">Faltam {progress.total - progress.captured} etapas:</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {orderedStages
                .filter(s => s.status === 'Fazer')
                .map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      const el = document.getElementById(`stage-${s.id}`);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-[10px] font-bold text-amber-800 shadow-sm transition-all hover:bg-amber-100 active:scale-95"
                  >
                    {s.title}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Stages */}
      <div className="mt-8 space-y-10">
        {CASE_STAGE_MOMENTS.map(moment => {
          const stages = orderedStages
            .filter(stage => stage.moment === moment)
            .filter(stage => {
              if (filter === 'captured') return stage.status === 'Capturado';
              if (filter === 'todo') return stage.status === 'Fazer';
              return true;
            });

          if (stages.length === 0) return null;
          const visual = momentVisuals[moment] || momentVisuals.Planejamento;

          return (
            <section key={moment} className={`overflow-hidden rounded-3xl border shadow-sm ${visual.panel}`}>
              <div className={`h-2 w-full ${visual.bar}`} />
              <div className="border-b border-black/5 bg-white/80 px-5 py-5 backdrop-blur">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-black ${visual.badge}`}>
                      {CASE_STAGE_MOMENTS.indexOf(moment) + 1}
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-400">Fase</p>
                      <h2 className="mt-1 text-2xl font-black tracking-tight text-zinc-950">{moment}</h2>
                      <p className="mt-0.5 text-sm font-medium text-zinc-500">{visual.label}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-3 p-4 sm:p-5">
                {stages.map(stage => {
                  const index = orderedStages.findIndex(item => item.title === stage.title);
                  return (
                    <CaseStageCard
                      key={stage.id}
                      index={index}
                      stage={stage}
                      onUpload={handleUpload}
                      onFileDeleted={handleFileDeleted}
                      isPlaceholder={stage.id.startsWith('missing-')}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default CasePatientDetail;
