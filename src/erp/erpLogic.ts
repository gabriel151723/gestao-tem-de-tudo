export const PRODUCTS_STORAGE_KEY = 'mangueiras_products_db';
export const DELETED_PRODUCTS_STORAGE_KEY = 'mangueiras_deleted_product_ids_v1';
export const ORDERS_STORAGE_KEY = 'mangueiras_orders_db';
export const ERP_SYNC_CHANNEL = 'mangueiras_erp_sync';

export type StockStatus =
  | 'Disponível para Cotação'
  | 'Sob Encomenda'
  | 'Indisponível';

export type OrderStatus =
  | 'Pendente de Análise'
  | 'Orçamento Respondido no WhatsApp'
  | 'Venda Concluída'
  | 'Cancelado';

export const VEHICLE_CATEGORIES: string[] = [
  'Linha Pesada / Diesel (Caminhões e Ônibus)',
  'Máquinas Pesadas & Agrícolas (Tratores, Guindastes, Motoniveladoras)',
  'Utilitários (Pick-ups e Vans)',
  'Linha Leve (Carros de Passeio)',
  'Motos',
  'Embarcações',
];

export const AUTOMOTIVE_SYSTEMS: string[] = [
  'Mangueiras e Conexões',
  'Componentes de Motor',
  'Sistemas de Freio',
  'Suspensão e Direção',
  'Transmissão e Hidráulica',
];

export const STOCK_STATUSES: StockStatus[] = [
  'Disponível para Cotação',
  'Sob Encomenda',
  'Indisponível',
];

export const ORDER_STATUSES: OrderStatus[] = [
  'Pendente de Análise',
  'Orçamento Respondido no WhatsApp',
  'Venda Concluída',
  'Cancelado',
];

/**
 * Estrutura exata exigida pela coleção "products" do Firestore
 * (banco compartilhado com a Landing Page: ai-studio-mangueirasengenh-32e9732f-8e30-4eaf-bc45-b518026cd7f1)
 */
export interface FirestoreProductPayload {
  id: string;
  sku: string;
  name: string;
  oem: string;
  category: string;
  system: string;
  application: string;
  stock: number;
  demo: boolean;
}

export interface Product extends FirestoreProductPayload {
  stockStatus?: StockStatus;
  referencePrice?: number;
  vehicleModel: string;
  vehicleYear: string;
  licensePlate?: string;
  chassis?: string;
}

export interface OrderItem {
  sku: string;
  name: string;
  quantity: number;
  unitPrice?: number;
  catalogProductId?: string;
  catalogSku?: string;
}

export interface Order {
  id: string;
  protocol: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  cityState: string;
  vehicleInfo: string;
  itemsCount: number;
  items: OrderItem[];
  status: OrderStatus;
  notes?: string;
  freightCost?: number;
  discountPercent?: number;
  paymentTerms?: string;
  deliveryLeadTime?: string;
  fromFirestore?: boolean;
  solicitacaoId?: string;
  stockDeducted?: boolean;
  createdAtMs?: number;
  linkedFirestoreOrderId?: string;
}

export interface ProductFilterOptions {
  search: string;
  category: string;
  system: string;
  stockStatus: string;
  modelFilter?: string;
  yearFilter?: string;
  plateSearch?: string;
  chassisSearch?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export function getStockStatusFromQuantity(stock: number): StockStatus {
  const safeStock = Number(stock) || 0;
  if (safeStock > 0) return 'Disponível para Cotação';
  return 'Sob Encomenda';
}

export function sanitizeDocumentId(rawSkuOrId: string): string {
  const cleaned = rawSkuOrId
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '-');
  return cleaned || `MNG-${Date.now()}`;
}

/**
 * Formata automaticamente placa no padrão antigo (ABC-1234) ou Mercosul (ABC1D23)
 */
export function formatLicensePlate(raw: string): string {
  const cleaned = (raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 7);

  if (cleaned.length <= 3) {
    return cleaned;
  }

  const prefix = cleaned.slice(0, 3);
  const rest = cleaned.slice(3);

  // Se os caracteres após as 3 letras forem apenas números, aplica hífen do padrão antigo (ABC-1234)
  if (/^[A-Z]{3}$/.test(prefix) && /^\d+$/.test(rest)) {
    return `${prefix}-${rest}`;
  }

  return `${prefix}${rest}`;
}

export function isValidLicensePlate(plate?: string): boolean {
  const trimmed = (plate ?? '').trim();
  if (!trimmed) return true; // Opcional
  const normalized = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '');
  // Aceita padrão antigo (ABC1234) e Mercosul (ABC1D23)
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(normalized);
}

export function formatChassis(raw: string): string {
  return (raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 17);
}

export function isValidChassis(chassis?: string): boolean {
  const trimmed = (chassis ?? '').trim();
  if (!trimmed) return true; // Opcional
  const normalized = trimmed.toUpperCase().replace(/[^A-Z0-9-]/g, '');
  return normalized.length >= 5 && normalized.length <= 17;
}

const VEHICLE_META_REGEX =
  /^\[Modelo:\s*([^|\]]+?)\s*\|\s*Ano:\s*([^|\]]+?)(?:\s*\|\s*Placa:\s*([^|\]]+?))?(?:\s*\|\s*Chassi:\s*([^|\]]+?))?\]\s*(.*)$/s;

export function stripVehicleMetaFromApplication(rawApplication: string): string {
  const match = (rawApplication || '').trim().match(VEHICLE_META_REGEX);
  if (match) {
    return match[5].trim();
  }
  return (rawApplication || '').trim();
}

export function encodeApplicationWithVehicleMeta(input: {
  application?: string;
  vehicleModel?: string;
  vehicleYear?: string;
  licensePlate?: string;
  chassis?: string;
}): string {
  const cleanApp =
    stripVehicleMetaFromApplication(input.application || '') ||
    'Aplicação sob consulta técnica.';
  const model = (input.vehicleModel || '').trim();
  const year = (input.vehicleYear || '').trim();
  const plate = formatLicensePlate(input.licensePlate || '');
  const chassis = formatChassis(input.chassis || '');

  if (!model && !year) {
    return cleanApp.slice(0, 600);
  }

  const parts = [
    `Modelo: ${model || 'Multimarcas'}`,
    `Ano: ${year || 'Todos'}`,
  ];
  if (plate) parts.push(`Placa: ${plate}`);
  if (chassis) parts.push(`Chassi: ${chassis}`);

  const prefix = `[${parts.join(' | ')}] `;
  return `${prefix}${cleanApp}`.slice(0, 600);
}

export function decodeApplicationVehicleMeta(
  rawApplication: string,
  skuOrId?: string
): {
  vehicleModel: string;
  vehicleYear: string;
  licensePlate: string;
  chassis: string;
  cleanApplication: string;
} {
  const trimmed = (rawApplication || '').trim();
  const normalizedKey = (skuOrId || '').trim().toUpperCase();
  const seedMatch = INITIAL_PRODUCTS.find(
    (p) =>
      p.sku.toUpperCase() === normalizedKey ||
      p.id.toUpperCase() === normalizedKey
  );

  const match = trimmed.match(VEHICLE_META_REGEX);
  if (match) {
    return {
      vehicleModel: match[1].trim(),
      vehicleYear: match[2].trim(),
      licensePlate: match[3]
        ? formatLicensePlate(match[3].trim())
        : seedMatch?.licensePlate || '',
      chassis: match[4]
        ? formatChassis(match[4].trim())
        : seedMatch?.chassis || '',
      cleanApplication: match[5].trim() || trimmed,
    };
  }

  return {
    vehicleModel: seedMatch?.vehicleModel || 'Linha Multimarcas',
    vehicleYear: seedMatch?.vehicleYear || '2015 a 2025',
    licensePlate: seedMatch?.licensePlate || '',
    chassis: seedMatch?.chassis || '',
    cleanApplication: trimmed,
  };
}

/**
 * Garante estritamente apenas os 9 campos permitidos pelas regras de segurança
 * da coleção "products" no Firestore compartilhado com a Landing Page,
 * incorporando Modelo, Ano, Placa e Chassi de forma estruturada.
 */
export function toFirestoreProductPayload(
  input: Partial<Product> & { sku: string; name: string }
): FirestoreProductPayload {
  const cleanId = sanitizeDocumentId(input.id || input.sku).slice(0, 128);
  const safeStock = Math.min(
    1000000,
    Math.max(0, Math.floor(Number(input.stock ?? 0) || 0))
  );
  const encodedApplicationRaw = encodeApplicationWithVehicleMeta({
    application: input.application,
    vehicleModel: input.vehicleModel,
    vehicleYear: input.vehicleYear,
    licensePlate: input.licensePlate,
    chassis: input.chassis,
  });
  const encodedApplication =
    encodedApplicationRaw.length >= 3
      ? encodedApplicationRaw
      : 'Aplicação sob consulta técnica.';

  return {
    id: cleanId,
    sku: (input.sku || cleanId).trim().toUpperCase().slice(0, 64),
    name: input.name.trim().slice(0, 200),
    oem: (input.oem || 'S/REF').trim().slice(0, 100),
    category: (input.category || VEHICLE_CATEGORIES[0]).trim().slice(0, 120),
    system: (input.system || AUTOMOTIVE_SYSTEMS[0]).trim().slice(0, 120),
    application: encodedApplication,
    stock: safeStock,
    demo: Boolean(input.demo ?? false),
  };
}

export const CATEGORY_DEFAULT_UNIT_COST: Record<string, number> = {
  'Linha Pesada / Diesel (Caminhões e Ônibus)': 620.0,
  'Máquinas Pesadas & Agrícolas (Tratores, Guindastes, Motoniveladoras)': 780.0,
  'Utilitários (Pick-ups e Vans)': 540.0,
  'Linha Leve (Carros de Passeio)': 360.0,
  'Motos': 195.0,
  'Embarcações': 610.0,
};

export const DEFAULT_WAREHOUSE_CAPACITY_UNITS = 250;

export function getEstimatedProductUnitValue(product: Partial<Product>): number {
  const explicitPrice = Number(product.referencePrice ?? 0);
  if (Number.isFinite(explicitPrice) && explicitPrice > 0) {
    return explicitPrice;
  }
  const skuKey = String(product.sku || product.id || '').trim().toUpperCase();
  const knownProduct = INITIAL_PRODUCTS.find(
    (p) => p.sku.toUpperCase() === skuKey || p.id.toUpperCase() === skuKey
  );
  if (knownProduct?.referencePrice && knownProduct.referencePrice > 0) {
    return knownProduct.referencePrice;
  }
  const categoryCost = product.category
    ? CATEGORY_DEFAULT_UNIT_COST[product.category]
    : undefined;
  return categoryCost ?? 450.0;
}

export function normalizeFirestoreProduct(
  docId: string,
  raw: Record<string, unknown>
): Product {
  const stockNum = Math.max(0, Number(raw.stock ?? 0) || 0);
  const id = String(raw.id || docId);
  const sku = String(raw.sku || docId);
  const category = String(raw.category || VEHICLE_CATEGORIES[0]);
  const rawPrice = Number(raw.referencePrice ?? raw.unitPrice ?? raw.costPrice ?? 0);
  const referencePrice =
    Number.isFinite(rawPrice) && rawPrice > 0
      ? rawPrice
      : getEstimatedProductUnitValue({ id, sku, category });

  const decoded = decodeApplicationVehicleMeta(
    String(raw.application || ''),
    sku
  );

  const vehicleModel =
    typeof raw.vehicleModel === 'string' && raw.vehicleModel.trim()
      ? raw.vehicleModel.trim()
      : decoded.vehicleModel;

  const vehicleYear =
    typeof raw.vehicleYear === 'string' && raw.vehicleYear.trim()
      ? raw.vehicleYear.trim()
      : decoded.vehicleYear;

  const licensePlate =
    typeof raw.licensePlate === 'string' && raw.licensePlate.trim()
      ? formatLicensePlate(raw.licensePlate)
      : decoded.licensePlate;

  const chassis =
    typeof raw.chassis === 'string' && raw.chassis.trim()
      ? formatChassis(raw.chassis)
      : decoded.chassis;

  return {
    id,
    sku,
    name: String(raw.name || 'Peça Automotiva'),
    oem: String(raw.oem || 'S/REF'),
    category,
    system: String(raw.system || AUTOMOTIVE_SYSTEMS[0]),
    application: decoded.cleanApplication,
    stock: stockNum,
    demo: Boolean(raw.demo ?? false),
    stockStatus: getStockStatusFromQuantity(stockNum),
    referencePrice,
    vehicleModel,
    vehicleYear,
    licensePlate,
    chassis,
  };
}

