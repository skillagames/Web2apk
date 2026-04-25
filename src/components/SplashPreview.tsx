import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Smartphone } from 'lucide-react';

interface SplashPreviewProps {
  backgroundColor: string;
  iconSize: number;
  animation: 'none' | 'fade' | 'scale' | 'bounce';
  iconBase64: string | null;
  scale?: number;
}

export default function SplashPreview({ 
  backgroundColor, 
  iconSize, 
  animation, 
  iconBase64,
  scale = 1
}: SplashPreviewProps) {
  const animationVariants = {
    none: {},
    fade: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      transition: { duration: 1, repeat: Infinity, repeatType: 'reverse' as const }
    },
    scale: {
      initial: { scale: 0.5 },
      animate: { scale: 1 },
      transition: { duration: 1, repeat: Infinity, repeatType: 'mirror' as const }
    },
    bounce: {
      animate: { y: [-15, 0, -15] },
      transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
    }
  };

  const selectedAnimation = animationVariants[animation];

  return (
    <div 
      className="relative flex flex-col items-center justify-center overflow-hidden transition-all duration-500 shadow-[0_32px_128px_-16px_rgba(0,0,0,0.2)] bg-white"
      style={{ 
        backgroundColor,
        width: `${320 * scale}px`,
        aspectRatio: '9/19',
        borderRadius: `${40 * scale}px`,
        border: `${12 * scale}px solid #0F172A`
      }}
    >
      {/* Device Notch */}
      <div 
        className="absolute top-0 bg-[#0F172A] z-20" 
        style={{ 
          width: `${112 * scale}px`, 
          height: `${24 * scale}px`,
          borderBottomLeftRadius: `${16 * scale}px`,
          borderBottomRightRadius: `${16 * scale}px`
        }} 
      />
      
      {/* Splash Content */}
      <AnimatePresence mode="wait">
        <motion.div 
          key={animation + iconBase64 + backgroundColor}
          {...(selectedAnimation as any)}
          className="flex flex-col items-center justify-center z-10"
          style={{ 
            width: `${iconSize}%`
          }}
        >
          {iconBase64 ? (
            <div className="w-full aspect-square rounded-[22%] overflow-hidden shadow-2xl bg-white">
              <img 
                src={iconBase64} 
                alt="Splash Icon" 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div 
              className="w-full aspect-square rounded-[22%] flex items-center justify-center border-2 border-dashed transition-colors"
              style={{
                backgroundColor: 'rgba(0,0,0,0.05)',
                borderColor: 'rgba(0,0,0,0.1)'
              }}
            >
              <Sparkles size={40 * scale} className="text-black/10" />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Home Indicator */}
      <div 
        className="absolute bottom-1 bg-gray-400/20 rounded-full" 
        style={{ 
          width: `${96 * scale}px`, 
          height: `${4 * scale}px` 
        }} 
      />
    </div>
  );
}
