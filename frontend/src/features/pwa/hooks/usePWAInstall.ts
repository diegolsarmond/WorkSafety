/**
 * Hook para gerenciar a instalação do PWA
 * Detecta quando o app pode ser instalado e fornece funções para instalar
 */

import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

interface UsePWAInstallReturn {
  /** Se o PWA pode ser instalado */
  canInstall: boolean;
  /** Se o app já está instalado */
  isInstalled: boolean;
  /** Se está mostrando o prompt de instalação */
  isInstalling: boolean;
  /** Função para abrir o prompt de instalação */
  install: () => Promise<void>;
  /** Função para dismiss o banner de instalação */
  dismiss: () => void;
  /** Se o banner foi dismissado */
  isDismissed: boolean;
  /** Se é um dispositivo iOS (que precisa de instruções manuais) */
  isIOS: boolean;
  /** Se é um dispositivo Android */
  isAndroid: boolean;
  /** Se deve mostrar instruções de instalação manual */
  showManualInstructions: boolean;
}

const DISMISS_KEY = 'pwa-install-dismissed';
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 dias

// Detecta se é iOS
const isIOSDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  const userAgent = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent) && !('MSStream' in window);
};

// Detecta se é Android
const isAndroidDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  const userAgent = window.navigator.userAgent.toLowerCase();
  return /android/.test(userAgent);
};

// Detecta se é mobile
const isMobileDevice = (): boolean => {
  return isIOSDevice() || isAndroidDevice();
};

export function usePWAInstall(): UsePWAInstallReturn {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isIOS] = useState(() => isIOSDevice());
  const [isAndroid] = useState(() => isAndroidDevice());

  // Verifica se o app já está instalado
  useEffect(() => {
    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                          (window.navigator as { standalone?: boolean }).standalone === true;
      setIsInstalled(isStandalone);
    };

    checkInstalled();

    // Ouve mudanças no display mode
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleChange = (e: MediaQueryListEvent) => setIsInstalled(e.matches);
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Verifica se o banner foi dismissado recentemente
  useEffect(() => {
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const timePassed = Date.now() - parseInt(dismissedAt, 10);
      if (timePassed < DISMISS_DURATION) {
        setIsDismissed(true);
      } else {
        localStorage.removeItem(DISMISS_KEY);
      }
    }
  }, []);

  // Captura o evento beforeinstallprompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Previne o mini-infobar padrão no mobile
      e.preventDefault();
      // Armazena o evento para poder usá-lo depois
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Ouve quando o app foi instalado
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setCanInstall(false);
      setIsInstalled(true);
      localStorage.removeItem(DISMISS_KEY);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return;

    setIsInstalling(true);
    
    // Mostra o prompt de instalação
    await deferredPrompt.prompt();

    // Espera a resposta do usuário
    const choiceResult = await deferredPrompt.userChoice;

    if (choiceResult.outcome === 'accepted') {
      setIsInstalled(true);
    }

    // Limpa o prompt salvo
    setDeferredPrompt(null);
    setCanInstall(false);
    setIsInstalling(false);
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    setIsDismissed(true);
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
  }, []);

  // No iOS, sempre mostramos o banner (se não estiver instalado nem dismissado)
  // pois não há evento beforeinstallprompt
  // No Android, mostramos se tivermos o deferredPrompt ou como fallback manual
  const effectiveCanInstall = (() => {
    if (isInstalled || isDismissed) return false;
    
    // Se temos o prompt nativo (Chrome desktop/Android)
    if (canInstall && deferredPrompt) return true;
    
    // No mobile, mostramos instruções manuais se não tiver o prompt nativo
    if (isMobileDevice()) return true;
    
    return false;
  })();

  // Mostra instruções manuais quando não temos o prompt nativo (principalmente iOS)
  const showManualInstructions = effectiveCanInstall && !deferredPrompt;

  return {
    canInstall: effectiveCanInstall,
    isInstalled,
    isInstalling,
    install,
    dismiss,
    isDismissed,
    isIOS,
    isAndroid,
    showManualInstructions,
  };
}
