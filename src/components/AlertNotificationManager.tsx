import React, { useState, useEffect, useCallback } from 'react';
import { 
  AlertTriangle, 
  PhoneMissed, 
  Zap, 
  Bell, 
  X, 
  Gauge,
  ShieldAlert,
  AlertOctagon,
  Phone,
  Activity,
  Trash2,
  MessageSquare,
  Wallet,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, query, orderBy, limit, Timestamp, where, addDoc, serverTimestamp, deleteDoc, doc } from '@/src/lib/firebase';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { format } from 'date-fns';
import WaitingTimer from './WaitingTimer';

interface Alert {
  id: string;
  docId?: string;
  collectionName?: string;
  type: 'speeding' | 'missed_call' | 'security' | 'geo_fence' | 'panic' | 'revenue';
  title: string;
  message: string;
  timestamp: Date;
  severity: 'critical' | 'warning' | 'info';
  metadata?: any;
}

const DISMISSED_ALERTS_KEY = 'super_taxi_dismissed_alert_ids_v2';

const getDismissedAlertIds = (): Set<string> => {
  try {
    const saved = localStorage.getItem(DISMISSED_ALERTS_KEY);
    if (saved) return new Set(JSON.parse(saved));
  } catch (e) {}
  return new Set();
};

const saveDismissedAlertId = (id: string) => {
  try {
    const current = getDismissedAlertIds();
    current.add(id);
    localStorage.setItem(DISMISSED_ALERTS_KEY, JSON.stringify(Array.from(current)));
  } catch (e) {}
};

const saveMultipleDismissedAlertIds = (ids: string[]) => {
  try {
    const current = getDismissedAlertIds();
    ids.forEach(id => current.add(id));
    localStorage.setItem(DISMISSED_ALERTS_KEY, JSON.stringify(Array.from(current)));
  } catch (e) {}
};

