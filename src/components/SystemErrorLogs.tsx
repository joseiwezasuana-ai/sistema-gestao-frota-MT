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
  ChevronUp
} from 'lucide-react';
import { db, collection, query, orderBy, limit, onSnapshot, doc, updateDoc, deleteDoc, getDocs, writeBatch } from '../lib/firebase';
import { SystemErrorLog, logSystemError } from '../lib/errorLogger';

interface SystemErrorLogsProps {
  user?: any;
}

export default function SystemErrorLogs({ user }: SystemErrorLogsProps) {
  const [logs, setLogs] = useState<SystemErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'error' | 'warning'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'resolved'>('active');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

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

        // Merge with local backup logs if any offline logs exist
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
        // Fallback to local storage
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

  // Filter logs
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

  const totalLogs = logs.length;
  const criticalCount = logs.filter(l => l.severity === 'critical' && !l.resolved).length;
  const errorCount = logs.filter(l => l.severity === 'error' && !l.resolved).length;
  const resolvedCount = logs.filter(l => l.resolved).length;

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
                  Logs de Erros do Sistema (Auditoria Técnica)
                </h2>
                <span className="px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest bg-red-500/20 text-red-400 border border-red-500/30 rounded-full">
                  Exclusivo Admin
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Registo contínuo de falhas, exceções React e erros de rede capturados em tempo real para auditoria e manutenção técnica à distância pelo Administrador (JIS).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
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
          </div>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-3 animate-fade-in">
          <CheckCircle2 size={18} />
          {actionSuccess}
        </div>
      )}

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
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">Exceções Padrão</p>
            <p className="text-2xl font-black text-amber-400 mt-1">{errorCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
            <AlertTriangle size={20} />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-emerald-500/30 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Erros Resolvidos</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">{resolvedCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
        </div>
      </div>

      {/* Control Toolbar (Search & Filters) */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input
            type="text"
            placeholder="Pesquisar por erro, utilizador ou código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${statusFilter === 'active' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}
            >
              Pendentes
            </button>
            <button
              onClick={() => setStatusFilter('resolved')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${statusFilter === 'resolved' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}
            >
              Resolvidos
            </button>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${statusFilter === 'all' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              Todos
            </button>
          </div>

          {/* Severity Selector */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 font-bold focus:outline-none focus:border-amber-500/50"
          >
            <option value="all">Todas Severidades</option>
            <option value="critical">Apenas Críticos</option>
            <option value="error">Erros Padrão</option>
            <option value="warning">Avisos / Unhandled</option>
          </select>
        </div>
      </div>

      {/* Error Logs List */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="animate-spin text-amber-500" size={32} />
            <p className="text-xs font-bold uppercase tracking-wider">A carregar registos de erro em tempo real...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
            <CheckCircle2 size={40} className="text-emerald-400 opacity-60" />
            <p className="text-sm font-bold text-white uppercase tracking-wider">Nenhum log de erro encontrado</p>
            <p className="text-xs text-slate-400">
              {statusFilter === 'active' ? 'Excelente! Não existem falhas ativas de momento no sistema.' : 'Nenhum registo corresponde aos filtros selecionados.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {filteredLogs.map((log, index) => {
              const isExpanded = expandedId === (log.id || log.timestamp);
              const isCritical = log.severity === 'critical';
              const isWarning = log.severity === 'warning';

              return (
                <div 
                  key={log.id || index}
                  className={`transition-colors ${log.resolved ? 'bg-slate-950/40 opacity-75' : 'hover:bg-slate-800/40'}`}
                >
                  <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Log Main Title & Badge */}
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold mt-0.5 ${
                        log.resolved ? 'bg-emerald-500/20 text-emerald-400' :
                        isCritical ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse' :
                        isWarning ? 'bg-amber-500/20 text-amber-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {log.resolved ? <CheckCircle2 size={18} /> : isCritical ? <ShieldAlert size={18} /> : <AlertTriangle size={18} />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                            isCritical ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                            isWarning ? 'bg-amber-500/20 text-amber-400' :
                            'bg-blue-500/20 text-blue-400'
                          }`}>
                            {log.severity || 'erro'}
                          </span>

                          <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                            <Clock size={12} />
                            {new Date(log.timestamp).toLocaleString('pt-PT')}
                          </span>

                          {log.userName && (
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
    </div>
  );
}
