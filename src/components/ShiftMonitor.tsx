import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Car, 
  User, 
  Phone, 
  Power, 
  AlertTriangle, 
  CheckCircle2, 
  Search, 
  History, 
  Calendar, 
  ShieldAlert, 
  Send,
  RefreshCw,
  LogOut,
  LogIn,
  Filter,
  Smartphone
} from 'lucide-react';
import { db, collection, query, orderBy, limit, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, getActiveTenantId } from '../lib/firebase';
import DriverSessionShiftAudit from './DriverSessionShiftAudit';

interface ShiftMonitorProps {
  user?: any;
}

export default function ShiftMonitor({ user }: ShiftMonitorProps) {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [shiftLogs, setShiftLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'current' | 'history' | 'session_audit'>('current');
  const [filterShiftState, setFilterShiftState] = useState<'all' | 'online' | 'offline'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    let unsubDrivers = () => {};
    let unsubLogs = () => {};

    if (db) {
      // 1. Listen to drivers collection
      const qDrivers = query(collection(db, 'drivers'));
      unsubDrivers = onSnapshot(qDrivers, (snapshot) => {
        const list = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        setDrivers(list);
        setLoading(false);
      }, (e) => {
        console.warn('Error fetching drivers for shift monitor:', e);
        setLoading(false);
      });

      // 2. Listen to driver shift logs history
      const qLogs = query(collection(db, 'driver_shift_logs'), orderBy('timestamp', 'desc'), limit(50));
      unsubLogs = onSnapshot(qLogs, (snapshot) => {
        const logs = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        setShiftLogs(logs);
      }, (e) => {
        console.warn('Error fetching shift logs:', e);
      });
    }

    return () => {
      unsubDrivers();
      unsubLogs();
    };
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Force-end a driver shift remotely from central admin
  const handleForceEndShift = async (driver: any) => {
    if (!driver.id || !db) return;
    const confirmMsg = `Confirma o encerramento FORÇADO do turno do motorista ${driver.name || driver.prefix} (${driver.prefix})?`;
    if (!confirm(confirmMsg)) return;

    try {
      const nowIso = new Date().toISOString();
      await updateDoc(doc(db, 'drivers', driver.id), {
        status: 'indisponível',
        shiftActive: false,
        lastShiftEndedAt: nowIso,
        lastShiftEndedBy: `Central (${user?.name || 'Admin'})`
      });

      await addDoc(collection(db, 'driver_shift_logs'), {
        driverId: driver.id,
        driverName: driver.name || 'Motorista',
        prefix: driver.prefix || 'N/A',
        action: 'END_SHIFT_REMOTE',
        timestamp: nowIso,
        operator: user?.name || user?.email || 'Admin Central',
        tenantId: getActiveTenantId() || 'jis'
      });

      triggerToast(`Turno de ${driver.name || driver.prefix} encerrado remotamente com sucesso!`);
    } catch (e: any) {
      alert('Erro ao encerrar turno: ' + e.message);
    }
  };

  // Helper to format duration string
  const getElapsedDuration = (startedIso?: string) => {
    if (!startedIso) return 'N/A';
    const start = new Date(startedIso).getTime();
    if (isNaN(start)) return 'N/A';

    const diffMs = Date.now() - start;
    if (diffMs < 0) return 'Recentemente';

    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    if (hours === 0) return `${mins} min`;
    return `${hours}h ${mins}m`;
  };

  const isOnlineDriver = (d: any) => {
    const status = String(d.status || '').toLowerCase();
    const activeStatuses = ['available', 'ativo', 'disponível', 'disponivel', 'busy', 'ocupado', 'em serviço'];
    return activeStatuses.includes(status) || d.shiftActive === true;
  };

  // Filtered driver list
  const filteredDrivers = drivers.filter(d => {
    const isOnline = isOnlineDriver(d);
    const matchesState = 
      filterShiftState === 'all' ? true : 
      filterShiftState === 'online' ? isOnline : 
      !isOnline;

    const query = searchTerm.toLowerCase();
    const matchesSearch = 
      (d.name || '').toLowerCase().includes(query) ||
      (d.prefix || '').toLowerCase().includes(query) ||
      (d.phone || '').toLowerCase().includes(query);

    return matchesState && matchesSearch;
  });

  const onlineDrivers = drivers.filter(isOnlineDriver);
  const offlineDrivers = drivers.filter(d => !isOnlineDriver(d));
  const longShiftDrivers = onlineDrivers.filter(d => {
    if (!d.lastShiftStartedAt) return false;
    const start = new Date(d.lastShiftStartedAt).getTime();
    return !isNaN(start) && (Date.now() - start) > 10 * 60 * 60 * 1000; // > 10 hours
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-amber-600 to-blue-600 p-0.5 shadow-lg shadow-amber-500/20 flex items-center justify-center shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Clock className="text-amber-400" size={24} />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black uppercase tracking-wider text-white">
                  Monitoria de Turnos de Condução
                </h2>
                <span className="px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full">
                  Telemetria Live
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Acompanhe em tempo real quem está a trabalhar com o turno ligado, quando o motorista encerrou o turno e auditagem completa do histórico de serviço.
              </p>
            </div>
          </div>

          {/* SubTab Toggle */}
          <div className="flex items-center bg-slate-950 p-1 rounded-2xl border border-slate-800 shrink-0 gap-1 flex-wrap sm:flex-nowrap">
            <button
              onClick={() => setActiveSubTab('current')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 transition-all ${
                activeSubTab === 'current' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Power size={14} />
              Turnos Atuais ({drivers.length})
            </button>
            <button
              onClick={() => setActiveSubTab('history')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 transition-all ${
                activeSubTab === 'history' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <History size={14} />
              Histórico
            </button>
            <button
              onClick={() => setActiveSubTab('session_audit')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 transition-all ${
                activeSubTab === 'session_audit' ? 'bg-rose-600 text-white shadow-md ring-2 ring-rose-500/40' : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldAlert size={14} />
              Auditoria Sessão vs Turno
              {drivers.filter(d => 
                (d.sessionActive === true || d.isLoggedIn === true || d.online === true || d.isOnline === true || d.disponibilidade_app === true) &&
                (d.shiftEnded === true || d.shiftActive === false || d.status === 'offline' || d.status === 'indisponível')
              ).length > 0 && (
                <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[9px] font-black animate-pulse">
                  {drivers.filter(d => 
                    (d.sessionActive === true || d.isLoggedIn === true || d.online === true || d.isOnline === true || d.disponibilidade_app === true) &&
                    (d.shiftEnded === true || d.shiftActive === false || d.status === 'offline' || d.status === 'indisponível')
                  ).length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {toastMessage && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold flex items-center gap-3 animate-fade-in">
          <CheckCircle2 size={18} />
          {toastMessage}
        </div>
      )}

      {/* Session Audit SubTab */}
      {activeSubTab === 'session_audit' && (
        <DriverSessionShiftAudit user={user} />
      )}

      {/* Current Shifts SubTab */}
      {activeSubTab === 'current' && (
        <div className="space-y-6">
          {/* KPI Overview Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-emerald-500/30 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Turno LIGADO (Ativos)</p>
                <p className="text-2xl font-black text-emerald-400 mt-1">{onlineDrivers.length}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Power size={20} />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Turno DESLIGADO (Offline)</p>
                <p className="text-2xl font-black text-slate-300 mt-1">{offlineDrivers.length}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center">
                <LogOut size={20} />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-amber-500/30 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">Turno Prolongado (&gt;10h)</p>
                <p className="text-2xl font-black text-amber-400 mt-1">{longShiftDrivers.length}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <AlertTriangle size={20} />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-blue-500/30 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Total Frota Auditada</p>
                <p className="text-2xl font-black text-blue-400 mt-1">{drivers.length}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                <Car size={20} />
              </div>
            </div>
          </div>

          <div className="space-y-4">
          {/* Controls toolbar */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                type="text"
                placeholder="Pesquisar por motorista, táxi (PSM-...) ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs w-full md:w-auto">
              <button
                onClick={() => setFilterShiftState('all')}
                className={`flex-1 md:flex-none px-3 py-1.5 rounded-lg font-bold transition-all ${filterShiftState === 'all' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}
              >
                Todos ({drivers.length})
              </button>
              <button
                onClick={() => setFilterShiftState('online')}
                className={`flex-1 md:flex-none px-3 py-1.5 rounded-lg font-bold transition-all ${filterShiftState === 'online' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}
              >
                Em Turno ({onlineDrivers.length})
              </button>
              <button
                onClick={() => setFilterShiftState('offline')}
                className={`flex-1 md:flex-none px-3 py-1.5 rounded-lg font-bold transition-all ${filterShiftState === 'offline' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                Fora de Turno ({offlineDrivers.length})
              </button>
            </div>
          </div>

          {/* Main Table / Grid */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            {loading ? (
              <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="animate-spin text-amber-500" size={32} />
                <p className="text-xs font-bold uppercase tracking-wider">A carregar monitoria de turnos da frota...</p>
              </div>
            ) : filteredDrivers.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <p className="text-sm font-bold text-white uppercase tracking-wider">Nenhum motorista encontrado</p>
                <p className="text-xs text-slate-400 mt-1">Ajuste os termos da pesquisa ou filtros acima.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-black uppercase tracking-wider text-[10px]">
                      <th className="py-3.5 px-4">Táxi / Viatura</th>
                      <th className="py-3.5 px-4">Motorista</th>
                      <th className="py-3.5 px-4">Estado do Turno</th>
                      <th className="py-3.5 px-4">Início do Turno</th>
                      <th className="py-3.5 px-4">Encerramento do Turno</th>
                      <th className="py-3.5 px-4 text-right">Ação de Central</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredDrivers.map((driver) => {
                      const isOnline = isOnlineDriver(driver);
                      const endedAt = driver.lastShiftEndedAt || driver.updatedAt;
                      const startedAt = driver.lastShiftStartedAt;

                      return (
                        <tr key={driver.id} className="hover:bg-slate-800/40 transition-colors">
                          {/* Prefix & Vehicle */}
                          <td className="py-3.5 px-4 font-mono font-black text-amber-400">
                            <div className="flex items-center gap-2">
                              <span className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                <Car size={14} />
                              </span>
                              <span>{driver.prefix || 'N/A'}</span>
                            </div>
                          </td>

                          {/* Driver Name & Phone */}
                          <td className="py-3.5 px-4">
                            <div>
                              <p className="font-bold text-white">{driver.name || 'Sem Nome'}</p>
                              <a 
                                href={`tel:${driver.phone}`} 
                                className="text-[11px] text-slate-400 hover:text-amber-400 flex items-center gap-1 mt-0.5"
                              >
                                <Phone size={10} />
                                {driver.phone || 'Sem Telefone'}
                              </a>
                            </div>
                          </td>

                          {/* Shift Status Badge */}
                          <td className="py-3.5 px-4">
                            {isOnline ? (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                                Turno Ligado ({driver.status || 'Disponível'})
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-black uppercase tracking-wider">
                                <span className="w-2 h-2 rounded-full bg-slate-500" />
                                Turno Desligado
                              </div>
                            )}
                          </td>

                          {/* Started At */}
                          <td className="py-3.5 px-4 text-slate-300">
                            {startedAt ? (
                              <div>
                                <p className="font-medium">{new Date(startedAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</p>
                                <p className="text-[10px] text-slate-500">{new Date(startedAt).toLocaleDateString('pt-PT')} ({getElapsedDuration(startedAt)})</p>
                              </div>
                            ) : (
                              <span className="text-slate-500 italic">Não registado</span>
                            )}
                          </td>

                          {/* Ended At */}
                          <td className="py-3.5 px-4 text-slate-300">
                            {!isOnline && endedAt ? (
                              <div>
                                <p className="font-bold text-amber-400">{new Date(endedAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</p>
                                <p className="text-[10px] text-slate-400">{new Date(endedAt).toLocaleDateString('pt-PT')}</p>
                              </div>
                            ) : isOnline ? (
                              <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider">A decorrer em direto...</span>
                            ) : (
                              <span className="text-slate-500 italic">Sem registo recente</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {driver.phone && (
                                <a
                                  href={`https://wa.me/${driver.phone.replace(/\D/g, '')}?text=Aviso%20Central%20TaxiControl%3A%20Informa%C3%A7%C3%A3o%20de%20Turno.`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl font-bold text-[11px] flex items-center gap-1"
                                >
                                  <Send size={12} />
                                  WhatsApp
                                </a>
                              )}

                              {isOnline && (
                                <button
                                  onClick={() => handleForceEndShift(driver)}
                                  className="px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl font-bold text-[11px] flex items-center gap-1 transition-all"
                                  title="Encerrar turno remotamente"
                                >
                                  <Power size={12} />
                                  Desligar Turno
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        </div>
      )}

      {/* History SubTab */}
      {activeSubTab === 'history' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <History size={16} className="text-amber-400" />
            Histórico Temporal de Início e Término de Turnos
          </h3>

          {shiftLogs.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-8 text-center">
              Nenhum registo histórico de alteração de turno gravado até ao momento.
            </p>
          ) : (
            <div className="divide-y divide-slate-800 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="text-slate-400 font-black uppercase tracking-wider text-[10px]">
                    <th className="py-2 px-3">Data / Hora</th>
                    <th className="py-2 px-3">Motorista</th>
                    <th className="py-2 px-3">Viatura</th>
                    <th className="py-2 px-3">Ação</th>
                    <th className="py-2 px-3">Operador / Origem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {shiftLogs.map((log) => {
                    const isStart = log.action === 'START_SHIFT';
                    return (
                      <tr key={log.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-3 text-slate-300 font-mono">
                          {log.timestamp ? new Date(log.timestamp).toLocaleString('pt-PT') : 'N/A'}
                        </td>
                        <td className="py-3 px-3 font-bold text-white">{log.driverName}</td>
                        <td className="py-3 px-3 font-mono text-amber-400 font-bold">{log.prefix}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            isStart ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                            {isStart ? 'LIGOU TURNO' : 'DESLIGOU TURNO'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-400 text-[11px]">{log.operator || 'Próprio Motorista'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
