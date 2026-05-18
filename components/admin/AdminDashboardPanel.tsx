import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdminApiError } from '../../services/adminClientService';
import { AdminDashboardSummary, fetchAdminDashboard } from '../../services/adminPortalService';

interface AdminDashboardPanelProps {
  password: string;
}

const AUTO_REFRESH_MS = 5 * 60 * 1000; // 5 minutes

const formatPercent = (value: number, total: number) => {
  if (total <= 0) return '0%';
  return `${Math.round((value / total) * 100)}%`;
};

const formatTime = (date: Date) =>
  date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const StatCard: React.FC<{ label: string; value: number; detail: string; icon: React.ReactNode; accentClass: string }> = ({ label, value, detail, icon, accentClass }) => (
  <div className="impact-soft-card rounded-[1.7rem] p-5">
    <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${accentClass}`}>
      {icon}
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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(AUTO_REFRESH_MS / 1000);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    // Reset countdown
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);

    try {
      const data = await fetchAdminDashboard(password);
      setDashboard(data);
      setLastUpdated(new Date());
      setCountdown(AUTO_REFRESH_MS / 1000);

      // Start countdown
      countdownRef.current = setInterval(() => {
        setCountdown(prev => Math.max(0, prev - 1));
      }, 1000);

      // Schedule next refresh
      timerRef.current = setTimeout(() => {
        void loadDashboard();
      }, AUTO_REFRESH_MS);

    } catch (err) {
      const message = err instanceof AdminApiError || err instanceof Error ? err.message : 'Falha ao carregar dashboard.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [password]);

  useEffect(() => {
    void loadDashboard();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [loadDashboard]);

  const topClients = useMemo(() => {
    return [...(dashboard?.clients || [])].sort((a, b) => b.patientsCount - a.patientsCount).slice(0, 8);
  }, [dashboard]);

  if (isLoading && !dashboard) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <div className="h-10 w-10 rounded-full border-[3px] border-[#d7ecfb] border-t-[#20a8f5] animate-spin" />
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <section className="impact-glass rounded-[2rem] p-8 text-center">
        <p className="text-sm font-black text-red-600">{error}</p>
        <p className="mx-auto mt-2 max-w-lg text-xs font-semibold text-[#6d8db1]">
          Se você ainda não rodou o SQL novo no Supabase, esta tela pode falhar porque depende das tabelas de edição e notificações.
        </p>
        <button type="button" onClick={loadDashboard} className="impact-secondary mt-5">
          Tentar novamente
        </button>
      </section>
    );
  }

  const totals = dashboard!.totals;

  const minutesLeft = Math.floor(countdown / 60);
  const secondsLeft = countdown % 60;
  const countdownLabel = minutesLeft > 0
    ? `${minutesLeft}m ${secondsLeft}s`
    : `${secondsLeft}s`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#20a8f5]">Dashboard</p>
          <h2 className="mt-1 text-3xl font-black tracking-tight text-[#082653]">Resumo dos clientes</h2>
          <p className="mt-1 text-sm font-semibold text-[#6d8db1]">Leitura consolidada a partir do Supabase.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={loadDashboard}
            disabled={isLoading}
            className="impact-secondary"
          >
            {isLoading ? (
              <span className="h-4 w-4 rounded-full border-2 border-[#6d8db1]/30 border-t-[#20a8f5] animate-spin" />
            ) : (
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466.75.75 0 0 0-1.061 1.061 7 7 0 0 0 11.797-3.138.75.75 0 0 0-1.535-.389ZM4.688 8.576a5.5 5.5 0 0 1 9.201-2.466.75.75 0 0 0 1.061-1.061A7 7 0 0 0 3.153 8.187a.75.75 0 1 0 1.535.389Z" clipRule="evenodd" />
              </svg>
            )}
            Atualizar
          </button>
          {lastUpdated && (
            <div className="flex items-center gap-3 text-[11px] font-bold text-[#6d8db1]">
              <span>Atualizado às {formatTime(lastUpdated)}</span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#20a8f5] animate-pulse" />
                próximo em {countdownLabel}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Error banner (non-fatal) */}
      {error && (
        <div className="flex items-center gap-3 rounded-2xl bg-red-50/80 border border-red-200/60 px-4 py-3">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-red-500">
            <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
          </svg>
          <p className="text-sm font-bold text-red-700">{error}</p>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Clientes ativos"
          value={totals.activeClients}
          detail={`${totals.clients} no total`}
          accentClass="bg-[#e8f6ff] text-[#20a8f5]"
          icon={
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
              <path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM1.49 15.326a.78.78 0 0 1-.358-.442 3 3 0 0 1 4.308-3.516 6.484 6.484 0 0 0-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 0 1-2.07-.655ZM16.44 15.98a4.97 4.97 0 0 0 2.07-.654.78.78 0 0 0 .357-.442 3 3 0 0 0-4.308-3.517 6.484 6.484 0 0 1 1.907 3.96 2.32 2.32 0 0 1-.026.654ZM18 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM5.304 16.19a.844.844 0 0 1-.277-.71 5 5 0 0 1 9.947 0 .843.843 0 0 1-.277.71A6.975 6.975 0 0 1 10 17a6.974 6.974 0 0 1-4.696-1.81Z" />
            </svg>
          }
        />
        <StatCard
          label="Pacientes"
          value={totals.patients}
          detail="Casos cadastrados"
          accentClass="bg-emerald-50 text-emerald-600"
          icon={
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
              <path d="M9 6a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" />
            </svg>
          }
        />
        <StatCard
          label="Para edição"
          value={totals.editingPending}
          detail={`${totals.editingSent} pedidos enviados`}
          accentClass="bg-amber-50 text-amber-600"
          icon={
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
              <path d="M5.433 13.917l1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
              <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
            </svg>
          }
        />
        <StatCard
          label="Materiais prontos"
          value={totals.editedReady}
          detail={`${formatPercent(totals.editedReady, totals.editingSent)} dos pedidos`}
          accentClass="bg-sky-50 text-sky-600"
          icon={
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
            </svg>
          }
        />
      </div>

      {/* Client table */}
      <section className="impact-glass overflow-hidden rounded-[2rem]">
        <div className="border-b border-white/70 px-5 py-4 sm:px-6 flex items-center justify-between">
          <h3 className="text-lg font-black text-[#082653]">Clientes e produção</h3>
          <span className="rounded-2xl bg-[#e8f6ff] px-3 py-1 text-xs font-black text-[#20a8f5]">
            {topClients.length} clientes
          </span>
        </div>
        <div className="divide-y divide-[#dcecf8]">
          {topClients.length === 0 ? (
            <div className="p-8 text-center text-sm font-bold text-[#6d8db1]">Nenhum cliente com dados ainda.</div>
          ) : (
            topClients.map(client => {
              const progress = client.editingSentCount > 0 ? (client.editedReadyCount / client.editingSentCount) * 100 : 0;
              const completionPct = client.editingSentCount > 0
                ? `${Math.round(progress)}% concluído`
                : 'sem pedidos';
              return (
                <div key={client.id} className="grid gap-4 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center sm:px-6">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-base font-black text-[#082653]">{client.name}</p>
                      {!client.active && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-black text-zinc-500">Inativo</span>}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/80">
                        <div className="h-full rounded-full bg-[#20a8f5] transition-all duration-500" style={{ width: `${Math.min(100, progress)}%` }} />
                      </div>
                      <span className="text-[10px] font-black text-[#6d8db1] whitespace-nowrap">{completionPct}</span>
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
