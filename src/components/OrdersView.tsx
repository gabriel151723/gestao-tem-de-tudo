import React, { useState, useEffect } from 'react';
import {
  Calculator,
  Phone,
  MapPin,
  Truck,
  Clock,
  CheckCircle2,
  MessageSquare,
  XCircle,
  ClipboardList,
  Download,
  Trash2,
  AlertTriangle,
  X,
  Plus,
  Search,
  ExternalLink,
  PackageCheck,
  Archive,
  RotateCcw,
  ArrowUpRight,
} from 'lucide-react';
import {
  Order,
  OrderItem,
  OrderStatus,
  ORDER_STATUSES,
  ACTIVE_ORDER_STATUSES,
  HISTORY_ORDER_STATUSES,
  isActiveOrderStatus,
  isHistoryOrderStatus,
  getOrderPendingAgeInfo,
  sortActiveOrdersWithOverdueFirst,
  parseOrderTimestampMs,
  calculateQuoteTotals,
  calculateQuickMarkupPrice,
  formatCurrencyBRL,
  formatWhatsAppNumber55,
  buildDirectOrderWhatsAppCtaLink,
  parseSolicitacaoItems,
  getOrderDateKey,
  matchesDateRange,
} from '../erp/erpLogic';
import { DateRangePicker } from './DateRangePicker';

