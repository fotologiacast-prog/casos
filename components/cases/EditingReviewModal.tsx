import React, { useState } from 'react';
import { CasePatient, CaseStage } from '../../types';

interface EditingReviewModalProps {
  patient: CasePatient;
  stages: CaseStage[];
  onConfirm: (notes: string) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

const EditingReviewModal: React.FC<EditingReviewModalProps> = ({
  patient,
  stages,
  onConfirm,
  onCancel,
  isSubmitting,
}) => {
  const [notes, setNotes] = useState('');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-black/45 p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Revisar pedido de edição"
    >
      <div className="w-full max-w-lg impact-glass rounded-[2rem] overflow-hidden shadow-[0_32px_80px_rgba(22,78,129,0.25)]">
        {/* Header */}
        <div className="h-1.5 bg-rose-500" />
        <div className="border-b border-white/70 px-6 py-5">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-rose-500">Revisão do pedido</p>
          <h2 className="mt-1.5 text-2xl font-black tracking-tight text-[#082653]">Confirmar envio para edição</h2>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Patient name */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#e8f6ff]">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-[#20a8f5]">
                <path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1.23 1.23 0 0 0 .41 1.412A9.957 9.957 0 0 0 10 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 0 0-13.074.003Z" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-[#6d8db1]">Paciente</p>
              <p className="text-lg font-black text-[#082653]">{patient.name}</p>
            </div>
          </div>

          {/* Materials included */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-[#6d8db1] mb-2">Materiais incluídos</p>
            <div className="space-y-2">
              {stages.map(stage => (
                <div
                  key={stage.id}
                  className="flex items-center gap-3 rounded-xl bg-white/60 px-4 py-2.5 ring-1 ring-white/80"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100">
                    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 text-emerald-700">
                      <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#082653]">{stage.title}</p>
                    <p className="text-[11px] font-semibold text-[#6d8db1]">{stage.files.length} arquivo{stage.files.length !== 1 ? 's' : ''}</p>
                  </div>
                  <span className="rounded-full bg-[#e8f6ff] px-2 py-0.5 text-[10px] font-black text-[#20a8f5]">{stage.moment}</span>
                </div>
              ))}
              {stages.length === 0 && (
                <p className="text-sm font-semibold text-[#6d8db1] italic">Nenhum material disponível para envio.</p>
              )}
            </div>
          </div>

          {/* Notes for agency */}
          <div>
            <label htmlFor="editing-notes" className="text-[10px] font-black uppercase tracking-wider text-[#6d8db1] block mb-1.5">
              Observação para a agência (opcional)
            </label>
            <textarea
              id="editing-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Instruções especiais, prioridade, detalhes sobre o conteúdo..."
              className="input-field resize-y text-sm"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse gap-3 border-t border-white/70 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="impact-secondary"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(notes)}
            disabled={isSubmitting || stages.length === 0}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-rose-500 px-5 text-sm font-black text-white shadow-[0_14px_30px_rgba(244,63,94,0.28)] transition-all hover:bg-rose-600 active:scale-95 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path d="M3.105 3.105a1.5 1.5 0 0 1 1.62-.326l12 4.8a1.5 1.5 0 0 1 0 2.842l-12 4.8a1.5 1.5 0 0 1-2.036-1.77L3.75 10 2.69 6.55a1.5 1.5 0 0 1 .416-1.445Z" />
                </svg>
                Confirmar envio para edição
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditingReviewModal;
