/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Wrench,
  LayoutDashboard,
  PackageSearch,
  ClipboardList,
  MessageSquare,
  PlusSquare,
  History,
  Zap,
  RotateCcw,
  BellRing,
  X,
  Plus,
  Database,
  Volume2,
  VolumeX,
  Settings,
  ShieldCheck,
  Archive,
  AlertTriangle,
} from 'lucide-react';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import {
  db,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  PRODUCTS_STORAGE_KEY,
  DELETED_PRODUCTS_STORAGE_KEY,
  ORDERS_STORAGE_KEY,
  EVENTS_STORAGE_KEY,
  SOLICITACOES_STORAGE_KEY,
  ERP_SYNC_CHANNEL,
  INITIAL_PRODUCTS,
  INITIAL_ORDERS,
  INITIAL_EVENTS,
  INITIAL_SOLICITACOES_ORCAMENTO,
  Product,
  Order,
  OrderItem,
  OrderStatus,
  ProductFilterOptions,
  SystemEvent,
  EventCategory,
  SolicitacaoOrcamento,
  SolicitacaoStatus,
  filterProducts,
  calculateDashboardMetrics,
  calculateQuoteTotals,
  createSimulatedSolicitacaoOrcamento,
  createSystemEvent,
  toFirestoreProductPayload,
  toFirestoreSolicitacaoPayload,
  toFirestoreOrderPayload,
  normalizeFirestoreProduct,
  normalizeFirestoreOrder,
  normalizeSolicitacaoOrcamento,
  convertSolicitacaoToCompletedOrder,
  convertSolicitacaoToOrderForPricing,
  getStockStatusFromQuantity,
  formatCurrencyBRL,
  generateProductsCsv,
  generateOrdersCsv,
  downloadCsvFile,
  SOUND_SETTINGS_STORAGE_KEY,
  UserSoundSettings,
  DEFAULT_SOUND_SETTINGS,
  normalizeSoundSettings,
  playNotificationPing,
  MAX_EVENT_LOG_ENTRIES,
  pruneEventLog,
  DAILY_BACKUP_SNAPSHOT_KEY,
  DAILY_BACKUP_META_KEY,
  DailyBackupMeta,
  ErpBackupPayload,
  shouldRunDailyBackup,
  createErpBackupPayload,
  serializeErpBackupJson,
  downloadJsonBackupFile,
  parseAndValidateErpBackupJson,
  REAL_ORDERS_CLEANUP_STORAGE_KEY,
  isHypotheticalOrder,
  isHypotheticalSolicitacao,
  filterOutHypotheticalOrders,
  filterOutHypotheticalSolicitacoes,
  applyBatchCategoryUpdate,
  applyBatchDeleteProducts,
  DEMO_PRODUCTS_CLEANUP_STORAGE_KEY,
  isDemoSeedProduct,
  filterOutDemoProducts,
  deductCatalogStockForOrder,
  isActiveOrderStatus,
  isHistoryOrderStatus,
  getOrderPendingAgeInfo,
  areOrdersDuplicateLandingPagePair,
  deduplicateAndMergeOrders,
} from './erp/erpLogic';
import { DashboardView } from './components/DashboardView';
import { CatalogView } from './components/CatalogView';
import { OrdersView } from './components/OrdersView';
import { ProductFormView } from './components/ProductFormView';
import { EventLogView } from './components/EventLogView';
import { QuotePricingModal } from './components/QuotePricingModal';
import { UserSettingsModal } from './components/UserSettingsModal';