export function normalizeFirestoreOrder(
  docId: string,
  raw: Record<string, unknown>
): Order {
  const rawCreatedAt = raw.createdAt as
    | { toDate?: () => Date; seconds?: number }
    | string
    | undefined;

  let formattedDate = 'Recente';
  let createdAtMs: number | undefined;
  if (rawCreatedAt && typeof rawCreatedAt === 'object') {
    if (typeof rawCreatedAt.toDate === 'function') {
      const d = rawCreatedAt.toDate();
      formattedDate = `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR')}`;
      createdAtMs = d.getTime();
    } else if (typeof rawCreatedAt.seconds === 'number') {
      const d = new Date(rawCreatedAt.seconds * 1000);
      formattedDate = `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR')}`;
      createdAtMs = d.getTime();
    }
  } else if (typeof rawCreatedAt === 'string' && rawCreatedAt.trim()) {
    formattedDate = rawCreatedAt.trim();
    const parsedIso = Date.parse(formattedDate);
    if (!Number.isNaN(parsedIso)) {
      createdAtMs = parsedIso;
    }
  }
  if (createdAtMs === undefined && typeof raw.timestamp_ms === 'number' && Number.isFinite(raw.timestamp_ms)) {
    createdAtMs = raw.timestamp_ms;
  }

  let parsedItems: OrderItem[] = [];
  if (Array.isArray(raw.items)) {
    parsedItems = raw.items.map((it: Record<string, unknown>, idx: number) => ({
      sku: String(it?.sku || it?.id || `ITEM-${idx + 1}`),
      name: String(it?.name || it?.title || 'Peça solicitada na Landing Page'),
      quantity: Math.max(1, Number(it?.quantity ?? it?.qty ?? 1) || 1),
      unitPrice: Number(it?.unitPrice ?? it?.price ?? 0) || 0,
      ...(typeof it?.catalogProductId === 'string' && it.catalogProductId
        ? { catalogProductId: it.catalogProductId }
        : {}),
      ...(typeof it?.catalogSku === 'string' && it.catalogSku
        ? { catalogSku: it.catalogSku }
        : {}),
    }));
  } else if (typeof raw.itemsSummary === 'string' && raw.itemsSummary.trim()) {
    parsedItems = [
      {
        sku: 'COTACAO-LP',
        name: raw.itemsSummary.trim(),
        quantity: Math.max(1, Number(raw.itemsCount ?? 1) || 1),
        unitPrice: 0,
      },
    ];
  }

  if (parsedItems.length === 0) {
    parsedItems = [
      {
        sku: String(raw.sku || 'MNG-ITEM'),
        name: String(raw.productName || raw.itemsText || 'Itens solicitados via Landing Page'),
        quantity: Math.max(1, Number(raw.itemsCount ?? 1) || 1),
        unitPrice: 0,
      },
    ];
  }

  const rawStatus = String(raw.status || '').toLowerCase();
  let status: OrderStatus = 'Pendente de Análise';
  if (rawStatus.includes('whatsapp') || rawStatus.includes('respondido') || rawStatus === 'replied') {
    status = 'Orçamento Respondido no WhatsApp';
  } else if (rawStatus.includes('conclu') || rawStatus === 'completed' || rawStatus === 'approved') {
    status = 'Venda Concluída';
  } else if (rawStatus.includes('cancel')) {
    status = 'Cancelado';
  }

  const itemsCount = Math.max(
    1,
    Number(
      raw.itemsCount ??
        parsedItems.reduce((acc, item) => acc + item.quantity, 0)
    ) || 1
  );

  const rawProtocol = String(
    raw.protocol || raw.orderCode || `#PED-${docId.slice(0, 8).toUpperCase()}`
  );

  return {
    id: String(raw.id || docId),
    protocol: rawProtocol.startsWith('#') ? rawProtocol : `#${rawProtocol}`,
    createdAt: formattedDate,
    customerName: String(
      raw.customerName || raw.name || raw.clientName || 'Cliente Landing Page'
    ),
    customerPhone: String(
      raw.customerPhone || raw.phone || raw.whatsapp || 'Não informado'
    ),
    cityState: String(
      raw.cityState || raw.customerCity || raw.city || 'Brasil'
    ),
    vehicleInfo: String(
      raw.vehicleInfo || raw.vehicle || raw.machine || 'Informado no pedido'
    ),
    itemsCount,
    items: parsedItems,
    status,
    notes: raw.notes ? String(raw.notes) : undefined,
    freightCost: Number(raw.freightCost ?? 0) || 0,
    discountPercent: Number(raw.discountPercent ?? 0) || 0,
    ...(typeof raw.paymentTerms === 'string' && raw.paymentTerms.trim()
      ? { paymentTerms: raw.paymentTerms.trim() }
      : {}),
    ...(typeof raw.deliveryLeadTime === 'string' && raw.deliveryLeadTime.trim()
      ? { deliveryLeadTime: raw.deliveryLeadTime.trim() }
      : {}),
    fromFirestore: true,
    stockDeducted: Boolean(raw.stockDeducted ?? false),
    ...(typeof raw.solicitacaoId === 'string' && raw.solicitacaoId
      ? { solicitacaoId: raw.solicitacaoId }
      : {}),
    ...(createdAtMs !== undefined ? { createdAtMs } : {}),
  };
}

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'MNG-MOT-001',
    sku: 'MNG-MOT-001',
    name: 'Kit Pistão e Anéis Diesel Forged',
    oem: 'A3660300417',
    category: 'Linha Pesada / Diesel (Caminhões e Ônibus)',
    system: 'Componentes de Motor',
    vehicleModel: 'Mercedes-Benz 1620 / OM 366',
    vehicleYear: '1996 a 2011',
    licensePlate: 'MNG-1620',
    chassis: '9BM384078YB123456',
    application: 'Motor Mercedes-Benz OM 366 / OM 352; caminhões e ônibus rodoviários. Confirmar diâmetro, sobremedida e versão.',
    stock: 8,
    demo: true,
    stockStatus: 'Disponível para Cotação',
    referencePrice: 1890.00,
  },
  {
    id: 'MNG-MOT-002',
    sku: 'MNG-MOT-002',
    name: 'Filtro de Óleo Blindado Linha Diesel',
    oem: 'LF16015',
    category: 'Linha Pesada / Diesel (Caminhões e Ônibus)',
    system: 'Componentes de Motor',
    vehicleModel: 'VW Constellation 24.280 / Cummins ISF',
    vehicleYear: '2012 a 2023',
    licensePlate: '',
    chassis: '',
    application: 'Motores Cummins ISF 3.8 e Série C; linha de caminhões leves e médios. Confirmar rosca e referência do filtro.',
    stock: 24,
    demo: true,
    stockStatus: 'Disponível para Cotação',
    referencePrice: 145.00,
  },
  {
    id: 'MNG-FRE-003',
    sku: 'MNG-FRE-003',
    name: 'Válvula Pneumática Pedal de Freio',
    oem: 'II-35197',
    category: 'Linha Pesada / Diesel (Caminhões e Ônibus)',
    system: 'Sistemas de Freio',
    vehicleModel: 'Scania R440 / Série R',
    vehicleYear: '2014 a 2022',
    licensePlate: 'RTA4B18',
    chassis: '9BSR6X400E3849102',
    application: 'Sistemas de freio a ar de caminhões e ônibus pesados. Conferir circuito duplo, pressão de trabalho e conexões.',
    stock: 4,
    demo: true,
    stockStatus: 'Disponível para Cotação',
    referencePrice: 540.00,
  },
  {
    id: 'MNG-HID-004',
    sku: 'MNG-HID-004',
    name: 'Bomba Hidráulica de Engrenagens Dupla',
    oem: '9510080',
    category: 'Máquinas Pesadas & Agrícolas (Tratores, Guindastes, Motoniveladoras)',
    system: 'Transmissão e Hidráulica',
    vehicleModel: 'Case IH Magnum 340 / Pá W20E',
    vehicleYear: '2017 a 2024',
    licensePlate: '',
    chassis: 'JJC0340MGH0098123',
    application: 'Tratores agrícolas, pás-carregadeiras e motoniveladoras. Conferir vazão (cm³/rev), flange SAE, eixo estriado e rotação.',
    stock: 0,
    demo: true,
    stockStatus: 'Sob Encomenda',
    referencePrice: 2480.00,
  },
  {
    id: 'MNG-MOT-005',
    sku: 'MNG-MOT-005',
    name: 'Filtro Separador de Água e Combustível',
    oem: 'R120LJ-10M',
    category: 'Máquinas Pesadas & Agrícolas (Tratores, Guindastes, Motoniveladoras)',
    system: 'Componentes de Motor',
    vehicleModel: 'John Deere S680 / Série 8R',
    vehicleYear: '2016 a 2024',
    licensePlate: '',
    chassis: '',
    application: 'Tratores, colheitadeiras e escavadeiras com motores diesel de alta pressão Common Rail.',
    stock: 16,
    demo: true,
    stockStatus: 'Disponível para Cotação',
    referencePrice: 210.00,
  },
  {
    id: 'MNG-SUS-006',
    sku: 'MNG-SUS-006',
    name: 'Amortecedor Dianteiro Pressurizado Heavy-Duty',
    oem: '48510-09A10',
    category: 'Utilitários (Pick-ups e Vans)',
    system: 'Suspensão e Direção',
    vehicleModel: 'Toyota Hilux 2.8 Diesel 4x4',
    vehicleYear: '2016 a 2024',
    licensePlate: 'FTR8H22',
    chassis: '8AJBA8CD6K0918273',
    application: 'Toyota Hilux 2.8 Diesel 4x4 e utilitários de carga; verificar ano, versão e posição antes da compra.',
    stock: 6,
    demo: true,
    stockStatus: 'Disponível para Cotação',
    referencePrice: 680.00,
  },
  {
    id: 'MNG-MOT-007',
    sku: 'MNG-MOT-007',
    name: 'Kit Correia Dentada e Tensor Rolamentado',
    oem: '030198119E',
    category: 'Linha Leve (Carros de Passeio)',
    system: 'Componentes de Motor',
    vehicleModel: 'VW Gol / Saveiro / Voyage 1.6',
    vehicleYear: '2013 a 2022',
    licensePlate: '',
    chassis: '',
    application: 'Volkswagen Gol, Voyage, Saveiro e Fox com motor EA111 1.0/1.6 8V. Conferir ano e código do motor.',
    stock: 12,
    demo: true,
    stockStatus: 'Disponível para Cotação',
    referencePrice: 320.00,
  },
  {
    id: 'MNG-FRE-008',
    sku: 'MNG-FRE-008',
    name: 'Disco de Freio Dianteiro Ventilado e Perfurado',
    oem: '94752854',
    category: 'Linha Leve (Carros de Passeio)',
    system: 'Sistemas de Freio',
    vehicleModel: 'Chevrolet Onix / Prisma 1.4',
    vehicleYear: '2015 a 2020',
    licensePlate: '',
    chassis: '',
    application: 'Chevrolet Onix, Prisma e utilitários leves. Liga de alto carbono com aletas internas de dissipação térmica.',
    stock: 10,
    demo: true,
    stockStatus: 'Disponível para Cotação',
    referencePrice: 480.00,
  },
  {
    id: 'MNG-TRA-009',
    sku: 'MNG-TRA-009',
    name: 'Kit Relação Transmissão Aço 1045 Temperado',
    oem: '06406-KRE-G01',
    category: 'Motos',
    system: 'Transmissão e Hidráulica',
    vehicleModel: 'Honda CG 160 / NXR Bros 160',
    vehicleYear: '2016 a 2025',
    licensePlate: '',
    chassis: '',
    application: 'Honda CG 160 / Bros 160; conjunto corrente retentorizada, coroa e pinhão usinados. Conferir passo e dentição.',
    stock: 14,
    demo: true,
    stockStatus: 'Disponível para Cotação',
    referencePrice: 195.00,
  },
  {
    id: 'MNG-MAN-010',
    sku: 'MNG-MAN-010',
    name: 'Mangueira Hidráulica Alta Pressão SAE 100R2AT / 2SN',
    oem: 'DIN-EN853-2SN',
    category: 'Máquinas Pesadas & Agrícolas (Tratores, Guindastes, Motoniveladoras)',
    system: 'Mangueiras e Conexões',
    vehicleModel: 'Valtra BH210 / John Deere 8R',
    vehicleYear: '2018 a 2025',
    licensePlate: '',
    chassis: '',
    application: 'Linha hidráulica de máquinas pesadas; bitola 1/2 pol, dupla trama de aço de alta tenacidade. Prensagem sob medida.',
    stock: 30,
    demo: true,
    stockStatus: 'Disponível para Cotação',
    referencePrice: 385.00,
  },
  {
    id: 'MNG-MAN-011',
    sku: 'MNG-MAN-011',
    name: 'Conexão Hidráulica Prensável JIC 37° Fêmea Giratória',
    oem: 'JIC-37F-08',
    category: 'Linha Pesada / Diesel (Caminhões e Ônibus)',
    system: 'Mangueiras e Conexões',
    vehicleModel: 'Volvo FH 540 / Implementos Randon',
    vehicleYear: '2015 a 2025',
    licensePlate: '',
    chassis: '',
    application: 'Terminais de alta pressão para mangueiras de implementos rodoviários, guindastes e caminhões basculantes.',
    stock: 40,
    demo: true,
    stockStatus: 'Disponível para Cotação',
    referencePrice: 95.00,
  },
  {
    id: 'MNG-MOT-012',
    sku: 'MNG-MOT-012',
    name: 'Rotor de Bomba de Água Marítima em Neoprene',
    oem: '3862567',
    category: 'Embarcações',
    system: 'Componentes de Motor',
    vehicleModel: 'Volvo Penta D4 / D6 Marítimo',
    vehicleYear: '2014 a 2024',
    licensePlate: '',
    chassis: '',
    application: 'Sistema de arrefecimento de motores centro-rabeta e diesel marítimo. Conferir eixo estriado e número de pás.',
    stock: 0,
    demo: true,
    stockStatus: 'Sob Encomenda',
    referencePrice: 610.00,
  },
];

export const INITIAL_ORDERS: Order[] = [
  {
    id: 'ord-01',
    protocol: '#PED-2026-8491',
    createdAt: '03/11/2026 às 09:14:22',
    customerName: 'Transportadora TransRota Sul (Marcos Vinicius)',
    customerPhone: '5541998421109',
    cityState: 'Curitiba / PR',
    vehicleInfo: 'Scania R440 6x4 Streamline 2018 (Frota #14)',
    itemsCount: 6,
    items: [
      {
        sku: 'MNG-FRE-003',
        name: 'Válvula Pneumática Pedal de Freio',
        quantity: 2,
        unitPrice: 540.00,
      },
      {
        sku: 'MNG-MAN-011',
        name: 'Conexão Hidráulica Prensável JIC 37° Fêmea Giratória',
        quantity: 4,
        unitPrice: 95.00,
      },
    ],
    status: 'Pendente de Análise',
    notes: 'Caminhão parado no pátio aguardando cotação urgente para liberação de viagem.',
    freightCost: 85.00,
    discountPercent: 5,
    paymentTerms: 'PIX c/ 5% desc. ou Boleto 28 DDL Faturado CNPJ',
    deliveryLeadTime: 'Envio imediato — Balcão ou Motoboy Expresso',
  },
  {
    id: 'ord-02',
    protocol: '#PED-2026-8488',
    createdAt: '03/11/2026 às 08:42:10',
    customerName: 'Agropecuária Santa Helena (Eng. Rodrigo Bastos)',
    customerPhone: '5566999154420',
    cityState: 'Sorriso / MT',
    vehicleInfo: 'Colheitadeira John Deere S680 + Trator Case Magnum 340',
    itemsCount: 7,
    items: [
      {
        sku: 'MNG-MAN-010',
        name: 'Mangueira Hidráulica Alta Pressão SAE 100R2AT / 2SN',
        quantity: 6,
        unitPrice: 385.00,
      },
      {
        sku: 'MNG-HID-004',
        name: 'Bomba Hidráulica de Engrenagens Dupla',
        quantity: 1,
        unitPrice: 2480.00,
      },
    ],
    status: 'Orçamento Respondido no WhatsApp',
    notes: 'Prensar terminais JIC fêmea giratórios 90 graus nas pontas de 3 mangueiras.',
    freightCost: 210.00,
    discountPercent: 7,
    paymentTerms: 'Faturado 30/60 dias ou PIX à vista',
    deliveryLeadTime: 'Despacho via Transportadora Rodonaves Hoje às 16h',
  },
  {
    id: 'ord-03',
    protocol: '#PED-2026-8475',
    createdAt: '02/11/2026 às 16:28:05',
    customerName: 'Oficina Diesel Forte (Cláudio Ferreira)',
    customerPhone: '5511987443012',
    cityState: 'Guarulhos / SP',
    vehicleInfo: 'Mercedes-Benz OM 366 + Toyota Hilux 2.8 4x4',
    itemsCount: 3,
    items: [
      {
        sku: 'MNG-MOT-001',
        name: 'Kit Pistão e Anéis Diesel Forged',
        quantity: 1,
        unitPrice: 1890.00,
      },
      {
        sku: 'MNG-SUS-006',
        name: 'Amortecedor Dianteiro Pressurizado Heavy-Duty',
        quantity: 2,
        unitPrice: 680.00,
      },
    ],
    status: 'Venda Concluída',
    notes: 'Cliente retirou no balcão técnico com nota fiscal emitida.',
    freightCost: 0,
    discountPercent: 5,
    paymentTerms: 'PIX confirmado no ato da retirada',
    deliveryLeadTime: 'Retirada Imediata no Balcão',
  },
];

