import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Download, Check, Settings2, Image as ImageIcon } from 'lucide-react';

interface NotificationIconStudioProps {
  onClose: () => void;
  onApply: (base64: string, name: string) => void;
  initialImage?: string;
}

export default function NotificationIconStudio({ onClose, onApply, initialImage }: NotificationIconStudioProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(initialImage || null);
  const [threshold, setThreshold] = useState<number>(128);
  const [resultBase64, setResultBase64] = useState<string | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setImageSrc(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!imageSrc || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const img = new Image();
    img.onload = () => {
      // Android notification icons are ideally 96x96
      canvas.width = 96;
      canvas.height = 96;
      
      // Clear canvas
      ctx.clearRect(0, 0, 96, 96);
      
      // Calculate scaling to fit within 96x96 while preserving aspect ratio, leaving some padding
      const padding = 12;
      const availableSize = 96 - (padding * 2);
      const scale = Math.min(availableSize / img.width, availableSize / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (96 - w) / 2;
      const y = (96 - h) / 2;
      
      ctx.drawImage(img, x, y, w, h);
      
      // Process pixels
      const imageData = ctx.getImageData(0, 0, 96, 96);
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i+1];
        const b = data[i+2];
        const a = data[i+3];
        
        // Calculate luminance
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        
        // If it's fully transparent already, leave it transparent
        if (a < 10) {
            data[i+3] = 0;
        } else {
            const isVisible = a > 50 && (luminance < threshold || threshold === 255);
            
            // Set pixel to white
            data[i] = 255;   // R
            data[i+1] = 255; // G
            data[i+2] = 255; // B
            data[i+3] = isVisible ? a : 0; // A
        }
      }
      
      ctx.putImageData(imageData, 0, 0);
      setResultBase64(canvas.toDataURL('image/png'));
    };
    img.src = imageSrc;
  }, [imageSrc, threshold]);

  const handleDownload = () => {
    if (!resultBase64) return;
    const a = document.createElement('a');
    a.href = resultBase64;
    a.download = 'ic_stat_notification.png';
    a.click();
  };

  const handleApply = () => {
    if (resultBase64) {
      onApply(resultBase64, 'ic_stat_notification.png');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
              <Settings2 size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Push Notification Icon Studio</h2>
              <p className="text-[11px] font-medium text-slate-500">Android requires icons to be purely white & transparent</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto custom-scrollbar flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* Left side: Controls */}
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">1. Source Image</label>
                {!imageSrc ? (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="h-24 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all group"
                  >
                    <Upload size={20} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                    <span className="text-[11px] font-bold text-slate-400 group-hover:text-blue-600">Upload Logo/Icon</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl border border-slate-200 overflow-hidden flex items-center justify-center bg-slate-50 p-2">
                       <img src={imageSrc} className="max-w-full max-h-full object-contain" />
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => fileInputRef.current?.click()} className="text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg transition-colors">
                        Change Image
                      </button>
                      {resultBase64 && (
                        <button onClick={handleDownload} title="Download format for offline use" className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Download size={16} strokeWidth={2.5} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageUpload} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>

              {imageSrc && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">2. Adjust Threshold</label>
                    <span className="text-[10px] font-mono font-bold text-slate-400">{threshold}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="255" 
                    value={threshold}
                    onChange={(e) => setThreshold(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-100 rounded-full appearance-none cursor-pointer accent-blue-600 outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                    Slide to capture the right amount of detail. Pixels darker than this threshold become white, lighter pixels become transparent. 
                  </p>
                </div>
              )}
            </div>

            {/* Right side: Preview */}
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 flex flex-col items-center justify-center relative overflow-hidden">
               <label className="absolute top-3 left-4 block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live Preview</label>
               
               {imageSrc && resultBase64 ? (
                 <div className="space-y-4 flex flex-col items-center w-full mt-4">
                    
                    {/* Status Bar Mockup */}
                    <div className="w-full max-w-[180px] h-6 bg-slate-800 rounded-full flex items-center px-4 gap-2 shadow-sm">
                       {/* The notification icon itself */}
                       <img src={resultBase64} className="w-3 h-3 object-contain" />
                       <div className="flex-1" />
                       <div className="flex items-center gap-1 opacity-50">
                          {/* Fake icons */}
                          <div className="w-2.5 h-2.5 rounded-sm bg-white" />
                          <div className="w-2.5 h-2.5 rounded-sm bg-white" />
                       </div>
                    </div>

                    <div className="flex gap-4">
                      {/* Large dark preview */}
                      <div className="w-20 h-20 rounded-2xl bg-slate-800 flex items-center justify-center p-3 shadow-sm border border-slate-700">
                         <img src={resultBase64} className="w-full h-full object-contain" />
                      </div>
                      
                      {/* Large light preview - invert filter to see white on white */}
                      <div className="w-20 h-20 rounded-2xl bg-white flex items-center justify-center p-3 shadow-sm border border-slate-200" title="How it looks on light background (inverted for preview)">
                         <img src={resultBase64} className="w-full h-full object-contain opacity-50" style={{ filter: 'invert(1)' }} />
                      </div>
                    </div>
                    
                    <p className="text-[10px] font-medium text-slate-400 text-center px-2 leading-relaxed">
                       Final Size: 96x96 PNG. Matches Google guidelines.
                    </p>
                 </div>
               ) : (
                 <div className="flex flex-col items-center gap-2 opacity-30 mt-4">
                    <ImageIcon size={40} strokeWidth={1} />
                    <span className="text-xs font-bold uppercase tracking-widest">No Image</span>
                 </div>
               )}
            </div>
            
          </div>
        </div>

        {/* Hidden Canvas for processing */}
        <canvas ref={canvasRef} className="hidden" />

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-3 shrink-0">
           <button onClick={onClose} className="px-5 py-2 rounded-xl text-[11px] font-bold text-slate-500 hover:bg-slate-200 transition-colors uppercase tracking-widest">
             Cancel
           </button>
           
           <button 
             onClick={handleApply}
             disabled={!resultBase64}
             className="px-6 py-2.5 rounded-xl text-[11px] font-bold text-white bg-blue-950 hover:bg-black shadow-lg shadow-black/10 transition-all flex items-center gap-2 uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
           >
             <Check size={14} strokeWidth={3} />
             Apply
           </button>
        </div>
      </div>
    </div>
  );
}
