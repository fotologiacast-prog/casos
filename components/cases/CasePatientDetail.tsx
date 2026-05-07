import React from 'react';
import { CasePatient, CaseStage } from '../../types';
import { CASE_STAGE_DEFINITIONS, CASE_STAGE_MOMENTS } from '../../utils/caseConstants';
import { uploadStageFilesToDrive, UploadProgressInfo } from '../../services/driveUploadService';
import { formatDate, getPatientProgress } from './caseUiUtils';
import CaseStageCard from './CaseStageCard';

interface CasePatientDetailProps {
  patient: CasePatient;
  onBack: () => void;
  onRefreshPatient: (patientId: string) => Promise<void>;
  onDeletePatient: (patient: CasePatient) => Promise<void>;
  onUploadStageFiles?: (stage: CaseStage, files: File[], onProgress?: (info: UploadProgressInfo) => void) => Promise<void>;
}

const momentVisuals: Record<string, { bar: string; badge: string; panel: string; label: string }> = {
  Planejamento: {
    bar: 'bg-zinc-950',
    badge: 'bg-zinc-950 text-white',
    panel: 'border-zinc-300 bg-white',
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

const CasePatientDetail: React.FC<CasePatientDetailProps> = ({ patient, onBack, onRefreshPatient, onDeletePatient, onUploadStageFiles }) => {
  const progress = getPatientProgress(patient);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteConfirm, setDeleteConfirm] = React.useState('');
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const orderedStages = CASE_STAGE_DEFINITIONS.map(definition => {
    return patient.stages.find(stage => stage.title === definition.title) || {
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
    if (stage.id.startsWith('missing-')) return; // placeholder — upload disabled in CaseStageCard
    if (onUploadStageFiles) {
      await onUploadStageFiles(stage, files, onProgress);
    } else {
      await uploadStageFilesToDrive(stage, files, onProgress);
    }
    await onRefreshPatient(patient.id);
  };

  const chips = [
    formatDate(patient.createdAt),
    patient.age ? `${patient.age} anos` : null,
    patient.birthDate ? `Nasc. ${formatDate(new Date(`${patient.birthDate}T00:00:00`))}` : null,
    patient.gender || null,
    patient.procedure || null,
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

      {/* Stages */}
      <div className="mt-8 space-y-10">
        {CASE_STAGE_MOMENTS.map(moment => {
          const stages = orderedStages.filter(stage => stage.moment === moment);
          const captured = stages.filter(stage => stage.status === 'Capturado' || stage.files.length > 0).length;
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
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-400">Momento</p>
                      <h2 className="mt-1 text-2xl font-black tracking-tight text-zinc-950">{moment}</h2>
                      <p className="mt-0.5 text-sm font-medium text-zinc-500">{visual.label}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-3 py-1.5 text-xs font-black ${visual.badge}`}>
                      {captured}/{stages.length} capturados
                    </span>
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
