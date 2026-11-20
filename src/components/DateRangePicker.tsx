import React from 'react';
import { Calendar, RotateCcw } from 'lucide-react';
import { formatDateKeyBR } from '../erp/erpLogic';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (next: { startDate: string; endDate: string }) => void;
  totalMatchingCount?: number;
  testIdPrefix?: string;
}

function getLocalYYYYMMDD(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onChange,
  totalMatchingCount,
  testIdPrefix = 'date-range',
}) => {
  const hasActiveRange = Boolean(startDate || endDate);

  const handlePresetToday = () => {
    const today = getLocalYYYYMMDD(new Date());
    onChange({ startDate: today, endDate: today });
  };

  const handlePresetLast7Days = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 6);
    onChange({
      startDate: getLocalYYYYMMDD(start),
      endDate: getLocalYYYYMMDD(end),
    });
  };

  const handlePresetCurrentMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    onChange({
      startDate: getLocalYYYYMMDD(firstDay),
      endDate: getLocalYYYYMMDD(lastDay),
    });
  };

  const handleClear = () => {
    onChange({ startDate: '', endDate: '' });
  };

  return (
    <div
      className="bg-[#0B0F17] border border-slate-800 rounded-lg p-3.5 flex flex-col xl:flex-row xl:items-center justify-between gap-3"
      data-testid={`${testIdPrefix}-container`}
    >
      {/* Inputs de Data Inicial e Final */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 shrink-0">
          <Calendar className="w-3.5 h-3.5 text-orange-400 shrink-0" />
          <span>Filtrar por Período:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 text-xs text-slate-400">
            <span className="font-medium">De</span>
            <input
              type="date"
              aria-label="Data inicial do período"
              data-testid={`${testIdPrefix}-start-date`}
              value={startDate}
              onChange={(e) =>
                onChange({ startDate: e.target.value, endDate })
              }
              className="px-2.5 py-1.5 rounded-md bg-[#111827] border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-orange-500 [color-scheme:dark]"
            />
          </label>

          <label className="inline-flex items-center gap-2 text-xs text-slate-400">
            <span className="font-medium">Até</span>
            <input
              type="date"
              aria-label="Data final do período"
              data-testid={`${testIdPrefix}-end-date`}
              value={endDate}
              onChange={(e) =>
                onChange({ startDate, endDate: e.target.value })
              }
              className="px-2.5 py-1.5 rounded-md bg-[#111827] border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-orange-500 [color-scheme:dark]"
            />
          </label>
        </div>
      </div>

      {/* Atalhos Rápidos de Período + Botão Limpar */}
      <div className="flex flex-wrap items-center justify-between xl:justify-end gap-2">
        <div
          className="inline-flex flex-wrap items-center gap-1 bg-[#111827] border border-slate-800 rounded-md p-0.5"
          role="group"
          aria-label="Atalhos rápidos de período"
        >
          <button
            type="button"
            data-testid={`${testIdPrefix}-preset-all`}
            onClick={handleClear}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
              !hasActiveRange
                ? 'bg-orange-500 text-slate-950 font-bold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Todo o Período
          </button>
          <button
            type="button"
            data-testid={`${testIdPrefix}-preset-today`}
            onClick={handlePresetToday}
            className="px-2.5 py-1 rounded text-[11px] font-medium text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors cursor-pointer"
          >
            Hoje
          </button>
          <button
            type="button"
            data-testid={`${testIdPrefix}-preset-7d`}
            onClick={handlePresetLast7Days}
            className="px-2.5 py-1 rounded text-[11px] font-medium text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors cursor-pointer"
          >
            Últimos 7 dias
          </button>
          <button
            type="button"
            data-testid={`${testIdPrefix}-preset-month`}
            onClick={handlePresetCurrentMonth}
            className="px-2.5 py-1 rounded text-[11px] font-medium text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors cursor-pointer"
          >
            Este Mês
          </button>
        </div>

        {hasActiveRange && (
          <div className="flex items-center gap-2">
            <span
              data-testid={`${testIdPrefix}-active-summary`}
              className="text-[11px] font-mono text-orange-300 bg-orange-500/10 border border-orange-500/30 rounded px-2 py-1 tabular-nums"
            >
              {startDate ? formatDateKeyBR(startDate) : 'Início'} &rarr;{' '}
              {endDate ? formatDateKeyBR(endDate) : 'Hoje'}
              {typeof totalMatchingCount === 'number'
                ? ` (${totalMatchingCount})`
                : ''}
            </span>
            <button
              type="button"
              data-testid={`${testIdPrefix}-clear-btn`}
              onClick={handleClear}
              className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Limpar</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
