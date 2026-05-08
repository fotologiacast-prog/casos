import React, { useState } from 'react';
import { CASE_GENDERS, CASE_PROCEDURES } from '../../utils/caseConstants';

export interface NewCasePatientPayload {
  name: string;
  birthDate: string;
  gender: string;
  procedure: string;
  dentistResponsible: string;
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
    birthDate: '',
    gender: CASE_GENDERS[0],
    procedures: [CASE_PROCEDURES[0]],
    dentistResponsible: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setFormData(prev => ({ ...prev, [key]: e.target.value }));

  const toggleProcedure = (procedure: string) => {
    setFormData(prev => {
      const selected = prev.procedures.includes(procedure)
        ? prev.procedures.filter(item => item !== procedure)
        : [...prev.procedures, procedure];
      return { ...prev, procedures: selected };
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!formData.birthDate) {
      setError('Informe a data de nascimento.');
      return;
    }
    if (formData.procedures.length === 0) {
      setError('Selecione pelo menos um procedimento.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit({
        name: formData.name.trim(),
        birthDate: formData.birthDate,
        gender: formData.gender,
        procedure: formData.procedures.join(', '),
        dentistResponsible: formData.dentistResponsible.trim(),
        notes: formData.notes.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar o paciente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = 'mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 transition-all placeholder:text-zinc-400';
  const labelClass = 'text-[11px] font-bold uppercase tracking-widest text-zinc-500';

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <button
        type="button"
        onClick={onCancel}
        className="mb-5 inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 shadow-sm hover:border-zinc-400 hover:bg-zinc-50 transition-all active:scale-95"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M7.793 14.707a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 0-1.414l4-4a1 1 0 1 1 1.414 1.414L5.5 9H17a1 1 0 1 1 0 2H5.5l2.293 2.293a1 1 0 0 1 0 1.414Z" clipRule="evenodd" />
        </svg>
        Voltar
      </button>

      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        {/* Header */}
        <div className="h-1.5 bg-black" />
        <div className="border-b border-zinc-100 px-6 py-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">{clientName}</p>
          <h1 className="mt-1.5 text-2xl font-bold text-zinc-900">Novo paciente</h1>
          <p className="mt-1 text-sm text-zinc-500">Preencha os dados para cadastrar o caso clínico.</p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
          {/* Name */}
          <div>
            <label className={labelClass}>Nome do paciente *</label>
            <input
              required
              value={formData.name}
              onChange={set('name')}
              placeholder="Ex: Maria da Silva"
              className={inputClass}
            />
          </div>

          {/* Birth date + Gender */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Data de nascimento *</label>
              <input
                required
                type="date"
                value={formData.birthDate}
                onChange={set('birthDate')}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Sexo</label>
              <select
                value={formData.gender}
                onChange={set('gender')}
                className={inputClass}
              >
                {CASE_GENDERS.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Procedimentos</label>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CASE_PROCEDURES.map(option => {
                const checked = formData.procedures.includes(option);
                return (
                  <label
                    key={option}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all ${
                      checked
                        ? 'border-zinc-900 bg-zinc-900 text-white shadow-sm'
                        : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleProcedure(option)}
                      className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                    />
                    <span>{option}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className={labelClass}>Dentista responsável</label>
            <input
              value={formData.dentistResponsible}
              onChange={set('dentistResponsible')}
              placeholder="Ex: Dra. Ana Silva"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Observação</label>
            <textarea
              rows={4}
              value={formData.notes}
              onChange={set('notes')}
              placeholder="Observações internas sobre o caso. Vai para o balão do Monday."
              className={`${inputClass} resize-y`}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-red-500">
                <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
              </svg>
              <p className="text-sm font-medium text-red-700">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col-reverse gap-3 border-t border-zinc-100 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-black px-6 py-3 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition-all active:scale-95"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Criando...
                </span>
              ) : (
                'Criar paciente'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewCasePatientForm;
