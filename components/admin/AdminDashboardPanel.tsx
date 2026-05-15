import React, { useEffect, useMemo, useState } from 'react';
import { AdminApiError } from '../../services/adminClientService';
import { AdminDashboardSummary, fetchAdminDashboard } from '../../services/adminPortalService';

interface AdminDashboardPanelProps {
  password: string;
}

const formatPercent = (value: number, total: number) => {
  if (total <= 0) return '0%';
  return `${Math.round((value / total) * 100)}%`;
};

const StatCard: React.FC<{ label: string; value: number; detail: string; tone: string }> = ({ label, value, detail, tone }) => (
  <div className="impact-soft-card rounded-[1.7rem] p-5">
    <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${tone}`}>
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
        <path d="M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15ZM8.5 6.75a.75.75 0 0 1 1.5 0v2.5h2.5a.75.75 0 0 1 0 1.5H10v2.5a.75.75 0 0 1-1.5 0v-2.5H6a.75.75 0 0 1 0-1.5h2.5v-2.5Z" />
      </svg>
    </div>
    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6d8db1]">{label}</p>
    <p className="mt-2 text-4xl font-black tracking-tight text-[#082653]">{value}</p>
    <p className="mt-1 text-xs font-bold text-[#6d8db1]">{detail}</p>
  </div>
);

const AdminDashboardPanel: React.FC<AdminDashboardPanelProps> = ({ password }) => {
  const [dashboard, setDashboard] = useState<AdminDashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchAdminDashboard(password);
      setDashboard(data);
    } catch (err) {
      const message = err instanceof AdminApiError || err instanceof Error ? err.message : 'Falha ao carregar dashboard.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, [password]);

  const topClients = useMemo(() => {
    return [...(dashboard?.clients || [])].sort((a, b) => b.patientsCount - a.patientsCount).slice(0, 8);
  }, [dashboard]);

  if (isLoading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <div className="h-10 w-10 rounded-full border-[3px] border-[#d7ecfb] border-t-[#20a8f5] animate-spin" />
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <section className="impact-glass rounded-[2rem] p-8 text-center">
        <p className="text-sm font-black text-red-600">{error || 'Dashboard indisponível.'}</p>
        <p className="mx-auto mt-2 max-w-lg text-xs font-semibold text-[#6d8db1]">
          Se você ainda não rodou o SQL novo no Supabase, esta tela pode falhar porque depende das tabelas de edição e notificações.
        </p>
        <button type="button" onClick={loadDashboard} className="impact-secondary mt-5">
          Atualizar
        </button>
      </section>
    );
  }

  const totals = dashboard.totals;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#20a8f5]">Dashboard</p>
          <h2 className="mt-1 text-3xl font-black tracking-tight text-[#082653]">Resumo dos clientes</h2>
          <p className="mt-1 text-sm font-semibold text-[#6d8db1]">Leitura consolidada a partir do Supabase.</p>
        </div>
        <button type="button" onClick={loadDashboard} className="impact-secondary">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466.75.75 0 0 0-1.061 1.061 7 7 0 0 0 11.797-3.138.75.75 0 0 0-1.535-.389ZM4.688 8.576a5.5 5.5 0 0 1 9.201-2.466.75.75 0 0 0 1.061-1.061A7 7 0 0 0 3.153 8.187a.75.75 0 1 0 1.535.389Z" clipRule="evenodd" />
          </svg>
          Atualizar
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Clientes ativos" value={totals.activeClients} detail={`${totals.clients} no total`} tone="bg-[#e8f6ff] text-[#20a8f5]" />
        <StatCard label="Pacientes" value={totals.patients} detail="Casos cadastrados" tone="bg-emerald-50 text-emerald-600" />
        <StatCard label="Para edição" value={totals.editingPending} detail={`${totals.editingSent} pedidos enviados`} tone="bg-amber-50 text-amber-600" />
        <StatCard label="Materiais prontos" value={totals.editedReady} detail={`${formatPercent(totals.editedReady, totals.editingSent)} dos pedidos`} tone="bg-sky-50 text-sky-600" />
      </div>

      <section className="impact-glass overflow-hidden rounded-[2rem]">
        <div className="border-b border-white/70 px-5 py-4 sm:px-6">
          <h3 className="text-lg font-black text-[#082653]">Clientes e produção</h3>
        </div>
        <div className="divide-y divide-[#dcecf8]">
          {topClients.length === 0 ? (
            <div className="p-8 text-center text-sm font-bold text-[#6d8db1]">Nenhum cliente com dados ainda.</div>
          ) : (
            topClients.map(client => {
              const progress = client.editingSentCount > 0 ? (client.editedReadyCount / client.editingSentCount) * 100 : 0;
              return (
                <div key={client.id} className="grid gap-4 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center sm:px-6">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-base font-black text-[#082653]">{client.name}</p>
                      {!client.active && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-black text-zinc-500">Inativo</span>}
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/80">
                      <div className="h-full rounded-full bg-[#20a8f5]" style={{ width: `${Math.min(100, progress)}%` }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[22rem]">
                    <div className="rounded-2xl bg-white/70 px-3 py-2">
                      <p className="text-lg font-black text-[#082653]">{client.patientsCount}</p>
                      <p className="text-[10px] font-black uppercase tracking-wider text-[#6d8db1]">Pacientes</p>
                    </div>
                    <div className="rounded-2xl bg-white/70 px-3 py-2">
                      <p className="text-lg font-black text-amber-600">{client.editingPendingCount}</p>
                      <p className="text-[10px] font-black uppercase tracking-wider text-[#6d8db1]">Em edição</p>
                    </div>
                    <div className="rounded-2xl bg-white/70 px-3 py-2">
                      <p className="text-lg font-black text-emerald-600">{client.editedReadyCount}</p>
                      <p className="text-[10px] font-black uppercase tracking-wider text-[#6d8db1]">Prontos</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
};

export default AdminDashboardPanel;
