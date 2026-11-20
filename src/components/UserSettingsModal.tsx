import React, { useState, useRef } from 'react';
import {
  X,
  Volume2,
  VolumeX,
  BellRing,
  CheckCircle2,
  Settings,
  Download,
  Upload,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  FileJson,
} from 'lucide-react';
import {
  UserSoundSettings,
  DailyBackupMeta,
  ErpBackupPayload,
  playNotificationPing,
  parseAndValidateErpBackupJson,
} from '../erp/erpLogic';

interface UserSettingsModalProps {
  isOpen: boolean;
  soundSettings: UserSoundSettings;
  onUpdateSoundSettings: (next: UserSoundSettings) => void;
  dailyBackupMeta: DailyBackupMeta | null;
  onDownloadBackupJson: () => void;
  onRestoreFromBackupPayload: (
    payload: ErpBackupPayload,
    sourceLabel: string
  ) => Promise<void> | void;
  onRestoreDailySnapshot: () => Promise<boolean> | boolean;
  onClose: () => void;
}

export const UserSettingsModal: React.FC<UserSettingsModalProps> = ({
  isOpen,
  soundSettings,
  onUpdateSoundSettings,
  dailyBackupMeta,
  onDownloadBackupJson,
  onRestoreFromBackupPayload,
  onRestoreDailySnapshot,
  onClose,
}) => {
  const [testedFeedback, setTestedFeedback] = useState<boolean>(false);
  const [backupFeedback, setBackupFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const volumePercent = Math.round(soundSettings.volume * 100);

  const handleToggleEnabled = () => {
    const nextEnabled = !soundSettings.enabled;
    const nextSettings: UserSoundSettings = {
      ...soundSettings,
      enabled: nextEnabled,
    };
    onUpdateSoundSettings(nextSettings);
    if (nextEnabled) {
      playNotificationPing(nextSettings);
    }
  };

  const handleVolumeChange = (newVolumePct: number) => {
    const clamped = Math.min(100, Math.max(10, newVolumePct));
    onUpdateSoundSettings({
      ...soundSettings,
      volume: Number((clamped / 100).toFixed(2)),
    });
  };

  const handleTestPing = () => {
    playNotificationPing({
      enabled: true,
      volume: soundSettings.volume,
    });
    setTestedFeedback(true);
    setTimeout(() => setTestedFeedback(false), 2500);
  };

  const handleDownloadJsonNow = () => {
    onDownloadBackupJson();
    setBackupFeedback({
      type: 'success',
      message:
        'Backup diário gerado e salvo em arquivo JSON local com todos os Produtos e Orçamentos.',
    });
  };

  const handleRestoreSnapshotNow = async () => {
    setIsRestoring(true);
    setBackupFeedback(null);
    try {
      const ok = await onRestoreDailySnapshot();
      if (ok) {
        setBackupFeedback({
          type: 'success',
          message:
            'Sistema restaurado com sucesso a partir da cópia diária automática!',
        });
      } else {
        setBackupFeedback({
          type: 'error',
          message:
            'Não foi encontrado um ponto de backup diário válido para restauração.',
        });
      }
    } finally {
      setIsRestoring(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsRestoring(true);
    setBackupFeedback(null);
    try {
      const rawText = await file.text();
      const validation = parseAndValidateErpBackupJson(rawText);
      if (!validation.valid || !validation.payload) {
        setBackupFeedback({
          type: 'error',
          message:
            validation.error ||
            'Falha ao validar o arquivo JSON de backup selecionado.',
        });
        return;
      }

      await onRestoreFromBackupPayload(validation.payload, file.name);
      setBackupFeedback({
        type: 'success',
        message: `Sistema restaurado com sucesso de "${file.name}": ${validation.payload.summary.productsCount} produto(s) e ${validation.payload.summary.ordersCount} orçamento(s) recuperados!`,
      });
    } catch {
      setBackupFeedback({
        type: 'error',
        message:
          'Erro ao ler o arquivo selecionado. Certifique-se de escolher um arquivo .json válido.',
      });
    } finally {
      setIsRestoring(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-settings-modal-title"
      data-testid="user-settings-modal"
    >
      <div className="bg-[#111827] border border-slate-700 rounded-xl max-w-xl w-full shadow-2xl overflow-hidden my-auto">
        {/* Cabeçalho do Modal */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-500/15 border border-orange-500/40 flex items-center justify-center text-orange-400 shrink-0">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3
                id="user-settings-modal-title"
                className="text-base font-bold text-white"
              >
                Configurações &amp; Backup Diário do Sistema
              </h3>
              <p className="text-xs text-slate-400">
                Notificações sonoras, cópia diária em JSON e recuperação contra corrupção de dados
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar configurações"
            data-testid="close-user-settings-btn"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Card 1: Ativar / Desativar Som de Notificação */}
          <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${
                    soundSettings.enabled
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                      : 'bg-slate-800/80 border-slate-700 text-slate-400'
                  }`}
                >
                  {soundSettings.enabled ? (
                    <Volume2 className="w-4 h-4" />
                  ) : (
                    <VolumeX className="w-4 h-4" />
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-white">
                      Notificação Sonora de Novos Orçamentos (&ldquo;Ping&rdquo;)
                    </h4>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Emite um leve sinal sonoro sempre que uma nova cotação chegar em tempo real no{' '}
                    <strong className="text-slate-200">Mural de Pedidos</strong> ou na{' '}
                    <strong className="text-slate-200">Gestão de Orçamentos</strong>.
                  </p>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={soundSettings.enabled}
                aria-label="Ativar ou desativar notificações sonoras"
                data-testid="settings-sound-toggle"
                onClick={handleToggleEnabled}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  soundSettings.enabled ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                    soundSettings.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Controle de Volume + Teste de Áudio */}
            <div className="pt-3 border-t border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <label
                  htmlFor="sound-volume-range"
                  className="font-medium text-slate-300"
                >
                  Volume do Alerta Sonoro
                </label>
                <span className="font-mono font-bold text-orange-400 tabular-nums">
                  {soundSettings.enabled ? `${volumePercent}%` : 'Silenciado'}
                </span>
              </div>

              <input
                id="sound-volume-range"
                type="range"
                min={10}
                max={100}
                step={5}
                disabled={!soundSettings.enabled}
                data-testid="settings-volume-slider"
                value={volumePercent}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                className="w-full accent-orange-500 disabled:opacity-40 cursor-pointer"
              />

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-slate-400 inline-flex items-center gap-1.5">
                  <BellRing className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                  <span>
                    Status atual:{' '}
                    <strong
                      data-testid="settings-sound-status-text"
                      className={
                        soundSettings.enabled
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }
                    >
                      {soundSettings.enabled
                        ? 'Som Ativado'
                        : 'Som Desativado'}
                    </strong>
                  </span>
                </span>

                <button
                  type="button"
                  data-testid="settings-test-sound-btn"
                  onClick={handleTestPing}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5 text-orange-400" />
                  <span>Testar Som (&ldquo;Ping&rdquo;)</span>
                </button>
              </div>

              {testedFeedback && (
                <div
                  role="status"
                  data-testid="settings-test-sound-feedback"
                  className="bg-emerald-950/80 border border-emerald-500/40 rounded-lg px-3 py-2 text-xs text-emerald-200 flex items-center gap-2"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Sinal sonoro &ldquo;ping&rdquo; reproduzido com sucesso!</span>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Rotina de Backup Diário e Restauração de Dados (JSON Local) */}
          <div
            className="bg-[#0B0F17] border border-slate-800 rounded-xl p-4 space-y-4"
            data-testid="daily-backup-section"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 w-9 h-9 rounded-lg bg-sky-500/15 border border-sky-500/40 text-sky-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-white">
                    Backup Diário e Recuperação de Dados (JSON Local)
                  </h4>
                  <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 rounded px-2 py-0.5">
                    Rotina Diária Ativa
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Gera automaticamente uma cópia diária dos dados essenciais (
                  <strong className="text-slate-200">Produtos</strong> e{' '}
                  <strong className="text-slate-200">Orçamentos</strong>) e permite salvar ou restaurar o sistema a partir de um arquivo <code className="text-orange-400 font-mono">.json</code> local em caso de corrupção de dados.
                </p>
              </div>
            </div>

            {/* Resumo do Último Backup Diário */}
            <div
              className="bg-[#111827] border border-slate-800 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              data-testid="daily-backup-meta-box"
            >
              <div className="flex items-center gap-2 text-slate-300">
                <FileJson className="w-4 h-4 text-orange-400 shrink-0" />
                <span>
                  Último backup diário:{' '}
                  <strong
                    className="font-mono text-white"
                    data-testid="daily-backup-last-date"
                  >
                    {dailyBackupMeta
                      ? dailyBackupMeta.lastBackupAtFormatted
                      : 'Sincronizando...'}
                  </strong>
                </span>
              </div>
              {dailyBackupMeta && (
                <span
                  className="font-mono text-[11px] text-slate-400 tabular-nums"
                  data-testid="daily-backup-counts"
                >
                  {dailyBackupMeta.productsCount} Produtos &middot;{' '}
                  {dailyBackupMeta.ordersCount} Orçamentos &middot;{' '}
                  {dailyBackupMeta.solicitacoesCount} Cotações
                </span>
              )}
            </div>

            {/* Botões de Ação: Exportar Backup JSON e Restaurar Sistema */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                data-testid="download-daily-backup-btn"
                onClick={handleDownloadJsonNow}
                className="px-3.5 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold text-xs transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>Baixar Backup Diário (.JSON)</span>
              </button>

              <button
                type="button"
                data-testid="restore-from-file-btn"
                disabled={isRestoring}
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 font-semibold text-xs transition-colors inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Upload className="w-4 h-4 text-sky-400 shrink-0" />
                <span>Restaurar de Arquivo .JSON</span>
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              data-testid="restore-backup-file-input"
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-slate-400">
                Recuperação rápida sem arquivo externo:
              </span>
              <button
                type="button"
                data-testid="restore-daily-snapshot-btn"
                disabled={isRestoring}
                onClick={handleRestoreSnapshotNow}
                className="px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white text-xs font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                <span>Restaurar Última Cópia Diária Salva</span>
              </button>
            </div>

            {backupFeedback && (
              <div
                role="status"
                data-testid={
                  backupFeedback.type === 'success'
                    ? 'backup-status-feedback'
                    : 'backup-error-feedback'
                }
                className={`rounded-lg px-3.5 py-2.5 text-xs flex items-start gap-2 border ${
                  backupFeedback.type === 'success'
                    ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
                    : 'bg-rose-950/80 border-rose-500/40 text-rose-200'
                }`}
              >
                {backupFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <span>{backupFeedback.message}</span>
              </div>
            )}
          </div>
        </div>

        {/* Rodapé do Modal */}
        <div className="px-6 py-4 bg-[#0B0F17] border-t border-slate-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            data-testid="save-and-close-settings-btn"
            className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
          >
            Concluir e Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