type ActiveTab =
  | 'dashboard'
  | 'catalog'
  | 'mural'
  | 'orders'
  | 'history'
  | 'form'
  | 'events';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [firestoreConnected, setFirestoreConnected] = useState<boolean>(false);
  const [firestoreErrorBanner, setFirestoreErrorBanner] = useState<
    string | null
  >(null);

  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem(PRODUCTS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const realProducts = filterOutDemoProducts(parsed);
          if (realProducts.length !== parsed.length) {
            localStorage.setItem(
              PRODUCTS_STORAGE_KEY,
              JSON.stringify(realProducts)
            );
          }
          localStorage.setItem(DEMO_PRODUCTS_CLEANUP_STORAGE_KEY, 'done');
          return realProducts;
        }
      }
      localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify([]));
      localStorage.setItem(DEMO_PRODUCTS_CLEANUP_STORAGE_KEY, 'done');
      return [];
    } catch {
      return [];
    }
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const cleanupDone = localStorage.getItem(REAL_ORDERS_CLEANUP_STORAGE_KEY);
      if (!cleanupDone) {
        localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify([]));
        return [];
      }
      const saved = localStorage.getItem(ORDERS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const realOrders = filterOutHypotheticalOrders(parsed);
          const cotOrders = realOrders.filter(
            (o) =>
              Boolean(o.solicitacaoId) ||
              o.id.startsWith('ord-from-') ||
              o.protocol.toUpperCase().startsWith('#COT')
          );
          const pedOrders = realOrders.filter(
            (o) =>
              !o.solicitacaoId &&
              !o.id.startsWith('ord-from-') &&
              !o.protocol.toUpperCase().startsWith('#COT')
          );
          const deduplicated = deduplicateAndMergeOrders(
            cotOrders,
            pedOrders,
            []
          );
          if (deduplicated.length !== parsed.length) {
            localStorage.setItem(
              ORDERS_STORAGE_KEY,
              JSON.stringify(deduplicated)
            );
          }
          return deduplicated;
        }
      }
      return [];
    } catch {
      return [];
    }
  });

  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoOrcamento[]>(
    () => {
      try {
        const cleanupDone = localStorage.getItem(
          REAL_ORDERS_CLEANUP_STORAGE_KEY
        );
        if (!cleanupDone) {
          localStorage.setItem(SOLICITACOES_STORAGE_KEY, JSON.stringify([]));
          localStorage.setItem(REAL_ORDERS_CLEANUP_STORAGE_KEY, 'done');
          return [];
        }
        const saved = localStorage.getItem(SOLICITACOES_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const realSol = filterOutHypotheticalSolicitacoes(parsed);
            if (realSol.length !== parsed.length) {
              localStorage.setItem(
                SOLICITACOES_STORAGE_KEY,
                JSON.stringify(realSol)
              );
            }
            return realSol;
          }
        }
        return [];
      } catch {
        return [];
      }
    }
  );

  const [highlightedSolicitacaoIds, setHighlightedSolicitacaoIds] = useState<
    string[]
  >([]);

  const [events, setEvents] = useState<SystemEvent[]>(() => {
    try {
      const saved = localStorage.getItem(EVENTS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const { prunedEvents, removedCount } = pruneEventLog(
            parsed,
            MAX_EVENT_LOG_ENTRIES
          );
          if (removedCount > 0) {
            try {
              localStorage.setItem(
                EVENTS_STORAGE_KEY,
                JSON.stringify(prunedEvents)
              );
            } catch {
              // Ignore storage quota
            }
          }
          return prunedEvents.length > 0 ? prunedEvents : INITIAL_EVENTS;
        }
      }
      return INITIAL_EVENTS;
    } catch {
      return INITIAL_EVENTS;
    }
  });

  const [catalogFilters, setCatalogFilters] = useState<ProductFilterOptions>({
    search: '',
    category: 'ALL',
    system: 'ALL',
    stockStatus: 'ALL',
    modelFilter: 'ALL',
    yearFilter: 'ALL',
    plateSearch: '',
    chassisSearch: '',
  });

  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('ALL');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('ALL');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [activeQuoteOrder, setActiveQuoteOrder] = useState<Order | null>(null);
  const [incomingOrderAlert, setIncomingOrderAlert] = useState<{
    visible: boolean;
    protocol: string;
    customerName: string;
    targetTab?: 'orders' | 'mural';
  }>({ visible: false, protocol: '', customerName: '', targetTab: 'mural' });
  const [lastSyncTime, setLastSyncTime] = useState<string>(() =>
    new Date().toLocaleTimeString('pt-BR')
  );

  const [soundSettings, setSoundSettings] = useState<UserSoundSettings>(() => {
    try {
      const saved = localStorage.getItem(SOUND_SETTINGS_STORAGE_KEY);
      if (saved) {
        return normalizeSoundSettings(JSON.parse(saved));
      }
      return DEFAULT_SOUND_SETTINGS;
    } catch {
      return DEFAULT_SOUND_SETTINGS;
    }
  });
  const [isSettingsModalOpen, setIsSettingsModalOpen] =
    useState<boolean>(false);

  const [dailyBackupMeta, setDailyBackupMeta] =
    useState<DailyBackupMeta | null>(() => {
      try {
        const saved = localStorage.getItem(DAILY_BACKUP_META_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed.lastBackupDateKey === 'string') {
            return parsed as DailyBackupMeta;
          }
        }
        return null;
      } catch {
        return null;
      }
    });

  const soundSettingsRef = useRef<UserSoundSettings>(soundSettings);
  useEffect(() => {
    soundSettingsRef.current = soundSettings;
  }, [soundSettings]);

  const handleUpdateSoundSettings = (next: UserSoundSettings) => {
    const normalized = normalizeSoundSettings(next);
    setSoundSettings(normalized);
    soundSettingsRef.current = normalized;
    try {
      localStorage.setItem(
        SOUND_SETTINGS_STORAGE_KEY,
        JSON.stringify(normalized)
      );
    } catch {
      // Ignore storage quota
    }
  };

  const triggerIncomingQuoteAlert = (params: {
    protocol: string;
    customerName: string;
    targetTab: 'orders' | 'mural';
  }) => {
    setIncomingOrderAlert({
      visible: true,
      protocol: params.protocol,
      customerName: params.customerName,
      targetTab: params.targetTab,
    });
    playNotificationPing(soundSettingsRef.current);
  };

  const channelRef = useRef<BroadcastChannel | null>(null);
  const knownFirestoreOrderIdsRef = useRef<Set<string>>(new Set());
  const initialOrdersLoadedRef = useRef<boolean>(false);
  const knownSolicitacaoIdsRef = useRef<Set<string>>(new Set());
  const initialSolicitacoesLoadedRef = useRef<boolean>(false);
  const latestFirestoreOrdersRef = useRef<Order[]>([]);
  const latestSolicitacoesRef = useRef<SolicitacaoOrcamento[]>(solicitacoes);
  const purgingPedIdsRef = useRef<Set<string>>(new Set());
  const deletedProductIdsRef = useRef<Set<string>>(
    (() => {
      try {
        const raw = localStorage.getItem(DELETED_PRODUCTS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            return new Set<string>(parsed.map(String));
          }
        }
      } catch {
        // Ignore
      }
      return new Set<string>();
    })()
  );

  const reportFirestoreError = (
    error: unknown,
    operationType: OperationType,
    path: string | null
  ) => {
    try {
      handleFirestoreError(error, operationType, path);
    } catch (wrappedError) {
      const rawMsg =
        wrappedError instanceof Error
          ? wrappedError.message
          : String(wrappedError);
      let friendly = `Erro de sincronização com o Firestore (${operationType} em ${path || 'banco'}).`;
      try {
        const parsed = JSON.parse(rawMsg) as { error?: string };
        const errText = String(parsed.error || '');
        const lower = errText.toLowerCase();
        if (
          lower.includes('quota exceeded') ||
          lower.includes('resource-exhausted')
        ) {
          friendly =
            'Limite gratuito diário do Firestore atingido. Seus dados continuam salvos localmente e serão sincronizados assim que a cota renovar.';
        } else if (
          lower.includes('permission-denied') ||
          lower.includes('insufficient permissions')
        ) {
          friendly = `Permissão negada no Firestore ao executar "${operationType}" em "${path || 'coleção'}".`;
        } else if (errText) {
          friendly = `Erro no Firestore (${operationType} em ${path || 'coleção'}): ${errText}`;
        }
      } catch {
        // Keep fallback message
      }
      setFirestoreErrorBanner(friendly);
    }
  };

  const purgeDuplicatePedDocsFromFirestore = async (
    cotOrders: Order[],
    firestoreOrders: Order[]
  ) => {
    if (cotOrders.length === 0 || firestoreOrders.length === 0) return;

    for (const ped of firestoreOrders) {
      if (purgingPedIdsRef.current.has(ped.id)) continue;

      const matchingCot = cotOrders.find((cot) =>
        areOrdersDuplicateLandingPagePair(cot, ped)
      );
      if (!matchingCot) continue;

      purgingPedIdsRef.current.add(ped.id);

      try {
        // Garante preservação da marcação de baixa de estoque no #COT antes de remover o #PED duplicado
        if (
          ped.stockDeducted &&
          !matchingCot.stockDeducted &&
          matchingCot.solicitacaoId
        ) {
          try {
            await updateDoc(
              doc(db, 'solicitacoes_orcamento', matchingCot.solicitacaoId),
              { estoque_baixado: true }
            );
          } catch {
            // Segue com a exclusão do duplicado mesmo se a solicitação não puder ser atualizada
          }
        }

        await deleteDoc(doc(db, 'orders', ped.id));
        latestFirestoreOrdersRef.current =
          latestFirestoreOrdersRef.current.filter((o) => o.id !== ped.id);
        knownFirestoreOrderIdsRef.current.delete(ped.id);

        appendEvent({
          category: 'Orçamentos',
          action: 'Registro #PED Duplicado Excluído do Firestore',
          description: `O pedido duplicado ${ped.protocol} foi removido definitivamente da coleção "orders" por corresponder ao orçamento oficial ${matchingCot.protocol} (${matchingCot.customerName}).`,
          reference: matchingCot.protocol,
          delta: `Removido ${ped.protocol}`,
        });
      } catch (error) {
        purgingPedIdsRef.current.delete(ped.id);
        const msg = error instanceof Error ? error.message.toLowerCase() : '';
        if (!msg.includes('not-found')) {
          reportFirestoreError(error, OperationType.DELETE, `orders/${ped.id}`);
        }
      }
    }
  };

  const appendEvent = (params: {
    category: EventCategory;
    action: string;
    description: string;
    reference?: string;
    delta?: string;
  }) => {
    const newEvt = createSystemEvent(params);
    setEvents((prev) => {
      const { prunedEvents } = pruneEventLog(
        [newEvt, ...prev],
        MAX_EVENT_LOG_ENTRIES
      );
      try {
        localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(prunedEvents));
      } catch {
        // Ignore storage quota
      }
      return prunedEvents;
    });
  };

  const handlePruneEvents = (): number => {
    let removedTotal = 0;
    setEvents((prev) => {
      const { prunedEvents, removedCount } = pruneEventLog(
        prev,
        MAX_EVENT_LOG_ENTRIES
      );
      removedTotal = removedCount;
      try {
        localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(prunedEvents));
      } catch {
        // Ignore storage quota
      }
      return prunedEvents;
    });
    return removedTotal;
  };

  // ===========================================================================
  // ROTINA DE BACKUP DIÁRIO AUTOMÁTICO E RESTAURAÇÃO DE EMERGÊNCIA (JSON LOCAL)
  // ===========================================================================
  const saveDailyBackupSnapshot = (
    currentProducts: Product[],
    currentOrders: Order[],
    currentSolicitacoes: SolicitacaoOrcamento[],
    logAsNewDailyEvent: boolean
  ): ErpBackupPayload => {
    const payload = createErpBackupPayload(
      currentProducts,
      currentOrders,
      currentSolicitacoes
    );
    const serialized = serializeErpBackupJson(payload);
    const meta: DailyBackupMeta = {
      lastBackupDateKey: payload.backupDateKey,
      lastBackupAtFormatted: payload.createdAtFormatted,
      productsCount: payload.summary.productsCount,
      ordersCount: payload.summary.ordersCount,
      solicitacoesCount: payload.summary.solicitacoesCount,
    };

    try {
      localStorage.setItem(DAILY_BACKUP_SNAPSHOT_KEY, serialized);
      localStorage.setItem(DAILY_BACKUP_META_KEY, JSON.stringify(meta));
    } catch {
      // Ignore storage quota
    }

    setDailyBackupMeta(meta);

    if (logAsNewDailyEvent) {
      appendEvent({
        category: 'Sistema',
        action: 'Rotina de Backup Diário Executada Automaticamente',
        description: `Ponto de restauração diário gerado com ${meta.productsCount} produto(s), ${meta.ordersCount} orçamento(s) e ${meta.solicitacoesCount} cotação(ões) do mural.`,
        reference: `Backup ${payload.backupDateKey}`,
        delta: `${meta.productsCount} SKUs · ${meta.ordersCount} pedidos`,
      });
    }

    return payload;
  };

  useEffect(() => {
    if (shouldRunDailyBackup(dailyBackupMeta?.lastBackupDateKey)) {
      saveDailyBackupSnapshot(products, orders, solicitacoes, true);
    } else {
      // Mantém o snapshot diário sincronizado com os dados mais recentes do dia
      const payload = createErpBackupPayload(products, orders, solicitacoes);
      const meta: DailyBackupMeta = {
        lastBackupDateKey: payload.backupDateKey,
        lastBackupAtFormatted: payload.createdAtFormatted,
        productsCount: payload.summary.productsCount,
        ordersCount: payload.summary.ordersCount,
        solicitacoesCount: payload.summary.solicitacoesCount,
      };
      try {
        localStorage.setItem(
          DAILY_BACKUP_SNAPSHOT_KEY,
          serializeErpBackupJson(payload)
        );
        localStorage.setItem(DAILY_BACKUP_META_KEY, JSON.stringify(meta));
      } catch {
        // Ignore
      }
      setDailyBackupMeta(meta);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, orders, solicitacoes]);

  const handleDownloadBackupJson = () => {
    const payload = saveDailyBackupSnapshot(
      products,
      orders,
      solicitacoes,
      false
    );
    const jsonContent = serializeErpBackupJson(payload);
    const filename = `tem-de-tudo-backup-diario-${payload.backupDateKey}.json`;
    downloadJsonBackupFile(jsonContent, filename);

    appendEvent({
      category: 'Sistema',
      action: 'Arquivo de Backup Diário (.JSON) Salvo Localmente',
      description: `Arquivo JSON de segurança exportado com ${payload.summary.productsCount} produto(s) e ${payload.summary.ordersCount} orçamento(s).`,
      reference: filename,
      delta: `${payload.summary.productsCount} SKUs · ${payload.summary.ordersCount} orçamentos`,
    });
  };

  const handleRestoreFromBackupPayload = async (
    payload: ErpBackupPayload,
    sourceLabel: string
  ) => {
    const restoredProducts = filterOutDemoProducts(payload.data.products || []);
    const rawRestoredSolicitacoes = filterOutHypotheticalSolicitacoes(
      payload.data.solicitacoes && payload.data.solicitacoes.length > 0
        ? payload.data.solicitacoes
        : solicitacoes
    );
    const rawRestoredOrders = filterOutHypotheticalOrders(
      payload.data.orders || []
    );

    const cotOrdersFromBackup =
      rawRestoredSolicitacoes.length > 0
        ? rawRestoredSolicitacoes.map((sol) =>
            convertSolicitacaoToOrderForPricing(sol)
          )
        : rawRestoredOrders.filter(
            (o) =>
              Boolean(o.solicitacaoId) ||
              o.id.startsWith('ord-from-') ||
              o.protocol.toUpperCase().startsWith('#COT')
          );

    const pedOrdersFromBackup = rawRestoredOrders.filter(
      (o) =>
        !o.solicitacaoId &&
        !o.id.startsWith('ord-from-') &&
        !o.protocol.toUpperCase().startsWith('#COT')
    );

    const restoredOrders = deduplicateAndMergeOrders(
      cotOrdersFromBackup,
      pedOrdersFromBackup,
      []
    );
    const standalonePedOrders = restoredOrders.filter(
      (o) =>
        !o.solicitacaoId &&
        !o.id.startsWith('ord-from-') &&
        !o.protocol.toUpperCase().startsWith('#COT')
    );

    // Libera produtos restaurados caso estivessem marcados como excluídos localmente
    for (const prod of restoredProducts) {
      deletedProductIdsRef.current.delete(prod.id);
      deletedProductIdsRef.current.delete(prod.sku);
    }

    // Atualiza refs conhecidos para evitar alertas falsos de "novo pedido" durante a restauração
    latestSolicitacoesRef.current = rawRestoredSolicitacoes;
    knownSolicitacaoIdsRef.current = new Set(
      rawRestoredSolicitacoes.map((s) => s.id)
    );
    knownFirestoreOrderIdsRef.current = new Set(
      standalonePedOrders.map((o) => o.id)
    );

    setProducts(restoredProducts);
    setOrders(restoredOrders);
    setSolicitacoes(rawRestoredSolicitacoes);

    try {
      localStorage.setItem(
        DELETED_PRODUCTS_STORAGE_KEY,
        JSON.stringify(Array.from(deletedProductIdsRef.current))
      );
      localStorage.setItem(
        PRODUCTS_STORAGE_KEY,
        JSON.stringify(restoredProducts)
      );
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(restoredOrders));
      localStorage.setItem(
        SOLICITACOES_STORAGE_KEY,
        JSON.stringify(rawRestoredSolicitacoes)
      );
    } catch {
      // Ignore storage quota
    }

    saveDailyBackupSnapshot(
      restoredProducts,
      restoredOrders,
      rawRestoredSolicitacoes,
      false
    );

    appendEvent({
      category: 'Sistema',
      action: 'Sistema Restaurado a partir de Backup JSON',
      description: `Recuperação concluída a partir de "${sourceLabel}": ${restoredProducts.length} produto(s), ${rawRestoredSolicitacoes.length} cotação(ões) e ${standalonePedOrders.length} pedido(s) avulso(s) restaurados e sincronizados com o Firestore.`,
      reference: payload.backupDateKey,
      delta: `${restoredProducts.length} SKUs · ${restoredOrders.length} orçamentos`,
    });

    // 1. Sincroniza produtos restaurados com o Firestore
    for (const prod of restoredProducts) {
      const firestorePayload = toFirestoreProductPayload(prod);
      try {
        await setDoc(
          doc(db, 'products', firestorePayload.id),
          firestorePayload
        );
      } catch (error) {
        reportFirestoreError(
          error,
          OperationType.WRITE,
          `products/${firestorePayload.id}`
        );
      }
    }

    // 2. Sincroniza solicitações de orçamento (#COT) restauradas com o Firestore
    for (const sol of rawRestoredSolicitacoes) {
      const solPayload = toFirestoreSolicitacaoPayload(sol);
      const solDocId = String(solPayload.id);
      knownSolicitacaoIdsRef.current.add(solDocId);
      try {
        await setDoc(doc(db, 'solicitacoes_orcamento', solDocId), solPayload);
      } catch (error) {
        reportFirestoreError(
          error,
          OperationType.WRITE,
          `solicitacoes_orcamento/${solDocId}`
        );
      }
    }

    // 3. Sincroniza pedidos avulsos (#PED sem correspondente #COT) restaurados com o Firestore
    for (const ord of standalonePedOrders) {
      const orderPayload = toFirestoreOrderPayload(ord);
      const orderDocId = String(orderPayload.id);
      knownFirestoreOrderIdsRef.current.add(orderDocId);
      try {
        await setDoc(doc(db, 'orders', orderDocId), orderPayload);
      } catch (error) {
        reportFirestoreError(
          error,
          OperationType.WRITE,
          `orders/${orderDocId}`
        );
      }
    }

    setLastSyncTime(new Date().toLocaleTimeString('pt-BR'));
  };

  const handleRestoreDailySnapshot = async (): Promise<boolean> => {
    try {
      const savedJson = localStorage.getItem(DAILY_BACKUP_SNAPSHOT_KEY);
      if (!savedJson) return false;
      const validation = parseAndValidateErpBackupJson(savedJson);
      if (!validation.valid || !validation.payload) return false;
      await handleRestoreFromBackupPayload(
        validation.payload,
        `Snapshot Diário (${validation.payload.backupDateKey})`
      );
      return true;
    } catch {
      return false;
    }
  };

  // ===========================================================================
  // 1. SINCRONIZAÇÃO EM TEMPO REAL COM O FIREBASE FIRESTORE
  // ===========================================================================
  useEffect(() => {
    const productsQuery = query(
      collection(db, 'products'),
      where('stock', '>=', 0)
    );

    const unsubscribeProducts = onSnapshot(
      productsQuery,
      async (snapshot) => {
        setFirestoreConnected(true);
        if (snapshot.empty) {
          setProducts([]);
          try {
            localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify([]));
          } catch {
            // Ignore
          }
          setLastSyncTime(new Date().toLocaleTimeString('pt-BR'));
          return;
        }

        const rawProductDocs = snapshot.docs.map((docSnap) => ({
          docId: docSnap.id,
          product: normalizeFirestoreProduct(
            docSnap.id,
            docSnap.data() as Record<string, unknown>
          ),
        }));

        // Expurga automaticamente os 12 produtos de demonstração pré-estabelecidos do Firestore
        const demoDocs = rawProductDocs.filter(({ product }) =>
          isDemoSeedProduct(product)
        );
        for (const item of demoDocs) {
          try {
            await deleteDoc(doc(db, 'products', item.docId));
          } catch {
            // Ignore
          }
        }

        const loadedProducts = rawProductDocs
          .filter(({ product }) => !isDemoSeedProduct(product))
          .map(({ product }) => product)
          .filter(
            (prod) =>
              !deletedProductIdsRef.current.has(prod.id) &&
              !deletedProductIdsRef.current.has(prod.sku)
          )
          .sort((a, b) => a.sku.localeCompare(b.sku));

        setProducts(loadedProducts);
        try {
          localStorage.setItem(
            PRODUCTS_STORAGE_KEY,
            JSON.stringify(loadedProducts)
          );
        } catch {
          // Ignore storage quota
        }
        setLastSyncTime(new Date().toLocaleTimeString('pt-BR'));
      },
      (error) => {
        reportFirestoreError(error, OperationType.LIST, 'products');
      }
    );

    const ordersQuery = query(
      collection(db, 'orders'),
      where('itemsCount', '>=', 1)
    );

    const unsubscribeOrders = onSnapshot(
      ordersQuery,
      async (snapshot) => {
        setFirestoreConnected(true);
        const rawFirestoreOrders: { docId: string; order: Order }[] =
          snapshot.docs.map((docSnap) => ({
            docId: docSnap.id,
            order: normalizeFirestoreOrder(
              docSnap.id,
              docSnap.data() as Record<string, unknown>
            ),
          }));

        // Expurga pedidos hipotéticos caso existam no Firestore
        const hypotheticalDocs = rawFirestoreOrders.filter(({ order }) =>
          isHypotheticalOrder(order)
        );
        for (const item of hypotheticalDocs) {
          try {
            await deleteDoc(doc(db, 'orders', item.docId));
          } catch {
            // Ignore
          }
        }

        const firestoreOrders = rawFirestoreOrders
          .filter(({ order }) => !isHypotheticalOrder(order))
          .map(({ order }) => order);

        latestFirestoreOrdersRef.current = firestoreOrders;

        const currentCotFromSolicitacoes = latestSolicitacoesRef.current.map(
          (sol) => convertSolicitacaoToOrderForPricing(sol)
        );
        // Exclui definitivamente do Firestore quaisquer #PED duplicados de um #COT existente
        void purgeDuplicatePedDocsFromFirestore(
          currentCotFromSolicitacoes,
          firestoreOrders
        );

        if (initialOrdersLoadedRef.current) {
          for (const ord of firestoreOrders) {
            if (!knownFirestoreOrderIdsRef.current.has(ord.id)) {
              // Só dispara alerta para #PED se não existir um #COT correspondente já carregado
              const hasMatchingCot = currentCotFromSolicitacoes.some((cot) =>
                areOrdersDuplicateLandingPagePair(cot, ord)
              );
              if (!hasMatchingCot) {
                triggerIncomingQuoteAlert({
                  protocol: ord.protocol,
                  customerName: ord.customerName,
                  targetTab: 'orders',
                });
                appendEvent({
                  category: 'Orçamentos',
                  action: 'Novo Orçamento Recebido da Loja',
                  description: `${ord.customerName} enviou solicitação para ${ord.vehicleInfo}.`,
                  reference: ord.protocol,
                  delta: `${ord.itemsCount} un. solicitadas`,
                });
              }
            }
          }
        }
        knownFirestoreOrderIdsRef.current = new Set(
          firestoreOrders.map((o) => o.id)
        );
        initialOrdersLoadedRef.current = true;

        setOrders((prevOrders) => {
          const cleanPrevOrders = filterOutHypotheticalOrders(prevOrders);
          const prevMap = new Map<string, Order>();
          for (const prev of cleanPrevOrders) {
            prevMap.set(prev.id, prev);
          }

          const mergedFirestoreOrders = firestoreOrders.map((fsOrder) => {
            const existingLocal = prevMap.get(fsOrder.id);
            if (!existingLocal) return fsOrder;
            return {
              ...fsOrder,
              status: fsOrder.status,
              discountPercent:
                fsOrder.discountPercent ?? existingLocal.discountPercent ?? 0,
              freightCost:
                fsOrder.freightCost ?? existingLocal.freightCost ?? 0,
              paymentTerms: fsOrder.paymentTerms ?? existingLocal.paymentTerms,
              deliveryLeadTime:
                fsOrder.deliveryLeadTime ?? existingLocal.deliveryLeadTime,
              stockDeducted: Boolean(
                fsOrder.stockDeducted || existingLocal.stockDeducted
              ),
              items: fsOrder.items.map((item) => {
                const localMatch = existingLocal.items.find(
                  (it) => it.sku === item.sku
                );
                const fsPrice = item.unitPrice ?? 0;
                return {
                  ...item,
                  unitPrice:
                    fsPrice > 0 ? fsPrice : (localMatch?.unitPrice ?? 0),
                };
              }),
            };
          });

          const currentCotOrders = cleanPrevOrders.filter(
            (o) =>
              Boolean(o.solicitacaoId) ||
              o.id.startsWith('ord-from-') ||
              o.protocol.toUpperCase().startsWith('#COT')
          );

          const firestoreIdSet = new Set(firestoreOrders.map((o) => o.id));
          const localOnlyOrders = cleanPrevOrders.filter(
            (o) =>
              !o.fromFirestore &&
              !firestoreIdSet.has(o.id) &&
              !o.solicitacaoId &&
              !o.id.startsWith('ord-from-') &&
              !o.protocol.toUpperCase().startsWith('#COT')
          );

          const combined = deduplicateAndMergeOrders(
            currentCotOrders,
            mergedFirestoreOrders,
            localOnlyOrders
          );
          try {
            localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(combined));
          } catch {
            // Ignore
          }
          return combined;
        });

        setLastSyncTime(new Date().toLocaleTimeString('pt-BR'));
      },
      (error) => {
        reportFirestoreError(error, OperationType.LIST, 'orders');
      }
    );

    // Escuta em Tempo Real da coleção "solicitacoes_orcamento" (incluindo cancelados)
    const solicitacoesQuery = query(
      collection(db, 'solicitacoes_orcamento'),
      where('status', 'in', ['pendente', 'respondido', 'fechado', 'cancelado'])
    );

    const unsubscribeSolicitacoes = onSnapshot(
      solicitacoesQuery,
      async (snapshot) => {
        setFirestoreConnected(true);
        if (snapshot.empty) {
          knownSolicitacaoIdsRef.current = new Set();
          initialSolicitacoesLoadedRef.current = true;
          latestSolicitacoesRef.current = [];
          setSolicitacoes([]);
          setOrders((prevOrders) => {
            const remaining = filterOutHypotheticalOrders(prevOrders).filter(
              (o) =>
                !o.solicitacaoId &&
                !o.id.startsWith('ord-from-') &&
                !o.protocol.toUpperCase().startsWith('#COT')
            );
            try {
              localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(remaining));
            } catch {
              // Ignore
            }
            return remaining;
          });
          try {
            localStorage.setItem(SOLICITACOES_STORAGE_KEY, JSON.stringify([]));
          } catch {
            // Ignore
          }
          setLastSyncTime(new Date().toLocaleTimeString('pt-BR'));
          return;
        }

        const rawDocs = snapshot.docs.map((docSnap) => ({
          docId: docSnap.id,
          solicitacao: normalizeSolicitacaoOrcamento(
            docSnap.id,
            docSnap.data() as Record<string, unknown>
          ),
        }));

        // Remove automaticamente do Firestore quaisquer solicitações fictícias/hipotéticas antigas
        const hypotheticalSolDocs = rawDocs.filter(({ solicitacao }) =>
          isHypotheticalSolicitacao(solicitacao)
        );
        for (const item of hypotheticalSolDocs) {
          try {
            await deleteDoc(doc(db, 'solicitacoes_orcamento', item.docId));
          } catch {
            // Ignore
          }
        }

        const loadedSolicitacoes = rawDocs
          .filter(({ solicitacao }) => !isHypotheticalSolicitacao(solicitacao))
          .map(({ solicitacao }) => solicitacao)
          .sort((a, b) => b.timestamp_ms - a.timestamp_ms);

        latestSolicitacoesRef.current = loadedSolicitacoes;

        if (initialSolicitacoesLoadedRef.current) {
          const newPendingIds: string[] = [];
          for (const sol of loadedSolicitacoes) {
            if (!knownSolicitacaoIdsRef.current.has(sol.id)) {
              newPendingIds.push(sol.id);
              triggerIncomingQuoteAlert({
                protocol: sol.protocolo,
                customerName: sol.nome_cliente,
                targetTab: 'orders',
              });
            }
          }
          if (newPendingIds.length > 0) {
            setHighlightedSolicitacaoIds((prev) =>
              Array.from(new Set([...newPendingIds, ...prev]))
            );
          }
        }

        knownSolicitacaoIdsRef.current = new Set(
          loadedSolicitacoes.map((s) => s.id)
        );
        initialSolicitacoesLoadedRef.current = true;

        setSolicitacoes(loadedSolicitacoes);
        try {
          localStorage.setItem(
            SOLICITACOES_STORAGE_KEY,
            JSON.stringify(loadedSolicitacoes)
          );
        } catch {
          // Ignore storage quota
        }

        // Sincroniza todas as solicitações reais da Landing Page na lista de Orçamentos unificando duplicados #PED
        setOrders((prevOrders) => {
          const cleanPrev = filterOutHypotheticalOrders(prevOrders);
          const prevBySolId = new Map<string, Order>();
          for (const ord of cleanPrev) {
            if (ord.solicitacaoId) {
              prevBySolId.set(ord.solicitacaoId, ord);
            } else if (ord.id.startsWith('ord-from-')) {
              prevBySolId.set(ord.id.replace(/^ord-from-/, ''), ord);
            }
          }

          const ordersFromSolicitacoes = loadedSolicitacoes.map((sol) => {
            const baseOrder = convertSolicitacaoToOrderForPricing(sol);
            const existing = prevBySolId.get(sol.id);
            if (!existing) return baseOrder;
            return {
              ...baseOrder,
              linkedFirestoreOrderId: existing.linkedFirestoreOrderId,
              discountPercent:
                sol.desconto_percentual ??
                existing.discountPercent ??
                baseOrder.discountPercent,
              freightCost:
                sol.frete ?? existing.freightCost ?? baseOrder.freightCost,
              paymentTerms:
                sol.condicoes_pagamento ??
                existing.paymentTerms ??
                baseOrder.paymentTerms,
              deliveryLeadTime:
                sol.prazo_entrega ??
                existing.deliveryLeadTime ??
                baseOrder.deliveryLeadTime,
              items: baseOrder.items.map((item) => {
                const existingMatch = existing.items.find(
                  (it) => it.sku === item.sku
                );
                return {
                  ...item,
                  unitPrice:
                    sol.precos_itens?.[item.sku] ??
                    existingMatch?.unitPrice ??
                    item.unitPrice ??
                    0,
                };
              }),
            };
          });

          const nonSolicitacaoPrev = cleanPrev.filter((ord) => {
            const isCot =
              Boolean(ord.solicitacaoId) ||
              ord.id.startsWith('ord-from-') ||
              ord.protocol.toUpperCase().startsWith('#COT');
            return !isCot;
          });

          const firestoreCandidates =
            latestFirestoreOrdersRef.current.length > 0
              ? latestFirestoreOrdersRef.current
              : nonSolicitacaoPrev.filter((o) => o.fromFirestore);

          const localOnlyCandidates = nonSolicitacaoPrev.filter(
            (o) => !o.fromFirestore
          );

          const combined = deduplicateAndMergeOrders(
            ordersFromSolicitacoes,
            firestoreCandidates,
            localOnlyCandidates
          );
          try {
            localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(combined));
          } catch {
            // Ignore
          }
          return combined;
        });

        // Exclui definitivamente do Firestore quaisquer #PED duplicados correspondentes às solicitações #COT
        void purgeDuplicatePedDocsFromFirestore(
          loadedSolicitacoes.map((sol) =>
            convertSolicitacaoToOrderForPricing(sol)
          ),
          latestFirestoreOrdersRef.current
        );

        setLastSyncTime(new Date().toLocaleTimeString('pt-BR'));
      },
      (error) => {
        reportFirestoreError(error, OperationType.LIST, 'solicitacoes_orcamento');
      }
    );

    return () => {
      unsubscribeProducts();
      unsubscribeOrders();
      unsubscribeSolicitacoes();
    };
  }, []);

  // ===========================================================================
  // 2. PONTE COMPLEMENTAR DE SINCRONIZAÇÃO ENTRE ABAS
  // ===========================================================================
  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(ERP_SYNC_CHANNEL);
      channelRef.current = channel;

      channel.onmessage = (event) => {
        const payload = event.data || {};
        if (
          payload.type === 'NEW_ORDER' ||
          payload.type === 'ORDERS_UPDATED'
        ) {
          try {
            const rawOrders = localStorage.getItem(ORDERS_STORAGE_KEY);
            const nextOrders = rawOrders
              ? JSON.parse(rawOrders)
              : payload.orders;
            if (Array.isArray(nextOrders)) {
              setOrders(nextOrders);
              const newest = payload.order || nextOrders[0];
              if (newest && payload.type === 'NEW_ORDER') {
                triggerIncomingQuoteAlert({
                  protocol: newest.protocol || '#PED-2026',
                  customerName: newest.customerName || 'Cliente da Loja',
                  targetTab: 'orders',
                });
              }
            }
          } catch {
            // Ignore
          }
          setLastSyncTime(new Date().toLocaleTimeString('pt-BR'));
        }
      };
    }

    return () => {
      channelRef.current?.close();
    };
  }, []);

  const persistAndBroadcastOrders = (
    nextOrders: Order[],
    eventType: 'ORDERS_UPDATED' | 'NEW_ORDER' = 'ORDERS_UPDATED',
    newOrderObj?: Order
  ) => {
    setOrders(nextOrders);
    try {
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(nextOrders));
      channelRef.current?.postMessage({
        type: eventType,
        orders: nextOrders,
        order: newOrderObj,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Ignore storage quota errors
    }
    setLastSyncTime(new Date().toLocaleTimeString('pt-BR'));
  };

  const filteredProducts = useMemo(
    () => filterProducts(products, catalogFilters),
    [products, catalogFilters]
  );

  const metrics = useMemo(
    () => calculateDashboardMetrics(products, orders),
    [products, orders]
  );

  // ===========================================================================
  // HANDLERS DE PRODUTOS E ESTOQUE
  // ===========================================================================
  const handleOpenNewProduct = () => {
    setEditingProduct(null);
    setActiveTab('form');
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setActiveTab('form');
  };

  const handleSaveProduct = async (productData: {
    id: string;
    sku: string;
    name: string;
    oem: string;
    category: string;
    system: string;
    vehicleModel: string;
    vehicleYear: string;
    licensePlate: string;
    chassis: string;
    application: string;
    stock: number;
    demo: boolean;
  }) => {
    const payload = toFirestoreProductPayload(productData);
    const isEditing = products.some((p) => p.id === payload.id);
    const previousProduct = products.find((p) => p.id === payload.id);

    // Se o SKU foi recadastrado, remove da lista de excluídos
    deletedProductIdsRef.current.delete(payload.id);
    deletedProductIdsRef.current.delete(payload.sku);
    try {
      localStorage.setItem(
        DELETED_PRODUCTS_STORAGE_KEY,
        JSON.stringify(Array.from(deletedProductIdsRef.current))
      );
    } catch {
      // Ignore
    }

    const optimisticProduct: Product = {
      ...payload,
      application: productData.application,
      vehicleModel: productData.vehicleModel,
      vehicleYear: productData.vehicleYear,
      licensePlate: productData.licensePlate,
      chassis: productData.chassis,
      stockStatus: getStockStatusFromQuantity(payload.stock),
      referencePrice: previousProduct?.referencePrice,
    };

    setProducts((prev) => {
      const exists = prev.some((p) => p.id === payload.id);
      const next = exists
        ? prev.map((p) => (p.id === payload.id ? optimisticProduct : p))
        : [optimisticProduct, ...prev];
      try {
        localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(next));
        channelRef.current?.postMessage({
          type: 'PRODUCTS_UPDATED',
          products: next,
          timestamp: new Date().toISOString(),
        });
      } catch {
        // Ignore
      }
      return next;
    });

    const vehicleSummary = `${productData.vehicleModel} (${productData.vehicleYear})${
      productData.licensePlate ? ` · Placa ${productData.licensePlate}` : ''
    }`;

    appendEvent({
      category: 'Produtos',
      action: isEditing ? 'Cadastro de Produto Atualizado' : 'Novo Produto Cadastrado',
      description: isEditing
        ? `Peça "${payload.name}" atualizada para ${vehicleSummary}.`
        : `Peça "${payload.name}" cadastrada para ${vehicleSummary}.`,
      reference: payload.sku,
      delta:
        isEditing && previousProduct
          ? `Estoque: ${previousProduct.stock} un. → ${payload.stock} un.`
          : `Saldo inicial: ${payload.stock} un.`,
    });

    setEditingProduct(null);
    setActiveTab('catalog');

    try {
      await setDoc(doc(db, 'products', payload.id), payload);
      setLastSyncTime(new Date().toLocaleTimeString('pt-BR'));
    } catch (error) {
      reportFirestoreError(error, OperationType.WRITE, `products/${payload.id}`);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    const removedProduct = products.find(
      (p) => p.id === productId || p.sku === productId
    );
    deletedProductIdsRef.current.add(productId);
    if (removedProduct?.sku) {
      deletedProductIdsRef.current.add(removedProduct.sku);
    }
    try {
      localStorage.setItem(
        DELETED_PRODUCTS_STORAGE_KEY,
        JSON.stringify(Array.from(deletedProductIdsRef.current))
      );
    } catch {
      // Ignore
    }

    setProducts((prev) => {
      const next = prev.filter(
        (p) => p.id !== productId && p.sku !== productId
      );
      try {
        localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });

    appendEvent({
      category: 'Produtos',
      action: 'Produto Removido do Catálogo',
      description: removedProduct
        ? `A peça "${removedProduct.name}" foi excluída do catálogo e do Firestore.`
        : `A peça de código ${productId} foi excluída do catálogo e do Firestore.`,
      reference: removedProduct?.sku || productId,
      delta: 'Removido',
    });

    try {
      await deleteDoc(doc(db, 'products', productId));
      setLastSyncTime(new Date().toLocaleTimeString('pt-BR'));
    } catch (error) {
      reportFirestoreError(error, OperationType.DELETE, `products/${productId}`);
    }
  };

  const handleQuickStockChange = async (product: Product, nextStock: number) => {
    const previousStock = product.stock ?? 0;
    const safeStock = Math.min(
      1000000,
      Math.max(0, Math.floor(Number(nextStock) || 0))
    );
    if (previousStock === safeStock) return;

    const payload = toFirestoreProductPayload({
      ...product,
      stock: safeStock,
    });

    setProducts((prev) =>
      prev.map((p) =>
        p.id === payload.id
          ? {
              ...p,
              stock: safeStock,
              stockStatus: getStockStatusFromQuantity(safeStock),
            }
          : p
      )
    );

    appendEvent({
      category: 'Estoque',
      action:
        safeStock > previousStock
          ? 'Entrada / Aumento de Saldo em Estoque'
          : 'Baixa / Redução de Saldo em Estoque',
      description: `Ajuste de saldo físico para "${product.name}" (${product.category}).`,
      reference: product.sku,
      delta: `${previousStock} un. → ${safeStock} un.`,
    });

    try {
      await setDoc(doc(db, 'products', payload.id), payload);
      setLastSyncTime(new Date().toLocaleTimeString('pt-BR'));
    } catch (error) {
      reportFirestoreError(error, OperationType.UPDATE, `products/${payload.id}`);
    }
  };

  const handleBatchDeleteProducts = async (productIds: string[]) => {
    const { remainingProducts, deletedProducts } = applyBatchDeleteProducts(
      products,
      productIds
    );
    if (deletedProducts.length === 0) return;

    for (const prod of deletedProducts) {
      deletedProductIdsRef.current.add(prod.id);
      deletedProductIdsRef.current.add(prod.sku);
    }
    try {
      localStorage.setItem(
        DELETED_PRODUCTS_STORAGE_KEY,
        JSON.stringify(Array.from(deletedProductIdsRef.current))
      );
      localStorage.setItem(
        PRODUCTS_STORAGE_KEY,
        JSON.stringify(remainingProducts)
      );
    } catch {
      // Ignore
    }

    setProducts(remainingProducts);

    const skuPreview = deletedProducts
      .slice(0, 4)
      .map((p) => p.sku)
      .join(', ');

    appendEvent({
      category: 'Produtos',
      action: 'Exclusão em Lote de Produtos no Catálogo',
      description: `${deletedProducts.length} peça(s) excluída(s) em lote do catálogo e sincronizada(s) no Firestore (${skuPreview}${deletedProducts.length > 4 ? '...' : ''}).`,
      reference: `${deletedProducts.length} SKUs`,
      delta: `-${deletedProducts.length} registro(s)`,
    });

    for (const prod of deletedProducts) {
      try {
        await deleteDoc(doc(db, 'products', prod.id));
      } catch (error) {
        reportFirestoreError(
          error,
          OperationType.DELETE,
          `products/${prod.id}`
        );
      }
    }
    setLastSyncTime(new Date().toLocaleTimeString('pt-BR'));
  };

  const handleBatchUpdateCategory = async (
    productIds: string[],
    newCategory: string
  ) => {
    const { updatedProducts, affectedProducts } = applyBatchCategoryUpdate(
      products,
      productIds,
      newCategory
    );
    if (affectedProducts.length === 0) return;

    setProducts(updatedProducts);
    try {
      localStorage.setItem(
        PRODUCTS_STORAGE_KEY,
        JSON.stringify(updatedProducts)
      );
    } catch {
      // Ignore
    }

    appendEvent({
      category: 'Produtos',
      action: 'Categoria Alterada em Lote no Catálogo',
      description: `${affectedProducts.length} peça(s) movida(s) em lote para a categoria "${newCategory}".`,
      reference: `${affectedProducts.length} SKUs`,
      delta: newCategory,
    });

    for (const prod of affectedProducts) {
      const payload = toFirestoreProductPayload(prod);
      try {
        await setDoc(doc(db, 'products', payload.id), payload);
      } catch (error) {
        reportFirestoreError(
          error,
          OperationType.UPDATE,
          `products/${payload.id}`
        );
      }
    }
    setLastSyncTime(new Date().toLocaleTimeString('pt-BR'));
  };

  // ===========================================================================
  // HANDLERS DE ORÇAMENTOS E PEDIDOS
  // ===========================================================================
  const deductStockForCompletedOrderIfNeeded = async (
    orderToProcess: Order
  ): Promise<boolean> => {
    if (orderToProcess.stockDeducted) return false;

    const { updatedProducts, affectedProducts, deductionsSummary } =
      deductCatalogStockForOrder(products, orderToProcess.items);

    if (affectedProducts.length === 0) return false;

    setProducts(updatedProducts);
    try {
      localStorage.setItem(
        PRODUCTS_STORAGE_KEY,
        JSON.stringify(updatedProducts)
      );
    } catch {
      // Ignore
    }

    const summaryText = deductionsSummary
      .map(
        (d) =>
          `${d.sku}: ${d.previousStock} un. → ${d.newStock} un. (-${d.deductedQuantity} un.)`
      )
      .join(' · ');

    appendEvent({
      category: 'Estoque',
      action: 'Baixa Automática de Estoque por Venda Concluída',
      description: `Estoque atualizado automaticamente referente ao orçamento ${orderToProcess.protocol} (${orderToProcess.customerName}): ${summaryText}.`,
      reference: orderToProcess.protocol,
      delta: summaryText,
    });

    for (const prod of affectedProducts) {
      const payload = toFirestoreProductPayload(prod);
      try {
        await setDoc(doc(db, 'products', payload.id), payload);
      } catch (error) {
        reportFirestoreError(
          error,
          OperationType.UPDATE,
          `products/${payload.id}`
        );
      }
    }

    return true;
  };

  const handleUpdateOrderStatus = async (
    orderId: string,
    newStatus: OrderStatus
  ) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    const oldStatus = targetOrder?.status;

    let didDeductStock = false;
    if (
      targetOrder &&
      newStatus === 'Venda Concluída' &&
      !targetOrder.stockDeducted
    ) {
      didDeductStock = await deductStockForCompletedOrderIfNeeded(targetOrder);
    }

    const next = orders.map((o) =>
      o.id === orderId
        ? {
            ...o,
            status: newStatus,
            stockDeducted: o.stockDeducted || didDeductStock,
          }
        : o
    );
    persistAndBroadcastOrders(next);

    if (targetOrder && oldStatus !== newStatus) {
      appendEvent({
        category: 'Orçamentos',
        action: 'Status de Orçamento Atualizado',
        description: `Orçamento do cliente ${targetOrder.customerName} teve o status alterado.`,
        reference: targetOrder.protocol,
        delta: `${oldStatus} → ${newStatus}`,
      });
    }

    const linkedSolId =
      targetOrder?.solicitacaoId ||
      (orderId.startsWith('ord-from-')
        ? orderId.replace(/^ord-from-/, '')
        : '');
    if (linkedSolId) {
      const mappedSolStatus: SolicitacaoStatus =
        newStatus === 'Cancelado'
          ? 'cancelado'
          : newStatus === 'Venda Concluída'
          ? 'fechado'
          : newStatus === 'Orçamento Respondido no WhatsApp'
          ? 'respondido'
          : 'pendente';

      setSolicitacoes((prev) => {
        const nextSol = prev.map((s) =>
          s.id === linkedSolId
            ? {
                ...s,
                status: mappedSolStatus,
                estoque_baixado: s.estoque_baixado || didDeductStock,
              }
            : s
        );
        latestSolicitacoesRef.current = nextSol;
        try {
          localStorage.setItem(
            SOLICITACOES_STORAGE_KEY,
            JSON.stringify(nextSol)
          );
        } catch {
          // Ignore
        }
        return nextSol;
      });

      try {
        await updateDoc(doc(db, 'solicitacoes_orcamento', linkedSolId), {
          status: mappedSolStatus,
          ...(didDeductStock ? { estoque_baixado: true } : {}),
        });
        setLastSyncTime(new Date().toLocaleTimeString('pt-BR'));
      } catch (error) {
        reportFirestoreError(
          error,
          OperationType.UPDATE,
          `solicitacoes_orcamento/${linkedSolId}`
        );
      }
    }

    // Se existir documento espelho na coleção 'orders' (#PED), atualiza também
    const mirrorOrderDocId =
      targetOrder?.linkedFirestoreOrderId ||
      (targetOrder?.fromFirestore ? targetOrder.id : '');
    if (mirrorOrderDocId) {
      try {
        await updateDoc(doc(db, 'orders', mirrorOrderDocId), {
          status: newStatus,
          ...(didDeductStock ? { stockDeducted: true } : {}),
        });
      } catch {
        // Ignore se documento não existir na coleção 'orders'
      }
    }
  };

  const handleSaveQuoteAndReply = async (
    orderId: string,
    updatedPrices: Record<string, number>,
    discountPercent: number,
    freightCost: number,
    paymentTerms: string,
    deliveryLeadTime: string,
    updatedItems?: OrderItem[]
  ) => {
    const targetOrder =
      orders.find((o) => o.id === orderId) ||
      (activeQuoteOrder?.id === orderId ? activeQuoteOrder : undefined);

    const baseItemsToUse =
      updatedItems && updatedItems.length > 0
        ? updatedItems
        : targetOrder?.items || [];

    const finalItems: OrderItem[] = baseItemsToUse.map((item) => ({
      ...item,
      unitPrice: updatedPrices[item.sku] ?? item.unitPrice ?? 0,
    }));

    const updatedOrderObj: Order | undefined = targetOrder
      ? {
          ...targetOrder,
          status:
            targetOrder.status === 'Venda Concluída'
              ? 'Venda Concluída'
              : ('Orçamento Respondido no WhatsApp' as OrderStatus),
          discountPercent,
          freightCost,
          paymentTerms,
          deliveryLeadTime,
          items: finalItems,
          itemsCount: finalItems.reduce(
            (acc, it) => acc + Math.max(1, it.quantity || 1),
            0
          ),
        }
      : undefined;

    const existsInOrders = orders.some((o) => o.id === orderId);
    const next = existsInOrders
      ? orders.map((o) => (o.id === orderId && updatedOrderObj ? updatedOrderObj : o))
      : updatedOrderObj
      ? [updatedOrderObj, ...orders]
      : orders;

    persistAndBroadcastOrders(next);
    if (updatedOrderObj && activeQuoteOrder?.id === orderId) {
      setActiveQuoteOrder(updatedOrderObj);
    }

    if (updatedOrderObj) {
      const totals = calculateQuoteTotals(
        updatedOrderObj.items,
        updatedPrices,
        discountPercent,
        freightCost
      );

      const cleanPricesMap: Record<string, number> = {};
      for (const item of updatedOrderObj.items) {
        const val = Number(updatedPrices[item.sku] ?? item.unitPrice ?? 0);
        cleanPricesMap[item.sku] =
          Number.isFinite(val) && val >= 0 ? Number(val.toFixed(2)) : 0;
      }

      const serializedProposalItems = updatedOrderObj.items
        .slice(0, 100)
        .map((it) => ({
          sku: it.sku.slice(0, 64),
          name: it.name.slice(0, 200),
          quantity: Math.max(1, Math.floor(Number(it.quantity) || 1)),
          unitPrice: cleanPricesMap[it.sku] ?? 0,
          ...(it.catalogProductId
            ? { catalogProductId: it.catalogProductId.slice(0, 128) }
            : {}),
          ...(it.catalogSku ? { catalogSku: it.catalogSku.slice(0, 64) } : {}),
        }));

      // Se o orçamento estiver vinculado à coleção solicitacoes_orcamento, sincroniza os preços por peça, itens da proposta, frete, preço final e status
      const linkedSolicitacao = solicitacoes.find(
        (s) =>
          s.id === updatedOrderObj.solicitacaoId ||
          s.protocolo === updatedOrderObj.protocol
      );

      if (linkedSolicitacao) {
        setSolicitacoes((prev) => {
          const nextSol = prev.map((s) =>
            s.id === linkedSolicitacao.id
              ? {
                  ...s,
                  status:
                    s.status === 'fechado'
                      ? ('fechado' as const)
                      : ('respondido' as const),
                  preco_final: totals.finalTotal,
                  frete: totals.freightCost,
                  desconto_percentual: discountPercent,
                  precos_itens: cleanPricesMap,
                  itens_proposta: serializedProposalItems,
                  condicoes_pagamento: paymentTerms,
                  prazo_entrega: deliveryLeadTime,
                }
              : s
          );
          latestSolicitacoesRef.current = nextSol;
          try {
            localStorage.setItem(
              SOLICITACOES_STORAGE_KEY,
              JSON.stringify(nextSol)
            );
          } catch {
            // Ignore
          }
          return nextSol;
        });

        setHighlightedSolicitacaoIds((prev) =>
          prev.filter((id) => id !== linkedSolicitacao.id)
        );

        try {
          await updateDoc(
            doc(db, 'solicitacoes_orcamento', linkedSolicitacao.id),
            {
              status:
                linkedSolicitacao.status === 'fechado' ? 'fechado' : 'respondido',
              preco_final: totals.finalTotal,
              frete: totals.freightCost,
              desconto_percentual: discountPercent,
              precos_itens: cleanPricesMap,
              itens_proposta: serializedProposalItems,
              condicoes_pagamento: paymentTerms.slice(0, 240),
              prazo_entrega: deliveryLeadTime.slice(0, 240),
            }
          );
          setLastSyncTime(new Date().toLocaleTimeString('pt-BR'));
        } catch (error) {
          reportFirestoreError(
            error,
            OperationType.UPDATE,
            `solicitacoes_orcamento/${linkedSolicitacao.id}`
          );
        }
      } else if (updatedOrderObj.fromFirestore) {
        // Pedido avulso (#PED sem #COT correspondente): persiste itens precificados, frete, desconto e condições na coleção 'orders'
        try {
          await updateDoc(doc(db, 'orders', updatedOrderObj.id), {
            status: updatedOrderObj.status,
            items: serializedProposalItems,
            itemsCount: Math.min(10000, Math.max(1, updatedOrderObj.itemsCount)),
            discountPercent: Math.min(100, Math.max(0, discountPercent)),
            freightCost: Math.min(10000000, Math.max(0, totals.freightCost)),
            paymentTerms: paymentTerms.slice(0, 240),
            deliveryLeadTime: deliveryLeadTime.slice(0, 240),
            updatedAt: new Date().toISOString(),
          });
          setLastSyncTime(new Date().toLocaleTimeString('pt-BR'));
        } catch (error) {
          reportFirestoreError(
            error,
            OperationType.UPDATE,
            `orders/${updatedOrderObj.id}`
          );
        }
      }

      appendEvent({
        category: 'Orçamentos',
        action: 'Cotação Precificada e Proposta Enviada no WhatsApp',
        description: `Proposta comercial gerada para ${updatedOrderObj.customerName} (${updatedOrderObj.vehicleInfo}) no WhatsApp ${updatedOrderObj.customerPhone}.`,
        reference: updatedOrderObj.protocol,
        delta: `Total: ${formatCurrencyBRL(totals.finalTotal)}`,
      });
    }
  };

  const handleOpenQuoteModalForSolicitacao = (
    solicitacao: SolicitacaoOrcamento,
    custoFornecedor: number,
    margemLucro: number,
    precoFinal: number
  ) => {
    const baseOrderForModal = convertSolicitacaoToOrderForPricing(
      solicitacao,
      custoFornecedor,
      margemLucro,
      precoFinal
    );

    const existingIdx = orders.findIndex(
      (o) =>
        o.id === baseOrderForModal.id ||
        o.solicitacaoId === solicitacao.id ||
        o.protocol === solicitacao.protocolo
    );

    const existingOrder = existingIdx >= 0 ? orders[existingIdx] : undefined;
    const orderForModal: Order = existingOrder
      ? {
          ...baseOrderForModal,
          discountPercent:
            solicitacao.desconto_percentual ??
            existingOrder.discountPercent ??
            baseOrderForModal.discountPercent,
          freightCost:
            solicitacao.frete ??
            existingOrder.freightCost ??
            baseOrderForModal.freightCost,
          paymentTerms:
            solicitacao.condicoes_pagamento ??
            existingOrder.paymentTerms ??
            baseOrderForModal.paymentTerms,
          deliveryLeadTime:
            solicitacao.prazo_entrega ??
            existingOrder.deliveryLeadTime ??
            baseOrderForModal.deliveryLeadTime,
          items: baseOrderForModal.items.map((item) => {
            const existingItem = existingOrder.items.find(
              (it) => it.sku === item.sku
            );
            return {
              ...item,
              unitPrice:
                solicitacao.precos_itens?.[item.sku] ??
                existingItem?.unitPrice ??
                item.unitPrice ??
                0,
            };
          }),
        }
      : baseOrderForModal;

    const nextOrders =
      existingIdx >= 0
        ? orders.map((o, idx) => (idx === existingIdx ? orderForModal : o))
        : [orderForModal, ...orders];

    persistAndBroadcastOrders(nextOrders);
    setActiveQuoteOrder(orderForModal);
  };

  const handleDeleteSolicitacao = async (solicitacaoId: string) => {
    const removed = solicitacoes.find((s) => s.id === solicitacaoId);
    setSolicitacoes((prev) => {
      const next = prev.filter((s) => s.id !== solicitacaoId);
      latestSolicitacoesRef.current = next;
      try {
        localStorage.setItem(SOLICITACOES_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });

    const nextOrders = orders.filter(
      (o) =>
        o.solicitacaoId !== solicitacaoId &&
        o.id !== `ord-from-${solicitacaoId}`
    );
    persistAndBroadcastOrders(nextOrders);

    setHighlightedSolicitacaoIds((prev) =>
      prev.filter((id) => id !== solicitacaoId)
    );

    appendEvent({
      category: 'Orçamentos',
      action: 'Solicitação de Orçamento Removida do Mural',
      description: removed
        ? `Orçamento livre de ${removed.nome_cliente} (${removed.peca_solicitada}) excluído do sistema.`
        : `Solicitação ${solicitacaoId} excluída do sistema.`,
      reference: removed?.protocolo || solicitacaoId,
      delta: 'Removido',
    });

    try {
      await deleteDoc(doc(db, 'solicitacoes_orcamento', solicitacaoId));
      setLastSyncTime(new Date().toLocaleTimeString('pt-BR'));
    } catch (error) {
      reportFirestoreError(
        error,
        OperationType.DELETE,
        `solicitacoes_orcamento/${solicitacaoId}`
      );
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    const removed = orders.find((o) => o.id === orderId);
    const linkedSolId =
      removed?.solicitacaoId ||
      (orderId.startsWith('ord-from-')
        ? orderId.replace(/^ord-from-/, '')
        : '');

    // Identifica também qualquer documento #PED duplicado associado a este orçamento
    const matchingPedDocIds = new Set<string>();
    if (removed?.linkedFirestoreOrderId) {
      matchingPedDocIds.add(removed.linkedFirestoreOrderId);
    }
    if (!linkedSolId) {
      matchingPedDocIds.add(orderId);
    }
    if (removed) {
      for (const fsOrd of latestFirestoreOrdersRef.current) {
        if (areOrdersDuplicateLandingPagePair(removed, fsOrd)) {
          matchingPedDocIds.add(fsOrd.id);
        }
      }
    }

    latestFirestoreOrdersRef.current = latestFirestoreOrdersRef.current.filter(
      (o) => !matchingPedDocIds.has(o.id)
    );

    const nextOrders = orders.filter(
      (o) => o.id !== orderId && !matchingPedDocIds.has(o.id)
    );
    persistAndBroadcastOrders(nextOrders);

    if (linkedSolId) {
      setSolicitacoes((prev) => {
        const nextSol = prev.filter((s) => s.id !== linkedSolId);
        latestSolicitacoesRef.current = nextSol;
        try {
          localStorage.setItem(
            SOLICITACOES_STORAGE_KEY,
            JSON.stringify(nextSol)
          );
        } catch {
          // Ignore
        }
        return nextSol;
      });
    }

    appendEvent({
      category: 'Orçamentos',
      action: 'Orçamento Excluído da Gestão Comercial',
      description: removed
        ? `Registro de orçamento de ${removed.customerName} (${removed.vehicleInfo}) foi excluído.`
        : `Orçamento ${orderId} foi excluído.`,
      reference: removed?.protocol || orderId,
      delta: 'Removido',
    });

    if (linkedSolId) {
      try {
        await deleteDoc(doc(db, 'solicitacoes_orcamento', linkedSolId));
        setLastSyncTime(new Date().toLocaleTimeString('pt-BR'));
      } catch (error) {
        reportFirestoreError(
          error,
          OperationType.DELETE,
          `solicitacoes_orcamento/${linkedSolId}`
        );
      }
    }

    for (const pedDocId of matchingPedDocIds) {
      try {
        await deleteDoc(doc(db, 'orders', pedDocId));
        setLastSyncTime(new Date().toLocaleTimeString('pt-BR'));
      } catch {
        // Caso não exista na coleção 'orders'
      }
    }
  };

  const handleCreateCustomSolicitacao = async (data: {
    nome_cliente: string;
    whatsapp: string;
    dados_veiculo: string;
    peca_solicitada: string;
    observacoes?: string;
  }) => {
    const now = new Date();
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const customSol: SolicitacaoOrcamento = {
      id: `SOL-LIVRE-${Date.now()}`,
      protocolo: `#COT-2026-${randomNum}`,
      nome_cliente: data.nome_cliente.trim(),
      whatsapp: data.whatsapp.trim(),
      dados_veiculo: data.dados_veiculo.trim(),
      peca_solicitada: data.peca_solicitada.trim(),
      status: 'pendente',
      custo_fornecedor: 0,
      margem_lucro: 35,
      preco_final: 0,
      observacoes: data.observacoes?.trim() || '',
      data_criacao: now.toISOString(),
      horario_exibicao: `${now.toLocaleDateString(
        'pt-BR'
      )} às ${now.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })}`,
      timestamp_ms: now.getTime(),
    };

    const payload = toFirestoreSolicitacaoPayload(customSol);
    const docId = String(payload.id);

    knownSolicitacaoIdsRef.current.add(customSol.id);
    knownSolicitacaoIdsRef.current.add(docId);

    setSolicitacoes((prev) => {
      const next = [customSol, ...prev];
      latestSolicitacoesRef.current = next;
      try {
        localStorage.setItem(SOLICITACOES_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });

    const linkedOrder = convertSolicitacaoToOrderForPricing(
      customSol,
      0,
      35,
      0
    );
    persistAndBroadcastOrders([linkedOrder, ...orders], 'NEW_ORDER', linkedOrder);

    appendEvent({
      category: 'Orçamentos',
      action: 'Novo Orçamento Livre Registrado',
      description: `${customSol.nome_cliente} solicitou "${customSol.peca_solicitada}" para ${customSol.dados_veiculo}.`,
      reference: customSol.protocolo,
      delta: 'Dados livres',
    });

    try {
      await setDoc(doc(db, 'solicitacoes_orcamento', docId), payload);
      setLastSyncTime(new Date().toLocaleTimeString('pt-BR'));
    } catch (error) {
      reportFirestoreError(
        error,
        OperationType.CREATE,
        `solicitacoes_orcamento/${docId}`
      );
    }
  };

  const handleSimulateIncomingOrder = async () => {
    const simulatedSolicitacao = createSimulatedSolicitacaoOrcamento();
    const payload = toFirestoreSolicitacaoPayload(simulatedSolicitacao);
    const docId = String(payload.id);

    knownSolicitacaoIdsRef.current.add(simulatedSolicitacao.id);
    knownSolicitacaoIdsRef.current.add(docId);

    setSolicitacoes((prev) => {
      const next = [simulatedSolicitacao, ...prev];
      latestSolicitacoesRef.current = next;
      try {
        localStorage.setItem(SOLICITACOES_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });

    const simulatedOrder = convertSolicitacaoToOrderForPricing(
      simulatedSolicitacao,
      simulatedSolicitacao.custo_fornecedor,
      simulatedSolicitacao.margem_lucro,
      simulatedSolicitacao.preco_final
    );

    const next = [simulatedOrder, ...orders];
    persistAndBroadcastOrders(next, 'NEW_ORDER', simulatedOrder);
    triggerIncomingQuoteAlert({
      protocol: simulatedOrder.protocol,
      customerName: simulatedOrder.customerName,
      targetTab: 'orders',
    });

    appendEvent({
      category: 'Orçamentos',
      action: 'Novo Orçamento Livre Recebido da Landing Page',
      description: `${simulatedSolicitacao.nome_cliente} digitou pedido livre: "${simulatedSolicitacao.peca_solicitada}" (${simulatedSolicitacao.dados_veiculo}).`,
      reference: simulatedSolicitacao.protocolo,
      delta: 'Sincronizado no Firestore',
    });

    try {
      await setDoc(doc(db, 'solicitacoes_orcamento', docId), payload);
      setLastSyncTime(new Date().toLocaleTimeString('pt-BR'));
    } catch (error) {
      reportFirestoreError(
        error,
        OperationType.CREATE,
        `solicitacoes_orcamento/${docId}`
      );
    }
  };

  // ===========================================================================
  // HANDLERS DO MURAL DE PEDIDOS / COTAÇÕES PENDENTES ("solicitacoes_orcamento")
  // ===========================================================================
  const pendingSolicitacoesCount = useMemo(
    () => solicitacoes.filter((s) => s.status === 'pendente').length,
    [solicitacoes]
  );

  const handleMarkSolicitacaoReplied = async (
    solicitacao: SolicitacaoOrcamento,
    custoFornecedor: number,
    margemLucro: number,
    precoFinal: number
  ) => {
    setSolicitacoes((prev) => {
      const next = prev.map((s) =>
        s.id === solicitacao.id
          ? {
              ...s,
              status: 'respondido' as const,
              custo_fornecedor: custoFornecedor,
              margem_lucro: margemLucro,
              preco_final: precoFinal,
            }
          : s
      );
      latestSolicitacoesRef.current = next;
      try {
        localStorage.setItem(SOLICITACOES_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });

    setHighlightedSolicitacaoIds((prev) =>
      prev.filter((id) => id !== solicitacao.id)
    );

    appendEvent({
      category: 'Orçamentos',
      action: 'Cotação do Mural Respondida via WhatsApp',
      description: `Proposta enviada para ${solicitacao.nome_cliente} (${solicitacao.dados_veiculo}).`,
      reference: solicitacao.protocolo,
      delta: `Valor: ${formatCurrencyBRL(precoFinal)}`,
    });

    try {
      await updateDoc(doc(db, 'solicitacoes_orcamento', solicitacao.id), {
        status: 'respondido',
        custo_fornecedor: custoFornecedor,
        margem_lucro: margemLucro,
        preco_final: precoFinal,
      });
      setLastSyncTime(new Date().toLocaleTimeString('pt-BR'));
    } catch (error) {
      reportFirestoreError(
        error,
        OperationType.UPDATE,
        `solicitacoes_orcamento/${solicitacao.id}`
      );
    }
  };

  const handleConvertSolicitacaoToSale = async (
    solicitacao: SolicitacaoOrcamento,
    custoFornecedor: number,
    margemLucro: number,
    precoFinal: number
  ) => {
    // 1. Atualiza estado local do Mural de Pedidos para "fechado"
    setSolicitacoes((prev) => {
      const next = prev.map((s) =>
        s.id === solicitacao.id
          ? {
              ...s,
              status: 'fechado' as const,
              custo_fornecedor: custoFornecedor,
              margem_lucro: margemLucro,
              preco_final: precoFinal,
            }
          : s
      );
      latestSolicitacoesRef.current = next;
      try {
        localStorage.setItem(SOLICITACOES_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });

    setHighlightedSolicitacaoIds((prev) =>
      prev.filter((id) => id !== solicitacao.id)
    );

    // 2. Lança no fluxo de registro de vendas / Gestão de Orçamentos como "Venda Concluída"
    const completedOrder = convertSolicitacaoToCompletedOrder(
      solicitacao,
      custoFornecedor,
      margemLucro,
      precoFinal
    );

    const existingOrderIdx = orders.findIndex(
      (o) =>
        o.id === completedOrder.id || o.protocol === completedOrder.protocol
    );
    const nextOrders =
      existingOrderIdx >= 0
        ? orders.map((o, idx) =>
            idx === existingOrderIdx ? completedOrder : o
          )
        : [completedOrder, ...orders];

    persistAndBroadcastOrders(nextOrders, 'ORDERS_UPDATED', completedOrder);

    // 3. Registra no Log de Eventos
    appendEvent({
      category: 'Orçamentos',
      action: 'Cotação do Mural Convertida em Venda',
      description: `Solicitação de ${solicitacao.nome_cliente} (${solicitacao.peca_solicitada}) fechada e lançada na Gestão de Orçamentos.`,
      reference: solicitacao.protocolo,
      delta: `Venda: ${formatCurrencyBRL(completedOrder.items[0]?.unitPrice ?? precoFinal)}`,
    });

    // 4. Persiste atualização de status = "fechado" no Firestore
    try {
      await updateDoc(doc(db, 'solicitacoes_orcamento', solicitacao.id), {
        status: 'fechado',
        custo_fornecedor: custoFornecedor,
        margem_lucro: margemLucro,
        preco_final: precoFinal,
      });
      setLastSyncTime(new Date().toLocaleTimeString('pt-BR'));
    } catch (error) {
      reportFirestoreError(
        error,
        OperationType.UPDATE,
        `solicitacoes_orcamento/${solicitacao.id}`
      );
    }
  };

  const handleSimulateNewSolicitacao = async () => {
    const simulated = createSimulatedSolicitacaoOrcamento();
    const payload = toFirestoreSolicitacaoPayload(simulated);
    const docId = String(payload.id);

    knownSolicitacaoIdsRef.current.add(simulated.id);
    knownSolicitacaoIdsRef.current.add(docId);

    setSolicitacoes((prev) => {
      const next = [simulated, ...prev];
      latestSolicitacoesRef.current = next;
      try {
        localStorage.setItem(SOLICITACOES_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });

    setHighlightedSolicitacaoIds((prev) =>
      Array.from(new Set([simulated.id, ...prev]))
    );
    triggerIncomingQuoteAlert({
      protocol: simulated.protocolo,
      customerName: simulated.nome_cliente,
      targetTab: 'mural',
    });

    appendEvent({
      category: 'Orçamentos',
      action: 'Nova Cotação Pendente no Mural',
      description: `${simulated.nome_cliente} solicitou cotação de "${simulated.peca_solicitada}" para ${simulated.dados_veiculo}.`,
      reference: simulated.protocolo,
      delta: 'Status: pendente',
    });

    try {
      await setDoc(doc(db, 'solicitacoes_orcamento', docId), payload);
      setLastSyncTime(new Date().toLocaleTimeString('pt-BR'));
    } catch (error) {
      reportFirestoreError(
        error,
        OperationType.CREATE,
        `solicitacoes_orcamento/${docId}`
      );
    }
  };

  const handleResetEvents = () => {
    setEvents(INITIAL_EVENTS);
    try {
      localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(INITIAL_EVENTS));
    } catch {
      // Ignore
    }
  };

  const handleExportCatalogCsv = (itemsToExport: Product[]) => {
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `tem-de-tudo-catalogo-produtos-${dateStamp}.csv`;
    const csvContent = generateProductsCsv(itemsToExport);
    downloadCsvFile(csvContent, filename);

    appendEvent({
      category: 'Produtos',
      action: 'Catálogo de Produtos Exportado para CSV',
      description: `Planilha CSV gerada com ${itemsToExport.length} peça(s) do catálogo e estoque atual.`,
      reference: filename,
      delta: `${itemsToExport.length} registro(s)`,
    });
  };

  const handleExportOrdersCsv = (ordersToExport: Order[]) => {
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `tem-de-tudo-orcamentos-pedidos-${dateStamp}.csv`;
    const csvContent = generateOrdersCsv(ordersToExport);
    downloadCsvFile(csvContent, filename);

    appendEvent({
      category: 'Orçamentos',
      action: 'Lista de Orçamentos Exportada para CSV',
      description: `Planilha CSV gerada com ${ordersToExport.length} orçamento(s) / pedido(s) da gestão comercial.`,
      reference: filename,
      delta: `${ordersToExport.length} orçamento(s)`,
    });
  };

  const handleSwitchTab = (tab: ActiveTab) => {
    if (tab === 'mural') {
      setActiveTab('orders');
      return;
    }
    setActiveTab(tab);
  };

  const activeOrdersCount = useMemo(
    () => orders.filter((o) => isActiveOrderStatus(o.status)).length,
    [orders]
  );

  const historyOrdersCount = useMemo(
    () => orders.filter((o) => isHistoryOrderStatus(o.status)).length,
    [orders]
  );

  const overdue48hCount = useMemo(
    () =>
      orders.filter(
        (o) =>
          isActiveOrderStatus(o.status) &&
          getOrderPendingAgeInfo(o).isOverdue48h
      ).length,
    [orders]
  );

  const viewTitles: Record<ActiveTab, string> = {
    dashboard: 'Visão Geral / Dashboard Operacional',
    catalog: 'Catálogo de Peças & Controle de Estoque',
    mural: 'Central Unificada de Orçamentos & Pedidos',
    orders: 'Central Unificada de Orçamentos & Pedidos',
    history: 'Histórico de Pedidos Concluídos & Cancelados',
    form: editingProduct
      ? `Editando Peça: ${editingProduct.sku}`
      : 'Novo Cadastro de Produto',
    events: 'Log de Eventos e Histórico de Alterações',
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#0B0F17] text-slate-100">
      {/* ====================================================================
          SIDEBAR DE NAVEGAÇÃO INDUSTRIAL (280px Desktop / Topo em Tablets)
          ==================================================================== */}
      <aside className="w-full lg:w-72 bg-[#111827] border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col shrink-0">
        {/* Marca da Empresa */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between lg:block">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/15 border border-orange-500/40 flex items-center justify-center text-orange-500 shrink-0">
              <Wrench className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold tracking-normal text-white truncate">
                TEM DE TUDO AUTO PEÇAS
              </h1>
              <p className="text-xs text-slate-400 truncate">
                Tem de Tudo Auto Peças e Serviços LTDA
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className="lg:hidden px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-bold transition-colors whitespace-nowrap shrink-0"
          >
            Orçamentos ({activeOrdersCount})
          </button>
        </div>

        {/* Abas do Sistema */}
        <nav
          className="p-3 flex lg:flex-col gap-1.5 overflow-x-auto"
          aria-label="Navegação Principal do ERP"
        >
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg text-sm transition-colors whitespace-nowrap shrink-0 w-full text-left ${
              activeTab === 'dashboard'
                ? 'bg-orange-500 text-slate-950 font-bold'
                : 'text-slate-300 hover:bg-slate-800/70 hover:text-white font-medium'
            }`}
          >
            <span className="flex items-center gap-3">
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>Visão Geral / Dashboard</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            data-testid="nav-orders-unified"
            className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg text-sm transition-colors whitespace-nowrap shrink-0 w-full text-left ${
              activeTab === 'orders' || activeTab === 'mural'
                ? 'bg-orange-500 text-slate-950 font-bold'
                : 'text-slate-300 hover:bg-slate-800/70 hover:text-white font-medium'
            }`}
          >
            <span className="flex items-center gap-3">
              <ClipboardList className="w-4 h-4 shrink-0" />
              <span>Orçamentos &amp; Pedidos</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              {overdue48hCount > 0 && (
                <span
                  data-testid="sidebar-overdue-indicator"
                  title={`${overdue48hCount} orçamento(s) pendente(s) há mais de 48h`}
                  className={`inline-flex items-center gap-0.5 text-[11px] font-mono font-bold tabular-nums ${
                    activeTab === 'orders' || activeTab === 'mural'
                      ? 'text-rose-950'
                      : 'text-rose-400'
                  }`}
                >
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  <span>+48h</span>
                </span>
              )}
              <span
                data-testid="sidebar-orders-badge"
                className={`text-xs font-mono tabular-nums ${
                  activeTab === 'orders' || activeTab === 'mural'
                    ? 'text-slate-950 font-bold'
                    : 'text-orange-400 font-bold'
                }`}
              >
                {activeOrdersCount}
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            data-testid="nav-orders-history"
            className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg text-sm transition-colors whitespace-nowrap shrink-0 w-full text-left ${
              activeTab === 'history'
                ? 'bg-orange-500 text-slate-950 font-bold'
                : 'text-slate-300 hover:bg-slate-800/70 hover:text-white font-medium'
            }`}
          >
            <span className="flex items-center gap-3">
              <Archive className="w-4 h-4 shrink-0" />
              <span>Concluídos &amp; Cancelados</span>
            </span>
            <span
              data-testid="sidebar-history-badge"
              className={`text-xs font-mono tabular-nums ${
                activeTab === 'history'
                  ? 'text-slate-950 font-bold'
                  : 'text-emerald-400 font-bold'
              }`}
            >
              {historyOrdersCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('catalog')}
            className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg text-sm transition-colors whitespace-nowrap shrink-0 w-full text-left ${
              activeTab === 'catalog'
                ? 'bg-orange-500 text-slate-950 font-bold'
                : 'text-slate-300 hover:bg-slate-800/70 hover:text-white font-medium'
            }`}
          >
            <span className="flex items-center gap-3">
              <PackageSearch className="w-4 h-4 shrink-0" />
              <span>Catálogo &amp; Estoque</span>
            </span>
            <span
              className={`text-xs font-mono tabular-nums ${
                activeTab === 'catalog'
                  ? 'text-slate-950 font-bold'
                  : 'text-slate-400'
              }`}
            >
              {products.length}
            </span>
          </button>

          <button
            type="button"
            onClick={handleOpenNewProduct}
            className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg text-sm transition-colors whitespace-nowrap shrink-0 w-full text-left ${
              activeTab === 'form'
                ? 'bg-orange-500 text-slate-950 font-bold'
                : 'text-slate-300 hover:bg-slate-800/70 hover:text-white font-medium'
            }`}
          >
            <span className="flex items-center gap-3">
              <PlusSquare className="w-4 h-4 shrink-0" />
              <span>
                {editingProduct
                  ? `Editando ${editingProduct.sku}`
                  : 'Novo Cadastro de Produto'}
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('events')}
            data-testid="nav-event-log"
            className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg text-sm transition-colors whitespace-nowrap shrink-0 w-full text-left ${
              activeTab === 'events'
                ? 'bg-orange-500 text-slate-950 font-bold'
                : 'text-slate-300 hover:bg-slate-800/70 hover:text-white font-medium'
            }`}
          >
            <span className="flex items-center gap-3">
              <History className="w-4 h-4 shrink-0" />
              <span>Log de Eventos</span>
            </span>
            <span
              className={`text-xs font-mono tabular-nums ${
                activeTab === 'events'
                  ? 'text-slate-950 font-bold'
                  : 'text-slate-400'
              }`}
            >
              {events.length}
            </span>
          </button>
        </nav>

        {/* Status de Conexão do Banco e Atalhos Operacionais (Desktop) */}
        <div className="hidden lg:flex flex-col gap-3 mt-auto p-4 border-t border-slate-800 bg-[#0D131F]">
          <div className="text-xs text-slate-400 space-y-1">
            <p className="font-semibold text-emerald-400 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 shrink-0" />
              <span>
                {firestoreConnected
                  ? 'Banco de Dados Conectado'
                  : 'Conectando ao Banco...'}
              </span>
            </p>
            <p className="text-[11px] text-slate-400">
              Sincronização ativa com o catálogo e orçamentos da loja.
            </p>
          </div>

          <button
            type="button"
            data-testid="sidebar-open-orders-btn"
            onClick={() => setActiveTab('orders')}
            className="w-full py-2 px-3 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold text-xs transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Orçamentos em Aberto ({activeOrdersCount})</span>
          </button>

          <button
            type="button"
            data-testid="sidebar-backup-btn"
            onClick={() => setIsSettingsModalOpen(true)}
            className="w-full py-1.5 px-3 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white text-xs font-medium transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
            <span>Backup Diário (.JSON)</span>
          </button>
        </div>
      </aside>

      {/* ====================================================================
          ÁREA PRINCIPAL DE OPERAÇÃO DO BALCÃO
          ==================================================================== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar com indicador Firestore Sync */}
        <header className="h-16 px-6 bg-[#111827] border-b border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs font-medium text-slate-400 hidden sm:inline whitespace-nowrap">
              Tem de Tudo Auto Peças e Serviços LTDA
            </span>
            <span className="text-slate-700 hidden sm:inline" aria-hidden="true">
              /
            </span>
            <h2 className="text-base font-bold text-white truncate">
              {viewTitles[activeTab]}
            </h2>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <span className="text-xs font-mono text-slate-400 hidden xl:inline tabular-nums">
              Firestore Sync às {lastSyncTime}
            </span>

            {/* Atalho Rápido de Som (Ping) */}
            <button
              type="button"
              data-testid="quick-toggle-sound-btn"
              onClick={() => {
                const nextEnabled = !soundSettings.enabled;
                const nextSettings = {
                  ...soundSettings,
                  enabled: nextEnabled,
                };
                handleUpdateSoundSettings(nextSettings);
                if (nextEnabled) {
                  playNotificationPing(nextSettings);
                }
              }}
              title={
                soundSettings.enabled
                  ? 'Notificações sonoras ativadas (clique para silenciar)'
                  : 'Notificações sonoras desativadas (clique para ativar)'
              }
              className={`px-2.5 py-2 rounded-lg border text-xs font-semibold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                soundSettings.enabled
                  ? 'bg-slate-800/90 hover:bg-slate-700 border-slate-700 text-emerald-400'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400'
              }`}
            >
              {soundSettings.enabled ? (
                <Volume2 className="w-4 h-4 shrink-0" />
              ) : (
                <VolumeX className="w-4 h-4 shrink-0" />
              )}
              <span className="hidden sm:inline">
                {soundSettings.enabled ? 'Som Ativo' : 'Som Mudo'}
              </span>
            </button>

            {/* Botão de Configurações do Usuário */}
            <button
              type="button"
              data-testid="open-user-settings-btn"
              onClick={() => setIsSettingsModalOpen(true)}
              aria-label="Abrir configurações do usuário"
              className="px-2.5 py-2 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Settings className="w-4 h-4 text-orange-400 shrink-0" />
              <span className="hidden md:inline">Configurações</span>
            </button>

            <button
              type="button"
              onClick={handleOpenNewProduct}
              className="px-3.5 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold text-xs transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Peça</span>
            </button>
          </div>
        </header>

        {/* Banner de Alerta de Erro de Sincronização Firestore */}
        {firestoreErrorBanner && (
          <div
            role="alert"
            data-testid="firestore-error-banner"
            className="bg-rose-950/90 border-b border-rose-500/50 px-6 py-3 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3 min-w-0">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <p className="text-xs sm:text-sm font-medium text-rose-100">
                {firestoreErrorBanner}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFirestoreErrorBanner(null)}
              aria-label="Fechar aviso de erro do banco de dados"
              className="p-1 text-rose-300 hover:text-white shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Banner de Alerta Visual Instantâneo de Novo Orçamento Recebido */}
        {incomingOrderAlert.visible && (
          <div
            role="status"
            aria-live="polite"
            className="bg-emerald-950/90 border-b border-emerald-500/40 px-6 py-3 flex flex-wrap items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <BellRing className="w-5 h-5 text-emerald-400 shrink-0" />
              <p className="text-sm font-medium text-emerald-100">
                Nova solicitação de cotação{' '}
                <strong className="font-mono text-white">
                  {incomingOrderAlert.protocol}
                </strong>{' '}
                enviada por <strong>{incomingOrderAlert.customerName}</strong>!
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('orders');
                  setIncomingOrderAlert((prev) => ({ ...prev, visible: false }));
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors whitespace-nowrap"
              >
                Abrir Cotação Agora
              </button>
              <button
                type="button"
                onClick={() =>
                  setIncomingOrderAlert((prev) => ({ ...prev, visible: false }))
                }
                aria-label="Fechar alerta de novo orçamento"
                className="p-1 text-emerald-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Conteúdo Principal */}
        <main className="flex-1 p-6 max-w-[1440px] w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              metrics={metrics}
              recentOrders={orders}
              solicitacoes={solicitacoes}
              firestoreConnected={firestoreConnected}
              onSwitchTab={handleSwitchTab}
              onFilterByCategory={(category) => {
                setCatalogFilters({
                  search: '',
                  category,
                  system: 'ALL',
                  stockStatus: 'ALL',
                  modelFilter: 'ALL',
                  yearFilter: 'ALL',
                  plateSearch: '',
                  chassisSearch: '',
                });
                setActiveTab('catalog');
              }}
              onSelectQuoteStatus={(statusKey) => {
                if (statusKey === 'pendente') {
                  setOrderStatusFilter('Pendente de Análise');
                  setActiveTab('orders');
                } else if (statusKey === 'respondido') {
                  setOrderStatusFilter('Orçamento Respondido no WhatsApp');
                  setActiveTab('orders');
                } else if (statusKey === 'fechado') {
                  setHistoryStatusFilter('Venda Concluída');
                  setActiveTab('history');
                }
              }}
              onOpenQuoteModal={(order) => setActiveQuoteOrder(order)}
              onOpenNewProduct={handleOpenNewProduct}
              onSimulateIncomingOrder={handleSimulateIncomingOrder}
            />
          )}

          {(activeTab === 'orders' || activeTab === 'mural') && (
            <OrdersView
              orders={orders}
              mode="active"
              statusFilter={orderStatusFilter}
              onStatusFilterChange={setOrderStatusFilter}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              onOpenQuoteModal={(order) => setActiveQuoteOrder(order)}
              onSimulateIncomingOrder={handleSimulateIncomingOrder}
              onExportOrdersCsv={handleExportOrdersCsv}
              onDeleteOrder={handleDeleteOrder}
              onCreateCustomSolicitacao={handleCreateCustomSolicitacao}
              onSwitchToHistoryTab={() => setActiveTab('history')}
            />
          )}

          {activeTab === 'history' && (
            <OrdersView
              orders={orders}
              mode="history"
              statusFilter={historyStatusFilter}
              onStatusFilterChange={setHistoryStatusFilter}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              onOpenQuoteModal={(order) => setActiveQuoteOrder(order)}
              onExportOrdersCsv={handleExportOrdersCsv}
              onDeleteOrder={handleDeleteOrder}
              onSwitchToActiveTab={() => setActiveTab('orders')}
            />
          )}

          {activeTab === 'catalog' && (
            <CatalogView
              products={products}
              filteredProducts={filteredProducts}
              filters={catalogFilters}
              onFilterChange={(next) =>
                setCatalogFilters((prev) => ({ ...prev, ...next }))
              }
              onResetFilters={() =>
                setCatalogFilters({
                  search: '',
                  category: 'ALL',
                  system: 'ALL',
                  stockStatus: 'ALL',
                  modelFilter: 'ALL',
                  yearFilter: 'ALL',
                  plateSearch: '',
                  chassisSearch: '',
                })
              }
              onEditProduct={handleEditProduct}
              onDeleteProduct={handleDeleteProduct}
              onBatchDeleteProducts={handleBatchDeleteProducts}
              onBatchUpdateCategory={handleBatchUpdateCategory}
              onQuickStockChange={handleQuickStockChange}
              onOpenNewProduct={handleOpenNewProduct}
              onExportCatalogCsv={handleExportCatalogCsv}
            />
          )}

          {activeTab === 'form' && (
            <ProductFormView
              editingProduct={editingProduct}
              onSaveProduct={handleSaveProduct}
              onCancel={() => {
                setEditingProduct(null);
                setActiveTab('catalog');
              }}
            />
          )}

          {activeTab === 'events' && (
            <EventLogView
              events={events}
              onResetEvents={handleResetEvents}
              onPruneEvents={handlePruneEvents}
            />
          )}
        </main>
      </div>

      {/* Modal de Precificação Comercial, Vínculo de Estoque e Geração de Resposta WhatsApp */}
      <QuotePricingModal
        order={activeQuoteOrder}
        catalogProducts={products}
        onClose={() => setActiveQuoteOrder(null)}
        onSaveQuoteAndReply={handleSaveQuoteAndReply}
      />

      {/* Modal de Configurações do Usuário & Backup Diário (JSON Local) */}
      <UserSettingsModal
        isOpen={isSettingsModalOpen}
        soundSettings={soundSettings}
        onUpdateSoundSettings={handleUpdateSoundSettings}
        dailyBackupMeta={dailyBackupMeta}
        onDownloadBackupJson={handleDownloadBackupJson}
        onRestoreFromBackupPayload={handleRestoreFromBackupPayload}
        onRestoreDailySnapshot={handleRestoreDailySnapshot}
        onClose={() => setIsSettingsModalOpen(false)}
      />
    </div>
  );
}
