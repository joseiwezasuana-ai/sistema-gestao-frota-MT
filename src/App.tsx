import React, { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  getDoc,
  doc,
  setDoc,
  where,
  getDocs
} from '@/src/lib/firebase';
import { auth, db, googleProvider, setActiveTenantId, getActiveTenantId } from './lib/firebase';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import ProfileSetup from './components/ProfileSetup';
import FleetManagement from './components/FleetManagement';
import RealTimeMap from './components/RealTimeMap';
import History from './components/History';
import Settings from './components/Settings';
import CompanyManagement from './components/CompanyManagement';
import Messages from './components/Messages';
import { WhatsAppMonitor } from './components/WhatsAppMonitor';
import RealTimeMonitor from './components/RealTimeMonitor';
import GPSTimeline from './components/GPSTimeline';
import DriverView from './components/DriverView';
import MechanicView from './components/MechanicView';
import StaffMobileView from './components/StaffMobileView';
import AlertNotificationManager from './components/AlertNotificationManager';
import MaintenanceRegistry from './components/MaintenanceRegistry';
import RevenueManagement from './components/RevenueManagement';
import RecruitmentHub from './components/RecruitmentHub';
import AccountingManager from './components/AccountingManager';
import WarehouseManager from './components/WarehouseManager';
import InternalClients from './components/InternalClients';
import RentACar from './components/RentACar';
import CompanyPhones from './components/CompanyPhones';
import ProfileEdit from './components/ProfileEdit';
import UserManual from './components/UserManual';
import CallSmsDossier from './components/CallSmsDossier';
import PassengerFlow from './components/PassengerFlow';
import PassengerManagement from './components/PassengerManagement';
import DriverDashboard from './components/DriverDashboard';
import KeyboardShortcutManager from './components/KeyboardShortcutManager';

