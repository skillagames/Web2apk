import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Palette, Maximize, Wind, Box, AlertCircle, Smartphone, Sparkles } from 'lucide-react';
import SplashPreview from './SplashPreview';

interface SplashScreenConfig {
  backgroundColor: string;
  iconSize: number;
  animation: 'none' | 'fade' | 'scale' | 'bounce';
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

  const handleSave = () => {
    onUpdate(localConfig);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 overflow-y-auto">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-gray-900/40 backdrop-blur-md"
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative bg-white w-full max-w-3xl md:h-full md:max-h-[90vh] rounded-[48px] shadow-2xl flex flex-col overflow-hidden border border-slate-200/60 my-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-8 md:p-10 border-b border-slate-100 bg-white sticky top-0 z-10 shrink-0">
            <h2 className="text-2xl font-display font-bold text-slate-900 tracking-tight flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
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
                    <Smartphone size={12} className="text-indigo-500" /> Live Preview
                  </div>
                  <div className="shadow-2xl shadow-slate-900/10 transition-transform duration-700 group-hover:scale-[1.01] flex justify-center">
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
                      className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Maximize size={10} /> Icon Scale
                    </label>
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">{localConfig.iconSize}%</span>
                  </div>
                </div>
              </div>
 
              {/* 3. Colour Selection & Animation (BOTTOM) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mx-auto pb-4">
                {/* Background Color */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4 overflow-hidden">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 ml-0.5">
                    <Palette size={10} /> Background
                  </label>
                  <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200 focus-within:border-indigo-500 focus-within:bg-white transition-all">
                    <div 
                      className="w-8 h-8 rounded-lg border border-slate-200 shadow-inner shrink-0" 
                      style={{ backgroundColor: localConfig.backgroundColor }}
                    />
                    <input 
                      type="text" 
                      value={localConfig.backgroundColor}
                      onChange={(e) => setLocalConfig({ ...localConfig, backgroundColor: e.target.value })}
                      className="flex-1 bg-transparent border-none outline-none text-xs font-mono font-bold text-slate-900 uppercase min-w-0"
                      placeholder="#FFFFFF"
                    />
                    <input 
                      type="color" 
                      value={localConfig.backgroundColor}
                      onChange={(e) => setLocalConfig({ ...localConfig, backgroundColor: e.target.value })}
                      className="w-7 h-7 rounded-md cursor-pointer border-none bg-transparent shrink-0"
                    />
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {['#FFFFFF', '#000000', '#3b82f6', '#10b981', '#f43f5e', '#facc15', '#6366f1', '#0f172a', '#f8fafc', '#ec4899'].map(color => (
                      <button
                        key={color}
                        onClick={() => setLocalConfig({ ...localConfig, backgroundColor: color })}
                        className={`w-full aspect-square rounded-lg border shadow-sm transition-all active:scale-95 ${localConfig.backgroundColor.toUpperCase() === color.toUpperCase() ? 'border-indigo-500 ring-2 ring-indigo-500/10 scale-105' : 'border-slate-100 hover:border-slate-300'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
 
                {/* Animation */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 ml-0.5">
                    <Wind size={10} /> Entrance
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['none', 'fade', 'scale', 'bounce'] as const).map(anim => (
                      <button
                        key={anim}
                        onClick={() => setLocalConfig({ ...localConfig, animation: anim })}
                        className={`py-2.5 px-3 rounded-2xl border text-[10px] font-bold capitalize transition-all ${
                          localConfig.animation === anim 
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-600/20' 
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-white'
                        }`}
                      >
                        {anim}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Footer */}
          <div className="p-5 border-t border-slate-100 flex gap-4 bg-white sticky bottom-0 z-10 shrink-0">
            <button 
              onClick={onClose}
              className="px-8 py-4 rounded-3xl font-bold text-slate-400 hover:text-slate-900 transition-all active:scale-95 text-[10px] uppercase tracking-widest"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              className="flex-1 px-8 py-4 rounded-3xl font-bold bg-indigo-600 text-white hover:bg-black transition-all shadow-xl shadow-indigo-600/20 active:scale-95 text-xs uppercase tracking-widest"
            >
              Save Experience
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

