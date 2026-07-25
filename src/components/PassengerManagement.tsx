import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, where, doc, updateDoc, deleteDoc, getDocs, addDoc, serverTimestamp } from '@/src/lib/firebase';
import { 
  Users, 
  AlertCircle, 
  TrendingUp, 
  Car, 
  ChevronDown, 
  ChevronUp, 
  PhoneCall, 
  Search, 
  Calendar, 
  MapPin, 
  DollarSign, 
  Clock,
  AlertOctagon,
  ShieldAlert,
  Trash2,
  Smartphone,
  Loader2,
  CheckCircle2,
  MessageSquare,
  Plus,
  X,
  Filter,
  Check,
  ExternalLink,
  AlertTriangle,
  Send,
  MessageCircle
} from 'lucide-react';
import { getActiveTenantId } from '../lib/firebase';
import PassengerAppConfig from './PassengerAppConfig';

function PassengerAvatar({ src, name, size = "md" }: { src?: string; name?: string; size?: "sm" | "md" | "lg" }) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const initials = (name || "P")
    .split(/\s+/)
    .filter(Boolean)
    .map(n => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const sizeClasses = {
    sm: "w-7 h-7 text-[10px] rounded-full",
    md: "w-8 h-8 text-[11px] rounded-full",
    lg: "w-16 h-16 text-lg rounded-full"
  };

  const bgColors = [
    "bg-amber-500/10 text-amber-500 border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30",
    "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30",
    "bg-blue-500/10 text-blue-500 border-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30",
    "bg-purple-500/10 text-purple-500 border-purple-500/20 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/30",
    "bg-rose-500/10 text-rose-500 border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/30",
  ];

  const getStableBg = (str: string) => {
    let sum = 0;
    for (let i = 0; i < str.length; i++) {
      sum += str.charCodeAt(i);
    }
    return bgColors[sum % bgColors.length];
  };

  if (src && !hasError) {
    return (
      <img
        src={src}
        alt={name || "Passageiro"}
        referrerPolicy="no-referrer"
        onError={() => setHasError(true)}
        className={`${sizeClasses[size]} object-cover border border-slate-200 dark:border-slate-800 shrink-0`}
      />
    );
  }

  return (
    <div className={`${sizeClasses[size]} flex items-center justify-center font-black uppercase tracking-tight border shrink-0 ${getStableBg(name || "P")}`}>
      {initials || "P"}
    </div>
  );
}