export function validateProductInput(input: {
  sku?: string;
  name?: string;
  oem?: string;
  category?: string;
  system?: string;
  vehicleModel?: string;
  vehicleYear?: string;
  licensePlate?: string;
  chassis?: string;
  application?: string;
  stock?: string | number;
}): ValidationResult {
  const errors: Record<string, string> = {};

  const sku = (input.sku ?? '').trim();
  const name = (input.name ?? '').trim();
  const oem = (input.oem ?? '').trim();
  const category = (input.category ?? '').trim();
  const system = (input.system ?? '').trim();
  const vehicleModel = (input.vehicleModel ?? '').trim();
  const vehicleYear = (input.vehicleYear ?? '').trim();
  const licensePlate = (input.licensePlate ?? '').trim();
  const chassis = (input.chassis ?? '').trim();
  const application = (input.application ?? '').trim();

  if (!sku) {
    errors.sku = 'Informe o código SKU da peça (ex: MNG-MAN-010).';
  } else if (sku.length < 2) {
    errors.sku = 'O SKU deve conter pelo menos 2 caracteres.';
  } else if (sku.length > 64) {
    errors.sku = 'O SKU deve ter no máximo 64 caracteres.';
  } else if (!/^[a-zA-Z0-9_-]+$/.test(sku)) {
    errors.sku = 'Use apenas letras, números, hífen (-) ou sublinhado (_).';
  }

  if (!name) {
    errors.name = 'Informe o nome comercial/técnico da peça.';
  } else if (name.length < 3) {
    errors.name = 'O nome da peça deve conter pelo menos 3 caracteres.';
  } else if (name.length > 200) {
    errors.name = 'O nome da peça deve ter no máximo 200 caracteres.';
  }

  if (!oem) {
    errors.oem = 'Informe o código de referência ou fabricante.';
  } else if (oem.length > 100) {
    errors.oem = 'O código de referência deve ter no máximo 100 caracteres.';
  }

  if (!category) {
    errors.category = 'Selecione uma categoria de veículo.';
  }

  if (!system) {
    errors.system = 'Selecione um sistema automotivo.';
  }

  if (!vehicleModel) {
    errors.vehicleModel =
      'Informe o Modelo do veículo ou máquina (ex: Scania R440, Hilux 2.8).';
  } else if (vehicleModel.length < 2) {
    errors.vehicleModel = 'O modelo deve conter pelo menos 2 caracteres.';
  }

  if (!vehicleYear) {
    errors.vehicleYear =
      'Informe o Ano ou faixa de anos (ex: 2018 a 2024 ou 2021).';
  } else if (vehicleYear.length < 2) {
    errors.vehicleYear = 'Informe um ano ou intervalo válido.';
  }

  if (licensePlate && !isValidLicensePlate(licensePlate)) {
    errors.licensePlate =
      'Placa inválida. Use o padrão Mercosul (ABC1D23) ou antigo (ABC-1234).';
  }

  if (chassis && !isValidChassis(chassis)) {
    errors.chassis =
      'Chassi inválido. Informe entre 5 e 17 caracteres alfanuméricos.';
  }

  if (!application) {
    errors.application =
      'Descreva a aplicação detalhada (motores e especificações técnicas).';
  } else if (application.length < 3) {
    errors.application =
      'A aplicação detalhada deve conter pelo menos 3 caracteres.';
  } else if (application.length > 600) {
    errors.application =
      'A aplicação detalhada deve ter no máximo 600 caracteres.';
  }

  const parsedStock = Number(input.stock ?? 0);
  if (
    input.stock === '' ||
    Number.isNaN(parsedStock) ||
    !Number.isFinite(parsedStock) ||
    parsedStock < 0
  ) {
    errors.stock = 'O estoque deve ser um número inteiro maior ou igual a 0.';
  } else if (parsedStock > 1000000) {
    errors.stock = 'O estoque máximo permitido por item é 1.000.000 unidades.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function filterProducts(
  products: Product[],
  filters: ProductFilterOptions
): Product[] {
  const query = (filters.search ?? '').trim().toLowerCase();
  const category = filters.category ?? 'ALL';
  const system = filters.system ?? 'ALL';
  const stockStatus = filters.stockStatus ?? 'ALL';
  const modelFilter = (filters.modelFilter ?? 'ALL').trim();
  const yearFilter = (filters.yearFilter ?? 'ALL').trim();
  const plateQuery = (filters.plateSearch ?? '').trim().toLowerCase();
  const plateQueryRaw = plateQuery.replace(/[^a-z0-9]/g, '');
  const chassisQuery = (filters.chassisSearch ?? '').trim().toLowerCase();
  const chassisQueryRaw = chassisQuery.replace(/[^a-z0-9]/g, '');

  return products.filter((item) => {
    const derivedStatus =
      item.stockStatus || getStockStatusFromQuantity(item.stock);

    const modelText = (item.vehicleModel || '').toLowerCase();
    const yearText = (item.vehicleYear || '').toLowerCase();
    const plateText = (item.licensePlate || '').toLowerCase();
    const plateRaw = plateText.replace(/[^a-z0-9]/g, '');
    const chassisText = (item.chassis || '').toLowerCase();
    const chassisRaw = chassisText.replace(/[^a-z0-9]/g, '');
    const queryRaw = query.replace(/[^a-z0-9]/g, '');

    const matchesSearch =
      !query ||
      item.sku.toLowerCase().includes(query) ||
      item.id.toLowerCase().includes(query) ||
      item.oem.toLowerCase().includes(query) ||
      item.name.toLowerCase().includes(query) ||
      item.application.toLowerCase().includes(query) ||
      item.system.toLowerCase().includes(query) ||
      modelText.includes(query) ||
      yearText.includes(query) ||
      plateText.includes(query) ||
      (queryRaw.length >= 3 && plateRaw.includes(queryRaw)) ||
      chassisText.includes(query) ||
      (queryRaw.length >= 3 && chassisRaw.includes(queryRaw));

    const matchesPlate =
      !plateQuery ||
      plateText.includes(plateQuery) ||
      (plateQueryRaw.length >= 1 && plateRaw.includes(plateQueryRaw));

    const matchesChassis =
      !chassisQuery ||
      chassisText.includes(chassisQuery) ||
      (chassisQueryRaw.length >= 1 && chassisRaw.includes(chassisQueryRaw));

    const matchesCategory =
      category === 'ALL' ||
      !category ||
      item.category === category ||
      item.category.toLowerCase().includes(category.toLowerCase());

    const matchesSystem =
      system === 'ALL' ||
      !system ||
      item.system === system ||
      item.system.toLowerCase().includes(system.toLowerCase());

    const matchesStock =
      stockStatus === 'ALL' ||
      !stockStatus ||
      derivedStatus === stockStatus;

    const matchesModel =
      modelFilter === 'ALL' ||
      !modelFilter ||
      item.vehicleModel === modelFilter ||
      modelText.includes(modelFilter.toLowerCase());

    const matchesYear =
      yearFilter === 'ALL' ||
      !yearFilter ||
      item.vehicleYear === yearFilter ||
      yearText.includes(yearFilter.toLowerCase());

    return (
      matchesSearch &&
      matchesPlate &&
      matchesChassis &&
      matchesCategory &&
      matchesSystem &&
      matchesStock &&
      matchesModel &&
      matchesYear
    );
  });
}

export interface CategoryStockItem {
  category: string;
  shortLabel: string;
  count: number;
  totalStock: number;
  percentage: number;
}

export type QuoteStatusKey = 'pendente' | 'respondido' | 'fechado';

export interface QuoteStatusSlice {
  key: QuoteStatusKey;
  label: 'Pendente' | 'Respondido' | 'Fechado';
  fullStatusLabel: string;
  count: number;
  percentage: number;
  color: string;
}

export interface QuoteStatusDistribution {
  totalActiveQuotes: number;
  pendenteCount: number;
  respondidoCount: number;
  fechadoCount: number;
  slices: QuoteStatusSlice[];
}

export function calculateQuoteStatusDistribution(
  orders: Order[],
  solicitacoes: SolicitacaoOrcamento[] = [],
  source: 'all' | 'orders' | 'mural' = 'all'
): QuoteStatusDistribution {
  let pendenteCount = 0;
  let respondidoCount = 0;
  let fechadoCount = 0;

  if (source === 'orders' || source === 'all') {
    for (const order of orders) {
      if (order.status === 'Pendente de Análise') {
        pendenteCount += 1;
      } else if (order.status === 'Orçamento Respondido no WhatsApp') {
        respondidoCount += 1;
      } else if (order.status === 'Venda Concluída') {
        fechadoCount += 1;
      }
    }
  }

  if (source === 'mural') {
    for (const sol of solicitacoes) {
      if (sol.status === 'pendente') {
        pendenteCount += 1;
      } else if (sol.status === 'respondido') {
        respondidoCount += 1;
      } else if (sol.status === 'fechado') {
        fechadoCount += 1;
      }
    }
  } else if (source === 'all') {
    const orderKeys = new Set(
      orders.flatMap((o) => {
        const keys = [
          o.id.toLowerCase(),
          o.protocol.toLowerCase(),
          o.id.replace(/^ord-from-/, '').toLowerCase(),
          o.id.replace(/^order-/, '').toLowerCase(),
        ];
        if (o.solicitacaoId) {
          keys.push(o.solicitacaoId.toLowerCase());
        }
        return keys;
      })
    );
    for (const sol of solicitacoes) {
      const solIdKey = sol.id.toLowerCase();
      const solProtoKey = (sol.protocolo || '').toLowerCase();
      if (orderKeys.has(solIdKey) || (solProtoKey && orderKeys.has(solProtoKey))) {
        continue;
      }
      if (sol.status === 'pendente') {
        pendenteCount += 1;
      } else if (sol.status === 'respondido') {
        respondidoCount += 1;
      } else if (sol.status === 'fechado') {
        fechadoCount += 1;
      }
    }
  }

  const totalActiveQuotes = pendenteCount + respondidoCount + fechadoCount;
  const pct = (val: number) =>
    totalActiveQuotes > 0 ? Math.round((val / totalActiveQuotes) * 100) : 0;

  const slices: QuoteStatusSlice[] = [
    {
      key: 'pendente',
      label: 'Pendente',
      fullStatusLabel: 'Pendente de Análise / Cotação',
      count: pendenteCount,
      percentage: pct(pendenteCount),
      color: '#F97316',
    },
    {
      key: 'respondido',
      label: 'Respondido',
      fullStatusLabel: 'Orçamento Respondido no WhatsApp',
      count: respondidoCount,
      percentage: pct(respondidoCount),
      color: '#38BDF8',
    },
    {
      key: 'fechado',
      label: 'Fechado',
      fullStatusLabel: 'Venda Concluída / Fechado',
      count: fechadoCount,
      percentage: pct(fechadoCount),
      color: '#10B981',
    },
  ];

  return {
    totalActiveQuotes,
    pendenteCount,
    respondidoCount,
    fechadoCount,
    slices,
  };
}

export interface DashboardMetrics {
  totalProducts: number;
  totalUnitsInStock: number;
  availableProducts: number;
  onOrderProducts: number;
  unavailableProducts: number;
  estimatedInventoryValue: number;
  averageUnitValue: number;
  warehouseCapacityUnits: number;
  stockOccupancyRate: number;
  skuAvailabilityRate: number;
  totalOrders: number;
  pendingOrders: number;
  repliedOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  completedRevenue: number;
  pendingPipelineValue: number;
  categoryBreakdown: CategoryStockItem[];
}

export function getShortCategoryLabel(category: string): string {
  if (category.startsWith('Linha Pesada')) return 'Linha Pesada';
  if (category.startsWith('Máquinas')) return 'Agrícola / Pesada';
  if (category.startsWith('Utilitários')) return 'Utilitários';
  if (category.startsWith('Linha Leve')) return 'Linha Leve';
  return category.length > 18 ? `${category.slice(0, 16)}…` : category;
}

export function calculateDashboardMetrics(
  products: Product[],
  orders: Order[]
): DashboardMetrics {
  const totalProducts = products.length;
  const totalUnitsInStock = products.reduce(
    (sum, p) => sum + Math.max(0, Number(p.stock) || 0),
    0
  );
  const availableProducts = products.filter((p) => (p.stock ?? 0) > 0).length;
  const onOrderProducts = products.filter((p) => (p.stock ?? 0) === 0).length;
  const unavailableProducts = 0;

  const estimatedInventoryValue = Number(
    products
      .reduce((sum, p) => {
        const qty = Math.max(0, Number(p.stock) || 0);
        const unitVal = getEstimatedProductUnitValue(p);
        return sum + qty * unitVal;
      }, 0)
      .toFixed(2)
  );

  const averageUnitValue =
    totalUnitsInStock > 0
      ? Number((estimatedInventoryValue / totalUnitsInStock).toFixed(2))
      : 0;

  const warehouseCapacityUnits = Math.max(
    DEFAULT_WAREHOUSE_CAPACITY_UNITS,
    totalProducts * 20
  );

  const stockOccupancyRate =
    warehouseCapacityUnits > 0
      ? Math.min(
          100,
          Math.round((totalUnitsInStock / warehouseCapacityUnits) * 100)
        )
      : 0;

  const skuAvailabilityRate =
    totalProducts > 0
      ? Math.round((availableProducts / totalProducts) * 100)
      : 0;

  const totalOrders = orders.length;
  const pendingOrders = orders.filter(
    (o) => o.status === 'Pendente de Análise'
  ).length;
  const repliedOrders = orders.filter(
    (o) => o.status === 'Orçamento Respondido no WhatsApp'
  ).length;
  const completedOrders = orders.filter(
    (o) => o.status === 'Venda Concluída'
  ).length;
  const cancelledOrders = orders.filter(
    (o) => o.status === 'Cancelado'
  ).length;

  const computeOrderNet = (order: Order): number => {
    const priceMap: Record<string, number> = {};
    for (const item of order.items) {
      priceMap[item.sku] = item.unitPrice ?? 0;
    }
    return calculateQuoteTotals(
      order.items,
      priceMap,
      order.discountPercent ?? 0,
      order.freightCost ?? 0
    ).finalTotal;
  };

  const completedRevenue = orders
    .filter((o) => o.status === 'Venda Concluída')
    .reduce((acc, o) => acc + computeOrderNet(o), 0);

  const pendingPipelineValue = orders
    .filter(
      (o) =>
        o.status === 'Pendente de Análise' ||
        o.status === 'Orçamento Respondido no WhatsApp'
    )
    .reduce((acc, o) => acc + computeOrderNet(o), 0);

  // Agrupa por categorias conhecidas + categorias dinâmicas do Firestore
  const allCategories = Array.from(
    new Set([...VEHICLE_CATEGORIES, ...products.map((p) => p.category)])
  );

  const categoryBreakdown: CategoryStockItem[] = allCategories.map((category) => {
    const categoryProducts = products.filter((p) => p.category === category);
    const count = categoryProducts.length;
    const totalStock = categoryProducts.reduce(
      (acc, p) => acc + Math.max(0, Number(p.stock) || 0),
      0
    );
    const percentage =
      totalProducts > 0 ? Math.round((count / totalProducts) * 100) : 0;
    return {
      category,
      shortLabel: getShortCategoryLabel(category),
      count,
      totalStock,
      percentage,
    };
  });

  return {
    totalProducts,
    totalUnitsInStock,
    availableProducts,
    onOrderProducts,
    unavailableProducts,
    estimatedInventoryValue,
    averageUnitValue,
    warehouseCapacityUnits,
    stockOccupancyRate,
    skuAvailabilityRate,
    totalOrders,
    pendingOrders,
    repliedOrders,
    completedOrders,
    cancelledOrders,
    completedRevenue,
    pendingPipelineValue,
    categoryBreakdown,
  };
}

export interface QuoteCalculation {
  itemsSubtotal: number;
  discountAmount: number;
  freightCost: number;
  finalTotal: number;
}

export function calculateQuoteTotals(
  items: OrderItem[],
  unitPrices: Record<string, number>,
  discountPercent = 0,
  freightCost = 0
): QuoteCalculation {
  const itemsSubtotal = items.reduce((sum, item) => {
    const unit = Number(unitPrices[item.sku] ?? item.unitPrice ?? 0);
    const safeUnit = Number.isFinite(unit) && unit >= 0 ? unit : 0;
    const qty = Math.max(1, Number(item.quantity) || 1);
    return sum + safeUnit * qty;
  }, 0);

  const clampedDiscountPct = Math.min(
    100,
    Math.max(0, Number(discountPercent) || 0)
  );
  const safeFreight = Math.max(0, Number(freightCost) || 0);

  const discountAmount = Number(
    ((itemsSubtotal * clampedDiscountPct) / 100).toFixed(2)
  );
  const finalTotal = Number(
    Math.max(0, itemsSubtotal - discountAmount + safeFreight).toFixed(2)
  );

  return {
    itemsSubtotal: Number(itemsSubtotal.toFixed(2)),
    discountAmount,
    freightCost: Number(safeFreight.toFixed(2)),
    finalTotal,
  };
}

export function formatCurrencyBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function generateWhatsAppQuoteMessage(
  order: Order,
  unitPrices: Record<string, number>,
  options?: {
    discountPercent?: number;
    freightCost?: number;
    paymentTerms?: string;
    deliveryLeadTime?: string;
    sellerNote?: string;
  }
): string {
  const discountPct = options?.discountPercent ?? order.discountPercent ?? 0;
  const freight = options?.freightCost ?? order.freightCost ?? 0;
  const paymentTerms =
    options?.paymentTerms ||
    order.paymentTerms ||
    'PIX à vista ou Faturamento mediante cadastro';
  const deliveryLeadTime =
    options?.deliveryLeadTime ||
    order.deliveryLeadTime ||
    'Pronta entrega — Envio imediato após confirmação';

  const effectiveItems: OrderItem[] =
    order.items.length === 1 && order.items[0].name.includes('|')
      ? parseSolicitacaoItems(order.items[0].name, unitPrices, 0)
      : order.items;

  const totals = calculateQuoteTotals(
    effectiveItems,
    unitPrices,
    discountPct,
    freight
  );

  const itemLines = effectiveItems.map((item, idx) => {
    const unit = Number(unitPrices[item.sku] ?? item.unitPrice ?? 0);
    const safeUnit = Number.isFinite(unit) && unit >= 0 ? unit : 0;
    const qty = Math.max(1, Number(item.quantity) || 1);
    const lineTotal = safeUnit * qty;
    const cleanName = item.name.replace(/^\d+[\.\)\-]\s*/, '').trim();
    const isGenericSku =
      /^PE[CÇ]A-\d+$/i.test(item.sku) ||
      /^ITEM-\d+$/i.test(item.sku) ||
      item.sku === 'PEÇA-SOLICITADA' ||
      item.sku === 'COT-MURAL' ||
      item.sku === 'COTACAO-LP';

    const displaySku = item.catalogSku || (!isGenericSku ? item.sku : '');
    const skuLabel = displaySku ? `[${displaySku}] ` : '';
    if (qty > 1 && !/\(\s*Qtd:/i.test(cleanName)) {
      return `• ${idx + 1}. ${skuLabel}${cleanName} (${qty} un.): *${formatCurrencyBRL(lineTotal)}*`;
    }
    return `• ${idx + 1}. ${skuLabel}${cleanName}: *${formatCurrencyBRL(lineTotal)}*`;
  });

  const lines = [
    `Olá *${order.customerName}*, tudo bem?`,
    `Aqui é da *TEM DE TUDO AUTO PEÇAS E SERVIÇOS LTDA.*`,
    `Segue a proposta referente ao seu orçamento (*${order.protocol}*) para o veículo *${order.vehicleInfo}*:`,
    ``,
    `*PEÇAS E VALORES:*`,
    ...itemLines,
    ``,
    `*Subtotal das Peças:* ${formatCurrencyBRL(totals.itemsSubtotal)}`,
  ];

  if (totals.discountAmount > 0) {
    lines.push(
      `*Desconto (${discountPct}%):* - ${formatCurrencyBRL(totals.discountAmount)}`
    );
  }

  lines.push(
    `*Frete:* ${
      totals.freightCost > 0
        ? formatCurrencyBRL(totals.freightCost)
        : 'R$ 0,00 (Retirada no Balcão / Cortesia)'
    }`
  );

  lines.push(
    `*VALOR FINAL DO ORÇAMENTO (COM FRETE):* *${formatCurrencyBRL(totals.finalTotal)}*`
  );
  lines.push(``);
  lines.push(`*Condição de Pagamento:* ${paymentTerms}`);
  lines.push(`*Prazo de Entrega:* ${deliveryLeadTime}`);
  if (options?.sellerNote?.trim()) {
    lines.push(`*Observações:* ${options.sellerNote.trim()}`);
  }
  lines.push(``);
  lines.push(
    `Podemos confirmar o seu pedido e iniciar a separação das peças?`
  );

  return lines.join('\n');
}

/**
 * Identifica automaticamente o WhatsApp do cliente no orçamento e constrói o link
 * direto (https://wa.me/55NUMERO?text=...) com a proposta comercial formatada em lista.
 */
export function buildDirectOrderWhatsAppCtaLink(
  order: Order,
  unitPrices: Record<string, number>,
  options?: {
    discountPercent?: number;
    freightCost?: number;
    paymentTerms?: string;
    deliveryLeadTime?: string;
    sellerNote?: string;
  }
): string {
  const phone55 = formatWhatsAppNumber55(order.customerPhone);
  const message = generateWhatsAppQuoteMessage(order, unitPrices, options);
  return `https://wa.me/${phone55}?text=${encodeURIComponent(message)}`;
}

export function createSimulatedIncomingOrder(
  products: Product[],
  sequenceNumber = Math.floor(8500 + Math.random() * 1400)
): Order {
  const sampleCustomers = [
    {
      name: 'Usina Boa Vista Bioenergia (Setor Manutenção Frota)',
      phone: '5516997128834',
      city: 'Ribeirão Preto / SP',
      vehicle: 'Caminhão Mercedes-Benz Actros 2651 6x4 + Trator Valtra BH210',
      note: 'Solicitação enviada via Landing Page — Precisamos de certificado de teste hidrostático nas mangueiras.',
    },
    {
      name: 'Terraplenagem e Britagem Ouro Preto (Eng. Henrique)',
      phone: '5531996015580',
      city: 'Contagem / MG',
      vehicle: 'Escavadeira Hidráulica + Volvo FMX 500 Basculante',
      note: 'Pedido urgente via Landing Page — Máquina em frente de serviço.',
    },
    {
      name: 'Expresso Rodoviário Atlântico (Compras Rodrigo)',
      phone: '5547991239900',
      city: 'Itajaí / SC',
      vehicle: 'Frota Scania R450 Plus e Carretas Randon 4 Eixos',
      note: 'Cotação para reposição preventiva mensal de estoque da garagem.',
    },
  ];

  const chosenCustomer =
    sampleCustomers[sequenceNumber % sampleCustomers.length];

  const availablePool = products.length >= 2 ? products : INITIAL_PRODUCTS;

  const firstProduct = availablePool[sequenceNumber % availablePool.length];
  const secondProduct =
    availablePool[(sequenceNumber + 3) % availablePool.length];

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const formattedDate = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} às ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  const items: OrderItem[] = [
    {
      sku: firstProduct.sku,
      name: firstProduct.name,
      quantity: 2,
      unitPrice: firstProduct.referencePrice ?? 390.0,
    },
    ...(secondProduct.sku !== firstProduct.sku
      ? [
          {
            sku: secondProduct.sku,
            name: secondProduct.name,
            quantity: 3,
            unitPrice: secondProduct.referencePrice ?? 450.0,
          },
        ]
      : []),
  ];

  return {
    id: `ord-${Date.now()}-${sequenceNumber}`,
    protocol: `#PED-2026-${sequenceNumber}`,
    createdAt: formattedDate,
    customerName: chosenCustomer.name,
    customerPhone: chosenCustomer.phone,
    cityState: chosenCustomer.city,
    vehicleInfo: chosenCustomer.vehicle,
    itemsCount: items.reduce((acc, it) => acc + it.quantity, 0),
    items,
    status: 'Pendente de Análise',
    notes: chosenCustomer.note,
    freightCost: 95.0,
    discountPercent: 5,
    paymentTerms: 'PIX ou Boleto Faturado 28 DDL',
    deliveryLeadTime: 'Pronta Entrega — Despacho Hoje',
  };
}

