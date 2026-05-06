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
  onUploadStageFiles?: (stage: CaseStage, files: File[]) => Promise<void>;
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

  const handleUpload = async (stage: CaseStage, files: File[]) => {
    if (stage.id.startsWith('missing-')) {
      throw new Error('Esta etapa ainda nao existe para este paciente.');
    }
    if (onUploadStageFiles) {
      await onUploadStageFiles(stage, files);
    } else {
      await uploadStageFilesToDrive(stage, files);
    }
    await onRefreshPatient(patient.id);
  };

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800 transition-colors"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M7.793 14.707a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 0-1.414l4-4a1 1 0 1 1 1.414 1.414L5.5 9H17a1 1 0 1 1 0 2H5.5l2.293 2.293a1 1 0 0 1 0 1.414Z" clipRule="evenodd" />
        </svg>
        <span>Voltar para pacientes</span>
      </button>

      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-600">Caso clinico</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">{patient.name}</h1>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{formatDate(patient.createdAt)}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{patient.age ? `${patient.age} anos` : 'Idade n/i'}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{patient.gender || 'Genero n/i'}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{patient.procedure || 'Procedimento n/i'}</span>
            </div>
          </div>

          <div className="min-w-[220px] rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between text-sm font-semibold text-slate-600">
              <span>Progresso</span>
              <span>{progress.captured}/{progress.total}</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full bg-sky-500" style={{ width: `${progress.percentage}%` }} />
            </div>
            <p className="mt-2 text-xs font-medium text-slate-500">{progress.percentage}% capturado</p>
          </div>
        </div>

        {(patient.procedureDescription || patient.notes) && (
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            {patient.procedureDescription && (
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Descricao do procedimento</p>
                <p className="mt-2 text-sm text-slate-700">{patient.procedureDescription}</p>
              </div>
            )}
            {patient.notes && (
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Observacoes</p>
                <p className="mt-2 text-sm text-slate-700">{patient.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 space-y-3">
        {orderedStages.map((stage, index) => (
          <CaseStageCard key={stage.id} index={index} stage={stage} onUpload={handleUpload} />
        ))}
      </div>
    </div>
  );
};

export default CasePatientDetail;
