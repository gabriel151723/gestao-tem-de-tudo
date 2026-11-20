import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Phone,
  Truck,
  Wrench,
  Clock,
  Calculator,
  CheckCircle2,
  ExternalLink,
  Zap,
  Search,
  BellRing,
  ArrowRight,
  Download,
  Trash2,
  AlertTriangle,
  X,
  Plus,
} from 'lucide-react';
import {
  SolicitacaoOrcamento,
  SolicitacaoStatus,
  calculateQuickMarkupPrice,
  buildSolicitacaoWhatsAppLink,
  formatCurrencyBRL,
  formatWhatsAppNumber55,
  getSolicitacaoDateKey,
  matchesDateRange,
  parseSolicitacaoItems,
} from '../erp/erpLogic';
import { DateRangePicker } from './DateRangePicker';

interface PendingQuotesBoardViewProps {
  solicitacoes: SolicitacaoOrcamento[];
  highlightedIds: string[];
  onDismissHighlight: (id: string) => void;
  onMarkAsReplied: (
    solicitacao: SolicitacaoOrcamento,
    custoFornecedor: number,
    margemLucro: number,
    precoFinal: number
  ) => void;
  onConvertAndCloseSale: (
    solicitacao: SolicitacaoOrcamento,
    custoFornecedor: number,
    margemLucro: number,
    precoFinal: number
  ) => void;
  onSimulateNewSolicitacao: () => void;
  onOpenOrdersView: () => void;
  onExportSolicitacoesCsv?: (itemsToExport: SolicitacaoOrcamento[]) => void;
  onOpenQuoteModalForSolicitacao?: (
    solicitacao: SolicitacaoOrcamento,
    custoFornecedor: number,
    margemLucro: number,
    precoFinal: number
  ) => void;
  onDeleteSolicitacao?: (solicitacaoId: string) => void;
  onCreateCustomSolicitacao?: (data: {
    nome_cliente: string;
    whatsapp: string;
    dados_veiculo: string;
    peca_solicitada: string;
  }) => void;
}

interface QuoteCardDraft {
  custo: string;
  margem: string;
}

