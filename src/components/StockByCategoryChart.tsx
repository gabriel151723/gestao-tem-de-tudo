import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { CategoryStockItem } from '../erp/erpLogic';

interface StockByCategoryChartProps {
  data: CategoryStockItem[];
  totalUnitsInStock: number;
  onSelectCategory?: (category: string) => void;
}

export const StockByCategoryChart: React.FC<StockByCategoryChartProps> = ({
  data,
  totalUnitsInStock,
  onSelectCategory,
}) => {
  return (
    <div
      className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4 h-full flex flex-col justify-between"
      data-testid="stock-by-category-chart"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-orange-400 shrink-0" />
            <h3 className="text-base font-bold text-white">
              Comparativo de Nível de Estoque por Categoria de Produto
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Comparativo entre o saldo físico de unidades em estoque e a quantidade de peças cadastradas por segmento
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
          <span className="inline-flex items-center gap-1.5 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-xs bg-orange-500 inline-block" />
            <span>Unidades em Estoque ({totalUnitsInStock} un.)</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
            <span>SKUs Cadastrados</span>
          </span>
        </div>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 10, right: 16, left: 0, bottom: 8 }}
            barGap={6}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#1E293B"
              vertical={false}
            />
            <XAxis
              dataKey="shortLabel"
              tick={{ fill: '#94A3B8', fontSize: 12 }}
              axisLine={{ stroke: '#1E293B' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#94A3B8', fontSize: 12, fontFamily: 'JetBrains Mono' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: 'rgba(30, 41, 59, 0.45)' }}
              contentStyle={{
                backgroundColor: '#0B0F17',
                borderColor: '#334155',
                borderRadius: '0.5rem',
                color: '#F8FAFC',
                fontSize: '12px',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
              }}
              formatter={(value, name) => {
                const safeVal = Number(value ?? 0);
                if (name === 'totalStock') {
                  return [`${safeVal} unidades`, 'Saldo em Estoque'];
                }
                return [`${safeVal} peças`, 'SKUs Cadastrados'];
              }}
              labelFormatter={(_label, payload) => {
                const item = payload?.[0]?.payload as CategoryStockItem | undefined;
                return item?.category || String(_label);
              }}
            />
            <Bar
              dataKey="totalStock"
              name="totalStock"
              radius={[6, 6, 0, 0]}
              maxBarSize={44}
              onClick={(entry) => {
                const payload = (entry as unknown as { payload?: CategoryStockItem; category?: string });
                const cat = payload?.category || payload?.payload?.category;
                if (onSelectCategory && cat) {
                  onSelectCategory(cat);
                }
              }}
              className="cursor-pointer"
            >
              {data.map((entry) => (
                <Cell
                  key={`cell-stock-${entry.category}`}
                  fill={entry.totalStock > 0 ? '#F97316' : '#475569'}
                />
              ))}
            </Bar>
            <Bar
              dataKey="count"
              name="count"
              fill="#10B981"
              radius={[6, 6, 0, 0]}
              maxBarSize={32}
              onClick={(entry) => {
                const payload = (entry as unknown as { payload?: CategoryStockItem; category?: string });
                const cat = payload?.category || payload?.payload?.category;
                if (onSelectCategory && cat) {
                  onSelectCategory(cat);
                }
              }}
              className="cursor-pointer"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
