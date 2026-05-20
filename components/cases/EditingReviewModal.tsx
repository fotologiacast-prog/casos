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
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain p-4 animate-fade-in"
      style={{ backgroundColor: 'rgba(8, 38, 83, 0.55)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Revisar pedido de edição"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-[2rem] shadow-[0_32px_80px_rgba(8,38,83,0.30)]"
        style={{ backgroundColor: '#ffffff' }}
      >
        {/* Top accent bar */}
        <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, #ef4444 0%, #f97316 100%)' }} />

        {/* Header */}
        <div className="px-7 pt-6 pb-5" style={{ borderBottom: '1px solid #f0f4f9' }}>
          <p
            className="text-[10px] font-black uppercase tracking-[0.22em]"
            style={{ color: '#ef4444' }}
          >
            Revisão do pedido
          </p>
          <h2
            className="mt-1.5 text-2xl font-black tracking-tight"
            style={{ color: '#082653' }}
          >
            Confirmar envio para edição
          </h2>
        </div>

        {/* Body */}
        <div className="px-7 py-6 space-y-6">

          {/* Patient */}
          <div
            className="flex items-center gap-3 rounded-2xl px-4 py-3"
            style={{ backgroundColor: '#f5fbff', border: '1px solid #deeefb' }}
          >
            <div
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: '#deeefb' }}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" style={{ color: '#20a8f5' }}>
                <path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1.23 1.23 0 0 0 .41 1.412A9.957 9.957 0 0 0 10 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 0 0-13.074.003Z" />
              </svg>
            </div>
            <div>
              <p
                className="text-[10px] font-black uppercase tracking-wider"
                style={{ color: '#20a8f5' }}
              >
                Paciente
              </p>
              <p className="text-base font-black" style={{ color: '#082653' }}>
                {patient.name}
              </p>
            </div>
          </div>

          {/* Materials */}
          <div>
            <p
              className="mb-2.5 text-[10px] font-black uppercase tracking-wider"
              style={{ color: '#5d7ca4' }}
            >
              Materiais incluídos
            </p>
            <div className="space-y-2">
              {stages.map(stage => (
                <div
                  key={stage.id}
                  className="flex items-center gap-3 rounded-xl px-4 py-3"
                  style={{ backgroundColor: '#f8fafd', border: '1px solid #e4edf7' }}
                >
                  <span
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: '#dcfce7' }}
                  >
                    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5" style={{ color: '#15803d' }}>
                      <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold" style={{ color: '#082653' }}>
                      {stage.title}
                    </p>
                    <p className="text-[11px] font-semibold" style={{ color: '#5d7ca4' }}>
                      {stage.files.length} arquivo{stage.files.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <span
                    className="flex-shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-black"
                    style={{ backgroundColor: '#e8f6ff', color: '#20a8f5' }}
                  >
                    {stage.moment}
                  </span>
                </div>
              ))}
              {stages.length === 0 && (
                <p className="text-sm font-semibold italic" style={{ color: '#5d7ca4' }}>
                  Nenhum material disponível para envio.
                </p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label
              htmlFor="editing-notes"
              className="mb-2 block text-[10px] font-black uppercase tracking-wider"
              style={{ color: '#5d7ca4' }}
            >
              Observação para a agência (opcional)
            </label>
            <textarea
              id="editing-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Instruções especiais, prioridade, detalhes sobre o conteúdo..."
              className="w-full resize-y rounded-2xl px-4 py-3 text-sm transition-all duration-200 focus:outline-none"
              style={{
                backgroundColor: '#f8fafd',
                border: '1.5px solid #d6e4f0',
                color: '#082653',
                lineHeight: '1.6',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#20a8f5'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(32,168,245,0.12)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#d6e4f0'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex flex-col-reverse gap-3 px-7 py-5 sm:flex-row sm:justify-end"
          style={{ borderTop: '1px solid #f0f4f9' }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-6 text-sm font-black transition-all active:scale-95 disabled:opacity-50"
            style={{
              backgroundColor: '#f0f6fc',
              color: '#082653',
              border: '1.5px solid #d6e4f0',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#e4edf7'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#f0f6fc'; }}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={() => onConfirm(notes)}
            disabled={isSubmitting || stages.length === 0}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-6 text-sm font-black text-white transition-all active:scale-95 disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
              boxShadow: '0 10px 28px rgba(239,68,68,0.30)',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.92'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
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
