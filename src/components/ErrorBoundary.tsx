import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import type { FirestoreErrorInfo } from '../firebase';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  firestoreInfo: FirestoreErrorInfo | null;
}

function parseFirestoreErrorMessage(rawMessage: string): {
  friendlyMessage: string;
  firestoreInfo: FirestoreErrorInfo | null;
} {
  try {
    const parsed = JSON.parse(rawMessage) as Partial<FirestoreErrorInfo>;
    if (parsed && typeof parsed.error === 'string' && 'operationType' in parsed) {
      const lower = parsed.error.toLowerCase();
      if (lower.includes('quota exceeded') || lower.includes('resource-exhausted')) {
        return {
          friendlyMessage:
            'O limite gratuito diário do banco de dados Firestore foi atingido. Os dados locais continuam seguros; tente sincronizar novamente após a renovação da cota.',
          firestoreInfo: parsed as FirestoreErrorInfo,
        };
      }
      if (lower.includes('permission-denied') || lower.includes('insufficient permissions')) {
        return {
          friendlyMessage: `Permissão negada ao executar "${parsed.operationType}" em "${parsed.path || 'coleção'}". Verifique as regras de segurança do Firestore.`,
          firestoreInfo: parsed as FirestoreErrorInfo,
        };
      }
      return {
        friendlyMessage: `Erro ao sincronizar com o banco de dados (${parsed.operationType} em ${parsed.path || 'Firestore'}): ${parsed.error}`,
        firestoreInfo: parsed as FirestoreErrorInfo,
      };
    }
  } catch {
    // Not a JSON FirestoreErrorInfo payload
  }

  return {
    friendlyMessage:
      rawMessage || 'Ocorreu um erro inesperado na interface do sistema.',
    firestoreInfo: null,
  };
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
      firestoreInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const { friendlyMessage, firestoreInfo } = parseFirestoreErrorMessage(
      error?.message || String(error)
    );
    return {
      hasError: true,
      errorMessage: friendlyMessage,
      firestoreInfo,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('Erro capturado pelo ErrorBoundary:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      errorMessage: '',
      firestoreInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-[#111827] border border-rose-500/40 rounded-xl p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-500/15 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h1 className="text-base font-bold text-white">
                  Falha Detectada no Painel — Tem de Tudo Auto Peças
                </h1>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {this.state.errorMessage}
                </p>
              </div>
            </div>

            {this.state.firestoreInfo && (
              <div className="bg-[#0B0F17] border border-slate-800 rounded-lg p-3 text-[11px] font-mono text-slate-400 space-y-1">
                <div>
                  Operação: <span className="text-slate-200">{this.state.firestoreInfo.operationType}</span>
                </div>
                {this.state.firestoreInfo.path && (
                  <div>
                    Caminho: <span className="text-slate-200">{this.state.firestoreInfo.path}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
              >
                Tentar Continuar
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Recarregar Sistema</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
