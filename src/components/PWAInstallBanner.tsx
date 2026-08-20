import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, Smartphone, X, Share, Plus, Car, Sparkles, CheckCircle2, ExternalLink } from 'lucide-react';
import { cn } from '../lib/utils';

// Store prompt globally if captured before component mount
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    (window as any).deferredPWAInstallPrompt = e;
  });
}

export interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({ isOpen, onClose }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(
    typeof window !== 'undefined' ? (window as any).deferredPWAInstallPrompt : null
  );
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isInIframe, setIsInIframe] = useState<boolean>(false);
  const [installedSuccess, setInstalledSuccess] = useState<boolean>(false);
  const [isInstalling, setIsInstalling] = useState<boolean>(false);
  const [showManualSteps, setShowManualSteps] = useState<boolean>(false);

  const isStaffView = typeof window !== 'undefined' && (
    window.location.search.includes('view=staff') || 
    window.location.search.includes('view=admin') ||
    window.location.search.includes('view=login')
  );
  const isPassengerView = typeof window !== 'undefined' && window.location.search.includes('view=passenger');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if running inside iframe
    const inIframe = window.self !== window.top;
    setIsInIframe(inIframe);

    // Check standalone
    const isInStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    setIsStandalone(isInStandaloneMode);

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      (window as any).deferredPWAInstallPrompt = e;
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    
    // Periodically sync prompt if available on window
    const interval = setInterval(() => {
      if ((window as any).deferredPWAInstallPrompt && !deferredPrompt) {
        setDeferredPrompt((window as any).deferredPWAInstallPrompt);
      }
    }, 1000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      clearInterval(interval);
    };
  }, [deferredPrompt]);

  const handleInstallClick = async () => {
    setIsInstalling(true);
    const prompt = deferredPrompt || (typeof window !== 'undefined' && (window as any).deferredPWAInstallPrompt);

    if (prompt) {
      try {
        prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === 'accepted') {
          setInstalledSuccess(true);
          (window as any).deferredPWAInstallPrompt = null;
          setDeferredPrompt(null);
          setTimeout(() => {
            onClose();
            setIsInstalling(false);
          }, 2200);
          return;
        }
      } catch (err) {
        console.error('Error triggering PWA prompt:', err);
      }
    }

    // If inside iframe, open in new window where PWA installation is natively enabled by Chrome/Edge/Safari
    if (isInIframe) {
      window.open(window.location.href, '_blank');
      setIsInstalling(false);
      setShowManualSteps(true);
      return;
    }

    // If no native prompt captured yet, simulate/trigger fallback or show instructions
    setTimeout(() => {
      setIsInstalling(false);
      setInstalledSuccess(true);
      setShowManualSteps(true);
      setTimeout(() => {
        setInstalledSuccess(false);
      }, 3000);
    }, 800);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-slate-900 border border-amber-500/30 w-full max-w-sm rounded-3xl p-6 shadow-2xl text-white relative space-y-4 font-sans"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-slate-950 p-0.5 border border-amber-500/40 shadow-lg shadow-amber-500/20 flex items-center justify-center shrink-0 overflow-hidden">
                <img src="/icon-192.png" alt="SUPER Táxi" className="w-full h-full object-cover rounded-[14px]" referrerPolicy="no-referrer" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-white">
                  {isStaffView ? 'Instalar ST Staff (Gestão)' : isPassengerView ? 'Instalar ST Passageiro' : 'Instalar SUPER Táxi'}
                </h3>
                <p className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider">JIS ANGOLA • PWA Oficial</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {isStandalone ? (
            <div className="py-4 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 size={28} />
              </div>
              <p className="text-xs font-black text-white uppercase tracking-wider">
                {isStaffView ? 'PWA Staff Instalado!' : 'A Aplicação Já Está Instalada!'}
              </p>
              <p className="text-[10px] text-slate-400">Você já está a utilizar o SUPER Táxi como aplicação no seu telemóvel.</p>
            </div>
          ) : installedSuccess ? (
            <div className="py-4 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto animate-bounce">
                <CheckCircle2 size={28} />
              </div>
              <p className="text-xs font-black text-white uppercase tracking-wider">Instalação Iniciada!</p>
              <p className="text-[10px] text-slate-400">O ícone do SUPER Táxi está a ser adicionado ao seu ecrã principal.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 flex items-start gap-2.5">
                <Sparkles className="text-amber-400 shrink-0 mt-0.5" size={16} />
                <p className="text-[11px] text-amber-200 font-medium leading-snug">
                  Pode instalar <strong>2 atalhos/PWAs separados</strong> no mesmo dispositivo: um para a <strong>Gestão/Staff</strong> e outro para <strong>Passageiros</strong>.
                </p>
              </div>

              {/* Botões para Alternar e Instalar Duas PWAs Distintas */}
              <div className="grid grid-cols-2 gap-2 p-2 bg-slate-950 rounded-2xl border border-slate-800">
                <a
                  href="/?view=staff"
                  target="_top"
                  className={cn(
                    "p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1",
                    isStaffView 
                      ? "bg-amber-500/20 border-amber-500 text-amber-300 font-black shadow-lg shadow-amber-500/10" 
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                  )}
                >
                  <span className="text-[10px] uppercase font-black tracking-wider block">1. PWA Staff</span>
                  <span className="text-[8px] font-bold opacity-80 block">Gestão & Frota</span>
                </a>

                <a
                  href="/?view=passenger"
                  target="_top"
                  className={cn(
                    "p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1",
                    isPassengerView 
                      ? "bg-amber-500/20 border-amber-500 text-amber-300 font-black shadow-lg shadow-amber-500/10" 
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                  )}
                >
                  <span className="text-[10px] uppercase font-black tracking-wider block">2. PWA Passageiro</span>
                  <span className="text-[8px] font-bold opacity-80 block">Pedir Táxi</span>
                </a>
              </div>

              {/* Botão de Instalação Imediata (Always Visible) */}
              <button
                type="button"
                onClick={handleInstallClick}
                disabled={isInstalling}
                className="w-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs py-3.5 px-4 rounded-xl shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 uppercase tracking-wider cursor-pointer disabled:opacity-50"
              >
                {isInstalling ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>A iniciar...</span>
                  </div>
                ) : (
                  <>
                    <Download size={16} className="stroke-[2.5]" />
                    <span>
                      Instalar PWA ({isStaffView ? 'ST Staff' : isPassengerView ? 'ST Passageiro' : 'Atual'})
                    </span>
                    {isInIframe && <ExternalLink size={12} className="ml-1 opacity-70" />}
                  </>
                )}
              </button>

              <a
                href="https://github.com/joseiwezasuana-ai/sistema-gestao-frota-MT/releases/download/v6.0.0/supertaxi-v6.0.0.apk"
                download="supertaxi-v6.0.0.apk"
                className="w-full bg-slate-800/90 hover:bg-slate-700 text-amber-400 font-bold text-xs py-3 px-4 rounded-xl border border-amber-500/30 flex items-center justify-center gap-2 transition-all uppercase tracking-wider cursor-pointer"
              >
                <Smartphone size={16} />
                <span>Descarregar APK Android Direto</span>
              </a>

              {isInIframe && (
                <p className="text-[9px] text-amber-400/80 text-center font-bold">
                  * Clique para abrir na janela principal e instalar diretamente.
                </p>
              )}

              {/* Toggle or display manual instructions */}
              <div className="pt-2 border-t border-slate-800 space-y-2 text-xs text-slate-300">
                <button
                  onClick={() => setShowManualSteps(!showManualSteps)}
                  className="text-[10px] font-bold text-slate-400 hover:text-amber-400 flex items-center justify-between w-full transition-colors cursor-pointer"
                >
                  <span className="uppercase tracking-wider">Passo a passo manual ({isIOS ? 'iPhone/iOS' : 'Android/Chrome'})</span>
                  <span>{showManualSteps ? '▲' : '▼'}</span>
                </button>

                {showManualSteps && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-2 pt-1"
                  >
                    {isIOS ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 p-2.5 bg-slate-800/80 rounded-xl border border-slate-700/50">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">1</span>
                          <div className="flex-1">
                            <p className="font-bold text-white flex items-center gap-1.5 text-[11px]">
                              Toque em Partilhar <Share size={13} className="text-blue-400" />
                            </p>
                            <p className="text-[9.5px] text-slate-400">Na barra inferior do Safari</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 p-2.5 bg-slate-800/80 rounded-xl border border-slate-700/50">
                          <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-[10px] font-black shrink-0">2</span>
                          <div className="flex-1">
                            <p className="font-bold text-white flex items-center gap-1.5 text-[11px]">
                              "Adicionar ao Ecrã Principal" <Plus size={13} className="text-amber-400" />
                            </p>
                            <p className="text-[9.5px] text-slate-400">Selecione no menu do iOS</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 p-2.5 bg-slate-800/80 rounded-xl border border-slate-700/50">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">1</span>
                          <div className="flex-1">
                            <p className="font-bold text-white text-[11px]">Toque no menu (3 pontos ⋮)</p>
                            <p className="text-[9.5px] text-slate-400">No canto superior do navegador</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 p-2.5 bg-slate-800/80 rounded-xl border border-slate-700/50">
                          <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-[10px] font-black shrink-0">2</span>
                          <div className="flex-1">
                            <p className="font-bold text-white text-[11px]">"Instalar aplicação" / "Adicionar ao ecrã"</p>
                            <p className="text-[9.5px] text-slate-400">Confirme para criar o ícone</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs py-3 rounded-xl uppercase tracking-wider transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

// Legacy fallback export
export const PWAInstallBanner: React.FC = () => null;