export const PendingQuotesBoardView: React.FC<PendingQuotesBoardViewProps> = ({
  solicitacoes,
  highlightedIds,
  onDismissHighlight,
  onMarkAsReplied,
  onConvertAndCloseSale,
  onSimulateNewSolicitacao,
  onOpenOrdersView,
  onExportSolicitacoesCsv,
  onOpenQuoteModalForSolicitacao,
  onDeleteSolicitacao,
  onCreateCustomSolicitacao,
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | SolicitacaoStatus>(
    'pendente'
  );
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [dateRange, setDateRange] = useState<{
    startDate: string;
    endDate: string;
  }>({ startDate: '', endDate: '' });
  const [cardDrafts, setCardDrafts] = useState<Record<string, QuoteCardDraft>>(
    {}
  );
  const [recentlyConvertedProtocol, setRecentlyConvertedProtocol] = useState<
    string | null
  >(null);
  const [csvFeedbackCount, setCsvFeedbackCount] = useState<number | null>(null);
  const [solicitacaoToDelete, setSolicitacaoToDelete] =
    useState<SolicitacaoOrcamento | null>(null);
  const [isNewFreeQuoteOpen, setIsNewFreeQuoteOpen] = useState<boolean>(false);
  const [freeQuoteForm, setFreeQuoteForm] = useState({
    nome_cliente: '',
    whatsapp: '',
    dados_veiculo: '',
    peca_solicitada: '',
  });
  const [freeQuoteError, setFreeQuoteError] = useState<string | null>(null);

  useEffect(() => {
    setCardDrafts((prev) => {
      const next = { ...prev };
      for (const item of solicitacoes) {
        if (!next[item.id]) {
          next[item.id] = {
            custo:
              item.custo_fornecedor > 0 ? String(item.custo_fornecedor) : '',
            margem: String(item.margem_lucro ?? 35),
          };
        }
      }
      return next;
    });
  }, [solicitacoes]);

  const pendingCount = solicitacoes.filter(
    (s) => s.status === 'pendente'
  ).length;
  const repliedCount = solicitacoes.filter(
    (s) => s.status === 'respondido'
  ).length;
  const closedCount = solicitacoes.filter((s) => s.status === 'fechado').length;

  const filteredSolicitacoes = solicitacoes
    .filter((item) => {
      const matchesStatus =
        statusFilter === 'ALL' || item.status === statusFilter;
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.nome_cliente.toLowerCase().includes(q) ||
        item.whatsapp.toLowerCase().includes(q) ||
        item.dados_veiculo.toLowerCase().includes(q) ||
        item.peca_solicitada.toLowerCase().includes(q) ||
        item.protocolo.toLowerCase().includes(q);
      const matchesPeriod = matchesDateRange(
        getSolicitacaoDateKey(item),
        dateRange.startDate,
        dateRange.endDate
      );
      return matchesStatus && matchesSearch && matchesPeriod;
    })
    .sort((a, b) => b.timestamp_ms - a.timestamp_ms);

  const handleDraftChange = (
    id: string,
    field: 'custo' | 'margem',
    value: string
  ) => {
    setCardDrafts((prev) => ({
      ...prev,
      [id]: {
        custo: prev[id]?.custo ?? '',
        margem: prev[id]?.margem ?? '35',
        [field]: value,
      },
    }));
  };

  const handleSubmitFreeQuote = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !freeQuoteForm.nome_cliente.trim() ||
      !freeQuoteForm.whatsapp.trim() ||
      !freeQuoteForm.peca_solicitada.trim()
    ) {
      setFreeQuoteError(
        'Preencha o nome do cliente, WhatsApp e a descrição da peça desejada.'
      );
      return;
    }
    onCreateCustomSolicitacao?.({
      nome_cliente: freeQuoteForm.nome_cliente.trim(),
      whatsapp: freeQuoteForm.whatsapp.trim(),
      dados_veiculo:
        freeQuoteForm.dados_veiculo.trim() || 'Veículo informado pelo cliente',
      peca_solicitada: freeQuoteForm.peca_solicitada.trim(),
    });
    setFreeQuoteForm({
      nome_cliente: '',
      whatsapp: '',
      dados_veiculo: '',
      peca_solicitada: '',
    });
    setFreeQuoteError(null);
    setIsNewFreeQuoteOpen(false);
  };

  const renderStatusText = (status: SolicitacaoStatus) => {
    if (status === 'pendente') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-400">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>Pendente de Resposta</span>
        </span>
      );
    }
    if (status === 'respondido') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-400">
          <MessageSquare className="w-3.5 h-3.5 shrink-0" />
          <span>Respondido no WhatsApp</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>Fechado / Convertido em Venda</span>
      </span>
    );
  };

  return (
    <div className="space-y-5" data-testid="pending-quotes-board">
      {/* Cabeçalho do Mural de Pedidos / Cotações Pendentes */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-base font-bold text-white">
                Mural de Pedidos &amp; Orçamentos Livres (Firestore)
              </h3>
              <span
                data-testid="mural-pending-badge"
                className="text-xs font-mono font-bold text-orange-400 tabular-nums"
              >
                {pendingCount}{' '}
                {pendingCount === 1
                  ? 'cotação pendente'
                  : 'cotações pendentes'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Recebimento em tempo real das solicitações onde o cliente digita seus dados, veículo e a peça desejada na Landing Page.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {onExportSolicitacoesCsv && (
              <button
                type="button"
                data-testid="export-solicitacoes-csv-btn"
                onClick={() => {
                  onExportSolicitacoesCsv(filteredSolicitacoes);
                  setCsvFeedbackCount(filteredSolicitacoes.length);
                  setTimeout(() => setCsvFeedbackCount(null), 4000);
                }}
                disabled={filteredSolicitacoes.length === 0}
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 text-slate-100 text-xs font-semibold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>
                  Exportar Cotações CSV ({filteredSolicitacoes.length})
                </span>
              </button>
            )}
            {onCreateCustomSolicitacao && (
              <button
                type="button"
                data-testid="open-new-free-quote-btn"
                onClick={() => setIsNewFreeQuoteOpen(true)}
                className="px-3.5 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-bold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Registrar Orçamento Livre</span>
              </button>
            )}
          </div>
        </div>

        {csvFeedbackCount !== null && (
          <div
            role="status"
            data-testid="solicitacoes-csv-feedback"
            className="bg-emerald-950/80 border border-emerald-500/40 rounded-lg px-4 py-2.5 text-xs text-emerald-100 flex items-center justify-between gap-2"
          >
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Arquivo CSV de cotações gerado com sucesso ({csvFeedbackCount}{' '}
                {csvFeedbackCount === 1
                  ? 'cotação exportada'
                  : 'cotações exportadas'}
                ).
              </span>
            </span>
          </div>
        )}

        {/* Barra de Filtros por Status + Busca Rápida */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div
            className="flex flex-wrap items-center gap-1 p-1 bg-[#0B0F17] border border-slate-800 rounded-lg"
            role="group"
            aria-label="Filtrar solicitações por status"
          >
            <button
              type="button"
              data-testid="filter-solicitacao-pendente"
              onClick={() => setStatusFilter('pendente')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === 'pendente'
                  ? 'bg-orange-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Pendentes ({pendingCount})
            </button>
            <button
              type="button"
              data-testid="filter-solicitacao-respondido"
              onClick={() => setStatusFilter('respondido')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === 'respondido'
                  ? 'bg-orange-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Respondidas ({repliedCount})
            </button>
            <button
              type="button"
              data-testid="filter-solicitacao-fechado"
              onClick={() => setStatusFilter('fechado')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === 'fechado'
                  ? 'bg-orange-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Fechadas / Vendas ({closedCount})
            </button>
            <button
              type="button"
              data-testid="filter-solicitacao-all"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === 'ALL'
                  ? 'bg-orange-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Todas ({solicitacoes.length})
            </button>
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar cliente, WhatsApp, veículo ou peça solicitada..."
              aria-label="Buscar no Mural de Pedidos"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#0B0F17] border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
            />
          </div>
        </div>

        {/* Seletor de Intervalo de Datas (Date Range Picker) */}
        <DateRangePicker
          startDate={dateRange.startDate}
          endDate={dateRange.endDate}
          onChange={setDateRange}
          totalMatchingCount={filteredSolicitacoes.length}
          testIdPrefix="mural-date-range"
        />
      </div>

      {/* Feedback de Conversão em Venda */}
      {recentlyConvertedProtocol && (
        <div
          role="status"
          className="bg-emerald-950/90 border border-emerald-500/40 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5 text-xs text-emerald-100">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Cotação{' '}
              <strong className="font-mono text-white">
                {recentlyConvertedProtocol}
              </strong>{' '}
              marcada como <strong>fechado</strong> e registrada como{' '}
              <strong>Venda Concluída</strong> na Gestão de Orçamentos!
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenOrdersView}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <span>Ver na Gestão de Orçamentos</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setRecentlyConvertedProtocol(null)}
              className="px-2.5 py-1.5 rounded-lg text-xs text-emerald-300 hover:text-white"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Lista de Cards de Cotação */}
      {filteredSolicitacoes.length === 0 ? (
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
            <MessageSquare className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-white">
            Aguardando Solicitações Reais da Landing Page
          </h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Nenhum pedido hipotético está ativo. Assim que um cliente enviar um orçamento pela Landing Page no ar, ele aparecerá automaticamente aqui em tempo real.
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            {statusFilter !== 'ALL' && solicitacoes.length > 0 && (
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                Exibir Todas as Cotações ({solicitacoes.length})
              </button>
            )}
            {onCreateCustomSolicitacao && (
              <button
                type="button"
                onClick={() => setIsNewFreeQuoteOpen(true)}
                className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Registrar Orçamento Livre Manual</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {filteredSolicitacoes.map((item) => {
            const draft = cardDrafts[item.id] ?? {
              custo:
                item.custo_fornecedor > 0 ? String(item.custo_fornecedor) : '',
              margem: String(item.margem_lucro ?? 35),
            };

            const calc = calculateQuickMarkupPrice(draft.custo, draft.margem);
            const whatsappHref = buildSolicitacaoWhatsAppLink(
              item,
              calc.precoFinalCliente
            );
            const isHighlighted = highlightedIds.includes(item.id);
            const isPending = item.status === 'pendente';

            return (
              <article
                key={item.id}
                data-testid={`solicitacao-card-${item.id}`}
                onClick={() => {
                  if (isHighlighted) onDismissHighlight(item.id);
                }}
                className={`bg-[#111827] rounded-xl p-5 flex flex-col justify-between space-y-4 border transition-colors ${
                  isHighlighted
                    ? 'border-orange-500 ring-1 ring-orange-500/40'
                    : isPending
                    ? 'border-slate-700/90'
                    : 'border-slate-800'
                }`}
              >
                {/* Topo do Card: Protocolo, Horário de Envio, Status e Exclusão */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono font-bold text-orange-400 tabular-nums">
                        {item.protocolo}
                      </span>
                      <span aria-hidden="true" className="text-slate-600">
                        &middot;
                      </span>
                      <span className="font-mono text-slate-400 tabular-nums">
                        Enviado em {item.horario_exibicao}
                      </span>
                      {isHighlighted && (
                        <>
                          <span aria-hidden="true" className="text-slate-600">
                            &middot;
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-300">
                            <BellRing className="w-3.5 h-3.5 shrink-0" />
                            <span>Nova Solicitação</span>
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {renderStatusText(item.status)}
                      {onDeleteSolicitacao && (
                        <button
                          type="button"
                          data-testid={`btn-delete-solicitacao-${item.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSolicitacaoToDelete(item);
                          }}
                          title="Apagar solicitação de orçamento"
                          aria-label={`Apagar solicitação ${item.protocolo}`}
                          className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/30 text-rose-300 hover:text-white transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Nome do Cliente e Contato WhatsApp */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] text-slate-400 block">
                        Cliente Solicitante
                      </span>
                      <h4 className="text-base font-bold text-white">
                        {item.nome_cliente}
                      </h4>
                    </div>
                    <div className="text-left sm:text-right">
                      <span className="text-[11px] text-slate-400 block">
                        WhatsApp do Cliente
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-emerald-400 tabular-nums">
                        <Phone className="w-3.5 h-3.5 shrink-0" />
                        <span>+{formatWhatsAppNumber55(item.whatsapp)}</span>
                      </span>
                    </div>
                  </div>

                  {/* Dados do Veículo e Peça Solicitada */}
                  <div className="bg-[#0B0F17] border border-slate-800 rounded-lg p-3.5 space-y-2.5">
                    <div className="flex items-start gap-2.5 text-xs">
                      <Truck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span className="text-slate-400 block text-[11px]">
                          Dados do Veículo / Máquina
                        </span>
                        <p className="text-slate-100 font-semibold">
                          {item.dados_veiculo}
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-slate-800/80 pt-2.5 flex items-start gap-2.5 text-xs">
                      <Wrench className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <span className="text-slate-400 block text-[11px] mb-1">
                          Peças Solicitadas pelo Cliente
                        </span>
                        <ul className="space-y-1 text-white font-semibold leading-snug">
                          {parseSolicitacaoItems(
                            item.peca_solicitada,
                            item.precos_itens,
                            0
                          ).map((part, pIdx) => (
                            <li
                              key={`${item.id}-part-${pIdx}`}
                              className="flex items-center justify-between gap-2"
                            >
                              <span>
                                {pIdx + 1}. {part.name}
                              </span>
                              {(part.unitPrice ?? 0) > 0 && (
                                <span className="font-mono text-emerald-400 tabular-nums shrink-0">
                                  {formatCurrencyBRL(part.unitPrice ?? 0)}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Calculadora de Precificação Rápida no Próprio Card */}
                <div className="bg-[#0B0F17] border border-slate-800 rounded-lg p-3.5 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-200 inline-flex items-center gap-1.5">
                      <Calculator className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                      <span>Calculadora de Precificação Rápida</span>
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                      Lucro Bruto: + {formatCurrencyBRL(calc.lucroBruto)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div>
                      <label
                        htmlFor={`custo-${item.id}`}
                        className="block text-[11px] font-medium text-slate-400 mb-1"
                      >
                        Custo Fornecedor (R$)
                      </label>
                      <input
                        id={`custo-${item.id}`}
                        data-testid={`input-custo-${item.id}`}
                        type="number"
                        min={0}
                        step="0.01"
                        value={draft.custo}
                        onChange={(e) =>
                          handleDraftChange(item.id, 'custo', e.target.value)
                        }
                        placeholder="0,00"
                        className="w-full px-3 py-2 rounded-lg bg-[#111827] border border-slate-700 text-xs font-mono text-white tabular-nums focus:outline-none focus:border-orange-500"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`margem-${item.id}`}
                        className="block text-[11px] font-medium text-slate-400 mb-1"
                      >
                        Margem Lucro (%)
                      </label>
                      <input
                        id={`margem-${item.id}`}
                        data-testid={`input-margem-${item.id}`}
                        type="number"
                        min={0}
                        step="0.5"
                        value={draft.margem}
                        onChange={(e) =>
                          handleDraftChange(item.id, 'margem', e.target.value)
                        }
                        placeholder="35"
                        className="w-full px-3 py-2 rounded-lg bg-[#111827] border border-slate-700 text-xs font-mono text-white tabular-nums focus:outline-none focus:border-orange-500"
                      />
                    </div>

                    <div className="bg-[#111827] border border-slate-800 rounded-lg px-3 py-1.5 flex flex-col justify-center">
                      <span className="text-[10px] text-slate-400">
                        Preço Final ao Cliente
                      </span>
                      <span
                        data-testid={`preco-final-${item.id}`}
                        className="text-sm font-bold font-mono text-emerald-400 tabular-nums"
                      >
                        {formatCurrencyBRL(
                          item.preco_final > 0
                            ? item.preco_final
                            : calc.precoFinalCliente
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Botões de Ação Rápida do Card */}
                <div className="pt-1 flex flex-col gap-2">
                  {onOpenQuoteModalForSolicitacao && (
                    <button
                      type="button"
                      data-testid={`btn-ajustar-responder-${item.id}`}
                      onClick={() =>
                        onOpenQuoteModalForSolicitacao(
                          item,
                          calc.custoFornecedor,
                          calc.margemLucroPercent,
                          calc.precoFinalCliente
                        )
                      }
                      className="w-full py-2.5 px-3.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-bold transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                    >
                      <Calculator className="w-4 h-4 text-orange-400 shrink-0" />
                      <span>
                        Ajustar Preço por Peça e Gerar Resposta (WhatsApp)
                      </span>
                    </button>
                  )}

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                    <a
                      href={whatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={`btn-whatsapp-${item.id}`}
                      onClick={() => {
                        if (item.status === 'pendente') {
                          onMarkAsReplied(
                            item,
                            calc.custoFornecedor,
                            calc.margemLucroPercent,
                            calc.precoFinalCliente
                          );
                        }
                      }}
                      className="flex-1 py-2.5 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      <MessageSquare className="w-4 h-4 shrink-0" />
                      <span>Abrir WhatsApp</span>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-80" />
                    </a>

                    <button
                      type="button"
                      data-testid={`btn-concluir-venda-${item.id}`}
                      onClick={() => {
                        onConvertAndCloseSale(
                          item,
                          calc.custoFornecedor,
                          calc.margemLucroPercent,
                          calc.precoFinalCliente
                        );
                        setRecentlyConvertedProtocol(item.protocolo);
                      }}
                      className={`flex-1 py-2.5 px-3.5 rounded-lg text-xs font-bold transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer ${
                        item.status === 'fechado'
                          ? 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30'
                          : 'bg-orange-500 hover:bg-orange-400 text-slate-950'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>
                        {item.status === 'fechado'
                          ? 'Venda Concluída (Atualizar)'
                          : 'Concluir / Transformar em Venda'}
                      </span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modal para Registrar Orçamento Livre do Cliente */}
      {isNewFreeQuoteOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-free-quote-modal-title"
          data-testid="new-free-quote-modal"
        >
          <form
            onSubmit={handleSubmitFreeQuote}
            className="bg-[#111827] border border-slate-700 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h4
                  id="new-free-quote-modal-title"
                  className="text-base font-bold text-white"
                >
                  Registrar Orçamento Livre de Cliente
                </h4>
                <p className="text-xs text-slate-400">
                  Cadastra a solicitação diretamente na coleção{' '}
                  <code className="font-mono text-orange-400">
                    solicitacoes_orcamento
                  </code>{' '}
                  do Firestore
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewFreeQuoteOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label
                  htmlFor="free-quote-cliente"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Nome do Cliente ou Empresa *
                </label>
                <input
                  id="free-quote-cliente"
                  data-testid="free-quote-cliente-input"
                  type="text"
                  value={freeQuoteForm.nome_cliente}
                  onChange={(e) =>
                    setFreeQuoteForm((prev) => ({
                      ...prev,
                      nome_cliente: e.target.value,
                    }))
                  }
                  placeholder="Ex: Transportadora Horizonte (Carlos)"
                  className="w-full px-3 py-2 rounded-lg bg-[#0B0F17] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label
                  htmlFor="free-quote-whatsapp"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  WhatsApp do Cliente (com DDD) *
                </label>
                <input
                  id="free-quote-whatsapp"
                  data-testid="free-quote-whatsapp-input"
                  type="text"
                  value={freeQuoteForm.whatsapp}
                  onChange={(e) =>
                    setFreeQuoteForm((prev) => ({
                      ...prev,
                      whatsapp: e.target.value,
                    }))
                  }
                  placeholder="Ex: (31) 99821-4450"
                  className="w-full px-3 py-2 rounded-lg bg-[#0B0F17] border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label
                  htmlFor="free-quote-veiculo"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Dados do Veículo / Máquina (Modelo, Ano, Placa ou Chassi)
                </label>
                <input
                  id="free-quote-veiculo"
                  data-testid="free-quote-veiculo-input"
                  type="text"
                  value={freeQuoteForm.dados_veiculo}
                  onChange={(e) =>
                    setFreeQuoteForm((prev) => ({
                      ...prev,
                      dados_veiculo: e.target.value,
                    }))
                  }
                  placeholder="Ex: Scania R450 2021 Placa RTA4B18"
                  className="w-full px-3 py-2 rounded-lg bg-[#0B0F17] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label
                  htmlFor="free-quote-peca"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Dados da Peça que o Cliente Deseja *
                </label>
                <textarea
                  id="free-quote-peca"
                  data-testid="free-quote-peca-input"
                  rows={3}
                  value={freeQuoteForm.peca_solicitada}
                  onChange={(e) =>
                    setFreeQuoteForm((prev) => ({
                      ...prev,
                      peca_solicitada: e.target.value,
                    }))
                  }
                  placeholder="Ex: 2x Mangueiras hidráulicas alta pressão 1/2 pol com terminais JIC 37°..."
                  className="w-full px-3 py-2 rounded-lg bg-[#0B0F17] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              {freeQuoteError && (
                <p className="text-xs text-rose-400 font-medium">
                  {freeQuoteError}
                </p>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsNewFreeQuoteOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                data-testid="submit-free-quote-btn"
                className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-bold"
              >
                Salvar Orçamento no Firestore
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão de Solicitação de Orçamento */}
      {solicitacaoToDelete && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-solicitacao-modal-title"
          data-testid="delete-solicitacao-modal"
        >
          <div className="bg-[#111827] border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4
                    id="delete-solicitacao-modal-title"
                    className="text-base font-bold text-white"
                  >
                    Apagar Solicitação de Orçamento
                  </h4>
                  <p className="text-xs text-slate-400">
                    Remoção permanente do Mural e do Firestore
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSolicitacaoToDelete(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#0B0F17] border border-slate-800 rounded-lg p-3.5 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Protocolo:</span>
                <span className="font-mono font-bold text-orange-400">
                  {solicitacaoToDelete.protocolo}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Cliente:</span>
                <span className="font-semibold text-white">
                  {solicitacaoToDelete.nome_cliente}
                </span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="text-slate-400 shrink-0">Peça:</span>
                <span className="text-slate-200 text-right">
                  {solicitacaoToDelete.peca_solicitada}
                </span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSolicitacaoToDelete(null)}
                className="px-4 py-2 rounded-lg border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                data-testid="confirm-delete-solicitacao-btn"
                onClick={() => {
                  const targetId = solicitacaoToDelete.id;
                  setSolicitacaoToDelete(null);
                  onDeleteSolicitacao?.(targetId);
                }}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
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
