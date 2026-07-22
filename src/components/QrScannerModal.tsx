import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
  title?: string;
  hint?: string;
}

export default function QrScannerModal({ isOpen, onClose, onScanSuccess, title = 'Leitor de QR Code', hint = 'Aponte a câmara para o QR Code do material ou veículo' }: QrScannerModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [cameraPermission, setCameraPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [availableCameras, setAvailableCameras] = useState<CameraDevice[]>([]);
  const [currentCameraId, setCurrentCameraId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  
  const qrCodeInstanceRef = useRef<Html5Qrcode | null>(null);
  const elementId = "qr-reader-element";

  interface CameraDevice {
    id: string;
    label: string;
  }

  // Effect to request camera list and initialize QR reader
  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setIsInitializing(true);
    
    // Tiny delay to ensure DOM is ready
    const timer = setTimeout(() => {
      initializeScanner();
    }, 400);

    return () => {
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen, currentCameraId]);

  const initializeScanner = async () => {
    try {
      // Check if instance already exists, stop and clear
      if (qrCodeInstanceRef.current) {
        await stopScanner();
      }

      const instance = new Html5Qrcode(elementId);
      qrCodeInstanceRef.current = instance;

      // Get cameras
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        setCameraPermission('granted');
        const formattedDevices = devices.map(d => ({ id: d.id, label: d.label }));
        setAvailableCameras(formattedDevices);

        // Select camera
        let selectedCameraId = currentCameraId;
        if (!selectedCameraId) {
          // Default to environment (back) camera if found
          const backCamera = formattedDevices.find(d => 
            d.label.toLowerCase().includes('back') || 
            d.label.toLowerCase().includes('traseira') || 
            d.label.toLowerCase().includes('environment')
          );
          selectedCameraId = backCamera ? backCamera.id : formattedDevices[0].id;
          setCurrentCameraId(selectedCameraId);
        }

        // Start scanning
        await instance.start(
          selectedCameraId,
          {
            fps: 15,
            qrbox: (width, height) => {
              const size = Math.min(width, height) * 0.7;
              return { width: size, height: size };
            },
            aspectRatio: 1.0
          },
          (decodedText) => {
            // Success
            handleSuccess(decodedText);
          },
          () => {
            // Verbose logging of scan failures can be ignored
          }
        );
        setIsInitializing(false);
      } else {
        throw new Error("Nenhuma câmara detetada no dispositivo.");
      }
    } catch (err: any) {
      console.error("Erro ao inicializar QR Scanner:", err);
      setIsInitializing(false);
      
      const errMsg = err?.message || String(err);
      if (errMsg.includes("NotAllowedError") || errMsg.includes("permission")) {
        setCameraPermission('denied');
        setError("Acesso à câmara foi recusado. Por favor, autorize nas definições do navegador.");
      } else {
        setError(errMsg || "Não foi possível aceder à câmara.");
      }
    }
  };

  const stopScanner = async () => {
    if (qrCodeInstanceRef.current) {
      if (qrCodeInstanceRef.current.isScanning) {
        try {
          await qrCodeInstanceRef.current.stop();
        } catch (e) {
          console.error("Falha ao parar scanner:", e);
        }
      }
      qrCodeInstanceRef.current = null;
    }
  };

  const handleSuccess = async (text: string) => {
    // Vibrate device if supported
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(150);
    }
    await stopScanner();
    onScanSuccess(text);
  };

  const toggleCamera = () => {
    if (availableCameras.length <= 1) return;
    const currentIndex = availableCameras.findIndex(c => c.id === currentCameraId);
    const nextIndex = (currentIndex + 1) % availableCameras.length;
    setCurrentCameraId(availableCameras[nextIndex].id);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative bg-slate-900 border border-white/10 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="px-6 py-4 bg-slate-950/50 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-brand-primary animate-pulse" />
                <h3 className="text-xs font-black uppercase italic tracking-widest text-white">{title}</h3>
              </div>
              <button 
                onClick={onClose} 
                className="hover:bg-white/10 p-2 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Camera Frame Area */}
            <div className="relative aspect-square w-full bg-slate-950 flex items-center justify-center overflow-hidden">
              <div id={elementId} className="w-full h-full object-cover [&_video]:w-full [&_video]:h-full [&_video]:object-cover" />

              {/* Overlay QR Guidelines */}
              {!error && !isInitializing && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                  {/* Scanner box outline */}
                  <div className="w-[60%] aspect-square border-2 border-brand-primary/50 rounded-2xl relative shadow-[0_0_0_400px_rgba(15,23,42,0.65)]">
                    {/* Corner accents */}
                    <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-brand-primary rounded-tl-lg" />
                    <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-brand-primary rounded-tr-lg" />
                    <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-brand-primary rounded-bl-lg" />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-brand-primary rounded-br-lg" />
                    
                    {/* Laser line animation */}
                    <div className="w-full h-0.5 bg-brand-primary shadow-[0_0_8px_#3b82f6] absolute top-0 animate-[scan_3s_ease-in-out_infinite]" />
                  </div>
                </div>
              )}

              {/* State overlays */}
              {isInitializing && (
                <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center space-y-4">
                  <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center animate-pulse">
                    <Camera className="text-brand-primary animate-spin" size={24} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white uppercase tracking-wider">A sintonizar câmara...</h4>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Por favor aguarde um momento</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-8 text-center space-y-4">
                  <div className="w-12 h-12 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center">
                    <AlertCircle size={24} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white uppercase tracking-wider">Falha de Ligação</h4>
                    <p className="text-[10px] text-rose-400 font-semibold mt-2 max-w-xs leading-relaxed">
                      {error.includes("Requested device not found") || error.includes("Could not start video source")
                        ? "Não foi possível aceder à câmara física (pode estar a ser utilizada por outra aplicação ou bloqueada pelo iframe)."
                        : error}
                    </p>
                  </div>
                  <div className="space-y-3 w-full max-w-xs">
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-normal">
                      💡 DICA: Se estiver a usar a pré-visualização, clique em <span className="text-brand-primary">"Open in a new tab"</span> (canto superior direito) para ignorar restrições de iframe.
                    </p>
                    {cameraPermission === 'denied' ? (
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest leading-normal">
                        Aceda às definições do navegador para dar autorização de câmara a esta página.
                      </p>
                    ) : (
                      <button
                        onClick={initializeScanner}
                        className="w-full px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer"
                      >
                        Tentar Novamente
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="p-6 bg-slate-950/70 border-t border-white/5 space-y-4">
              <p className="text-[10px] text-slate-400 font-bold text-center uppercase tracking-widest leading-normal">
                {hint}
              </p>

              {availableCameras.length > 1 && !error && !isInitializing && (
                <div className="flex justify-center">
                  <button
                    onClick={toggleCamera}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                  >
                    <RefreshCw size={12} className="animate-pulse" />
                    Mudar Câmara ({availableCameras.length})
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
