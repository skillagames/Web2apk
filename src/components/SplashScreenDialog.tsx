import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Palette, Maximize, Wind, Box, AlertCircle, Smartphone, Sparkles, Save, ChevronDown, ChevronUp } from 'lucide-react';
import SplashPreview, { SplashAnimationType } from './SplashPreview';
import Wheel from '@uiw/react-color-wheel';
import { hexToHsva, hsvaToHex } from '@uiw/color-convert';

interface SplashScreenConfig {
  backgroundColor: string;
  iconSize: number;
  animation: string;
}

interface SplashScreenDialogProps {
  isOpen: boolean;
  onClose: () => void;
  config: SplashScreenConfig;
  onUpdate: (config: SplashScreenConfig) => void;
  iconBase64: string | null;
}

export default function SplashScreenDialog({ 
  isOpen, 
  onClose, 
  config, 
  onUpdate,
  iconBase64 
}: SplashScreenDialogProps) {
  const [localConfig, setLocalConfig] = useState<SplashScreenConfig>(config);
  const [showColorWheel, setShowColorWheel] = useState(false);

  // Parse color string to hex for the wheel, default to white if invalid
  const getHsvaColor = () => {
    try {
      return hexToHsva(localConfig.backgroundColor || '#FFFFFF');
    } catch {
      return hexToHsva('#FFFFFF');
    }
  };
  const [hsva, setHsva] = useState(getHsvaColor());

  // Keep hsva synced if localConfig changes from elsewhere (e.g. preset click)
  useEffect(() => {
    setHsva(getHsvaColor());
  }, [localConfig.backgroundColor]);

  const handleSave = () => {
    onUpdate(localConfig);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          key="splash-dialog-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 overflow-y-auto"
        >
          <div 
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.98, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 15 }}
            transition={{ type: "spring", damping: 26, stiffness: 300, mass: 0.7 }}
            style={{ willChange: 'transform, opacity' }}
            className="relative bg-white w-full max-w-3xl md:h-full md:max-h-[90vh] rounded-[48px] shadow-2xl flex flex-col overflow-hidden border border-slate-200/60 my-auto"
          >
            {/* Header */}
          <div className="flex items-center justify-between p-8 md:p-10 border-b border-slate-100 bg-white sticky top-0 z-10 shrink-0">
            <h2 className="text-2xl font-display font-bold text-slate-900 tracking-tight flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-900 flex items-center justify-center">
                <Box size={24} />
              </div>
              Splash Designer
            </h2>
            <button 
              onClick={onClose} 
              className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-2xl transition-all"
            >
              <X size={24} />
            </button>
          </div>

          {/* Body: Scrollable Content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar bg-slate-50/20">
            <div className="p-6 md:p-8 space-y-8">
              
              {/* 1. Smartphone Preview (TOP) */}
              <div className="flex flex-col items-center gap-5">
                <div className="relative group max-w-full">
                  <div className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-white/95 backdrop-blur-sm py-1.5 px-3 rounded-full z-20 border border-slate-100 shadow-sm whitespace-nowrap">
                    <Smartphone size={12} className="text-blue-500" /> Live Preview
                  </div>
                  <div className="shadow-2xl shadow-blue-950/10 transition-transform duration-700 group-hover:scale-[1.01] flex justify-center">
                    <SplashPreview 
                      backgroundColor={localConfig.backgroundColor}
                      iconSize={localConfig.iconSize}
                      animation={localConfig.animation}
                      iconBase64={iconBase64}
                      scale={0.7}
                    />
                  </div>
                  {!iconBase64 && (
                    <div className="absolute inset-x-0 bottom-4 px-6 pointer-events-none">
                      <div className="bg-white/95 backdrop-blur-sm border border-amber-200 p-2.5 rounded-2xl flex items-center gap-3 shadow-xl shadow-amber-900/5">
                        <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-500 shrink-0">
                          <AlertCircle size={16} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-900 leading-tight">No Icon Found</span>
                          <span className="text-[8px] text-slate-500 font-medium">Using fallback graphic.</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
 
                {/* 2. Icon Resizer (JUST BELOW SMARTPHONE) */}
                <div className="w-full max-w-[340px] bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-3">
                  <div className="px-1">
                    <input 
                      type="range" 
                      min="10" 
                      max="100" 
                      step="5"
                      value={localConfig.iconSize}
                      onChange={(e) => setLocalConfig({ ...localConfig, iconSize: parseInt(e.target.value) })}
                      className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-slate-900"
                    />
                  </div>
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Maximize size={10} /> Icon Scale
                    </label>
                    <span className="text-[10px] font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-full">{localConfig.iconSize}%</span>
                  </div>
                </div>
              </div>
 
              {/* 3. Colour Selection & Animation (BOTTOM) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mx-auto pb-4">
                {/* Background Color */}
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3 overflow-hidden">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 ml-0.5">
                    <Palette size={10} /> Background
                  </label>
                  <div className="flex items-center gap-2 bg-slate-50/50 p-1.5 rounded-xl border border-slate-200 focus-within:border-blue-500 focus-within:bg-white transition-all">
                    <div 
                      className="w-6 h-6 rounded-md border border-slate-200 shadow-inner shrink-0"
                      style={{ backgroundColor: localConfig.backgroundColor }}
                    />
                    <input 
                      type="text" 
                      value={localConfig.backgroundColor}
                      onChange={(e) => setLocalConfig({ ...localConfig, backgroundColor: e.target.value })}
                      className="flex-1 bg-transparent border-none outline-none text-xs font-mono font-bold text-slate-900 uppercase min-w-0"
                      placeholder="#FFFFFF"
                    />
                  </div>
                  <div className="grid grid-cols-9 gap-1.5 pt-1">
                    {['#FFFFFF', '#000000', '#3b82f6', '#10b981', '#f43f5e', '#facc15', '#6366f1', '#0f172a', '#f8fafc'].map(color => (
                      <button
                        key={color}
                        onClick={() => setLocalConfig({ ...localConfig, backgroundColor: color })}
                        className={`w-6 h-6 rounded-md border shadow-sm transition-all active:scale-95 shrink-0 ${localConfig.backgroundColor.toUpperCase() === color.toUpperCase() ? 'border-blue-500 ring-2 ring-blue-500/20 scale-110 z-10' : 'border-slate-200 hover:border-slate-300'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="pt-2">
                    <button 
                      onClick={() => setShowColorWheel(!showColorWheel)}
                      className="w-full flex items-center justify-center px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white transition-colors group text-[10px] font-bold text-slate-600 uppercase tracking-widest shadow-sm"
                    >
                      <Palette size={12} className="mr-2 text-slate-400 group-hover:text-blue-500 transition-colors" />
                      Pick Custom Color
                    </button>
                    
                    <AnimatePresence>
                      {showColorWheel && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden mt-3 flex justify-center"
                        >
                          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl inline-block max-w-full">
                            <Wheel 
                              color={hsva}
                              onChange={(color: any) => {
                                setHsva(color.hsva);
                                setLocalConfig({ ...localConfig, backgroundColor: hsvaToHex(color.hsva) });
                              }}
                              width={200}
                              height={200}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
 
                {/* Animation */}
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 ml-0.5">
                    <Wind size={10} /> Entrance
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['none', 'fade', 'zoom', 'bounce', 'pulse', 'flip', 'float', 'wobble', 'slideUp', 'elastic'] as const).map(anim => (
                      <button
                        key={anim}
                        onClick={() => setLocalConfig({ ...localConfig, animation: anim })}
                        className={`py-2 px-3 rounded-xl border text-[10px] font-bold capitalize transition-all ${
                          localConfig.animation === anim 
                            ? 'bg-blue-950 text-white border-slate-900 shadow-md shadow-blue-950/10' 
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-white'
                        }`}
                      >
                        {anim.replace('Up', ' Up')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Footer */}
          <div className="p-5 border-t border-slate-100 flex items-center justify-center gap-4 bg-white sticky bottom-0 z-10 shrink-0">
            <button 
              onClick={onClose}
              className="px-6 py-3 rounded-xl font-bold text-slate-400 hover:text-slate-900 transition-all active:scale-95 text-[10px] uppercase tracking-widest"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              className="bg-blue-950 hover:bg-black text-white font-bold px-8 py-3 rounded-xl transition-all flex justify-center items-center gap-2 shadow-lg shadow-blue-950/20 active:scale-95 text-xs uppercase tracking-widest group"
            >
              <Save size={16} strokeWidth={2.5} className="group-hover:scale-110 transition-transform" />
              Save
            </button>
          </div>
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  );
}

