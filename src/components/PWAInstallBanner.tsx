import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, Smartphone, X, Check, Share, Plus, HelpCircle, ChevronRight, Car, Sparkles } from 'lucide-react';

export const PWAInstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [showBanner, setShowBanner] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  useEffect(() => {
    // 1. Check if running in standalone mode (already installed as PWA)
    const isInStandaloneMode = () => {
      return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://')
      );
    };

    if (isInStandaloneMode()) {
      setIsStandalone(true);
      return;
    }

    // 2. Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(iosDevice);

    // 3. Check if user dismissed banner recently in local storage
    const dismissedTimestamp = localStorage.getItem('pwa_banner_dismissed');
    if (dismissedTimestamp) {
      const hoursSinceDismissed = (Date.now() - parseInt(dismissedTimestamp, 10)) / (1000 * 60 * 60);
      if (hoursSinceDismissed < 12) {
        setIsDismissed(true);
      }
    }

    // 4. Listen for beforeinstallprompt event (Android / Desktop Chrome / Edge)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!isDismissed && !isInStandaloneMode()) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // For iOS or browsers where event doesn't fire immediately, show banner after brief delay
    const timer = setTimeout(() => {
      if (!isInStandaloneMode() && !isDismissed) {
        setShowBanner(true);
      }
    }, 2000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      clearTimeout(timer);
    };
  }, [isDismissed]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          console.log('User accepted PWA install prompt');
          setShowBanner(false);
          setDeferredPrompt(null);
        } else {
          console.log('User dismissed PWA install prompt');
        }
      } catch (err) {
        console.error('Error triggering PWA install:', err);
        setShowHelpModal(true);
      }
    } else {
      // If native prompt unavailable (e.g. iOS Safari), show instructions modal
      setShowHelpModal(true);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setIsDismissed(true);
    localStorage.setItem('pwa_banner_dismissed', Date.now().toString());
  };

  if (isStandalone) return null;

  return (
    <>
      {/* Floating Bottom / Top Banner: "Aplicação disponível. Instalar Super Táxi" */}
      <AnimatePresence>
        {showBanner && (
          <motion.div
            initial={{ y: 100, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 100, opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md z-[9999] bg-slate-900/95 backdrop-blur-xl border border-amber-500/30 rounded-2xl p-4 shadow-2xl shadow-black/80 text-white font-sans"
          >
            {/* Header / Badges */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-600 via-blue-500 to-amber-500 p-0.5 shadow-lg shadow-blue-500/20 flex items-center justify-center shrink-0">
                    <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                      <Car className="text-amber-400" size={22} />
                    </div>
                  </div>
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse" />
                </div>

                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                      PWA Oficial
                    </span>
                    <span className="text-[9px] font-bold text-slate-400">JIS ANGOLA</span>
                  </div>
                  <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-tight mt-0.5">
                    Aplicação disponível. Instalar Super Táxi
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDismiss}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Fechar"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-[11px] text-slate-300 font-medium leading-snug mt-2.5 mb-3.5">
              Instale a aplicação no seu dispositivo para acesso instantâneo, funcionamento rápido e notificações em tempo real.
            </p>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleInstallClick}
                className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs py-2.5 px-3 rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5 transition-all active:scale-95 uppercase tracking-wider"
              >
                <Download size={15} className="stroke-[2.5]" />
                Instalar Agora
              </button>

              <button
                type="button"
                onClick={() => setShowHelpModal(true)}
                className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-[11px] rounded-xl border border-white/10 flex items-center gap-1 transition-colors uppercase tracking-wider shrink-0"
              >
                <HelpCircle size={14} />
                Como instalar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Mini Trigger Badge if user closed banner */}
      {isDismissed && !showBanner && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          onClick={() => setShowBanner(true)}
          className="fixed bottom-4 right-4 z-[9990] bg-slate-900 border border-amber-500/40 text-amber-400 px-3 py-2 rounded-full shadow-2xl flex items-center gap-2 text-xs font-black uppercase tracking-wider hover:bg-slate-800 transition-all active:scale-95"
        >
          <Smartphone size={15} />
          <span>Instalar SUPER Táxi</span>
        </motion.button>
      )}

      {/* Instruction Modal for iOS or manual install */}
      <AnimatePresence>
        {showHelpModal && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-3xl p-6 shadow-2xl text-white relative space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-white">Instalar SUPER Táxi</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Passo a passo por navegador</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowHelpModal(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800"
                >
                  <X size={16} />
                </button>
              </div>

              {isIOS ? (
                /* iOS Safari Instructions */
                <div className="space-y-3">
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 flex items-start gap-2.5">
                    <Sparkles className="text-amber-400 shrink-0 mt-0.5" size={16} />
                    <p className="text-[11px] text-amber-200 font-medium">
                      No iPhone / iPad (Safari), a instalação é feita em apenas 2 toques:
                    </p>
                  </div>

                  <div className="space-y-2.5 text-xs text-slate-300">
                    <div className="flex items-center gap-3 p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
                      <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black shrink-0">1</span>
                      <div className="flex-1">
                        <p className="font-bold text-white flex items-center gap-1.5">
                          Toque em Partilhar <Share size={14} className="text-blue-400" />
                        </p>
                        <p className="text-[10px] text-slate-400">Na barra inferior ou superior do Safari</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
                      <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-xs font-black shrink-0">2</span>
                      <div className="flex-1">
                        <p className="font-bold text-white flex items-center gap-1.5">
                          "Adicionar ao Ecrã Principal" <Plus size={14} className="text-amber-400" />
                        </p>
                        <p className="text-[10px] text-slate-400">Role as opções e selecione o botão de mais</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Android / Chrome Instructions */
                <div className="space-y-3">
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-3 flex items-start gap-2.5">
                    <Sparkles className="text-blue-400 shrink-0 mt-0.5" size={16} />
                    <p className="text-[11px] text-blue-200 font-medium">
                      No Android (Chrome, Edge ou Samsung Internet):
                    </p>
                  </div>

                  <div className="space-y-2.5 text-xs text-slate-300">
                    <div className="flex items-center gap-3 p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
                      <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black shrink-0">1</span>
                      <div className="flex-1">
                        <p className="font-bold text-white">Toque no menu (3 pontos ⋮)</p>
                        <p className="text-[10px] text-slate-400">No canto superior direito do seu navegador</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
                      <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-xs font-black shrink-0">2</span>
                      <div className="flex-1">
                        <p className="font-bold text-white">"Instalar aplicação" ou "Adicionar ao ecrã"</p>
                        <p className="text-[10px] text-slate-400">Confirme a instalação para ter o ícone no seu telemóvel</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-black text-xs py-3 rounded-xl uppercase tracking-wider transition-colors"
              >
                Entendi as Instruções
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
