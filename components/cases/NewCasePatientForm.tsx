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
  initialData?: NewCasePatientPayload;
  isEditing?: boolean;
}

const NewCasePatientForm: React.FC<NewCasePatientFormProps> = ({
  clientName,
  onCancel,
  onSubmit,
  initialData,
  isEditing = false,
}) => {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    birthDate: initialData?.birthDate || '',
    gender: initialData?.gender || CASE_GENDERS[0],
    procedures: initialData?.procedure
      ? initialData.procedure.split(',').map(s => s.trim())
      : [CASE_PROCEDURES[0]],
    dentistResponsible: initialData?.dentistResponsible || '',
    notes: initialData?.notes || '',
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

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <button
        type="button"
        onClick={onCancel}
        className="impact-secondary mb-6 gap-2"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M7.793 14.707a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 0-1.414l4-4a1 1 0 1 1 1.414 1.414L5.5 9H17a1 1 0 1 1 0 2H5.5l2.293 2.293a1 1 0 0 1 0 1.414Z" clipRule="evenodd" />
        </svg>
        Voltar
      </button>

      <div className="impact-glass rounded-[2rem] overflow-hidden">
        {/* Header bar */}
        <div className="h-1.5 bg-[#20a8f5]" />

        <div className="border-b border-white/70 px-6 py-6">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#20a8f5]">{clientName}</p>
          <h1 className="mt-1.5 text-3xl font-black tracking-tight text-[#082653]">
            {isEditing ? 'Editar paciente' : 'Novo paciente'}
          </h1>
          <p className="mt-1 text-sm font-semibold text-[#6d8db1]">
            {isEditing
              ? 'Edite os dados abaixo e salve as alterações.'
              : 'Preencha os dados para cadastrar o caso clínico.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
          {/* Name */}
          <div>
            <label htmlFor="patient-name" className="section-label block mb-1.5">Nome do paciente *</label>
            <input
              id="patient-name"
              name="patient-name"
              required
              value={formData.name}
              onChange={set('name')}
              autoComplete="name"
              placeholder="Ex: Maria da Silva..."
              className="input-field"
            />
          </div>

          {/* Birth date + Gender */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="patient-birth-date" className="section-label block mb-1.5">Data de nascimento</label>
              <input
                id="patient-birth-date"
                name="patient-birth-date"
                type="date"
                value={formData.birthDate}
                onChange={set('birthDate')}
                autoComplete="bday"
                className="input-field"
              />
            </div>
            <div>
              <label htmlFor="patient-gender" className="section-label block mb-1.5">Sexo</label>
              <select
                id="patient-gender"
                name="patient-gender"
                value={formData.gender}
                onChange={set('gender')}
                autoComplete="off"
                className="select-field"
              >
                {CASE_GENDERS.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
          </div>

          {/* Procedures */}
          <div>
            <label className="section-label block mb-2">Procedimentos</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CASE_PROCEDURES.map(option => {
                const checked = formData.procedures.includes(option);
                return (
                  <label
                    key={option}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 text-sm font-bold transition-all ${
                      checked
                        ? 'border-[#20a8f5] bg-[#20a8f5] text-white shadow-[0_8px_20px_rgba(32,168,245,0.28)]'
                        : 'border-white/70 bg-white/60 text-[#174579] hover:border-[#20a8f5]/40 hover:bg-white/80'
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="patient-procedures"
                      checked={checked}
                      onChange={() => toggleProcedure(option)}
                      className="sr-only"
                    />
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
                      checked ? 'border-white bg-white/20' : 'border-[#6d8db1]'
                    }`}>
                      {checked && (
                        <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3">
                          <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    <span>{option}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Dentist */}
          <div>
            <label htmlFor="dentist-responsible" className="section-label block mb-1.5">Dentista responsável</label>
            <input
              id="dentist-responsible"
              name="dentist-responsible"
              value={formData.dentistResponsible}
              onChange={set('dentistResponsible')}
              autoComplete="off"
              placeholder="Ex: Dra. Ana Silva..."
              className="input-field"
            />
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="case-notes" className="section-label block mb-1.5">Observação</label>
            <textarea
              id="case-notes"
              name="case-notes"
              rows={4}
              value={formData.notes}
              onChange={set('notes')}
              autoComplete="off"
              placeholder="Observações internas sobre o caso. Vai para o balão do Monday..."
              className="input-field resize-y"
            />
          </div>

          {error && (
            <div className="flex items-center gap-3 rounded-2xl bg-red-50/80 border border-red-200/60 px-4 py-3">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0 text-red-500">
                <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
              </svg>
              <p className="text-sm font-bold text-red-700">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col-reverse gap-3 border-t border-white/70 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="impact-secondary"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="impact-primary"
            >
              {isSubmitting ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  {isEditing ? 'Salvando...' : 'Criando...'}
                </>
              ) : (
                isEditing ? 'Salvar alterações' : 'Criar paciente'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewCasePatientForm;
