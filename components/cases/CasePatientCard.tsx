import React from 'react';
import { CasePatient } from '../../types';
import { formatDate, getPatientProgress, getPatientStatus } from './caseUiUtils';

interface CasePatientCardProps {
  patient: CasePatient;
  onOpen: (patient: CasePatient) => void;
  onOpenTestimonials?: (patient: CasePatient) => void;
  readyTestimonialCount?: number;
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

const CasePatientCard: React.FC<CasePatientCardProps> = ({ patient, onOpen, onOpenTestimonials, readyTestimonialCount = 0 }) => {
  const progress = getPatientProgress(patient);
  const status = getPatientStatus(patient);
  const config = statusConfig[status] || statusConfig['Em andamento'];
  const hasReadyTestimonials = readyTestimonialCount > 0;

  return (
    <article
      className="group w-full text-left rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-zinc-400 transition-all duration-200 active:scale-[0.98]"
    >
      <button
        type="button"
        onClick={() => onOpen(patient)}
        className="block w-full text-left"
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
              Planej. {formatDate(patient.createdAt)}
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
      </button>

      {/* Arrow hint */}
      <div className="mt-4 flex items-center justify-between gap-3">
        {hasReadyTestimonials ? (
          <button
            type="button"
            onClick={() => onOpenTestimonials?.(patient)}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-800 transition-colors hover:bg-emerald-100"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
              <path fillRule="evenodd" d="M1 8a2 2 0 0 1 2-2h1.5l1.447-2.17A2 2 0 0 1 7.61 3h4.78a2 2 0 0 1 1.664.89L15.5 6H17a2 2 0 0 1 2 2v6a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3V8Zm9 7a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" clipRule="evenodd" />
            </svg>
            Material pronto
          </button>
        ) : (
          <span />
        )}
        <span className="text-[11px] font-semibold text-zinc-400 group-hover:text-zinc-700 transition-colors flex items-center gap-1">
          Ver etapas
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
            <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L9.19 8 6.22 5.03a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
          </svg>
        </span>
      </div>
    </article>
  );
};

export default CasePatientCard;
