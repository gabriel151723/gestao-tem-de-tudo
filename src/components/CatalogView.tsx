import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Edit3,
  Trash2,
  PackageSearch,
  RotateCcw,
  CheckCircle2,
  Clock,
  Minus,
  Download,
  AlertTriangle,
  X,
  Layers,
  CheckSquare,
} from 'lucide-react';
import {
  Product,
  ProductFilterOptions,
  VEHICLE_CATEGORIES,
  AUTOMOTIVE_SYSTEMS,
  STOCK_STATUSES,
  getStockStatusFromQuantity,
} from '../erp/erpLogic';

interface CatalogViewProps {
  products: Product[];
  filteredProducts: Product[];
  filters: ProductFilterOptions;
  onFilterChange: (next: Partial<ProductFilterOptions>) => void;
  onResetFilters: () => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onBatchDeleteProducts?: (productIds: string[]) => void;
  onBatchUpdateCategory?: (productIds: string[], newCategory: string) => void;
  onQuickStockChange: (product: Product, nextStock: number) => void;
  onOpenNewProduct: () => void;
  onExportCatalogCsv: (itemsToExport: Product[]) => void;
}

export const CatalogView: React.FC<CatalogViewProps> = ({
  products,
  filteredProducts,
  filters,
  onFilterChange,
  onResetFilters,
  onEditProduct,
  onDeleteProduct,
  onBatchDeleteProducts,
  onBatchUpdateCategory,
  onQuickStockChange,
  onOpenNewProduct,
  onExportCatalogCsv,
}) => {
  const [csvFeedbackCount, setCsvFeedbackCount] = useState<number | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [deletedFeedback, setDeletedFeedback] = useState<{
    sku: string;
    name: string;
  } | null>(null);

  // Estado de Seleção em Lote (Checkboxes)
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [batchTargetCategory, setBatchTargetCategory] = useState<string>(
    VEHICLE_CATEGORIES[0]
  );
  const [isBatchDeleteModalOpen, setIsBatchDeleteModalOpen] =
    useState<boolean>(false);
  const [batchFeedbackMessage, setBatchFeedbackMessage] = useState<
    string | null
  >(null);

  // Sincroniza seleção caso produtos sejam removidos do catálogo
  useEffect(() => {
    const validIdSet = new Set(products.map((p) => p.id));
    setSelectedProductIds((prev) => {
      const next = prev.filter((id) => validIdSet.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [products]);

  const selectedProducts = products.filter((p) =>
    selectedProductIds.includes(p.id)
  );

  const allVisibleSelected =
    filteredProducts.length > 0 &&
    filteredProducts.every((p) => selectedProductIds.includes(p.id));

  const someVisibleSelected =
    filteredProducts.some((p) => selectedProductIds.includes(p.id)) &&
    !allVisibleSelected;

  const handleToggleSelectAllVisible = () => {
    const visibleIds = filteredProducts.map((p) => p.id);
    if (allVisibleSelected) {
      const visibleSet = new Set(visibleIds);
      setSelectedProductIds((prev) => prev.filter((id) => !visibleSet.has(id)));
    } else {
      setSelectedProductIds((prev) =>
        Array.from(new Set([...prev, ...visibleIds]))
      );
    }
  };

  const handleToggleSelectProduct = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const handleExportClick = () => {
    onExportCatalogCsv(filteredProducts);
    setCsvFeedbackCount(filteredProducts.length);
    setTimeout(() => setCsvFeedbackCount(null), 4000);
  };

  const handleConfirmDeleteProduct = () => {
    if (!productToDelete) return;
    const target = productToDelete;
    setProductToDelete(null);
    onDeleteProduct(target.id);
    setSelectedProductIds((prev) => prev.filter((id) => id !== target.id));
    setDeletedFeedback({ sku: target.sku, name: target.name });
    setTimeout(() => setDeletedFeedback(null), 5000);
  };

  const handleBatchApplyCategory = () => {
    if (selectedProducts.length === 0 || !batchTargetCategory) return;
    const count = selectedProducts.length;
    onBatchUpdateCategory?.(selectedProductIds, batchTargetCategory);
    setBatchFeedbackMessage(
      `Categoria de ${count} ${count === 1 ? 'peça atualizada' : 'peças atualizadas'} para "${batchTargetCategory}" e sincronizada no Firestore!`
    );
    setSelectedProductIds([]);
    setTimeout(() => setBatchFeedbackMessage(null), 5000);
  };

  const handleBatchExportSelected = () => {
    if (selectedProducts.length === 0) return;
    const count = selectedProducts.length;
    onExportCatalogCsv(selectedProducts);
    setBatchFeedbackMessage(
      `Exportação CSV em lote concluída (${count} ${count === 1 ? 'peça selecionada' : 'peças selecionadas'}).`
    );
    setTimeout(() => setBatchFeedbackMessage(null), 5000);
  };

  const handleConfirmBatchDelete = () => {
    if (selectedProducts.length === 0) return;
    const count = selectedProducts.length;
    const skuSample = selectedProducts
      .slice(0, 3)
      .map((p) => p.sku)
      .join(', ');
    setIsBatchDeleteModalOpen(false);
    if (onBatchDeleteProducts) {
      onBatchDeleteProducts(selectedProductIds);
    } else {
      for (const id of selectedProductIds) {
        onDeleteProduct(id);
      }
    }
    setSelectedProductIds([]);
    setBatchFeedbackMessage(
      `${count} ${count === 1 ? 'registro excluído' : 'registros excluídos'} em lote (${skuSample}${count > 3 ? '...' : ''}) do Catálogo e do Firestore!`
    );
    setTimeout(() => setBatchFeedbackMessage(null), 5000);
  };

  const renderStockStatusIndicator = (stock: number) => {
    const status = getStockStatusFromQuantity(stock);
    if (status === 'Disponível para Cotação') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>Disponível ({stock} un.)</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span>Sob Encomenda (0 un.)</span>
      </span>
    );
  };

  const hasActiveFilters =
    filters.search.trim() !== '' ||
    (filters.plateSearch || '').trim() !== '' ||
    (filters.chassisSearch || '').trim() !== '' ||
    filters.category !== 'ALL' ||
    filters.system !== 'ALL' ||
    filters.stockStatus !== 'ALL' ||
    (filters.modelFilter && filters.modelFilter !== 'ALL') ||
    (filters.yearFilter && filters.yearFilter !== 'ALL');

  const dynamicCategories = Array.from(
    new Set([...VEHICLE_CATEGORIES, ...products.map((p) => p.category)])
  );
  const dynamicSystems = Array.from(
    new Set([...AUTOMOTIVE_SYSTEMS, ...products.map((p) => p.system)])
  );
  const dynamicModels = Array.from(
    new Set(
      products
        .map((p) => (p.vehicleModel || '').trim())
        .filter((m) => m.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b));
  const dynamicYears = Array.from(
    new Set(
      products
        .map((p) => (p.vehicleYear || '').trim())
        .filter((y) => y.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b));
  const dynamicPlates = Array.from(
    new Set(
      products
        .map((p) => (p.licensePlate || '').trim().toUpperCase())
        .filter((pl) => pl.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b));
  const dynamicChassis = Array.from(
    new Set(
      products
        .map((p) => (p.chassis || '').trim().toUpperCase())
        .filter((ch) => ch.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b));

  return (
    <div
      className={`space-y-5 ${selectedProducts.length > 0 ? 'pb-24' : ''}`}
      data-testid="catalog-view"
    >
      {/* Barra de Busca Unificada e Filtros por Placa, Chassi, Modelo, Ano, Categoria e Sistema */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white">
              Catálogo de Peças &amp; Controle de Estoque
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Exibindo{' '}
              <span
                data-testid="catalog-filtered-count"
                className="font-mono text-white font-semibold tabular-nums"
              >
                {filteredProducts.length}
              </span>{' '}
              de{' '}
              <span className="font-mono text-slate-300 tabular-nums">
                {products.length}
              </span>{' '}
              peças cadastradas no estoque
              {selectedProducts.length > 0 && (
                <span className="ml-2 text-orange-400 font-semibold font-mono tabular-nums">
                  &middot; {selectedProducts.length}{' '}
                  {selectedProducts.length === 1
                    ? 'selecionada'
                    : 'selecionadas'}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {hasActiveFilters && (
              <button
                type="button"
                data-testid="reset-catalog-filters-btn"
                onClick={onResetFilters}
                className="px-3 py-2 rounded-lg border border-slate-700 hover:border-slate-600 text-xs font-medium text-slate-300 hover:text-white transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpar Filtros</span>
              </button>
            )}
            <button
              type="button"
              data-testid="export-catalog-csv-btn"
              onClick={handleExportClick}
              disabled={filteredProducts.length === 0}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 text-slate-100 text-xs font-semibold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Exportar Catálogo CSV ({filteredProducts.length})</span>
            </button>
            <button
              type="button"
              onClick={onOpenNewProduct}
              className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold text-xs transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Nova Peça</span>
            </button>
          </div>
        </div>

        {csvFeedbackCount !== null && (
          <div
            role="status"
            data-testid="catalog-csv-feedback"
            className="bg-emerald-950/80 border border-emerald-500/40 rounded-lg px-4 py-2.5 text-xs text-emerald-100 flex items-center justify-between gap-2"
          >
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Arquivo CSV do catálogo gerado com sucesso ({csvFeedbackCount}{' '}
                {csvFeedbackCount === 1 ? 'peça exportada' : 'peças exportadas'}
                ).
              </span>
            </span>
          </div>
        )}

        {batchFeedbackMessage && (
          <div
            role="status"
            data-testid="catalog-batch-feedback"
            className="bg-emerald-950/80 border border-emerald-500/40 rounded-lg px-4 py-2.5 text-xs text-emerald-100 flex items-center justify-between gap-2"
          >
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{batchFeedbackMessage}</span>
            </span>
            <button
              type="button"
              onClick={() => setBatchFeedbackMessage(null)}
              className="text-emerald-300 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Linha 1: Busca Unificada + Busca por Placa + Busca por Número de Chassi */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2">
          <div className="md:col-span-5">
            <label
              htmlFor="catalog-search-input"
              className="block text-xs font-medium text-slate-400 mb-1.5"
            >
              Busca Geral (SKU, Nome, OEM, Modelo ou Aplicação)
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="catalog-search-input"
                data-testid="catalog-search-input"
                type="text"
                value={filters.search}
                onChange={(e) => onFilterChange({ search: e.target.value })}
                placeholder="Ex: MNG-MOT-001, A3660300417, Scania R440..."
                className="w-full bg-[#0B0F17] border border-slate-700 focus:border-orange-500 rounded-lg pl-10 pr-8 py-2 text-sm text-white placeholder-slate-500 outline-none transition-colors"
              />
              {filters.search.trim() !== '' && (
                <button
                  type="button"
                  onClick={() => onFilterChange({ search: '' })}
                  aria-label="Limpar busca geral"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="md:col-span-3">
            <label
              htmlFor="catalog-plate-input"
              className="block text-xs font-medium text-slate-400 mb-1.5"
            >
              Buscar por Placa (Mercosul / Antiga)
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-orange-400/80 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="catalog-plate-input"
                data-testid="catalog-plate-input"
                list="catalog-plates-datalist"
                type="text"
                value={filters.plateSearch || ''}
                onChange={(e) =>
                  onFilterChange({ plateSearch: e.target.value.toUpperCase() })
                }
                placeholder="Ex: RTA4B18, FTR8H22..."
                className="w-full bg-[#0B0F17] border border-slate-700 focus:border-orange-500 rounded-lg pl-10 pr-8 py-2 text-sm font-mono uppercase text-white placeholder-slate-500 outline-none transition-colors tabular-nums"
              />
              <datalist id="catalog-plates-datalist">
                {dynamicPlates.map((pl) => (
                  <option key={pl} value={pl} />
                ))}
              </datalist>
              {(filters.plateSearch || '').trim() !== '' && (
                <button
                  type="button"
                  data-testid="clear-plate-search-btn"
                  onClick={() => onFilterChange({ plateSearch: '' })}
                  aria-label="Limpar filtro de placa"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="md:col-span-4">
            <label
              htmlFor="catalog-chassis-input"
              className="block text-xs font-medium text-slate-400 mb-1.5"
            >
              Buscar por Número de Chassi (VIN / Série)
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-emerald-400/80 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="catalog-chassis-input"
                data-testid="catalog-chassis-input"
                list="catalog-chassis-datalist"
                type="text"
                value={filters.chassisSearch || ''}
                onChange={(e) =>
                  onFilterChange({
                    chassisSearch: e.target.value.toUpperCase(),
                  })
                }
                placeholder="Ex: 9BSR6X400E3849102, JJC0340..."
                className="w-full bg-[#0B0F17] border border-slate-700 focus:border-orange-500 rounded-lg pl-10 pr-8 py-2 text-sm font-mono uppercase text-white placeholder-slate-500 outline-none transition-colors tabular-nums"
              />
              <datalist id="catalog-chassis-datalist">
                {dynamicChassis.map((ch) => (
                  <option key={ch} value={ch} />
                ))}
              </datalist>
              {(filters.chassisSearch || '').trim() !== '' && (
                <button
                  type="button"
                  data-testid="clear-chassis-search-btn"
                  onClick={() => onFilterChange({ chassisSearch: '' })}
                  aria-label="Limpar filtro de chassi"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Linha 2: Modelo + Ano + Categoria de Veículo + Sistema Automotivo + Status de Estoque */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-3">
            <label
              htmlFor="catalog-model-select"
              className="block text-xs font-medium text-slate-400 mb-1.5"
            >
              Filtrar por Modelo
            </label>
            <select
              id="catalog-model-select"
              value={filters.modelFilter || 'ALL'}
              onChange={(e) => onFilterChange({ modelFilter: e.target.value })}
              className="w-full bg-[#0B0F17] border border-slate-700 focus:border-orange-500 rounded-lg px-3 py-2 text-sm text-white outline-none transition-colors"
            >
              <option value="ALL">Todos os Modelos</option>
              {dynamicModels.map((mod) => (
                <option key={mod} value={mod}>
                  {mod}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label
              htmlFor="catalog-year-select"
              className="block text-xs font-medium text-slate-400 mb-1.5"
            >
              Filtrar por Ano / Faixa
            </label>
            <select
              id="catalog-year-select"
              value={filters.yearFilter || 'ALL'}
              onChange={(e) => onFilterChange({ yearFilter: e.target.value })}
              className="w-full bg-[#0B0F17] border border-slate-700 focus:border-orange-500 rounded-lg px-3 py-2 text-sm text-white outline-none transition-colors font-mono tabular-nums"
            >
              <option value="ALL">Todos os Anos</option>
              {dynamicYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-3">
            <label
              htmlFor="catalog-category-select"
              className="block text-xs font-medium text-slate-400 mb-1.5"
            >
              Categoria de Veículo
            </label>
            <select
              id="catalog-category-select"
              value={filters.category}
              onChange={(e) => onFilterChange({ category: e.target.value })}
              className="w-full bg-[#0B0F17] border border-slate-700 focus:border-orange-500 rounded-lg px-3 py-2 text-sm text-white outline-none transition-colors"
            >
              <option value="ALL">Todas as Categorias</option>
              {dynamicCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label
              htmlFor="catalog-system-select"
              className="block text-xs font-medium text-slate-400 mb-1.5"
            >
              Sistema Automotivo
            </label>
            <select
              id="catalog-system-select"
              value={filters.system}
              onChange={(e) => onFilterChange({ system: e.target.value })}
              className="w-full bg-[#0B0F17] border border-slate-700 focus:border-orange-500 rounded-lg px-3 py-2 text-sm text-white outline-none transition-colors"
            >
              <option value="ALL">Todos os Sistemas</option>
              {dynamicSystems.map((sys) => (
                <option key={sys} value={sys}>
                  {sys}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label
              htmlFor="catalog-stock-select"
              className="block text-xs font-medium text-slate-400 mb-1.5"
            >
              Status de Estoque
            </label>
            <select
              id="catalog-stock-select"
              value={filters.stockStatus}
              onChange={(e) => onFilterChange({ stockStatus: e.target.value })}
              className="w-full bg-[#0B0F17] border border-slate-700 focus:border-orange-500 rounded-lg px-3 py-2 text-sm text-white outline-none transition-colors"
            >
              <option value="ALL">Todos os Status</option>
              {STOCK_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Resumo de Filtros Ativos por Placa / Chassi */}
        {((filters.plateSearch || '').trim() !== '' ||
          (filters.chassisSearch || '').trim() !== '') && (
          <div
            data-testid="active-vehicle-id-filters"
            className="pt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300 border-t border-slate-800/80"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-400">
                Filtro de Identificação Veicular ativo:
              </span>
              {(filters.plateSearch || '').trim() !== '' && (
                <span className="font-mono text-orange-400 font-semibold tabular-nums">
                  Placa contém &ldquo;{filters.plateSearch}&rdquo;
                </span>
              )}
              {(filters.plateSearch || '').trim() !== '' &&
                (filters.chassisSearch || '').trim() !== '' && (
                  <span aria-hidden="true" className="text-slate-600">
                    &middot;
                  </span>
                )}
              {(filters.chassisSearch || '').trim() !== '' && (
                <span className="font-mono text-emerald-400 font-semibold tabular-nums">
                  Chassi contém &ldquo;{filters.chassisSearch}&rdquo;
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() =>
                onFilterChange({ plateSearch: '', chassisSearch: '' })
              }
              className="text-xs text-slate-400 hover:text-white underline cursor-pointer whitespace-nowrap shrink-0"
            >
              Limpar Placa e Chassi
            </button>
          </div>
        )}
      </div>

      {/* Tabela de Alta Densidade do Catálogo com Checkboxes */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden">
        {filteredProducts.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
              <PackageSearch className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-white">
              Nenhuma peça encontrada para o filtro atual
            </h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Ajuste os filtros de Modelo, Ano, Placa ou Número de Chassi ou
              cadastre uma nova peça no catálogo.
            </p>
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={onResetFilters}
                className="px-4 py-2 rounded-lg border border-slate-700 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Limpar Filtros
              </button>
              <button
                type="button"
                onClick={onOpenNewProduct}
                className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
              >
                Cadastrar Nova Peça
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-[#0D131F] text-xs font-semibold text-slate-400">
                  <th className="py-3.5 pl-4 pr-2 w-10">
                    <input
                      type="checkbox"
                      data-testid="catalog-select-all-checkbox"
                      checked={allVisibleSelected}
                      ref={(input) => {
                        if (input) {
                          input.indeterminate = someVisibleSelected;
                        }
                      }}
                      onChange={handleToggleSelectAllVisible}
                      aria-label="Selecionar todos os produtos visíveis"
                      className="w-4 h-4 rounded border-slate-600 bg-[#0B0F17] text-orange-500 focus:ring-orange-500 cursor-pointer accent-orange-500"
                    />
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    Código SKU &amp; Ref.
                  </th>
                  <th className="py-3.5 px-4">Peça &amp; Sistema Automotivo</th>
                  <th className="py-3.5 px-4">
                    Modelo, Ano, Placa &amp; Chassi
                  </th>
                  <th className="py-3.5 px-4">Aplicação Detalhada</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    Saldo em Estoque
                  </th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-sm">
                {filteredProducts.map((product) => {
                  const isSelected = selectedProductIds.includes(product.id);
                  return (
                    <tr
                      key={product.id}
                      className={`transition-colors group ${
                        isSelected
                          ? 'bg-orange-500/10 hover:bg-orange-500/15'
                          : 'hover:bg-slate-800/35'
                      }`}
                      data-testid={`catalog-row-${product.sku}`}
                    >
                      <td className="py-3.5 pl-4 pr-2 align-top">
                        <input
                          type="checkbox"
                          data-testid={`catalog-row-checkbox-${product.sku}`}
                          checked={isSelected}
                          onChange={() => handleToggleSelectProduct(product.id)}
                          aria-label={`Selecionar peça ${product.sku}`}
                          className="w-4 h-4 mt-0.5 rounded border-slate-600 bg-[#0B0F17] text-orange-500 focus:ring-orange-500 cursor-pointer accent-orange-500"
                        />
                      </td>

                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        <span className="font-mono text-xs font-bold text-orange-400 tabular-nums">
                          {product.sku}
                        </span>
                        <div className="text-[11px] font-mono text-slate-400 mt-1 tabular-nums">
                          Ref.: {product.oem}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 align-top max-w-xs">
                        <div className="font-semibold text-white leading-snug">
                          {product.name}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          {product.system} &middot;{' '}
                          <span
                            data-testid={`product-category-${product.sku}`}
                            className="text-slate-300"
                          >
                            {product.category}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 align-top max-w-[260px]">
                        <div className="text-xs font-semibold text-white leading-snug">
                          {product.vehicleModel}
                        </div>
                        <div className="text-xs font-mono text-emerald-400 mt-0.5 tabular-nums">
                          Ano: {product.vehicleYear}
                        </div>
                        {(product.licensePlate || product.chassis) && (
                          <div className="text-[11px] font-mono text-slate-400 mt-1.5 space-y-1 tabular-nums">
                            {product.licensePlate && (
                              <div>
                                <button
                                  type="button"
                                  data-testid={`filter-by-plate-${product.sku}`}
                                  onClick={() =>
                                    onFilterChange({
                                      plateSearch: product.licensePlate,
                                    })
                                  }
                                  title="Clique para filtrar por esta placa"
                                  className="text-left hover:text-orange-400 transition-colors cursor-pointer"
                                >
                                  Placa:{' '}
                                  <span className="text-slate-200 font-semibold">
                                    {product.licensePlate}
                                  </span>
                                </button>
                              </div>
                            )}
                            {product.chassis && (
                              <div className="truncate" title={product.chassis}>
                                <button
                                  type="button"
                                  data-testid={`filter-by-chassis-${product.sku}`}
                                  onClick={() =>
                                    onFilterChange({
                                      chassisSearch: product.chassis,
                                    })
                                  }
                                  title={`Clique para filtrar pelo chassi ${product.chassis}`}
                                  className="text-left hover:text-emerald-400 transition-colors cursor-pointer truncate max-w-full"
                                >
                                  Chassi:{' '}
                                  <span className="text-slate-200 font-semibold">
                                    {product.chassis}
                                  </span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 align-top max-w-sm">
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {product.application}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        <div className="space-y-2">
                          {renderStockStatusIndicator(product.stock)}
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                onQuickStockChange(
                                  product,
                                  Math.max(0, (product.stock || 0) - 1)
                                )
                              }
                              aria-label={`Reduzir estoque de ${product.sku}`}
                              className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="font-mono text-xs font-bold text-white min-w-[44px] text-center tabular-nums">
                              {product.stock} un
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                onQuickStockChange(
                                  product,
                                  (product.stock || 0) + 1
                                )
                              }
                              aria-label={`Aumentar estoque de ${product.sku}`}
                              className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onEditProduct(product)}
                            aria-label={`Editar peça ${product.sku}`}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-medium transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Editar</span>
                          </button>
                          <button
                            type="button"
                            data-testid={`delete-product-btn-${product.sku}`}
                            onClick={() => setProductToDelete(product)}
                            aria-label={`Excluir peça ${product.sku}`}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/30 text-rose-300 hover:text-white text-xs font-medium transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Apagar Registro</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Barra Flutuante de Ações em Lote (Exibida quando há produtos selecionados) */}
      {selectedProducts.length > 0 && (
        <div
          role="region"
          aria-label="Barra flutuante de ações em lote"
          data-testid="catalog-batch-action-bar"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-5xl bg-[#0D131F]/95 backdrop-blur-md border border-orange-500/60 rounded-2xl px-4 py-3 shadow-2xl flex flex-wrap items-center justify-between gap-3"
        >
          {/* Contador de Seleção + Desmarcar */}
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-white">
              <CheckSquare className="w-4 h-4 text-orange-400 shrink-0" />
              <span>
                <strong
                  data-testid="batch-selected-count"
                  className="font-mono text-orange-400 tabular-nums"
                >
                  {selectedProducts.length}
                </strong>{' '}
                {selectedProducts.length === 1
                  ? 'produto selecionado'
                  : 'produtos selecionados'}
              </span>
            </div>
            <button
              type="button"
              data-testid="batch-clear-selection-btn"
              onClick={() => setSelectedProductIds([])}
              className="text-xs text-slate-400 hover:text-white underline cursor-pointer whitespace-nowrap"
            >
              Limpar seleção
            </button>
          </div>

          {/* Controles de Ações em Lote: Alterar Categoria, Exportar CSV e Excluir */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Alterar Categoria em Lote */}
            <div className="flex items-center gap-1.5 bg-[#111827] border border-slate-700 rounded-lg p-1">
              <Layers className="w-3.5 h-3.5 text-orange-400 ml-2 shrink-0" />
              <select
                data-testid="batch-category-select"
                aria-label="Nova categoria para os produtos selecionados"
                value={batchTargetCategory}
                onChange={(e) => setBatchTargetCategory(e.target.value)}
                className="bg-transparent text-xs text-white px-2 py-1 outline-none max-w-[210px] truncate cursor-pointer"
              >
                {dynamicCategories.map((cat) => (
                  <option key={cat} value={cat} className="bg-[#0B0F17]">
                    {cat}
                  </option>
                ))}
              </select>
              <button
                type="button"
                data-testid="batch-apply-category-btn"
                onClick={handleBatchApplyCategory}
                className="px-3 py-1.5 rounded-md bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Aplicar Categoria
              </button>
            </div>

            {/* Exportar Selecionados CSV */}
            <button
              type="button"
              data-testid="batch-export-csv-btn"
              onClick={handleBatchExportSelected}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-semibold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="tabular-nums">
                Exportar CSV ({selectedProducts.length})
              </span>
            </button>

            {/* Excluir Selecionados em Lote */}
            <button
              type="button"
              data-testid="batch-delete-btn"
              onClick={() => setIsBatchDeleteModalOpen(true)}
              className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
              <span className="tabular-nums">
                Excluir Selecionados ({selectedProducts.length})
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Feedback de Exclusão Individual de Produto */}
      {deletedFeedback && (
        <div
          role="status"
          data-testid="catalog-delete-feedback"
          className="bg-emerald-950/80 border border-emerald-500/40 rounded-xl px-4 py-3 text-xs text-emerald-100 flex items-center justify-between gap-2"
        >
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Registro{' '}
              <strong className="font-mono text-white">
                {deletedFeedback.sku}
              </strong>{' '}
              ({deletedFeedback.name}) apagado com sucesso do Catálogo e do
              Firestore!
            </span>
          </span>
          <button
            type="button"
            onClick={() => setDeletedFeedback(null)}
            className="text-emerald-300 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão Individual de Produto */}
      {productToDelete && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-product-modal-title"
          data-testid="delete-product-modal"
        >
          <div className="bg-[#111827] border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4
                    id="delete-product-modal-title"
                    className="text-base font-bold text-white"
                  >
                    Confirmar Exclusão de Registro
                  </h4>
                  <p className="text-xs text-slate-400">
                    Remoção permanente do catálogo e do Firestore
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                aria-label="Fechar confirmação de exclusão"
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#0B0F17] border border-slate-800 rounded-lg p-3.5 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Código SKU:</span>
                <span className="font-mono font-bold text-orange-400 tabular-nums">
                  {productToDelete.sku}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-slate-400 shrink-0">Peça:</span>
                <span className="font-semibold text-white text-right">
                  {productToDelete.name}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Veículo / Ano:</span>
                <span className="text-slate-200 font-medium">
                  {productToDelete.vehicleModel} ({productToDelete.vehicleYear})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Saldo em Estoque:</span>
                <span className="font-mono text-emerald-400 tabular-nums">
                  {productToDelete.stock} un.
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Tem certeza que deseja apagar este produto? O registro será
              removido imediatamente do controle de estoque local e da coleção{' '}
              <code className="font-mono text-orange-400">products</code> no
              Firestore.
            </p>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                data-testid="cancel-delete-product-btn"
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-600 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                data-testid="confirm-delete-product-btn"
                onClick={handleConfirmDeleteProduct}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sim, Apagar Produto</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão em Lote */}
      {isBatchDeleteModalOpen && selectedProducts.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="batch-delete-modal-title"
          data-testid="batch-delete-modal"
        >
          <div className="bg-[#111827] border border-slate-700 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4
                    id="batch-delete-modal-title"
                    className="text-base font-bold text-white"
                  >
                    Confirmar Exclusão em Lote ({selectedProducts.length})
                  </h4>
                  <p className="text-xs text-slate-400">
                    Remoção permanente das peças selecionadas no estoque e no
                    Firestore
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchDeleteModalOpen(false)}
                aria-label="Fechar confirmação de exclusão em lote"
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#0B0F17] border border-slate-800 rounded-lg p-3.5 max-h-48 overflow-y-auto space-y-2 text-xs">
              {selectedProducts.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 border-b border-slate-800/70 last:border-b-0 pb-1.5 last:pb-0"
                >
                  <span className="font-mono font-bold text-orange-400 shrink-0 tabular-nums">
                    {item.sku}
                  </span>
                  <span className="text-slate-200 truncate flex-1">
                    {item.name}
                  </span>
                  <span className="font-mono text-slate-400 shrink-0 tabular-nums">
                    {item.stock} un.
                  </span>
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Tem certeza que deseja excluir permanentemente{' '}
              <strong className="text-white tabular-nums">
                {selectedProducts.length}{' '}
                {selectedProducts.length === 1
                  ? 'produto selecionado'
                  : 'produtos selecionados'}
              </strong>
              ? Todos os documentos serão removidos da coleção{' '}
              <code className="font-mono text-orange-400">products</code> no
              Firestore.
            </p>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                data-testid="cancel-batch-delete-btn"
                onClick={() => setIsBatchDeleteModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-600 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                data-testid="confirm-batch-delete-btn"
                onClick={handleConfirmBatchDelete}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="tabular-nums">
                  Sim, Excluir {selectedProducts.length}{' '}
                  {selectedProducts.length === 1 ? 'Peça' : 'Peças'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
