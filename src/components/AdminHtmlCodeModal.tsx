import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Download, FileCode2, ExternalLink } from 'lucide-react';

interface AdminHtmlCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminHtmlCodeModal: React.FC<AdminHtmlCodeModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch('/admin.html')
      .then((res) => res.text())
      .then((text) => {
        setHtmlContent(text);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(htmlContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback
    }
  };

  const handleDownloadFile = () => {
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'admin.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-html-modal-title"
    >
      <div className="bg-[#111827] border border-slate-700 rounded-xl max-w-4xl w-full p-6 space-y-4 my-8">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-orange-400">
              <FileCode2 className="w-4 h-4" />
              <span>ARQUIVO STANDALONE ÚNICO &middot; ADMIN.HTML</span>
            </div>
            <h3 id="admin-html-modal-title" className="text-lg font-bold text-white mt-1">
              Código-Fonte Completo de <code className="font-mono text-orange-400">admin.html</code>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Contém Tailwind CSS (CDN), Lucide Icons, Banco de Dados Inicial de 12 peças e sincronização em tempo real com a Landing Page.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela de código"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-[#0B0F17] border border-slate-800 rounded-lg p-4 text-xs text-slate-300 space-y-1.5">
          <p className="font-semibold text-emerald-400">
            Como o <code className="font-mono">admin.html</code> se conecta com a Landing Page:
          </p>
          <p>
            1. <strong>Catálogo &amp; Estoque (<code className="font-mono text-orange-400">mangueiras_products_db</code>):</strong> Toda vez que você cadastra, edita ou exclui uma peça no painel, o sistema atualiza o <code className="font-mono">localStorage</code> e emite <code className="font-mono">PRODUCTS_UPDATED</code> no canal <code className="font-mono text-emerald-400">BroadcastChannel(&apos;mangueiras_erp_sync&apos;)</code>.
          </p>
          <p>
            2. <strong>Orçamentos &amp; Pedidos (<code className="font-mono text-orange-400">mangueiras_orders_db</code>):</strong> Quando um cliente envia um orçamento na Landing Page, o painel detecta o evento instantaneamente via <code className="font-mono">BroadcastChannel</code> e <code className="font-mono">window.onstorage</code>, exibindo um alerta visual imediato.
          </p>
        </div>

        <div>
          {loading ? (
            <div className="h-80 bg-[#0B0F17] border border-slate-800 rounded-lg flex items-center justify-center text-xs text-slate-400">
              Carregando código completo de /admin.html...
            </div>
          ) : (
            <textarea
              readOnly
              value={htmlContent}
              rows={14}
              aria-label="Código-fonte completo do arquivo admin.html"
              className="w-full bg-[#0B0F17] border border-slate-700 rounded-lg p-3.5 text-xs font-mono text-slate-200 leading-relaxed outline-none"
            />
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
          <a
            href="/admin.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-orange-400 hover:text-orange-300 inline-flex items-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Acessar /admin.html diretamente no navegador</span>
          </a>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleCopyCode}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors inline-flex items-center gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Código Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copiar Código Completo</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleDownloadFile}
              className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-bold transition-colors inline-flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Baixar admin.html</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