export const EVENTS_STORAGE_KEY = 'mangueiras_events_log_db';

export type EventCategory = 'Estoque' | 'Produtos' | 'Orçamentos' | 'Sistema';

export interface SystemEvent {
  id: string;
  timestamp: string;
  category: EventCategory;
  action: string;
  description: string;
  reference?: string;
  delta?: string;
}

export function formatEventTimestamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} às ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function createSystemEvent(params: {
  category: EventCategory;
  action: string;
  description: string;
  reference?: string;
  delta?: string;
  timestamp?: string;
}): SystemEvent {
  return {
    id: `evt-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    timestamp: params.timestamp || formatEventTimestamp(),
    category: params.category,
    action: params.action,
    description: params.description,
    reference: params.reference,
    delta: params.delta,
  };
}

export const INITIAL_EVENTS: SystemEvent[] = [
  {
    id: 'evt-init-01',
    timestamp: '03/11/2026 às 09:14:22',
    category: 'Orçamentos',
    action: 'Novo Orçamento Recebido',
    description:
      'Transportadora TransRota Sul (Marcos Vinicius) solicitou cotação para Scania R440 6x4 Streamline 2018.',
    reference: '#PED-2026-8491',
    delta: '6 un. solicitadas',
  },
  {
    id: 'evt-init-02',
    timestamp: '03/11/2026 às 09:02:15',
    category: 'Estoque',
    action: 'Reposição de Saldo em Estoque',
    description:
      'Entrada de lote de Conexão Hidráulica Prensável JIC 37° Fêmea Giratória no almoxarifado.',
    reference: 'MNG-MAN-011',
    delta: '25 un. → 40 un.',
  },
  {
    id: 'evt-init-03',
    timestamp: '03/11/2026 às 08:48:30',
    category: 'Orçamentos',
    action: 'Cotação Respondida no WhatsApp',
    description:
      'Orçamento enviado para Agropecuária Santa Helena (Eng. Rodrigo Bastos) com desconto comercial de 7%.',
    reference: '#PED-2026-8488',
    delta: 'Pendente → Respondido no WhatsApp',
  },
  {
    id: 'evt-init-04',
    timestamp: '03/11/2026 às 08:20:00',
    category: 'Produtos',
    action: 'Novo Produto Cadastrado',
    description:
      'Mangueira Hidráulica Alta Pressão SAE 100R2AT / 2SN registrada no catálogo de Máquinas Pesadas & Agrícolas.',
    reference: 'MNG-MAN-010',
    delta: 'Saldo inicial: 30 un.',
  },
  {
    id: 'evt-init-05',
    timestamp: '02/11/2026 às 16:35:12',
    category: 'Orçamentos',
    action: 'Venda Concluída no Balcão',
    description:
      'Pedido da Oficina Diesel Forte (Cláudio Ferreira) faturado e retirado no balcão técnico.',
    reference: '#PED-2026-8475',
    delta: 'R$ 3.087,50',
  },
  {
    id: 'evt-init-06',
    timestamp: '02/11/2026 às 16:28:40',
    category: 'Estoque',
    action: 'Baixa de Estoque por Venda',
    description:
      'Saída de 2 unidades de Amortecedor Dianteiro Pressurizado Heavy-Duty referente ao pedido #PED-2026-8475.',
    reference: 'MNG-SUS-006',
    delta: '8 un. → 6 un.',
  },
];

// =============================================================================
// MÓDULO ISOLADO: MURAL DE PEDIDOS / COTAÇÕES PENDENTES ("solicitacoes_orcamento")
// =============================================================================

export const SOLICITACOES_STORAGE_KEY = 'mangueiras_solicitacoes_orcamento_db';

export type SolicitacaoStatus =
  | 'pendente'
  | 'respondido'
  | 'fechado'
  | 'cancelado';

export interface SolicitacaoOrcamento {
  id: string;
  protocolo: string;
  nome_cliente: string;
  whatsapp: string;
  dados_veiculo: string;
  peca_solicitada: string;
  status: SolicitacaoStatus;
  data_criacao: string;
  horario_exibicao: string;
  timestamp_ms: number;
  custo_fornecedor: number;
  margem_lucro: number;
  preco_final: number;
  observacoes?: string;
  frete?: number;
  desconto_percentual?: number;
  condicoes_pagamento?: string;
  prazo_entrega?: string;
  precos_itens?: Record<string, number>;
  itens_proposta?: OrderItem[];
  estoque_baixado?: boolean;
}

/**
 * Desmembra a descrição livre de peças solicitadas (separadas por "|", quebra de linha ou ";")
 * em itens individuais com identificadores próprios (PECA-1, PECA-2...) e preços independentes.
 */
export function parseSolicitacaoItems(
  pecaSolicitada: string,
  precosItens?: Record<string, number>,
  fallbackSinglePrice = 0
): OrderItem[] {
  const raw = (pecaSolicitada || '').trim();
  if (!raw) {
    return [
      {
        sku: 'PECA-1',
        name: 'Peça automotiva solicitada',
        quantity: 1,
        unitPrice: fallbackSinglePrice > 0 ? fallbackSinglePrice : 0,
      },
    ];
  }

  const segments = raw
    .split(/\s*\|\s*|\r?\n|\s*;\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (segments.length <= 1) {
    const cleanSingle = (segments[0] || raw)
      .replace(/^\d+[\.\)\-]\s*/, '')
      .trim();
    const savedPrice =
      precosItens?.['PECA-1'] ??
      precosItens?.['ITEM-1'] ??
      precosItens?.['PEÇA-SOLICITADA'] ??
      precosItens?.['COT-MURAL'];
    return [
      {
        sku: 'PECA-1',
        name: cleanSingle || raw,
        quantity: 1,
        unitPrice:
          typeof savedPrice === 'number' && savedPrice >= 0
            ? savedPrice
            : fallbackSinglePrice > 0
            ? fallbackSinglePrice
            : 0,
      },
    ];
  }

  return segments.map((segment, idx) => {
    const sku = `PECA-${idx + 1}`;
    const altSku = `ITEM-${idx + 1}`;
    const cleanName = segment.replace(/^\d+[\.\)\-]\s*/, '').trim() || segment;
    const savedPrice = precosItens?.[sku] ?? precosItens?.[altSku];
    return {
      sku,
      name: cleanName,
      quantity: 1,
      unitPrice:
        typeof savedPrice === 'number' && savedPrice >= 0 ? savedPrice : 0,
    };
  });
}

export interface QuickMarkupResult {
  custoFornecedor: number;
  margemLucroPercent: number;
  lucroBruto: number;
  precoFinalCliente: number;
}

/**
 * Calcula automaticamente o Preço Final ao Cliente via Markup direto:
 * Preço Final = Custo Fornecedor * (1 + Margem Lucro (%) / 100)
 */
export function calculateQuickMarkupPrice(
  custoFornecedorInput: number | string,
  margemLucroInput: number | string
): QuickMarkupResult {
  const rawCost = Number(custoFornecedorInput);
  const rawMargin = Number(margemLucroInput);

  const custoFornecedor =
    Number.isFinite(rawCost) && rawCost >= 0 ? Number(rawCost.toFixed(2)) : 0;
  const margemLucroPercent =
    Number.isFinite(rawMargin) && rawMargin >= 0
      ? Number(rawMargin.toFixed(2))
      : 0;

  const lucroBruto = Number(
    ((custoFornecedor * margemLucroPercent) / 100).toFixed(2)
  );
  const precoFinalCliente = Number((custoFornecedor + lucroBruto).toFixed(2));

  return {
    custoFornecedor,
    margemLucroPercent,
    lucroBruto,
    precoFinalCliente,
  };
}

/**
 * Normaliza o número de telefone garantindo o prefixo DDI 55 (Brasil) sem duplicação
 */
export function formatWhatsAppNumber55(rawPhone: string): string {
  const digits = String(rawPhone || '').replace(/\D/g, '');
  if (!digits) return '5511999999999';
  if (digits.startsWith('55') && digits.length >= 12) {
    return digits;
  }
  return `55${digits}`;
}

/**
 * Gera link direto https://wa.me/55NUMERO?text=... com proposta formatada em lista vertical
 * com cada peça um embaixo do outro, frete e valor final.
 */
export function buildSolicitacaoWhatsAppLink(
  solicitacao: Pick<
    SolicitacaoOrcamento,
    | 'protocolo'
    | 'nome_cliente'
    | 'whatsapp'
    | 'dados_veiculo'
    | 'peca_solicitada'
    | 'precos_itens'
    | 'itens_proposta'
    | 'frete'
    | 'desconto_percentual'
    | 'condicoes_pagamento'
    | 'prazo_entrega'
  >,
  precoFinalCalculado?: number
): string {
  const phone55 = formatWhatsAppNumber55(solicitacao.whatsapp);
  const parsedItems =
    solicitacao.itens_proposta && solicitacao.itens_proposta.length > 0
      ? solicitacao.itens_proposta.map((it) => ({
          ...it,
          unitPrice:
            solicitacao.precos_itens?.[it.sku] ?? it.unitPrice ?? 0,
        }))
      : parseSolicitacaoItems(
          solicitacao.peca_solicitada,
          solicitacao.precos_itens,
          precoFinalCalculado
        );
  const freteVal = Math.max(0, Number(solicitacao.frete ?? 0) || 0);
  const hasIndividualPrices = parsedItems.some(
    (it) => (it.unitPrice ?? 0) > 0
  );

  const itemLines = parsedItems.map((it, idx) => {
    const val = Number(it.unitPrice ?? 0);
    const qty = Math.max(1, Number(it.quantity) || 1);
    const lineTotal = val * qty;
    const skuTag = it.catalogSku ? `[${it.catalogSku}] ` : '';
    const qtyTag = qty > 1 ? ` (${qty} un.)` : '';
    if (lineTotal > 0) {
      return `• ${idx + 1}. ${skuTag}${it.name}${qtyTag}: *${formatCurrencyBRL(lineTotal)}*`;
    }
    return `• ${idx + 1}. ${skuTag}${it.name}${qtyTag}`;
  });

  const subtotalPecas = parsedItems.reduce(
    (acc, it) =>
      acc + (Number(it.unitPrice) || 0) * Math.max(1, Number(it.quantity) || 1),
    0
  );
  const effectiveFinal =
    hasIndividualPrices
      ? subtotalPecas + freteVal
      : typeof precoFinalCalculado === 'number' && precoFinalCalculado > 0
      ? precoFinalCalculado + freteVal
      : 0;

  const lines = [
    `Olá *${solicitacao.nome_cliente}*, tudo bem?`,
    `Aqui é da *TEM DE TUDO AUTO PEÇAS E SERVIÇOS LTDA.*`,
    `Segue a proposta referente ao seu orçamento (*${solicitacao.protocolo}*) para o veículo *${solicitacao.dados_veiculo || 'Conforme informado'}*:`,
    ``,
    `*PEÇAS SOLICITADAS:*`,
    ...itemLines,
    ``,
  ];

  if (effectiveFinal > 0) {
    if (hasIndividualPrices && parsedItems.length > 1) {
      lines.push(`*Subtotal das Peças:* ${formatCurrencyBRL(subtotalPecas)}`);
    }
    lines.push(
      `*Frete:* ${
        freteVal > 0
          ? formatCurrencyBRL(freteVal)
          : 'R$ 0,00 (Retirada no Balcão / Cortesia)'
      }`
    );
    lines.push(
      `*VALOR FINAL DO ORÇAMENTO (COM FRETE):* *${formatCurrencyBRL(effectiveFinal)}*`
    );
    lines.push(``);
  }

  if (solicitacao.condicoes_pagamento) {
    lines.push(`*Condição de Pagamento:* ${solicitacao.condicoes_pagamento}`);
  }
  if (solicitacao.prazo_entrega) {
    lines.push(`*Prazo de Entrega:* ${solicitacao.prazo_entrega}`);
  }

  lines.push(
    effectiveFinal > 0
      ? `Podemos confirmar o seu pedido e iniciar a separação das peças?`
      : `Já estamos conferindo os valores de cada peça para o seu pedido. Podemos prosseguir com o atendimento?`
  );

  return `https://wa.me/${phone55}?text=${encodeURIComponent(lines.join('\n'))}`;
}

export function parseSolicitacaoTimestamp(rawDate: unknown): {
  isoString: string;
  displayTime: string;
  timestampMs: number;
} {
  if (rawDate && typeof rawDate === 'object') {
    const maybeTs = rawDate as {
      toDate?: () => Date;
      seconds?: number;
    };
    if (typeof maybeTs.toDate === 'function') {
      const d = maybeTs.toDate();
      return {
        isoString: d.toISOString(),
        displayTime: `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR')}`,
        timestampMs: d.getTime(),
      };
    }
    if (typeof maybeTs.seconds === 'number') {
      const d = new Date(maybeTs.seconds * 1000);
      return {
        isoString: d.toISOString(),
        displayTime: `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR')}`,
        timestampMs: d.getTime(),
      };
    }
  }

  if (typeof rawDate === 'string' && rawDate.trim()) {
    const trimmed = rawDate.trim();
    const parsedMs = Date.parse(trimmed);
    if (!Number.isNaN(parsedMs)) {
      const d = new Date(parsedMs);
      return {
        isoString: d.toISOString(),
        displayTime: `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR')}`,
        timestampMs: parsedMs,
      };
    }
    return {
      isoString: trimmed,
      displayTime: trimmed,
      timestampMs: Date.now(),
    };
  }

  const now = new Date();
  return {
    isoString: now.toISOString(),
    displayTime: `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}`,
    timestampMs: now.getTime(),
  };
}

export function normalizeSolicitacaoOrcamento(
  docId: string,
  raw: Record<string, unknown>
): SolicitacaoOrcamento {
  const id = String(raw.id || docId);
  const rawProtocol = String(
    raw.protocolo || raw.protocol || `#COT-${docId.slice(0, 6).toUpperCase()}`
  );
  const protocolo = rawProtocol.startsWith('#') ? rawProtocol : `#${rawProtocol}`;

  const clienteObj =
    raw.cliente && typeof raw.cliente === 'object'
      ? (raw.cliente as Record<string, unknown>)
      : null;

  const rawNome =
    raw.nome_cliente ||
    raw.cliente_nome ||
    raw.nome ||
    raw.customerName ||
    clienteObj?.nome ||
    clienteObj?.name;

  const nome_cliente =
    typeof rawNome === 'string' && rawNome.trim()
      ? rawNome.trim()
      : 'Cliente Balcão / Online';

  const rawWa =
    raw.whatsapp ||
    raw.telefone ||
    raw.customerPhone ||
    raw.phone ||
    clienteObj?.whatsapp ||
    clienteObj?.telefone ||
    clienteObj?.phone;

  const whatsapp =
    typeof rawWa === 'string' || typeof rawWa === 'number'
      ? String(rawWa).trim()
      : '5511999999999';

  const rawVehicleCandidate =
    raw.dados_veiculo ?? raw.veiculo ?? raw.vehicleInfo ?? raw.vehicle;

  let dados_veiculo = 'Veículo/Máquina sob consulta';
  if (typeof rawVehicleCandidate === 'string' && rawVehicleCandidate.trim()) {
    dados_veiculo =
      rawVehicleCandidate.trim() === '[object Object]'
        ? 'Veículo/Máquina sob consulta'
        : rawVehicleCandidate.trim();
  } else if (
    rawVehicleCandidate &&
    typeof rawVehicleCandidate === 'object' &&
    !Array.isArray(rawVehicleCandidate)
  ) {
    const vObj = rawVehicleCandidate as Record<string, unknown>;
    const parts = [
      vObj.marca || vObj.brand,
      vObj.modelo || vObj.model || vObj.nome,
      vObj.ano || vObj.year ? `Ano ${vObj.ano || vObj.year}` : null,
      vObj.placa || vObj.plate ? `Placa ${vObj.placa || vObj.plate}` : null,
      vObj.chassi || vObj.chassis ? `Chassi ${vObj.chassi || vObj.chassis}` : null,
    ]
      .filter((x) => typeof x === 'string' || typeof x === 'number')
      .map((x) => String(x).trim())
      .filter(Boolean);

    if (parts.length > 0) {
      dados_veiculo = parts.join(' · ');
    } else {
      const fallbackEntries = Object.entries(vObj)
        .filter(([, val]) => typeof val === 'string' || typeof val === 'number')
        .map(([k, val]) => `${k}: ${String(val).trim()}`);
      if (fallbackEntries.length > 0) {
        dados_veiculo = fallbackEntries.join(' · ');
      }
    }
  }

  const rawPecaCandidate =
    raw.peca_solicitada ??
    raw.peca ??
    raw.itens ??
    raw.itemsSummary ??
    raw.descricao;

  let peca_solicitada = 'Peça automotiva / hidráulica solicitada';
  if (typeof rawPecaCandidate === 'string' && rawPecaCandidate.trim()) {
    peca_solicitada = rawPecaCandidate.trim();
  } else if (Array.isArray(rawPecaCandidate) && rawPecaCandidate.length > 0) {
    peca_solicitada = rawPecaCandidate
      .map((it) => {
        if (typeof it === 'string') return it;
        if (it && typeof it === 'object') {
          const itemObj = it as Record<string, unknown>;
          return String(
            itemObj.nome || itemObj.name || itemObj.peca || itemObj.sku || 'Peça'
          );
        }
        return '';
      })
      .filter(Boolean)
      .join(' | ');
  }

  const rawStatus = String(raw.status || 'pendente').toLowerCase().trim();
  let status: SolicitacaoStatus = 'pendente';
  if (rawStatus === 'cancelado' || rawStatus.includes('cancel')) {
    status = 'cancelado';
  } else if (rawStatus === 'respondido' || rawStatus.includes('respond')) {
    status = 'respondido';
  } else if (
    rawStatus === 'fechado' ||
    rawStatus.includes('fechad') ||
    rawStatus.includes('conclu') ||
    rawStatus.includes('venda')
  ) {
    status = 'fechado';
  }

  const dateParsed = parseSolicitacaoTimestamp(
    raw.data_criacao ?? raw.createdAt
  );

  const custo_fornecedor = Math.max(
    0,
    Number(raw.custo_fornecedor ?? 0) || 0
  );
  const margem_lucro =
    raw.margem_lucro !== undefined && raw.margem_lucro !== null
      ? Math.max(0, Number(raw.margem_lucro) || 0)
      : 35;

  const calc = calculateQuickMarkupPrice(custo_fornecedor, margem_lucro);
  const rawPrecoFinal = Number(raw.preco_final ?? 0);
  const preco_final =
    rawPrecoFinal > 0 ? Number(rawPrecoFinal.toFixed(2)) : calc.precoFinalCliente;

  const observacoes =
    typeof raw.observacoes === 'string'
      ? raw.observacoes
      : typeof raw.notes === 'string'
      ? raw.notes
      : undefined;

  const freteRaw = Number(raw.frete ?? raw.freightCost ?? 0);
  const frete = Number.isFinite(freteRaw) && freteRaw >= 0 ? freteRaw : 0;

  const descRaw = Number(raw.desconto_percentual ?? raw.discountPercent ?? raw.desconto ?? 0);
  const desconto_percentual =
    Number.isFinite(descRaw) && descRaw >= 0 && descRaw <= 100 ? descRaw : 0;

  const condicoes_pagamento =
    typeof raw.condicoes_pagamento === 'string' && raw.condicoes_pagamento.trim()
      ? raw.condicoes_pagamento.trim()
      : typeof raw.paymentTerms === 'string' && raw.paymentTerms.trim()
      ? raw.paymentTerms.trim()
      : undefined;

  const prazo_entrega =
    typeof raw.prazo_entrega === 'string' && raw.prazo_entrega.trim()
      ? raw.prazo_entrega.trim()
      : typeof raw.deliveryLeadTime === 'string' && raw.deliveryLeadTime.trim()
      ? raw.deliveryLeadTime.trim()
      : undefined;

  let precos_itens: Record<string, number> | undefined;
  if (
    raw.precos_itens &&
    typeof raw.precos_itens === 'object' &&
    !Array.isArray(raw.precos_itens)
  ) {
    const cleanMap: Record<string, number> = {};
    for (const [k, v] of Object.entries(
      raw.precos_itens as Record<string, unknown>
    )) {
      const num = Number(v);
      if (Number.isFinite(num) && num >= 0) {
        cleanMap[k] = Number(num.toFixed(2));
      }
    }
    if (Object.keys(cleanMap).length > 0) {
      precos_itens = cleanMap;
    }
  }

  let itens_proposta: OrderItem[] | undefined;
  if (Array.isArray(raw.itens_proposta) && raw.itens_proposta.length > 0) {
    const cleanList: OrderItem[] = [];
    for (let i = 0; i < raw.itens_proposta.length; i++) {
      const entry = raw.itens_proposta[i];
      if (!entry || typeof entry !== 'object') continue;
      const itemObj = entry as Record<string, unknown>;
      const sku = String(itemObj.sku || `PECA-${i + 1}`).trim();
      const name = String(itemObj.name || 'Peça solicitada').trim();
      const quantity = Math.max(1, Math.floor(Number(itemObj.quantity ?? 1) || 1));
      const unitPrice = Math.max(0, Number(itemObj.unitPrice ?? 0) || 0);
      cleanList.push({
        sku,
        name,
        quantity,
        unitPrice,
        ...(typeof itemObj.catalogProductId === 'string' && itemObj.catalogProductId
          ? { catalogProductId: itemObj.catalogProductId }
          : {}),
        ...(typeof itemObj.catalogSku === 'string' && itemObj.catalogSku
          ? { catalogSku: itemObj.catalogSku }
          : {}),
      });
    }
    if (cleanList.length > 0) {
      itens_proposta = cleanList;
    }
  }

  const estoque_baixado = Boolean(raw.estoque_baixado ?? false);

  return {
    id,
    protocolo,
    nome_cliente,
    whatsapp,
    dados_veiculo,
    peca_solicitada,
    status,
    data_criacao: dateParsed.isoString,
    horario_exibicao: dateParsed.displayTime,
    timestamp_ms: dateParsed.timestampMs,
    custo_fornecedor,
    margem_lucro,
    preco_final,
    observacoes,
    frete,
    desconto_percentual,
    condicoes_pagamento,
    prazo_entrega,
    precos_itens,
    itens_proposta,
    estoque_baixado,
  };
}

export function toFirestoreSolicitacaoPayload(
  sol: SolicitacaoOrcamento
): Record<string, unknown> {
  const cleanId = sanitizeDocumentId(sol.id).slice(0, 128);
  const calc = calculateQuickMarkupPrice(
    sol.custo_fornecedor,
    sol.margem_lucro
  );
  const safeFrete =
    typeof sol.frete === 'number' && Number.isFinite(sol.frete) && sol.frete >= 0
      ? Math.min(10000000, Number(sol.frete.toFixed(2)))
      : undefined;
  const safeDiscount =
    typeof sol.desconto_percentual === 'number' &&
    Number.isFinite(sol.desconto_percentual) &&
    sol.desconto_percentual >= 0
      ? Math.min(100, Math.max(0, Number(sol.desconto_percentual)))
      : undefined;
  const safeProposalItems =
    Array.isArray(sol.itens_proposta) && sol.itens_proposta.length > 0
      ? sol.itens_proposta.slice(0, 100).map((it, idx) => ({
          sku: String(it.sku || `PECA-${idx + 1}`).trim().slice(0, 64),
          name: String(it.name || 'Peça solicitada').trim().slice(0, 200),
          quantity: Math.max(1, Math.floor(Number(it.quantity) || 1)),
          unitPrice: Math.max(0, Number(Number(it.unitPrice ?? 0).toFixed(2)) || 0),
          ...(it.catalogProductId
            ? { catalogProductId: String(it.catalogProductId).slice(0, 128) }
            : {}),
          ...(it.catalogSku
            ? { catalogSku: String(it.catalogSku).slice(0, 64) }
            : {}),
        }))
      : undefined;

  return {
    id: cleanId,
    protocolo: sol.protocolo.slice(0, 64),
    nome_cliente: sol.nome_cliente.trim().slice(0, 160),
    whatsapp: sol.whatsapp.trim().slice(0, 40),
    dados_veiculo: sol.dados_veiculo.trim().slice(0, 500),
    peca_solicitada: sol.peca_solicitada.trim().slice(0, 5000),
    status: sol.status,
    data_criacao: sol.data_criacao.slice(0, 80),
    ...(sol.horario_exibicao
      ? { horario_exibicao: sol.horario_exibicao.trim().slice(0, 80) }
      : {}),
    ...(typeof sol.timestamp_ms === 'number' &&
    Number.isFinite(sol.timestamp_ms) &&
    sol.timestamp_ms >= 0
      ? { timestamp_ms: Math.floor(sol.timestamp_ms) }
      : {}),
    custo_fornecedor: Math.min(10000000, calc.custoFornecedor),
    margem_lucro: Math.min(10000, calc.margemLucroPercent),
    preco_final: Math.min(
      100000000,
      sol.preco_final > 0 ? sol.preco_final : calc.precoFinalCliente
    ),
    ...(typeof sol.observacoes === 'string' && sol.observacoes.trim()
      ? { observacoes: sol.observacoes.trim().slice(0, 1000) }
      : {}),
    ...(typeof sol.condicoes_pagamento === 'string' &&
    sol.condicoes_pagamento.trim()
      ? { condicoes_pagamento: sol.condicoes_pagamento.trim().slice(0, 240) }
      : {}),
    ...(typeof sol.prazo_entrega === 'string' && sol.prazo_entrega.trim()
      ? { prazo_entrega: sol.prazo_entrega.trim().slice(0, 240) }
      : {}),
    ...(safeFrete !== undefined ? { frete: safeFrete } : {}),
    ...(safeDiscount !== undefined ? { desconto_percentual: safeDiscount } : {}),
    ...(sol.precos_itens && Object.keys(sol.precos_itens).length > 0
      ? { precos_itens: sol.precos_itens }
      : {}),
    ...(safeProposalItems ? { itens_proposta: safeProposalItems } : {}),
    ...(typeof sol.estoque_baixado === 'boolean'
      ? { estoque_baixado: sol.estoque_baixado }
      : {}),
  };
}

/**
 * Serializa um registro Order da coleção "orders" respeitando estritamente os
 * campos e limites definidos em firestore.rules (isValidOrderCreate).
 */
export function toFirestoreOrderPayload(order: Order): Record<string, unknown> {
  const cleanId = sanitizeDocumentId(order.id).slice(0, 128);
  const safeItems = (Array.isArray(order.items) ? order.items : [])
    .slice(0, 100)
    .map((it, idx) => ({
      sku: String(it.sku || `ITEM-${idx + 1}`).trim().slice(0, 64),
      name: String(it.name || 'Peça solicitada').trim().slice(0, 200),
      quantity: Math.max(1, Math.floor(Number(it.quantity) || 1)),
      unitPrice: Math.max(0, Number(Number(it.unitPrice ?? 0).toFixed(2)) || 0),
      ...(it.catalogProductId
        ? { catalogProductId: String(it.catalogProductId).slice(0, 128) }
        : {}),
      ...(it.catalogSku
        ? { catalogSku: String(it.catalogSku).slice(0, 64) }
        : {}),
    }));

  const calculatedItemsCount = safeItems.reduce(
    (acc, it) => acc + Math.max(1, it.quantity || 1),
    0
  );
  const itemsCount = Math.min(
    10000,
    Math.max(1, Math.floor(Number(order.itemsCount || calculatedItemsCount) || 1))
  );
  const freightCost = Math.min(
    10000000,
    Math.max(0, Number(Number(order.freightCost ?? 0).toFixed(2)) || 0)
  );
  const discountPercent = Math.min(
    100,
    Math.max(0, Number(order.discountPercent ?? 0) || 0)
  );

  return {
    id: cleanId,
    protocol: String(order.protocol || `#PED-${cleanId.slice(0, 8)}`).slice(0, 64),
    createdAt: String(order.createdAt || new Date().toISOString()).slice(0, 80),
    ...(typeof order.createdAtMs === 'number' &&
    Number.isFinite(order.createdAtMs) &&
    order.createdAtMs >= 0
      ? { timestamp_ms: Math.floor(order.createdAtMs) }
      : {}),
    customerName: String(order.customerName || 'Cliente').trim().slice(0, 160),
    customerPhone: String(order.customerPhone || 'Não informado')
      .trim()
      .slice(0, 40),
    cityState: String(order.cityState || 'Brasil').trim().slice(0, 120),
    vehicleInfo: String(order.vehicleInfo || 'Informado no pedido')
      .trim()
      .slice(0, 500),
    itemsCount,
    items: safeItems,
    status: String(order.status || 'Pendente de Análise').slice(0, 80),
    ...(typeof order.notes === 'string' && order.notes.trim()
      ? { notes: order.notes.trim().slice(0, 1000) }
      : {}),
    freightCost,
    discountPercent,
    ...(typeof order.paymentTerms === 'string' && order.paymentTerms.trim()
      ? { paymentTerms: order.paymentTerms.trim().slice(0, 240) }
      : {}),
    ...(typeof order.deliveryLeadTime === 'string' &&
    order.deliveryLeadTime.trim()
      ? { deliveryLeadTime: order.deliveryLeadTime.trim().slice(0, 240) }
      : {}),
    ...(order.solicitacaoId
      ? { solicitacaoId: String(order.solicitacaoId).slice(0, 128) }
      : {}),
    stockDeducted: Boolean(order.stockDeducted ?? false),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Converte uma Solicitação de Orçamento concluída ("fechado") em um registro
 * de Venda Concluída compatível com o fluxo de Gestão de Orçamentos e Vendas existente.
 */
export function convertSolicitacaoToCompletedOrder(
  solicitacao: SolicitacaoOrcamento,
  custoFornecedor: number,
  margemLucro: number,
  precoFinal: number
): Order {
  const calc = calculateQuickMarkupPrice(custoFornecedor, margemLucro);
  const fallbackSinglePrice =
    precoFinal > 0 ? precoFinal : calc.precoFinalCliente;
  const parsedItems =
    solicitacao.itens_proposta && solicitacao.itens_proposta.length > 0
      ? solicitacao.itens_proposta.map((it) => ({
          ...it,
          unitPrice:
            solicitacao.precos_itens?.[it.sku] ?? it.unitPrice ?? 0,
        }))
      : parseSolicitacaoItems(
          solicitacao.peca_solicitada,
          solicitacao.precos_itens,
          fallbackSinglePrice
        );

  return {
    id: `ord-from-${solicitacao.id}`,
    protocol: solicitacao.protocolo,
    createdAt: solicitacao.horario_exibicao,
    customerName: solicitacao.nome_cliente,
    customerPhone: formatWhatsAppNumber55(solicitacao.whatsapp),
    cityState: 'Atendimento Direto / WhatsApp',
    vehicleInfo: solicitacao.dados_veiculo,
    itemsCount: parsedItems.reduce((acc, it) => acc + Math.max(1, it.quantity || 1), 0),
    items: parsedItems,
    status: 'Venda Concluída',
    notes: `Venda originada no Orçamento (Custo Fornecedor: ${formatCurrencyBRL(
      calc.custoFornecedor
    )} · Margem: ${calc.margemLucroPercent}% · Preço Final: ${formatCurrencyBRL(
      fallbackSinglePrice
    )}).`,
    freightCost: solicitacao.frete ?? 0,
    discountPercent: solicitacao.desconto_percentual ?? 0,
    paymentTerms:
      solicitacao.condicoes_pagamento ||
      'Aprovado via Atendimento Direto no WhatsApp',
    deliveryLeadTime:
      solicitacao.prazo_entrega || 'Separação Imediata no Balcão',
    solicitacaoId: solicitacao.id,
    stockDeducted: Boolean(solicitacao.estoque_baixado),
    createdAtMs: solicitacao.timestamp_ms,
  };
}

/**
 * Converte uma Solicitação de Orçamento livre (digitada pelo cliente na Landing Page
 * na coleção "solicitacoes_orcamento") em um objeto Order com cada peça desmembrada
 * em sua própria linha e valor individual para abrir na Mesa de Cotação Comercial.
 */
export function convertSolicitacaoToOrderForPricing(
  solicitacao: SolicitacaoOrcamento,
  custoFornecedor?: number,
  margemLucro?: number,
  precoFinal?: number
): Order {
  const cost =
    typeof custoFornecedor === 'number'
      ? custoFornecedor
      : solicitacao.custo_fornecedor;
  const margin =
    typeof margemLucro === 'number' ? margemLucro : solicitacao.margem_lucro;
  const calc = calculateQuickMarkupPrice(cost, margin);
  const fallbackSinglePrice =
    typeof precoFinal === 'number' && precoFinal > 0
      ? precoFinal
      : solicitacao.preco_final > 0
      ? solicitacao.preco_final
      : calc.precoFinalCliente;

  const parsedItems =
    solicitacao.itens_proposta && solicitacao.itens_proposta.length > 0
      ? solicitacao.itens_proposta.map((it) => ({
          ...it,
          unitPrice:
            solicitacao.precos_itens?.[it.sku] ?? it.unitPrice ?? 0,
        }))
      : parseSolicitacaoItems(
          solicitacao.peca_solicitada,
          solicitacao.precos_itens,
          fallbackSinglePrice
        );

  const mappedStatus: OrderStatus =
    solicitacao.status === 'cancelado'
      ? 'Cancelado'
      : solicitacao.status === 'fechado'
      ? 'Venda Concluída'
      : solicitacao.status === 'respondido'
      ? 'Orçamento Respondido no WhatsApp'
      : 'Pendente de Análise';

  return {
    id: `ord-from-${solicitacao.id}`,
    protocol: solicitacao.protocolo,
    createdAt: solicitacao.horario_exibicao,
    customerName: solicitacao.nome_cliente,
    customerPhone: formatWhatsAppNumber55(solicitacao.whatsapp),
    cityState: 'Solicitação Direta / Landing Page',
    vehicleInfo: solicitacao.dados_veiculo,
    itemsCount: parsedItems.reduce((acc, it) => acc + Math.max(1, it.quantity || 1), 0),
    items: parsedItems,
    status: mappedStatus,
    notes:
      solicitacao.observacoes ||
      `Orçamento enviado pelo cliente (Veículo: ${solicitacao.dados_veiculo}).`,
    freightCost: solicitacao.frete ?? 0,
    discountPercent: solicitacao.desconto_percentual ?? 0,
    paymentTerms:
      solicitacao.condicoes_pagamento ||
      'PIX à vista c/ desconto ou Boleto 28 DDL Faturado CNPJ',
    deliveryLeadTime:
      solicitacao.prazo_entrega ||
      'Pronta entrega — Envio imediato após confirmação',
    solicitacaoId: solicitacao.id,
    stockDeducted: Boolean(solicitacao.estoque_baixado),
    createdAtMs: solicitacao.timestamp_ms,
  };
}

export const INITIAL_SOLICITACOES_ORCAMENTO: SolicitacaoOrcamento[] = [
  {
    id: 'SOL-2026-901',
    protocolo: '#COT-2026-901',
    nome_cliente: 'Transportadora Vale do Aço (Ricardo Mendes)',
    whatsapp: '5531998214450',
    dados_veiculo: 'Scania R440 6x4 · Ano 2019 · Placa RTA4B18 · Chassi 9BSR6X400E3849102',
    peca_solicitada:
      '2x Mangueira Hidráulica Alta Pressão SAE 100R2AT 1/2 pol + 4x Conexões JIC 37° Fêmea Giratória',
    status: 'pendente',
    data_criacao: '2026-11-04T15:42:10.000Z',
    horario_exibicao: '04/11/2026 às 15:42:10',
    timestamp_ms: Date.parse('2026-11-04T15:42:10.000Z'),
    custo_fornecedor: 680.0,
    margem_lucro: 35,
    preco_final: 918.0,
  },
  {
    id: 'SOL-2026-902',
    protocolo: '#COT-2026-902',
    nome_cliente: 'Fazenda Boa Esperança (Eng. Lucas Tavares)',
    whatsapp: '5566999187720',
    dados_veiculo: 'Trator John Deere 8R 370 · Ano 2021 · Série Hidráulica Pesada',
    peca_solicitada:
      '1x Bomba Hidráulica de Engrenagens Dupla (Ref. 9510080) + 2x Filtros Separadores R120LJ-10M',
    status: 'pendente',
    data_criacao: '2026-11-04T15:18:45.000Z',
    horario_exibicao: '04/11/2026 às 15:18:45',
    timestamp_ms: Date.parse('2026-11-04T15:18:45.000Z'),
    custo_fornecedor: 1950.0,
    margem_lucro: 30,
    preco_final: 2535.0,
  },
  {
    id: 'SOL-2026-903',
    protocolo: '#COT-2026-903',
    nome_cliente: 'Oficina Mecânica Diesel Sul (Fernando Rocha)',
    whatsapp: '5541997403312',
    dados_veiculo: 'Mercedes-Benz 1620 OM 366 · Ano 2008 · Placa MNG-1620',
    peca_solicitada:
      '1x Kit Pistão e Anéis Diesel Forged (Ref. A3660300417) + Jogo de Juntas Superior',
    status: 'pendente',
    data_criacao: '2026-11-04T14:50:20.000Z',
    horario_exibicao: '04/11/2026 às 14:50:20',
    timestamp_ms: Date.parse('2026-11-04T14:50:20.000Z'),
    custo_fornecedor: 1320.0,
    margem_lucro: 38,
    preco_final: 1821.6,
  },
];

export function createSimulatedSolicitacaoOrcamento(
  sequence = Math.floor(910 + Math.random() * 890)
): SolicitacaoOrcamento {
  const templates = [
    {
      nome_cliente: 'Britagem e Mineração Serra Azul (Compras André)',
      whatsapp: '5531996458821',
      dados_veiculo: 'Escavadeira CAT 320D · Ano 2020 · Chassi 9CAT320D008192',
      peca_solicitada:
        '4x Mangueiras Hidráulicas 4 Tramas de Aço 3/4" c/ Flange SAE 6000 PSI',
      custo_fornecedor: 1120.0,
      margem_lucro: 35,
    },
    {
      nome_cliente: 'Frota Expresso Rápido Paraná (Supervisor Júlio)',
      whatsapp: '5541998112040',
      dados_veiculo: 'Volvo FH 540 6x4 · Ano 2022 · Placa BDF9E41',
      peca_solicitada:
        '2x Válvulas Pneumáticas Pedal de Freio + 6x Conexões Prensáveis JIC 37°',
      custo_fornecedor: 840.0,
      margem_lucro: 40,
    },
    {
      nome_cliente: 'AgroIndustrial Rio Verde (Manutenção Marcos)',
      whatsapp: '5564999123344',
      dados_veiculo: 'Toyota Hilux 2.8 Diesel 4x4 · Ano 2021 · Placa FTR8H22',
      peca_solicitada:
        'Par de Amortecedores Dianteiros Pressurizados Heavy-Duty (Ref. 48510-09A10)',
      custo_fornecedor: 920.0,
      margem_lucro: 32,
    },
  ];

  const picked = templates[sequence % templates.length];
  const now = new Date();
  const calc = calculateQuickMarkupPrice(
    picked.custo_fornecedor,
    picked.margem_lucro
  );

  return {
    id: `SOL-2026-${sequence}-${Date.now().toString().slice(-4)}`,
    protocolo: `#COT-2026-${sequence}`,
    nome_cliente: picked.nome_cliente,
    whatsapp: picked.whatsapp,
    dados_veiculo: picked.dados_veiculo,
    peca_solicitada: picked.peca_solicitada,
    status: 'pendente',
    data_criacao: now.toISOString(),
    horario_exibicao: `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}`,
    timestamp_ms: now.getTime(),
    custo_fornecedor: calc.custoFornecedor,
    margem_lucro: calc.margemLucroPercent,
    preco_final: calc.precoFinalCliente,
  };
}

// =============================================================================
// EXPORTAÇÃO DE DADOS PARA PLANILHAS EXTERNAS (CSV COM UTF-8 BOM)
// =============================================================================

export function escapeCsvCell(value: unknown, separator = ';'): string {
  const raw =
    value === null || value === undefined
      ? ''
      : String(value).replace(/\r?\n|\r/g, ' ').trim();
  if (
    raw.includes(separator) ||
    raw.includes('"') ||
    raw.includes(',') ||
    raw.includes('\n')
  ) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

/**
 * Gera conteúdo CSV (separado por ponto-e-vírgula, padrão Excel PT-BR, com UTF-8 BOM)
 * para a lista atual de produtos do catálogo.
 */
export function generateProductsCsv(
  products: Product[],
  separator = ';'
): string {
  const headers = [
    'SKU',
    'Nome da Peça',
    'Ref. / Fabricante',
    'Categoria de Veículo',
    'Sistema Automotivo',
    'Modelo do Veículo',
    'Ano / Faixa Compatível',
    'Placa',
    'Chassi / VIN',
    'Saldo em Estoque (Un.)',
    'Status de Estoque',
    'Valor Unitário Estimado (R$)',
    'Valor Total em Estoque (R$)',
    'Aplicação Detalhada',
  ];

  const rows = products.map((product) => {
    const stock = Math.max(0, Number(product.stock) || 0);
    const status =
      product.stockStatus || getStockStatusFromQuantity(product.stock);
    const unitValue = getEstimatedProductUnitValue(product);
    const totalValue = Number((stock * unitValue).toFixed(2));

    return [
      product.sku,
      product.name,
      product.oem,
      product.category,
      product.system,
      product.vehicleModel,
      product.vehicleYear,
      product.licensePlate || '',
      product.chassis || '',
      stock,
      status,
      unitValue.toFixed(2).replace('.', ','),
      totalValue.toFixed(2).replace('.', ','),
      product.application,
    ]
      .map((cell) => escapeCsvCell(cell, separator))
      .join(separator);
  });

  const headerLine = headers
    .map((h) => escapeCsvCell(h, separator))
    .join(separator);

  return `\uFEFF${[headerLine, ...rows].join('\r\n')}`;
}

/**
 * Gera conteúdo CSV (com UTF-8 BOM) para a lista atual de orçamentos e pedidos.
 */
export function generateOrdersCsv(orders: Order[], separator = ';'): string {
  const headers = [
    'Protocolo',
    'Data e Hora',
    'Status do Orçamento',
    'Cliente / Empresa',
    'Telefone / WhatsApp',
    'Cidade / UF',
    'Veículo / Máquina',
    'Qtd. Total de Peças',
    'Itens Solicitados',
    'Subtotal Peças (R$)',
    'Desconto (%)',
    'Valor Desconto (R$)',
    'Frete (R$)',
    'Valor Total Final (R$)',
    'Condição de Pagamento',
    'Prazo / Logística',
    'Observações',
  ];

  const rows = orders.map((order) => {
    const priceMap: Record<string, number> = {};
    for (const item of order.items) {
      priceMap[item.sku] = item.unitPrice ?? 0;
    }
    const totals = calculateQuoteTotals(
      order.items,
      priceMap,
      order.discountPercent ?? 0,
      order.freightCost ?? 0
    );

    const itemsDescription = order.items
      .map(
        (it) =>
          `[${it.sku}] ${it.name} (${it.quantity}x R$ ${(it.unitPrice ?? 0)
            .toFixed(2)
            .replace('.', ',')})`
      )
      .join(' | ');

    return [
      order.protocol,
      order.createdAt,
      order.status,
      order.customerName,
      order.customerPhone,
      order.cityState,
      order.vehicleInfo,
      order.itemsCount,
      itemsDescription,
      totals.itemsSubtotal.toFixed(2).replace('.', ','),
      order.discountPercent ?? 0,
      totals.discountAmount.toFixed(2).replace('.', ','),
      totals.freightCost.toFixed(2).replace('.', ','),
      totals.finalTotal.toFixed(2).replace('.', ','),
      order.paymentTerms || '',
      order.deliveryLeadTime || '',
      order.notes || '',
    ]
      .map((cell) => escapeCsvCell(cell, separator))
      .join(separator);
  });

  const headerLine = headers
    .map((h) => escapeCsvCell(h, separator))
    .join(separator);

  return `\uFEFF${[headerLine, ...rows].join('\r\n')}`;
}

/**
 * Gera conteúdo CSV (com UTF-8 BOM) para as cotações do Mural de Pedidos.
 */
export function generateSolicitacoesCsv(
  solicitacoes: SolicitacaoOrcamento[],
  separator = ';'
): string {
  const headers = [
    'Protocolo',
    'Horário de Envio',
    'Status',
    'Cliente Solicitante',
    'WhatsApp',
    'Dados do Veículo / Máquina',
    'Peça Solicitada',
    'Custo Fornecedor (R$)',
    'Margem de Lucro (%)',
    'Lucro Bruto (R$)',
    'Preço Final ao Cliente (R$)',
  ];

  const rows = solicitacoes.map((item) => {
    const calc = calculateQuickMarkupPrice(
      item.custo_fornecedor,
      item.margem_lucro
    );
    const finalPrice =
      item.preco_final > 0 ? item.preco_final : calc.precoFinalCliente;

    return [
      item.protocolo,
      item.horario_exibicao,
      item.status,
      item.nome_cliente,
      formatWhatsAppNumber55(item.whatsapp),
      item.dados_veiculo,
      item.peca_solicitada,
      calc.custoFornecedor.toFixed(2).replace('.', ','),
      calc.margemLucroPercent.toFixed(2).replace('.', ','),
      calc.lucroBruto.toFixed(2).replace('.', ','),
      finalPrice.toFixed(2).replace('.', ','),
    ]
      .map((cell) => escapeCsvCell(cell, separator))
      .join(separator);
  });

  const headerLine = headers
    .map((h) => escapeCsvCell(h, separator))
    .join(separator);

  return `\uFEFF${[headerLine, ...rows].join('\r\n')}`;
}

/**
 * Dispara o download do arquivo CSV no navegador do usuário.
 */
export function downloadCsvFile(csvContent: string, filename: string): void {
  if (typeof document === 'undefined') return;
  const safeFilename = filename.endsWith('.csv')
    ? filename
    : `${filename}.csv`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', safeFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// =============================================================================
// FILTRAGEM POR INTERVALO DE DATAS (DATE RANGE PICKER)
// =============================================================================

export interface DateRangeFilter {
  startDate: string; // Formato YYYY-MM-DD ou vazio ''
  endDate: string;   // Formato YYYY-MM-DD ou vazio ''
}

/**
 * Extrai a chave de data canônica no formato YYYY-MM-DD a partir de uma string
 * em formato brasileiro ("DD/MM/YYYY às HH:mm:ss"), ISO ("YYYY-MM-DDTHH:mm:ssZ")
 * ou timestamp numérico em milissegundos.
 */
export function extractDateKeyYYYYMMDD(
  rawDateInput: string | number | undefined | null
): string | null {
  if (rawDateInput === null || rawDateInput === undefined) return null;

  if (typeof rawDateInput === 'number' && Number.isFinite(rawDateInput)) {
    const d = new Date(rawDateInput);
    if (Number.isNaN(d.getTime())) return null;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  const text = String(rawDateInput).trim();
  if (!text) return null;

  // 1. Formato brasileiro DD/MM/YYYY (ex: "03/11/2026 às 09:14:22")
  const brMatch = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) {
    const [, dd, mm, yyyy] = brMatch;
    return `${yyyy}-${mm}-${dd}`;
  }

  // 2. Formato ISO YYYY-MM-DD (ex: "2026-11-06T13:52:54.758Z" ou "2026-11-06")
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, yyyy, mm, dd] = isoMatch;
    return `${yyyy}-${mm}-${dd}`;
  }

  // 3. Fallback Date.parse
  const parsed = Date.parse(text);
  if (!Number.isNaN(parsed)) {
    const d = new Date(parsed);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  return null;
}

export function getOrderDateKey(order: Pick<Order, 'createdAt'>): string | null {
  return extractDateKeyYYYYMMDD(order.createdAt);
}

export function getSolicitacaoDateKey(
  solicitacao: Pick<
    SolicitacaoOrcamento,
    'horario_exibicao' | 'data_criacao' | 'timestamp_ms'
  >
): string | null {
  return (
    extractDateKeyYYYYMMDD(solicitacao.horario_exibicao) ||
    extractDateKeyYYYYMMDD(solicitacao.data_criacao) ||
    extractDateKeyYYYYMMDD(solicitacao.timestamp_ms)
  );
}

/**
 * Verifica se uma data YYYY-MM-DD está dentro do intervalo [startDate, endDate] (inclusivo).
 */
export function matchesDateRange(
  itemDateKey: string | null,
  startDate: string,
  endDate: string
): boolean {
  const cleanStart = (startDate || '').trim();
  const cleanEnd = (endDate || '').trim();

  if (!cleanStart && !cleanEnd) return true;
  if (!itemDateKey) return false;

  let effectiveStart = cleanStart;
  let effectiveEnd = cleanEnd;
  if (effectiveStart && effectiveEnd && effectiveStart > effectiveEnd) {
    effectiveStart = cleanEnd;
    effectiveEnd = cleanStart;
  }

  if (effectiveStart && itemDateKey < effectiveStart) return false;
  if (effectiveEnd && itemDateKey > effectiveEnd) return false;

  return true;
}

export function formatDateKeyBR(yyyyMmDd: string): string {
  const match = (yyyyMmDd || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return yyyyMmDd;
  const [, yyyy, mm, dd] = match;
  return `${dd}/${mm}/${yyyy}`;
}

// =============================================================================
// NOTIFICAÇÕES SONORAS ("PING") E CONFIGURAÇÕES DE ÁUDIO DO USUÁRIO
// =============================================================================

export const SOUND_SETTINGS_STORAGE_KEY = 'mangueiras_erp_sound_settings';

export interface UserSoundSettings {
  enabled: boolean;
  volume: number; // 0.1 a 1.0
}

export const DEFAULT_SOUND_SETTINGS: UserSoundSettings = {
  enabled: true,
  volume: 0.65,
};

export function normalizeSoundSettings(raw: unknown): UserSoundSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SOUND_SETTINGS };
  }
  const obj = raw as Record<string, unknown>;
  const enabled =
    typeof obj.enabled === 'boolean' ? obj.enabled : DEFAULT_SOUND_SETTINGS.enabled;
  const rawVolume = Number(obj.volume);
  const volume =
    Number.isFinite(rawVolume) && rawVolume >= 0.05 && rawVolume <= 1
      ? Number(rawVolume.toFixed(2))
      : DEFAULT_SOUND_SETTINGS.volume;

  return { enabled, volume };
}

/**
 * Reproduz um leve "ping" harmônico utilizando a Web Audio API quando um novo
 * orçamento chega no Mural de Pedidos ou na Gestão de Orçamentos.
 * Retorna true se o áudio foi disparado (ou agendado) e false se estiver desativado.
 */
export function playNotificationPing(
  settings: UserSoundSettings = DEFAULT_SOUND_SETTINGS
): boolean {
  if (!settings.enabled) return false;
  if (typeof window === 'undefined') return true;

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return false;

    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {
        // Ignora bloqueio de autoplay do navegador até a primeira interação
      });
    }

    const now = ctx.currentTime;
    const peakGain = Math.min(1, Math.max(0.05, settings.volume)) * 0.25;

    // Oscilador principal (Nota Lá A5 -> Ré D6 em transição suave de "ping")
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.09);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peakGain, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.3);

    setTimeout(() => {
      ctx.close().catch(() => {
        // Ignore close errors
      });
    }, 400);

    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// 13. ROTINA DE LIMPEZA AUTOMÁTICA E RETENÇÃO DO LOG DE EVENTOS (MÁX. 500)
