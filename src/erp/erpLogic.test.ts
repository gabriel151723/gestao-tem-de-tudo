import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_PRODUCTS,
  INITIAL_ORDERS,
  INITIAL_EVENTS,
  INITIAL_SOLICITACOES_ORCAMENTO,
  validateProductInput,
  filterProducts,
  calculateDashboardMetrics,
  calculateQuoteTotals,
  generateWhatsAppQuoteMessage,
  createSimulatedIncomingOrder,
  createSystemEvent,
  toFirestoreProductPayload,
  toFirestoreSolicitacaoPayload,
  toFirestoreOrderPayload,
  normalizeFirestoreProduct,
  normalizeFirestoreOrder,
  formatLicensePlate,
  formatChassis,
  calculateQuickMarkupPrice,
  formatWhatsAppNumber55,
  buildSolicitacaoWhatsAppLink,
  normalizeSolicitacaoOrcamento,
  convertSolicitacaoToCompletedOrder,
  generateProductsCsv,
  generateOrdersCsv,
  generateSolicitacoesCsv,
  calculateQuoteStatusDistribution,
  extractDateKeyYYYYMMDD,
  getOrderDateKey,
  getSolicitacaoDateKey,
  matchesDateRange,
  formatDateKeyBR,
  DEFAULT_SOUND_SETTINGS,
  normalizeSoundSettings,
  playNotificationPing,
  MAX_EVENT_LOG_ENTRIES,
  EVENT_LOG_PAGE_SIZE,
  pruneEventLog,
  shouldRunDailyBackup,
  createErpBackupPayload,
  serializeErpBackupJson,
  parseAndValidateErpBackupJson,
  buildDirectOrderWhatsAppCtaLink,
  convertSolicitacaoToOrderForPricing,
  parseSolicitacaoItems,
  isHypotheticalOrder,
  isHypotheticalSolicitacao,
  filterOutHypotheticalOrders,
  filterOutHypotheticalSolicitacoes,
  applyBatchCategoryUpdate,
  applyBatchDeleteProducts,
  isDemoSeedProduct,
  filterOutDemoProducts,
  deductCatalogStockForOrder,
  isActiveOrderStatus,
  isHistoryOrderStatus,
  getOrderPendingAgeInfo,
  sortActiveOrdersWithOverdueFirst,
  areOrdersDuplicateLandingPagePair,
  deduplicateAndMergeOrders,
} from './erpLogic';

test('INITIAL_PRODUCTS contains 12 realistic auto parts matching Firestore schema and vehicle fields', () => {
  assert.equal(INITIAL_PRODUCTS.length, 12);
  for (const product of INITIAL_PRODUCTS) {
    assert.ok(product.vehicleModel.length >= 2);
    assert.ok(product.vehicleYear.length >= 2);
    const payload = toFirestoreProductPayload(product);
    assert.deepEqual(Object.keys(payload).sort(), [
      'application',
      'category',
      'demo',
      'id',
      'name',
      'oem',
      'sku',
      'stock',
      'system',
    ]);
    assert.equal(payload.id, payload.sku);
    assert.equal(typeof payload.stock, 'number');
    assert.equal(payload.stock >= 0, true);
    assert.equal(typeof payload.demo, 'boolean');

    // Round-trip decode check
    const normalized = normalizeFirestoreProduct(
      payload.id,
      payload as unknown as Record<string, unknown>
    );
    assert.equal(normalized.vehicleModel, product.vehicleModel);
    assert.equal(normalized.vehicleYear, product.vehicleYear);
  }
});

