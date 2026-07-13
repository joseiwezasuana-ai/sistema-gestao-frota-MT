import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Truck, 
  Car,
  Map as MapIcon, 
  History as HistoryIcon, 
  Settings as SettingsIcon,
  LogOut,
  Bell,
  Search,
  MessageSquare,
  MessageCircle,
  User as UserIcon,
  Camera,
  Activity,
  Smartphone,
  Wrench,
  Wallet,
  UserPlus,
  Package,
  Calculator,
  FileText,
  CarFront,
  Users,
  Calendar,
  BookOpen,
  Sun,
  Moon,
  AlertTriangle,
  X,
  Building,
  MoreHorizontal,
  ChevronDown,
  Menu,
  ChevronLeft,
  ChevronRight,
  TrendingUp
} from 'lucide-react';
import { collection, query, where, onSnapshot, doc } from '@/src/lib/firebase';
import { db, getActiveTenantId, setActiveTenantId } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useTheme } from '../context/ThemeContext';

interface LayoutProps {
  children: React.ReactNode;
  user: any;
  globalSettings?: any;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
  onToggleMobile?: () => void;
  onEditProfile?: () => void;
}

export default function Layout({ children, user, globalSettings, activeTab, onTabChange, onLogout, onToggleMobile, onEditProfile }: LayoutProps) {
  const { theme, toggleTheme } = useTheme();
  const [panicAlerts, setPanicAlerts] = useState<any[]>([]);
  const [isAlertsDropdownOpen, setIsAlertsDropdownOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Corporate Multi-Tenant state for Master Admin (JIS)
  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string>('');
  const isMasterAdmin = user?.email?.toLowerCase() === 'joseiwezasuana@gmail.com';

  useEffect(() => {
    if (!isMasterAdmin) return;
    
    const unsubscribeTenants = onSnapshot(collection(db, 'tenants'), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name || doc.id }));
      setTenants(list);
    }, (err) => {
      console.error("Layout tenants subscription error:", err);
    });

    setSelectedTenant(getActiveTenantId());
    return () => unsubscribeTenants();
  }, [user?.email]);

  const handleSwitchTenant = (tenantId: string) => {
    setActiveTenantId(tenantId);
    setSelectedTenant(tenantId);
    window.location.reload();
  };

  useEffect(() => {
    const isMasterAdmin = user?.email?.toLowerCase() === 'joseiwezasuana@gmail.com';
    const isStaff = isMasterAdmin || ['admin', 'gerente', 'operator', 'operador', 'contabilista', 'mecanico'].includes(user?.role);
    
    if (!isStaff) return;

    const qPanic = query(collection(db, 'panic_alerts'), where('status', '==', 'active'));
    const unsubscribePanic = onSnapshot(qPanic, (snapshot) => {
      setPanicAlerts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Layout panic listener error:", error);
    });
    return () => unsubscribePanic();
  }, [user?.role, user?.email]);

  // Collapsible Administration Menu state (representing "três pontinhos na pasta Administração")
  const ADMIN_TAB_IDS = ['settings', 'baileys_gateway', 'call_sms_dossier', 'manual'];
  const [isAdminFolderOpen, setIsAdminFolderOpen] = useState(false);
  const [activeTenantData, setActiveTenantData] = useState<any>(null);

  // Auto-expand folder if active tab is inside administration group
  useEffect(() => {
    if (ADMIN_TAB_IDS.includes(activeTab)) {
      setIsAdminFolderOpen(true);
    }
  }, [activeTab]);

  // Subscribe to currently active tenant branding to update Logo & Name in real-time
  const currentTenantId = getActiveTenantId();
  useEffect(() => {
    if (!currentTenantId) return;
    const unsub = onSnapshot(doc(db, 'tenants', currentTenantId), (snap) => {
      if (snap.exists()) {
        setActiveTenantData(snap.data());
      } else {
        setActiveTenantData(null);
      }
    }, (err) => {
      console.error("Layout dynamic branding subscription error:", err);
    });
    return () => unsub();
  }, [currentTenantId]);

  const primaryMenuItems = [
    { id: 'dashboard', label: 'Painel Geral', icon: LayoutDashboard },
    { id: 'fleet', label: 'Frota & Escalas 24h', icon: Truck, roles: ['admin', 'operator', 'mecanico', 'contabilista'] },
    { id: 'recruitment', label: 'Portal de Recrutamento', icon: UserPlus, roles: ['admin', 'operator', 'mecanico'] },
    { id: 'monitors', label: 'Monitores de Campo', icon: Activity, roles: ['admin', 'operator', 'contabilista', 'mecanico'] },
    { id: 'revenue', label: 'Validação de Rendas', icon: Wallet, roles: ['operator', 'contabilista', 'admin'] },
    { id: 'passengers', label: 'Gestão de Passageiros', icon: Users, roles: ['admin', 'operator'] },
    { id: 'maintenance', label: 'Gestão de Oficinas', icon: Wrench, roles: ['admin', 'operator', 'mecanico', 'contabilista'] },
    { id: 'accounting', label: 'Hub Contabilidade', icon: Calculator, roles: ['admin', 'contabilista'] },
    { id: 'messages', label: 'Hub de Comunicações', icon: MessageSquare, roles: ['admin', 'operator'] },
  ];

  const adminMenuItems = [
    { id: 'baileys_gateway', label: 'Gateway Baileys', icon: MessageCircle, roles: ['admin', 'operator'] },
    { id: 'call_sms_dossier', label: 'Dossiê Comunicações', icon: FileText, roles: ['admin', 'operator'] },
    { id: 'settings', label: 'Configurações', icon: SettingsIcon, roles: ['admin'] },
    { id: 'manual', label: 'Manual & Guia', icon: BookOpen, roles: ['admin', 'operator', 'contabilista', 'mecanico'] },
  ];

  const filterByRole = (items: any[]) => {
    return items.filter(item => {
      if (!item.roles) return true;
      const isMasterAdmin = user?.email?.toLowerCase() === 'joseiwezasuana@gmail.com';
      if (isMasterAdmin || user?.role === 'admin' || user?.role === 'gerente') return true;
      return item.roles.includes(user?.role);
    });
  };

  const filteredPrimaryItems = filterByRole(primaryMenuItems);
  const filteredAdminItems = filterByRole(adminMenuItems);

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-slate-950 overflow-hidden font-sans">
      {/* Sidebar - 250px width (collapsible) */}
      <aside className={cn(
        "w-[250px] bg-[#0f172a] dark:bg-black text-white flex flex-col flex-shrink-0 transition-all duration-300 border-r border-white/5 relative z-20",
        isSidebarCollapsed && "w-0 overflow-hidden opacity-0 -translate-x-[250px] border-r-0 pointer-events-none"
      )}>
        <div className="p-8 pb-10 flex flex-col items-center text-center">
          <div className="relative mb-4 group cursor-pointer" onClick={() => onTabChange('dashboard')}>
            <div className="w-16 h-16 bg-white/5 rounded-[20px] flex items-center justify-center text-white shadow-xl shadow-brand-primary/10 rotate-3 group-hover:rotate-0 transition-all duration-300 border border-white/5 p-2 overflow-hidden">
               <img 
                 src={activeTenantData?.logoUrl || "/logo.svg"} 
                 alt={activeTenantData?.name || "SUPER Taxi"} 
                 className="w-full h-full object-contain"
                 onError={(e) => {
                   (e.target as HTMLImageElement).src = "/logo.svg";
                 }}
               />
               <span className="hidden text-3xl font-black italic text-brand-primary">PSM</span>
            </div>
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#0f172a] z-10" />
            <div className="absolute inset-0 bg-brand-primary blur-xl opacity-20 animate-pulse" />
          </div>
          <div className="overflow-hidden w-full px-2">
            <h1 className="font-black text-xs tracking-[0.1em] uppercase leading-snug text-white italic truncate" title={activeTenantData?.name || globalSettings?.appName || 'PS MOREIRA'}>
              {activeTenantData?.name || globalSettings?.appName || 'PS MOREIRA'}
            </h1>
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1.5 opacity-60">COMERCIAL • MOXICO</p>
            <div className="mt-4 flex items-center justify-center gap-1.5">
               <span className="px-2 py-0.5 bg-brand-primary/10 text-brand-primary text-[8px] font-black rounded-full uppercase tracking-tighter border border-brand-primary/20">
                 VERSÃO 6.0
               </span>
            </div>
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mx-6 mb-6" />

        <nav className="flex-1 space-y-1 px-4 overflow-y-auto no-scrollbar pb-6 text-left">
          {/* Menu Principal */}
          {filteredPrimaryItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 text-[12px] transition-all rounded-xl group relative overflow-hidden font-bold uppercase tracking-wider",
                activeTab === item.id 
                  ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/10 font-bold" 
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon size={16} className={cn("transition-transform group-hover:scale-110 shrink-0", activeTab === item.id ? "text-white" : "text-slate-500 group-hover:text-brand-primary")} />
              <span className="relative z-10 truncate">{item.label}</span>
              {activeTab === item.id && (
                <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent pointer-events-none" />
              )}
            </button>
          ))}

          {/* Pasta de Administração (Três Pontinhos) */}
          {filteredAdminItems.length > 0 && (
            <div className="space-y-1">
              <button
                onClick={() => setIsAdminFolderOpen(!isAdminFolderOpen)}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3 text-[12px] transition-all rounded-xl group relative overflow-hidden font-bold uppercase tracking-wider mt-2",
                  ADMIN_TAB_IDS.includes(activeTab)
                    ? "text-[#fbbf24] dark:text-[#fbbf24] font-black"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                )}
              >
                <div className="flex items-center gap-3">
                  <MoreHorizontal size={16} className={cn("transition-transform group-hover:scale-110 shrink-0", ADMIN_TAB_IDS.includes(activeTab) ? "text-[#fbbf24]" : "text-slate-500 group-hover:text-brand-primary")} />
                  <span className="relative z-10">Administração</span>
                </div>
                <ChevronDown size={14} className={cn("text-slate-500 transition-transform duration-300 shrink-0", isAdminFolderOpen ? "rotate-180" : "")} />
              </button>
              
              <AnimatePresence initial={false}>
                {isAdminFolderOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden pl-3 border-l border-white/5 ml-6 space-y-1 mt-1 text-left"
                  >
                    {filteredAdminItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => onTabChange(item.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 text-[11px] transition-all rounded-lg group relative overflow-hidden font-bold uppercase tracking-wider",
                          activeTab === item.id 
                            ? "bg-brand-primary/20 text-brand-primary border-l-2 border-brand-primary pl-2 shadow-sm" 
                            : "text-slate-400 hover:text-white hover:bg-white/5"
                        )}
                      >
                        <item.icon size={14} className={cn("transition-transform group-hover:scale-110 shrink-0", activeTab === item.id ? "text-brand-primary" : "text-slate-500 group-hover:text-brand-primary")} />
                        <span className="relative z-10 truncate">{item.label}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </nav>

        <div className="p-6 bg-slate-900/50 m-4 rounded-2xl border border-white/5 backdrop-blur-md">
          <div 
            onClick={onEditProfile}
            className="flex items-center gap-4 mb-5 cursor-pointer group hover:bg-white/5 p-2 -m-2 rounded-xl transition-all"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-700 to-slate-900 flex-shrink-0 flex items-center justify-center border border-white/10 shadow-xl overflow-hidden relative">
               {user?.photoURL ? (
                 <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
               ) : (
                 <UserIcon size={20} className="text-slate-400 relative z-10" />
               )}
               <div className="absolute inset-0 bg-brand-primary opacity-0 group-hover:opacity-20 transition-opacity" />
               <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                  <Camera size={12} className="text-white" />
               </div>
            </div>
            <div className="overflow-hidden">
              <p className="text-[11px] font-black truncate text-white uppercase tracking-tight group-hover:text-brand-primary transition-colors">{user?.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                 <div className="w-1.5 h-1.5 bg-brand-primary rounded-full" />
                 <p className="text-[9px] text-brand-primary uppercase font-black tracking-widest leading-none">{user?.role}</p>
              </div>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-3 text-[9px] font-black text-slate-400 bg-white/5 rounded-xl hover:bg-rose-500/10 hover:text-rose-400 transition-all uppercase border border-white/5 active:scale-95"
          >
            <LogOut size={12} />
            Desconectar Sistema
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#f8fafc] dark:bg-slate-900">
        <header className="h-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/5 px-6 lg:px-10 flex items-center justify-between flex-shrink-0 z-10 shadow-sm relative">
          <div className="flex items-center gap-4 lg:gap-6">
            {/* Sidebar Toggle Button */}
            <button 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-2.5 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl border border-slate-200 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shadow-sm active:scale-95 flex items-center justify-center shrink-0"
              title={isSidebarCollapsed ? "Mostrar Menu" : "Ocultar Menu"}
            >
              <Menu size={18} />
            </button>

            <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-white/5 hidden sm:block">
               <Activity size={20} className="text-brand-primary animate-pulse" />
            </div>
            <div>
              <h2 className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em]">Módulo Ativo</h2>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tighter flex items-center gap-2 mt-0.5">
                {([...primaryMenuItems, ...adminMenuItems].find(i => i.id === activeTab)?.label || 'Centro de Operações')}
                <span className="w-1 h-1 bg-slate-300 dark:bg-slate-700 rounded-full" />
                <span className="text-[10px] text-brand-primary italic opacity-70">Live Monitor</span>
              </h3>
            </div>
          </div>

          {/* Selector de Tenant para o Gestor Master (JIS) */}
          {isMasterAdmin && tenants.length > 0 && (
            <div className="hidden lg:flex items-center gap-3 px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-white/5 animate-in fade-in duration-300">
              <div className="w-8 h-8 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                <Building size={16} />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[9px] font-black uppercase text-slate-400">Filial Ativa</span>
                <select 
                  value={selectedTenant}
                  onChange={(e) => handleSwitchTenant(e.target.value)}
                  className="bg-transparent text-xs font-bold uppercase text-slate-800 dark:text-slate-200 outline-none ring-0 border-none cursor-pointer p-0 pr-6"
                >
                  {tenants.map(t => (
                    <option key={t.id} value={t.id} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold uppercase">{t.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 sm:gap-4 lg:gap-6 shrink-0">
            <button 
              onClick={toggleTheme}
              className="p-2 sm:p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl border border-slate-200 dark:border-white/5 hover:bg-white dark:hover:bg-slate-700 transition-all shadow-sm active:scale-95"
              title={theme === 'light' ? 'Ativar Modo Escuro' : 'Ativar Modo Claro'}
            >
               {theme === 'light' ? <Moon size={16} /> : <Sun size={16} className="text-amber-400" />}
            </button>

            <button 
              onClick={onToggleMobile}
              className="group flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl hover:bg-black transition-all shadow-lg active:scale-95"
            >
              <Smartphone size={16} className="text-brand-primary group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-black text-white uppercase tracking-widest italic group-hover:text-brand-primary transition-colors hidden sm:inline">Smartphone View</span>
            </button>

            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-200 dark:bg-slate-800 dark:border-white/5">
               <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
               <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Sync Live</span>
            </div>
            
            <div className="h-4 w-px bg-slate-200 dark:bg-white/10 hidden sm:block" />

            <div className="relative">
              <button 
                onClick={() => setIsAlertsDropdownOpen(!isAlertsDropdownOpen)}
                className={cn(
                  "relative transition-all p-2 rounded-lg cursor-pointer focus:outline-none flex items-center justify-center",
                  panicAlerts.length > 0 
                    ? "text-red-500 hover:text-red-600 bg-red-500/10 hover:bg-red-500/20 animate-bounce" 
                    : "text-slate-400 hover:text-brand-primary hover:bg-slate-50 dark:hover:bg-slate-800"
                )}
                title={panicAlerts.length > 0 ? `${panicAlerts.length} Alertas de Pânico Ativos` : "Sem Alertas"}
              >
                <Bell size={18} className={panicAlerts.length > 0 ? "text-red-500 animate-pulse" : ""} />
                {panicAlerts.length > 0 ? (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white rounded-full text-[9px] font-black flex items-center justify-center border border-white dark:border-slate-950">
                    {panicAlerts.length}
                  </span>
                ) : null}
              </button>

              <AnimatePresence>
                {isAlertsDropdownOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden text-slate-800 dark:text-slate-100"
                  >
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                       <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                         <AlertTriangle size={14} className={panicAlerts.length > 0 ? "text-red-500" : "text-emerald-500"} />
                         Alertas de Pânico
                       </h3>
                       <button 
                         onClick={() => setIsAlertsDropdownOpen(false)}
                         className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-400"
                       >
                         <X size={14} />
                       </button>
                    </div>
                    
                    <div className="max-h-60 overflow-y-auto custom-scrollbar p-2 space-y-1.5">
                       {panicAlerts.length > 0 ? (
                          panicAlerts.map(alert => (
                             <div 
                               key={alert.id} 
                               onClick={() => {
                                 onTabChange('monitors');
                                 setIsAlertsDropdownOpen(false);
                               }}
                               className="p-3 bg-red-50/50 dark:bg-red-500/5 hover:bg-red-100/50 dark:hover:bg-red-500/10 border border-red-100/50 dark:border-red-500/10 rounded-xl transition-all cursor-pointer flex items-center justify-between"
                             >
                                <div>
                                   <p className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-tight">SOS: {alert.prefix || 'TAX-Viatura'}</p>
                                   <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-0.5">{alert.driverName || 'Motorista'}</p>
                                </div>
                                <span className="text-[8px] font-black bg-red-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse font-mono shrink-0">Ativo</span>
                             </div>
                          ))
                       ) : (
                          <div className="py-8 px-4 text-center text-slate-450 dark:text-slate-500 text-xs font-black uppercase tracking-wider">
                             🎉 Sem Alertas Pendentes!<br/>
                             <span className="text-[9px] font-semibold tracking-normal text-slate-500 dark:text-slate-650 lowercase mt-1.5 block">bom trabalho, administrador!</span>
                          </div>
                       )}
                    </div>
                    
                    {panicAlerts.length > 0 && (
                      <div className="p-2.5 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
                         <button 
                           onClick={() => {
                             onTabChange('monitors');
                             setIsAlertsDropdownOpen(false);
                           }}
                           className="w-full py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
                         >
                           Ver Detalhes do SOS
                         </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <section className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/50">
          <div className="p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </section>
      </main>
    </div>
  );
}