export default function PassengerManagement({ user }: { user: any }) {
  const [passengers, setPassengers] = useState<any[]>([]);
  const [activeCalls, setActiveCalls] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [allCalls, setAllCalls] = useState<any[]>([]);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [callSearchTerm, setCallSearchTerm] = useState('');
  const [passengerSearchTerm, setPassengerSearchTerm] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'config'>('dashboard');
  const [activeTenantName, setActiveTenantName] = useState('SUPER Taxi');
  const [isClearingCalls, setIsClearingCalls] = useState(false);
  const currentTenantId = getActiveTenantId() || '';

  // Complaint States
  const [complaintFilter, setComplaintFilter] = useState<'all' | 'pending' | 'resolved'>('all');
  const [complaintSearchTerm, setComplaintSearchTerm] = useState('');
  const [isManualComplaintModalOpen, setIsManualComplaintModalOpen] = useState(false);
  const [manualComplaintType, setManualComplaintType] = useState('excesso_velocidade');
  const [manualComplaintVehicle, setManualComplaintVehicle] = useState('');
  const [manualComplaintName, setManualComplaintName] = useState('');
  const [manualComplaintPhone, setManualComplaintPhone] = useState('');
  const [manualComplaintText, setManualComplaintText] = useState('');
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  const handleResetCallLogs = async () => {
    const confirmMsg = `Tem a certeza absoluta de que deseja ZERAR todos os Registos de Chamadas de Passageiros?\n\nEsta ação irá remover permanentemente todos os logs de chamadas/corridas da base de dados da ${activeTenantName || 'SUPER Taxi'}.`;
    if (window.confirm(confirmMsg)) {
      setIsClearingCalls(true);
      try {
        const q = query(collection(db, 'calls'));
        const querySnapshot = await getDocs(q);
        const deletePromises = querySnapshot.docs.map(docSnap => deleteDoc(doc(db, 'calls', docSnap.id)));
        await Promise.all(deletePromises);
        alert("Todos os registos de chamadas foram removidos com sucesso!");
      } catch (err: any) {
        console.error("Erro ao zerar chamadas:", err);
        alert("Ocorreu um erro ao zerar os registos de chamadas: " + err.message);
      } finally {
        setIsClearingCalls(false);
      }
    }
  };

  useEffect(() => {
    if (!currentTenantId) return;
    const unsub = onSnapshot(doc(db, 'tenants', currentTenantId), (snap) => {
      if (snap.exists() && snap.data().name) {
        setActiveTenantName(snap.data().name);
      }
    });
    return () => unsub();
  }, [currentTenantId]);

  const handleToggleBan = async (p: any) => {
    const nextBanned = !p.banned;
    const confirmMsg = nextBanned 
      ? `Tem a certeza que deseja BANIR PARA SEMPRE o passageiro "${p.name || 'Anónimo'}"? Ele perderá imediatamente o acesso ao ecossistema de táxis públicos.`
      : `Deseja reativar/desbanir o passageiro "${p.name || 'Anónimo'}"?`;
      
    if (window.confirm(confirmMsg)) {
      try {
        await updateDoc(doc(db, 'passengers', p.id), { banned: nextBanned });
        alert(`Passageiro ${nextBanned ? 'bannido com sucesso' : 'reativado com sucesso'}!`);
      } catch (err) {
        console.error("Erro ao banir/reativar passageiro:", err);
        alert("Ocorreu um erro ao atualizar o estado do passageiro.");
      }
    }
  };

  const handleDeletePassenger = async (p: any) => {
    const confirmMsg = `Tem a certeza absoluta que deseja ELIMINAR permanentemente o perfil de "${p.name || 'Anónimo'}"? Esta ação não pode ser desfeita.`;
    if (window.confirm(confirmMsg)) {
      try {
        await deleteDoc(doc(db, 'passengers', p.id));
        alert("Perfil de passageiro eliminado com sucesso!");
        if (expandedRow === p.id) {
          setExpandedRow(null);
        }
      } catch (err) {
        console.error("Erro ao eliminar passageiro:", err);
        alert("Ocorreu um erro ao eliminar o perfil.");
      }
    }
  };

  const handleToggleResolveComplaint = async (c: any) => {
    try {
      const newStatus = c.status === 'resolved' ? 'pending' : 'resolved';
      await updateDoc(doc(db, 'complaints', c.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
        resolvedAt: newStatus === 'resolved' ? serverTimestamp() : null,
        resolvedBy: user?.name || user?.email || 'Operador'
      });
    } catch (err) {
      console.error("Erro ao atualizar estado da reclamação:", err);
      alert("Erro ao atualizar estado da reclamação.");
    }
  };

  const handleDeleteComplaint = async (c: any) => {
    if (window.confirm("Tem a certeza que deseja eliminar esta reclamação/ocorrência?")) {
      try {
        await deleteDoc(doc(db, 'complaints', c.id));
      } catch (err) {
        console.error("Erro ao eliminar reclamação:", err);
        alert("Erro ao eliminar reclamação.");
      }
    }
  };

  const handleCreateManualComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualComplaintText.trim()) {
      alert("Por favor descreva os detalhes da reclamação.");
      return;
    }
    setIsSubmittingManual(true);
    try {
      await addDoc(collection(db, 'complaints'), {
        type: manualComplaintType,
        vehicle: manualComplaintVehicle || 'Não Especificado',
        description: manualComplaintText,
        passengerName: manualComplaintName || 'Passageiro (Via Central)',
        passengerPhone: manualComplaintPhone || 'Central',
        status: 'pending',
        source: 'central_telefonica',
        createdAt: serverTimestamp(),
        timestamp: new Date().toISOString()
      });
      setIsManualComplaintModalOpen(false);
      setManualComplaintText('');
      setManualComplaintVehicle('');
      setManualComplaintName('');
      setManualComplaintPhone('');
      alert("Reclamação manual registada com sucesso!");
    } catch (err) {
      console.error("Erro ao criar reclamação manual:", err);
      alert("Erro ao registar reclamação manual.");
    } finally {
      setIsSubmittingManual(false);
    }
  };

  useEffect(() => {
    const qPassengers = query(collection(db, 'passengers'), limit(100));
    const qCalls = query(collection(db, 'calls'), where('status', 'in', ['pending', 'confirmed', 'active']), limit(20));
    const qComplaints = query(collection(db, 'complaints'), limit(100));
    
    // We listen to calls and sort locally to avoid missing query index crashes
    const qAllCalls = query(collection(db, 'calls'), limit(100));

    const unsubP = onSnapshot(qPassengers, (snap) => setPassengers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    const unsubC = onSnapshot(qCalls, (snap) => setActiveCalls(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    const unsubComplaints = onSnapshot(qComplaints, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      list.sort((a: any, b: any) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.timestamp ? new Date(b.timestamp).getTime() : 0);
        return timeB - timeA;
      });
      setComplaints(list);
    }, (err) => console.error("Error fetching complaints:", err));
    
    const unsubAllCalls = onSnapshot(qAllCalls, (snap) => {
      const callsList = snap.docs.map(doc => {
        const data = doc.data();
        return { id: doc.id, ...data };
      });
      // Sort locally: newest first
      callsList.sort((a: any, b: any) => {
        const dateA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
        const dateB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : (b.timestamp ? new Date(b.timestamp).getTime() : 0);
        return dateB - dateA;
      });
      setAllCalls(callsList);
    });

    return () => { 
      unsubP(); 
      unsubC(); 
      unsubComplaints(); 
      unsubAllCalls(); 
    };
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider animate-pulse">A Chamar</span>;
      case 'price_sent':
        return <span className="bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-400 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">Proposta</span>;
      case 'confirmed':
        return <span className="bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">Confirmado</span>;
      case 'active':
        return <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider animate-pulse">Em Curso</span>;
      case 'completed':
        return <span className="bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">Concluída</span>;
      case 'cancelled':
        return <span className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">Cancelada</span>;
      default:
        return <span className="bg-red-100 text-red-800 dark:bg-rose-950/40 dark:text-rose-450 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">Recusada</span>;
    }
  };

  const getFormatDate = (item: any) => {
    if (!item?.timestamp) return 'Agora mesmo';
    const d = item.timestamp?.seconds ? new Date(item.timestamp.seconds * 1000) : new Date(item.timestamp);
    return d.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const filteredCalls = allCalls.filter((c: any) => {
    const term = callSearchTerm.toLowerCase();
    return (
      (c.clientName || c.passengerName || '').toLowerCase().includes(term) ||
      (c.phone || c.clientPhone || '').toLowerCase().includes(term) ||
      (c.driverName || '').toLowerCase().includes(term) ||
      (c.pickup || c.pickupAddress || '').toLowerCase().includes(term) ||
      (c.destination || c.destinationAddress || '').toLowerCase().includes(term)
    );
  });

  const filteredPassengers = passengers.filter((p: any) => {
    const term = passengerSearchTerm.toLowerCase();
    const phoneVal = p.backupPhone || p.phone || '';
    return (
      (p.name || '').toLowerCase().includes(term) ||
      phoneVal.toLowerCase().includes(term) ||
      (p.province || '').toLowerCase().includes(term)
    );
  });

  // Grouping calls by driver to calculate metrics, routes, and performance
  const driverPerformance = React.useMemo(() => {
    const driverMap: Record<string, {
      name: string;
      totalTrips: number;
      completedTrips: number;
      totalRevenue: number;
      routes: Record<string, number>;
      ratings: number[];
    }> = {};

    allCalls.forEach((c: any) => {
      const driverName = c.driverName || 'Sem Atribuição / Outros';
      const driverKey = c.driverId || driverName;

      if (!driverMap[driverKey]) {
        driverMap[driverKey] = {
          name: driverName,
          totalTrips: 0,
          completedTrips: 0,
          totalRevenue: 0,
          routes: {},
          ratings: []
        };
      }

      driverMap[driverKey].totalTrips += 1;
      
      const isCompleted = c.status === 'completed';
      if (isCompleted) {
        driverMap[driverKey].completedTrips += 1;
        const tripPrice = Number(c.price || c.finalPrice || 0);
        driverMap[driverKey].totalRevenue += tripPrice;
      }

      // Track routes
      const pickup = (c.pickup || c.pickupAddress || 'Desconhecido').split(',')[0].trim();
      const dest = (c.destination || c.destinationAddress || 'Desconhecido').split(',')[0].trim();
      if (pickup !== 'Desconhecido' && dest !== 'Desconhecido') {
         const routeKey = `${pickup} ➔ ${dest}`;
         driverMap[driverKey].routes[routeKey] = (driverMap[driverKey].routes[routeKey] || 0) + 1;
      }

      if (c.rating !== undefined && c.rating !== null) {
        driverMap[driverKey].ratings.push(Number(c.rating));
      }
    });

    return Object.values(driverMap).map(driver => {
      // Find top route
      let topRoute = 'N/A';
      let maxRouteCount = 0;
      Object.entries(driver.routes).forEach(([route, count]) => {
        if (count > maxRouteCount) {
          maxRouteCount = count;
          topRoute = route;
        }
      });

      // Calculate avg rating
      const avgRating = driver.ratings.length > 0 
        ? (driver.ratings.reduce((sum, val) => sum + val, 0) / driver.ratings.length).toFixed(1)
        : null;

      return {
        ...driver,
        topRoute,
        topRouteCount: maxRouteCount,
        avgRating
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue); // Sort by highest revenue
  }, [allCalls]);

  return (
    <div className="space-y-6">
      {/* Navigation Sub-Tabs bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
        <div className="text-left">
          <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
            <Users size={20} className="text-brand-primary" />
            Ecossistema de Passageiros
          </h2>
          <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
            Consola Geral & Integração Móvel • {activeTenantName.toUpperCase()}
          </p>
        </div>
        
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0 self-start sm:self-center">
          <button
            onClick={() => setActiveSubTab('dashboard')}
            className={`px-4 py-2 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'dashboard' 
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm border border-slate-200/50 dark:border-white/5' 
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-250'
            }`}
          >
            <Users size={14} />
            Estatísticas & Chamadas
          </button>
          
          <button
            onClick={() => setActiveSubTab('config')}
            className={`px-4 py-2 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'config' 
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm border border-slate-200/50 dark:border-white/5' 
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-250'
            }`}
          >
            <Smartphone size={14} />
            Configurar App do Passageiro
          </button>
        </div>
      </div>

      {activeSubTab === 'config' ? (
        <PassengerAppConfig tenantId={currentTenantId} tenantName={activeTenantName} />
      ) : (
        <>
          {/* Alerta de Visibilidade Imediata para Reclamações Pendentes */}
          {complaints.filter(c => c.status !== 'resolved').length > 0 && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-rose-500 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">
                  <AlertCircle size={22} className="animate-pulse" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
                    Atenção Operador: {complaints.filter(c => c.status !== 'resolved').length} {complaints.filter(c => c.status !== 'resolved').length === 1 ? 'Reclamação Pendente' : 'Reclamações Pendentes'}
                  </h4>
                  <p className="text-[10px] text-slate-600 dark:text-slate-300 font-bold uppercase tracking-tight">
                    Existem ocorrências de passageiros pendentes de auditoria e resolução na central JIS.
                  </p>
                </div>
              </div>
              <a 
                href="#complaints-section" 
                className="bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all text-center shrink-0 shadow-md active:scale-95"
              >
                Tratar Ocorrências &rarr;
              </a>
            </div>
          )}

          {/* High Density Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <Users className="text-brand-primary animate-pulse" size={22} />
                <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tighter">Total Passageiros</h3>
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-white">{passengers.length}</p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <Car className="text-emerald-500 animate-pulse" size={22} />
                <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tighter">Viagens Ativas</h3>
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-white">{activeCalls.length}</p>
            </div>

            {/* CARD DESTACADO DE RECLAMAÇÕES PENDENTES */}
            <div className={`p-5 rounded-2xl border transition-all shadow-sm ${
              complaints.filter(c => c.status !== 'resolved').length > 0 
                ? 'bg-rose-500/10 dark:bg-rose-950/30 border-rose-500/40' 
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-white/5'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className={`animate-pulse ${complaints.filter(c => c.status !== 'resolved').length > 0 ? 'text-rose-500' : 'text-slate-400'}`} size={22} />
                  <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tighter">Reclamações Pendentes</h3>
                </div>
                {complaints.filter(c => c.status !== 'resolved').length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[8.5px] font-black uppercase tracking-widest animate-bounce">
                    Atenção
                  </span>
                )}
              </div>
              <div className="flex items-baseline justify-between mt-2">
                <p className={`text-3xl font-black ${complaints.filter(c => c.status !== 'resolved').length > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                  {complaints.filter(c => c.status !== 'resolved').length}
                </p>
                <a 
                  href="#complaints-section"
                  className="text-[10px] font-black uppercase tracking-wider text-rose-500 hover:underline"
                >
                  Ver Fila &rarr;
                </a>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="text-slate-400" size={22} />
                  <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tighter">Total Registadas</h3>
                </div>
                <span className="text-[9px] font-black text-emerald-500 uppercase">
                  {complaints.filter(c => c.status === 'resolved').length} Resolvidas
                </span>
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-white">{complaints.length}</p>
            </div>
          </div>

      {/* Driver Performance & Top Routes Section (Resumo das Rendas e Trajetos via App por Motorista) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-500/10 text-emerald-500 p-2 rounded-xl">
              <TrendingUp size={20} className="animate-pulse" />
            </div>
            <div>
              <h3 className="text-md font-black text-slate-905 dark:text-white uppercase tracking-tighter">Desempenho & Rendas por Motorista (Resumo de Trajetos App)</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Operações de Passageiros via Aplicação • PSM COMERCIAL</p>
            </div>
          </div>
          <div className="self-start sm:self-center bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider">
            Ordenado por Renda Gerada
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-slate-400 uppercase font-black text-[10px] tracking-wider border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Motorista</th>
                <th className="py-3 px-4 text-center">Corridas Concluídas / Total</th>
                <th className="py-3 px-4">Rota / Trajeto Mais Frequente</th>
                <th className="py-3 px-4 text-right">Renda Total App (Kz)</th>
                <th className="py-3 px-4 text-right">Avaliação Média</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {driverPerformance.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 font-medium">
                    Sem dados operacionais de faturamento ou trajetos registados para motoristas.
                  </td>
                </tr>
              ) : (
                driverPerformance.map((dp) => (
                  <tr key={dp.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/45 transition-colors">
                    <td className="py-3.5 px-4 font-black text-slate-800 dark:text-white flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-brand-primary" />
                      {dp.name}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-white/5 rounded-lg text-slate-700 dark:text-slate-300 font-bold">
                        <span className="text-emerald-500 font-black">{dp.completedTrips}</span>
                        <span className="text-[10px] opacity-40">/</span>
                        <span className="opacity-60">{dp.totalTrips}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {dp.topRoute !== 'N/A' ? (
                        <div className="flex items-center gap-1.5">
                          <MapPin size={11} className="text-rose-500 flex-shrink-0" />
                          <span className="font-bold text-slate-705 dark:text-slate-300 truncate max-w-[200px]" title={dp.topRoute}>
                            {dp.topRoute}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800/80 rounded font-black text-slate-500">
                            {dp.topRouteCount}x
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Sem rotas</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="text-[13px] font-black italic text-emerald-600 dark:text-emerald-400">
                        {dp.totalRevenue.toLocaleString('pt-PT')} <span className="text-[9px] font-bold not-italic text-slate-400">Kz</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {dp.avgRating ? (
                        <div className="inline-flex items-center gap-1 font-black text-amber-500">
                          <span>★</span>
                          <span>{dp.avgRating}</span>
                        </div>
                      ) : (
                        <span className="text-slate-450 italic text-[10px]">Sem notas</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Grid: Passengers on Left, All Calls on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Recent Passengers list (Left 5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 p-6 shadow-sm flex flex-col space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-md font-black text-slate-900 dark:text-white uppercase tracking-tighter">Passageiros Recentes</h3>
            
            {/* Search filter */}
            <div className="relative">
              <input 
                type="text" 
                placeholder="Pesquisar..." 
                value={passengerSearchTerm}
                onChange={(e) => setPassengerSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl text-xs text-slate-800 dark:text-slate-100"
              />
              <Search size={14} className="absolute left-2.5 top-2 text-slate-400" />
            </div>
          </div>

          <div className="overflow-y-auto max-h-[500px]">
            <table className="w-full text-xs text-left">
              <thead className="text-slate-500 uppercase sticky top-0 bg-white dark:bg-slate-900 z-10 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="p-3">Nome</th>
                  <th className="p-3">Província</th>
                  <th className="p-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredPassengers.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-4 text-center text-slate-400">Nenhum passageiro encontrado.</td>
                  </tr>
                ) : (
                  filteredPassengers.map(p => (
                    <React.Fragment key={p.id}>
                      <tr 
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors ${p.banned ? 'bg-red-50/40 dark:bg-red-950/10' : ''}`} 
                        onClick={() => setExpandedRow(expandedRow === p.id ? null : p.id)}
                      >
                        <td className="p-3 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <PassengerAvatar src={p.photoUrl} name={p.name} size="sm" />
                          <span className="truncate">{p.name || 'Anónimo'}</span>
                          {p.banned && (
                            <span className="bg-red-100 text-red-800 dark:bg-rose-950/60 dark:text-rose-400 px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-tight flex items-center gap-1 shrink-0 animate-pulse border border-red-200 dark:border-red-950/40">
                              <AlertOctagon size={10} /> BANIDO
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">{p.province || 'Moxico'}</td>
                        <td className="p-3 text-right flex items-center justify-end gap-1.5">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleBan(p);
                            }}
                            className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                              p.banned 
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                                : 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm'
                            }`}
                          >
                            {p.banned ? 'Reativar' : 'Banir'}
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePassenger(p);
                            }}
                            className="px-2 py-0.5 bg-rose-700 hover:bg-rose-800 text-white rounded text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-0.5"
                            title="Eliminar Perfil de Passageiro"
                          >
                            <Trash2 size={10} />
                          </button>
                          {expandedRow === p.id ? <ChevronUp size={16} className="inline text-slate-500" /> : <ChevronDown size={16} className="inline text-slate-500" />}
                        </td>
                      </tr>
                      {expandedRow === p.id && (
                        <tr>
                          <td colSpan={3} className="p-4 bg-slate-50 dark:bg-slate-850 rounded-xl">
                            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center mb-3">
                              <PassengerAvatar src={p.photoUrl} name={p.name} size="lg" />
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-600 dark:text-slate-300 font-semibold flex-1 w-full">
                                <div><span className="font-black uppercase text-[10px] text-slate-400 block mb-0.5">Telemóvel</span> {p.backupPhone || p.phone || 'N/A'}</div>
                                <div><span className="font-black uppercase text-[10px] text-slate-400 block mb-0.5">Idade</span> {p.age || 'N/A'} anos</div>
                                <div className="sm:col-span-2"><span className="font-black uppercase text-[10px] text-slate-400 block mb-0.5">Data de Registo</span> {p.createdAt ? (p.createdAt.seconds ? new Date(p.createdAt.seconds * 1000).toLocaleDateString('pt-PT') : new Date(p.createdAt).toLocaleDateString('pt-PT')) : 'N/A'}</div>
                              </div>
                            </div>
                            
                            <div className="border-t border-slate-200/55 dark:border-white/5 pt-3 flex flex-wrap gap-2">
                              <button
                                onClick={() => handleToggleBan(p)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                  p.banned 
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                                    : 'bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-650/10'
                                }`}
                              >
                                <AlertOctagon size={12} />
                                {p.banned ? '✅ Reativar / Desbanir' : '🚫 Banir Para Sempre'}
                              </button>

                              <button
                                onClick={() => handleDeletePassenger(p)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-650 hover:bg-red-750 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-md shadow-red-500/10"
                              >
                                <Trash2 size={12} />
                                🗑️ Eliminar Perfil
                              </button>
                              
                              {(p.backupPhone || p.phone) && (
                                <a
                                  href={`tel:${p.backupPhone || p.phone}`}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                                >
                                  <PhoneCall size={12} />
                                  Ligar ao Passageiro
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Call Logs History (Right 7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 p-6 shadow-sm flex flex-col space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="bg-brand-primary/10 text-brand-primary p-1.5 rounded-lg">
                <PhoneCall size={16} />
              </div>
              <h3 className="text-md font-black text-slate-900 dark:text-white uppercase tracking-tighter">Registos de Chamadas de Passageiros</h3>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              {/* Reset Call Logs Button */}
              <button
                type="button"
                disabled={isClearingCalls}
                onClick={handleResetCallLogs}
                className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-400 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl transition-all shadow-sm cursor-pointer disabled:cursor-not-allowed"
              >
                {isClearingCalls ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Zerar Chamadas
              </button>

              {/* Search Filter */}
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Pesquisar chamadas..." 
                  value={callSearchTerm}
                  onChange={(e) => setCallSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl text-xs text-slate-800 dark:text-slate-100 w-full sm:w-48 outline-none focus:ring-1 focus:ring-brand-primary"
                />
                <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto overflow-y-auto max-h-[500px]">
            <table className="w-full text-xs text-left">
              <thead className="text-slate-500 uppercase sticky top-0 bg-white dark:bg-slate-900 z-10 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="p-3">Data / Hora</th>
                  <th className="p-3">Passageiro / Contacto</th>
                  <th className="p-3">Trajeto</th>
                  <th className="p-3">Motorista</th>
                  <th className="p-3 text-right">Estado / Preço</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCalls.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">Nenhum registo de chamada efetuada de momento.</td>
                  </tr>
                ) : (
                  filteredCalls.map((c: any) => (
                    <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      {/* Date/Time */}
                      <td className="p-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-slate-900 dark:text-white font-bold">
                          <Calendar size={12} className="text-slate-400" />
                          <span>{getFormatDate(c)}</span>
                        </div>
                      </td>
                      {/* Client Info */}
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          {(() => {
                            const passengerName = c.clientName || c.passengerName || 'P';
                            const matchedPassenger = passengers.find(p => p.name && p.name.trim().toLowerCase() === passengerName.trim().toLowerCase());
                            const photoSrc = c.passengerPhoto || matchedPassenger?.photoUrl;
                            return (
                              <PassengerAvatar 
                                src={photoSrc} 
                                name={passengerName} 
                                size="md" 
                              />
                            );
                          })()}
                          <div>
                            <p className="font-black text-slate-900 dark:text-white leading-tight">{c.clientName || c.passengerName || 'Contacto Directo'}</p>
                            <p className="text-[10px] text-slate-400 font-semibold">{c.phone || c.clientPhone || 'Sem número'}</p>
                          </div>
                          {c.bonusLog && (
                            <div className="mt-1.5 max-w-[200px] text-[9.5px] text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-lg text-left leading-tight space-y-0.5 shadow-sm">
                              <p className="font-black text-[8px] uppercase tracking-wider text-amber-600 dark:text-amber-500 mb-1">Log de Bónus (Admin):</p>
                              <div className="flex justify-between gap-2 font-mono text-[9px]">
                                <span>Saldo Inicial:</span>
                                <span className="font-bold">{Number(c.bonusLog.initial || 0).toLocaleString('pt-PT')} Kz</span>
                              </div>
                              {c.bonusLog.type === 'deduction' ? (
                                <div className="flex justify-between gap-2 font-mono text-[9px] text-rose-500">
                                  <span>Subtraído:</span>
                                  <span className="font-bold">-{Number(c.bonusLog.subtracted || 0).toLocaleString('pt-PT')} Kz</span>
                                </div>
                              ) : (
                                <div className="flex justify-between gap-2 font-mono text-[9px] text-emerald-500">
                                  <span>Acumulado:</span>
                                  <span className="font-bold">+{Number(c.bonusLog.added || 0).toLocaleString('pt-PT')} Kz</span>
                                </div>
                              )}
                              <div className="flex justify-between gap-2 font-mono text-[9px] border-t border-amber-500/10 pt-1 mt-1 font-bold text-slate-700 dark:text-amber-300 font-black">
                                <span>Saldo Final:</span>
                                <span>{Number(c.bonusLog.final || 0).toLocaleString('pt-PT')} Kz</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      {/* Route Trajeto */}
                      <td className="p-3 max-w-[150px] truncate">
                        <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                          <MapPin size={11} className="text-rose-500 flex-shrink-0" />
                          <span className="font-bold truncate" title={`${c.pickup || c.pickupAddress} ➔ ${c.destination || c.destinationAddress}`}>
                            {c.pickup || c.pickupAddress || 'N/A'} ➔ {c.destination || c.destinationAddress || 'N/A'}
                          </span>
                        </div>
                      </td>
                      {/* Driver */}
                      <td className="p-3 whitespace-nowrap">
                        {c.driverName ? (
                          <div className="flex items-center gap-1 text-slate-800 dark:text-slate-200 font-bold">
                            <span className="w-1.5 h-1.5 bg-brand-primary rounded-full" />
                            <span>{c.driverName}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic font-medium">A procurar...</span>
                        )}
                      </td>
                      {/* Rating/Price details */}
                      <td className="p-3 text-right">
                        <div className="space-y-1">
                          <div className="flex justify-end">
                            {getStatusBadge(c.status)}
                          </div>
                          {c.price || c.finalPrice ? (
                            <div className="text-[11px] font-black text-brand-primary dark:text-amber-400">
                              {Number(c.price || c.finalPrice).toLocaleString('pt-PT')} Kz
                            </div>
                          ) : (
                            <span className="text-[9px] text-slate-400 font-semibold uppercase">Pendente</span>
                          )}
                          {c.rating !== undefined && c.rating !== null && (
                            <div className="flex items-center justify-end gap-0.5 text-[10px] font-black text-amber-500">
                              <span className="text-[9px]">★</span>
                              <span>{c.rating}/5</span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION: PASSENGER COMPLAINTS & FEEDBACK AUDIT PANEL */}
        <div id="complaints-section" className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 p-6 shadow-sm flex flex-col space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                <AlertCircle size={22} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                  <span>Reclamações & Ocorrências dos Passageiros</span>
                  {complaints.filter(c => c.status !== 'resolved').length > 0 && (
                    <span className="bg-rose-500 text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full animate-bounce">
                      {complaints.filter(c => c.status !== 'resolved').length} PENDENTES
                    </span>
                  )}
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                  Central de auditoria, fiscalização e acompanhamento de reclamações enviadas via App do Passageiro e Atendimento
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsManualComplaintModalOpen(true)}
                className="flex items-center gap-1.5 bg-brand-primary hover:bg-amber-500 text-slate-950 font-black text-[11px] uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all shadow-md cursor-pointer active:scale-95"
              >
                <Plus size={14} />
                Registar Reclamação Manual
              </button>

              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Pesquisar por texto, nome, viatura..." 
                  value={complaintSearchTerm}
                  onChange={(e) => setComplaintSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl text-xs text-slate-800 dark:text-slate-100 w-full sm:w-56 outline-none focus:ring-1 focus:ring-brand-primary"
                />
                <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
              </div>
            </div>
          </div>

          {/* Filter subtabs */}
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <button
              type="button"
              onClick={() => setComplaintFilter('all')}
              className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                complaintFilter === 'all' 
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm' 
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              Todas ({complaints.length})
            </button>
            <button
              type="button"
              onClick={() => setComplaintFilter('pending')}
              className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                complaintFilter === 'pending' 
                  ? 'bg-rose-600 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              Pendentes ({complaints.filter(c => c.status !== 'resolved').length})
            </button>
            <button
              type="button"
              onClick={() => setComplaintFilter('resolved')}
              className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                complaintFilter === 'resolved' 
                  ? 'bg-emerald-600 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              Resolvidas ({complaints.filter(c => c.status === 'resolved').length})
            </button>
          </div>

          {/* Complaints Grid/List */}
          <div className="space-y-3 max-h-[650px] overflow-y-auto pr-1 custom-scrollbar">
            {complaints.filter(c => {
              if (complaintFilter === 'pending' && c.status === 'resolved') return false;
              if (complaintFilter === 'resolved' && c.status !== 'resolved') return false;

              if (!complaintSearchTerm.trim()) return true;
              const term = complaintSearchTerm.toLowerCase();
              const typeStr = (c.type || '').toLowerCase();
              const descStr = (c.description || '').toLowerCase();
              const nameStr = (c.passengerName || '').toLowerCase();
              const phoneStr = (c.passengerPhone || '').toLowerCase();
              const vehStr = (c.vehicle || '').toLowerCase();

              return typeStr.includes(term) || descStr.includes(term) || nameStr.includes(term) || phoneStr.includes(term) || vehStr.includes(term);
            }).length === 0 ? (
              <div className="p-12 text-center bg-slate-50 dark:bg-slate-850/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                <AlertCircle size={32} className="mx-auto text-slate-400 mb-2 opacity-50" />
                <p className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Nenhuma reclamação ou ocorrência encontrada de momento.
                </p>
                <p className="text-[10px] text-slate-400 mt-1 font-medium">
                  As reclamações submetidas no formulário do aplicativo público do passageiro ou registadas manualmente pela central aparecerão aqui em tempo real.
                </p>
              </div>
            ) : (
              complaints.filter(c => {
                if (complaintFilter === 'pending' && c.status === 'resolved') return false;
                if (complaintFilter === 'resolved' && c.status !== 'resolved') return false;

                if (!complaintSearchTerm.trim()) return true;
                const term = complaintSearchTerm.toLowerCase();
                const typeStr = (c.type || '').toLowerCase();
                const descStr = (c.description || '').toLowerCase();
                const nameStr = (c.passengerName || '').toLowerCase();
                const phoneStr = (c.passengerPhone || '').toLowerCase();
                const vehStr = (c.vehicle || '').toLowerCase();

                return typeStr.includes(term) || descStr.includes(term) || nameStr.includes(term) || phoneStr.includes(term) || vehStr.includes(term);
              }).map((c) => {
                const getBadge = (t: string) => {
                  switch (t) {
                    case 'excesso_velocidade': return { label: 'Excesso de Velocidade', color: 'bg-rose-500/10 text-rose-500 border-rose-500/20' };
                    case 'conduta_motorista': return { label: 'Conduta do Motorista', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' };
                    case 'cobranca_indevida': return { label: 'Cobrança Indevida', color: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20' };
                    case 'estado_viatura': return { label: 'Condição da Viatura', color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' };
                    case 'eliminar_conta': return { label: 'Eliminar Conta / Dados', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' };
                    default: return { label: t ? t.replace('_', ' ').toUpperCase() : 'Ocorrência / Reclamação', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' };
                  }
                };
                const badge = getBadge(c.type);
                const isResolved = c.status === 'resolved';

                const dateStr = c.createdAt?.seconds 
                  ? new Date(c.createdAt.seconds * 1000).toLocaleString('pt-PT')
                  : (c.timestamp ? new Date(c.timestamp).toLocaleString('pt-PT') : 'Data recente');

                return (
                  <div 
                    key={c.id} 
                    className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row justify-between gap-4 ${
                      isResolved 
                        ? 'bg-slate-50/50 dark:bg-slate-850/30 border-slate-200 dark:border-slate-800/80 opacity-75' 
                        : 'bg-white dark:bg-slate-850 border-rose-500/30 dark:border-rose-500/20 shadow-md'
                    }`}
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${badge.color}`}>
                          {badge.label}
                        </span>

                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border border-slate-200 dark:border-slate-700">
                          Viatura: {c.vehicle || 'Não Especificada'}
                        </span>

                        {c.source === 'app_passageiro' ? (
                          <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider">
                            Via App Móvel
                          </span>
                        ) : (
                          <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2.5 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider">
                            Via Central
                          </span>
                        )}

                        <span className="text-[10px] font-bold text-slate-400 ml-auto flex items-center gap-1">
                          <Calendar size={11} />
                          {dateStr}
                        </span>
                      </div>

                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-relaxed bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-white/5 whitespace-pre-wrap">
                        "{c.description || 'Sem descrição enviada.'}"
                      </p>

                      {c.satisfaction && (
                        <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                          c.satisfaction === 'satisfied' 
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                            : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
                        }`}>
                          <span className="text-sm">{c.satisfaction === 'satisfied' ? '😊' : '🙁'}</span>
                          <div className="text-[10px] font-black uppercase tracking-wider">
                            <span>Avaliação do Passageiro: {c.satisfaction === 'satisfied' ? 'SATISFEITO COM O ATENDIMENTO' : 'INSATISFEITO COM O ATENDIMENTO'}</span>
                            {c.satisfactionComment && (
                              <p className="normal-case font-medium italic text-slate-600 dark:text-slate-300 m-0">
                                "{c.satisfactionComment}"
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold text-slate-500 pt-1">
                        <span className="flex items-center gap-1 text-slate-900 dark:text-white font-black">
                          <Users size={12} className="text-brand-primary" />
                          {c.passengerName || 'Passageiro Anónimo'}
                        </span>

                        {c.passengerPhone && c.passengerPhone !== 'Anónimo' && c.passengerPhone !== 'Central' && (
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1 text-slate-400 font-mono">
                              <PhoneCall size={11} />
                              {c.passengerPhone}
                            </span>
                            <a
                              href={`https://wa.me/${c.passengerPhone.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[9.5px] font-black text-emerald-500 hover:text-emerald-400 flex items-center gap-1 uppercase bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded-md border border-emerald-500/20 transition-all"
                            >
                              <MessageCircle size={10} />
                              WhatsApp
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-2 border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800 pt-3 md:pt-0 md:pl-4 shrink-0">
                      <div>
                        {isResolved ? (
                          <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                            <CheckCircle2 size={12} /> Resolvido
                          </span>
                        ) : (
                          <span className="bg-rose-500/10 text-rose-500 border border-rose-500/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 animate-pulse">
                            <AlertTriangle size={12} /> Pendente
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleResolveComplaint(c)}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 shadow-sm active:scale-95 ${
                            isResolved 
                              ? 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-300' 
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                        >
                          <Check size={12} />
                          {isResolved ? 'Reabrir' : 'Marcar Resolvido'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteComplaint(c)}
                          className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-xl transition-all cursor-pointer border border-rose-500/20"
                          title="Eliminar Reclamação"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Modal: Registar Reclamação Manual */}
        {isManualComplaintModalOpen && (
          <div className="fixed inset-0 z-[150] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative text-slate-900 dark:text-white">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-brand-primary/20 text-brand-primary flex items-center justify-center">
                    <Plus size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider">Registar Reclamação Manual</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Lançamento de Ocorrência Telefónica / Central</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsManualComplaintModalOpen(false)}
                  className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateManualComplaint} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Tipo de Reclamação / Assunto
                  </label>
                  <select
                    value={manualComplaintType}
                    onChange={(e) => setManualComplaintType(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-brand-primary"
                  >
                    <option value="excesso_velocidade">Excesso de Velocidade / Condução Perigosa</option>
                    <option value="conduta_motorista">Conduta do Motorista / Falta de Respeito</option>
                    <option value="cobranca_indevida">Cobrança Indevida / Divergência de Taxa</option>
                    <option value="estado_viatura">Condição da Viatura / Limpeza ou Avaria</option>
                    <option value="outro">Outra Ocorrência / Sugestão</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                      Viatura Assinalada
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: T-04, T-12, LD-00-XX"
                      value={manualComplaintVehicle}
                      onChange={(e) => setManualComplaintVehicle(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-brand-primary"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                      Nome do Passageiro
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Maria António"
                      value={manualComplaintName}
                      onChange={(e) => setManualComplaintName(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-brand-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Telefone de Contacto (+244)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: +244 923 000 000"
                    value={manualComplaintPhone}
                    onChange={(e) => setManualComplaintPhone(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-brand-primary"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Descrição Detalhada dos Factos *
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Descreva com clareza o sucedido relatado pelo passageiro..."
                    value={manualComplaintText}
                    onChange={(e) => setManualComplaintText(e.target.value)}
                    required
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-brand-primary resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsManualComplaintModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingManual}
                    className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-brand-primary hover:bg-amber-500 text-slate-950 transition-all flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingManual ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Gravar Reclamação
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
      </>
      )}
    </div>
  );
}
