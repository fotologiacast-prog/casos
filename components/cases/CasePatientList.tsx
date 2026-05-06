import React, { useMemo, useState } from 'react';
import { CasePatient } from '../../types';
import { CASE_GENDERS, CASE_PROCEDURES } from '../../utils/caseConstants';
import CasePatientCard from './CasePatientCard';
import { formatMonthLabel, getPatientStatus } from './caseUiUtils';

interface CasePatientListProps {
  patients: CasePatient[];
  clientName: string;
  onCreate: () => void;
  onOpen: (patient: CasePatient) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

const ageRanges = [
  { value: 'all', label: 'Todas as idades' },
  { value: '0-18', label: 'Ate 18' },
  { value: '19-30', label: '19 a 30' },
  { value: '31-45', label: '31 a 45' },
  { value: '46-60', label: '46 a 60' },
  { value: '61+', label: '61+' },
];

const matchesAgeRange = (age: number | null, range: string) => {
  if (range === 'all') return true;
  if (age === null) return false;
  if (range === '61+') return age >= 61;
  const [min, max] = range.split('-').map(Number);
  return age >= min && age <= max;
};

const CasePatientList: React.FC<CasePatientListProps> = ({
  patients,
  clientName,
  onCreate,
  onOpen,
  onRefresh,
  isRefreshing,
}) => {
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState('all');
  const [status, setStatus] = useState('Todos');
  const [gender, setGender] = useState('Todos');
  const [procedure, setProcedure] = useState('Todos');
  const [ageRange, setAgeRange] = useState('all');

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

  return (
    <div>
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-600">{clientName}</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">Casos de pacientes</h1>
          <p className="mt-2 text-sm text-slate-500">
            {patients.length} caso{patients.length === 1 ? '' : 's'} cadastrado{patients.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-sky-300 disabled:opacity-60"
          >
            {isRefreshing ? 'Atualizando...' : 'Atualizar'}
          </button>
          <button
            type="button"
            onClick={onCreate}
            className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
          >
            Novo paciente
          </button>
        </div>
      </div>

      <div className="mt-8 bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-6">
          <label className="lg:col-span-2">
            <span className="text-xs font-semibold text-slate-500">Buscar</span>
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Nome do paciente"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400"
            />
          </label>

          <label>
            <span className="text-xs font-semibold text-slate-500">Mes</span>
            <select value={month} onChange={event => setMonth(event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400">
              <option value="all">Todos</option>
              {monthOptions.map(option => (
                <option key={option} value={option}>{formatMonthLabel(option)}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="text-xs font-semibold text-slate-500">Status</span>
            <select value={status} onChange={event => setStatus(event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400">
              {['Todos', 'Em andamento', 'Completo', 'Com pendencias'].map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="text-xs font-semibold text-slate-500">Genero</span>
            <select value={gender} onChange={event => setGender(event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400">
              <option value="Todos">Todos</option>
              {CASE_GENDERS.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>

          <label>
            <span className="text-xs font-semibold text-slate-500">Idade</span>
            <select value={ageRange} onChange={event => setAgeRange(event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400">
              {ageRanges.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>

        <label className="mt-3 block">
          <span className="text-xs font-semibold text-slate-500">Procedimento</span>
          <select value={procedure} onChange={event => setProcedure(event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400">
            <option value="Todos">Todos</option>
            {CASE_PROCEDURES.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
      </div>

      {filteredPatients.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="text-lg font-semibold text-slate-800">Nenhum caso encontrado</h2>
          <p className="mt-2 text-sm text-slate-500">Ajuste os filtros ou cadastre um novo paciente.</p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredPatients.map(patient => (
            <CasePatientCard key={patient.id} patient={patient} onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  );
};

export default CasePatientList;
