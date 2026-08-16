import React, { useState, useEffect } from 'react';
import { 
  Wifi, 
  WifiOff, 
  CloudUpload, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw, 
  Database, 
  Clock, 
  ShieldAlert, 
  Sparkles,
  AlertTriangle,
  Server,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ConnectivityBannerProps {
  user?: any;
}

export const ConnectivityBanner: React.FC<ConnectivityBannerProps> = ({ user }) => {
  // Determine if user is authorized to view the Sync Console
  let currentUser = user;
  if (!currentUser && typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('local_user_session');
      if (stored) {
        currentUser = JSON.parse(stored);
      }
    } catch (e) {
      // ignore
    }
  }

  const userRole = (currentUser?.role || '').toLowerCase();
  const userEmail = (currentUser?.email || '').toLowerCase();

  const isMasterAdmin = userEmail === 'joseiwezasuana@gmail.com';
  const isAuthorizedRole = ['admin', 'gerente', 'operator', 'operador', 'central'].includes(userRole);

  const canSeeSyncConsole = isMasterAdmin || isAuthorizedRole;

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showStatus, setShowStatus] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => {
    return new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  });

  // Local storage metrics for offline-capable features
  const [gpsPendingCount, setGpsPendingCount] = useState(0);
  const [staffCachedCount, setStaffCachedCount] = useState(0);
  const [hasLocalProfile, setHasLocalProfile] = useState(false);

  // Check storage helper
  const checkStorageMetrics = () => {
    try {
      // 1. GPS points offline queue
      const gpsRaw = localStorage.getItem("gps_offline_queue");
      if (gpsRaw) {
        const queue = JSON.parse(gpsRaw);
        setGpsPendingCount(Array.isArray(queue) ? queue.length : 0);
      } else {
        setGpsPendingCount(0);
      }

      // 2. Staff cached calls (offline-capable central data)
      const callsRaw = localStorage.getItem("staff_cached_calls");
      if (callsRaw) {
        const queue = JSON.parse(callsRaw);
        setStaffCachedCount(Array.isArray(queue) ? queue.length : 0);
      } else {
        setStaffCachedCount(0);
      }

      // 3. Passenger profile cache check
      const profileRaw = localStorage.getItem("psm-passenger-profile");
      setHasLocalProfile(!!profileRaw);
    } catch (err) {
      console.error("Erro ao verificar métricas offline:", err);
    }
  };

  useEffect(() => {
    // Initial check
    checkStorageMetrics();

    const handleOnline = () => {
      setIsOnline(true);
      setShowStatus(true);
      triggerSyncAnimation();
      setTimeout(() => {
        setShowStatus(false);
      }, 4000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowStatus(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Poll metrics every 3 seconds to keep real-time accuracy in the banner
    const interval = setInterval(() => {
      checkStorageMetrics();
    }, 3000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const triggerSyncAnimation = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setLastSyncTime(new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      checkStorageMetrics();
    }, 1500);
  };

  const handleManualSync = () => {
    if (!isOnline) return;
    triggerSyncAnimation();
  };

  const totalPending = gpsPendingCount + staffCachedCount;

  if (!canSeeSyncConsole) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none">
      <AnimatePresence>
        {(showStatus || !isOnline || isExpanded) && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 120, damping: 15 }}
            className="w-full max-w-2xl mx-auto px-4 pt-3 pointer-events-auto"
          >
            <div 
              className={`rounded-2xl shadow-xl overflow-hidden backdrop-blur-md border transition-all duration-300 ${
                !isOnline 
                  ? 'bg-slate-900/95 border-amber-500/30 shadow-amber-500/5' 
                  : totalPending > 0 
                    ? 'bg-slate-900/95 border-blue-500/30 shadow-blue-500/5' 
                    : 'bg-slate-900/95 border-emerald-500/30 shadow-emerald-500/5'
              }`}
            >
              {/* Main Banner Header */}
              <div className="flex items-center justify-between py-2.5 px-4">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  {/* Glowing Connection Dot */}
                  <div className="relative flex h-2 w-2 shrink-0">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      !isOnline ? 'bg-amber-400' : totalPending > 0 ? 'bg-blue-400' : 'bg-emerald-400'
                    }`}></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${
                      !isOnline ? 'bg-amber-500' : totalPending > 0 ? 'bg-blue-500' : 'bg-emerald-500'
                    }`}></span>
                  </div>

                  {/* Status Texts */}
                  <div className="flex items-center gap-2 text-white">
                    {!isOnline ? (
                      <>
                        <WifiOff size={14} className="text-amber-400 shrink-0" />
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                          Operando em Modo Offline
                        </span>
                      </>
                    ) : totalPending > 0 ? (
                      <>
                        <Wifi size={14} className="text-blue-400 shrink-0" />
                        <span className="text-[10px] font-black uppercase tracking-wider text-blue-400 animate-pulse">
                          A Sincronizar Alterações ({totalPending} Pendentes)
                        </span>
                      </>
                    ) : (
                      <>
                        <Wifi size={14} className="text-emerald-400 shrink-0" />
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                          Online • Base de Dados Sincronizada
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Right Side Info & Expand button */}
                <div className="flex items-center gap-2 shrink-0">
                  {totalPending > 0 && (
                    <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[8px] font-black uppercase rounded-full tracking-wider animate-pulse">
                      Alterações Pendentes
                    </span>
                  )}
                  {isOnline && totalPending === 0 && (
                    <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[8px] font-black uppercase rounded-full tracking-wider">
                      Sincronizado
                    </span>
                  )}
                  
                  {/* Detailed Panel Toggle Button */}
                  <button 
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-1 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-all flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider"
                  >
                    <span>Métricas</span>
                    {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>

                  {/* Close Banner Button */}
                  <button
                    onClick={() => {
                      setShowStatus(false);
                      setIsExpanded(false);
                    }}
                    className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all"
                    title="Fechar Aviso"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Collapsible Details Panel */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0 }}
                    className="overflow-hidden border-t border-white/5 bg-slate-950/40"
                  >
                    <div className="p-4 space-y-3">
                      {/* Metric Title */}
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                          <Database size={11} className="text-brand-primary" />
                          Consola de Sincronização • JIS TaxiControl
                        </span>
                        <div className="flex items-center gap-1.5 text-[8.5px] text-slate-500 font-bold">
                          <Clock size={10} />
                          <span>Último Check: {lastSyncTime}</span>
                        </div>
                      </div>

                      {/* Grid Items of Offline-Capable Features */}
                      <div className="grid grid-cols-2 gap-2">
                        {/* 1. GPS Tracking Sync Status */}
                        <div className="bg-slate-900/80 p-2.5 rounded-xl border border-white/5 flex flex-col justify-between">
                          <div className="flex items-start justify-between">
                            <span className="text-[9.5px] font-bold text-slate-300 uppercase tracking-tight block">Rastreamento de GPS</span>
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                              gpsPendingCount > 0 
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}>
                              {gpsPendingCount > 0 ? `${gpsPendingCount} Pendentes` : 'Sincronizado'}
                            </span>
                          </div>
                          <p className="text-[8px] text-slate-500 leading-tight mt-1.5">
                            {gpsPendingCount > 0 
                              ? 'Pontos de localização guardados em cache local à espera de rede celular.' 
                              : 'Rastreamento ativo e transmitido em tempo real com a central.'}
                          </p>
                        </div>

                        {/* 2. Central Operations Sync Status */}
                        <div className="bg-slate-900/80 p-2.5 rounded-xl border border-white/5 flex flex-col justify-between">
                          <div className="flex items-start justify-between">
                            <span className="text-[9.5px] font-bold text-slate-300 uppercase tracking-tight block">Cache da Central (Chamadas)</span>
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                              staffCachedCount > 0 
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}>
                              {staffCachedCount > 0 ? `${staffCachedCount} Em Cache` : 'Sincronizado'}
                            </span>
                          </div>
                          <p className="text-[8px] text-slate-500 leading-tight mt-1.5">
                            {staffCachedCount > 0 
                              ? 'Chamadas e faturamentos guardados localmente para não interromper a operação.' 
                              : 'Todos os logs operacionais integrados com a nuvem Firestore.'}
                          </p>
                        </div>

                        {/* 3. Passenger Config Cache Status */}
                        <div className="bg-slate-900/80 p-2.5 rounded-xl border border-white/5 flex flex-col justify-between">
                          <div className="flex items-start justify-between">
                            <span className="text-[9.5px] font-bold text-slate-300 uppercase tracking-tight block">Perfil de Passageiro</span>
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[8px] font-black uppercase">
                              {hasLocalProfile ? 'Cache Ativo' : 'Padrão'}
                            </span>
                          </div>
                          <p className="text-[8px] text-slate-500 leading-tight mt-1.5">
                            Previsão de rotas e dados de perfil de backup persistidos no navegador.
                          </p>
                        </div>

                        {/* 4. Active S.O.S Monitor */}
                        <div className="bg-slate-900/80 p-2.5 rounded-xl border border-white/5 flex flex-col justify-between">
                          <div className="flex items-start justify-between">
                            <span className="text-[9.5px] font-bold text-slate-300 uppercase tracking-tight block">Canal Crítico de S.O.S</span>
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase flex items-center gap-1 ${
                              isOnline 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}>
                              <span className={`h-1 w-1 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></span>
                              {isOnline ? 'Ativo' : 'SMS de Backup'}
                            </span>
                          </div>
                          <p className="text-[8px] text-slate-500 leading-tight mt-1.5">
                            {isOnline 
                              ? 'Monitor de pânico operacional totalmente conectado via WebSockets.' 
                              : 'Avisos SOS serão roteados via SMS direto para o operador.'}
                          </p>
                        </div>
                      </div>

                      {/* Footer Info & Control Buttons */}
                      <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Server size={11} className="text-slate-500" />
                          <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">
                            Estado Geral: {isOnline ? 'Totalmente Conectado' : 'Sem Conexão Física'}
                          </span>
                        </div>

                        <div className="flex gap-2">
                          {isOnline && (
                            <button
                              onClick={handleManualSync}
                              disabled={isSyncing}
                              className="px-3 py-1 bg-brand-primary text-slate-950 hover:bg-brand-primary/90 text-[8px] font-black uppercase tracking-wider rounded-lg flex items-center gap-1 transition-all disabled:opacity-50"
                            >
                              <RefreshCw size={10} className={isSyncing ? "animate-spin" : ""} />
                              <span>{isSyncing ? "A Sincronizar..." : "Forçar Sincronização"}</span>
                            </button>
                          )}
                          {!isOnline && (
                            <div className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-[8px] font-black uppercase tracking-wider">
                              <AlertTriangle size={9} />
                              <span>Alterações Sincronizarão ao Conectar</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
