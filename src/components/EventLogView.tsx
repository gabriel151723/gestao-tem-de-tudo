import React, { useState, useMemo, useEffect } from 'react';
import {
  History,
  Package,
  ClipboardList,
  Layers,
  Activity,
  Search,
  RotateCcw,
  ArrowRight,
  Clock,
  Sparkles,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';
import {
  EventCategory,
  SystemEvent,
  MAX_EVENT_LOG_ENTRIES,
  EVENT_LOG_PAGE_SIZE,
  pruneEventLog,
} from '../erp/erpLogic';

interface EventLogViewProps {
  events: SystemEvent[];
  onResetEvents: () => void;
  onPruneEvents?: () => number;
}

const EVENT_CATEGORIES: Array<'ALL' | EventCategory> = [
  'ALL',
  'Estoque',
  'Produtos',
  'Orçamentos',
  'Sistema',
];

export const EventLogView: React.FC<EventLogViewProps> = ({
  events,
  onResetEvents,
  onPruneEvents,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<
    'ALL' | EventCategory
  >('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [visibleLimit, setVisibleLimit] = useState<number>(EVENT_LOG_PAGE_SIZE);
  const [cleanupNotice, setCleanupNotice] = useState<string | null>(null);

  // Reinicia a janela de paginação ao alterar categoria ou busca
  useEffect(() => {
    setVisibleLimit(EVENT_LOG_PAGE_SIZE);
  }, [selectedCategory, searchQuery]);

  const filteredEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return events.filter((evt) => {
      const matchesCategory =
        selectedCategory === 'ALL' || evt.category === selectedCategory;
      const matchesSearch =
        !query ||
        evt.action.toLowerCase().includes(query) ||
        evt.description.toLowerCase().includes(query) ||
        (evt.reference && evt.reference.toLowerCase().includes(query)) ||
        (evt.delta && evt.delta.toLowerCase().includes(query));
      return matchesCategory && matchesSearch;
    });
  }, [events, selectedCategory, searchQuery]);

  const visibleEvents = useMemo(
    () => filteredEvents.slice(0, visibleLimit),
    [filteredEvents, visibleLimit]
  );

  const remainingEventsCount = Math.max(
    0,
    filteredEvents.length - visibleEvents.length
  );

  const storageStats = useMemo(() => {
    const { estimatedBytes, maxEntries } = pruneEventLog(
      events,
      MAX_EVENT_LOG_ENTRIES
    );
    const usagePercent = Math.min(
      100,
      Math.round((events.length / maxEntries) * 100)
    );
    const sizeKb = Math.max(0.1, Number((estimatedBytes / 1024).toFixed(1)));
    return {
      usagePercent,
      sizeKb,
      maxEntries,
    };
  }, [events]);

  const counts = useMemo(() => {
    return {
      total: events.length,
      estoque: events.filter((e) => e.category === 'Estoque').length,
      produtos: events.filter((e) => e.category === 'Produtos').length,
      orcamentos: events.filter((e) => e.category === 'Orçamentos').length,
      sistema: events.filter((e) => e.category === 'Sistema').length,
    };
  }, [events]);

  const handleRunManualOptimize = () => {
    const removed = onPruneEvents ? onPruneEvents() : 0;
    if (removed > 0) {
      setCleanupNotice(
        `Limpeza concluída: ${removed} registro(s) antigo(s) removido(s).`
      );
    } else {
      setCleanupNotice(
        `Armazenamento otimizado (${events.length}/${MAX_EVENT_LOG_ENTRIES} registros dentro do limite).`
      );
    }
    setTimeout(() => {
      setCleanupNotice(null);
    }, 4000);
  };

  const renderCategoryIndicator = (category: EventCategory) => {
    switch (category) {
      case 'Estoque':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-400">
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span>Estoque</span>
          </span>
        );
      case 'Produtos':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
            <Package className="w-3.5 h-3.5 shrink-0" />
            <span>Produtos</span>
          </span>
        );
      case 'Orçamentos':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-400">
            <ClipboardList className="w-3.5 h-3.5 shrink-0" />
            <span>Orçamentos</span>
          </span>
        );
      case 'Sistema':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300">
            <Activity className="w-3.5 h-3.5 shrink-0" />
            <span>Sistema</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-5" data-testid="event-log-view">
      {/* Resumo de Movimentações Registradas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-400 block">
              Total de Eventos no Histórico
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span
                className="text-2xl font-bold font-mono text-white tabular-nums"
                data-testid="event-log-total-count"
              >
                {counts.total}
              </span>
              <span className="text-xs font-mono text-slate-400 tabular-nums">
                / {MAX_EVENT_LOG_ENTRIES} máx.
              </span>
            </div>
          </div>
          <History className="w-5 h-5 text-orange-400 shrink-0" />
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-400 block">
              Alterações de Estoque
            </span>
            <span className="text-2xl font-bold font-mono text-orange-400 tabular-nums mt-1 block">
              {counts.estoque}
            </span>
          </div>
          <Layers className="w-5 h-5 text-orange-400 shrink-0" />
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-400 block">
              Cadastros &amp; Edições de Produtos
            </span>
            <span className="text-2xl font-bold font-mono text-emerald-400 tabular-nums mt-1 block">
              {counts.produtos}
            </span>
          </div>
          <Package className="w-5 h-5 text-emerald-400 shrink-0" />
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-400 block">
              Movimentações de Orçamentos
            </span>
            <span className="text-2xl font-bold font-mono text-sky-400 tabular-nums mt-1 block">
              {counts.orcamentos}
            </span>
          </div>
          <ClipboardList className="w-5 h-5 text-sky-400 shrink-0" />
        </div>
      </div>

      {/* Painel de Retenção Automática (500 registros) e Performance */}
      <div
        className="bg-[#111827] border border-slate-800 rounded-xl px-5 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4"
        data-testid="event-log-retention-banner"
      >
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-white">
                Rotina de Limpeza Automática Ativa
              </span>
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 rounded px-2 py-0.5 tabular-nums">
                Limite de {MAX_EVENT_LOG_ENTRIES} registros
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Mantém automaticamente apenas os últimos{' '}
              <strong className="text-slate-200 font-mono">
                {MAX_EVENT_LOG_ENTRIES}
              </strong>{' '}
              registros no armazenamento local (~{storageStats.sizeKb} KB em uso)
              e exibe os eventos em lotes de {EVENT_LOG_PAGE_SIZE} itens para
              máxima fluidez.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 bg-[#0B0F17] border border-slate-800 rounded-lg px-3 py-1.5">
            <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${Math.max(4, storageStats.usagePercent)}%` }}
              />
            </div>
            <span
              className="text-xs font-mono text-slate-300 tabular-nums"
              data-testid="event-log-capacity-indicator"
            >
              {events.length}/{MAX_EVENT_LOG_ENTRIES} ({storageStats.usagePercent}%)
            </span>
          </div>

          <button
            type="button"
            data-testid="optimize-event-log-btn"
            onClick={handleRunManualOptimize}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 hover:text-white transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Verificar &amp; Otimizar</span>
          </button>
        </div>
      </div>

      {cleanupNotice && (
        <div
          role="status"
          data-testid="event-log-cleanup-notice"
          className="bg-emerald-950/70 border border-emerald-500/40 rounded-xl px-4 py-2.5 text-xs font-medium text-emerald-200 flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{cleanupNotice}</span>
        </div>
      )}

      {/* Barra de Filtro e Busca Cronológica */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white">
              Log Cronológico de Eventos e Alterações do Sistema
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Monitoramento contínuo de ajustes de saldo em estoque, cadastro de novas peças e atualizações de status de orçamentos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-[#0B0F17] border border-slate-800 rounded-lg">
              {EVENT_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat;
                const label = cat === 'ALL' ? `Todos (${events.length})` : cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      isSelected
                        ? 'bg-orange-500 text-slate-950 font-bold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={onResetEvents}
              className="px-3 py-2 rounded-lg border border-slate-700 hover:border-slate-600 text-xs font-medium text-slate-300 hover:text-white transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar Histórico Padrão</span>
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="event-log-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrar eventos por código SKU, número do pedido (#PED-2026-...), ação ou descrição..."
            className="w-full bg-[#0B0F17] border border-slate-700 focus:border-orange-500 rounded-lg pl-10 pr-3.5 py-2 text-sm text-white placeholder-slate-500 outline-none transition-colors"
          />
        </div>
      </div>

      {/* Lista Cronológica de Eventos com Renderização Paginada para Alta Performance */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden">
        {filteredEvents.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <History className="w-8 h-8 text-slate-500 mx-auto" />
            <h4 className="text-sm font-bold text-white">
              Nenhum evento encontrado para este filtro
            </h4>
            <p className="text-xs text-slate-400">
              Altere a categoria selecionada ou limpe o campo de busca para visualizar todo o histórico operacional.
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-800/80">
              {visibleEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="p-4 sm:px-5 hover:bg-slate-800/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  data-testid="event-log-item"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5 text-xs">
                      <span className="inline-flex items-center gap-1 font-mono text-slate-400 tabular-nums">
                        <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                        <span>{evt.timestamp}</span>
                      </span>
                      <span className="text-slate-600" aria-hidden="true">
                        &middot;
                      </span>
                      {renderCategoryIndicator(evt.category)}
                      {evt.reference && (
                        <>
                          <span className="text-slate-600" aria-hidden="true">
                            &middot;
                          </span>
                          <span className="font-mono font-bold text-orange-400 tabular-nums">
                            {evt.reference}
                          </span>
                        </>
                      )}
                    </div>

                    <p className="text-sm font-bold text-white">{evt.action}</p>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {evt.description}
                    </p>
                  </div>

                  {evt.delta && (
                    <div className="shrink-0 flex items-center gap-1.5 bg-[#0B0F17] border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 tabular-nums">
                      <ArrowRight className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                      <span>{evt.delta}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Rodapé de Paginação e Performance da Lista */}
            <div className="px-5 py-3.5 bg-[#0B0F17] border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span
                className="text-xs text-slate-400 font-mono tabular-nums"
                data-testid="event-log-showing-summary"
              >
                Exibindo {visibleEvents.length} de {filteredEvents.length}{' '}
                registro(s) filtrado(s) (limite máximo: {MAX_EVENT_LOG_ENTRIES})
              </span>

              {remainingEventsCount > 0 && (
                <button
                  type="button"
                  data-testid="load-more-events-btn"
                  onClick={() =>
                    setVisibleLimit((prev) => prev + EVENT_LOG_PAGE_SIZE)
                  }
                  className="px-3.5 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>
                    Carregar mais registros ({remainingEventsCount} restante
                    {remainingEventsCount > 1 ? 's' : ''})
                  </span>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