// ============================================================================

export const MAX_EVENT_LOG_ENTRIES = 500;
export const EVENT_LOG_PAGE_SIZE = 50;

export interface EventLogPruneResult {
  prunedEvents: SystemEvent[];
  removedCount: number;
  maxEntries: number;
  estimatedBytes: number;
}

/**
 * Executa a rotina de limpeza automática na lista de eventos do sistema,
 * mantendo apenas os últimos `maxEntries` (padrão: 500) registros válidos
 * para otimizar o armazenamento local e a performance da interface.
 */
export function pruneEventLog(
  events: SystemEvent[],
  maxEntries: number = MAX_EVENT_LOG_ENTRIES
): EventLogPruneResult {
  const safeLimit =
    Number.isFinite(maxEntries) && maxEntries > 0
      ? Math.floor(maxEntries)
      : MAX_EVENT_LOG_ENTRIES;

  if (!Array.isArray(events)) {
    return {
      prunedEvents: [],
      removedCount: 0,
      maxEntries: safeLimit,
      estimatedBytes: 2,
    };
  }

  const validEvents = events.filter(
    (evt): evt is SystemEvent =>
      Boolean(
        evt &&
          typeof evt === 'object' &&
          typeof evt.id === 'string' &&
          typeof evt.action === 'string' &&
          typeof evt.description === 'string'
      )
  );

  const prunedEvents = validEvents.slice(0, safeLimit);
  const removedCount = Math.max(0, events.length - prunedEvents.length);
  const serialized = JSON.stringify(prunedEvents);
  const estimatedBytes = serialized ? serialized.length : 2;

  return {
    prunedEvents,
    removedCount,
    maxEntries: safeLimit,
    estimatedBytes,
  };
}

