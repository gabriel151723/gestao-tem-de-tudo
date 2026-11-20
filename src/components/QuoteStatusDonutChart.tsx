import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import { PieChart as PieChartIcon } from 'lucide-react';
import {
  Order,
  SolicitacaoOrcamento,
  QuoteStatusSlice,
  QuoteStatusKey,
  calculateQuoteStatusDistribution,
} from '../erp/erpLogic';

interface QuoteStatusDonutChartProps {
  orders: Order[];
  solicitacoes: SolicitacaoOrcamento[];
  onSelectStatus?: (statusKey: QuoteStatusKey, source: 'all' | 'orders' | 'mural') => void;
}

export const QuoteStatusDonutChart: React.FC<QuoteStatusDonutChartProps> = ({
  orders,
  solicitacoes,
  onSelectStatus,
}) => {
  const [sourceFilter, setSourceFilter] = useState<'all' | 'orders' | 'mural'>('all');

  const distribution = useMemo(
    () => calculateQuoteStatusDistribution(orders, solicitacoes, sourceFilter),
    [orders, solicitacoes, sourceFilter]
  );

  const chartData = useMemo(() => {
    if (distribution.totalActiveQuotes === 0) {
      return [
        {
          key: 'pendente' as QuoteStatusKey,
          label: 'Sem registros',
          fullStatusLabel: 'Nenhum orçamento ativo',
          count: 1,
          percentage: 0,
          color: '#1E293B',
          isEmptyPlaceholder: true,
        },
      ];
    }
    return distribution.slices.map((s) => ({
      ...s,
      isEmptyPlaceholder: false,
    }));
  }, [distribution]);

  return (
    <div
      className="bg-[#111827] border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4 h-full"
      data-testid="quote-status-donut-chart"
    >
      {/* Cabeçalho do Card */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-orange-400 shrink-0" />
            <h3 className="text-base font-bold text-white">
              Distribuição de Orçamentos por Status
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Proporção em tempo real entre Pendente, Respondido e Fechado
          </p>
        </div>

        {/* Seletor de Origem em Tempo Real */}
        <div
          className="inline-flex items-center bg-[#0B0F17] border border-slate-800 rounded-lg p-0.5 text-[11px]"
          role="group"
          aria-label="Fonte dos dados do gráfico de rosca"
        >
          <button
            type="button"
            onClick={() => setSourceFilter('all')}
            data-testid="donut-source-all"
            className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
              sourceFilter === 'all'
                ? 'bg-orange-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Consolidado
          </button>
          <button
            type="button"
            onClick={() => setSourceFilter('mural')}
            data-testid="donut-source-mural"
            className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
              sourceFilter === 'mural'
                ? 'bg-orange-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Mural
          </button>
          <button
            type="button"
            onClick={() => setSourceFilter('orders')}
            data-testid="donut-source-orders"
            className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
              sourceFilter === 'orders'
                ? 'bg-orange-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Central
          </button>
        </div>
      </div>

      {/* Área do Gráfico de Rosca + Resumo Lateral */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center my-auto">
        {/* Gráfico Recharts (6 cols em telas sm+) */}
        <div className="sm:col-span-6 relative h-52 w-full flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0B0F17',
                  borderColor: '#334155',
                  borderRadius: '0.5rem',
                  color: '#F8FAFC',
                  fontSize: '12px',
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                }}
                itemStyle={{ color: '#F8FAFC' }}
                formatter={(value, _name, itemPayload) => {
                  const payloadObj = itemPayload?.payload as
                    | (QuoteStatusSlice & { isEmptyPlaceholder?: boolean })
                    | undefined;
                  if (payloadObj?.isEmptyPlaceholder) {
                    return ['0 orçamentos (0%)', 'Sem registros'];
                  }
                  const safeVal = Number(value ?? 0);
                  const pct = payloadObj?.percentage ?? 0;
                  return [
                    `${safeVal} ${safeVal === 1 ? 'orçamento' : 'orçamentos'} (${pct}%)`,
                    payloadObj?.label || 'Status',
                  ];
                }}
              />
              <Pie
                data={chartData}
                dataKey="count"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={56}
                outerRadius={80}
                paddingAngle={distribution.totalActiveQuotes > 0 ? 4 : 0}
                stroke="#111827"
                strokeWidth={2}
                onClick={(entry) => {
                  const payload = entry as unknown as QuoteStatusSlice & {
                    isEmptyPlaceholder?: boolean;
                  };
                  if (!payload?.isEmptyPlaceholder && payload?.key && onSelectStatus) {
                    onSelectStatus(payload.key, sourceFilter);
                  }
                }}
                className="cursor-pointer focus:outline-none"
              >
                {chartData.map((entry) => (
                  <Cell
                    key={`donut-cell-${entry.key}`}
                    fill={entry.color}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* Indicador Central da Rosca */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span
              className="text-2xl font-bold font-mono text-white tabular-nums leading-none"
              data-testid="donut-total-count"
            >
              {distribution.totalActiveQuotes}
            </span>
            <span className="text-[11px] font-medium text-slate-400 mt-1">
              {distribution.totalActiveQuotes === 1 ? 'orçamento' : 'orçamentos'}
            </span>
          </div>
        </div>

        {/* Legenda Interativa de Status (6 cols em telas sm+) */}
        <div className="sm:col-span-6 space-y-2.5">
          {distribution.slices.map((slice) => (
            <button
              key={slice.key}
              type="button"
              onClick={() => onSelectStatus?.(slice.key, sourceFilter)}
              data-testid={`donut-status-${slice.key}`}
              className="w-full text-left px-3 py-2.5 rounded-lg bg-[#0B0F17] hover:bg-slate-800/70 border border-slate-800/90 hover:border-slate-700 transition-colors flex items-center justify-between gap-2 cursor-pointer group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-3 h-3 rounded-xs shrink-0"
                  style={{ backgroundColor: slice.color }}
                />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-200 group-hover:text-white whitespace-nowrap">
                    {slice.label}
                  </p>
                  <p className="text-[11px] font-mono text-slate-400 tabular-nums whitespace-nowrap">
                    {slice.percentage}% do total
                  </p>
                </div>
              </div>

              <span className="text-sm font-bold font-mono text-white tabular-nums shrink-0 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                {slice.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Rodapé Explicativo */}
      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2 text-[11px] text-slate-400">
        <span>Atualização automática em tempo real</span>
        <span className="font-mono text-slate-300 tabular-nums">
          {distribution.pendenteCount} pend. &middot; {distribution.respondidoCount} resp. &middot;{' '}
          {distribution.fechadoCount} fech.
        </span>
      </div>
    </div>
  );
};
