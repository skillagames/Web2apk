import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Smartphone } from 'lucide-react';

export type SplashAnimationType = 'none' | 'fade' | 'zoom' | 'bounce' | 'pulse' | 'flip' | 'float' | 'wobble' | 'slideUp' | 'elastic';

interface SplashPreviewProps {
  backgroundColor: string;
  iconSize: number;
  animation: SplashAnimationType | string;
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
      initial: { opacity: 0.3 },
      animate: { opacity: 1 },
      transition: { duration: 1.5, repeat: Infinity, repeatType: 'reverse' as const }
    },
    zoom: {
      initial: { scale: 0.8, opacity: 0 },
      animate: { scale: 1, opacity: 1 },
      transition: { duration: 1.2, repeat: Infinity, repeatType: 'reverse' as const, ease: 'easeOut' }
    },
    bounce: {
      initial: { y: 0, scaleY: 1 },
      animate: { y: [-20, 0, -10, 0, -5, 0], scaleY: [1, 0.9, 1, 0.95, 1, 1] },
      transition: { duration: 2, repeat: Infinity, ease: "easeOut", times: [0, 0.4, 0.6, 0.8, 0.9, 1] }
    },
    pulse: {
      initial: { scale: 1 },
      animate: { scale: [1, 1.05, 1] },
      transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
    },
    flip: {
      initial: { rotateY: 0 },
      animate: { rotateY: 360 },
      transition: { duration: 2.5, repeat: Infinity, ease: "easeInOut" }
    },
    float: {
      initial: { y: 0 },
      animate: { y: [-10, 10, -10] },
      transition: { duration: 3, repeat: Infinity, ease: "easeInOut" }
    },
    wobble: {
      initial: { rotateZ: 0 },
      animate: { rotateZ: [0, -10, 10, -10, 10, 0] },
      transition: { duration: 2.5, repeat: Infinity, ease: "easeInOut" }
    },
    slideUp: {
      initial: { y: 50, opacity: 0 },
      animate: { y: [50, 0, 0, 50], opacity: [0, 1, 1, 0] },
      transition: { duration: 3, repeat: Infinity, ease: "easeInOut", times: [0, 0.3, 0.7, 1] }
    },
    elastic: {
      initial: { scale: 0 },
      animate: { scale: [0, 1.2, 0.9, 1.1, 0.95, 1] },
      transition: { duration: 2.5, repeat: Infinity, times: [0, 0.4, 0.6, 0.8, 0.9, 1] }
    }
  };

  const selectedAnimation = (animationVariants as any)[animation] || animationVariants.none;

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
              <Sparkles size={40 * scale} className="text-blue-950/10" />
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
