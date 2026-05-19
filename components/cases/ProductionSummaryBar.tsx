import React from 'react';
import { ProductionSummary } from './caseUiUtils';

interface ProductionSummaryBarProps {
  summary: ProductionSummary;
  activeFilter: string | null;
  onFilter: (filter: string | null) => void;
}

const items = [
  {
    key: 'awaitingMaterial',
    label: 'Aguardando material',
    filterValue: 'awaiting',
    accentBg: 'bg-amber-50',
    accentText: 'text-amber-600',
    accentRing: 'ring-amber-200',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
        <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    key: 'readyToSend',
    label: 'Prontos para enviar',
    filterValue: 'ready',
    accentBg: 'bg-sky-50',
    accentText: 'text-sky-600',
    accentRing: 'ring-sky-200',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
        <path d="M3.105 3.105a1.5 1.5 0 0 1 1.62-.326l12 4.8a1.5 1.5 0 0 1 0 2.842l-12 4.8a1.5 1.5 0 0 1-2.036-1.77L3.75 10 2.69 6.55a1.5 1.5 0 0 1 .416-1.445Z" />
      </svg>
    ),
  },
  {
    key: 'inEditing',
    label: 'Em edição',
    filterValue: 'editing',
    accentBg: 'bg-rose-50',
    accentText: 'text-rose-600',
    accentRing: 'ring-rose-200',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
        <path d="M5.433 13.917l1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
      </svg>
    ),
  },
  {
    key: 'materialsReady',
    label: 'Materiais prontos',
    filterValue: 'materialsReady',
    accentBg: 'bg-emerald-50',
    accentText: 'text-emerald-600',
    accentRing: 'ring-emerald-200',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
        <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
      </svg>
    ),
  },
] as const;

const ProductionSummaryBar: React.FC<ProductionSummaryBarProps> = ({ summary, activeFilter, onFilter }) => {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map(item => {
        const count = summary[item.key as keyof ProductionSummary];
        const isActive = activeFilter === item.filterValue;

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onFilter(isActive ? null : item.filterValue)}
            className={`impact-soft-card group relative cursor-pointer overflow-hidden rounded-[1.4rem] p-4 text-left transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] sm:p-5 ${
              isActive
                ? `ring-2 ${item.accentRing} shadow-[0_22px_50px_rgba(22,78,129,0.18)]`
                : ''
            }`}
          >
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${item.accentBg} ${item.accentText}`}>
              {item.icon}
            </div>
            <p className={`text-3xl font-black tracking-tight ${isActive ? item.accentText : 'text-[#082653]'} transition-colors`}>
              {count}
            </p>
            <p className="mt-1 text-[11px] font-bold text-[#6d8db1]">{item.label}</p>
            {isActive && (
              <div className={`absolute inset-x-0 bottom-0 h-1 ${item.accentBg.replace('50', '400')}`} />
            )}
          </button>
        );
      })}
    </div>
  );
};

export default ProductionSummaryBar;
