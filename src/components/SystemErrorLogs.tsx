import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  Trash2, 
  RefreshCw, 
  Search, 
  Filter, 
  Copy, 
  Check, 
  Terminal, 
  User, 
  Globe, 
  Clock, 
  Bug,
  Download,
  XCircle,
  ChevronDown,
  ChevronUp,
  PhoneCall,
  Radio,
  BellRing,
  Volume2,
  VolumeX,
  Smartphone,
  Send,
  Zap,
  Info,
  Car
} from 'lucide-react';
import { db, collection, query, orderBy, limit, onSnapshot, doc, updateDoc, deleteDoc, getDocs, writeBatch } from '../lib/firebase';
import { SystemErrorLog, logSystemError, logFcmDeliveryError } from '../lib/errorLogger';
import { SignalingLog, logSignalingEvent, getLocalSignalingLogs } from '../lib/signalingLogger';

interface SystemErrorLogsProps {
  user?: any;
}

export default function SystemErrorLogs({ user }: SystemErrorLogsProps) {
  const [activeTab, setActiveTab] = useState<'system_errors' | 'communication_logs'>('system_errors');

  // System Error Logs States
  const [logs, setLogs] = useState<SystemErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'error' | 'warning'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'resolved'>('active');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Communication & Signaling Logs States
  const [signalingLogs, setSignalingLogs] = useState<SignalingLog[]>([]);
  const [signalingLoading, setSignalingLoading] = useState(true);
  const [signalingSearch, setSignalingSearch] = useState('');
  const [signalingEventFilter, setSignalingEventFilter] = useState<string>('all');
  const [signalingStatusFilter, setSignalingStatusFilter] = useState<string>('all');
  const [expandedSignalingId, setExpandedSignalingId] = useState<string | null>(null);

  // Load System Error Logs
  useEffect(() => {
    setLoading(true);
    let unsub = () => {};

    if (db) {
      const q = query(
        collection(db, 'system_error_logs'),
        orderBy('createdAt', 'desc'),
        limit(150)
      );

      unsub = onSnapshot(q, (snapshot) => {
        const firestoreLogs: SystemErrorLog[] = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        })) as any;

        let merged = [...firestoreLogs];
        try {
          const backupStr = localStorage.getItem('taxi_system_error_logs_backup');
          if (backupStr) {
            const backups: SystemErrorLog[] = JSON.parse(backupStr);
            backups.forEach(b => {
              if (!merged.some(m => m.timestamp === b.timestamp && m.message === b.message)) {
                merged.push(b);
              }
            });
          }
        } catch {}

        setLogs(merged);
        setLoading(false);
      }, (err) => {
        console.warn('Firestore error logs listener failed, using local backup:', err);
        try {
          const backupStr = localStorage.getItem('taxi_system_error_logs_backup');
          if (backupStr) {
            setLogs(JSON.parse(backupStr));
          }
        } catch {}
        setLoading(false);
      });
    }

    return () => unsub();
  }, []);

  // Load Signaling & Communication Logs
  useEffect(() => {
    setSignalingLoading(true);
    let unsub = () => {};

    if (db) {
      const q = query(
        collection(db, 'signaling_logs'),
        orderBy('createdAt', 'desc'),
        limit(150)
      );

      unsub = onSnapshot(q, (snapshot) => {
        const firestoreLogs: SignalingLog[] = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        })) as any;

        let merged = [...firestoreLogs];
        const localBackups = getLocalSignalingLogs();
        localBackups.forEach(b => {
          if (!merged.some(m => m.timestamp === b.timestamp && m.message === b.message)) {
            merged.push(b);
          }
        });

        setSignalingLogs(merged);
        setSignalingLoading(false);
      }, (err) => {
        console.warn('Firestore signaling logs listener failed, using local fallback:', err);
        setSignalingLogs(getLocalSignalingLogs());
        setSignalingLoading(false);
      });
    } else {
      setSignalingLogs(getLocalSignalingLogs());
      setSignalingLoading(false);
    }

    return () => unsub();
  }, []);

  const triggerToast = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 3000);
  };

  const toggleResolve = async (log: SystemErrorLog) => {
    if (!log.id || !db) return;
    try {
      const newStatus = !log.resolved;
      await updateDoc(doc(db, 'system_error_logs', log.id), {
        resolved: newStatus,
        resolvedAt: new Date().toISOString(),
        resolvedBy: user?.name || user?.email || 'Admin'
      });
      triggerToast(newStatus ? 'Log marcado como resolvido!' : 'Log reaberto com sucesso!');
    } catch (e: any) {
      triggerToast('Erro ao atualizar log: ' + (e?.message || 'Falha de conexão'));
    }
  };

  const deleteSingleLog = async (logId?: string) => {
    if (!logId || !db) return;
    try {
      await deleteDoc(doc(db, 'system_error_logs', logId));
      triggerToast('Log de erro eliminado com sucesso.');
    } catch (e: any) {
      triggerToast('Erro ao eliminar log: ' + (e?.message || 'Falha de permissão'));
    }
  };

  const clearResolvedLogs = async () => {
    const resolvedLogs = logs.filter(l => l.resolved && l.id);
    if (resolvedLogs.length === 0) {
      triggerToast('Não existem logs resolvidos para eliminar.');
      return;
    }

    try {
      const batch = writeBatch(db);
      resolvedLogs.forEach(l => {
        if (l.id) batch.delete(doc(db, 'system_error_logs', l.id));
      });
      await batch.commit();
      triggerToast(`${resolvedLogs.length} log(s) resolvido(s) limpo(s) com sucesso!`);
    } catch (e: any) {
      triggerToast('Falha ao limpar logs: ' + (e?.message || 'Erro de rede'));
    }
  };

  const handleSimulateError = () => {
    logSystemError({
      message: 'Diagnóstico de Teste Manual executado pelo Administrador (JIS)',
      stack: 'Error: Teste de Integridade de Logs de Sistema\n at SystemErrorLogs.tsx:120:15\n at React.Component.render',
      componentStack: 'in SystemErrorLogs\n in Dashboard\n in App',
      severity: 'warning'
    });
    triggerToast('Log de erro de teste gerado com sucesso!');
  };

  const handleSimulateFcmDeliveryError = async () => {
    const serverTimestampStr = new Date().toISOString();
    const testDriverId = user?.driverId || user?.id || 'DRV-LUENA-042';
    const testCallId = `call_${Date.now()}`;

    await logFcmDeliveryError({
      driverId: testDriverId,
      serverCallReceivedTimestamp: serverTimestampStr,
      callId: testCallId,
      errorMessage: 'Falha no envio FCM: Token de registo FCM expirado ou dispositivo do motorista em suspensão',
      failureReason: 'Token inválido (UNREGISTERED) ou navegador em suspensão profunda',
      fcmToken: 'fcm_test_tok_' + Math.random().toString(36).substring(2, 10),
      metadata: {
        networkType: typeof navigator !== 'undefined' && 'connection' in navigator ? (navigator as any).connection?.effectiveType : '4g',
        driverName: user?.name || 'Manuel António (Táxi 04)',
        vehiclePlate: 'LDA-44-22-PX'
      }
    });

    await logSignalingEvent({
      eventType: 'push_failed',
      status: 'failure',
      message: `Falha na entrega de notificação push FCM para motorista ${testDriverId}`,
      driverId: testDriverId,
      driverName: user?.name || 'Manuel António (Táxi 04)',
      callId: testCallId,
      serverCallReceivedTimestamp: serverTimestampStr,
      failureReason: 'Dispositivo inacessível no momento do disparo de call_received',
      vehiclePlate: 'LDA-44-22-PX',
      details: {
        serverCallReceivedTimestamp: serverTimestampStr,
        channel: 'fcm_webpush',
        batteryOptimization: 'enabled'
      }
    });

    triggerToast(`Registo de erro FCM capturado para o motorista ${testDriverId}!`);
  };

  const handleSimulateSignalingEvent = async () => {
    await logSignalingEvent({
      eventType: 'call_received',
      status: 'success',
      message: 'Sinal de chamada recebido com sucesso no terminal do motorista.',
      driverName: user?.name || 'Motorista de Turno',
      passengerName: 'Passageiro de Teste',
      passengerPhone: '+244 923 000 111',
      details: {
        audioUnlocked: true,
        ringtoneType: 'voice_supertaxi',
        notificationPermission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
      }
    });
    triggerToast('Evento de sinalização de teste registado com sucesso!');
  };

  const clearSignalingLogsHandler = async () => {
    try {
      localStorage.removeItem('taxi_signaling_communication_logs_backup');
      if (db && signalingLogs.length > 0) {
        const batch = writeBatch(db);
        signalingLogs.slice(0, 50).forEach(l => {
          if (l.id) batch.delete(doc(db, 'signaling_logs', l.id));
        });
        await batch.commit();
      }
      setSignalingLogs([]);
      triggerToast('Logs de comunicação limpos com sucesso.');
    } catch (e: any) {
      triggerToast('Erro ao limpar logs de sinalização: ' + (e?.message || 'Erro'));
    }
  };

  const copyDiagnostic = (log: SystemErrorLog) => {
    const text = `🚨 *RELATÓRIO DE ERRO - TAXICONTROL (JIS)*\n` +
      `📅 *Data*: ${new Date(log.timestamp).toLocaleString('pt-PT')}\n` +
      `⚠️ *Severidade*: ${log.severity?.toUpperCase()}\n` +
      `👤 *Utilizador*: ${log.userName || log.userEmail || 'N/A'}\n` +
      `🌐 *URL*: ${log.url || 'N/A'}\n` +
      `❌ *Mensagem*: ${log.message}\n` +
      `🔍 *Stack Trace*:\n${log.stack ? log.stack.slice(0, 300) : 'Sem stack trace'}`;

    navigator.clipboard.writeText(text);
    setCopiedId(log.id || log.timestamp);
    setTimeout(() => setCopiedId(null), 2500);
    triggerToast('Diagnóstico copiado para a área de transferência!');
  };

  const copySignalingDiagnostic = (log: SignalingLog) => {
    const text = `📡 *LOG DE SINALIZAÇÃO / COMUNICAÇÃO - SUPER TÁXI*\n` +
      `📅 *Data*: ${new Date(log.timestamp).toLocaleString('pt-PT')}\n` +
      `🔔 *Evento*: ${log.eventType}\n` +
      `📊 *Estado*: ${log.status.toUpperCase()}\n` +
      `🚗 *Motorista*: ${log.driverName || 'N/A'}\n` +
      `👤 *Passageiro*: ${log.passengerName || 'N/A'} (${log.passengerPhone || 'N/A'})\n` +
      `📝 *Mensagem*: ${log.message}\n` +
      `${log.failureReason ? `⚠️ *Causa da Falha*: ${log.failureReason}\n` : ''}` +
      `📦 *Detalhes*: ${JSON.stringify(log.details || {})}`;

    navigator.clipboard.writeText(text);
    setCopiedId(log.id || log.timestamp);
    setTimeout(() => setCopiedId(null), 2500);
    triggerToast('Log de sinalização copiado!');
  };

  // Filter system logs
  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      (log.message || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.userName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.userEmail || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.stack || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSeverity = severityFilter === 'all' ? true : log.severity === severityFilter;
    const matchesStatus = 
      statusFilter === 'all' ? true : 
      statusFilter === 'resolved' ? log.resolved === true : 
      !log.resolved;

    return matchesSearch && matchesSeverity && matchesStatus;
  });

  // Filter signaling logs
  const filteredSignalingLogs = signalingLogs.filter(log => {
    const searchLower = signalingSearch.toLowerCase();
    const matchesSearch = 
      (log.message || '').toLowerCase().includes(searchLower) ||
      (log.driverName || '').toLowerCase().includes(searchLower) ||
      (log.passengerName || '').toLowerCase().includes(searchLower) ||
      (log.passengerPhone || '').toLowerCase().includes(searchLower) ||
      (log.vehiclePlate || '').toLowerCase().includes(searchLower) ||
      (log.failureReason || '').toLowerCase().includes(searchLower);

    const matchesEvent = signalingEventFilter === 'all' ? true : log.eventType === signalingEventFilter;
    const matchesStatus = signalingStatusFilter === 'all' ? true : log.status === signalingStatusFilter;

    return matchesSearch && matchesEvent && matchesStatus;
  });

  const totalLogs = logs.length;
  const criticalCount = logs.filter(l => l.severity === 'critical' && !l.resolved).length;
  const errorCount = logs.filter(l => l.severity === 'error' && !l.resolved).length;
  const resolvedCount = logs.filter(l => l.resolved).length;

  // Signaling Stats
  const totalSignaling = signalingLogs.length;
  const signalingSuccessCount = signalingLogs.filter(l => l.status === 'success').length;
  const signalingFailureCount = signalingLogs.filter(l => l.status === 'failure').length;
  const ringtoneTriggersCount = signalingLogs.filter(l => l.eventType === 'ringtone_triggered' || l.eventType === 'call_received').length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-red-600 to-amber-500 p-0.5 shadow-lg shadow-red-500/20 flex items-center justify-center shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <ShieldAlert className="text-red-400" size={24} />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black uppercase tracking-wider text-white">
                  Auditoria & Diagnóstico do Sistema (JIS)
                </h2>
                <span className="px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest bg-red-500/20 text-red-400 border border-red-500/30 rounded-full">
                  Exclusivo Admin
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Registo contínuo de falhas, exceções React e monitorização de sinalização em tempo real (chamadas, toques e notificações móveis) para auditoria e manutenção à distância.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeTab === 'system_errors' ? (
              <>
                <button
                  onClick={handleSimulateFcmDeliveryError}
                  className="px-3.5 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 rounded-xl font-bold text-xs flex items-center gap-2 transition-all active:scale-95"
                  title="Simular falha de envio FCM ao motorista"
                >
                  <Smartphone size={14} className="text-rose-400" />
                  Testar Falha FCM
                </button>
                <button
                  onClick={handleSimulateError}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-bold text-xs flex items-center gap-2 transition-all active:scale-95"
                  title="Gerar log de teste"
                >
                  <Bug size={14} className="text-amber-400" />
                  Testar Registador
                </button>
                <button
                  onClick={clearResolvedLogs}
                  className="px-3.5 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl font-bold text-xs flex items-center gap-2 transition-all active:scale-95"
                >
                  <Trash2 size={14} />
                  Limpar Resolvidos
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleSimulateFcmDeliveryError}
                  className="px-3.5 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 rounded-xl font-bold text-xs flex items-center gap-2 transition-all active:scale-95"
                  title="Simular falha de envio FCM ao motorista"
                >
                  <Smartphone size={14} className="text-rose-400" />
                  Testar Falha FCM
                </button>
                <button
                  onClick={handleSimulateSignalingEvent}
                  className="px-3.5 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-xl font-bold text-xs flex items-center gap-2 transition-all active:scale-95"
                  title="Simular sinal de chamada"
                >
                  <Radio size={14} className="animate-pulse" />
                  Testar Sinalização
                </button>
                <button
                  onClick={clearSignalingLogsHandler}
                  className="px-3.5 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl font-bold text-xs flex items-center gap-2 transition-all active:scale-95"
                >
                  <Trash2 size={14} />
                  Limpar Sinalização
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Subtabs */}
      <div className="flex items-center gap-3 p-1.5 bg-slate-900/90 rounded-2xl border border-slate-800 w-fit">
        <button
          onClick={() => setActiveTab('system_errors')}
          className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all ${
            activeTab === 'system_errors'
              ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Terminal size={14} />
          Erros do Sistema React & API ({totalLogs})
        </button>
        <button
          onClick={() => setActiveTab('communication_logs')}
          className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all ${
            activeTab === 'communication_logs'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Radio size={14} className="animate-pulse" />
          📡 Logs de Comunicação & Sinalização ({totalSignaling})
        </button>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-3 animate-fade-in">
          <CheckCircle2 size={18} />
          {actionSuccess}
        </div>
      )}

      {/* TAB 1: SYSTEM ERRORS */}
      {activeTab === 'system_errors' && (
        <>
          {/* KPI Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total de Registos</p>
                <p className="text-2xl font-black text-white mt-1">{totalLogs}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center">
                <Terminal size={20} />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-red-500/30 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-red-400">Erros Críticos Pendentes</p>
                <p className="text-2xl font-black text-red-400 mt-1">{criticalCount}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center">
                <ShieldAlert size={20} />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-amber-500/30 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">Erros Moderados</p>
                <p className="text-2xl font-black text-amber-400 mt-1">{errorCount}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <AlertTriangle size={20} />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-emerald-500/30 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Resolvidos</p>
                <p className="text-2xl font-black text-emerald-400 mt-1">{resolvedCount}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 size={20} />
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                type="text"
                placeholder="Pesquisar por mensagem, stack trace, utilizador..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
                <span className="text-slate-500 font-bold px-2 text-[10px] uppercase">Severidade:</span>
                {(['all', 'critical', 'error', 'warning'] as const).map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setSeverityFilter(sev)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] uppercase transition-colors ${
                      severityFilter === sev
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {sev === 'all' ? 'Todos' : sev}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
                <span className="text-slate-500 font-bold px-2 text-[10px] uppercase">Estado:</span>
                {(['all', 'active', 'resolved'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] uppercase transition-colors ${
                      statusFilter === st
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {st === 'all' ? 'Todos' : st === 'active' ? 'Ativos' : 'Resolvidos'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Logs List */}
          <div className="space-y-3">
            {loading ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <RefreshCw size={24} className="animate-spin mx-auto text-red-500" />
                <p className="text-xs font-bold">A carregar registos de erro do sistema...</p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-12 text-center rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
                <CheckCircle2 size={32} className="mx-auto text-emerald-400 opacity-80" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Nenhum Registo Encontrado</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Excelente! O sistema não registou nenhuma exceção não tratada ou erro pendente correspondente aos filtros.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredLogs.map((log) => {
                  const isExpanded = expandedId === (log.id || log.timestamp);
                  return (
                    <div 
                      key={log.id || log.timestamp}
                      className={`rounded-2xl border transition-all overflow-hidden ${
                        log.resolved
                          ? 'bg-slate-900/40 border-slate-800/60 opacity-70'
                          : log.severity === 'critical'
                          ? 'bg-red-950/20 border-red-500/40 shadow-lg shadow-red-950/30'
                          : log.severity === 'error'
                          ? 'bg-slate-900 border-red-500/20'
                          : 'bg-slate-900 border-amber-500/20'
                      }`}
                    >
                      <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 p-2 rounded-xl shrink-0 ${
                            log.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                            log.severity === 'error' ? 'bg-red-500/10 text-red-400' :
                            'bg-amber-500/10 text-amber-400'
                          }`}>
                            {log.severity === 'critical' ? <ShieldAlert size={18} /> : <AlertTriangle size={18} />}
                          </div>

                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {log.logCategory === 'fcm_delivery' ? (
                                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-rose-500 text-white flex items-center gap-1 shadow-sm">
                                  <Smartphone size={10} />
                                  FCM PUSH ERROR
                                </span>
                              ) : (
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                  log.severity === 'critical' ? 'bg-red-500 text-white' :
                                  log.severity === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                  'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                }`}>
                                  {log.severity}
                                </span>
                              )}

                              <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                                <Clock size={12} />
                                {new Date(log.timestamp).toLocaleString('pt-PT')}
                              </span>

                              {log.driverId && (
                                <span className="text-[10px] text-amber-300 font-black bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded flex items-center gap-1">
                                  <Car size={10} className="text-amber-400" />
                                  Motorista: {log.driverId}
                                </span>
                              )}

                              {log.serverCallReceivedTimestamp && (
                                <span className="text-[9px] text-purple-300 font-mono bg-purple-500/20 border border-purple-500/30 px-2 py-0.5 rounded flex items-center gap-1" title="Momento exato do evento call_received no servidor">
                                  <Radio size={9} className="text-purple-400" />
                                  Server Rx: {new Date(log.serverCallReceivedTimestamp).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 } as any)}
                                </span>
                              )}

                              {log.userName && !log.driverId && (
                                <span className="text-[10px] text-slate-400 font-bold bg-slate-800/80 px-2 py-0.5 rounded flex items-center gap-1">
                                  <User size={10} />
                                  {log.userName}
                                </span>
                              )}

                              {log.resolved && (
                                <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">
                                  Resolvido
                                </span>
                              )}
                            </div>

                            <p className="text-xs font-bold text-white mt-1.5 break-words font-mono">
                              {log.message}
                            </p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                          <button
                            onClick={() => copyDiagnostic(log)}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                            title="Copiar relatório para suporte"
                          >
                            {copiedId === (log.id || log.timestamp) ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                          </button>

                          {log.id && (
                            <button
                              onClick={() => toggleResolve(log)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                                log.resolved 
                                  ? 'bg-slate-800 text-slate-400 hover:text-white' 
                                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                              }`}
                            >
                              <CheckCircle2 size={14} />
                              {log.resolved ? 'Reabrir' : 'Marcar Resolvido'}
                            </button>
                          )}

                          {log.id && (
                            <button
                              onClick={() => deleteSingleLog(log.id)}
                              className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                              title="Eliminar log"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}

                          <button
                            onClick={() => setExpandedId(isExpanded ? null : (log.id || log.timestamp))}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>
                      </div>

                      {/* Expanded Technical Details Drawer */}
                      {isExpanded && (
                        <div className="px-6 pb-6 pt-2 bg-slate-950/80 border-t border-slate-800/80 space-y-4 font-mono text-xs">
                          {(log.logCategory === 'fcm_delivery' || log.driverId || log.serverCallReceivedTimestamp) && (
                            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-2 text-[11px] font-sans">
                              <h5 className="font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5 text-xs">
                                <Smartphone size={14} />
                                Metadados de Entrega FCM (Firebase Cloud Messaging)
                              </h5>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-slate-300">
                                <div>
                                  <span className="text-slate-500 block text-[10px]">ID do Motorista Alvo:</span>
                                  <span className="font-mono text-amber-300 font-bold">{log.driverId || 'Não especificado'}</span>
                                </div>
                                <div>
                                  <span className="text-slate-500 block text-[10px]">Timestamp 'call_received' no Servidor:</span>
                                  <span className="font-mono text-purple-300 font-bold">
                                    {log.serverCallReceivedTimestamp ? `${new Date(log.serverCallReceivedTimestamp).toISOString()}` : 'N/A'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-500 block text-[10px]">Motivo / Causa da Falha:</span>
                                  <span className="text-red-300 font-bold">{log.failureReason || 'Token FCM inválido/expirado ou falha de rede'}</span>
                                </div>
                              </div>
                              {log.fcmToken && (
                                <div className="text-[10px] text-slate-400 font-mono break-all pt-1 border-t border-rose-500/20">
                                  <span className="text-slate-500">Token FCM: </span>{log.fcmToken}
                                </div>
                              )}
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] font-sans text-slate-400">
                            <div>
                              <strong className="text-slate-300 block mb-1">Contexto do Utilizador:</strong>
                              <p>E-mail: {log.userEmail || 'N/A'}</p>
                              <p>Nome: {log.userName || 'N/A'}</p>
                              <p>Tenant ID: {log.tenantId || 'jis'}</p>
                            </div>
                            <div>
                              <strong className="text-slate-300 block mb-1">Dispositivo / Ambiente:</strong>
                              <p className="truncate">URL: {log.url || 'N/A'}</p>
                              <p className="truncate text-[10px] text-slate-500">Agente: {log.userAgent || 'N/A'}</p>
                            </div>
                          </div>

                          {log.stack && (
                            <div>
                              <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1 font-sans">
                                Call Stack Trace:
                              </p>
                              <pre className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 overflow-x-auto text-[10px] leading-relaxed whitespace-pre-wrap break-all">
                                {log.stack}
                              </pre>
                            </div>
                          )}

                          {log.componentStack && (
                            <div>
                              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1 font-sans">
                                React Component Tree Stack:
                              </p>
                              <pre className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 overflow-x-auto text-[10px] leading-relaxed whitespace-pre-wrap break-all">
                                {log.componentStack}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* TAB 2: COMMUNICATION & SIGNALING LOGS */}
      {activeTab === 'communication_logs' && (
        <div className="space-y-6">
          {/* Diagnostic Explanations Callout */}
          <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-4 text-left">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl shrink-0">
              <Radio size={20} className="animate-pulse" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-2">
                Diagnóstico de Toque & Chamadas Móveis no Luena
              </h4>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Este registo monitoriza cada passo do ciclo de sinalização: criação da chamada pelo passageiro (<code className="text-amber-300">call_initiated</code>), deteção no telemóvel do motorista (<code className="text-amber-300">call_received</code>), disparo do toque contínuo/sintetizador (<code className="text-amber-300">ringtone_triggered</code>), e resposta do motorista. Se o telemóvel não tocar, verifique se o áudio foi desbloqueado com um toque no ecrã ou se o motorista está com status ativo.
              </p>
            </div>
          </div>

          {/* KPI Stats for Signaling */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total de Sinalizações</p>
                <p className="text-2xl font-black text-white mt-1">{totalSignaling}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center">
                <Radio size={20} />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-emerald-500/30 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Sinalizações com Sucesso</p>
                <p className="text-2xl font-black text-emerald-400 mt-1">{signalingSuccessCount}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 size={20} />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-amber-500/30 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">Toques & Alertas Disparados</p>
                <p className="text-2xl font-black text-amber-400 mt-1">{ringtoneTriggersCount}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <BellRing size={20} />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-red-500/30 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-red-400">Falhas de Entrega</p>
                <p className="text-2xl font-black text-red-400 mt-1">{signalingFailureCount}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center">
                <VolumeX size={20} />
              </div>
            </div>
          </div>

          {/* Filter Bar for Signaling */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                type="text"
                placeholder="Pesquisar por motorista, passageiro, telefone ou matrícula..."
                value={signalingSearch}
                onChange={(e) => setSignalingSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
                <span className="text-slate-500 font-bold px-2 text-[10px] uppercase">Evento:</span>
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'call_initiated', label: 'Iniciado' },
                  { id: 'call_received', label: 'Recebido' },
                  { id: 'ringtone_triggered', label: 'Toque' },
                  { id: 'call_attended', label: 'Atendido' },
                ].map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => setSignalingEventFilter(ev.id)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] uppercase transition-colors ${
                      signalingEventFilter === ev.id
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {ev.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
                <span className="text-slate-500 font-bold px-2 text-[10px] uppercase">Estado:</span>
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'success', label: 'Sucesso' },
                  { id: 'failure', label: 'Falha' },
                  { id: 'warning', label: 'Aviso' }
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setSignalingStatusFilter(st.id)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] uppercase transition-colors ${
                      signalingStatusFilter === st.id
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Signaling Logs List */}
          <div className="space-y-3">
            {signalingLoading ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <RefreshCw size={24} className="animate-spin mx-auto text-amber-500" />
                <p className="text-xs font-bold">A carregar registos de sinalização...</p>
              </div>
            ) : filteredSignalingLogs.length === 0 ? (
              <div className="p-12 text-center rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
                <Radio size={32} className="mx-auto text-amber-400 opacity-60" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Nenhum Registo de Sinalização</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Ainda não foram registados eventos de sinalização recentes ou nenhum corresponde aos filtros atuais.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSignalingLogs.map((log) => {
                  const isExpanded = expandedSignalingId === (log.id || log.timestamp);
                  return (
                    <div
                      key={log.id || log.timestamp}
                      className={`rounded-2xl border transition-all overflow-hidden ${
                        log.status === 'failure'
                          ? 'bg-red-950/20 border-red-500/40 shadow-lg shadow-red-950/30'
                          : log.status === 'warning'
                          ? 'bg-amber-950/20 border-amber-500/30'
                          : 'bg-slate-900 border-slate-800'
                      }`}
                    >
                      <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 p-2 rounded-xl shrink-0 ${
                            log.status === 'failure' ? 'bg-red-500/20 text-red-400' :
                            log.status === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-emerald-500/20 text-emerald-400'
                          }`}>
                            {log.eventType === 'ringtone_triggered' ? <BellRing size={18} /> :
                             log.eventType === 'call_attended' ? <PhoneCall size={18} /> :
                             log.eventType === 'push_failed' || log.status === 'failure' ? <VolumeX size={18} /> :
                             <Radio size={18} />}
                          </div>

                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                log.status === 'failure' ? 'bg-red-500 text-white' :
                                log.status === 'warning' ? 'bg-amber-500 text-slate-950' :
                                'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              }`}>
                                {log.eventType}
                              </span>

                              <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                                <Clock size={12} />
                                {new Date(log.timestamp).toLocaleString('pt-PT')}
                              </span>

                              {log.driverName && (
                                <span className="text-[10px] text-slate-300 font-bold bg-slate-800 px-2 py-0.5 rounded flex items-center gap-1">
                                  <Car size={11} className="text-amber-400" />
                                  Motorista: {log.driverName}
                                </span>
                              )}

                              {log.passengerName && (
                                <span className="text-[10px] text-slate-300 font-bold bg-slate-800 px-2 py-0.5 rounded flex items-center gap-1">
                                  <User size={10} className="text-blue-400" />
                                  Passageiro: {log.passengerName}
                                </span>
                              )}
                            </div>

                            <p className="text-xs font-bold text-white mt-1.5 break-words font-mono">
                              {log.message}
                            </p>

                            {log.failureReason && (
                              <p className="text-[11px] font-semibold text-red-400 bg-red-500/10 p-1.5 rounded-lg border border-red-500/20 mt-1">
                                ⚠️ Causa da Falha: {log.failureReason}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                          <button
                            onClick={() => copySignalingDiagnostic(log)}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                            title="Copiar log de sinalização"
                          >
                            {copiedId === (log.id || log.timestamp) ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                          </button>

                          <button
                            onClick={() => setExpandedSignalingId(isExpanded ? null : (log.id || log.timestamp))}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>
                      </div>

                      {/* Technical Details */}
                      {isExpanded && (
                        <div className="px-6 pb-6 pt-2 bg-slate-950/80 border-t border-slate-800/80 space-y-3 font-mono text-xs text-left">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] font-sans text-slate-400">
                            <div>
                              <strong className="text-slate-300 block mb-1">ID da Chamada:</strong>
                              <p className="font-mono text-amber-400">{log.callId || 'N/A'}</p>
                            </div>
                            <div>
                              <strong className="text-slate-300 block mb-1">Passageiro / Contacto:</strong>
                              <p>{log.passengerName || 'N/A'} ({log.passengerPhone || 'N/A'})</p>
                            </div>
                            <div>
                              <strong className="text-slate-300 block mb-1">Matrícula / Viatura:</strong>
                              <p>{log.vehiclePlate || 'N/A'}</p>
                            </div>
                          </div>

                          {log.details && Object.keys(log.details).length > 0 && (
                            <div>
                              <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1 font-sans">
                                Metadados de Sinalização:
                              </p>
                              <pre className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 overflow-x-auto text-[10px] leading-relaxed whitespace-pre-wrap break-all">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
