import React, { useMemo, useState } from 'react';
import { CasePatient } from '../../types';
import {
  getProductionStatus,
  ProductionStatus,
  productionStatusConfig,
} from './caseUiUtils';

interface ProductionTrackingTabProps {
  patients: CasePatient[];
  readyTestimonialCounts: Record<string, number>;
  onOpenPatient: (patient: CasePatient) => void;
  onBack: () => void;
}

type TrackingFilter = 'all' | 'ready' | 'editing' | 'awaiting';

const filterConfig: { id: TrackingFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'ready', label: 'Prontos' },
  { id: 'editing', label: 'Em edição' },
  { id: 'awaiting', label: 'Aguardando' },
];

const matchesFilter = (status: ProductionStatus, filter: TrackingFilter) => {
  if (filter === 'all') return true;
  if (filter === 'ready') return status === 'material_pronto';
  if (filter === 'editing') return status === 'em_edicao' || status === 'enviado_para_edicao';
  if (filter === 'awaiting') return status === 'sem_material' || status === 'material_parcial' || status === 'pronto_para_edicao';
  return true;
};

const formatDateShort = (dateStr: string | null | undefined) => {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  } catch {
    return '';
  }
};

const ProductionTrackingTab: React.FC<ProductionTrackingTabProps> = ({
  patients,
  readyTestimonialCounts,
  onOpenPatient,
  onBack,
}) => {
  const [filter, setFilter] = useState<TrackingFilter>('all');

  const items = useMemo(() => {
    return patients
      .map(patient => {
        const status = getProductionStatus(patient, readyTestimonialCounts[patient.id] || 0);
        const lastRequest = (patient.editingRequests || [])[0];
        return { patient, status, lastRequest };
      })
      .filter(item => matchesFilter(item.status, filter))
      .sort((a, b) => {
        // Sort: material_pronto first, then em_edicao, then pronto_para_edicao, then rest
        const order: Record<ProductionStatus, number> = {
          material_pronto: 0,
          em_edicao: 1,
          enviado_para_edicao: 2,
          pronto_para_edicao: 3,
          material_parcial: 4,
          sem_material: 5,
        };
        return (order[a.status] ?? 9) - (order[b.status] ?? 9);
      });
  }, [patients, readyTestimonialCounts, filter]);

  const counts = useMemo(() => {
    const result = { all: 0, ready: 0, editing: 0, awaiting: 0 };
    for (const patient of patients) {
      const status = getProductionStatus(patient, readyTestimonialCounts[patient.id] || 0);
      result.all++;
      if (status === 'material_pronto') result.ready++;
      else if (status === 'em_edicao' || status === 'enviado_para_edicao') result.editing++;
      else result.awaiting++;
    }
    return result;
  }, [patients, readyTestimonialCounts]);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#20a8f5]">Acompanhamento</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-[#082653]">Status de produção</h1>
          <p className="mt-1 text-sm font-semibold text-[#5d7ca4]">
            Acompanhe o progresso de todos os pacientes em tempo real.
          </p>
        </div>
        <button type="button" onClick={onBack} className="impact-secondary">
          ← Voltar aos casos
        </button>
      </div>

      {/* Sub-tabs */}
      <div className="impact-glass mt-6 grid grid-cols-4 gap-1 rounded-[1.7rem] p-1.5">
        {filterConfig.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`min-h-11 rounded-[1.2rem] px-2 text-[10px] font-black uppercase tracking-wider transition-all sm:text-[11px] ${
              filter === item.id
                ? 'bg-white text-[#20a8f5] shadow-[0_8px_22px_rgba(22,78,129,0.1)]'
                : 'text-[#7d9bbd] hover:text-[#174579]'
            }`}
          >
            {item.label}
            <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#e8f6ff] px-1 text-[10px] font-black text-[#20a8f5]">
              {counts[item.id]}
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      <div className="mt-6 space-y-3">
        {items.length === 0 ? (
          <div className="impact-glass rounded-[1.8rem] border-dashed p-12 text-center">
            <p className="text-lg font-black text-[#082653]">Nenhum paciente neste filtro</p>
            <p className="mt-2 text-sm font-semibold text-[#5d7ca4]">Selecione outra categoria para ver mais pacientes.</p>
          </div>
        ) : (
          items.map(({ patient, status, lastRequest }) => {
            const cfg = productionStatusConfig[status];
            return (
              <button
                key={patient.id}
                type="button"
                onClick={() => onOpenPatient(patient)}
                className="impact-soft-card flex w-full items-center gap-4 rounded-[1.4rem] p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(22,78,129,0.14)] sm:p-5"
              >
                {/* Status dot */}
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: cfg.iconColor }}
                />
                {/* Patient info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-black text-[#082653]">{patient.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black ${cfg.className}`}>
                      {cfg.shortLabel}
                    </span>
                    {patient.procedure && (
                      <span className="text-[11px] font-bold text-[#6d8db1]">{patient.procedure}</span>
                    )}
                    {lastRequest && (
                      <span className="text-[11px] font-bold text-[#6d8db1]">
                        Enviado {formatDateShort(lastRequest.sentAt)}
                      </span>
                    )}
                  </div>
                </div>
                {/* Arrow */}
                <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4 shrink-0 text-[#6d91bb]">
                  <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L9.19 8 6.22 5.03a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ProductionTrackingTab;