export default function AlertNotificationManager({ user }: { user?: any }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [showPermissionBanner, setShowPermissionBanner] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // Request browser notification permission
  const requestPermission = useCallback(async () => {
    const result = await Notification.requestPermission();
    setPermission(result);
    setShowPermissionBanner(false);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
      if (Notification.permission === 'default') {
        setShowPermissionBanner(true);
      }
    }

    // 1. Monitor Missed & Stuck Calls
    const unsubCalls = onSnapshot(query(collection(db, 'calls'), where('status', '==', 'pending')), (snapshot) => {
      snapshot.docs.forEach((docItem) => {
        const call = docItem.data();
        const ts = call.timestamp?.toDate ? call.timestamp.toDate() : new Date(call.timestamp);
        const diff = (new Date().getTime() - ts.getTime()) / (1000 * 60);
        
        if (diff > 5) {
          triggerAlert({
            id: `missed-stale-${docItem.id}`,
            docId: docItem.id,
            collectionName: 'calls',
            type: 'missed_call',
            title: 'Chamada Abandonada',
            message: `Cliente ${call.customerName || 'N/A'} está à espera há mais de 5 min!`,
            severity: 'critical',
            timestamp: new Date(),
            metadata: { callTimestamp: ts, customerName: call.customerName }
          });
        }
      });
    }, (error) => handleFirestoreError(error, OperationType.GET, 'calls'));

    // 2. Monitor Fleet for Speeding
    const unsubSpeed = onSnapshot(collection(db, 'drivers'), (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        const vehicle = change.doc.data();
        if (vehicle.speed > 85) {
            const alertId = `speed-${change.doc.id}`;
            
            // Avoid spam: Check if we already logged this vehicle recently (10 min cooldown)
            const lastAlert = (window as any)._lastSpeedAlerts?.[change.doc.id];
            const now = Date.now();
            
            if (!lastAlert || (now - lastAlert) > 600000) { // 10 minutes
              if (!(window as any)._lastSpeedAlerts) (window as any)._lastSpeedAlerts = {};
              (window as any)._lastSpeedAlerts[change.doc.id] = now;

              // 1. Log to permanent violations history
              try {
                await addDoc(collection(db, 'speed_violations'), {
                  driverId: change.doc.id,
                  driverName: vehicle.name || 'Desconhecido',
                  prefix: vehicle.prefix,
                  speed: vehicle.speed,
                  timestamp: serverTimestamp(),
                  lat: vehicle.lat || null,
                  lng: vehicle.lng || null,
                  status: 'unresolved'
                });
              } catch (e) {
                console.error("Erro ao registar infração:", e);
              }

              // 2. Trigger UI Notification
              triggerAlert({
                  id: `${alertId}-${now}`,
                  docId: change.doc.id,
                  type: 'speeding',
                  title: 'Excesso de Velocidade',
                  message: `Viatura ${vehicle.prefix} detectada a ${vehicle.speed}km/h em Luena!`,
                  severity: 'critical',
                  timestamp: new Date(),
                  metadata: { prefix: vehicle.prefix, speed: vehicle.speed }
              });

              // 3. Play alert sound
              try {
                if (typeof window !== 'undefined' && 'Audio' in window && typeof (window as any).Audio === 'function') {
                  const AudioClass = (window as any).Audio;
                  const audio = new AudioClass('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                  audio.volume = 0.4;
                  audio.play().catch(() => {});
                }
              } catch (err) {}
            }
        }
      });
    }, (error) => handleFirestoreError(error, OperationType.GET, 'drivers'));

    // 3. Monitor Panic Alerts (S.O.S)
    const qPanic = query(collection(db, 'panic_alerts'), orderBy('timestamp', 'desc'), limit(5));
    const unsubPanic = onSnapshot(qPanic, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const panic = change.doc.data();
          if (panic.status === 'active') {
            // Play a priority alert sound (using simple browser beep)
            try {
              const AudioCtxClass = typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext);
              if (AudioCtxClass && typeof AudioCtxClass === 'function') {
                const audioCtx = new (AudioCtxClass as any)();
                const oscillator = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                oscillator.type = 'square';
                oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
                gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
                oscillator.start();
                oscillator.stop(audioCtx.currentTime + 0.5);
              }
            } catch (e) {}

            triggerAlert({
              id: `panic-${change.doc.id}`,
              docId: change.doc.id,
              collectionName: 'panic_alerts',
              type: 'panic',
              title: 'S.O.S - EMERGÊNCIA CRÍTICA',
              message: `O MOTORISTA ${panic.driverName?.toUpperCase()} ACCIONOU O BOTÃO DE PÂNICO EM LUENA!`,
              severity: 'critical',
              timestamp: new Date(),
              metadata: panic
            });
          }
        }
      });
    }, (error) => handleFirestoreError(error, OperationType.GET, 'panic_alerts'));

    // 4. Monitor Revenue Approval (Operator -> Admin/Gerente) & Revenue Delivery (Admin/Gerente -> Contabilista)
    const qRevenueMessages = query(
      collection(db, 'messages'),
      orderBy('timestamp', 'desc'),
      limit(10)
    );

    const unsubRevenueMessages = onSnapshot(qRevenueMessages, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const msg = change.doc.data();
          const role = (user?.role || '').toLowerCase();
          const isAdminOrGerente = role === 'admin' || role === 'gerente' || role === 'administrator' || role === 'manager' || user?.isMasterAdmin;
          const isContabilista = role === 'contabilista' || role === 'accountant' || isAdminOrGerente;

          // Event 1: Operator approved revenue -> Awakening Alert for Admin and Gerente
          if (msg.category === 'revenue_operator_approved' && (isAdminOrGerente || !user?.role)) {
            // Play awakening chime sound
            try {
              const AudioCtxClass = typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext);
              if (AudioCtxClass && typeof AudioCtxClass === 'function') {
                const audioCtx = new (AudioCtxClass as any)();
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
                osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // A5
                gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.4);
              }
            } catch (e) {}

            triggerAlert({
              id: `rev-op-${change.doc.id}`,
              docId: change.doc.id,
              collectionName: 'messages',
              type: 'revenue',
              title: msg.title || '🚨 RENDA VALIDADA PELO OPERADOR',
              message: msg.content || `Operador aprovou a renda da viatura ${msg.prefix || ''}. Requer aprovação do Admin/Gerente.`,
              severity: 'critical',
              timestamp: new Date(),
              metadata: msg
            });
          }

          // Event 2: Admin/Gerente delivered revenue -> Alert for Contabilista
          if (msg.category === 'revenue_delivered_to_accountant' && (isContabilista || !user?.role)) {
            // Play accountant delivery sound
            try {
              const AudioCtxClass = typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext);
              if (AudioCtxClass && typeof AudioCtxClass === 'function') {
                const audioCtx = new (AudioCtxClass as any)();
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
                osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.15); // E5
                osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.3); // G5
                gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.5);
              }
            } catch (e) {}

            triggerAlert({
              id: `rev-contab-${change.doc.id}`,
              docId: change.doc.id,
              collectionName: 'messages',
              type: 'revenue',
              title: msg.title || '💰 RENDA ENTREGUE AO CONTABILISTA',
              message: msg.content || `Admin/Gerente entregou a renda da viatura ${msg.prefix || ''} para liquidação e encerramento.`,
              severity: 'warning',
              timestamp: new Date(),
              metadata: msg
            });
          }
        }
      });
    }, (error) => handleFirestoreError(error, OperationType.GET, 'messages'));

    return () => {
      unsubCalls();
      unsubSpeed();
      unsubPanic();
      unsubRevenueMessages();
    };
  }, [user]);

  const speakText = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window) {
      try {
        window.speechSynthesis.cancel();
        const UtteranceClass = (window as any).SpeechSynthesisUtterance;
        if (typeof UtteranceClass === 'function') {
          const utterance = new UtteranceClass(text);
          utterance.lang = 'pt-PT';
          utterance.rate = 1.0;
          utterance.pitch = 1.0;
          window.speechSynthesis.speak(utterance);
        }
      } catch (e) {
        console.warn("Speech synthesis error:", e);
      }
    }
  };

  const triggerAlert = (alert: Alert) => {
    // DO NOT re-trigger if this alert or document was already dismissed by the user!
    const dismissedIds = getDismissedAlertIds();
    if (dismissedIds.has(alert.id) || (alert.docId && dismissedIds.has(alert.docId))) {
      return;
    }

    let isDuplicate = false;
    setAlerts(prev => {
      if (prev.find(a => a.id === alert.id)) {
        isDuplicate = true;
        return prev;
      }
      return [alert, ...prev].slice(0, 5); // Keep last 5
    });

    if (isDuplicate) return;

    // Trigger Voice Speech Synthesis for critical alerts (Awakening Admin/Gerente or Accountant)
    if (alert.type === 'revenue' || alert.type === 'panic') {
      speakText(`${alert.title}. ${alert.message}`);
    }

    // Push / Browser Notification logic
    if (typeof window !== 'undefined' && 'Notification' in window && window.Notification) {
      if (window.Notification.permission === 'granted') {
        const notifOptions = {
          body: alert.message,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          vibrate: alert.type === 'revenue' || alert.type === 'panic' ? [300, 100, 300, 100, 300, 100, 300] : [200, 100, 200],
          tag: alert.id,
          renotify: true,
          requireInteraction: alert.type === 'revenue' || alert.type === 'panic',
          data: alert.metadata
        };

        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready
            .then(registration => {
              registration.showNotification(alert.title, notifOptions).catch(() => {});
            })
            .catch(() => {});
        }
      } else if (window.Notification.permission === 'default' && typeof window.Notification.requestPermission === 'function') {
        try {
          window.Notification.requestPermission().then(res => setPermission(res)).catch(() => {});
        } catch (e) {}
      }
    }

    // Auto-dismiss after 15-30 seconds
    const duration = alert.type === 'panic' || alert.type === 'revenue' ? 30000 : 15000;
    setTimeout(() => {
      removeAlert(alert.id);
    }, duration);
  };

  const removeAlert = (id: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
    saveDismissedAlertId(id);
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const permanentlyDeleteAlert = async (alertItem: Alert) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }

    // 1. Remember dismissal locally so it never triggers on refresh
    saveDismissedAlertId(alertItem.id);
    if (alertItem.docId) {
      saveDismissedAlertId(alertItem.docId);
    }

    // 2. Remove from active alerts state
    setAlerts(prev => prev.filter(a => a.id !== alertItem.id));

    // 3. Permanently delete from Firestore if document reference exists
    if (alertItem.docId && alertItem.collectionName) {
      try {
        await deleteDoc(doc(db, alertItem.collectionName, alertItem.docId));
        setFeedbackToast('Alerta crítico e registo eliminados permanentemente!');
        setTimeout(() => setFeedbackToast(null), 3000);
      } catch (err) {
        console.error("Erro ao eliminar alerta do Firestore:", err);
        setFeedbackToast('Alerta removido do ecran (erro ao eliminar documento da BD).');
        setTimeout(() => setFeedbackToast(null), 3000);
      }
    } else {
      setFeedbackToast('Alerta removido e ocultado permanentemente!');
      setTimeout(() => setFeedbackToast(null), 3000);
    }
  };

  const clearAllAlerts = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
    const idsToDismiss = alerts.map(a => a.id).concat(alerts.filter(a => a.docId).map(a => a.docId!));
    saveMultipleDismissedAlertIds(idsToDismiss);
    setAlerts([]);
  };

  return (
    <>
      {/* Toast Feedback */}
      {feedbackToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[110] bg-slate-900 text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 border border-emerald-500/50 shadow-2xl animate-bounce">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* Visual Alerts Overlay */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-4 w-full max-w-md pointer-events-none px-4">
        <AnimatePresence>
          {alerts.length > 1 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={clearAllAlerts}
              className="pointer-events-auto mx-auto mb-2 bg-slate-900 shadow-2xl shadow-black/40 text-white px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-3 border border-white/20 active:scale-95 transition-all group"
            >
              <Trash2 size={14} className="text-brand-primary group-hover:scale-110 transition-transform" />
              Esvaziar Balde de Alertas ({alerts.length})
            </motion.button>
          )}

          {showPermissionBanner && (
            <motion.div
              initial={{ y: -100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -100, opacity: 0 }}
              className="bg-brand-primary text-white p-4 rounded-xl shadow-2xl border border-white/20 pointer-events-auto flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <Bell className="animate-bounce" size={20} />
                <p className="text-xs font-bold leading-tight uppercase tracking-tight">Active notificações push para não perder alertas críticos</p>
              </div>
              <button 
                onClick={requestPermission}
                className="bg-white text-brand-primary px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
              >
                Ativar
              </button>
            </motion.div>
          )}

          {alerts.map((alertItem) => (
            <motion.div
              key={alertItem.id}
              initial={{ scale: 0.8, y: -50, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.8, y: -20, opacity: 0 }}
              className="pointer-events-auto group relative"
            >
              <div className={`
                relative overflow-hidden rounded-2xl border-2 shadow-[0_20px_50px_rgba(0,0,0,0.3)]
                ${alertItem.severity === 'critical' ? 'bg-red-600 border-red-500' : 'bg-amber-500 border-amber-400'}
              `}>
                {/* Visual Accent */}
                <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12 bg-white rounded-full -mr-10 -mt-10" />
                
                <div className="px-6 py-5 flex items-start gap-5 relative z-10">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-md shadow-inner">
                    {alertItem.type === 'speeding' && <Activity size={24} className="text-white animate-pulse" />}
                    {alertItem.type === 'missed_call' && <Phone size={24} className="text-white animate-bounce" />}
                    {alertItem.type === 'panic' && <ShieldAlert size={24} className="text-white animate-[ping_1.5s_infinite]" />}
                    {alertItem.type === 'revenue' && <Wallet size={24} className="text-white animate-bounce" />}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Alerta Crítico</span>
                      <div className="w-1 h-1 rounded-full bg-white animate-ping" />
                    </div>
                    <h4 className="text-lg font-black text-white leading-none mb-1 uppercase italic tracking-tighter">{alertItem.title}</h4>
                    <p className="text-sm text-white/90 font-bold leading-tight mb-2">
                      {alertItem.type === 'missed_call' && alertItem.metadata?.callTimestamp ? (
                        <>Cliente {alertItem.metadata.customerName || 'N/A'} está à espera há <WaitingTimer timestamp={alertItem.metadata.callTimestamp} className="underline font-black" />!</>
                      ) : (
                        alertItem.message
                      )}
                    </p>

                    {/* Button to Permanently Delete Critical Alerts */}
                    {(alertItem.type === 'revenue' || alertItem.type === 'panic' || alertItem.docId) && (
                      <button
                        onClick={() => permanentlyDeleteAlert(alertItem)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-black/40 hover:bg-black/70 text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border border-white/20 cursor-pointer shadow-md"
                        title="Eliminar este alerta permanentemente do sistema"
                      >
                        <Trash2 size={12} className="text-rose-400" />
                        Eliminar Permanentemente
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => removeAlert(alertItem.id)}
                      className="p-1.5 hover:bg-white/20 bg-black/20 rounded-lg transition-all text-white/80 hover:text-white"
                      title="Fechar Alerta (Ocultar)"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                {/* Progress bar for auto-dismiss */}
                <motion.div 
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: alertItem.type === 'panic' ? 30 : 15, ease: 'linear' }}
                  className="h-1 bg-white/30 absolute bottom-0 left-0"
                />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}

