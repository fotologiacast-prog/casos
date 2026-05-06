import React, { useState } from 'react';
import { CASE_GENDERS, CASE_PROCEDURES } from '../../utils/caseConstants';

export interface NewCasePatientPayload {
  name: string;
  age: number;
  gender: string;
  procedure: string;
  procedureDescription: string;
  notes: string;
}

interface NewCasePatientFormProps {
  clientName: string;
  onCancel: () => void;
  onSubmit: (payload: NewCasePatientPayload) => Promise<void>;
}

const NewCasePatientForm: React.FC<NewCasePatientFormProps> = ({ clientName, onCancel, onSubmit }) => {
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: CASE_GENDERS[0],
    procedure: CASE_PROCEDURES[0],
    procedureDescription: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const age = Number(formData.age);
    if (!Number.isFinite(age) || age <= 0) {
      setError('Informe uma idade valida.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        ...formData,
        name: formData.name.trim(),
        age,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel criar o paciente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <button type="button" onClick={onCancel} className="mb-6 text-sm font-semibold text-slate-500 hover:text-slate-950">
        Voltar
      </button>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
        <div className="border-b border-slate-200 p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-600">{clientName}</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Novo paciente</h1>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Nome do paciente</span>
            <input
              required
              value={formData.name}
              onChange={event => setFormData(prev => ({ ...prev, name: event.target.value }))}
              className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 outline-none focus:border-sky-400"
            />
          </label>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label>
              <span className="text-sm font-semibold text-slate-700">Idade</span>
              <input
                required
                min="1"
                type="number"
                value={formData.age}
                onChange={event => setFormData(prev => ({ ...prev, age: event.target.value }))}
                className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 outline-none focus:border-sky-400"
              />
            </label>

            <label>
              <span className="text-sm font-semibold text-slate-700">Genero</span>
              <select
                value={formData.gender}
                onChange={event => setFormData(prev => ({ ...prev, gender: event.target.value }))}
                className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 outline-none focus:border-sky-400"
              >
                {CASE_GENDERS.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>

            <label>
              <span className="text-sm font-semibold text-slate-700">Procedimento</span>
              <select
                value={formData.procedure}
                onChange={event => setFormData(prev => ({ ...prev, procedure: event.target.value }))}
                className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 outline-none focus:border-sky-400"
              >
                {CASE_PROCEDURES.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Descricao do procedimento</span>
            <textarea
              rows={3}
              value={formData.procedureDescription}
              onChange={event => setFormData(prev => ({ ...prev, procedureDescription: event.target.value }))}
              className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 outline-none focus:border-sky-400"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Observacoes do caso</span>
            <textarea
              rows={3}
              value={formData.notes}
              onChange={event => setFormData(prev => ({ ...prev, notes: event.target.value }))}
              className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 outline-none focus:border-sky-400"
            />
          </label>

          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}

          <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
            <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" disabled={isSubmitting} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60">
              {isSubmitting ? 'Criando...' : 'Criar paciente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewCasePatientForm;
