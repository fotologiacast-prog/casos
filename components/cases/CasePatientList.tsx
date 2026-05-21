import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { CasePatient } from '../../types';
import { CASE_GENDERS, CASE_PROCEDURES } from '../../utils/caseConstants';
import CasePatientCard from './CasePatientCard';
import ProductionSummaryBar from './ProductionSummaryBar';
import {
  formatMonthLabel,
  getPatientStatus,
  getProductionSignals,
  getProductionStatus,
  getProductionSummary,
} from './caseUiUtils';

interface CasePatientListProps {
  patients: CasePatient[];
  clientName: string;
  onCreate: () => void;
  onOpen: (patient: CasePatient) => void;
  onOpenTestimonials?: (patient: CasePatient) => void;
  readyTestimonialCounts?: Record<string, number>;
  onRefresh: () => void;
  isRefreshing: boolean;
  onEdit?: (patient: CasePatient) => void;
  productionFilters?: string[];
  onToggleProductionFilter?: (filter: string) => void;
  onClearProductionFilters?: () => void;
}

const ageRanges = [
  { value: 'all', label: 'Todas idades' },
  { value: '0-18', label: 'Até 18' },
  { value: '19-30', label: '19–30' },
  { value: '31-45', label: '31–45' },
  { value: '46-60', label: '46–60' },
  { value: '61+', label: '61+' },
];

const matchesAgeRange = (age: number | null, range: string) => {
  if (range === 'all') return true;
  if (age === null) return false;
  if (range === '61+') return age >= 61;
  const [min, max] = range.split('-').map(Number);
  return age >= min && age <= max;
};

const splitProcedures = (value?: string | null) =>
  String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

const SelectChip: React.FC<{ value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; label: string }> = ({ value, onChange, options, label }) => (
  <label className="flex flex-col gap-1">
    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{label}</span>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-colors appearance-none pr-8 bg-no-repeat bg-right"
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%239CA3AF'%3E%3Cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z' clip-rule='evenodd'/%3E%3C/svg%3E")`, backgroundSize: '1.25rem', backgroundPosition: 'right 0.5rem center' }}
    >
      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  </label>
);

