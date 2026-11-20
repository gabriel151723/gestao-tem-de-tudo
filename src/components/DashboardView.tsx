import React from 'react';
import {
  Package,
  Clock,
  DollarSign,
  Gauge,
  Plus,
  Layers,
  Calculator,
  ArrowRight,
  Zap,
  History,
  Database,
  AlertTriangle,
} from 'lucide-react';
import {
  DashboardMetrics,
  Order,
  SolicitacaoOrcamento,
  QuoteStatusKey,
  formatCurrencyBRL,
  isActiveOrderStatus,
  sortActiveOrdersWithOverdueFirst,
  getOrderPendingAgeInfo,
  parseOrderTimestampMs,
} from '../erp/erpLogic';
import { StockByCategoryChart } from './StockByCategoryChart';
import { QuoteStatusDonutChart } from './QuoteStatusDonutChart';

interface DashboardViewProps {
  metrics: DashboardMetrics;
  recentOrders: Order[];
  solicitacoes?: SolicitacaoOrcamento[];
  firestoreConnected: boolean;
  onSwitchTab: (tab: 'dashboard' | 'catalog' | 'orders' | 'history' | 'mural' | 'form' | 'events') => void;
  onFilterByCategory: (category: string) => void;
  onSelectQuoteStatus?: (statusKey: QuoteStatusKey, source: 'all' | 'orders' | 'mural') => void;
  onOpenQuoteModal: (order: Order) => void;
  onOpenNewProduct: () => void;
  onSimulateIncomingOrder: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  metrics,
  recentOrders,
  solicitacoes = [],
  firestoreConnected,
  onSwitchTab,
  onFilterByCategory,
  onSelectQuoteStatus,
  onOpenQuoteModal,
  onOpenNewProduct,
  onSimulateIncomingOrder,
}) => {
  const activeRecentOrders = sortActiveOrdersWithOverdueFirst(
    recentOrders.filter((o) => isActiveOrderStatus(o.status))
  );
  const displayedRecentOrders =
    activeRecentOrders.length > 0
      ? activeRecentOrders.slice(0, 4)
      : [...recentOrders]
          .filter((o) => o.status !== 'Cancelado')
          .sort(
            (a, b) =>
              (parseOrderTimestampMs(b) ?? 0) - (parseOrderTimestampMs(a) ?? 0)
          )
          .slice(0, 4);

  return (
    <div className="space-y-6">
      {/* 4 Cards de Indicadores Chave (KPIs) no Topo */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
        data-testid="dashboard-kpi-grid"
      >
        {/* KPI 1: Total de Peças no Estoque */}
        <div
          className="bg-[#111827] border border-slate-800 rounded-xl p-5 flex flex-col justify-between"
          data-testid="kpi-total-stock"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Total de Peças no Estoque</span>
            <Package className="w-4 h-4 text-orange-400 shrink-0" />
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono text-white tabular-nums">
                {metrics.totalUnitsInStock}
              </span>
              <span className="text-xs font-mono text-slate-400">unidades</span>
            </div>
            <p className="text-xs text-slate-400 mt-1.5 tabular-nums">
              {metrics.totalProducts} SKUs ({metrics.availableProducts} c/ saldo &middot;{' '}
              {metrics.onOrderProducts} sob encomenda)
            </p>
          </div>
        </div>

        {/* KPI 2: Pedidos Pendentes */}
        <div
          className="bg-[#111827] border border-slate-800 rounded-xl p-5 flex flex-col justify-between"
          data-testid="kpi-pending-orders"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Pedidos Pendentes</span>
            <Clock className="w-4 h-4 text-orange-400 shrink-0" />
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono text-orange-400 tabular-nums">
                {metrics.pendingOrders}
              </span>
              <span className="text-xs font-mono text-slate-400">
                aguardando análise
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1.5 tabular-nums">
              {metrics.repliedOrders} em negociação &middot; {metrics.completedOrders} concluídos
            </p>
          </div>
        </div>

        {/* KPI 3: Valor Estimado do Inventário */}
        <div
          className="bg-[#111827] border border-slate-800 rounded-xl p-5 flex flex-col justify-between"
          data-testid="kpi-inventory-value"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Valor Estimado do Inventário</span>
            <DollarSign className="w-4 h-4 text-emerald-400 shrink-0" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold font-mono text-emerald-400 tabular-nums block">
              {formatCurrencyBRL(metrics.estimatedInventoryValue)}
            </span>
            <p className="text-xs text-slate-400 mt-1.5 tabular-nums">
              Custo/preço médio: {formatCurrencyBRL(metrics.averageUnitValue)} / un.
            </p>
          </div>
        </div>

        {/* KPI 4: Taxa de Ocupação de Estoque */}
        <div
          className="bg-[#111827] border border-slate-800 rounded-xl p-5 flex flex-col justify-between"
          data-testid="kpi-stock-occupancy"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Taxa de Ocupação de Estoque</span>
            <Gauge className="w-4 h-4 text-sky-400 shrink-0" />
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-3xl font-bold font-mono text-sky-400 tabular-nums">
                {metrics.stockOccupancyRate}%
              </span>
              <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                {metrics.totalUnitsInStock}/{metrics.warehouseCapacityUnits} un.
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-sky-400 rounded-full transition-all"
                style={{ width: `${metrics.stockOccupancyRate}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-1.5 tabular-nums">
              Disponibilidade: {metrics.skuAvailabilityRate}% dos SKUs ativos
            </p>
          </div>
        </div>
      </div>

      {/* Gráficos Recharts: Nível de Estoque por Categoria (Barras) + Distribuição de Orçamentos por Status (Rosca) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7">
          <StockByCategoryChart
            data={metrics.categoryBreakdown}
            totalUnitsInStock={metrics.totalUnitsInStock}
            onSelectCategory={onFilterByCategory}
          />
        </div>
        <div className="lg:col-span-5">
          <QuoteStatusDonutChart
            orders={recentOrders}
            solicitacoes={solicitacoes}
            onSelectStatus={onSelectQuoteStatus}
          />
        </div>
      </div>

      {/* Grid Principal: Orçamentos Recentes + Distribuição por Categoria */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Coluna Esquerda (8 cols): Últimos Orçamentos Recebidos */}
        <div className="lg:col-span-8 bg-[#111827] border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white">
                  Orçamentos Recentes Recebidos dos Clientes
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Escuta ativa em tempo real das solicitações enviadas pela Landing Page
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSwitchTab('orders')}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-orange-400 text-xs font-semibold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Abrir Central de Orçamentos &amp; Pedidos</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {displayedRecentOrders.length === 0 ? (
              <div
                data-testid="dashboard-empty-real-orders"
                className="py-10 px-4 text-center space-y-2.5 bg-[#0B0F17]/60 border border-slate-800/80 rounded-xl"
              >
                <Clock className="w-6 h-6 text-orange-400 mx-auto" />
                <h4 className="text-sm font-bold text-white">
                  Aguardando Pedidos Reais da Landing Page
                </h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Nenhum pedido hipotético é exibido. Assim que um cliente enviar uma solicitação de orçamento na Landing Page, ela aparecerá automaticamente aqui em tempo real.
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => onSwitchTab('orders')}
                    className="px-3.5 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold text-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Abrir Central de Orçamentos / Registrar Manual</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {displayedRecentOrders.map((order) => {
                  const ageInfo = getOrderPendingAgeInfo(order);
                  return (
                    <div
                      key={order.id}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-mono font-bold text-orange-400 tabular-nums">
                            {order.protocol}
                          </span>
                          <span className="text-slate-600" aria-hidden="true">
                            &middot;
                          </span>
                          <span className="font-mono text-slate-400 tabular-nums">
                            {order.createdAt}
                          </span>
                          <span className="text-slate-600" aria-hidden="true">
                            &middot;
                          </span>
                          <span className="text-slate-300 font-medium">
                            {order.status}
                          </span>
                          {ageInfo.isOverdue48h && (
                            <>
                              <span
                                className="text-slate-600"
                                aria-hidden="true"
                              >
                                &middot;
                              </span>
                              <span className="inline-flex items-center gap-1 font-mono font-bold text-rose-400 tabular-nums">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                <span>{ageInfo.badgeLabel}</span>
                              </span>
                            </>
                          )}
                        </div>
                        <p className="text-sm font-bold text-white truncate">
                          {order.customerName}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          {order.vehicleInfo} &middot; {order.cityState} &middot;{' '}
                          <span className="text-slate-300 font-mono tabular-nums">
                            {order.itemsCount}{' '}
                            {order.itemsCount === 1
                              ? 'un. solicitada'
                              : 'un. solicitadas'}
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onOpenQuoteModal(order)}
                          className="px-3.5 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold text-xs transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                        >
                          <Calculator className="w-3.5 h-3.5" />
                          <span>Ajustar Preço e Responder</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Barra de Status de Conexão do Banco */}
          <div className="mt-4 pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0B0F17] p-3.5 rounded-lg border">
            <div className="text-xs text-slate-300 space-y-0.5">
              <p className="font-semibold text-white flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  {firestoreConnected
                    ? 'Banco de Dados Conectado em Tempo Real'
                    : 'Banco de Dados Conectado (Sincronizando)'}
                </span>
              </p>
              <p className="text-slate-400 text-[11px]">
                Estoque e orçamentos sincronizados automaticamente com a loja online.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSwitchTab('events')}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-semibold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <History className="w-4 h-4 text-orange-400" />
              <span>Ver Log de Eventos</span>
            </button>
          </div>
        </div>

        {/* Coluna Direita (4 cols): Distribuição de Estoque por Categoria + Atalhos */}
        <div className="lg:col-span-4 bg-[#111827] border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-5">
          <div>
            <h3 className="text-base font-bold text-white border-b border-slate-800 pb-4">
              Catálogo por Categoria de Veículo
            </h3>
            <p className="text-xs text-slate-400 mt-2">
              Clique em uma categoria para filtrar o estoque:
            </p>

            <div className="space-y-3 mt-4">
              {metrics.categoryBreakdown.map(({ category, count, percentage }) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => onFilterByCategory(category)}
                  className="w-full text-left group block hover:bg-slate-800/40 p-1.5 -mx-1.5 rounded-lg transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 text-xs mb-1.5">
                    <span className="font-medium text-slate-200 group-hover:text-orange-400 transition-colors truncate">
                      {category}
                    </span>
                    <span className="font-mono text-slate-400 tabular-nums shrink-0">
                      {count} {count === 1 ? 'peça' : 'peças'} ({percentage}%)
                    </span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 rounded-full transition-all"
                      style={{ width: `${Math.max(percentage, count > 0 ? 6 : 0)}%` }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 space-y-2.5">
            <button
              type="button"
              onClick={onOpenNewProduct}
              className="w-full py-2.5 px-4 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold text-xs transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Cadastro de Produto</span>
            </button>
            <button
              type="button"
              onClick={() => onSwitchTab('catalog')}
              className="w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Layers className="w-4 h-4" />
              <span>Abrir Catálogo &amp; Estoque Completo</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