interface OrdersViewProps {
  orders: Order[];
  mode?: 'active' | 'history';
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  onUpdateOrderStatus: (orderId: string, newStatus: OrderStatus) => void;
  onOpenQuoteModal: (order: Order) => void;
  onSimulateIncomingOrder?: () => void;
  onExportOrdersCsv: (ordersToExport: Order[]) => void;
  onDeleteOrder?: (orderId: string) => void;
  onCreateCustomSolicitacao?: (data: {
    nome_cliente: string;
    whatsapp: string;
    dados_veiculo: string;
    peca_solicitada: string;
    observacoes?: string;
  }) => void;
  onSwitchToHistoryTab?: () => void;
  onSwitchToActiveTab?: () => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  orders,
  mode = 'active',
  statusFilter,
  onStatusFilterChange,
  onUpdateOrderStatus,
  onOpenQuoteModal,
  onExportOrdersCsv,
  onDeleteOrder,
  onCreateCustomSolicitacao,
  onSwitchToHistoryTab,
  onSwitchToActiveTab,
}) => {
  const isHistoryMode = mode === 'history';

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [csvFeedbackCount, setCsvFeedbackCount] = useState<number | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [deletedOrderFeedback, setDeletedOrderFeedback] = useState<
    string | null
  >(null);
  const [movedOrderFeedback, setMovedOrderFeedback] = useState<{
    protocol: string;
    customerName: string;
    newStatus: OrderStatus;
    movedToHistory: boolean;
  } | null>(null);
  const [dateRange, setDateRange] = useState<{
    startDate: string;
    endDate: string;
  }>({ startDate: '', endDate: '' });

  // Estado da Calculadora Rápida de Markup por Pedido (expansível)
  const [openMarkupByOrderId, setOpenMarkupByOrderId] = useState<
    Record<string, boolean>
  >({});
  const [costByOrderId, setCostByOrderId] = useState<Record<string, string>>(
    {}
  );
  const [marginByOrderId, setMarginByOrderId] = useState<
    Record<string, string>
  >({});

  // Modal de Registro Manual de Orçamento
  const [isNewModalOpen, setIsNewModalOpen] = useState<boolean>(false);
  const [newCustomerName, setNewCustomerName] = useState<string>('');
  const [newWhatsapp, setNewWhatsapp] = useState<string>('');
  const [newVehicle, setNewVehicle] = useState<string>('');
  const [newPartDescription, setNewPartDescription] = useState<string>('');
  const [newNotes, setNewNotes] = useState<string>('');
  const [newFormError, setNewFormError] = useState<string>('');

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  // Separa os pedidos conforme a aba atual (Ativos na Central vs Concluídos/Cancelados no Histórico)
  const scopedOrders = orders.filter((o) =>
    isHistoryMode
      ? isHistoryOrderStatus(o.status)
      : isActiveOrderStatus(o.status)
  );

  const overdueOrdersInScope = !isHistoryMode
    ? scopedOrders.filter((o) => getOrderPendingAgeInfo(o, nowMs).isOverdue48h)
    : [];

  const availableStatuses = isHistoryMode
    ? HISTORY_ORDER_STATUSES
    : ACTIVE_ORDER_STATUSES;

  const effectiveStatusFilter =
    statusFilter === 'ALL' ||
    availableStatuses.includes(statusFilter as OrderStatus)
      ? statusFilter
      : 'ALL';

  const matchingOrders = scopedOrders.filter((o) => {
    const matchesStatus =
      effectiveStatusFilter === 'ALL' || o.status === effectiveStatusFilter;
    const matchesPeriod = matchesDateRange(
      getOrderDateKey(o),
      dateRange.startDate,
      dateRange.endDate
    );
    if (!matchesStatus || !matchesPeriod) return false;

    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const itemsText = o.items
      .map((it) => `${it.sku} ${it.catalogSku || ''} ${it.name}`)
      .join(' ')
      .toLowerCase();

    return (
      o.customerName.toLowerCase().includes(q) ||
      o.customerPhone.toLowerCase().includes(q) ||
      o.vehicleInfo.toLowerCase().includes(q) ||
      o.protocol.toLowerCase().includes(q) ||
      itemsText.includes(q)
    );
  });

  // Na Central Ativa, fixa no topo os pendentes > 48h; no Histórico, ordena do mais recente para o mais antigo
  const filteredOrders = isHistoryMode
    ? [...matchingOrders].sort(
        (a, b) =>
          (parseOrderTimestampMs(b) ?? 0) - (parseOrderTimestampMs(a) ?? 0)
      )
    : sortActiveOrdersWithOverdueFirst(matchingOrders, nowMs);

  // Métricas exclusivas para o cabeçalho da aba de Concluídos & Cancelados
  const completedOrdersList = scopedOrders.filter(
    (o) => o.status === 'Venda Concluída'
  );
  const cancelledOrdersList = scopedOrders.filter(
    (o) => o.status === 'Cancelado'
  );
  const completedRevenueTotal = completedOrdersList.reduce((acc, order) => {
    const effectiveItems =
      order.items.length === 1 && order.items[0].name.includes('|')
        ? parseSolicitacaoItems(
            order.items[0].name,
            undefined,
            order.items[0].unitPrice ?? 0
          )
        : order.items;
    const priceMap: Record<string, number> = {};
    for (const item of effectiveItems) {
      priceMap[item.sku] = item.unitPrice ?? 0;
    }
    return (
      acc +
      calculateQuoteTotals(
        effectiveItems,
        priceMap,
        order.discountPercent ?? 0,
        order.freightCost ?? 0
      ).finalTotal
    );
  }, 0);

  const handleExportClick = () => {
    onExportOrdersCsv(filteredOrders);
    setCsvFeedbackCount(filteredOrders.length);
    setTimeout(() => setCsvFeedbackCount(null), 4000);
  };

  const handleConfirmDeleteOrder = () => {
    if (!orderToDelete || !onDeleteOrder) return;
    const label = `${orderToDelete.protocol} — ${orderToDelete.customerName}`;
    onDeleteOrder(orderToDelete.id);
    setOrderToDelete(null);
    setDeletedOrderFeedback(label);
    setTimeout(() => setDeletedOrderFeedback(null), 5000);
  };

  const handleStatusChangeClick = (order: Order, nextStatus: OrderStatus) => {
    if (order.status === nextStatus) return;
    onUpdateOrderStatus(order.id, nextStatus);

    const movedToHistory =
      !isHistoryMode && isHistoryOrderStatus(nextStatus);
    const movedToActive =
      isHistoryMode && isActiveOrderStatus(nextStatus);

    if (movedToHistory || movedToActive) {
      setMovedOrderFeedback({
        protocol: order.protocol,
        customerName: order.customerName,
        newStatus: nextStatus,
        movedToHistory,
      });
      setTimeout(() => setMovedOrderFeedback(null), 6000);
    }
  };

  const handleCreateManualQuoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim()) {
      setNewFormError('Informe o nome do cliente ou empresa.');
      return;
    }
    if (!newWhatsapp.trim()) {
      setNewFormError('Informe o WhatsApp do cliente.');
      return;
    }
    if (!newVehicle.trim()) {
      setNewFormError('Informe os dados do veículo ou máquina.');
      return;
    }
    if (!newPartDescription.trim()) {
      setNewFormError('Descreva a(s) peça(s) solicitada(s) pelo cliente.');
      return;
    }

    onCreateCustomSolicitacao?.({
      nome_cliente: newCustomerName.trim(),
      whatsapp: newWhatsapp.trim(),
      dados_veiculo: newVehicle.trim(),
      peca_solicitada: newPartDescription.trim(),
      observacoes: newNotes.trim(),
    });

    setNewCustomerName('');
    setNewWhatsapp('');
    setNewVehicle('');
    setNewPartDescription('');
    setNewNotes('');
    setNewFormError('');
    setIsNewModalOpen(false);
  };

  const renderOrderStatusLabel = (status: OrderStatus) => {
    switch (status) {
      case 'Pendente de Análise':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-400">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>Pendente de Análise</span>
          </span>
        );
      case 'Orçamento Respondido no WhatsApp':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-400">
            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
            <span>Orçamento Respondido no WhatsApp</span>
          </span>
        );
      case 'Venda Concluída':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>Venda Concluída</span>
          </span>
        );
      case 'Cancelado':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-400">
            <XCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Cancelado</span>
          </span>
        );
    }
  };

  return (
    <div
      className="space-y-5"
      data-testid={
        isHistoryMode ? 'history-orders-view' : 'unified-orders-view'
      }
    >
      {/* Resumo Financeiro e Operacional Exclusivo da Aba Concluídos & Cancelados */}
      {isHistoryMode && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-1">
            <span className="text-xs text-slate-400 font-medium">
              Pedidos c/ Venda Concluída
            </span>
            <div className="flex items-baseline justify-between gap-2 pt-1">
              <span className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
                {completedOrdersList.length}
              </span>
              <span className="text-xs text-slate-400">
                Baixa automática no estoque
              </span>
            </div>
          </div>

          <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-1">
            <span className="text-xs text-slate-400 font-medium">
              Total Faturado (Vendas Concluídas)
            </span>
            <div className="flex items-baseline justify-between gap-2 pt-1">
              <span className="text-2xl font-bold font-mono text-white tabular-nums">
                {formatCurrencyBRL(completedRevenueTotal)}
              </span>
              <span className="text-xs text-emerald-400 font-medium">
                Receita consolidada
              </span>
            </div>
          </div>

          <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-1">
            <span className="text-xs text-slate-400 font-medium">
              Orçamentos Cancelados
            </span>
            <div className="flex items-baseline justify-between gap-2 pt-1">
              <span className="text-2xl font-bold font-mono text-rose-400 tabular-nums">
                {cancelledOrdersList.length}
              </span>
              <span className="text-xs text-slate-400">
                Podem ser reabertos a qualquer momento
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Alerta de Prioridade para Orçamentos Pendentes há mais de 48 Horas */}
      {!isHistoryMode && overdueOrdersInScope.length > 0 && (
        <div
          role="region"
          aria-label="Alerta de orçamentos pendentes há mais de 48 horas"
          data-testid="overdue-48h-summary-banner"
          className="bg-rose-950/50 border border-rose-500/50 rounded-xl px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-rose-100">
                Atenção: {overdueOrdersInScope.length}{' '}
                {overdueOrdersInScope.length === 1
                  ? 'orçamento está pendente'
                  : 'orçamentos estão pendentes'}{' '}
                de análise há mais de 48 horas
              </p>
              <p className="text-xs text-rose-200/80">
                Esses registros foram destacados em vermelho e fixados automaticamente no topo da fila para resposta imediata ao cliente.
              </p>
            </div>
          </div>

          {effectiveStatusFilter !== 'Pendente de Análise' && (
            <button
              type="button"
              onClick={() => onStatusFilterChange('Pendente de Análise')}
              className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Ver Pendentes ({overdueOrdersInScope.length} em atraso)
            </button>
          )}
        </div>
      )}

      {/* Barra de Controle de Orçamentos & Pedidos */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white">
              {isHistoryMode
                ? 'Histórico de Pedidos Concluídos & Cancelados'
                : 'Central Unificada de Orçamentos & Pedidos (Em Aberto)'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {isHistoryMode
                ? 'Arquivo dedicado para conferência de vendas fechadas e pedidos cancelados. Você pode exportar relatórios ou reabrir qualquer pedido para a fila ativa.'
                : 'Fila ativa de cotações unificadas (#COT) com vínculo direto ao catálogo de estoque, alerta de atraso (+48h) e envio de proposta em lista no WhatsApp.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {!isHistoryMode && onSwitchToHistoryTab && (
              <button
                type="button"
                data-testid="open-history-tab-shortcut-btn"
                onClick={onSwitchToHistoryTab}
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Archive className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>
                  Ver Concluídos &amp; Cancelados (
                  {
                    orders.filter((o) => isHistoryOrderStatus(o.status))
                      .length
                  }
                  )
                </span>
              </button>
            )}

            {isHistoryMode && onSwitchToActiveTab && (
              <button
                type="button"
                data-testid="open-active-tab-shortcut-btn"
                onClick={onSwitchToActiveTab}
                className="px-3.5 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-bold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ClipboardList className="w-4 h-4 shrink-0" />
                <span>
                  Voltar para Orçamentos Ativos (
                  {orders.filter((o) => isActiveOrderStatus(o.status)).length})
                </span>
              </button>
            )}

            {!isHistoryMode && onCreateCustomSolicitacao && (
              <button
                type="button"
                data-testid="open-new-custom-quote-modal-btn"
                onClick={() => {
                  setNewFormError('');
                  setIsNewModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-bold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>Registrar Orçamento Manual</span>
              </button>
            )}

            <button
              type="button"
              data-testid="export-orders-csv-btn"
              onClick={handleExportClick}
              disabled={filteredOrders.length === 0}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 text-slate-100 text-xs font-semibold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Exportar CSV ({filteredOrders.length})</span>
            </button>
          </div>
        </div>

        {/* Abas de Status + Campo de Busca */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-[#0B0F17] border border-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => onStatusFilterChange('ALL')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                effectiveStatusFilter === 'ALL'
                  ? 'bg-orange-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {isHistoryMode
                ? `Todos do Histórico (${scopedOrders.length})`
                : `Todos Ativos (${scopedOrders.length})`}
            </button>
            {availableStatuses.map((st) => {
              const count = scopedOrders.filter((o) => o.status === st).length;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => onStatusFilterChange(st)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    effectiveStatusFilter === st
                      ? 'bg-orange-500 text-slate-950 font-bold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {st} ({count})
                </button>
              );
            })}
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              data-testid="orders-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por cliente, WhatsApp, veículo, peça ou protocolo..."
              className="w-full bg-[#0B0F17] border border-slate-700 focus:border-orange-500 rounded-lg pl-10 pr-8 py-2 text-xs text-white placeholder-slate-500 outline-none"
            />
            {searchQuery.trim() !== '' && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Limpar busca de orçamentos"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Seletor de Intervalo de Datas (Date Range Picker) */}
        <DateRangePicker
          startDate={dateRange.startDate}
          endDate={dateRange.endDate}
          onChange={setDateRange}
          totalMatchingCount={filteredOrders.length}
          testIdPrefix={
            isHistoryMode ? 'history-date-range' : 'orders-date-range'
          }
        />

        {movedOrderFeedback && (
          <div
            role="status"
            data-testid="order-moved-feedback"
            className="bg-emerald-950/80 border border-emerald-500/40 rounded-lg px-4 py-2.5 text-xs text-emerald-100 flex flex-wrap items-center justify-between gap-2"
          >
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                O orçamento{' '}
                <strong className="font-mono">
                  {movedOrderFeedback.protocol}
                </strong>{' '}
                ({movedOrderFeedback.customerName}) foi marcado como{' '}
                <strong>{movedOrderFeedback.newStatus}</strong> e movido para{' '}
                {movedOrderFeedback.movedToHistory
                  ? 'a aba Concluídos & Cancelados.'
                  : 'a Central de Orçamentos Ativos.'}
              </span>
            </span>

            {movedOrderFeedback.movedToHistory && onSwitchToHistoryTab && (
              <button
                type="button"
                onClick={() => {
                  setMovedOrderFeedback(null);
                  onSwitchToHistoryTab();
                }}
                className="px-3 py-1 rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
              >
                <span>Abrir Concluídos &amp; Cancelados</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}

            {!movedOrderFeedback.movedToHistory && onSwitchToActiveTab && (
              <button
                type="button"
                onClick={() => {
                  setMovedOrderFeedback(null);
                  onSwitchToActiveTab();
                }}
                className="px-3 py-1 rounded-md bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
              >
                <span>Ir para Central de Orçamentos</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {csvFeedbackCount !== null && (
          <div
            role="status"
            data-testid="orders-csv-feedback"
            className="bg-emerald-950/80 border border-emerald-500/40 rounded-lg px-4 py-2.5 text-xs text-emerald-100 flex items-center justify-between gap-2"
          >
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Arquivo CSV gerado com sucesso ({csvFeedbackCount}{' '}
                {csvFeedbackCount === 1
                  ? 'registro exportado'
                  : 'registros exportados'}
                ).
              </span>
            </span>
          </div>
        )}

        {deletedOrderFeedback && (
          <div
            role="status"
            data-testid="orders-delete-feedback"
            className="bg-rose-950/80 border border-rose-500/40 rounded-lg px-4 py-2.5 text-xs text-rose-100 flex items-center justify-between gap-2"
          >
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                Registro de orçamento <strong>{deletedOrderFeedback}</strong>{' '}
                excluído permanentemente do sistema e do Firestore.
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Lista de Pedidos / Orçamentos */}
      {filteredOrders.length === 0 ? (
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
            {isHistoryMode ? (
              <Archive className="w-6 h-6" />
            ) : (
              <ClipboardList className="w-6 h-6" />
            )}
          </div>
          <h4 className="text-base font-bold text-white">
            {isHistoryMode
              ? 'Nenhum Pedido Concluído ou Cancelado para o Filtro Atual'
              : 'Nenhum Orçamento em Aberto para o Filtro Atual'}
          </h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {isHistoryMode
              ? 'Assim que você marcar uma cotação como "Venda Concluída" ou "Cancelado" na Central de Orçamentos, ela será arquivada automaticamente aqui.'
              : 'Todos os orçamentos concluídos ou cancelados foram movidos para a aba "Concluídos & Cancelados". Novas solicitações da Landing Page aparecerão aqui em tempo real.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const effectiveItems: OrderItem[] =
              order.items.length === 1 && order.items[0].name.includes('|')
                ? parseSolicitacaoItems(
                    order.items[0].name,
                    undefined,
                    order.items[0].unitPrice ?? 0
                  )
                : order.items;

            const priceMap: Record<string, number> = {};
            for (const item of effectiveItems) {
              priceMap[item.sku] = item.unitPrice ?? 0;
            }
            const totals = calculateQuoteTotals(
              effectiveItems,
              priceMap,
              order.discountPercent ?? 0,
              order.freightCost ?? 0
            );

            const normalizedOrder: Order = {
              ...order,
              items: effectiveItems,
              itemsCount: effectiveItems.reduce(
                (acc, it) => acc + Math.max(1, it.quantity || 1),
                0
              ),
            };

            const directWaLink = buildDirectOrderWhatsAppCtaLink(
              normalizedOrder,
              priceMap,
              {
                discountPercent: order.discountPercent ?? 0,
                freightCost: order.freightCost ?? 0,
                paymentTerms: order.paymentTerms,
                deliveryLeadTime: order.deliveryLeadTime,
              }
            );

            const hasLinkedCatalogParts = effectiveItems.some(
              (it) => Boolean(it.catalogProductId || it.catalogSku)
            );

            const ageInfo = getOrderPendingAgeInfo(order, nowMs);
            const isOverdue48h = !isHistoryMode && ageInfo.isOverdue48h;

            const isMarkupOpen = Boolean(openMarkupByOrderId[order.id]);
            const rawCost = costByOrderId[order.id] ?? '';
            const rawMargin = marginByOrderId[order.id] ?? '35';
            const markupCalc = calculateQuickMarkupPrice(
              rawCost || 0,
              rawMargin || 0
            );

            return (
              <article
                key={order.id}
                data-testid={`order-card-${order.id}`}
                data-overdue-48h={isOverdue48h ? 'true' : 'false'}
                className={`rounded-xl p-5 space-y-4 transition-colors ${
                  isOverdue48h
                    ? 'bg-rose-950/25 border-2 border-rose-500/70'
                    : 'bg-[#111827] border border-slate-800'
                }`}
              >
                {/* Faixa de Destaque no Topo do Card se estiver Pendente há mais de 48h */}
                {isOverdue48h && (
                  <div
                    data-testid={`overdue-48h-badge-${order.id}`}
                    className="bg-rose-950/80 border border-rose-500/50 rounded-lg px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <span className="inline-flex items-center gap-2 font-bold text-rose-200">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>
                        ALERTA DE ATRASO (+48H): {ageInfo.badgeLabel} sem resposta comercial
                      </span>
                    </span>
                    <span className="font-mono text-[11px] font-semibold text-rose-300 tabular-nums">
                      Prioridade Máxima &middot; Fixado no Topo
                    </span>
                  </div>
                )}

                {/* Cabeçalho do Orçamento */}
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 border-b border-slate-800 pb-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2.5 text-xs">
                      <span className="font-mono text-sm font-bold text-orange-400 tabular-nums">
                        {order.protocol}
                      </span>
                      <span aria-hidden="true" className="text-slate-600">
                        &middot;
                      </span>
                      <span className="font-mono text-slate-400 tabular-nums">
                        {order.createdAt}
                      </span>
                      <span aria-hidden="true" className="text-slate-600">
                        &middot;
                      </span>
                      {renderOrderStatusLabel(order.status)}
                      {order.stockDeducted && (
                        <>
                          <span aria-hidden="true" className="text-slate-600">
                            &middot;
                          </span>
                          <span
                            data-testid={`stock-deducted-badge-${order.id}`}
                            className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-emerald-400"
                          >
                            <PackageCheck className="w-3.5 h-3.5" />
                            <span>Estoque Baixado</span>
                          </span>
                        </>
                      )}
                    </div>

                    <h4 className="text-base font-bold text-white">
                      {order.customerName}
                    </h4>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-0.5">
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="font-mono tabular-nums">
                          +{formatWhatsAppNumber55(order.customerPhone)}
                        </span>
                      </span>
                      <span aria-hidden="true" className="text-slate-600">
                        &middot;
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{order.cityState}</span>
                      </span>
                      <span aria-hidden="true" className="text-slate-600">
                        &middot;
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-emerald-300 font-medium">
                        <Truck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Veículo/Máquina: {order.vehicleInfo}</span>
                      </span>
                    </div>

                    {order.notes && (
                      <p className="text-xs text-slate-400 pt-1">
                        Observação:{' '}
                        <span className="text-slate-200">{order.notes}</span>
                      </p>
                    )}
                  </div>

                  {/* Ações Primárias: Ajustar Preço / Vincular Estoque + Abrir WhatsApp */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-2.5 shrink-0">
                    <div className="text-left lg:text-right">
                      <span className="text-[11px] text-slate-400 block">
                        Valor Total da Proposta (c/ Frete)
                      </span>
                      <span className="text-lg font-bold font-mono text-white tabular-nums">
                        {formatCurrencyBRL(totals.finalTotal)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        data-testid={`open-quote-modal-btn-${order.id}`}
                        onClick={() => onOpenQuoteModal(normalizedOrder)}
                        className="px-3.5 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold text-xs transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Calculator className="w-4 h-4" />
                        <span>Ajustar Preço / Peças do Estoque</span>
                      </button>

                      <a
                        href={directWaLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid={`direct-whatsapp-link-${order.id}`}
                        className="px-3.5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>Enviar no WhatsApp</span>
                        <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                      </a>
                    </div>
                  </div>
                </div>

                {/* Lista Vertical de Peças da Proposta */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                    <span className="font-semibold">
                      Peças da Proposta ({effectiveItems.length}{' '}
                      {effectiveItems.length === 1 ? 'item' : 'itens'})
                      {hasLinkedCatalogParts && (
                        <span className="ml-2 text-emerald-400 font-normal">
                          &middot; Contém peças vinculadas ao catálogo de estoque
                        </span>
                      )}
                    </span>
                    <span className="font-mono tabular-nums">
                      Subtotal Peças: {formatCurrencyBRL(totals.itemsSubtotal)}
                      {totals.discountAmount > 0 &&
                        ` · Desc: -${formatCurrencyBRL(totals.discountAmount)}`}
                      {` · Frete: ${formatCurrencyBRL(totals.freightCost)}`}
                    </span>
                  </div>

                  <div className="bg-[#0B0F17] border border-slate-800 rounded-lg divide-y divide-slate-800/70">
                    {effectiveItems.map((item, idx) => {
                      const unit = item.unitPrice ?? 0;
                      const lineTotal = unit * item.quantity;
                      const isGenericSku =
                        /^PE[CÇ]A-\d+/i.test(item.sku) ||
                        /^ITEM-\d+/i.test(item.sku) ||
                        item.sku === 'PEÇA-SOLICITADA' ||
                        item.sku === 'COT-MURAL';

                      return (
                        <div
                          key={`${order.id}-${item.sku}-${idx}`}
                          className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex flex-wrap items-center gap-2 min-w-0">
                            <span className="font-mono font-bold text-orange-400 shrink-0 tabular-nums">
                              {item.catalogSku
                                ? item.catalogSku
                                : isGenericSku
                                ? `#${idx + 1}`
                                : item.sku}
                            </span>
                            <span className="text-slate-600" aria-hidden="true">
                              &middot;
                            </span>
                            <span className="text-slate-100 font-medium">
                              {item.name}
                            </span>
                            {item.catalogSku && (
                              <span className="text-[11px] font-mono text-emerald-400 inline-flex items-center gap-1">
                                <PackageCheck className="w-3.5 h-3.5" />
                                <span>Estoque [{item.catalogSku}]</span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 font-mono text-slate-300 shrink-0 tabular-nums">
                            <span>
                              Qtd:{' '}
                              <strong className="text-white">
                                {item.quantity}
                              </strong>{' '}
                              un.
                            </span>
                            <span>Unit: {formatCurrencyBRL(unit)}</span>
                            <span className="text-emerald-400 font-semibold">
                              Valor: {formatCurrencyBRL(lineTotal)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Calculadora Rápida de Markup (Opcional / Expansível) */}
                {isMarkupOpen && (
                  <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Simular Custo Fornecedor (R$)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0,00"
                        value={rawCost}
                        onChange={(e) =>
                          setCostByOrderId((prev) => ({
                            ...prev,
                            [order.id]: e.target.value,
                          }))
                        }
                        className="w-full bg-[#111827] border border-slate-700 focus:border-orange-500 rounded-lg px-3 py-1.5 text-xs font-mono text-white outline-none tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Margem de Lucro Desejada (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="35"
                        value={rawMargin}
                        onChange={(e) =>
                          setMarginByOrderId((prev) => ({
                            ...prev,
                            [order.id]: e.target.value,
                          }))
                        }
                        className="w-full bg-[#111827] border border-slate-700 focus:border-orange-500 rounded-lg px-3 py-1.5 text-xs font-mono text-white outline-none tabular-nums"
                      />
                    </div>
                    <div className="flex flex-col justify-center">
                      <span className="text-[11px] text-slate-400">
                        Preço Sugerido c/ Margem:
                      </span>
                      <span className="text-sm font-mono font-bold text-emerald-400 tabular-nums">
                        {formatCurrencyBRL(markupCalc.precoFinalCliente)}{' '}
                        <span className="text-xs font-normal text-slate-400">
                          (Lucro: {formatCurrencyBRL(markupCalc.lucroBruto)})
                        </span>
                      </span>
                    </div>
                  </div>
                )}

                {/* Rodapé do Card: Alterar Status + Reabertura + Simulador de Markup + Apagar */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-medium text-slate-400 mr-1.5">
                      {isHistoryMode
                        ? 'Status no Histórico:'
                        : 'Status do Pedido:'}
                    </span>
                    {ORDER_STATUSES.map((statusOption) => {
                      const isCurrent = order.status === statusOption;
                      return (
                        <button
                          key={statusOption}
                          type="button"
                          data-testid={`status-btn-${order.id}-${statusOption}`}
                          onClick={() =>
                            handleStatusChangeClick(order, statusOption)
                          }
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            isCurrent
                              ? statusOption === 'Cancelado'
                                ? 'bg-rose-600 text-white font-bold'
                                : 'bg-emerald-500 text-slate-950 font-bold'
                              : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white'
                          }`}
                        >
                          {statusOption}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {isHistoryMode && (
                      <button
                        type="button"
                        data-testid={`reopen-order-btn-${order.id}`}
                        onClick={() =>
                          handleStatusChangeClick(order, 'Pendente de Análise')
                        }
                        className="px-3 py-1.5 rounded-lg bg-orange-500/15 hover:bg-orange-500 border border-orange-500/40 text-orange-300 hover:text-slate-950 text-xs font-bold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                        <span>Reabrir p/ Central Ativa</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        setOpenMarkupByOrderId((prev) => ({
                          ...prev,
                          [order.id]: !prev[order.id],
                        }))
                      }
                      className="px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
                    >
                      {isMarkupOpen
                        ? 'Ocultar Simulador de Margem'
                        : 'Simular Margem / Custo'}
                    </button>

                    {onDeleteOrder && (
                      <button
                        type="button"
                        data-testid={`delete-order-btn-${order.id}`}
                        onClick={() => setOrderToDelete(order)}
                        className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-600 border border-rose-500/40 text-rose-300 hover:text-white text-xs font-semibold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Apagar Registro</span>
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modal de Registro Manual de Orçamento */}
      {isNewModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-manual-quote-title"
          data-testid="new-custom-quote-modal"
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-[#111827] border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h4
                  id="new-manual-quote-title"
                  className="text-base font-bold text-white"
                >
                  Registrar Novo Orçamento Manual
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Cadastre solicitações recebidas por telefone ou balcão. Para múltiplas peças, separe por barra (|) ou uma por linha.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                aria-label="Fechar janela"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateManualQuoteSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Nome do Cliente / Empresa *
                  </label>
                  <input
                    type="text"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="Ex: Oficina Mecânica Silva"
                    className="w-full bg-[#0B0F17] border border-slate-700 focus:border-orange-500 rounded-lg px-3 py-2 text-sm text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    WhatsApp do Cliente *
                  </label>
                  <input
                    type="text"
                    value={newWhatsapp}
                    onChange={(e) => setNewWhatsapp(e.target.value)}
                    placeholder="Ex: 11999998888"
                    className="w-full bg-[#0B0F17] border border-slate-700 focus:border-orange-500 rounded-lg px-3 py-2 text-sm font-mono text-white outline-none tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Veículo / Máquina (Modelo, Ano, Placa ou Chassi) *
                </label>
                <input
                  type="text"
                  value={newVehicle}
                  onChange={(e) => setNewVehicle(e.target.value)}
                  placeholder="Ex: Toyota Hilux 2.8 2021 · Placa ABC1D23"
                  className="w-full bg-[#0B0F17] border border-slate-700 focus:border-orange-500 rounded-lg px-3 py-2 text-sm text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Peças Solicitadas (uma por linha ou separadas por |) *
                </label>
                <textarea
                  rows={3}
                  value={newPartDescription}
                  onChange={(e) => setNewPartDescription(e.target.value)}
                  placeholder="Ex: 1x Bomba de Água | 2x Correia Dentada"
                  className="w-full bg-[#0B0F17] border border-slate-700 focus:border-orange-500 rounded-lg px-3 py-2 text-sm text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Observações (Opcional)
                </label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Ex: Cliente retira no balcão"
                  className="w-full bg-[#0B0F17] border border-slate-700 focus:border-orange-500 rounded-lg px-3 py-2 text-sm text-white outline-none"
                />
              </div>

              {newFormError && (
                <p className="text-xs text-rose-400 font-medium">
                  {newFormError}
                </p>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
                >
                  Salvar Orçamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão de Orçamento */}
      {orderToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-order-modal-title"
          data-testid="delete-order-modal"
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-[#111827] border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4
                    id="delete-order-modal-title"
                    className="text-base font-bold text-white"
                  >
                    Confirmar Exclusão de Orçamento
                  </h4>
                  <p className="text-xs text-slate-400">
                    Exclusão permanente no sistema e nas coleções do Firestore
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOrderToDelete(null)}
                aria-label="Fechar modal"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-4 space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono font-bold text-orange-400">
                  {orderToDelete.protocol}
                </span>
                <span className="font-mono text-slate-400">
                  {orderToDelete.customerPhone}
                </span>
              </div>
              <p className="text-sm font-bold text-white">
                {orderToDelete.customerName}
              </p>
              <p className="text-slate-400">
                Veículo/Máquina: {orderToDelete.vehicleInfo}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                data-testid="cancel-delete-order-btn"
                onClick={() => setOrderToDelete(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                data-testid="confirm-delete-order-btn"
                onClick={handleConfirmDeleteOrder}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sim, Apagar Orçamento</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
