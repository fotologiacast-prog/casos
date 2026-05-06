import React from 'react';
import { CasePatient, CaseStage } from '../../types';
import { CASE_STAGE_DEFINITIONS } from '../../utils/caseConstants';
import { uploadStageFilesToDrive } from '../../services/driveUploadService';
import { formatDate, getPatientProgress } from './caseUiUtils';
import CaseStageCard from './CaseStageCard';

interface CasePatientDetailProps {
  patient: CasePatient;
  onBack: () => void;
  onRefreshPatient: (patientId: string) => Promise<void>;
  onUploadStageFiles?: (stage: CaseStage, files: File[], onProgress?: (percentage: number) => void) => Promise<void>;
}

const CasePatientDetail: React.FC<CasePatientDetailProps> = ({ patient, onBack, onRefreshPatient, onUploadStageFiles }) => {
  const progress = getPatientProgress(patient);

  const orderedStages = CASE_STAGE_DEFINITIONS.map(definition => {
    return patient.stages.find(stage => stage.title === definition.title) || {
      id: `missing-${definition.title}`,
      boardId: patient.boardId,
      parentItemId: patient.id,
      title: definition.title,
      moment: definition.moment,
      expectedItems: [...definition.expectedItems],
      status: 'Fazer',
      statusColumnId: '',
      filesColumnId: '',
      files: [],
    };
  });

  const handleUpload = async (stage: CaseStage, files: File[], onProgress?: (percentage: number) => void) => {
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
    patient.gender || null,
    patient.procedure || null,
  ].filter(Boolean);

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
        </div>
      </div>

      {/* Stages */}
      <div className="mt-4 space-y-3">
        {orderedStages.map((stage, index) => (
          <CaseStageCard
            key={stage.id}
            index={index}
            stage={stage}
            onUpload={handleUpload}
            isPlaceholder={stage.id.startsWith('missing-')}
          />
        ))}
      </div>
    </div>
  );
};

export default CasePatientDetail;