// ============================================================================
// 14. ROTINA DE BACKUP DIÁRIO E RESTAURAÇÃO DE DADOS ESSENCIAIS (JSON LOCAL)
// ============================================================================

export const DAILY_BACKUP_SNAPSHOT_KEY = 'mangueiras_daily_backup_snapshot_v1';
export const DAILY_BACKUP_META_KEY = 'mangueiras_daily_backup_meta_v1';
export const DAILY_BACKUP_SCHEMA_VERSION = '1.0.0';

export interface ErpBackupPayload {
  schemaVersion: string;
  company: string;
  backupDateKey: string; // YYYY-MM-DD
  createdAtIso: string;
  createdAtFormatted: string;
  summary: {
    productsCount: number;
    ordersCount: number;
    solicitacoesCount: number;
    totalUnitsInStock: number;
  };
  data: {
    products: Product[];
    orders: Order[];
    solicitacoes: SolicitacaoOrcamento[];
  };
}

export interface DailyBackupMeta {
  lastBackupDateKey: string; // YYYY-MM-DD
  lastBackupAtFormatted: string;
  productsCount: number;
  ordersCount: number;
  solicitacoesCount: number;
}

export interface BackupValidationResult {
  valid: boolean;
  error?: string;
  payload?: ErpBackupPayload;
}

