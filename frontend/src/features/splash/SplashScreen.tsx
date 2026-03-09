import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SplashScreenProps {
  onComplete: () => void;
  duration?: number;
}

export default function SplashScreen({ onComplete, duration = 3000 }: SplashScreenProps) {
  const [progress, setProgress] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + (100 / (duration / 50));
      });
    }, 50);

    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onComplete, 500);
    }, duration);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [duration, onComplete]);

  return (
    <AnimatePresence>
      {!isExiting && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, #0F1729 0%, #1a2744 50%, #0F1729 100%)',
          }}
        >
          {/* Background glow effect */}
          <div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-20"
            style={{
              background: 'radial-gradient(circle, rgba(27,197,189,0.3) 0%, transparent 70%)',
            }}
          />

          {/* Main content */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="flex flex-col items-center z-10"
          >
            {/* Logo Icon */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="relative w-28 h-28 rounded-[28px] flex items-center justify-center shadow-2xl"
              style={{
                background: 'linear-gradient(135deg, #1BC5BD 0%, #0B7A90 100%)',
                boxShadow: '0 20px 60px rgba(11, 122, 144, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
              }}
            >
              <ShieldCheck className="text-white w-14 h-14" strokeWidth={2} />
              
              {/* Shine effect */}
              <div 
                className="absolute inset-0 rounded-[28px] overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 50%)',
                }}
              />
            </motion.div>

            {/* Brand Name */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="mt-8 flex items-baseline"
            >
              <span className="text-4xl font-bold text-white tracking-tight">Work</span>
              <span className="text-4xl font-bold text-[#1BC5BD] tracking-tight">Safety</span>
            </motion.div>

            {/* Tagline */}
            <motion.p
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="mt-3 text-sm font-medium tracking-[0.2em] text-gray-400 uppercase"
            >
              Smart Safety
            </motion.p>
          </motion.div>

          {/* Progress bar at bottom */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="absolute bottom-16 left-1/2 -translate-x-1/2 w-32"
          >
            <div className="h-1 w-full bg-gray-700/50 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: 'linear-gradient(90deg, #1BC5BD 0%, #0B7A90 100%)',
                }}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.1, ease: 'linear' }}
              />
            </div>
          </motion.div>

          {/* Version text */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.5 }}
            className="absolute bottom-6 text-xs text-gray-600 font-medium"
          >
            v1.0.0
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
