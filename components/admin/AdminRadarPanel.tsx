import React, { useCallback, useEffect, useState } from 'react';
import { AdminApiError } from '../../services/adminClientService';
import { AdminDashboardSummary, fetchAdminDashboard } from '../../services/adminPortalService';

interface AdminRadarPanelProps {
  password: string;
}

type HealthStatus = 'healthy' | 'attention' | 'critical';

const healthConfig: Record<HealthStatus, { label: string; emoji: string; className: string; barColor: string }> = {
  healthy: {
    label: 'Saudável',
    emoji: '🟢',
    className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    barColor: 'bg-emerald-400',
  },
  attention: {
    label: 'Atenção',
    emoji: '🟡',
    className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    barColor: 'bg-amber-400',
  },
  critical: {
    label: 'Crítico',
    emoji: '🔴',
    className: 'bg-red-50 text-red-700 ring-1 ring-red-200',
    barColor: 'bg-red-400',
  },
};

const formatDays = (days: number) => {
  if (days >= 999) return 'Sem atividade';
  if (days === 0) return 'Hoje';
  if (days === 1) return '1 dia atrás';
  return `${days} dias atrás`;
};

const AdminRadarPanel: React.FC<AdminRadarPanelProps> = ({ password }) => {
  const [dashboard, setDashboard] = useState<AdminDashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | HealthStatus>('all');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchAdminDashboard(password);
      setDashboard(data);
    } catch (err) {
      setError(err instanceof AdminApiError || err instanceof Error ? err.message : 'Falha ao carregar radar.');
    } finally {
      setIsLoading(false);
    }
  }, [password]);

  useEffect(() => { void load(); }, [load]);

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
        <button type="button" onClick={load} className="impact-secondary mt-5">Tentar novamente</button>
      </section>
    );
  }

  const clients = (dashboard?.clients || [])
    .filter(c => c.active)
    .filter(c => filter === 'all' || (c as any).healthStatus === filter)
    .sort((a, b) => {
      const order: Record<string, number> = { critical: 0, attention: 1, healthy: 2 };
      const healthA = (a as any).healthStatus || 'healthy';
      const healthB = (b as any).healthStatus || 'healthy';
      return (order[healthA] ?? 3) - (order[healthB] ?? 3);
    });

  const healthCounts = {
    all: (dashboard?.clients || []).filter(c => c.active).length,
    healthy: (dashboard?.clients || []).filter(c => c.active && (c as any).healthStatus === 'healthy').length,
    attention: (dashboard?.clients || []).filter(c => c.active && (c as any).healthStatus === 'attention').length,
    critical: (dashboard?.clients || []).filter(c => c.active && (c as any).healthStatus === 'critical').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#20a8f5]">Radar</p>
          <h2 className="mt-1 text-3xl font-black tracking-tight text-[#082653]">Saúde dos clientes</h2>
          <p className="mt-1 text-sm font-semibold text-[#6d8db1]">Visão operacional por clínica.</p>
        </div>
        <button type="button" onClick={load} disabled={isLoading} className="impact-secondary">
          {isLoading ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      {/* Health filter chips */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'critical', 'attention', 'healthy'] as const).map(key => {
          const label = key === 'all' ? 'Todos' : healthConfig[key].label;
          const count = healthCounts[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black transition-all ${
                filter === key
                  ? 'bg-[#20a8f5] text-white shadow-[0_8px_20px_rgba(32,168,245,0.3)]'
                  : 'bg-white/70 text-[#5d7ca4] ring-1 ring-white/80 hover:bg-white'
              }`}
            >
              {key !== 'all' && <span>{healthConfig[key].emoji}</span>}
              {label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                filter === key ? 'bg-white/20' : 'bg-[#e8f6ff] text-[#20a8f5]'
              }`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Client cards */}
      <div className="grid gap-4 lg:grid-cols-2">
        {clients.length === 0 ? (
          <div className="col-span-2 impact-glass rounded-[2rem] border-dashed p-10 text-center">
            <p className="text-lg font-black text-[#082653]">Nenhum cliente neste filtro</p>
          </div>
        ) : (
          clients.map(client => {
            const health = (client as any).healthStatus as HealthStatus || 'healthy';
            const cfg = healthConfig[health];
            const days = (client as any).daysSinceLastUpdate ?? 999;
            const stagesTotal = (client as any).stagesTotalCount || 0;
            const stagesWithFiles = (client as any).stagesWithFilesCount || 0;
            const fillPct = stagesTotal > 0 ? Math.round((stagesWithFiles / stagesTotal) * 100) : 0;

            return (
              <div key={client.id} className="impact-soft-card rounded-[1.7rem] p-5 sm:p-6">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-black text-[#082653]">{client.name}</h3>
                    <p className="mt-0.5 text-xs font-bold text-[#6d8db1]">
                      Última atividade: {formatDays(days)}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black ${cfg.className}`}>
                    {cfg.emoji} {cfg.label}
                  </span>
                </div>

                {/* Stats grid */}
                <div className="mt-4 grid grid-cols-4 gap-2">
                  <div className="rounded-xl bg-white/70 p-2.5 text-center">
                    <p className="text-lg font-black text-[#082653]">{client.patientsCount}</p>
                    <p className="text-[9px] font-black uppercase tracking-wider text-[#6d8db1]">Pacientes</p>
                  </div>
                  <div className="rounded-xl bg-white/70 p-2.5 text-center">
                    <p className="text-lg font-black text-sky-600">{stagesWithFiles}</p>
                    <p className="text-[9px] font-black uppercase tracking-wider text-[#6d8db1]">C/ material</p>
                  </div>
                  <div className="rounded-xl bg-white/70 p-2.5 text-center">
                    <p className="text-lg font-black text-amber-600">{client.editingPendingCount}</p>
                    <p className="text-[9px] font-black uppercase tracking-wider text-[#6d8db1]">Em edição</p>
                  </div>
                  <div className="rounded-xl bg-white/70 p-2.5 text-center">
                    <p className="text-lg font-black text-emerald-600">{client.editedReadyCount}</p>
                    <p className="text-[9px] font-black uppercase tracking-wider text-[#6d8db1]">Prontos</p>
                  </div>
                </div>

                {/* Fill rate bar */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[10px] font-black text-[#6d8db1]">
                    <span>Preenchimento de etapas</span>
                    <span>{fillPct}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/80">
                    <div className={`h-full rounded-full ${cfg.barColor} transition-all duration-500`} style={{ width: `${fillPct}%` }} />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AdminRadarPanel;