import { 
  AlertCircle, 
  RefreshCw,
  Layout as LayoutIcon, 
  Activity, 
  Map as MapIcon,
  Copy,
  CheckCircle2,
  X
} from 'lucide-react';
import InvoiceDrafting from './components/InvoiceDrafting';
import { ThemeProvider } from './context/ThemeContext';
import { ConnectivityBanner } from './components/ConnectivityBanner';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showPublicPassengerFlow, setShowPublicPassengerFlow] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 1024 : false);
  const [viewPreference, setViewPreference] = useState<'auto' | 'mobile' | 'desktop'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('view_preference');
      if (saved && ['auto', 'mobile', 'desktop'].includes(saved)) {
        return saved as any;
      }
    }
    return 'auto';
  });

  useEffect(() => {
    localStorage.setItem('view_preference', viewPreference);
  }, [viewPreference]);

  // Public Passenger App Route Dispatcher (Requested by José Iweza Suana)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view')?.toLowerCase();
    const isCollaboratorMode = localStorage.getItem('collaborator_mode') === 'true';

    if (viewParam === 'passenger' || viewParam === 'passageiro' || window.location.hash === '#passenger') {
      setShowPublicPassengerFlow(true);
      localStorage.removeItem('collaborator_mode');
    } else if (viewParam === 'login' || viewParam === 'staff' || viewParam === 'colaborador') {
      setShowPublicPassengerFlow(false);
      localStorage.setItem('collaborator_mode', 'true');
    } else if (!viewParam && typeof window !== 'undefined') {
      if (isCollaboratorMode) {
        setShowPublicPassengerFlow(false);
      } else {
        // Auto-detect mobile devices when hitting the root URL to default straight to the passenger app
        const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobileUA) {
          setShowPublicPassengerFlow(true);
        }
      }
    }
  }, []);

  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);
  const [globalSettings, setGlobalSettings] = useState<any>(null);

  useEffect(() => {
    // Safety timeout for global settings - expanded to 15s
    const settingsTimeout = setTimeout(() => {
      if (!globalSettings) {
        console.warn("Global settings fetch reached timeout. Using defaults.");
        setGlobalSettings({
          companyName: "PSM COMERCIAL LUENA MOXICO",
          maintenanceAlerts: true
        });
      }
    }, 15000);

    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        setGlobalSettings(docSnap.data());
        clearTimeout(settingsTimeout);
      }
    }, (err) => {
      console.error("Settings snapshot error:", err);
      setDbError("Erro ao carregar definições globais: " + err.message);
    });
    return () => {
      unsubSettings();
      clearTimeout(settingsTimeout);
    };
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    // Safety timeout: if auth doesn't resolve in 8s, show login anyway
    const safetyTimeout = setTimeout(() => {
      if (loading) {
        console.warn("Auth initialization timed out, showing login.");
        setLoading(false);
      }
    }, 8000);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (!firebaseUser) {
          const savedLocalSession = localStorage.getItem('local_user_session');
          if (savedLocalSession) {
            try {
              const session = JSON.parse(savedLocalSession);
              setUser({
                uid: session.uid,
                email: session.email,
                displayName: session.name,
                isAnonymous: false,
                emailVerified: true
              } as any);
              setUserProfile(session);
              if (session.tenantId) {
                setActiveTenantId(session.tenantId);
              }
              if (session.role === 'driver') {
                setActiveTab('driver_dashboard');
              } else if (session.role === 'mecanico') {
                setActiveTab('maintenance');
              } else if (session.role === 'contabilista') {
                setActiveTab('accounting');
              }
              setLoading(false);
              clearTimeout(safetyTimeout);
              return;
            } catch (e) {
              console.error("Local session error:", e);
            }
          }
          setUser(null);
          setUserProfile(null);
          setLoading(false);
          clearTimeout(safetyTimeout);
          return;
        }

        setUser(firebaseUser);
        const profileRef = doc(db, 'users', firebaseUser.uid);
        
        // Timeout for profile fetch - expanded to 10s
        const profilePromise = getDoc(profileRef);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('timeout')), 10000)
        );

        let profileSnap;
        try {
          profileSnap = await Promise.race([profilePromise, timeoutPromise]) as any;
        } catch (e: any) {
          console.error("Profile fetch failed, using local/fallback profile:", e);
          
          // Check local storage for any existing session first
          const savedLocalSession = localStorage.getItem('local_user_session');
          if (savedLocalSession) {
            try {
              const session = JSON.parse(savedLocalSession);
              if (session && (session.uid === firebaseUser.uid || session.email === firebaseUser.email)) {
                setUserProfile(session);
                setLoading(false);
                clearTimeout(safetyTimeout);
                return;
              }
            } catch (jsonErr) {
              console.error("Error reading fallback local session:", jsonErr);
            }
          }

          // Generate fallback based on email pattern
          const email = firebaseUser.email || '';
          const name = firebaseUser.displayName || email.split('@')[0] || 'Utilizador';
          const isMaster = email.toLowerCase() === 'joseiwezasuana@gmail.com';
          
          let resolvedRole = 'operator';
          if (isMaster) {
            resolvedRole = 'admin';
          } else if (email.includes('motorista') || email.includes('driver')) {
            resolvedRole = 'driver';
          } else if (email.includes('mecanico') || email.includes('mechanic')) {
            resolvedRole = 'mecanico';
          } else if (email.includes('contabilista') || email.includes('finance')) {
            resolvedRole = 'contabilista';
          }

          const fallbackProfile = {
            uid: firebaseUser.uid,
            email: email,
            name: isMaster ? 'José Iweza Suana (Admin)' : name,
            role: resolvedRole,
            createdAt: new Date().toISOString()
          };
          
          setUserProfile(fallbackProfile);
          setLoading(false);
          clearTimeout(safetyTimeout);
          return;
        }
        
        const isMaster = firebaseUser.email?.toLowerCase() === 'joseiwezasuana@gmail.com';
        
        if (profileSnap.exists()) {
          const profile = profileSnap.data();
          if (profile && profile.role === 'operador') {
            profile.role = 'operator';
          }
          const isAdminRole = isMaster || profile.role === 'admin' || profile.role === 'gerente' || profile.role === 'operator';
          const preSelectedTenant = getActiveTenantId();
          
          if (isAdminRole && preSelectedTenant) {
            // Se for administrador e escolheu uma companhia prévia, deves mantê-la
            setActiveTenantId(preSelectedTenant);
          } else if (profile.tenantId) {
            setActiveTenantId(profile.tenantId);
          } else {
            setActiveTenantId('psm');
          }
          setUserProfile(profile);
          // If driver, reset tab or handle specific view
          if (profile.role === 'driver') {
            setActiveTab('driver_dashboard');
          } else if (profile.role === 'mecanico') {
            setActiveTab('maintenance');
          } else if (profile.role === 'contabilista') {
            setActiveTab('accounting');
          }
        } else if (isMaster) {
          // Auto-bootstrap master admin profile
          const preSelectedTenant = getActiveTenantId() || 'psm';
          const adminProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            name: 'José Iweza Suana (Admin)',
            role: 'admin',
            tenantId: preSelectedTenant,
            createdAt: new Date().toISOString()
          };
          setActiveTenantId(preSelectedTenant);
          setUserProfile(adminProfile);
          clearTimeout(safetyTimeout);
          setLoading(false);
          setDoc(doc(db, 'users', firebaseUser.uid), adminProfile).catch(console.error);
          return;
        } else {
          console.warn("User logged in but no profile found in Firestore.");
          setUserProfile(null);
        }
      } catch (err: any) {
        console.error("Auth State Error:", err);
        const currentDomain = window.location.hostname;
        const isFirebaseHosting = currentDomain.includes('firebaseapp.com') || currentDomain.includes('web.app');
        
        if (err.message === 'timeout' || err.code === 'unavailable' || err.message.includes('offline')) {
          let msg = "A ligação à base de dados está offline ou lenta.";
          if (isFirebaseHosting) {
            msg += " Verifique se o domínio foi autorizado no Console Firebase (Authentication > Settings).";
          }
          setDbError(msg);
        } else {
          setDbError(`Erro ao recuperar perfil: ${err.message}`);
        }
      } finally {
        setLoading(false);
        clearTimeout(safetyTimeout);
      }
    });

    return () => {
      unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, []);

  const configError = (window as any)._firebaseConfigError;

  if (configError) {
    return (
      <ThemeProvider>
        <ConnectivityBanner />
        <div className="flex min-h-screen w-full flex-col items-center justify-center bg-slate-950 p-8 text-center text-white font-sans">
          <div className="w-20 h-20 bg-rose-500 rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-rose-500/20">
             <AlertCircle size={40} />
          </div>
          <h1 className="text-2xl font-black mb-4 uppercase tracking-tighter">Erro de Inicialização</h1>
          
          <div className="max-w-md bg-slate-900/50 backdrop-blur-xl p-6 rounded-2xl border border-white/10 text-left mb-8 shadow-2xl">
            <p className="text-slate-300 text-sm leading-relaxed">
              Ocorreu um problema ao conectar com os serviços centrais. Por favor, verifique a sua ligação à internet ou contacte o administrador.
            </p>
            <div className="mt-4 p-3 bg-white/5 rounded-lg border border-white/5">
              <code className="text-[10px] text-rose-400 break-all">{configError}</code>
            </div>
          </div>

          <button 
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-8 py-3 bg-white/10 text-white font-black text-[11px] uppercase tracking-widest rounded-xl hover:bg-white/20 transition-all active:scale-95 border border-white/10"
          >
            <RefreshCw size={14} />
            Recarregar Sistema
          </button>
        </div>
      </ThemeProvider>
    );
  }

  if (loading) {
    return (
      <ThemeProvider>
        <ConnectivityBanner />
        <div key="loading-state" className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-slate-950">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-primary border-t-transparent shadow-xl shadow-brand-primary/20"></div>
            <p className="text-slate-500 dark:text-slate-400 animate-pulse font-black text-xs uppercase tracking-[0.3em] italic">PSM TaxiControl v6.5 Inicializando...</p>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  if (showPublicPassengerFlow) {
    return (
      <ThemeProvider>
         <ConnectivityBanner />
         <div className="min-h-screen relative w-full overflow-hidden bg-slate-950 flex items-center justify-center">
            <PassengerFlow 
              isPublicApp={true} 
              onBackToStaff={() => {
                localStorage.setItem('collaborator_mode', 'true');
                setShowPublicPassengerFlow(false);
              }}
            />
         </div>
      </ThemeProvider>
    );
  }

  if (!user) {
    const handleGoogleLogin = async () => {
      // Direct call to avoid popup blocking
      return signInWithPopup(auth, googleProvider);
    };
    return (
      <ThemeProvider>
        <ConnectivityBanner />
        <Login 
          key="login-view" 
          onGoogleLogin={handleGoogleLogin} 
          onPassengerFlow={() => {
            localStorage.removeItem('collaborator_mode');
            setShowPublicPassengerFlow(true);
          }} 
        />
      </ThemeProvider>
    );
  }

  if (!userProfile) {
    return (
      <ThemeProvider>
        <ConnectivityBanner />
        <ProfileSetup key="setup-view" user={user} onComplete={setUserProfile} />
      </ThemeProvider>
    );
  }

  const isMasterAdmin = user?.email?.toLowerCase() === 'joseiwezasuana@gmail.com';
  const isAdmin = isMasterAdmin || userProfile?.role === 'admin' || userProfile?.role === 'gerente';
  const isDriver = userProfile?.role === 'driver';
  const isMecanico = userProfile?.role === 'mecanico';
  const isContabilista = userProfile?.role === 'contabilista';
  const isOperator = isAdmin || userProfile?.role === 'operator';
  const shouldNotifyAlert = isAdmin || userProfile?.role === 'operator';

  // Admin, Operators, and Accounting roles get a specialized Mobile View on small screens
  // We check for viewPreference first, then fallback to isMobile if auto
  const shouldShowMobile = (viewPreference === 'mobile') || (viewPreference === 'auto' && isMobile);
  const isAdminOrStaff = (isAdmin || isOperator || isContabilista);

  if (shouldShowMobile && isAdminOrStaff) {
    return (
      <ThemeProvider>
        <ConnectivityBanner />
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
          {shouldNotifyAlert && <AlertNotificationManager />}
          <StaffMobileView 
            user={userProfile} 
            onLogout={() => signOut(auth)} 
            onExitMobile={() => setViewPreference('desktop')}
          />
        </div>
      </ThemeProvider>
    );
  }

  // Drivers and Mechanics get a full-screen mobile-style view
  if (isMecanico) {
    return (
      <ThemeProvider>
        <ConnectivityBanner />
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
          {shouldNotifyAlert && <AlertNotificationManager />}
          <MechanicView user={userProfile} />
        </div>
      </ThemeProvider>
    );
  }

  if (isDriver) {
    return (
      <ThemeProvider>
        <ConnectivityBanner />
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
          {shouldNotifyAlert && <AlertNotificationManager />}
          <DriverView user={userProfile} />
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <ConnectivityBanner />
      <KeyboardShortcutManager user={userProfile} activeTab={activeTab} onTabChange={setActiveTab} />
      <div key="authed-layout" className="min-h-screen">
        <Layout 
          user={userProfile} 
          globalSettings={globalSettings}
          activeTab={activeTab} 
          onTabChange={setActiveTab}
          onLogout={async () => {
            localStorage.removeItem('local_user_session');
            await signOut(auth);
            setUser(null);
            setUserProfile(null);
          }}
          onToggleMobile={() => setViewPreference('mobile')}
          onEditProfile={() => setIsProfileEditOpen(true)}
        >
          {shouldNotifyAlert && <AlertNotificationManager />}
          <ProfileEdit 
            user={userProfile} 
            isOpen={isProfileEditOpen} 
            onClose={() => setIsProfileEditOpen(false)}
            onUpdate={setUserProfile}
          />
          {dbError && (
            <div className="bg-amber-100 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800/30 px-4 py-2 text-amber-800 dark:text-amber-200 text-xs font-bold flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="animate-pulse h-2 w-2 rounded-full bg-amber-500" />
                <span>{dbError}</span>
              </div>
              <button 
                onClick={() => setDbError(null)} 
                className="hover:bg-amber-200 dark:hover:bg-amber-800/50 p-1 rounded transition-all text-slate-500 hover:text-slate-800 dark:hover:text-white"
                title="Fechar aviso"
              >
                <X size={14} />
              </button>
            </div>
          )}
          {activeTab === 'dashboard' && <Dashboard user={userProfile} />}
          {activeTab === 'driver_dashboard' && <DriverDashboard />}
          {activeTab === 'recruitment' && (isAdmin ? <RecruitmentHub user={userProfile} /> : <Dashboard user={userProfile} />)}
          {activeTab === 'fleet' && (isAdmin || isOperator || isMecanico || isContabilista ? <FleetManagement user={userProfile} /> : <Dashboard user={userProfile} />)}
          {activeTab === 'monitors' && <RealTimeMonitor user={userProfile} />}
          {activeTab === 'revenue' && (isAdmin || isOperator || isContabilista ? <RevenueManagement user={userProfile} /> : <Dashboard user={userProfile} />)}
          {activeTab === 'passengers' && (isAdmin || isOperator ? <PassengerManagement user={userProfile} /> : <Dashboard user={userProfile} />)}
          {activeTab === 'map' && <RealTimeMap />}
          {activeTab === 'gps_timeline' && <GPSTimeline />}
          {activeTab === 'history' && <History />}
          {activeTab === 'maintenance' && (isAdmin || isOperator || isMecanico || isContabilista ? <MaintenanceRegistry user={userProfile} /> : <Dashboard user={userProfile} />)}
          {activeTab === 'accounting' && (isAdmin || isContabilista ? <AccountingManager user={userProfile} /> : <Dashboard user={userProfile} />)}
          {activeTab === 'warehouse' && (isAdmin || isOperator || isMecanico ? <WarehouseManager user={userProfile} /> : <Dashboard user={userProfile} />)}
          {activeTab === 'psm_phones' && (isAdmin || isOperator ? <CompanyPhones /> : <Dashboard user={userProfile} />)}
          {activeTab === 'manual' && <UserManual />}
          {activeTab === 'settings' && (isAdmin ? <Settings /> : <Dashboard user={userProfile} />)}
          {activeTab === 'messages' && (isAdmin || isOperator ? <Messages isAdmin={isAdmin} /> : <Dashboard user={userProfile} />)}
          {activeTab === 'call_sms_dossier' && (isAdmin || isOperator ? <CallSmsDossier /> : <Dashboard user={userProfile} />)}
          {activeTab === 'baileys_gateway' && (isAdmin || isOperator ? <WhatsAppMonitor isAdmin={isAdmin} /> : <Dashboard user={userProfile} />)}
        </Layout>
      </div>
    </ThemeProvider>
  );
}

function handleLogin() {
  signInWithPopup(auth, googleProvider);
}

// Wrapper to handle non-admin fallback if needed, or simply use Dashboard
function DashboardStatusWrapper({ component: Component }: any) {
  return <Component />;
}
