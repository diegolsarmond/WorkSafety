import { useState, useEffect } from 'react';

const SPLASH_SHOWN_KEY = 'worksafety_splash_shown';

export function useSplashScreen() {
  const [showSplash, setShowSplash] = useState(true);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Check if splash was already shown in this session
    const splashShown = sessionStorage.getItem(SPLASH_SHOWN_KEY);
    
    if (splashShown) {
      setShowSplash(false);
      setIsReady(true);
    }
  }, []);

  const handleSplashComplete = () => {
    sessionStorage.setItem(SPLASH_SHOWN_KEY, 'true');
    setShowSplash(false);
    setIsReady(true);
  };

  return {
    showSplash,
    isReady,
    handleSplashComplete,
  };
}
