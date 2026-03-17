/**
 * Componente de banner para instalação do PWA
 */

import { Download, X, Smartphone, Share2, MoreVertical, PlusSquare } from 'lucide-react';
import { usePWAInstall } from '../hooks';

export function InstallPrompt() {
  const { canInstall, isInstalling, install, dismiss, isIOS, isAndroid, showManualInstructions } = usePWAInstall();

  if (!canInstall) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="mx-auto max-w-md rounded-2xl border border-[#1E3A5F] bg-[#0F1729]/95 p-4 shadow-2xl backdrop-blur-md">
        <div className="flex items-start gap-3">
          {/* Ícone do app */}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0B7A90] to-[#0891B2]">
            <Smartphone className="h-6 w-6 text-white" />
          </div>

          {/* Texto */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white">
              Instale o WorkSafety
            </h3>
            <p className="mt-0.5 text-xs text-[#94A3B8]">
              Acesse mais rápido e use offline. Adicione à sua tela inicial.
            </p>
          </div>

          {/* Botão fechar */}
          <button
            onClick={dismiss}
            className="shrink-0 rounded-lg p-1 text-[#64748B] transition-colors hover:bg-[#1E3A5F]/50 hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Instruções manuais para iOS */}
        {showManualInstructions && isIOS && (
          <div className="mt-3 rounded-xl bg-[#1E3A5F]/30 p-3">
            <p className="text-xs text-[#94A3B8] mb-2">
              Para instalar no iPhone/iPad:
            </p>
            <ol className="space-y-2 text-xs text-white">
              <li className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0B7A90] text-[10px] font-bold">1</span>
                <span>Toque no botão <Share2 className="inline h-3 w-3 mx-0.5" /> Compartilhar na barra do Safari</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0B7A90] text-[10px] font-bold">2</span>
                <span>Role para baixo e toque em &quot;Adicionar à Tela de Início&quot; <PlusSquare className="inline h-3 w-3 mx-0.5" /></span>
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0B7A90] text-[10px] font-bold">3</span>
                <span>Toque em &quot;Adicionar&quot;</span>
              </li>
            </ol>
          </div>
        )}

        {/* Instruções manuais para Android (Chrome sem prompt nativo) */}
        {showManualInstructions && isAndroid && (
          <div className="mt-3 rounded-xl bg-[#1E3A5F]/30 p-3">
            <p className="text-xs text-[#94A3B8] mb-2">
              Para instalar no Android:
            </p>
            <ol className="space-y-2 text-xs text-white">
              <li className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0B7A90] text-[10px] font-bold">1</span>
                <span>Toque no menu <MoreVertical className="inline h-3 w-3 mx-0.5" /> (3 pontos) no Chrome</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0B7A90] text-[10px] font-bold">2</span>
                <span>Selecione &quot;Adicionar à tela inicial&quot; ou &quot;Instalar aplicativo&quot;</span>
              </li>
            </ol>
          </div>
        )}

        {/* Botões de ação - só mostra botão Instalar se tiver prompt nativo */}
        <div className="mt-3 flex gap-2">
          <button
            onClick={dismiss}
            className="flex-1 rounded-xl border border-[#1E3A5F] bg-transparent px-4 py-2.5 text-sm font-medium text-[#94A3B8] transition-colors hover:bg-[#1E3A5F]/30"
          >
            Agora não
          </button>
          {!showManualInstructions && (
            <button
              onClick={install}
              disabled={isInstalling}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0B7A90] to-[#0891B2] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#0B7A90]/25 transition-all hover:from-[#0891B2] hover:to-[#0B7A90] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-4 w-4" />
              {isInstalling ? 'Instalando...' : 'Instalar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
