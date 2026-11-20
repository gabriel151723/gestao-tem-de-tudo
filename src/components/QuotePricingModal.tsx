import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  Calculator,
  MessageSquare,
  Phone,
  ExternalLink,
  Send,
  PackageCheck,
  Plus,
  Trash2,
  Link2,
} from 'lucide-react';
import {
  Order,
  OrderItem,
  Product,
  calculateQuoteTotals,
  formatCurrencyBRL,
  formatWhatsAppNumber55,
  generateWhatsAppQuoteMessage,
  buildDirectOrderWhatsAppCtaLink,
  parseSolicitacaoItems,
} from '../erp/erpLogic';

interface QuotePricingModalProps {
  order: Order | null;
  catalogProducts?: Product[];
  onClose: () => void;
  onSaveQuoteAndReply: (
    orderId: string,
    updatedPrices: Record<string, number>,
    discountPercent: number,
    freightCost: number,
    paymentTerms: string,
    deliveryLeadTime: string,
    updatedItems?: OrderItem[]
  ) => void;
}

export const QuotePricingModal: React.FC<QuotePricingModalProps> = ({
  order,
  catalogProducts = [],
  onClose,
  onSaveQuoteAndReply,
}) => {
  const [editableItems, setEditableItems] = useState<OrderItem[]>([]);
  const [unitPrices, setUnitPrices] = useState<Record<string, number>>({});
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [discountInput, setDiscountInput] = useState<string>('');
  const [freightCost, setFreightCost] = useState<number>(0);
  const [freightInput, setFreightInput] = useState<string>('');
  const [paymentTerms, setPaymentTerms] = useState<string>(
    'PIX à vista ou Faturamento mediante cadastro'
  );
  const [deliveryLeadTime, setDeliveryLeadTime] = useState<string>(
    'Pronta entrega — Envio imediato após confirmação'
  );
  const [sellerNote, setSellerNote] = useState<string>('');
  const [selectedExtraProductId, setSelectedExtraProductId] =
    useState<string>('');
  const [extraProductQty, setExtraProductQty] = useState<number>(1);
  const [copiedFeedback, setCopiedFeedback] = useState<boolean>(false);
  const [whatsappDispatched, setWhatsappDispatched] = useState<boolean>(false);

  useEffect(() => {
    if (!order) return;

    const baseItems: OrderItem[] =
      order.items.length === 1 && order.items[0].name.includes('|')
        ? parseSolicitacaoItems(order.items[0].name, undefined, 0)
        : order.items.map((item, idx) => {
            const hasDuplicateSku =
              order.items.filter((it) => it.sku === item.sku).length > 1;
            return {
              ...item,
              sku: hasDuplicateSku ? `PECA-${idx + 1}` : item.sku,
            };
          });

    setEditableItems(baseItems);

    const initialMap: Record<string, number> = {};
    const initialInputs: Record<string, string> = {};
    for (const item of baseItems) {
      const val = Number(item.unitPrice ?? 0);
      const safeVal = Number.isFinite(val) && val >= 0 ? val : 0;
      initialMap[item.sku] = safeVal;
      initialInputs[item.sku] = safeVal > 0 ? String(safeVal) : '';
    }
    setUnitPrices(initialMap);
    setPriceInputs(initialInputs);

    const initDiscount = Number(order.discountPercent ?? 0) || 0;
    setDiscountPercent(initDiscount);
    setDiscountInput(initDiscount > 0 ? String(initDiscount) : '');

    const initFreight = Number(order.freightCost ?? 0) || 0;
    setFreightCost(initFreight);
    setFreightInput(initFreight > 0 ? String(initFreight) : '');

    setPaymentTerms(
      order.paymentTerms || 'PIX à vista ou Faturamento mediante cadastro'
    );
    setDeliveryLeadTime(
      order.deliveryLeadTime ||
        'Pronta entrega — Envio imediato após confirmação'
    );
    setSellerNote('');
    setSelectedExtraProductId('');
    setExtraProductQty(1);
    setCopiedFeedback(false);
    setWhatsappDispatched(false);
  }, [order]);

  if (!order) return null;

  const itemsWithUpdatedPrices: OrderItem[] = editableItems.map((it) => ({
    ...it,
    unitPrice: unitPrices[it.sku] ?? it.unitPrice ?? 0,
  }));

  const normalizedOrder: Order = {
    ...order,
    items: itemsWithUpdatedPrices,
    itemsCount: itemsWithUpdatedPrices.reduce(
      (acc, it) => acc + Math.max(1, it.quantity || 1),
      0
    ),
  };

  const detectedPhone55 = formatWhatsAppNumber55(order.customerPhone);

  const totals = calculateQuoteTotals(
    itemsWithUpdatedPrices,
    unitPrices,
    discountPercent,
    freightCost
  );

  const messageOptions = {
    discountPercent,
    freightCost,
    paymentTerms,
    deliveryLeadTime,
    sellerNote,
  };

  const whatsappMessage = generateWhatsAppQuoteMessage(
    normalizedOrder,
    unitPrices,
    messageOptions
  );

  const directWhatsappUrl = `https://wa.me/${detectedPhone55}?text=${encodeURIComponent(
    whatsappMessage
  )}`;

  const handleUnitPriceChange = (sku: string, rawVal: string) => {
    setPriceInputs((prev) => ({
      ...prev,
      [sku]: rawVal,
    }));
    const normalized = rawVal.replace(',', '.');
    const parsed = parseFloat(normalized);
    setUnitPrices((prev) => ({
      ...prev,
      [sku]: Number.isNaN(parsed) || parsed < 0 ? 0 : parsed,
    }));
  };

  const handleQuantityChange = (sku: string, nextQtyRaw: string) => {
    const parsed = Math.max(1, Math.floor(Number(nextQtyRaw) || 1));
    setEditableItems((prev) =>
      prev.map((item) =>
        item.sku === sku ? { ...item, quantity: parsed } : item
      )
    );
  };

  const handleLinkCatalogProductToRow = (sku: string, productId: string) => {
    if (!productId) {
      setEditableItems((prev) =>
        prev.map((item) =>
          item.sku === sku
            ? {
                ...item,
                catalogProductId: undefined,
                catalogSku: undefined,
              }
            : item
        )
      );
      return;
    }

    const found = catalogProducts.find((p) => p.id === productId);
    if (!found) return;

    setEditableItems((prev) =>
      prev.map((item) =>
        item.sku === sku
          ? {
              ...item,
              catalogProductId: found.id,
              catalogSku: found.sku,
            }
          : item
      )
    );

    const currentPrice = unitPrices[sku] ?? 0;
    if (
      currentPrice === 0 &&
      typeof found.referencePrice === 'number' &&
      found.referencePrice > 0
    ) {
      setUnitPrices((prev) => ({
        ...prev,
        [sku]: found.referencePrice!,
      }));
      setPriceInputs((prev) => ({
        ...prev,
        [sku]: String(found.referencePrice!),
      }));
    }
  };

  const handleAddCatalogProductAsExtraItem = () => {
    if (!selectedExtraProductId) return;
    const found = catalogProducts.find((p) => p.id === selectedExtraProductId);
    if (!found) return;

    const safeQty = Math.max(1, Math.floor(Number(extraProductQty) || 1));
    const uniqueSku = `PECA-${editableItems.length + 1}-${Date.now()
      .toString()
      .slice(-3)}`;
    const defaultPrice =
      typeof found.referencePrice === 'number' && found.referencePrice > 0
        ? found.referencePrice
        : 0;

    const newItem: OrderItem = {
      sku: uniqueSku,
      name: found.name,
      quantity: safeQty,
      unitPrice: defaultPrice,
      catalogProductId: found.id,
      catalogSku: found.sku,
    };

    setEditableItems((prev) => [...prev, newItem]);
    setUnitPrices((prev) => ({
      ...prev,
      [uniqueSku]: defaultPrice,
    }));
    setPriceInputs((prev) => ({
      ...prev,
      [uniqueSku]: defaultPrice > 0 ? String(defaultPrice) : '',
    }));
    setSelectedExtraProductId('');
    setExtraProductQty(1);
  };

  const handleRemoveItemRow = (sku: string) => {
    if (editableItems.length <= 1) return;
    setEditableItems((prev) => prev.filter((it) => it.sku !== sku));
  };

  const handleDiscountChange = (rawVal: string) => {
    setDiscountInput(rawVal);
    const parsed = parseFloat(rawVal.replace(',', '.'));
    setDiscountPercent(
      Number.isNaN(parsed) || parsed < 0 ? 0 : Math.min(100, parsed)
    );
  };

  const handleFreightChange = (rawVal: string) => {
    setFreightInput(rawVal);
    const parsed = parseFloat(rawVal.replace(',', '.'));
    setFreightCost(Number.isNaN(parsed) || parsed < 0 ? 0 : parsed);
  };

  const copyMessageToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(whatsappMessage);
    } catch {
      const textarea = document.getElementById(
        'whatsapp-quote-textarea'
      ) as HTMLTextAreaElement | null;
      if (textarea) {
        textarea.select();
        document.execCommand('copy');
      }
    }
  };

  const handleCopyAndMarkReplied = async () => {
    await copyMessageToClipboard();
    onSaveQuoteAndReply(
      order.id,
      unitPrices,
      discountPercent,
      freightCost,
      paymentTerms,
      deliveryLeadTime,
      itemsWithUpdatedPrices
    );
    setCopiedFeedback(true);
  };

  const handleConfirmPriceAndDispatchWhatsApp = async () => {
    await copyMessageToClipboard();
    onSaveQuoteAndReply(
      order.id,
      unitPrices,
      discountPercent,
      freightCost,
      paymentTerms,
      deliveryLeadTime,
      itemsWithUpdatedPrices
    );
    setCopiedFeedback(true);
    setWhatsappDispatched(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-quote-title"
      data-testid="quote-pricing-modal"
    >
      <div className="bg-[#111827] border border-slate-700 rounded-xl max-w-4xl w-full p-6 space-y-5 my-8 shadow-2xl">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-orange-400">
              <Calculator className="w-4 h-4" />
              <span>MESA DE COTAÇÃO COMERCIAL &middot; {order.protocol}</span>
            </div>
            <h3
              id="modal-quote-title"
              className="text-lg font-bold text-white mt-1"
            >
              Ajustar Preço por Peça e Responder para {order.customerName}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Veículo/Máquina:{' '}
              <span className="text-slate-200 font-medium">
                {order.vehicleInfo}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela de cotação"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Contato de WhatsApp Identificado + Atalho Direto https://wa.me/ */}
        <div
          className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          data-testid="detected-whatsapp-contact-bar"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <Phone className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] text-emerald-300/90 font-semibold block">
                Contato de WhatsApp do Cliente Identificado
              </span>
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                <span
                  className="text-sm font-mono font-bold text-white tabular-nums"
                  data-testid="detected-whatsapp-number"
                >
                  +{detectedPhone55}
                </span>
                <span className="text-slate-600">&middot;</span>
                <span className="text-xs text-slate-300">
                  Cliente: <strong>{order.customerName}</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <a
              href={directWhatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="quick-open-whatsapp-shortcut-top"
              onClick={() => setWhatsappDispatched(true)}
              title={`Abrir conversa no WhatsApp (+${detectedPhone55}) com a mensagem formatada`}
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer shadow-sm"
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
              <span>Abrir WhatsApp Direto (+{detectedPhone55})</span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-85" />
            </a>
          </div>
        </div>

        {/* Precificação Individual de Cada Peça + Vínculo com o Catálogo */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-semibold text-slate-300">
              1. Defina o Valor Individual de Cada Peça ou Vincule ao Estoque (
              {editableItems.length}{' '}
              {editableItems.length === 1
                ? 'peça na proposta'
                : 'peças na proposta'}
              ):
            </h4>
            <span className="text-[11px] text-slate-400">
              Peças vinculadas ao catálogo terão baixa automática de estoque ao concluir a venda
            </span>
          </div>

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {editableItems.map((item, idx) => {
              const currentUnit = unitPrices[item.sku] ?? 0;
              const rawInputVal =
                priceInputs[item.sku] !== undefined
                  ? priceInputs[item.sku]
                  : currentUnit > 0
                  ? String(currentUnit)
                  : '';
              const lineTotal = currentUnit * item.quantity;
              const isGenericSku =
                /^PE[CÇ]A-\d+/i.test(item.sku) ||
                /^ITEM-\d+/i.test(item.sku) ||
                item.sku === 'PEÇA-SOLICITADA' ||
                item.sku === 'COT-MURAL';

              const linkedProduct = catalogProducts.find(
                (p) =>
                  p.id === item.catalogProductId ||
                  (item.catalogSku && p.sku === item.catalogSku)
              );

              return (
                <div
                  key={item.sku}
                  data-testid={`quote-item-row-${idx + 1}`}
                  className="bg-[#0B0F17] border border-slate-800 rounded-lg p-3.5 space-y-2.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                        <span className="font-bold text-orange-400">
                          {item.catalogSku
                            ? item.catalogSku
                            : isGenericSku
                            ? `Peça #${idx + 1}`
                            : item.sku}
                        </span>
                        {linkedProduct && (
                          <span className="text-[11px] text-emerald-400 font-semibold inline-flex items-center gap-1">
                            <PackageCheck className="w-3.5 h-3.5" />
                            <span>
                              Estoque Vinculado ({linkedProduct.stock} un. disp.)
                            </span>
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-white mt-0.5">
                        {item.name}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                      <div className="w-20">
                        <label
                          htmlFor={`qty-${item.sku}`}
                          className="block text-[11px] text-slate-400 mb-1"
                        >
                          Qtd (un.)
                        </label>
                        <input
                          id={`qty-${item.sku}`}
                          data-testid={`modal-qty-${item.sku}`}
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantity}
                          onChange={(e) =>
                            handleQuantityChange(item.sku, e.target.value)
                          }
                          className="w-full bg-[#111827] border border-slate-700 focus:border-orange-500 rounded-md px-2 py-1.5 text-sm font-mono text-white outline-none tabular-nums"
                        />
                      </div>

                      <div className="w-36">
                        <label
                          htmlFor={`unit-price-${item.sku}`}
                          className="block text-[11px] text-slate-400 mb-1"
                        >
                          {item.quantity > 1
                            ? 'Valor Unit. (R$)'
                            : 'Valor da Peça (R$)'}
                        </label>
                        <input
                          id={`unit-price-${item.sku}`}
                          data-testid={`modal-unit-price-${item.sku}`}
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0,00"
                          value={rawInputVal}
                          onChange={(e) =>
                            handleUnitPriceChange(item.sku, e.target.value)
                          }
                          className="w-full bg-[#111827] border border-slate-700 focus:border-orange-500 rounded-md px-2.5 py-1.5 text-sm font-mono text-white outline-none tabular-nums"
                        />
                      </div>

                      <div className="text-right min-w-[95px]">
                        <span className="block text-[11px] text-slate-400">
                          Valor na Lista
                        </span>
                        <span className="text-sm font-mono font-bold text-emerald-400 tabular-nums">
                          {formatCurrencyBRL(lineTotal)}
                        </span>
                      </div>

                      {editableItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(item.sku)}
                          title="Remover peça da proposta"
                          aria-label={`Remover peça ${item.name}`}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer mt-4"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Seletor para Vincular esta Peça a um Produto do Catálogo em Estoque */}
                  <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label
                      htmlFor={`link-catalog-${item.sku}`}
                      className="text-[11px] text-slate-400 inline-flex items-center gap-1.5"
                    >
                      <Link2 className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                      <span>
                        Correspondência no Catálogo / Estoque (opcional):
                      </span>
                    </label>
                    <select
                      id={`link-catalog-${item.sku}`}
                      data-testid={`link-catalog-select-${idx + 1}`}
                      value={item.catalogProductId || ''}
                      onChange={(e) =>
                        handleLinkCatalogProductToRow(item.sku, e.target.value)
                      }
                      className="bg-[#111827] border border-slate-700 focus:border-orange-500 rounded-md px-2.5 py-1 text-xs text-slate-200 outline-none max-w-md w-full sm:w-auto"
                    >
                      <option value="">
                        {catalogProducts.length === 0
                          ? 'Nenhuma peça cadastrada no catálogo ainda'
                          : '— Não vinculado ao estoque (peça avulsa / sob cotação) —'}
                      </option>
                      {catalogProducts.map((prod) => (
                        <option key={prod.id} value={prod.id}>
                          [{prod.sku}] {prod.name} — Estoque: {prod.stock} un.
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Barra para Adicionar Peça Extra Diretamente do Catálogo na Proposta */}
          <div
            className="bg-[#0B0F17] border border-slate-800 rounded-xl p-3.5 space-y-2"
            data-testid="add-catalog-item-bar"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-orange-400 inline-flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                <span>
                  Adicionar Peça do Catálogo na Proposta do Cliente
                </span>
              </span>
              <span className="text-[11px] text-slate-400">
                {catalogProducts.length === 0
                  ? 'Cadastre produtos na aba Catálogo & Estoque para utilizá-los aqui'
                  : `${catalogProducts.length} ${
                      catalogProducts.length === 1
                        ? 'peça disponível'
                        : 'peças disponíveis'
                    } no catálogo`}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <select
                data-testid="add-extra-catalog-select"
                value={selectedExtraProductId}
                onChange={(e) => setSelectedExtraProductId(e.target.value)}
                disabled={catalogProducts.length === 0}
                className="flex-1 bg-[#111827] border border-slate-700 focus:border-orange-500 disabled:opacity-50 rounded-lg px-3 py-2 text-xs text-white outline-none"
              >
                <option value="">
                  {catalogProducts.length === 0
                    ? 'Catálogo vazio — Cadastre suas peças na aba Catálogo & Estoque'
                    : 'Selecione uma peça do seu estoque para incluir na proposta...'}
                </option>
                {catalogProducts.map((prod) => (
                  <option key={prod.id} value={prod.id}>
                    [{prod.sku}] {prod.name} ({prod.vehicleModel}) — Saldo:{' '}
                    {prod.stock} un.
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={extraProductQty}
                  onChange={(e) =>
                    setExtraProductQty(
                      Math.max(1, Math.floor(Number(e.target.value) || 1))
                    )
                  }
                  disabled={!selectedExtraProductId}
                  aria-label="Quantidade da peça do catálogo"
                  className="w-20 bg-[#111827] border border-slate-700 focus:border-orange-500 disabled:opacity-50 rounded-lg px-2.5 py-2 text-xs font-mono text-white outline-none tabular-nums"
                />

                <button
                  type="button"
                  data-testid="add-extra-catalog-btn"
                  onClick={handleAddCatalogProductAsExtraItem}
                  disabled={!selectedExtraProductId}
                  className="px-3.5 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-slate-950 font-bold text-xs transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Incluir Peça do Estoque</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Desconto, Frete e Condições Comerciais */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800">
          <div>
            <label
              htmlFor="quote-discount-input"
              className="block text-xs font-medium text-slate-400 mb-1"
            >
              Desconto (%)
            </label>
            <input
              id="quote-discount-input"
              type="number"
              min="0"
              max="100"
              step="0.5"
              placeholder="0"
              value={discountInput}
              onChange={(e) => handleDiscountChange(e.target.value)}
              className="w-full bg-[#0B0F17] border border-slate-700 focus:border-orange-500 rounded-lg px-3 py-2 text-sm font-mono text-white outline-none tabular-nums"
            />
          </div>

          <div>
            <label
              htmlFor="quote-freight-input"
              className="block text-xs font-medium text-slate-400 mb-1"
            >
              Frete / Envio (R$)
            </label>
            <input
              id="quote-freight-input"
              data-testid="quote-freight-input"
              type="number"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={freightInput}
              onChange={(e) => handleFreightChange(e.target.value)}
              className="w-full bg-[#0B0F17] border border-slate-700 focus:border-orange-500 rounded-lg px-3 py-2 text-sm font-mono text-white outline-none tabular-nums"
            />
          </div>

          <div>
            <label
              htmlFor="quote-payment-input"
              className="block text-xs font-medium text-slate-400 mb-1"
            >
              Condição de Pagamento
            </label>
            <input
              id="quote-payment-input"
              type="text"
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              className="w-full bg-[#0B0F17] border border-slate-700 focus:border-orange-500 rounded-lg px-3 py-2 text-sm text-white outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="quote-leadtime-input"
              className="block text-xs font-medium text-slate-400 mb-1"
            >
              Prazo / Entrega
            </label>
            <input
              id="quote-leadtime-input"
              type="text"
              value={deliveryLeadTime}
              onChange={(e) => setDeliveryLeadTime(e.target.value)}
              className="w-full bg-[#0B0F17] border border-slate-700 focus:border-orange-500 rounded-lg px-3 py-2 text-sm text-white outline-none"
            />
          </div>
        </div>

        {/* Preview da Proposta Formatada em Lista para WhatsApp + Atalho Rápido https://wa.me/ */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="whatsapp-quote-textarea"
              className="text-xs font-semibold text-emerald-400 inline-flex items-center gap-1.5"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>
                2. Prévia da Proposta Formatada em Lista para o WhatsApp:
              </span>
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-xs font-mono text-slate-300 tabular-nums">
                Peças: {formatCurrencyBRL(totals.itemsSubtotal)} &middot; Frete:{' '}
                {formatCurrencyBRL(totals.freightCost)} &middot;{' '}
                <strong className="text-white text-sm">
                  Total Final: {formatCurrencyBRL(totals.finalTotal)}
                </strong>
              </div>

              <a
                href={directWhatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="preview-open-whatsapp-shortcut"
                onClick={() => setWhatsappDispatched(true)}
                className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-500/40 text-emerald-300 hover:text-white text-xs font-semibold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Send className="w-3 h-3" />
                <span>Atalho: Abrir no WhatsApp</span>
                <ExternalLink className="w-3 h-3 opacity-80" />
              </a>
            </div>
          </div>

          <textarea
            id="whatsapp-quote-textarea"
            data-testid="whatsapp-quote-textarea"
            rows={9}
            readOnly
            value={whatsappMessage}
            className="w-full bg-[#0B0F17] border border-slate-700 rounded-lg p-3.5 text-xs font-mono text-slate-200 leading-relaxed outline-none"
          />
        </div>

        {whatsappDispatched && (
          <div
            role="status"
            data-testid="whatsapp-cta-dispatched-feedback"
            className="bg-emerald-950/90 border border-emerald-500/40 rounded-xl px-4 py-3 text-xs text-emerald-100 flex items-center justify-between gap-3"
          >
            <span className="inline-flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                WhatsApp aberto para{' '}
                <strong className="font-mono text-white">
                  +{detectedPhone55}
                </strong>{' '}
                com a proposta formatada em lista!
              </span>
            </span>
          </div>
        )}

        {/* Rodapé do Modal */}
        <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs">
            {copiedFeedback ? (
              <span className="text-emerald-400 font-semibold inline-flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                <span>
                  Cotação salva! Status atualizado para &ldquo;Orçamento
                  Respondido no WhatsApp&rdquo;.
                </span>
              </span>
            ) : (
              <span className="text-slate-400">
                Ao confirmar, o sistema salva os valores de cada peça e abre o
                WhatsApp de{' '}
                <strong className="text-slate-200">{order.customerName}</strong>
                .
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              Fechar
            </button>

            <button
              type="button"
              data-testid="copy-only-quote-btn"
              onClick={handleCopyAndMarkReplied}
              className="px-3.5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white text-xs font-semibold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-orange-400" />
              <span>Copiar Proposta e Salvar</span>
            </button>

            <a
              href={directWhatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="confirm-price-and-open-whatsapp-cta-btn"
              onClick={handleConfirmPriceAndDispatchWhatsApp}
              className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 shrink-0" />
              <span>Confirmar Preço e Abrir WhatsApp</span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-85" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