test('validateProductInput enforces required vehicleModel and vehicleYear and validates optional licensePlate and chassis', () => {
  const invalid = validateProductInput({
    sku: '',
    name: 'AB',
    oem: '',
    category: '',
    system: '',
    vehicleModel: '',
    vehicleYear: '',
    licensePlate: '123-ABCD',
    chassis: 'AB1',
    application: '',
    stock: -1,
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.sku);
  assert.ok(invalid.errors.name);
  assert.ok(invalid.errors.oem);
  assert.ok(invalid.errors.category);
  assert.ok(invalid.errors.system);
  assert.ok(invalid.errors.vehicleModel);
  assert.ok(invalid.errors.vehicleYear);
  assert.ok(invalid.errors.licensePlate);
  assert.ok(invalid.errors.chassis);
  assert.ok(invalid.errors.application);
  assert.ok(invalid.errors.stock);

  assert.equal(formatLicensePlate('abc1234'), 'ABC-1234');
  assert.equal(formatLicensePlate('rta4b18'), 'RTA4B18');
  assert.equal(formatChassis('9bsr6x400e3849102'), '9BSR6X400E3849102');

  const valid = validateProductInput({
    sku: 'MNG-MAN-099',
    name: 'Mangueira Hidráulica R2AT 1/2"',
    oem: 'DIN-EN853-2SN',
    category: 'Linha Pesada / Diesel (Caminhões e Ônibus)',
    system: 'Mangueiras e Conexões',
    vehicleModel: 'Scania R450 / Volvo FH 540',
    vehicleYear: '2018 a 2024',
    licensePlate: 'RTA4B18',
    chassis: '9BSR6X400E3849102',
    application: 'Caminhões Volvo FH e Scania Série R',
    stock: 15,
  });
  assert.equal(valid.valid, true);
  assert.deepEqual(valid.errors, {});
});

test('filterProducts filters accurately by SKU, OEM, category, modelFilter, yearFilter, licensePlate, and chassis', () => {
  const byOem = filterProducts(INITIAL_PRODUCTS, {
    search: 'A3660300417',
    category: 'ALL',
    system: 'ALL',
    stockStatus: 'ALL',
    modelFilter: 'ALL',
    yearFilter: 'ALL',
  });
  assert.equal(byOem.length, 1);
  assert.equal(byOem[0].sku, 'MNG-MOT-001');

  const byModel = filterProducts(INITIAL_PRODUCTS, {
    search: '',
    category: 'ALL',
    system: 'ALL',
    stockStatus: 'ALL',
    modelFilter: 'Scania R440 / Série R',
    yearFilter: 'ALL',
  });
  assert.equal(byModel.length, 1);
  assert.equal(byModel[0].sku, 'MNG-FRE-003');

  const byYear = filterProducts(INITIAL_PRODUCTS, {
    search: '',
    category: 'ALL',
    system: 'ALL',
    stockStatus: 'ALL',
    modelFilter: 'ALL',
    yearFilter: '1996 a 2011',
  });
  assert.equal(byYear.length, 1);
  assert.equal(byYear[0].sku, 'MNG-MOT-001');

  const byPlateSearch = filterProducts(INITIAL_PRODUCTS, {
    search: 'FTR8H22',
    category: 'ALL',
    system: 'ALL',
    stockStatus: 'ALL',
    modelFilter: 'ALL',
    yearFilter: 'ALL',
  });
  assert.equal(byPlateSearch.length, 1);
  assert.equal(byPlateSearch[0].sku, 'MNG-SUS-006');

  const byDedicatedPlateField = filterProducts(INITIAL_PRODUCTS, {
    search: '',
    category: 'ALL',
    system: 'ALL',
    stockStatus: 'ALL',
    modelFilter: 'ALL',
    yearFilter: 'ALL',
    plateSearch: 'RTA4B18',
    chassisSearch: '',
  });
  assert.equal(byDedicatedPlateField.length, 1);
  assert.equal(byDedicatedPlateField[0].sku, 'MNG-FRE-003');

  const byDedicatedChassisField = filterProducts(INITIAL_PRODUCTS, {
    search: '',
    category: 'ALL',
    system: 'ALL',
    stockStatus: 'ALL',
    modelFilter: 'ALL',
    yearFilter: 'ALL',
    plateSearch: '',
    chassisSearch: '9BSR6X400E3849102',
  });
  assert.equal(byDedicatedChassisField.length, 1);
  assert.equal(byDedicatedChassisField[0].sku, 'MNG-FRE-003');
});

test('calculateQuoteTotals and generateWhatsAppQuoteMessage compute totals accurately', () => {
  const order = INITIAL_ORDERS[0];
  const totals = calculateQuoteTotals(
    order.items,
    { 'MNG-FRE-003': 540, 'MNG-MAN-011': 95 },
    5,
    85
  );
  assert.equal(totals.itemsSubtotal, 1460);
  assert.equal(totals.discountAmount, 73);
  assert.equal(totals.finalTotal, 1472);

  const msg = generateWhatsAppQuoteMessage(order, {
    'MNG-FRE-003': 540,
    'MNG-MAN-011': 95,
  });
  assert.ok(msg.includes(order.protocol));
  assert.ok(msg.includes('MNG-FRE-003'));
});

test('normalizeFirestoreOrder normalizes incoming Firestore order documents', () => {
  const normalized = normalizeFirestoreOrder('ord-abc-123', {
    customerName: 'Fazenda Boa Esperança',
    customerPhone: '5565999112233',
    customerCity: 'Sinop / MT',
    vehicle: 'Trator John Deere 8R',
    itemsCount: 3,
    items: [{ sku: 'MNG-MAN-010', name: 'Mangueira R2AT', quantity: 3 }],
    status: 'pending',
  });
  assert.equal(normalized.customerName, 'Fazenda Boa Esperança');
  assert.equal(normalized.itemsCount, 3);
  assert.equal(normalized.status, 'Pendente de Análise');
  assert.equal(normalized.items[0].sku, 'MNG-MAN-010');
});

test('calculateDashboardMetrics and createSimulatedIncomingOrder work deterministically', () => {
  const metrics = calculateDashboardMetrics(INITIAL_PRODUCTS, INITIAL_ORDERS);
  assert.equal(metrics.totalProducts, 12);
  assert.equal(metrics.availableProducts, 10);
  assert.equal(metrics.onOrderProducts, 2);
  assert.equal(metrics.totalUnitsInStock, 164);
  assert.equal(metrics.estimatedInventoryValue > 0, true);
  assert.equal(metrics.averageUnitValue > 0, true);
  assert.equal(metrics.stockOccupancyRate, 66);
  assert.equal(metrics.skuAvailabilityRate, 83);

  const sumCategoryStock = metrics.categoryBreakdown.reduce(
    (sum, item) => sum + item.totalStock,
    0
  );
  assert.equal(sumCategoryStock, metrics.totalUnitsInStock);
  assert.equal(metrics.categoryBreakdown[0].shortLabel, 'Linha Pesada');
  assert.equal(metrics.categoryBreakdown[0].totalStock, 76);

  const sim = createSimulatedIncomingOrder(INITIAL_PRODUCTS, 9123);
  assert.equal(sim.protocol, '#PED-2026-9123');
  assert.equal(sim.itemsCount >= 1, true);
});

test('INITIAL_EVENTS and createSystemEvent generate chronological log records', () => {
  assert.equal(INITIAL_EVENTS.length >= 6, true);
  const evt = createSystemEvent({
    category: 'Estoque',
    action: 'Entrada / Aumento de Saldo em Estoque',
    description: 'Ajuste de saldo físico para Filtro de Óleo.',
    reference: 'MNG-MOT-002',
    delta: '24 un. → 25 un.',
  });
  assert.equal(evt.category, 'Estoque');
  assert.equal(evt.reference, 'MNG-MOT-002');
  assert.equal(evt.delta, '24 un. → 25 un.');
  assert.ok(evt.timestamp.includes('às'));
});

test('solicitacoes_orcamento markup calculator, WhatsApp link, and sale conversion work accurately', () => {
  assert.equal(INITIAL_SOLICITACOES_ORCAMENTO.length, 3);

  const markup = calculateQuickMarkupPrice(1000, 35);
  assert.equal(markup.custoFornecedor, 1000);
  assert.equal(markup.margemLucroPercent, 35);
  assert.equal(markup.lucroBruto, 350);
  assert.equal(markup.precoFinalCliente, 1350);

  assert.equal(formatWhatsAppNumber55('(31) 99821-4450'), '5531998214450');
  assert.equal(formatWhatsAppNumber55('5531998214450'), '5531998214450');

  const sol = normalizeSolicitacaoOrcamento('sol-999', {
    nome_cliente: 'Transportadora Minas',
    whatsapp: '31998214450',
    dados_veiculo: 'Scania R440 2020',
    peca_solicitada: 'Mangueira Hidráulica SAE 100R2',
    status: 'pendente',
    data_criacao: '2026-11-04T15:00:00.000Z',
    custo_fornecedor: 500,
    margem_lucro: 40,
  });

  assert.equal(sol.status, 'pendente');
  assert.equal(sol.preco_final, 700);

  const waUrl = buildSolicitacaoWhatsAppLink(sol, sol.preco_final);
  assert.ok(waUrl.startsWith('https://wa.me/5531998214450?text='));
  assert.ok(decodeURIComponent(waUrl).includes('Mangueira Hidráulica SAE 100R2'));

  const convertedOrder = convertSolicitacaoToCompletedOrder(sol, 500, 40, 700);
  assert.equal(convertedOrder.status, 'Venda Concluída');
  assert.equal(convertedOrder.customerName, 'Transportadora Minas');
  assert.equal(convertedOrder.items[0].unitPrice, 700);
});

test('generateProductsCsv, generateOrdersCsv, and generateSolicitacoesCsv produce UTF-8 BOM CSV with semicolon delimiter', () => {
  const productsCsv = generateProductsCsv(INITIAL_PRODUCTS);
  assert.ok(productsCsv.startsWith('\uFEFFSKU;Nome da Peça;Ref. / Fabricante;'));
  const productLines = productsCsv.trim().split('\r\n');
  assert.equal(productLines.length, INITIAL_PRODUCTS.length + 1);
  assert.ok(productLines[1].includes('MNG-MOT-001'));
  assert.ok(productLines[1].includes(INITIAL_PRODUCTS[0].vehicleModel));

  const ordersCsv = generateOrdersCsv(INITIAL_ORDERS);
  assert.ok(ordersCsv.startsWith('\uFEFFProtocolo;Data e Hora;Status do Orçamento;Cliente / Empresa;'));
  const orderLines = ordersCsv.trim().split('\r\n');
  assert.equal(orderLines.length, INITIAL_ORDERS.length + 1);
  assert.ok(orderLines[1].includes(INITIAL_ORDERS[0].protocol));

  const solicitacoesCsv = generateSolicitacoesCsv(INITIAL_SOLICITACOES_ORCAMENTO);
  assert.ok(solicitacoesCsv.startsWith('\uFEFFProtocolo;Horário de Envio;Status;Cliente Solicitante;'));
  const solicitacaoLines = solicitacoesCsv.trim().split('\r\n');
  assert.equal(solicitacaoLines.length, INITIAL_SOLICITACOES_ORCAMENTO.length + 1);
  assert.ok(solicitacaoLines[1].includes(INITIAL_SOLICITACOES_ORCAMENTO[0].protocolo));
});

test('calculateQuoteStatusDistribution computes Pendente, Respondido, and Fechado slices accurately', () => {
  const distAll = calculateQuoteStatusDistribution(
    INITIAL_ORDERS,
    INITIAL_SOLICITACOES_ORCAMENTO,
    'all'
  );
  assert.equal(distAll.slices.length, 3);
  assert.equal(distAll.slices[0].label, 'Pendente');
  assert.equal(distAll.slices[1].label, 'Respondido');
  assert.equal(distAll.slices[2].label, 'Fechado');
  assert.equal(distAll.pendenteCount, 4);
  assert.equal(distAll.respondidoCount, 1);
  assert.equal(distAll.fechadoCount, 1);
  assert.equal(distAll.totalActiveQuotes, 6);

  const distOrders = calculateQuoteStatusDistribution(
    INITIAL_ORDERS,
    INITIAL_SOLICITACOES_ORCAMENTO,
    'orders'
  );
  assert.equal(distOrders.totalActiveQuotes, 3);
  assert.equal(distOrders.pendenteCount, 1);
  assert.equal(distOrders.respondidoCount, 1);
  assert.equal(distOrders.fechadoCount, 1);
});

test('extractDateKeyYYYYMMDD and matchesDateRange filter orders and solicitacoes by period accurately', () => {
  assert.equal(extractDateKeyYYYYMMDD('03/11/2026 às 09:14:22'), '2026-11-03');
  assert.equal(extractDateKeyYYYYMMDD('2026-11-06T13:52:54.758Z'), '2026-11-06');
  assert.equal(formatDateKeyBR('2026-11-03'), '03/11/2026');

  const firstOrderKey = getOrderDateKey(INITIAL_ORDERS[0]);
  assert.equal(firstOrderKey, '2026-11-03');
  assert.equal(matchesDateRange(firstOrderKey, '2026-11-03', '2026-11-03'), true);
  assert.equal(matchesDateRange(firstOrderKey, '2026-11-04', '2026-11-06'), false);
  // Inverted start/end dates auto-normalize
  assert.equal(matchesDateRange(firstOrderKey, '2026-11-05', '2026-11-01'), true);

  const firstSolKey = getSolicitacaoDateKey(INITIAL_SOLICITACOES_ORCAMENTO[0]);
  assert.ok(firstSolKey && firstSolKey.startsWith('2026-11-'));
});

test('normalizeSoundSettings and playNotificationPing respect user mute and volume preferences', () => {
  const defaults = normalizeSoundSettings(null);
  assert.deepEqual(defaults, DEFAULT_SOUND_SETTINGS);

  const muted = normalizeSoundSettings({ enabled: false, volume: 0.8 });
  assert.equal(muted.enabled, false);
  assert.equal(muted.volume, 0.8);
  assert.equal(playNotificationPing(muted), false);

  const active = normalizeSoundSettings({ enabled: true, volume: 0.5 });
  assert.equal(active.enabled, true);
  assert.equal(active.volume, 0.5);
  assert.equal(playNotificationPing(active), true);
});

test('pruneEventLog automatically retains only the latest 500 records and optimizes storage', () => {
  assert.equal(MAX_EVENT_LOG_ENTRIES, 500);
  assert.equal(EVENT_LOG_PAGE_SIZE, 50);

  const syntheticEvents = Array.from({ length: 620 }, (_, idx) => ({
    id: `evt-test-${idx + 1}`,
    timestamp: '06/11/2026 às 10:00:00',
    category: 'Estoque' as const,
    action: `Ajuste #${idx + 1}`,
    description: `Registro sintético de teste #${idx + 1}`,
    reference: `MNG-MOT-${idx + 1}`,
  }));

  const result = pruneEventLog(syntheticEvents, MAX_EVENT_LOG_ENTRIES);
  assert.equal(result.prunedEvents.length, 500);
  assert.equal(result.removedCount, 120);
  assert.equal(result.maxEntries, 500);
  assert.equal(result.prunedEvents[0].id, 'evt-test-1');
  assert.equal(result.prunedEvents[499].id, 'evt-test-500');
  assert.ok(result.estimatedBytes > 1000);
});

test('daily JSON backup routine creates, serializes, and validates restoration of Products and Orders accurately', () => {
  const fixedDate = new Date('2026-11-06T12:00:00.000Z');
  assert.equal(shouldRunDailyBackup(null, fixedDate), true);
  assert.equal(shouldRunDailyBackup('2026-11-05', fixedDate), true);
  assert.equal(shouldRunDailyBackup('2026-11-06', fixedDate), false);

  const backupPayload = createErpBackupPayload(
    INITIAL_PRODUCTS,
    INITIAL_ORDERS,
    INITIAL_SOLICITACOES_ORCAMENTO,
    fixedDate
  );

  assert.equal(backupPayload.backupDateKey, '2026-11-06');
  assert.equal(backupPayload.summary.productsCount, 12);
  assert.equal(backupPayload.summary.ordersCount, 3);
  assert.equal(backupPayload.summary.solicitacoesCount, 3);

  const jsonString = serializeErpBackupJson(backupPayload);
  const validation = parseAndValidateErpBackupJson(jsonString);
  assert.equal(validation.valid, true);
  assert.ok(validation.payload);
  assert.equal(validation.payload.data.products.length, 12);
  assert.equal(validation.payload.data.orders.length, 3);
  assert.equal(validation.payload.data.solicitacoes.length, 3);
  assert.equal(validation.payload.data.products[0].sku, 'MNG-MOT-001');

  // Rejeita arquivo corrompido
  const corrupted = parseAndValidateErpBackupJson('{invalid_json');
  assert.equal(corrupted.valid, false);
  assert.ok(corrupted.error);

  const missingProducts = parseAndValidateErpBackupJson(
    JSON.stringify({ data: { orders: [] } })
  );
  assert.equal(missingProducts.valid, false);
});

test('convertSolicitacaoToOrderForPricing, parseSolicitacaoItems, and buildDirectOrderWhatsAppCtaLink split multi-part quotes with independent prices and format vertical WhatsApp list with freight and no CTA jargon', () => {
  const sol = INITIAL_SOLICITACOES_ORCAMENTO[0];
  const order = convertSolicitacaoToOrderForPricing(sol, 980, 35, 1323);
  assert.equal(order.solicitacaoId, sol.id);
  assert.equal(order.customerName, sol.nome_cliente);
  assert.equal(order.customerPhone, sol.whatsapp);
  assert.equal(order.items[0].name, sol.peca_solicitada);
  assert.equal(order.items[0].unitPrice, 1323);

  const sku = order.items[0].sku;
  const waLink = buildDirectOrderWhatsAppCtaLink(
    order,
    { [sku]: 1323 },
    { freightCost: 45 }
  );
  const expectedPhone = formatWhatsAppNumber55(sol.whatsapp);
  assert.ok(waLink.startsWith(`https://wa.me/${expectedPhone}?text=`));
  const decoded = decodeURIComponent(waLink);
  assert.equal(decoded.includes('CTA'), false);
  assert.ok(decoded.includes(sol.peca_solicitada));
  assert.ok(decoded.includes('*Frete:*'));
  assert.ok(
    decoded.includes(
      'Podemos confirmar o seu pedido e iniciar a separação das peças?'
    )
  );

  // Testa orçamento real com múltiplas peças separadas por barra (|) e preços individuais
  const multiPartSol = normalizeSolicitacaoOrcamento('sfH342Ab2XUA3HbkyTF5', {
    cliente: { nome: 'Gabriel Henrique', telefone: '71983978870' },
    veiculo: { modelo: 'Chevrolet camaro', ano: '2018' },
    peca_solicitada:
      '1. litros de óleo (Qtd: 4) | 2. filtro de óleo (Qtd: 1) | 3. correia dentada (Qtd: 1)',
    status: 'pendente',
  });

  const multiOrder = convertSolicitacaoToOrderForPricing(multiPartSol);
  assert.equal(multiOrder.items.length, 3);
  assert.equal(multiOrder.items[0].sku, 'PECA-1');
  assert.equal(multiOrder.items[0].name, 'litros de óleo (Qtd: 4)');
  assert.equal(multiOrder.items[1].sku, 'PECA-2');
  assert.equal(multiOrder.items[1].name, 'filtro de óleo (Qtd: 1)');
  assert.equal(multiOrder.items[2].sku, 'PECA-3');
  assert.equal(multiOrder.items[2].name, 'correia dentada (Qtd: 1)');

  const individualPrices = {
    'PECA-1': 180,
    'PECA-2': 45,
    'PECA-3': 120,
  };
  const multiMsg = generateWhatsAppQuoteMessage(multiOrder, individualPrices, {
    freightCost: 35,
  }).replace(/\u00A0/g, ' ');

  assert.ok(multiMsg.includes('• 1. litros de óleo (Qtd: 4): *R$ 180,00*'));
  assert.ok(multiMsg.includes('• 2. filtro de óleo (Qtd: 1): *R$ 45,00*'));
  assert.ok(multiMsg.includes('• 3. correia dentada (Qtd: 1): *R$ 120,00*'));
  assert.ok(multiMsg.includes('*Frete:* R$ 35,00'));
  assert.ok(multiMsg.includes('R$ 380,00'));
  assert.equal(multiMsg.includes(' | '), false);
  assert.equal(multiMsg.includes('CTA'), false);
});

test('applyBatchCategoryUpdate and applyBatchDeleteProducts update and delete selected products in batch accurately', () => {
  const selectedIds = ['MNG-MOT-001', 'MNG-FRE-003'];
  const targetCategory = 'Utilitários (Pick-ups e Vans)';

  const { updatedProducts, affectedProducts } = applyBatchCategoryUpdate(
    INITIAL_PRODUCTS,
    selectedIds,
    targetCategory
  );
  assert.equal(affectedProducts.length, 2);
  assert.equal(
    updatedProducts.find((p) => p.sku === 'MNG-MOT-001')?.category,
    targetCategory
  );
  assert.equal(
    updatedProducts.find((p) => p.sku === 'MNG-FRE-003')?.category,
    targetCategory
  );
  // Non-selected product remains untouched
  assert.equal(
    updatedProducts.find((p) => p.sku === 'MNG-MOT-002')?.category,
    INITIAL_PRODUCTS.find((p) => p.sku === 'MNG-MOT-002')?.category
  );

  const { remainingProducts, deletedProducts } = applyBatchDeleteProducts(
    INITIAL_PRODUCTS,
    selectedIds
  );
  assert.equal(deletedProducts.length, 2);
  assert.equal(remainingProducts.length, INITIAL_PRODUCTS.length - 2);
  assert.equal(
    remainingProducts.some((p) => selectedIds.includes(p.sku)),
    false
  );
});

test('filterOutHypotheticalOrders and filterOutHypotheticalSolicitacoes purge demo/simulated quotes while keeping real customer quotes', () => {
  const realOrder = normalizeFirestoreOrder('ord-real-lp-100', {
    protocol: '#PED-LP-100',
    customerName: 'Cliente Real da Landing Page Ltda',
    customerPhone: '5511988776655',
    cityState: 'São Paulo / SP',
    vehicleInfo: 'Scania R500 2023',
    itemsCount: 2,
    items: [{ sku: 'PEÇA-LIVRE', name: 'Mangueira Direção Hidráulica', quantity: 2 }],
    status: 'Pendente de Análise',
  });

  const mixedOrders = [...INITIAL_ORDERS, realOrder];
  const filteredOrders = filterOutHypotheticalOrders(mixedOrders);
  assert.equal(filteredOrders.length, 1);
  assert.equal(filteredOrders[0].id, 'ord-real-lp-100');
  assert.equal(isHypotheticalOrder(INITIAL_ORDERS[0]), true);
  assert.equal(isHypotheticalOrder(realOrder), false);

  const realSol = normalizeSolicitacaoOrcamento('sol-real-lp-200', {
    protocolo: '#COT-LP-200',
    nome_cliente: 'Transportes Reais Brasil',
    whatsapp: '5511977665544',
    dados_veiculo: 'Volvo FH 540 2024',
    peca_solicitada: 'Kit Reparo Válvula APU',
    status: 'pendente',
  });

  const mixedSolicitacoes = [...INITIAL_SOLICITACOES_ORCAMENTO, realSol];
  const filteredSolicitacoes =
    filterOutHypotheticalSolicitacoes(mixedSolicitacoes);
  assert.equal(filteredSolicitacoes.length, 1);
  assert.equal(filteredSolicitacoes[0].id, 'sol-real-lp-200');
  assert.equal(
    isHypotheticalSolicitacao(INITIAL_SOLICITACOES_ORCAMENTO[0]),
    true
  );
  assert.equal(isHypotheticalSolicitacao(realSol), false);
});

test('isDemoSeedProduct, filterOutDemoProducts, and deductCatalogStockForOrder purge the 12 demo products and deduct stock automatically on sale completion', () => {
  const realUserProduct = normalizeFirestoreProduct('TDT-OLEO-5W30', {
    id: 'TDT-OLEO-5W30',
    sku: 'TDT-OLEO-5W30',
    name: 'Óleo Motor Sintético 5W30 API SP',
    oem: '5W30-DEXOS',
    category: 'Linha Leve (Carros de Passeio)',
    system: 'Componentes de Motor',
    application: '[Modelo: Chevrolet Camaro | Ano: 2018] Lubrificante sintético motor V8.',
    stock: 20,
    demo: false,
  });

  const combinedCatalog = [...INITIAL_PRODUCTS, realUserProduct];
  const cleanedCatalog = filterOutDemoProducts(combinedCatalog);

  // All 12 pre-established demo products are removed; only the real user product remains
  assert.equal(cleanedCatalog.length, 1);
  assert.equal(cleanedCatalog[0].sku, 'TDT-OLEO-5W30');
  assert.equal(isDemoSeedProduct(INITIAL_PRODUCTS[0]), true);
  assert.equal(isDemoSeedProduct(realUserProduct), false);

  // Test automatic stock deduction when proposal has a linked catalog item
  const proposalItems = [
    {
      sku: 'PECA-1',
      name: 'litros de óleo (Qtd: 4)',
      quantity: 4,
      unitPrice: 65,
      catalogProductId: 'TDT-OLEO-5W30',
      catalogSku: 'TDT-OLEO-5W30',
    },
    {
      sku: 'PECA-2',
      name: 'filtro de óleo avulso',
      quantity: 1,
      unitPrice: 45,
    },
  ];

  const { updatedProducts, affectedProducts, deductionsSummary } =
    deductCatalogStockForOrder(cleanedCatalog, proposalItems);

  assert.equal(affectedProducts.length, 1);
  assert.equal(updatedProducts[0].stock, 16); // 20 - 4 = 16
  assert.equal(deductionsSummary[0].previousStock, 20);
  assert.equal(deductionsSummary[0].deductedQuantity, 4);
  assert.equal(deductionsSummary[0].newStock, 16);
});

test('deduplicateAndMergeOrders unifies duplicate #COT and #PED records from the Landing Page, keeping #COT as canonical', () => {
  const sol = normalizeSolicitacaoOrcamento('sfH342Ab2XUA3HbkyTF5', {
    id: 'sfH342Ab2XUA3HbkyTF5',
    protocolo: '#COT-2026-4410',
    nome_cliente: 'Gabriel Gold',
    whatsapp: '11988887777',
    dados_veiculo: 'Chevrolet Camaro 2018',
    peca_solicitada: 'litros de óleo (Qtd: 2) | filtro de óleo (Qtd: 1)',
    status: 'pendente',
    data_criacao: '2026-11-16T10:00:00.000Z',
  });

  const cotOrder = convertSolicitacaoToOrderForPricing(sol);

  // Duplicate #PED record created simultaneously by the Landing Page in 'orders' collection
  const duplicatePedOrder = normalizeFirestoreOrder('ped-mirror-991', {
    id: 'ped-mirror-991',
    protocol: '#PED-2026-4410',
    customerName: 'Gabriel Gold',
    customerPhone: '5511988887777',
    cityState: 'São Paulo / SP',
    vehicleInfo: 'Chevrolet Camaro 2018',
    itemsCount: 3,
    itemsSummary: 'litros de óleo (Qtd: 2) | filtro de óleo (Qtd: 1)',
    status: 'Pendente de Análise',
    createdAt: '2026-11-16T10:00:02.000Z',
  });

  // Standalone order that has no #COT counterpart
  const standalonePedOrder = normalizeFirestoreOrder('ped-standalone-500', {
    id: 'ped-standalone-500',
    protocol: '#PED-2026-5000',
    customerName: 'Transportadora Independente',
    customerPhone: '5541991112222',
    cityState: 'Curitiba / PR',
    vehicleInfo: 'Volvo FH 540',
    itemsCount: 1,
    itemsSummary: 'Válvula Freio',
    status: 'Pendente de Análise',
    createdAt: '2026-11-16T11:00:00.000Z',
  });

  assert.equal(
    areOrdersDuplicateLandingPagePair(cotOrder, duplicatePedOrder),
    true
  );
  assert.equal(
    areOrdersDuplicateLandingPagePair(cotOrder, standalonePedOrder),
    false
  );

  const unified = deduplicateAndMergeOrders(
    [cotOrder],
    [duplicatePedOrder, standalonePedOrder],
    []
  );

  // Only 2 orders remain (#COT-2026-4410 and standalone #PED-2026-5000); duplicate #PED-2026-4410 was absorbed
  assert.equal(unified.length, 2);
  assert.equal(unified[0].protocol, '#COT-2026-4410');
  assert.equal(unified[0].linkedFirestoreOrderId, 'ped-mirror-991');
  assert.equal(unified[0].cityState, 'São Paulo / SP');
  assert.equal(unified[1].protocol, '#PED-2026-5000');
});

test('getOrderPendingAgeInfo, sortActiveOrdersWithOverdueFirst, and active/history status helpers highlight >48h pending orders and pin them to the top', () => {
  const nowMs = Date.parse('2026-11-16T12:00:00.000Z');

  const recentPendingOrder = normalizeFirestoreOrder('ord-recent', {
    id: 'ord-recent',
    protocol: '#COT-RECENTE',
    customerName: 'Cliente Recente',
    customerPhone: '5511999991111',
    vehicleInfo: 'Hilux 2022',
    itemsCount: 1,
    status: 'Pendente de Análise',
    createdAt: '2026-11-16T02:00:00.000Z', // 10h atrás
  });

  const overdue60hOrder = normalizeFirestoreOrder('ord-overdue-60h', {
    id: 'ord-overdue-60h',
    protocol: '#COT-ATRASADO-60H',
    customerName: 'Cliente Aguardando 60h',
    customerPhone: '5511999992222',
    vehicleInfo: 'Scania R450',
    itemsCount: 2,
    status: 'Pendente de Análise',
    createdAt: '2026-11-14T00:00:00.000Z', // 60h atrás (>48h)
  });

  const repliedOldOrder = normalizeFirestoreOrder('ord-replied-72h', {
    id: 'ord-replied-72h',
    protocol: '#COT-RESPONDIDO',
    customerName: 'Cliente Já Respondido',
    customerPhone: '5511999993333',
    vehicleInfo: 'VW Delivery',
    itemsCount: 1,
    status: 'Orçamento Respondido no WhatsApp',
    createdAt: '2026-11-13T12:00:00.000Z', // 72h atrás, mas já respondido
  });

  const recentAge = getOrderPendingAgeInfo(recentPendingOrder, nowMs);
  assert.equal(recentAge.isOverdue48h, false);
  assert.equal(recentAge.elapsedHours, 10);

  const overdueAge = getOrderPendingAgeInfo(overdue60hOrder, nowMs);
  assert.equal(overdueAge.isOverdue48h, true);
  assert.equal(overdueAge.elapsedHours, 60);
  assert.ok(overdueAge.badgeLabel.includes('+48h'));

  const repliedAge = getOrderPendingAgeInfo(repliedOldOrder, nowMs);
  assert.equal(repliedAge.isOverdue48h, false);

  const sorted = sortActiveOrdersWithOverdueFirst(
    [recentPendingOrder, repliedOldOrder, overdue60hOrder],
    nowMs
  );

  // Overdue >48h pending order is pinned first
  assert.equal(sorted[0].protocol, '#COT-ATRASADO-60H');
  assert.equal(sorted[1].protocol, '#COT-RECENTE');

  // Verify active vs history classification
  assert.equal(isActiveOrderStatus('Pendente de Análise'), true);
  assert.equal(isActiveOrderStatus('Orçamento Respondido no WhatsApp'), true);
  assert.equal(isActiveOrderStatus('Venda Concluída'), false);
  assert.equal(isActiveOrderStatus('Cancelado'), false);
  assert.equal(isHistoryOrderStatus('Venda Concluída'), true);
  assert.equal(isHistoryOrderStatus('Cancelado'), true);
});

test('toFirestoreSolicitacaoPayload preserves notes, payment terms, delivery lead time, and timestamps while capping items', () => {
  const sol = normalizeSolicitacaoOrcamento('SOL-TEST-99', {
    id: 'SOL-TEST-99',
    protocolo: '#COT-2026-9901',
    nome_cliente: 'Transportes Real',
    whatsapp: '11988881111',
    dados_veiculo: 'Scania R450 2022',
    peca_solicitada: 'Mangueira hidráulica 2SN',
    status: 'respondido',
    observacoes: 'Urgente para manutenção de frota',
    condicoes_pagamento: 'PIX 5% desconto ou 30 dias',
    prazo_entrega: 'Envio imediato hoje',
    data_criacao: '2026-11-16T10:00:00.000Z',
    custo_fornecedor: 200,
    margem_lucro: 40,
    preco_final: 280,
    frete: 45,
    desconto_percentual: 5,
  });

  const payload = toFirestoreSolicitacaoPayload(sol);
  assert.equal(payload.observacoes, 'Urgente para manutenção de frota');
  assert.equal(payload.condicoes_pagamento, 'PIX 5% desconto ou 30 dias');
  assert.equal(payload.prazo_entrega, 'Envio imediato hoje');
  assert.equal(typeof payload.horario_exibicao, 'string');
  assert.equal(typeof payload.timestamp_ms, 'number');
  assert.equal(payload.frete, 45);
  assert.equal(payload.desconto_percentual, 5);
});

test('toFirestoreOrderPayload produces schema-compliant payload and round-trips paymentTerms/deliveryLeadTime via normalizeFirestoreOrder', () => {
  const order = normalizeFirestoreOrder('PED-STANDALONE-77', {
    id: 'PED-STANDALONE-77',
    protocol: '#PED-2026-7700',
    customerName: 'Auto Mecânica Brasil',
    customerPhone: '5511977776666',
    cityState: 'Campinas / SP',
    vehicleInfo: 'Mercedes-Benz Axor 2544',
    itemsCount: 2,
    items: [
      { sku: 'MNG-001', name: 'Mangueira Alta Pressão', quantity: 2, unitPrice: 150 },
    ],
    status: 'Orçamento Respondido no WhatsApp',
    notes: 'Confirmar rosca JIC',
    freightCost: 60,
    discountPercent: 10,
    paymentTerms: '30/60 dias no boleto',
    deliveryLeadTime: '24 horas via transportadora',
    stockDeducted: false,
  });

  assert.equal(order.paymentTerms, '30/60 dias no boleto');
  assert.equal(order.deliveryLeadTime, '24 horas via transportadora');

  const payload = toFirestoreOrderPayload(order);
  assert.equal(payload.id, 'PED-STANDALONE-77');
  assert.equal(payload.itemsCount, 2);
  assert.equal(payload.paymentTerms, '30/60 dias no boleto');
  assert.equal(payload.deliveryLeadTime, '24 horas via transportadora');
  assert.equal(payload.freightCost, 60);
  assert.equal(payload.discountPercent, 10);
  assert.equal(payload.stockDeducted, false);
});

test('validateProductInput enforces Firestore max lengths and max stock, and toFirestoreProductPayload clamps stock', () => {
  const invalid = validateProductInput({
    sku: 'A'.repeat(65),
    name: 'B'.repeat(201),
    oem: 'C'.repeat(101),
    category: 'Linha Leve (Carros de Passeio)',
    system: 'Componentes de Motor',
    vehicleModel: 'Gol 1.6',
    vehicleYear: '2020',
    application: 'ab',
    stock: 2000000,
  });

  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.sku);
  assert.ok(invalid.errors.name);
  assert.ok(invalid.errors.oem);
  assert.ok(invalid.errors.application);
  assert.ok(invalid.errors.stock);

  const clamped = toFirestoreProductPayload({
    sku: 'SKU-CLAMP',
    name: 'Peça Teste',
    stock: 5000000,
    application: 'ab',
  });
  assert.equal(clamped.stock, 1000000);
  assert.ok(clamped.application.length >= 3);
});

test('calculateQuoteStatusDistribution deduplicates ord-from- and solicitacaoId entries without double counting', () => {
  const sol = normalizeSolicitacaoOrcamento('SOL-UNIQ-1', {
    id: 'SOL-UNIQ-1',
    protocolo: '#COT-2026-1001',
    nome_cliente: 'Cliente Unificado',
    whatsapp: '11999990000',
    dados_veiculo: 'Hilux 2021',
    peca_solicitada: 'Filtro de óleo',
    status: 'pendente',
  });

  const linkedOrder = {
    ...convertSolicitacaoToOrderForPricing(sol),
    protocol: '#PED-DIFERENTE-9999',
  };

  const dist = calculateQuoteStatusDistribution([linkedOrder], [sol], 'all');
  assert.equal(dist.totalActiveQuotes, 1);
  assert.equal(dist.pendenteCount, 1);
});