const CasePatientList: React.FC<CasePatientListProps> = ({
  patients,
  clientName,
  onCreate,
  onOpen,
  onOpenTestimonials,
  readyTestimonialCounts = {},
  onRefresh,
  isRefreshing,
  onEdit,
  productionFilters = [],
  onToggleProductionFilter,
  onClearProductionFilters,
}) => {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [month, setMonth] = useState('all');
  const [status, setStatus] = useState('Todos');
  const [gender, setGender] = useState('Todos');
  const [procedure, setProcedure] = useState('Todos');
  const [ageRange, setAgeRange] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset visible count when filters change
  useEffect(() => { setVisibleCount(12); }, [search, month, status, gender, procedure, ageRange, productionFilters]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setVisibleCount(prev => prev + 12);
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const monthOptions = useMemo(() => {
    const months = new Set<string>();
    patients.forEach(patient => {
      if (!patient.createdAt) return;
      months.add(patient.createdAt.toISOString().slice(0, 7));
    });
    return Array.from(months).sort().reverse();
  }, [patients]);

  const productionSummary = useMemo(
    () => getProductionSummary(patients, readyTestimonialCounts),
    [patients, readyTestimonialCounts],
  );

  const matchesProductionFilter = (patient: CasePatient, filters: string[]) => {
    if (filters.length === 0) return true;
    const signals = getProductionSignals(patient, readyTestimonialCounts[patient.id] || 0);
    return filters.some(filter => {
      switch (filter) {
        case 'awaiting':
          return signals.readyToEditStagesCount === 0 &&
            signals.pendingEditingRequestsCount === 0 &&
            signals.readyMaterialsCount === 0;
        case 'ready': return signals.readyToEditStagesCount > 0;
        case 'editing': return signals.pendingEditingRequestsCount > 0;
        case 'materialsReady': return signals.readyMaterialsCount > 0;
        default: return true;
      }
    });
  };

  const filteredPatients = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    return patients.filter(patient => {
      const patientMonth = patient.createdAt?.toISOString().slice(0, 7) || '';
      const patientStatus = getPatientStatus(patient);
      return (
        (!query || patient.name.toLowerCase().includes(query)) &&
        (month === 'all' || patientMonth === month) &&
        (status === 'Todos' || patientStatus === status) &&
        (gender === 'Todos' || patient.gender === gender) &&
        (procedure === 'Todos' || splitProcedures(patient.procedure).includes(procedure)) &&
        matchesAgeRange(patient.age, ageRange) &&
        matchesProductionFilter(patient, productionFilters)
      );
    });
  }, [ageRange, deferredSearch, gender, month, patients, procedure, productionFilters, readyTestimonialCounts, status]);

  const hasActiveFilters = month !== 'all' || status !== 'Todos' || gender !== 'Todos' || procedure !== 'Todos' || ageRange !== 'all';

  return (
    <div className="animate-fade-in">
      {/* Production summary bar */}
      <ProductionSummaryBar
        summary={productionSummary}
        activeFilters={productionFilters}
        onToggleFilter={(f) => onToggleProductionFilter?.(f)}
      />

      {/* Header */}
      <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#20a8f5]">Casos de pacientes</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-[#082653] sm:text-4xl">{clientName}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[#5d7ca4]">
              {filteredPatients.length} de {patients.length} caso{patients.length === 1 ? '' : 's'}
            </p>
            {productionFilters.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e8f5ff] px-2.5 py-0.5 text-xs font-black text-[#20a8f5] ring-1 ring-[#cde6f9] shadow-sm animate-fade-in">
                Filtros: {productionFilters.map(filter => filter === 'awaiting' ? 'Aguardando material' : filter === 'ready' ? 'Prontos para enviar' : filter === 'editing' ? 'Em edição' : 'Materiais prontos').join(' + ')}
                <button
                  type="button"
                  onClick={() => onClearProductionFilters?.()}
                  className="ml-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[#20a8f5] text-white hover:bg-[#1594de] transition-colors"
                  aria-label="Limpar filtro de produção"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                    <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                  </svg>
                </button>
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="impact-secondary"
          >
            {isRefreshing ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 rounded-full border-2 border-zinc-300 border-t-zinc-700 animate-spin" />
                Atualizando
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                  <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466.75.75 0 0 0-1.061 1.061 7 7 0 0 0 11.713-3.138.75.75 0 0 0-1.451-.389ZM4.688 8.576a5.5 5.5 0 0 1 9.201-2.466.75.75 0 1 0 1.061-1.061A7 7 0 0 0 3.237 8.187a.75.75 0 1 0 1.451.389Z" clipRule="evenodd" />
                  <path fillRule="evenodd" d="M6.75 8.25A.75.75 0 0 1 6 9H3.25a.75.75 0 0 1-.75-.75V5.5a.75.75 0 0 1 1.5 0v1.19l1.22-1.22a.75.75 0 0 1 1.06 1.06L5.06 7.75H6a.75.75 0 0 1 .75.5Zm6.5 3.5A.75.75 0 0 1 14 11h2.75a.75.75 0 0 1 .75.75v2.75a.75.75 0 0 1-1.5 0v-1.19l-1.22 1.22a.75.75 0 1 1-1.06-1.06l1.22-1.22H14a.75.75 0 0 1-.75-.5Z" clipRule="evenodd" />
                </svg>
                Atualizar
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onCreate}
            className="impact-primary"
          >
            + Novo paciente
          </button>
        </div>
      </div>

      {/* Search + filter toggle */}
      <div className="mt-7 flex gap-3">
        <div className="relative flex-1">
          <svg viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6d91bb]">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
          </svg>
          <input
            name="case-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoComplete="off"
            placeholder="Buscar paciente..."
            className="h-14 w-full rounded-2xl border border-white/75 bg-white/70 py-3 pl-12 pr-4 text-sm font-semibold text-[#123762] shadow-[0_14px_34px_rgba(22,78,129,0.1)] outline-none backdrop-blur-xl transition-colors placeholder:text-[#7d9bbd] focus:border-[#7bcdfb] focus:ring-2 focus:ring-[#20a8f5]/15"
          />
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen(o => !o)}
          className={`min-h-14 rounded-2xl border px-5 text-sm font-black shadow-[0_14px_34px_rgba(22,78,129,0.1)] transition-all ${
            hasActiveFilters
              ? 'border-[#20a8f5] bg-[#20a8f5] text-white'
              : 'border-white/75 bg-white/70 text-[#0d3767] hover:bg-white'
          }`}
        >
          <span className="flex items-center gap-2">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 0 1 .628.74v2.288a2.25 2.25 0 0 1-.659 1.59l-4.682 4.683a2.25 2.25 0 0 0-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 0 1 8 18.25v-5.757a2.25 2.25 0 0 0-.659-1.591L2.659 6.22A2.25 2.25 0 0 1 2 4.629V2.34a.75.75 0 0 1 .628-.74Z" clipRule="evenodd" />
            </svg>
            {hasActiveFilters ? 'Filtros ativos' : 'Filtros'}
          </span>
        </button>
      </div>

      {/* Expandable filters */}
      {filtersOpen && (
        <div className="impact-glass mt-4 rounded-[1.6rem] p-5 animate-fade-in">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <SelectChip
              label="Mês"
              value={month}
              onChange={setMonth}
              options={[{ value: 'all', label: 'Todos' }, ...monthOptions.map(o => ({ value: o, label: formatMonthLabel(o) }))]}
            />
            <SelectChip
              label="Status"
              value={status}
              onChange={setStatus}
              options={['Todos', 'Em andamento', 'Completo', 'Com pendencias'].map(v => ({ value: v, label: v }))}
            />
            <SelectChip
              label="Gênero"
              value={gender}
              onChange={setGender}
              options={[{ value: 'Todos', label: 'Todos' }, ...CASE_GENDERS.map(v => ({ value: v, label: v }))]}
            />
            <SelectChip
              label="Idade"
              value={ageRange}
              onChange={setAgeRange}
              options={ageRanges}
            />
            <div className="col-span-2 sm:col-span-3 lg:col-span-2">
              <SelectChip
                label="Procedimento"
                value={procedure}
                onChange={setProcedure}
                options={[{ value: 'Todos', label: 'Todos' }, ...CASE_PROCEDURES.map(v => ({ value: v, label: v }))]}
              />
            </div>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => { setMonth('all'); setStatus('Todos'); setGender('Todos'); setProcedure('Todos'); setAgeRange('all'); }}
              className="mt-4 text-xs font-black text-[#5d7ca4] underline underline-offset-2 transition-colors hover:text-[#082653]"
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}

      {/* Patient grid */}
      {filteredPatients.length === 0 ? (
        <div className="impact-glass mt-8 rounded-[1.8rem] border-dashed p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eaf7ff] text-[#20a8f5]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 16.318A4.486 4.486 0 0 0 12.016 15a4.486 4.486 0 0 0-3.198 1.318M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z" />
            </svg>
          </div>
          <h2 className="text-lg font-black text-[#082653]">Nenhum caso encontrado</h2>
          <p className="mt-2 text-sm font-semibold text-[#5d7ca4]">
            {hasActiveFilters ? 'Tente ajustar os filtros.' : 'Cadastre o primeiro paciente.'}
          </p>
          {!hasActiveFilters && (
            <button
              type="button"
              onClick={onCreate}
              className="impact-primary mt-5"
            >
              + Novo paciente
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredPatients.slice(0, visibleCount).map(patient => (
              <CasePatientCard
                key={patient.id}
                patient={patient}
                onOpen={onOpen}
                readyTestimonialCount={readyTestimonialCounts[patient.id] || 0}
                onOpenTestimonials={onOpenTestimonials}
                onEdit={onEdit}
                productionStatus={getProductionStatus(patient, readyTestimonialCounts[patient.id] || 0)}
              />
            ))}
          </div>
          {visibleCount < filteredPatients.length && (
            <div ref={sentinelRef} className="mt-8 flex items-center justify-center py-6">
              <div className="flex items-center gap-3 text-sm font-semibold text-[#5d7ca4]">
                <span className="h-5 w-5 rounded-full border-2 border-[#bfe5fb] border-t-[#20a8f5] animate-spin" />
                Carregando mais casos...
              </div>
            </div>
          )}
          {visibleCount >= filteredPatients.length && filteredPatients.length > 12 && (
            <p className="mt-6 text-center text-xs font-black text-[#7d9bbd]">
              {filteredPatients.length} casos carregados
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default CasePatientList;
