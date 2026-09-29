import React, { useMemo, useState } from 'react';
import { CasePatient } from '../../types';
import {
  getProductionBadges,
  getCaseThumbnail,
  getProductionSignals,
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

type TrackingFilter = 'all' | 'awaiting' | 'ready' | 'editing' | 'done';

const filterConfig: { id: TrackingFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'awaiting', label: 'Aguardando' },
  { id: 'ready', label: 'Pronto p/ enviar' },
  { id: 'editing', label: 'Em edição' },
  { id: 'done', label: 'Materiais Prontos' },
];

const matchesFilter = (patient: CasePatient, readyCount: number, filter: TrackingFilter) => {
  if (filter === 'all') return true;
  const signals = getProductionSignals(patient, readyCount);
  if (filter === 'awaiting') {
    return signals.readyToEditStagesCount === 0 &&
      signals.pendingEditingRequestsCount === 0 &&
      signals.readyMaterialsCount === 0;
  }
  if (filter === 'ready') return signals.readyToEditStagesCount > 0;
  if (filter === 'editing') return signals.pendingEditingRequestsCount > 0;
  if (filter === 'done') return signals.readyMaterialsCount > 0;
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
      .filter(item => matchesFilter(item.patient, readyTestimonialCounts[item.patient.id] || 0, filter))
      .sort((a, b) => {
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
    const result = { all: 0, awaiting: 0, ready: 0, editing: 0, done: 0 };
    for (const patient of patients) {
      const signals = getProductionSignals(patient, readyTestimonialCounts[patient.id] || 0);
      result.all++;
      if (
        signals.readyToEditStagesCount === 0 &&
        signals.pendingEditingRequestsCount === 0 &&
        signals.readyMaterialsCount === 0
      ) result.awaiting++;
      if (signals.readyToEditStagesCount > 0) result.ready++;
      if (signals.pendingEditingRequestsCount > 0) result.editing++;
      if (signals.readyMaterialsCount > 0) result.done++;
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
      <div className="impact-glass mt-6 flex flex-wrap gap-1 rounded-[1.7rem] p-1.5">
        {filterConfig.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`flex-1 min-h-11 rounded-[1.2rem] px-2 text-[10px] font-black uppercase tracking-wider transition-all sm:text-[11px] min-w-[7.5rem] sm:min-w-0 ${
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

      {/* Grid Container */}
      {items.length === 0 ? (
        <div className="mt-6 impact-glass rounded-[1.8rem] border-dashed p-12 text-center">
          <p className="text-lg font-black text-[#082653]">Nenhum paciente neste filtro</p>
          <p className="mt-2 text-sm font-semibold text-[#5d7ca4]">Selecione outra categoria para ver mais pacientes.</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {items.map(({ patient, status, lastRequest }) => {
            const cfg = productionStatusConfig[status];
            const badges = getProductionBadges(patient, readyTestimonialCounts[patient.id] || 0);
            const thumbnail = getCaseThumbnail(patient);
            const initials = patient.name
              .split(' ')
              .slice(0, 2)
              .map(n => n[0])
              .join('')
              .toUpperCase();
            return (
              <button
                key={patient.id}
                type="button"
                onClick={() => onOpenPatient(patient)}
                className="group impact-soft-card flex flex-col items-center p-4 text-center rounded-[1.45rem] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(22,78,129,0.12)] bg-white/70 backdrop-blur"
              >
                {/* Patient avatar / initials */}
                {thumbnail?.src ? (
                  <img
                    src={thumbnail.src}
                    alt={patient.name}
                    className="h-14 w-14 rounded-full object-cover ring-2 ring-white shadow-sm transition-transform duration-200 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#e8f6ff] to-[#cfe7fb] text-sm font-black text-[#20a8f5] ring-2 ring-white shadow-sm transition-transform duration-200 group-hover:scale-105">
                    {initials || 'P'}
                  </div>
                )}

                {/* Patient info */}
                <div className="mt-3 min-w-0 w-full flex flex-col items-center">
                  <p className="truncate w-full text-sm font-black text-[#082653] group-hover:text-[#20a8f5] transition-colors" title={patient.name}>
                    {patient.name}
                  </p>
                  
                  <div className="mt-2 flex w-full flex-wrap justify-center gap-1">
                    {badges.slice(0, 2).map(badge => (
                      <span key={badge.status} className={`inline-flex items-center rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${productionStatusConfig[badge.status].className}`}>
                        {badge.label}
                      </span>
                    ))}
                    {badges.length > 2 && (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${cfg.className}`}>
                        +{badges.length - 2}
                      </span>
                    )}
                  </div>

                  <div className="mt-2 text-[10px] font-bold text-[#6d8db1] truncate w-full space-y-0.5">
                    {patient.procedure && (
                      <p className="truncate text-[10px] text-[#6d8db1]" title={patient.procedure}>{patient.procedure}</p>
                    )}
                    {lastRequest ? (
                      <p className="truncate text-[9px] text-[#8ea4be]">Enviado {formatDateShort(lastRequest.sentAt)}</p>
                    ) : (
                      <p className="truncate text-[9px] text-transparent select-none">Sem envio</p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProductionTrackingTab;
