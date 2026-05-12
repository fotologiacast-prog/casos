import React from 'react';
import { CasePatient } from '../../types';
import { formatDate, getCaseThumbnail, getPatientProgress, getPatientStatus } from './caseUiUtils';

interface CasePatientCardProps {
  patient: CasePatient;
  onOpen: (patient: CasePatient) => void;
  onOpenTestimonials?: (patient: CasePatient) => void;
  readyTestimonialCount?: number;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  Completo: {
    label: 'Completo',
    className: 'bg-teal-100 text-teal-700',
  },
  'Em andamento': {
    label: 'Em andamento',
    className: 'bg-blue-100 text-blue-700',
  },
  'Com pendencias': {
    label: 'Pendente',
    className: 'bg-amber-100 text-amber-700',
  },
};

const CasePatientCard: React.FC<CasePatientCardProps> = ({ patient, onOpen, onOpenTestimonials, readyTestimonialCount = 0 }) => {
  const progress = getPatientProgress(patient);
  const status = getPatientStatus(patient);
  const config = statusConfig[status] || statusConfig['Em andamento'];
  const hasReadyTestimonials = readyTestimonialCount > 0;
  const thumbnail = getCaseThumbnail(patient);

  return (
    <article
      onClick={() => onOpen(patient)}
      className="group w-full cursor-pointer card overflow-hidden transition-smooth hover:shadow-elevated"
    >
      {/* Thumbnail or Fallback */}
      <div className="relative flex h-44 w-full items-center justify-center overflow-hidden bg-slate-100">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={patient.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-12 w-12 text-slate-300">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.226-.584-7.499-1.632Z" clipRule="evenodd" />
          </svg>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <span className={`badge absolute right-3 top-3 ${config.className}`}>
          {config.label}
        </span>
      </div>

      {/* Content */}
      <div className="space-y-4 p-6">
        {/* Name */}
        <div>
          <p className="section-label">Paciente</p>
          <h3 className="mt-2 truncate text-lg font-bold leading-tight text-slate-900">{patient.name}</h3>
        </div>

        {/* Info badges */}
        <div className="flex flex-wrap gap-2">
          {patient.procedure && (
            <span className="badge bg-slate-100 text-slate-700">
              {patient.procedure}
            </span>
          )}
          {patient.age && (
            <span className="badge bg-slate-100 text-slate-700">
              {patient.age}a
            </span>
          )}
          {patient.dentistResponsible && (
            <span className="badge bg-slate-100 text-slate-700">
              DR. {patient.dentistResponsible}
            </span>
          )}
        </div>

        {/* Progress */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">{progress.captured}/{progress.total} etapas</span>
            <span className="text-xs font-bold text-slate-900">{progress.percentage}%</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 pt-2">
          {hasReadyTestimonials ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onOpenTestimonials?.(patient); }}
              className="badge badge-success"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path fillRule="evenodd" d="M1 8a2 2 0 0 1 2-2h1.5l1.447-2.17A2 2 0 0 1 7.61 3h4.78a2 2 0 0 1 1.664.89L15.5 6H17a2 2 0 0 1 2 2v6a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3V8Zm9 7a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" clipRule="evenodd" />
              </svg>
              Pronto
            </button>
          ) : (
            <span />
          )}
          <span className="text-xs font-semibold text-slate-400 transition-colors group-hover:text-slate-700 flex items-center gap-1">
            Ver etapas
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
              <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L9.19 8 6.22 5.03a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
          </span>
        </div>
      </div>
    </article>
  );
};

export default CasePatientCard;
