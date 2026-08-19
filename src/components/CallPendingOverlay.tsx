import React, { useState, useEffect, useRef } from 'react';
import { 
  PhoneIncoming, 
  Phone, 
  PhoneCall, 
  MapPin, 
  Navigation, 
  User, 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  X, 
  Volume2, 
  VolumeX, 
  ChevronDown, 
  ChevronUp, 
  ShieldAlert, 
  Car, 
  Radio, 
  ExternalLink,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import WaitingTimer from './WaitingTimer';
import { logSignalingEvent } from '../lib/signalingLogger';
import { doc, updateDoc, serverTimestamp, arrayUnion, db } from '../lib/firebase';

interface CallPendingOverlayProps {
  pendingCalls: any[];
  drivers: Array<{ id: string; name: string; phone: string; status?: string; prefix?: string }>;
  currentDriverId?: string;
  onCallHandled?: () => void;
}

export const CallPendingOverlay: React.FC<CallPendingOverlayProps> = ({
  pendingCalls,
  drivers,
  currentDriverId,
  onCallHandled
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedDriverMap, setSelectedDriverMap] = useState<Record<string, string>>({});
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const audioCtxRef = useRef<any>(null);
  const ringIntervalRef = useRef<any>(null);

  // Web Audio Ringtone & System Sound Synthesizer
  const playDualToneRing = () => {
    if (isMuted) return;
    try {
      if (typeof window === 'undefined') return;
      const AudioCtxClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;
      
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtxClass();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }

      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;

      // High-visibility alarm chord (Dual Tone + Harmonic)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const osc3 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'sine';
      osc3.type = 'triangle';

      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc2.frequency.setValueAtTime(880.00, now); // A5
      osc3.frequency.setValueAtTime(1174.66, now); // D6

      gain.gain.setValueAtTime(0, now);
      // Ring burst 1
      gain.gain.linearRampToValueAtTime(0.35, now + 0.04);
      gain.gain.setValueAtTime(0.35, now + 0.65);
      gain.gain.linearRampToValueAtTime(0, now + 0.72);

      // Ring burst 2
      gain.gain.setValueAtTime(0, now + 0.85);
      gain.gain.linearRampToValueAtTime(0.35, now + 0.90);
      gain.gain.setValueAtTime(0.35, now + 1.55);
      gain.gain.linearRampToValueAtTime(0, now + 1.62);

      osc1.connect(gain);
      osc2.connect(gain);
      osc3.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc3.start(now);
      osc1.stop(now + 1.7);
      osc2.stop(now + 1.7);
      osc3.stop(now + 1.7);

      // Trigger hardware vibration if supported on device
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
        try {
          navigator.vibrate([400, 200, 400, 200, 800]);
        } catch {}
      }
    } catch (e) {
      console.warn("CallPendingOverlay Audio error:", e);
    }
  };

  // Trigger continuous audio loop while pending calls exist
  useEffect(() => {
    if (pendingCalls.length > 0 && !isMuted) {
      playDualToneRing();
      if (ringIntervalRef.current) clearInterval(ringIntervalRef.current);
      ringIntervalRef.current = setInterval(() => {
        playDualToneRing();
      }, 3500);

      // Log signaling event for ringtone triggering
      pendingCalls.forEach(call => {
        logSignalingEvent({
          callId: call.id,
          driverId: currentDriverId || call.driverId || 'central',
          eventType: 'ringtone_triggered',
          status: 'success',
          details: {
            passengerPhone: call.customerPhone || call.passengerPhone,
            pickup: call.pickupAddress,
            overlay: 'DriverDashboard_CallPending'
          }
        });
      });
    } else {
      if (ringIntervalRef.current) {
        clearInterval(ringIntervalRef.current);
        ringIntervalRef.current = null;
      }
    }

    return () => {
      if (ringIntervalRef.current) {
        clearInterval(ringIntervalRef.current);
        ringIntervalRef.current = null;
      }
    };
  }, [pendingCalls.length, isMuted, currentDriverId]);

  if (!pendingCalls || pendingCalls.length === 0) {
    return null;
  }

  const primaryCall = pendingCalls[0];
  const assignedDriver = drivers.find(d => d.id === (selectedDriverMap[primaryCall.id] || primaryCall.driverId || currentDriverId));

  const handleAcceptCall = async (call: any) => {
    setActionLoadingId(call.id);
    try {
      const targetDriverId = selectedDriverMap[call.id] || currentDriverId || call.driverId || 'assigned_driver';
      const targetDriver = drivers.find(d => d.id === targetDriverId) || { id: targetDriverId, name: call.driverName || 'Motorista de Turno', phone: '' };

      const callRef = doc(db, 'calls', call.id);
      await updateDoc(callRef, {
        status: 'accepted',
        acceptedAt: serverTimestamp(),
        driverId: targetDriverId,
        driverName: targetDriver.name,
        driverPhone: targetDriver.phone || call.driverPhone || '',
        responseHistory: arrayUnion({
          action: 'accepted_via_dashboard_overlay',
          timestamp: new Date().toISOString(),
          driverId: targetDriverId,
          driverName: targetDriver.name
        })
      });

      await logSignalingEvent({
        callId: call.id,
        driverId: targetDriverId,
        eventType: 'call_attended',
        status: 'success',
        details: {
          driverName: targetDriver.name,
          source: 'DriverDashboard_CallPendingOverlay'
        }
      });

      if (onCallHandled) onCallHandled();
    } catch (err: any) {
      console.error("Error accepting call in overlay:", err);
      alert("Erro ao atender chamada: " + (err?.message || err));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectCall = async (call: any) => {
    const reason = prompt("Motivo da recusa / cancelamento da chamada (opcional):", "Indisponível no momento");
    if (reason === null) return; // User cancelled prompt

    setActionLoadingId(call.id);
    try {
      const callRef = doc(db, 'calls', call.id);
      await updateDoc(callRef, {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
        cancellationReason: reason,
        responseHistory: arrayUnion({
          action: 'rejected_via_dashboard_overlay',
          reason,
          timestamp: new Date().toISOString()
        })
      });

      await logSignalingEvent({
        callId: call.id,
        driverId: currentDriverId || call.driverId || 'central',
        eventType: 'call_rejected',
        status: 'warning',
        details: {
          reason,
          source: 'DriverDashboard_CallPendingOverlay'
        }
      });

      if (onCallHandled) onCallHandled();
    } catch (err: any) {
      console.error("Error rejecting call in overlay:", err);
      alert("Erro ao recusar chamada: " + (err?.message || err));
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -40, scale: 0.95 }}
        className="fixed top-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-xl z-[9999] shadow-2xl rounded-3xl overflow-hidden border-2 border-amber-400 bg-slate-950/95 backdrop-blur-xl text-white ring-4 ring-amber-500/30 animate-pulse"
        id="driver_call_pending_overlay"
        style={{ animationDuration: '2s' }}
      >
        {/* TOP ALERT HEADER */}
        <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 px-5 py-3 text-slate-950 flex items-center justify-between font-black">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <span className="flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-950 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-slate-950"></span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <PhoneIncoming size={18} className="animate-bounce text-slate-950" />
              <span className="text-xs uppercase tracking-wider font-black">
                {pendingCalls.length > 1 
                  ? `🚨 ${pendingCalls.length} CHAMADAS PENDENTES NA FROTA!` 
                  : '🚨 CHAMADA A TOCAR / PEDIDO DE CORRIDA!'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-1.5 rounded-lg bg-slate-950/10 hover:bg-slate-950/20 text-slate-950 transition-colors text-xs flex items-center gap-1 font-bold"
              title={isMuted ? "Ativar Som" : "Silenciar Toque"}
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} className="animate-pulse" />}
              <span className="text-[10px] hidden sm:inline">{isMuted ? "MUDO" : "SOM ATIVO"}</span>
            </button>

            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1.5 rounded-lg bg-slate-950/10 hover:bg-slate-950/20 text-slate-950 transition-colors"
              title={isMinimized ? "Expandir Painel" : "Minimizar"}
            >
              {isMinimized ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
            </button>
          </div>
        </div>

        {/* BODY (COLLAPSIBLE) */}
        {!isMinimized && (
          <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
            {pendingCalls.map((call, idx) => {
              const passengerPhone = call.customerPhone || call.passengerPhone || '';
              const passengerName = call.customerName || call.passengerName || 'Passageiro de Luena';
              const pickup = call.pickupAddress || call.origin || 'Ponto no Luena';
              const destination = call.destination || call.dropoffAddress || 'Destino a definir';
              const price = call.price || call.requestedPrice || call.amount || null;
              const paymentMethod = call.paymentMethod || 'Dinheiro / TPA';

              return (
                <div 
                  key={call.id || idx}
                  className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3.5 relative overflow-hidden shadow-inner"
                >
                  {/* Glowing Radar Pulse Background */}
                  <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

                  {/* Header Row: Passenger & Waiting Timer */}
                  <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-black shrink-0 shadow-lg">
                        <User size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-sm text-white">{passengerName}</h4>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            {call.type === 'direct_referral' ? 'Reencaminhada' : 'Pedido de Viagem'}
                          </span>
                        </div>
                        {passengerPhone && (
                          <a 
                            href={`tel:${passengerPhone}`}
                            className="text-xs text-amber-400 hover:underline flex items-center gap-1 font-mono font-bold mt-0.5"
                          >
                            <Phone size={12} />
                            <span>+244 {passengerPhone.replace(/^\+?244/, '')}</span>
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-slate-400 uppercase font-black tracking-wider flex items-center justify-end gap-1">
                        <Clock size={12} className="text-amber-400" />
                        <span>Tempo de Espera:</span>
                      </div>
                      <div className="text-sm font-black font-mono text-amber-400">
                        <WaitingTimer timestamp={call.timestamp || call.createdAt} />
                      </div>
                    </div>
                  </div>

                  {/* Route & Tariff Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-black">
                        <MapPin size={12} className="text-emerald-400" />
                        <span>Origem (Ponto de Recolha):</span>
                      </div>
                      <p className="text-slate-200 font-bold line-clamp-1">{pickup}</p>
                    </div>

                    <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-black">
                        <Navigation size={12} className="text-cyan-400" />
                        <span>Destino:</span>
                      </div>
                      <p className="text-slate-200 font-bold line-clamp-1">{destination}</p>
                    </div>
                  </div>

                  {/* Price and Payment Method */}
                  <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 px-3.5 py-2 rounded-xl text-xs">
                    <div className="flex items-center gap-2">
                      <DollarSign size={16} className="text-amber-400" />
                      <span className="text-slate-300 font-bold">Tarifa Solicitada:</span>
                      <span className="text-amber-400 font-black font-mono text-sm">
                        {price ? `${Number(price).toLocaleString('pt-AO')} Kz` : 'A Negociar'}
                      </span>
                    </div>
                    <div className="text-[10px] font-black uppercase text-slate-400 bg-slate-950/80 px-2 py-1 rounded-lg border border-slate-800">
                      💳 {paymentMethod}
                    </div>
                  </div>

                  {/* Driver Assignment Dropdown (if Central or multiple drivers available) */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                    <div className="flex-1">
                      <label className="text-[10px] uppercase font-black text-slate-400 mb-1 block">
                        Viatura / Motorista Alocado:
                      </label>
                      <select
                        value={selectedDriverMap[call.id] || call.driverId || currentDriverId || ''}
                        onChange={(e) => setSelectedDriverMap(prev => ({ ...prev, [call.id]: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-amber-400"
                      >
                        <option value="">Atribuir ao Motorista Selecionado / Atual</option>
                        {drivers.map(d => (
                          <option key={d.id} value={d.id}>
                            {d.prefix ? `[${d.prefix}] ` : ''}{d.name} ({d.phone || 'Sem tel'})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* ACTION BUTTONS */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                    <button
                      onClick={() => handleAcceptCall(call)}
                      disabled={actionLoadingId === call.id}
                      className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                    >
                      {actionLoadingId === call.id ? (
                        <Radio size={16} className="animate-spin text-slate-950" />
                      ) : (
                        <CheckCircle2 size={18} className="text-slate-950" />
                      )}
                      <span>ATENDER / ACEITAR AGORA</span>
                    </button>

                    <button
                      onClick={() => handleRejectCall(call)}
                      disabled={actionLoadingId === call.id}
                      className="w-full py-3 px-4 bg-rose-500/10 hover:bg-rose-500/20 active:scale-95 text-rose-400 border border-rose-500/30 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <X size={16} />
                      <span>RECUSAR / CANCELAR</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* MINIMIZED BAR */}
        {isMinimized && (
          <div className="p-3 bg-slate-900/90 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 truncate">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span className="font-black text-amber-400 truncate">
                {primaryCall.customerName || 'Passageiro'} ({primaryCall.pickupAddress || 'Luena'})
              </span>
            </div>
            <button
              onClick={() => handleAcceptCall(primaryCall)}
              className="px-3 py-1.5 bg-emerald-500 text-slate-950 font-black rounded-lg text-[10px] uppercase tracking-wider shrink-0"
            >
              Atender
            </button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
