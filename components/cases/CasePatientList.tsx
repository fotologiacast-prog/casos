import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CasePatient } from '../../types';
import { CASE_GENDERS, CASE_PROCEDURES } from '../../utils/caseConstants';
import CasePatientCard from './CasePatientCard';
import { formatMonthLabel, getPatientStatus } from './caseUiUtils';

interface CasePatientListProps {
  patients: CasePatient[];
  clientName: string;
  onCreate: () => void;
  onOpen: (patient: CasePatient) => void;
  onOpenTestimonials?: (patient: CasePatient) => void;
  readyTestimonialCounts?: Record<string, number>;
  onRefresh: () => void;
  isRefreshing: boolean;
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
}) => {
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState('all');
  const [status, setStatus] = useState('Todos');
  const [gender, setGender] = useState('Todos');
  const [procedure, setProcedure] = useState('Todos');
  const [ageRange, setAgeRange] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset visible count when filters change
  useEffect(() => { setVisibleCount(12); }, [search, month, status, gender, procedure, ageRange]);

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

  const filteredPatients = useMemo(() => {
    const query = search.trim().toLowerCase();
    return patients.filter(patient => {
      const patientMonth = patient.createdAt?.toISOString().slice(0, 7) || '';
      const patientStatus = getPatientStatus(patient);
      return (
        (!query || patient.name.toLowerCase().includes(query)) &&
        (month === 'all' || patientMonth === month) &&
        (status === 'Todos' || patientStatus === status) &&
        (gender === 'Todos' || patient.gender === gender) &&
        (procedure === 'Todos' || patient.procedure === procedure) &&
        matchesAgeRange(patient.age, ageRange)
      );
    });
  }, [ageRange, gender, month, patients, procedure, search, status]);

  const hasActiveFilters = month !== 'all' || status !== 'Todos' || gender !== 'Todos' || procedure !== 'Todos' || ageRange !== 'all';

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{clientName}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">Casos de pacientes</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {patients.length} caso{patients.length === 1 ? '' : 's'} cadastrado{patients.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50 disabled:opacity-50 transition-all active:scale-95"
          >
            {isRefreshing ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 rounded-full border-2 border-zinc-300 border-t-zinc-700 animate-spin" />
                Atualizando
              </span>
            ) : (
              '↻ Atualizar'
            )}
          </button>
          <button
            type="button"
            onClick={onCreate}
            className="rounded-xl bg-black px-5 py-2.5 text-sm font-bold text-white hover:bg-zinc-800 transition-colors active:scale-95"
          >
            + Novo paciente
          </button>
        </div>
      </div>

      {/* Search + filter toggle */}
      <div className="mt-6 flex gap-2">
        <div className="relative flex-1">
          <svg viewBox="0 0 20 20" fill="currentColor" className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar paciente..."
            className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-colors"
          />
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen(o => !o)}
          className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${
            hasActiveFilters
              ? 'border-zinc-900 bg-zinc-900 text-white'
              : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400'
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
        <div className="mt-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm animate-fade-in">
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
              className="mt-4 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors underline underline-offset-2"
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}

      {/* Patient grid */}
      {filteredPatients.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 mx-auto mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7 text-zinc-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 16.318A4.486 4.486 0 0 0 12.016 15a4.486 4.486 0 0 0-3.198 1.318M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-zinc-900">Nenhum caso encontrado</h2>
          <p className="mt-2 text-sm text-zinc-500">
            {hasActiveFilters ? 'Tente ajustar os filtros.' : 'Cadastre o primeiro paciente.'}
          </p>
          {!hasActiveFilters && (
            <button
              type="button"
              onClick={onCreate}
              className="mt-5 rounded-xl bg-black px-6 py-2.5 text-sm font-bold text-white hover:bg-zinc-800 transition-colors"
            >
              + Novo paciente
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredPatients.slice(0, visibleCount).map(patient => (
              <CasePatientCard
                key={patient.id}
                patient={patient}
                onOpen={onOpen}
                readyTestimonialCount={readyTestimonialCounts[patient.id] || 0}
                onOpenTestimonials={onOpenTestimonials}
              />
            ))}
          </div>
          {visibleCount < filteredPatients.length && (
            <div ref={sentinelRef} className="mt-8 flex items-center justify-center py-6">
              <div className="flex items-center gap-3 text-sm text-zinc-500">
                <span className="h-5 w-5 rounded-full border-2 border-zinc-300 border-t-zinc-700 animate-spin" />
                Carregando mais casos...
              </div>
            </div>
          )}
          {visibleCount >= filteredPatients.length && filteredPatients.length > 12 && (
            <p className="mt-6 text-center text-xs font-semibold text-zinc-400">
              {filteredPatients.length} casos carregados
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default CasePatientList;