/**
 * Retorna a chave de data local no formato YYYY-MM-DD para controle do backup diário.
 */
export function getLocalDateKeyYYYYMMDD(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Verifica se a rotina de backup diário deve ser executada hoje.
 */
export function shouldRunDailyBackup(
  lastBackupDateKey: string | null | undefined,
  now: Date = new Date()
): boolean {
  const todayKey = getLocalDateKeyYYYYMMDD(now);
  if (!lastBackupDateKey || typeof lastBackupDateKey !== 'string') {
    return true;
  }
  return lastBackupDateKey.trim() !== todayKey;
}

/**
 * Gera o pacote estruturado de Backup Diário contendo os dados essenciais:
 * Produtos (Catálogo & Estoque) e Orçamentos (Gestão Comercial + Mural de Pedidos).
 */
export function createErpBackupPayload(
  products: Product[],
  orders: Order[],
  solicitacoes: SolicitacaoOrcamento[] = [],
  now: Date = new Date()
): ErpBackupPayload {
  const safeProducts = Array.isArray(products) ? products : [];
  const safeOrders = Array.isArray(orders) ? orders : [];
  const safeSolicitacoes = Array.isArray(solicitacoes) ? solicitacoes : [];

  const backupDateKey = getLocalDateKeyYYYYMMDD(now);
  const datePart = now.toLocaleDateString('pt-BR');
  const timePart = now.toLocaleTimeString('pt-BR');
  const createdAtFormatted = `${datePart} às ${timePart}`;

  const totalUnitsInStock = safeProducts.reduce(
    (acc, item) => acc + (Number(item.stock) || 0),
    0
  );

  return {
    schemaVersion: DAILY_BACKUP_SCHEMA_VERSION,
    company: 'TEM DE TUDO AUTO PEÇAS E SERVIÇOS LTDA.',
    backupDateKey,
    createdAtIso: now.toISOString(),
    createdAtFormatted,
    summary: {
      productsCount: safeProducts.length,
      ordersCount: safeOrders.length,
      solicitacoesCount: safeSolicitacoes.length,
      totalUnitsInStock,
    },
    data: {
      products: safeProducts,
      orders: safeOrders,
      solicitacoes: safeSolicitacoes,
    },
  };
}

/**
 * Serializa o payload de backup em JSON formatado para gravação em arquivo local.
 */
export function serializeErpBackupJson(payload: ErpBackupPayload): string {
  return JSON.stringify(payload, null, 2);
}

/**
 * Dispara o download do arquivo JSON de backup no navegador do usuário.
 */
export function downloadJsonBackupFile(
  jsonContent: string,
  filename: string
): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const blob = new Blob([jsonContent], {
    type: 'application/json;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Analisa e valida um arquivo JSON de backup para restauração segura em caso de
 * corrupção de dados, higienizando os registros de Produtos e Orçamentos.
 */
export function parseAndValidateErpBackupJson(
  rawJson: string
): BackupValidationResult {
  if (!rawJson || typeof rawJson !== 'string' || !rawJson.trim()) {
    return {
      valid: false,
      error: 'O arquivo de backup está vazio ou inválido.',
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return {
      valid: false,
      error:
        'Formato JSON corrompido ou inválido. Verifique se o arquivo selecionado é um backup gerado pelo sistema.',
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      valid: false,
      error: 'Estrutura de backup não reconhecida.',
    };
  }

  const root = parsed as Record<string, unknown>;
  const dataNode =
    root.data && typeof root.data === 'object'
      ? (root.data as Record<string, unknown>)
      : root;

  const rawProducts = dataNode.products;
  const rawOrders = dataNode.orders;
  const rawSolicitacoes = dataNode.solicitacoes;

  if (!Array.isArray(rawProducts)) {
    return {
      valid: false,
      error:
        'O arquivo de backup não contém uma lista válida de Produtos para restauração.',
    };
  }

  if (!Array.isArray(rawOrders)) {
    return {
      valid: false,
      error:
        'O arquivo de backup não contém a coleção de Orçamentos (orders) esperada.',
    };
  }

  const restoredProducts: Product[] = [];
  for (let i = 0; i < rawProducts.length; i++) {
    const item = rawProducts[i];
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const sku = String(obj.sku || obj.id || '').trim();
    const name = String(obj.name || '').trim();
    if (!sku || !name) continue;

    restoredProducts.push(normalizeFirestoreProduct(sku, obj));
  }

  const restoredOrders: Order[] = [];
  for (let i = 0; i < rawOrders.length; i++) {
    const item = rawOrders[i];
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const id = String(obj.id || `ord-restored-${i + 1}`);
    if (
      typeof obj.protocol === 'string' &&
      typeof obj.customerName === 'string' &&
      Array.isArray(obj.items)
    ) {
      restoredOrders.push(obj as unknown as Order);
    } else {
      restoredOrders.push(normalizeFirestoreOrder(id, obj));
    }
  }

  const restoredSolicitacoes: SolicitacaoOrcamento[] = [];
  if (Array.isArray(rawSolicitacoes)) {
    for (let i = 0; i < rawSolicitacoes.length; i++) {
      const item = rawSolicitacoes[i];
      if (!item || typeof item !== 'object') continue;
      const obj = item as Record<string, unknown>;
      const id = String(obj.id || `sol-restored-${i + 1}`);
      restoredSolicitacoes.push(normalizeSolicitacaoOrcamento(id, obj));
    }
  }

  const payload = createErpBackupPayload(
    restoredProducts,
    restoredOrders,
    restoredSolicitacoes
  );

  if (typeof root.backupDateKey === 'string' && root.backupDateKey.trim()) {
    payload.backupDateKey = root.backupDateKey.trim();
  }
  if (
    typeof root.createdAtFormatted === 'string' &&
    root.createdAtFormatted.trim()
  ) {
    payload.createdAtFormatted = root.createdAtFormatted.trim();
  }

  return {
    valid: true,
    payload,
  };
}

// ============================================================================
// 15. AÇÕES EM LOTE NO CATÁLOGO & EXPURGO DE PEDIDOS HIPOTÉTICOS / FICTÍCIOS
// ============================================================================

export const REAL_ORDERS_CLEANUP_STORAGE_KEY =
  'mangueiras_real_orders_cleanup_v2';

export const HYPOTHETICAL_DEMO_ORDER_IDS = [
  'ord-01',
  'ord-02',
  'ord-03',
  'ord-2026-0101',
  'ord-2026-0102',
  'ord-2026-0103',
];

export const HYPOTHETICAL_DEMO_SOLICITACAO_IDS = [
  'SOL-2026-901',
  'SOL-2026-902',
  'SOL-2026-903',
  'sol-2026-001',
  'sol-2026-002',
  'sol-2026-003',
];

export const HYPOTHETICAL_DEMO_PROTOCOLS = [
  '#PED-2026-8491',
  '#PED-2026-8488',
  '#PED-2026-8475',
  '#COT-2026-901',
  '#COT-2026-902',
  '#COT-2026-903',
  '#COT-2026-4101',
  '#COT-2026-4102',
  '#COT-2026-4103',
];

export const HYPOTHETICAL_DEMO_CUSTOMERS = [
  'Transportadora TransRota Sul (Marcos Vinicius)',
  'Agropecuária Santa Helena (Eng. Rodrigo Bastos)',
  'Oficina Diesel Forte (Cláudio Ferreira)',
  'Transportadora Vale do Aço (Ricardo Mendes)',
  'Fazenda Boa Esperança (Eng. Lucas Tavares)',
  'Oficina Mecânica Diesel Sul (Fernando Rocha)',
  'Britagem e Mineração Serra Azul (Compras André)',
  'Frota Expresso Rápido Paraná (Supervisor Júlio)',
  'AgroIndustrial Rio Verde (Manutenção Marcos)',
  'Usina Boa Vista Bioenergia (Setor Manutenção Frota)',
  'Terraplenagem e Britagem Ouro Preto (Eng. Henrique)',
  'Expresso Rodoviário Atlântico (Compras Rodrigo)',
  'Construtora Horizonte Pesado (Eng. Eduardo)',
];

/**
 * Identifica se um pedido (Order) pertence ao conjunto de demonstração hipotética/simulada.
 */
export function isHypotheticalOrder(order: Partial<Order> | null | undefined): boolean {
  if (!order) return false;
  const id = (order.id || '').trim();
  const protocol = (order.protocol || '').trim();
  const customer = (order.customerName || '').trim();
  const solicitacaoId = (order.solicitacaoId || '').trim();

  if (HYPOTHETICAL_DEMO_ORDER_IDS.includes(id)) return true;
  if (HYPOTHETICAL_DEMO_PROTOCOLS.includes(protocol)) return true;
  if (HYPOTHETICAL_DEMO_CUSTOMERS.includes(customer)) return true;
  if (HYPOTHETICAL_DEMO_SOLICITACAO_IDS.includes(solicitacaoId)) return true;
  if (id.startsWith('ord-from-SOL-2026-')) return true;

  return false;
}

/**
 * Identifica se uma solicitação de orçamento (SolicitacaoOrcamento) pertence ao conjunto de demonstração hipotética/simulada.
 */
export function isHypotheticalSolicitacao(
  sol: Partial<SolicitacaoOrcamento> | null | undefined
): boolean {
  if (!sol) return false;
  const id = (sol.id || '').trim();
  const protocolo = (sol.protocolo || '').trim();
  const customer = (sol.nome_cliente || '').trim();

  if (HYPOTHETICAL_DEMO_SOLICITACAO_IDS.includes(id)) return true;
  if (HYPOTHETICAL_DEMO_PROTOCOLS.includes(protocolo)) return true;
  if (HYPOTHETICAL_DEMO_CUSTOMERS.includes(customer)) return true;
  if (id.startsWith('SOL-2026-')) return true;

  return false;
}

export function filterOutHypotheticalOrders(orders: Order[]): Order[] {
  if (!Array.isArray(orders)) return [];
  return orders.filter((o) => !isHypotheticalOrder(o));
}

export function filterOutHypotheticalSolicitacoes(
  solicitacoes: SolicitacaoOrcamento[]
): SolicitacaoOrcamento[] {
  if (!Array.isArray(solicitacoes)) return [];
  return solicitacoes.filter((s) => !isHypotheticalSolicitacao(s));
}

/**
 * Atualiza a categoria de múltiplos produtos selecionados em lote.
 */
export function applyBatchCategoryUpdate(
  products: Product[],
  selectedIds: string[],
  newCategory: string
): { updatedProducts: Product[]; affectedProducts: Product[] } {
  const cleanCategory = (newCategory || '').trim();
  if (!cleanCategory || !Array.isArray(selectedIds) || selectedIds.length === 0) {
    return { updatedProducts: products, affectedProducts: [] };
  }

  const targetSet = new Set(
    selectedIds.map((id) => String(id).trim().toUpperCase())
  );
  const affectedProducts: Product[] = [];

  const updatedProducts = products.map((product) => {
    const matches =
      targetSet.has(product.id.toUpperCase()) ||
      targetSet.has(product.sku.toUpperCase());
    if (!matches) return product;

    const updatedItem: Product = {
      ...product,
      category: cleanCategory,
    };
    affectedProducts.push(updatedItem);
    return updatedItem;
  });

  return { updatedProducts, affectedProducts };
}

/**
 * Remove múltiplos produtos selecionados em lote do catálogo.
 */
export function applyBatchDeleteProducts(
  products: Product[],
  selectedIds: string[]
): { remainingProducts: Product[]; deletedProducts: Product[] } {
  if (!Array.isArray(selectedIds) || selectedIds.length === 0) {
    return { remainingProducts: products, deletedProducts: [] };
  }

  const targetSet = new Set(
    selectedIds.map((id) => String(id).trim().toUpperCase())
  );
  const remainingProducts: Product[] = [];
  const deletedProducts: Product[] = [];

  for (const product of products) {
    const matches =
      targetSet.has(product.id.toUpperCase()) ||
      targetSet.has(product.sku.toUpperCase());
    if (matches) {
      deletedProducts.push(product);
    } else {
      remainingProducts.push(product);
    }
  }

  return { remainingProducts, deletedProducts };
}

// ============================================================================
// 16. EXPURGO DOS 12 PRODUTOS DE DEMONSTRAÇÃO & BAIXA AUTOMÁTICA DE ESTOQUE
// ============================================================================

export const DEMO_PRODUCTS_CLEANUP_STORAGE_KEY =
  'temdetudo_demo_products_cleanup_v1';

export const DEMO_PRODUCT_SKUS: string[] = [
  'MNG-MOT-001',
  'MNG-MOT-002',
  'MNG-FRE-003',
  'MNG-HID-004',
  'MNG-MOT-005',
  'MNG-SUS-006',
  'MNG-MOT-007',
  'MNG-FRE-008',
  'MNG-TRA-009',
  'MNG-MAN-010',
  'MNG-MAN-011',
  'MNG-MOT-012',
];

/**
 * Identifica se um produto pertence ao catálogo pré-estabelecido de 12 itens demonstrativos.
 */
export function isDemoSeedProduct(
  product: Partial<Product> | null | undefined
): boolean {
  if (!product) return false;
  const id = (product.id || '').trim().toUpperCase();
  const sku = (product.sku || '').trim().toUpperCase();
  return DEMO_PRODUCT_SKUS.includes(id) || DEMO_PRODUCT_SKUS.includes(sku);
}

/**
 * Filtra qualquer produto que faça parte dos 12 itens pré-estabelecidos de demonstração,
 * preservando apenas peças reais cadastradas pelo usuário.
 */
export function filterOutDemoProducts(products: Product[]): Product[] {
  if (!Array.isArray(products)) return [];
  return products.filter((p) => !isDemoSeedProduct(p));
}

export interface StockDeductionSummaryItem {
  productId: string;
  sku: string;
  name: string;
  previousStock: number;
  deductedQuantity: number;
  newStock: number;
}

/**
 * Desconta automaticamente do estoque as quantidades vendidas para todas as peças da proposta
 * que estejam vinculadas ao catálogo (via catalogProductId, catalogSku ou SKU correspondente).
 */
export function deductCatalogStockForOrder(
  products: Product[],
  items: OrderItem[]
): {
  updatedProducts: Product[];
  affectedProducts: Product[];
  deductionsSummary: StockDeductionSummaryItem[];
} {
  if (!Array.isArray(products) || !Array.isArray(items) || items.length === 0) {
    return {
      updatedProducts: products || [],
      affectedProducts: [],
      deductionsSummary: [],
    };
  }

  // Soma a quantidade total vendida por produto do catálogo
  const qtyByProductKey = new Map<string, number>();

  for (const item of items) {
    const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
    const candidateKeys = [
      item.catalogProductId,
      item.catalogSku,
      item.sku,
    ]
      .filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
      .map((k) => k.trim().toUpperCase());

    const matchedProduct = products.find((p) => {
      const pid = p.id.trim().toUpperCase();
      const psku = p.sku.trim().toUpperCase();
      return candidateKeys.includes(pid) || candidateKeys.includes(psku);
    });

    if (matchedProduct) {
      const key = matchedProduct.id;
      qtyByProductKey.set(key, (qtyByProductKey.get(key) || 0) + qty);
    }
  }

  if (qtyByProductKey.size === 0) {
    return {
      updatedProducts: products,
      affectedProducts: [],
      deductionsSummary: [],
    };
  }

  const affectedProducts: Product[] = [];
  const deductionsSummary: StockDeductionSummaryItem[] = [];

  const updatedProducts = products.map((product) => {
    const toDeduct = qtyByProductKey.get(product.id);
    if (!toDeduct || toDeduct <= 0) return product;

    const previousStock = Math.max(0, Math.floor(Number(product.stock) || 0));
    const newStock = Math.max(0, previousStock - toDeduct);
    const updatedItem: Product = {
      ...product,
      stock: newStock,
      stockStatus: getStockStatusFromQuantity(newStock),
    };

    affectedProducts.push(updatedItem);
    deductionsSummary.push({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      previousStock,
      deductedQuantity: toDeduct,
      newStock,
    });

    return updatedItem;
  });

  return {
    updatedProducts,
    affectedProducts,
    deductionsSummary,
  };
}

// ============================================================================
// 17. UNIFICAÇÃO DE DUPLICADOS (#COT vs #PED), SEPARAÇÃO DE ABAS & ALERTA +48H
// ============================================================================

export const PENDING_OVERDUE_THRESHOLD_HOURS = 48;
export const PENDING_OVERDUE_THRESHOLD_MS =
  PENDING_OVERDUE_THRESHOLD_HOURS * 60 * 60 * 1000;

export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  'Pendente de Análise',
  'Orçamento Respondido no WhatsApp',
];

export const HISTORY_ORDER_STATUSES: OrderStatus[] = [
  'Venda Concluída',
  'Cancelado',
];

export function isActiveOrderStatus(status: OrderStatus): boolean {
  return (
    status === 'Pendente de Análise' ||
    status === 'Orçamento Respondido no WhatsApp'
  );
}

export function isHistoryOrderStatus(status: OrderStatus): boolean {
  return status === 'Venda Concluída' || status === 'Cancelado';
}

/**
 * Extrai o timestamp em milissegundos a partir de um Order (createdAtMs ou string createdAt).
 */
export function parseOrderTimestampMs(
  order: Pick<Order, 'createdAt' | 'createdAtMs'>
): number | null {
  if (
    typeof order.createdAtMs === 'number' &&
    Number.isFinite(order.createdAtMs) &&
    order.createdAtMs > 0
  ) {
    return order.createdAtMs;
  }

  const text = String(order.createdAt || '').trim();
  if (!text) return null;

  // Formato brasileiro: "DD/MM/YYYY às HH:mm:ss" ou "DD/MM/YYYY às HH:mm" ou "DD/MM/YYYY"
  const brDateTimeMatch = text.match(
    /(\d{2})\/(\d{2})\/(\d{4})(?:\s*(?:às|as|-|,)?\s*(\d{2}):(\d{2})(?::(\d{2}))?)?/i
  );
  if (brDateTimeMatch) {
    const day = Number(brDateTimeMatch[1]);
    const month = Number(brDateTimeMatch[2]) - 1;
    const year = Number(brDateTimeMatch[3]);
    const hours = brDateTimeMatch[4] ? Number(brDateTimeMatch[4]) : 12;
    const minutes = brDateTimeMatch[5] ? Number(brDateTimeMatch[5]) : 0;
    const seconds = brDateTimeMatch[6] ? Number(brDateTimeMatch[6]) : 0;
    const dt = new Date(year, month, day, hours, minutes, seconds);
    if (!Number.isNaN(dt.getTime())) {
      return dt.getTime();
    }
  }

  const parsed = Date.parse(text);
  if (!Number.isNaN(parsed)) {
    return parsed;
  }

  return null;
}

export interface OrderPendingAgeInfo {
  isPending: boolean;
  isOverdue48h: boolean;
  elapsedMs: number;
  elapsedHours: number;
  elapsedDays: number;
  badgeLabel: string;
}

/**
 * Calcula o tempo decorrido de um pedido e identifica se está em status
 * 'Pendente de Análise' há mais de 48 horas.
 */
export function getOrderPendingAgeInfo(
  order: Pick<Order, 'status' | 'createdAt' | 'createdAtMs'>,
  nowMs: number = Date.now()
): OrderPendingAgeInfo {
  const isPending = order.status === 'Pendente de Análise';
  const createdMs = parseOrderTimestampMs(order);

  if (!isPending || createdMs === null) {
    return {
      isPending,
      isOverdue48h: false,
      elapsedMs: 0,
      elapsedHours: 0,
      elapsedDays: 0,
      badgeLabel: '',
    };
  }

  const elapsedMs = Math.max(0, nowMs - createdMs);
  const elapsedHours = Math.floor(elapsedMs / (1000 * 60 * 60));
  const elapsedDays = Math.floor(elapsedHours / 24);
  const isOverdue48h = elapsedMs >= PENDING_OVERDUE_THRESHOLD_MS;

  if (!isOverdue48h) {
    return {
      isPending: true,
      isOverdue48h: false,
      elapsedMs,
      elapsedHours,
      elapsedDays,
      badgeLabel: elapsedHours > 0 ? `Há ${elapsedHours}h` : 'Recente',
    };
  }

  const badgeLabel =
    elapsedDays >= 3
      ? `Pendente há ${elapsedDays} dias (${elapsedHours}h · +48h)`
      : `Pendente há ${elapsedHours}h (+48h)`;

  return {
    isPending: true,
    isOverdue48h: true,
    elapsedMs,
    elapsedHours,
    elapsedDays,
    badgeLabel,
  };
}

/**
 * Ordena os pedidos colocando no topo os que estão 'Pendente de Análise' há mais de 48h
 * (do mais antigo para o mais recente), seguidos pelos demais pedidos (do mais recente para o mais antigo).
 */
export function sortActiveOrdersWithOverdueFirst(
  orders: Order[],
  nowMs: number = Date.now()
): Order[] {
  return [...orders].sort((a, b) => {
    const ageA = getOrderPendingAgeInfo(a, nowMs);
    const ageB = getOrderPendingAgeInfo(b, nowMs);

    if (ageA.isOverdue48h && !ageB.isOverdue48h) return -1;
    if (!ageA.isOverdue48h && ageB.isOverdue48h) return 1;

    if (ageA.isOverdue48h && ageB.isOverdue48h) {
      // Mais antigo / maior atraso primeiro no topo
      return ageB.elapsedMs - ageA.elapsedMs;
    }

    const msA = parseOrderTimestampMs(a) ?? 0;
    const msB = parseOrderTimestampMs(b) ?? 0;
    return msB - msA;
  });
}

function normalizeComparableText(raw: string | undefined | null): string {
  return String(raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function extractProtocolCoreToken(protocol: string | undefined | null): string {
  return String(protocol || '')
    .trim()
    .toUpperCase()
    .replace(/^#?(?:PED|COT|ORD|SOL)[-_]?/i, '')
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Verifica se um registro #COT (oriundo de solicitacoes_orcamento) e um registro #PED
 * (oriundo de orders) representam a mesma solicitação enviada pela Landing Page.
 */
export function areOrdersDuplicateLandingPagePair(
  cotOrder: Order,
  pedOrder: Order
): boolean {
  const cotSolId = (
    cotOrder.solicitacaoId || cotOrder.id.replace(/^ord-from-/, '')
  ).trim();
  const pedId = (pedOrder.id || '').trim();
  const pedSolId = (pedOrder.solicitacaoId || '').trim();

  // 1. Mesmo ID de documento ou referência explícita
  if (cotSolId && (pedId === cotSolId || pedSolId === cotSolId)) {
    return true;
  }
  if (cotOrder.linkedFirestoreOrderId && cotOrder.linkedFirestoreOrderId === pedId) {
    return true;
  }

  // 2. Sufixo de protocolo equivalente (ex.: #COT-2026-8491 vs #PED-2026-8491 ou mesmo prefixo de docId)
  const cotToken = extractProtocolCoreToken(cotOrder.protocol);
  const pedToken = extractProtocolCoreToken(pedOrder.protocol);
  if (
    cotToken.length >= 4 &&
    pedToken.length >= 4 &&
    (cotToken === pedToken ||
      (cotToken.length >= 6 &&
        pedToken.length >= 6 &&
        (pedToken.startsWith(cotToken) || cotToken.startsWith(pedToken))))
  ) {
    return true;
  }

  // 3. Mesmo cliente + mesmo WhatsApp + mesmo veículo ou mesma janela de criação
  const cotPhone = formatWhatsAppNumber55(cotOrder.customerPhone);
  const pedPhone = formatWhatsAppNumber55(pedOrder.customerPhone);
  const samePhone =
    cotPhone.length >= 10 &&
    pedPhone.length >= 10 &&
    cotPhone !== '5511999999999' &&
    cotPhone === pedPhone;

  const cotName = normalizeComparableText(cotOrder.customerName);
  const pedName = normalizeComparableText(pedOrder.customerName);
  const sameName =
    cotName.length >= 3 &&
    pedName.length >= 3 &&
    (cotName === pedName ||
      cotName.includes(pedName) ||
      pedName.includes(cotName));

  const cotVehicle = normalizeComparableText(cotOrder.vehicleInfo);
  const pedVehicle = normalizeComparableText(pedOrder.vehicleInfo);
  const sameVehicle =
    cotVehicle.length >= 3 &&
    pedVehicle.length >= 3 &&
    (cotVehicle === pedVehicle ||
      cotVehicle.includes(pedVehicle) ||
      pedVehicle.includes(cotVehicle));

  const cotMs = parseOrderTimestampMs(cotOrder);
  const pedMs = parseOrderTimestampMs(pedOrder);
  const closeInTime =
    cotMs !== null &&
    pedMs !== null &&
    Math.abs(cotMs - pedMs) <= 30 * 60 * 1000; // até 30 minutos de diferença

  const sameDateKey =
    getOrderDateKey(cotOrder) !== null &&
    getOrderDateKey(cotOrder) === getOrderDateKey(pedOrder);

  if (samePhone && sameName && (sameVehicle || closeInTime || sameDateKey)) {
    return true;
  }

  if (sameName && sameVehicle && (closeInTime || sameDateKey)) {
    return true;
  }

  return false;
}

/**
 * Unifica os registros de 'solicitacoes_orcamento' (#COT) com os registros de 'orders' (#PED),
 * mantendo sempre o registro #COT como principal e absorvendo qualquer #PED duplicado.
 */
export function deduplicateAndMergeOrders(
  solicitacaoOrders: Order[],
  firestoreOrders: Order[],
  localOnlyOrders: Order[] = []
): Order[] {
  const absorbedFirestoreOrderIds = new Set<string>();

  const unifiedCotOrders = solicitacaoOrders.map((cotOrder) => {
    const matchingPed = firestoreOrders.find(
      (ped) =>
        !absorbedFirestoreOrderIds.has(ped.id) &&
        areOrdersDuplicateLandingPagePair(cotOrder, ped)
    );

    if (!matchingPed) {
      return cotOrder;
    }

    absorbedFirestoreOrderIds.add(matchingPed.id);

    const hasCustomCity =
      matchingPed.cityState &&
      matchingPed.cityState !== 'Brasil' &&
      matchingPed.cityState !== 'Solicitação Direta / Landing Page';

    return {
      ...cotOrder,
      cityState: hasCustomCity ? matchingPed.cityState : cotOrder.cityState,
      linkedFirestoreOrderId: matchingPed.id,
      stockDeducted: Boolean(
        cotOrder.stockDeducted || matchingPed.stockDeducted
      ),
      createdAtMs:
        cotOrder.createdAtMs ??
        parseOrderTimestampMs(cotOrder) ??
        parseOrderTimestampMs(matchingPed) ??
        undefined,
    };
  });

  // Mantém apenas pedidos da coleção 'orders' que realmente não possuem correspondente #COT
  const standaloneFirestoreOrders = firestoreOrders.filter((ped) => {
    if (absorbedFirestoreOrderIds.has(ped.id)) return false;
    // Também verifica se por algum motivo outro #COT já representa esse mesmo pedido
    const isDupOfAnyCot = unifiedCotOrders.some((cot) =>
      areOrdersDuplicateLandingPagePair(cot, ped)
    );
    return !isDupOfAnyCot;
  });

  const existingIds = new Set<string>();
  const existingProtocols = new Set<string>();

  for (const o of [...unifiedCotOrders, ...standaloneFirestoreOrders]) {
    existingIds.add(o.id);
    if (o.solicitacaoId) existingIds.add(o.solicitacaoId);
    if (o.linkedFirestoreOrderId) existingIds.add(o.linkedFirestoreOrderId);
    existingProtocols.add(o.protocol.toUpperCase());
  }

  const remainingLocal = localOnlyOrders.filter((loc) => {
    if (existingIds.has(loc.id)) return false;
    if (loc.solicitacaoId && existingIds.has(loc.solicitacaoId)) return false;
    if (existingProtocols.has(loc.protocol.toUpperCase())) return false;
    const isDupOfCot = unifiedCotOrders.some((cot) =>
      areOrdersDuplicateLandingPagePair(cot, loc)
    );
    return !isDupOfCot;
  });

  return [
    ...unifiedCotOrders,
    ...standaloneFirestoreOrders,
    ...remainingLocal,
  ];
}



