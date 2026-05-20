import React from 'react';
import { CasePatient } from '../../types';
import {
  CaseThumbnail,
  formatDate,
  getCaseThumbnail,
  getPatientProgress,
  ProductionStatus,
  productionStatusConfig,
} from './caseUiUtils';

interface CasePatientCardProps {
  patient: CasePatient;
  onOpen: (patient: CasePatient) => void;
  onOpenTestimonials?: (patient: CasePatient) => void;
  readyTestimonialCount?: number;
  onEdit?: (patient: CasePatient) => void;
  productionStatus: ProductionStatus;
}

const PatientThumbnail: React.FC<{ thumbnail: CaseThumbnail | null; name: string }> = ({ thumbnail, name }) => {
  const [failed, setFailed] = React.useState(false);
  const [currentSrc, setCurrentSrc] = React.useState(thumbnail?.src || null);

  React.useEffect(() => {
    setFailed(false);
    setCurrentSrc(thumbnail?.src || null);
  }, [thumbnail]);

  if (!currentSrc || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_72%_72%,rgba(32,168,245,0.22),transparent_38%),linear-gradient(135deg,#f8fcff,#d8edff)]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-12 w-12 text-[#6d91bb]">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.226-.584-7.499-1.632Z" clipRule="evenodd" />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={name}
      width={800}
      height={450}
      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      decoding="async"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
};

const CasePatientCard: React.FC<CasePatientCardProps> = ({ patient, onOpen, onOpenTestimonials, readyTestimonialCount = 0, onEdit, productionStatus }) => {
  const progress = getPatientProgress(patient);
  const statusCfg = productionStatusConfig[productionStatus];
  const hasReadyTestimonials = readyTestimonialCount > 0;
  const thumbnail = getCaseThumbnail(patient);

  return (
    <article
      onClick={() => onOpen(patient)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(patient);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Abrir etapas do paciente ${patient.name}`}
      className="impact-soft-card group w-full cursor-pointer overflow-hidden rounded-[1.55rem] p-2 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/80 hover:shadow-[0_24px_65px_rgba(22,78,129,0.17)]"
    >
      {/* Thumbnail or Fallback */}
      <div className="relative flex h-40 w-full items-center justify-center overflow-hidden rounded-[1.25rem] bg-[#d8edff] sm:h-44">
        <PatientThumbnail thumbnail={thumbnail} name={patient.name} />
        <div className="absolute inset-0 bg-gradient-to-t from-[#082653]/20 via-transparent to-white/10" />
        {/* Production badge */}
        <span className={`absolute right-3 top-3 inline-flex items-center rounded-full bg-white/88 px-3 py-1.5 text-[10px] font-black shadow-[0_8px_20px_rgba(22,78,129,0.12)] backdrop-blur ${statusCfg.className}`}>
          {statusCfg.shortLabel}
        </span>
      </div>

      {/* Content */}
      <div className="space-y-3.5 px-3 pb-3 pt-4 sm:px-4 sm:pb-4">
        {/* Name */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#20a8f5]">Paciente</p>
            <h3 className="mt-1.5 truncate text-lg font-black leading-tight text-[#082653]">{patient.name}</h3>
          </div>
          {onEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(patient);
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f0f8ff] text-[#20a8f5] shadow-sm hover:bg-[#20a8f5] hover:text-white transition-colors"
              aria-label={`Editar paciente ${patient.name}`}
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.313.313-.689.544-1.107.676l-3.155 1.262a.5.5 0 0 1-.645-.645Z" />
                <path d="M2 18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.5a.5.5 0 0 0-.5-.5h-15a.5.5 0 0 0-.5.5V18Z" />
              </svg>
            </button>
          )}
        </div>

        {/* Info badges */}
        <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 -mx-1 px-1">
          {patient.procedure && (
            <span
              title={patient.procedure}
              className="inline-flex h-6 shrink-0 items-center justify-center rounded-full bg-white/80 px-2.5 text-[10px] font-black text-[#174579] shadow-sm ring-1 ring-[#d7ebfb] max-w-[110px] truncate"
            >
              {patient.procedure}
            </span>
          )}
          {patient.age && (
            <span className="inline-flex h-6 shrink-0 items-center justify-center rounded-full bg-white/80 px-2.5 text-[10px] font-black text-[#174579] shadow-sm ring-1 ring-[#d7ebfb]">
              {patient.age}a
            </span>
          )}
          {patient.dentistResponsible && (
            <span
              title={`DR. ${patient.dentistResponsible}`}
              className="inline-flex h-6 shrink-0 items-center justify-center rounded-full bg-white/80 px-2.5 text-[10px] font-black text-[#174579] shadow-sm ring-1 ring-[#d7ebfb] max-w-[90px] truncate"
            >
              DR. {patient.dentistResponsible.split(' ')[0]}
            </span>
          )}
        </div>

        {/* Dual progress: Material sent + Production status */}
        <div className="space-y-2.5">
          {/* Material progress bar */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#6d8db1]">Material enviado</span>
              <span className="text-xs font-black text-[#082653]">{progress.captured}/{progress.total}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#d7e8f4]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#20a8f5] to-[#51d4ff] transition-all duration-500"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
          </div>

          {/* Production status line */}
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: statusCfg.iconColor }} />
            <span className="text-xs font-bold text-[#5277a2]">{statusCfg.label}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 pt-1">
          {hasReadyTestimonials ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onOpenTestimonials?.(patient); }}
              aria-label={`Abrir materiais prontos de ${patient.name}`}
              className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
                <path fillRule="evenodd" d="M1 8a2 2 0 0 1 2-2h1.5l1.447-2.17A2 2 0 0 1 7.61 3h4.78a2 2 0 0 1 1.664.89L15.5 6H17a2 2 0 0 1 2 2v6a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3V8Zm9 7a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" clipRule="evenodd" />
              </svg>
              {readyTestimonialCount === 1 ? '1 material pronto' : `${readyTestimonialCount} materiais prontos`}
            </button>
          ) : (
            <span />
          )}
          <span className="flex items-center gap-1 text-xs font-black text-[#6d91bb] transition-colors group-hover:text-[#159de9]">
            Ver etapas
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3" aria-hidden="true">
              <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L9.19 8 6.22 5.03a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
          </span>
        </div>
      </div>
    </article>
  );
};

export default CasePatientCard;
