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
  /** Função para dismiss o banner de instalação (temporário - 7 dias) */
  dismiss: () => void;
  /** Função para dismiss permanente (nunca mais mostrar) */
  dismissForever: () => void;
  /** Se o banner foi dismissado */
  isDismissed: boolean;
  /** Se é um dispositivo iOS (que precisa de instruções manuais) */
  isIOS: boolean;
  /** Se é um dispositivo Android */
  isAndroid: boolean;
  /** Se deve mostrar instruções de instalação manual */
  showManualInstructions: boolean;
  /** Se o browser suporta instalação PWA nativa */
  isNativeInstallSupported: boolean;
}

const DISMISS_KEY = 'pwa-install-dismissed';
const DISMISS_FOREVER_KEY = 'pwa-install-dismissed-forever';
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

// Detecta se é um navegador que suporta PWA
const isPWASupported = (): boolean => {
  if (typeof window === 'undefined') return false;
  // Verifica se o navegador suporta service workers
  return 'serviceWorker' in navigator;
};

export function usePWAInstall(): UsePWAInstallReturn {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isDismissedForever, setIsDismissedForever] = useState(false);
  const [isIOS] = useState(() => isIOSDevice());
  const [isAndroid] = useState(() => isAndroidDevice());
  const [isNativeInstallSupported, setIsNativeInstallSupported] = useState(false);
  const [hasCheckedInstallability, setHasCheckedInstallability] = useState(false);

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

  // Verifica se o navegador suporta instalação nativa (beforeinstallprompt)
  useEffect(() => {
    // Se o evento beforeinstallprompt não foi disparado em 3 segundos,
    // assumimos que o navegador não suporta instalação nativa
    const timer = setTimeout(() => {
      if (!deferredPrompt && !isInstalled) {
        setHasCheckedInstallability(true);
        // Em dispositivos móveis, sempre mostramos o banner mesmo sem o evento nativo
        if (isMobileDevice() && isPWASupported()) {
          setCanInstall(true);
        }
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [deferredPrompt, isInstalled]);

  // Verifica se o banner foi dismissado (temporário ou permanente)
  useEffect(() => {
    // Verifica dismiss permanente
    const dismissedForever = localStorage.getItem(DISMISS_FOREVER_KEY);
    if (dismissedForever) {
      setIsDismissedForever(true);
      return;
    }

    // Verifica dismiss temporário
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
      setIsNativeInstallSupported(true);
      setHasCheckedInstallability(true);
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

  const dismissForever = useCallback(() => {
    setIsDismissedForever(true);
    localStorage.setItem(DISMISS_FOREVER_KEY, 'true');
  }, []);

  // Lógica de quando mostrar o banner de instalação
  const effectiveCanInstall = (() => {
    if (isInstalled || isDismissed || isDismissedForever) return false;
    
    // Se temos o prompt nativo (Chrome desktop/Android moderno)
    if (deferredPrompt) return true;
    
    // Se ainda não verificamos a capacidade de instalação, não mostramos ainda
    if (!hasCheckedInstallability && !isNativeInstallSupported) return false;
    
    // No mobile com suporte a PWA, mostramos instruções manuais
    // mesmo sem o evento beforeinstallprompt
    if (isMobileDevice() && isPWASupported()) return true;
    
    // Desktop com suporte nativo confirmado mas sem prompt ainda
    if (canInstall) return true;
    
    return false;
  })();

  // Mostra instruções manuais quando não temos o prompt nativo
  const showManualInstructions = effectiveCanInstall && !deferredPrompt;

  return {
    canInstall: effectiveCanInstall,
    isInstalled,
    isInstalling,
    install,
    dismiss,
    dismissForever,
    isDismissed,
    isIOS,
    isAndroid,
    showManualInstructions,
    isNativeInstallSupported: isNativeInstallSupported || !!deferredPrompt,
  };
}
