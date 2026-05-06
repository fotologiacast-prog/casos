import React from 'react';
import { CasePatient } from '../../types';
import { formatDate, getPatientProgress, getPatientStatus } from './caseUiUtils';

interface CasePatientCardProps {
  patient: CasePatient;
  onOpen: (patient: CasePatient) => void;
}

const statusStyles: Record<string, string> = {
  Completo: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Em andamento': 'bg-sky-50 text-sky-700 border-sky-200',
  'Com pendencias': 'bg-amber-50 text-amber-700 border-amber-200',
};

const CasePatientCard: React.FC<CasePatientCardProps> = ({ patient, onOpen }) => {
  const progress = getPatientProgress(patient);
  const status = getPatientStatus(patient);

  return (
    <button
      type="button"
      onClick={() => onOpen(patient)}
      className="group text-left bg-white border border-slate-200 rounded-lg p-5 shadow-sm hover:shadow-md hover:border-sky-300 transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Paciente</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950 truncate">{patient.name}</h3>
        </div>
        <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[status]}`}>
          {status}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600">
        <div>
          <p className="text-xs text-slate-400">Cadastro</p>
          <p className="font-medium text-slate-700">{formatDate(patient.createdAt)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Perfil</p>
          <p className="font-medium text-slate-700">
            {patient.age ? `${patient.age} anos` : 'Idade n/i'} · {patient.gender || 'Genero n/i'}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs text-slate-400">Procedimento</p>
        <p className="mt-1 text-sm font-medium text-slate-800 line-clamp-2">
          {patient.procedure || 'Nao informado'}
        </p>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>{progress.captured}/{progress.total} etapas capturadas</span>
          <span>{progress.percentage}%</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-sky-500 transition-all"
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
      </div>
    </button>
  );
};

export default CasePatientCard;
