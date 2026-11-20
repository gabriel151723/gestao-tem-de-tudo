import React, { useState, useEffect } from 'react';
import { Save, ArrowLeft, CheckCircle2, Truck } from 'lucide-react';
import {
  Product,
  VEHICLE_CATEGORIES,
  AUTOMOTIVE_SYSTEMS,
  validateProductInput,
  sanitizeDocumentId,
  formatLicensePlate,
  formatChassis,
} from '../erp/erpLogic';

interface ProductFormViewProps {
  editingProduct: Product | null;
  onSaveProduct: (productData: {
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
  }) => void;
  onCancel: () => void;
}

export const ProductFormView: React.FC<ProductFormViewProps> = ({
  editingProduct,
  onSaveProduct,
  onCancel,
}) => {
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [oem, setOem] = useState('');
  const [category, setCategory] = useState<string>(VEHICLE_CATEGORIES[0]);
  const [system, setSystem] = useState<string>(AUTOMOTIVE_SYSTEMS[0]);
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [chassis, setChassis] = useState('');
  const [application, setApplication] = useState('');
  const [stock, setStock] = useState<string>('10');
  const [demo, setDemo] = useState<boolean>(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (editingProduct) {
      setSku(editingProduct.sku);
      setName(editingProduct.name);
      setOem(editingProduct.oem || 'S/REF');
      setCategory(editingProduct.category);
      setSystem(editingProduct.system);
      setVehicleModel(editingProduct.vehicleModel || '');
      setVehicleYear(editingProduct.vehicleYear || '');
      setLicensePlate(editingProduct.licensePlate || '');
      setChassis(editingProduct.chassis || '');
      setApplication(editingProduct.application);
      setStock(String(editingProduct.stock ?? 0));
      setDemo(false);
      setErrors({});
    } else {
      setSku('');
      setName('');
      setOem('');
      setCategory(VEHICLE_CATEGORIES[0]);
      setSystem(AUTOMOTIVE_SYSTEMS[0]);
      setVehicleModel('');
      setVehicleYear('');
      setLicensePlate('');
      setChassis('');
      setApplication('');
      setStock('10');
      setDemo(false);
      setErrors({});
    }
  }, [editingProduct]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateProductInput({
      sku,
      name,
      oem,
      category,
      system,
      vehicleModel,
      vehicleYear,
      licensePlate,
      chassis,
      application,
      stock,
    });

    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    const cleanId = editingProduct
      ? editingProduct.id
      : sanitizeDocumentId(sku);

    onSaveProduct({
      id: cleanId,
      sku: cleanId,
      name: name.trim(),
      oem: oem.trim(),
      category,
      system,
      vehicleModel: vehicleModel.trim(),
      vehicleYear: vehicleYear.trim(),
      licensePlate: formatLicensePlate(licensePlate),
      chassis: formatChassis(chassis),
      application: application.trim(),
      stock: Math.max(0, Math.floor(Number(stock) || 0)),
      demo,
    });
  };

  return (
    <div className="max-w-3xl mx-auto" data-testid="product-form-view">
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-lg font-bold text-white">
              {editingProduct
                ? `Editar Peça: ${editingProduct.sku}`
                : 'Novo Cadastro de Produto'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Preencha os dados da peça e a identificação veicular (Modelo, Ano, Placa e Chassi) para atualizar o catálogo.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600 text-xs font-medium text-slate-300 hover:text-white transition-colors inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar ao Catálogo</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* Bloco 1: Identificação Comercial e Saldo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="form-sku-input"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Código SKU da Peça *
              </label>
              <input
                id="form-sku-input"
                type="text"
                maxLength={64}
                disabled={Boolean(editingProduct)}
                value={sku}
                onChange={(e) => {
                  setSku(e.target.value.toUpperCase());
                  if (errors.sku) setErrors((prev) => ({ ...prev, sku: '' }));
                }}
                placeholder="Ex: MNG-MAN-015"
                className="w-full bg-[#0B0F17] border border-slate-700 focus:border-orange-500 disabled:opacity-60 rounded-lg px-3.5 py-2.5 text-sm font-mono text-white placeholder-slate-500 outline-none"
              />
              {errors.sku && (
                <p className="text-xs text-rose-400 mt-1">{errors.sku}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="form-oem-input"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Código de Referência / Fabricante *
              </label>
              <input
                id="form-oem-input"
                type="text"
                maxLength={100}
                value={oem}
                onChange={(e) => {
                  setOem(e.target.value);
                  if (errors.oem) setErrors((prev) => ({ ...prev, oem: '' }));
                }}
                placeholder="Ex: DIN-EN853-2SN ou A3660300417"
                className="w-full bg-[#0B0F17] border border-slate-700 focus:border-orange-500 rounded-lg px-3.5 py-2.5 text-sm font-mono text-white placeholder-slate-500 outline-none"
              />
              {errors.oem && (
                <p className="text-xs text-rose-400 mt-1">{errors.oem}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="form-stock-input"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Quantidade em Estoque (Unidades) *
              </label>
              <input
                id="form-stock-input"
                type="number"
                step="1"
                min="0"
                max="1000000"
                value={stock}
                onChange={(e) => {
                  setStock(e.target.value);
                  if (errors.stock)
                    setErrors((prev) => ({ ...prev, stock: '' }));
                }}
                placeholder="Ex: 15"
                className="w-full bg-[#0B0F17] border border-slate-700 focus:border-orange-500 rounded-lg px-3.5 py-2.5 text-sm font-mono text-white placeholder-slate-500 outline-none tabular-nums"
              />
              {errors.stock && (
                <p className="text-xs text-rose-400 mt-1">{errors.stock}</p>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="form-name-input"
              className="block text-xs font-medium text-slate-300 mb-1.5"
            >
              Nome Comercial / Técnico da Peça *
            </label>
            <input
              id="form-name-input"
              type="text"
              maxLength={200}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
              }}
              placeholder="Ex: Mangueira Hidráulica Alta Pressão SAE 100R2AT / 2SN"
              className="w-full bg-[#0B0F17] border border-slate-700 focus:border-orange-500 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none"
            />
            {errors.name && (
              <p className="text-xs text-rose-400 mt-1">{errors.name}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="form-category-select"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Categoria de Veículo *
              </label>
              <select
                id="form-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[#0B0F17] border border-slate-700 focus:border-orange-500 rounded-lg px-3.5 py-2.5 text-sm text-white outline-none"
              >
                {VEHICLE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              {errors.category && (
                <p className="text-xs text-rose-400 mt-1">{errors.category}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="form-system-select"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Sistema Automotivo *
              </label>
              <select
                id="form-system-select"
                value={system}
                onChange={(e) => setSystem(e.target.value)}
                className="w-full bg-[#0B0F17] border border-slate-700 focus:border-orange-500 rounded-lg px-3.5 py-2.5 text-sm text-white outline-none"
              >
                {AUTOMOTIVE_SYSTEMS.map((sys) => (
                  <option key={sys} value={sys}>
                    {sys}
                  </option>
                ))}
              </select>
              {errors.system && (
                <p className="text-xs text-rose-400 mt-1">{errors.system}</p>
              )}
            </div>
          </div>

          {/* Bloco 2: Identificação Veicular (Modelo e Ano obrigatórios, Placa e Chassi opcionais) */}
          <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-orange-400 shrink-0" />
                <h4 className="text-xs font-bold text-white">
                  Identificação do Veículo / Máquina Vinculada
                </h4>
              </div>
              <span className="text-[11px] text-slate-400">
                Modelo e Ano obrigatórios &middot; Placa e Chassi opcionais
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="form-vehicle-model-input"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Modelo do Veículo / Máquina *
                </label>
                <input
                  id="form-vehicle-model-input"
                  type="text"
                  value={vehicleModel}
                  onChange={(e) => {
                    setVehicleModel(e.target.value);
                    if (errors.vehicleModel)
                      setErrors((prev) => ({ ...prev, vehicleModel: '' }));
                  }}
                  placeholder="Ex: Scania R440, Mercedes-Benz 1620, Hilux 2.8"
                  className="w-full bg-[#111827] border border-slate-700 focus:border-orange-500 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none"
                />
                {errors.vehicleModel && (
                  <p className="text-xs text-rose-400 mt-1">
                    {errors.vehicleModel}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="form-vehicle-year-input"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Ano / Faixa de Anos Compatível *
                </label>
                <input
                  id="form-vehicle-year-input"
                  type="text"
                  value={vehicleYear}
                  onChange={(e) => {
                    setVehicleYear(e.target.value);
                    if (errors.vehicleYear)
                      setErrors((prev) => ({ ...prev, vehicleYear: '' }));
                  }}
                  placeholder="Ex: 2018 a 2024 ou 2021"
                  className="w-full bg-[#111827] border border-slate-700 focus:border-orange-500 rounded-lg px-3.5 py-2.5 text-sm font-mono text-white placeholder-slate-500 outline-none tabular-nums"
                />
                {errors.vehicleYear && (
                  <p className="text-xs text-rose-400 mt-1">
                    {errors.vehicleYear}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="form-license-plate-input"
                    className="block text-xs font-medium text-slate-300"
                  >
                    Placa do Veículo (Opcional)
                  </label>
                  <span className="text-[11px] font-mono text-slate-400">
                    Mercosul ou Antiga
                  </span>
                </div>
                <input
                  id="form-license-plate-input"
                  type="text"
                  value={licensePlate}
                  onChange={(e) => {
                    setLicensePlate(formatLicensePlate(e.target.value));
                    if (errors.licensePlate)
                      setErrors((prev) => ({ ...prev, licensePlate: '' }));
                  }}
                  placeholder="Ex: ABC1D23 ou ABC-1234"
                  maxLength={8}
                  className="w-full bg-[#111827] border border-slate-700 focus:border-orange-500 rounded-lg px-3.5 py-2.5 text-sm font-mono text-white placeholder-slate-500 outline-none tabular-nums"
                />
                {errors.licensePlate && (
                  <p className="text-xs text-rose-400 mt-1">
                    {errors.licensePlate}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="form-chassis-input"
                    className="block text-xs font-medium text-slate-300"
                  >
                    Chassi / VIN (Opcional)
                  </label>
                  <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                    {chassis.length}/17 caracteres
                  </span>
                </div>
                <input
                  id="form-chassis-input"
                  type="text"
                  value={chassis}
                  onChange={(e) => {
                    setChassis(formatChassis(e.target.value));
                    if (errors.chassis)
                      setErrors((prev) => ({ ...prev, chassis: '' }));
                  }}
                  placeholder="Ex: 9BSR6X400E3849102"
                  maxLength={17}
                  className="w-full bg-[#111827] border border-slate-700 focus:border-orange-500 rounded-lg px-3.5 py-2.5 text-sm font-mono text-white placeholder-slate-500 outline-none tabular-nums"
                />
                {errors.chassis && (
                  <p className="text-xs text-rose-400 mt-1">{errors.chassis}</p>
                )}
              </div>
            </div>
          </div>

          <div>
            <label
              htmlFor="form-application-textarea"
              className="block text-xs font-medium text-slate-300 mb-1.5"
            >
              Aplicação Detalhada (Motores, Medidas e Especificações Técnicas) *
            </label>
            <textarea
              id="form-application-textarea"
              rows={3}
              maxLength={600}
              value={application}
              onChange={(e) => {
                setApplication(e.target.value);
                if (errors.application)
                  setErrors((prev) => ({ ...prev, application: '' }));
              }}
              placeholder="Ex: Compatível com motores diesel OM 366, Scania Série R, tratores Case IH..."
              className="w-full bg-[#0B0F17] border border-slate-700 focus:border-orange-500 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none"
            />
            {errors.application && (
              <p className="text-xs text-rose-400 mt-1">{errors.application}</p>
            )}
          </div>

          <div className="bg-[#0B0F17] border border-slate-800 rounded-lg p-3.5 flex items-center gap-3 text-xs text-slate-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Os dados de Modelo, Ano, Placa e Chassi ficam vinculados ao produto no banco de dados e disponíveis para filtragem imediata no Catálogo.
            </span>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-bold transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Save className="w-4 h-4" />
              <span>
                {editingProduct
                  ? 'Salvar Alterações da Peça'
                  : 'Cadastrar Peça no Estoque'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
