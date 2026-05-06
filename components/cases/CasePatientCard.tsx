import React from 'react';
import { CasePatient } from '../../types';
import { formatDate, getPatientProgress, getPatientStatus } from './caseUiUtils';

interface CasePatientCardProps {
  patient: CasePatient;
  onOpen: (patient: CasePatient) => void;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  Completo: {
    label: 'Completo',
    className: 'bg-black text-white',
  },
  'Em andamento': {
    label: 'Em andamento',
    className: 'bg-zinc-800 text-white',
  },
  'Com pendencias': {
    label: 'Pendente',
    className: 'bg-zinc-200 text-zinc-800',
  },
};

const CasePatientCard: React.FC<CasePatientCardProps> = ({ patient, onOpen }) => {
  const progress = getPatientProgress(patient);
  const status = getPatientStatus(patient);
  const config = statusConfig[status] || statusConfig['Em andamento'];

  return (
    <button
      type="button"
      onClick={() => onOpen(patient)}
      className="group w-full text-left rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-zinc-400 transition-all duration-200 active:scale-[0.98]"
    >
      {/* Name + status */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Paciente</p>
          <h3 className="mt-1 text-lg font-bold text-zinc-900 truncate leading-tight">{patient.name}</h3>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${config.className}`}>
          {config.label}
        </span>
      </div>

      {/* Info row */}
      <div className="mt-3 flex flex-wrap gap-2">
        {patient.procedure && (
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
            {patient.procedure}
          </span>
        )}
        {patient.age && (
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
            {patient.age} anos
          </span>
        )}
        {patient.createdAt && (
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-500">
            {formatDate(patient.createdAt)}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-zinc-500">{progress.captured}/{progress.total} etapas</span>
          <span className="text-xs font-bold text-zinc-900">{progress.percentage}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-black transition-all duration-500"
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
      </div>

      {/* Arrow hint */}
      <div className="mt-3 flex items-center justify-end">
        <span className="text-[11px] font-semibold text-zinc-400 group-hover:text-zinc-700 transition-colors flex items-center gap-1">
          Ver etapas
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
            <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L9.19 8 6.22 5.03a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
          </svg>
        </span>
      </div>
    </button>
  );
};

export default CasePatientCard;
