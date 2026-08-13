import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import Login from './components/Login';
import ProfileSetup from './components/ProfileSetup';
import AlertNotificationManager from './components/AlertNotificationManager';
import ProfileEdit from './components/ProfileEdit';
import KeyboardShortcutManager from './components/KeyboardShortcutManager';

// Code splitting / Lazy-loaded subcomponents for improved initial bundle size and performance
const Dashboard = React.lazy(() => import('./components/Dashboard'));
const FleetManagement = React.lazy(() => import('./components/FleetManagement'));
const RealTimeMap = React.lazy(() => import('./components/RealTimeMap'));
const History = React.lazy(() => import('./components/History'));
const Settings = React.lazy(() => import('./components/Settings'));
const CompanyManagement = React.lazy(() => import('./components/CompanyManagement'));
const Messages = React.lazy(() => import('./components/Messages'));
const WhatsAppMonitor = React.lazy(() => import('./components/WhatsAppMonitor').then(m => ({ default: m.WhatsAppMonitor })));
const RealTimeMonitor = React.lazy(() => import('./components/RealTimeMonitor'));
const GPSTimeline = React.lazy(() => import('./components/GPSTimeline'));
const DriverView = React.lazy(() => import('./components/DriverView'));
const MechanicView = React.lazy(() => import('./components/MechanicView'));
const StaffMobileView = React.lazy(() => import('./components/StaffMobileView'));
const MaintenanceRegistry = React.lazy(() => import('./components/MaintenanceRegistry'));
const RevenueManagement = React.lazy(() => import('./components/RevenueManagement'));
const RecruitmentHub = React.lazy(() => import('./components/RecruitmentHub'));
const AccountingManager = React.lazy(() => import('./components/AccountingManager'));
const WarehouseManager = React.lazy(() => import('./components/WarehouseManager'));
const InternalClients = React.lazy(() => import('./components/InternalClients'));
const RentACar = React.lazy(() => import('./components/RentACar'));
const CompanyPhones = React.lazy(() => import('./components/CompanyPhones'));
const UserManual = React.lazy(() => import('./components/UserManual'));
const CallSmsDossier = React.lazy(() => import('./components/CallSmsDossier'));
const PassengerFlow = React.lazy(() => import('./components/PassengerFlow'));
const PassengerManagement = React.lazy(() => import('./components/PassengerManagement'));
const SystemErrorLogs = React.lazy(() => import('./components/SystemErrorLogs'));
const ShiftMonitor = React.lazy(() => import('./components/ShiftMonitor'));
const DriverDashboard = React.lazy(() => import('./components/DriverDashboard'));
const InvoiceDrafting = React.lazy(() => import('./components/InvoiceDrafting'));
const ApkDistributionHub = React.lazy(() => import('./components/ApkDistributionHub'));

import { 
  AlertCircle, 
  AlertTriangle,
  Download,
  Sparkles,
  RefreshCw,
  Layout as LayoutIcon, 
  Activity, 
  Map as MapIcon,
  Copy,
  CheckCircle2,
  X,
  Car
} from 'lucide-react';
import { motion } from 'motion/react';
import { ThemeProvider } from './context/ThemeContext';
import { ConnectivityBanner } from './components/ConnectivityBanner';
import { PullToRefresh } from './components/PullToRefresh';

const CURRENT_SYSTEM_VERSION = '6.0.0';

const MandatoryUpdateModal = ({
  versionDiscrepancy,
  onDismiss
}: {
  versionDiscrepancy: { runningVersion: string; requiredVersion: string; apkDetails: any };
  onDismiss: () => void;
}) => {
  return (
    <div className="fixed inset-0 z-[99999] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto font-sans">
      <div className="bg-white dark:bg-slate-900 border border-red-500/30 dark:border-red-500/30 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative text-slate-900 dark:text-white my-auto animate-in fade-in zoom-in duration-200">
        
        {/* Header Badge */}
        <div className="flex items-center justify-between mb-4">
          <div className="bg-red-500/10 dark:bg-red-500/20 border border-red-500/30 text-red-600 dark:text-red-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 animate-bounce" />
            <span>Atualização Obrigatória</span>
          </div>
          <span className="text-[10px] font-mono font-bold text-slate-400">JIS ANGOLA • TAXICONTROL</span>
        </div>

        {/* Title */}
        <h3 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
          Discrepância de Versão Detetada
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
          A versão do sistema em execução no seu dispositivo (<span className="font-mono font-bold text-red-500">v{versionDiscrepancy.runningVersion}</span>) difere da versão oficial guardada no servidor (<span className="font-mono font-bold text-emerald-500">v{versionDiscrepancy.requiredVersion}</span>). Por motivos de estabilidade e segurança da frota, é necessário atualizar.
        </p>

        {/* Version Compare Cards */}
        <div className="grid grid-cols-2 gap-3 my-5 p-3.5 bg-slate-100 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/50 text-center">
          <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-red-200 dark:border-red-900/50">
            <span className="text-[9px] font-black uppercase text-slate-400 block mb-1">Versão em Execução</span>
            <span className="text-sm font-mono font-black text-red-600 dark:text-red-400">v{versionDiscrepancy.runningVersion}</span>
            <span className="text-[8px] font-bold text-red-500 block uppercase mt-0.5">⚠️ Desatualizada</span>
          </div>
          <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-900/50">
            <span className="text-[9px] font-black uppercase text-slate-400 block mb-1">Versão Guardada Servidor</span>
            <span className="text-sm font-mono font-black text-emerald-600 dark:text-emerald-400">v{versionDiscrepancy.requiredVersion}</span>
            <span className="text-[8px] font-bold text-emerald-500 block uppercase mt-0.5">✓ Requerida</span>
          </div>
        </div>

        {/* Release Notes */}
        {versionDiscrepancy.apkDetails?.releaseNotes && (
          <div className="mb-5 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-left">
            <span className="text-[9.5px] font-black uppercase text-amber-600 dark:text-amber-400 block mb-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Notas de Lançamento (v{versionDiscrepancy.requiredVersion})
            </span>
            <p className="text-[11px] text-slate-700 dark:text-slate-300 italic leading-snug">
              "{versionDiscrepancy.apkDetails.releaseNotes}"
            </p>
          </div>
        )}

        {/* Download Buttons */}
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider text-left mb-1">
            Descarregar Ficheiro APK Oficial:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {versionDiscrepancy.apkDetails?.passengerAppUrl && (
              <a 
                href={versionDiscrepancy.apkDetails.passengerAppUrl}
                download
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-700 dark:text-amber-300 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all text-center"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Passageiro</span>
              </a>
            )}
            {versionDiscrepancy.apkDetails?.driverAppUrl && (
              <a 
                href={versionDiscrepancy.apkDetails.driverAppUrl}
                download
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-700 dark:text-amber-300 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all text-center"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Motorista</span>
              </a>
            )}
            {versionDiscrepancy.apkDetails?.staffAppUrl && (
              <a 
                href={versionDiscrepancy.apkDetails.staffAppUrl}
                download
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-700 dark:text-amber-300 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all text-center"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Staff / Gestão</span>
              </a>
            )}
          </div>

          {/* Refresh App Button */}
          <button
            onClick={() => window.location.reload()}
            className="w-full mt-3 py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 animate-spin-slow" />
            <span>Recarregar Aplicação Agora</span>
          </button>

          {/* Dismiss button */}
          <button
            onClick={onDismiss}
            className="w-full py-2 px-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-[10px] font-bold uppercase tracking-wider transition-all mt-1 cursor-pointer"
          >
            Continuar em Modo de Inspeção
          </button>
        </div>

      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showPublicPassengerFlow, setShowPublicPassengerFlow] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 1024 : false);
  const [versionDiscrepancy, setVersionDiscrepancy] = useState<{
    runningVersion: string;
    requiredVersion: string;
    apkDetails: any;
  } | null>(null);
  const [dismissedUpdateNotice, setDismissedUpdateNotice] = useState(false);
  const startTimeRef = useRef<number>(Date.now());

  const finishLoading = useCallback(() => {
    const MIN_SPLASH_TIME = 5000; // Min 5 seconds requested by José Iweza Suana (JIS)
    const elapsed = Date.now() - startTimeRef.current;
    const remaining = Math.max(0, MIN_SPLASH_TIME - elapsed);
    setTimeout(() => {
      setLoading(false);
    }, remaining);
  }, []);

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
    if (typeof window !== 'undefined') {
      const href = window.location.href.toLowerCase();
      const search = window.location.search.toLowerCase();
      const hash = window.location.hash.toLowerCase();

      // Check if URL search parameters, hash, or full URL specify passenger app
      const isPassengerRoute = 
        search.includes('passenger') || 
        search.includes('passageiro') || 
        hash.includes('passenger') || 
        hash.includes('passageiro') || 
        href.includes('=passenger') || 
        href.includes('=passageiro');

      if (isPassengerRoute) {
        setShowPublicPassengerFlow(true);
      } else {
        // Default URL (e.g. JIS-st.web.app) opens the Collaborator / Staff Portal
        setShowPublicPassengerFlow(false);
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

  // Verify latest APK Distribution version on startup and compare with running version
  useEffect(() => {
    const unsubApkCheck = onSnapshot(doc(db, 'settings', 'apk_distribution'), async (docSnap) => {
      if (!docSnap.exists()) {
        // Seed default APK Distribution config in Firestore
        try {
          await setDoc(doc(db, 'settings', 'apk_distribution'), {
            version: CURRENT_SYSTEM_VERSION,
            releaseDate: '2026-08-10',
            buildNumber: '60021',
            isCriticalUpdate: true,
            notifyOnStartup: true,
            minAndroidVersion: 'Android 8.0+ (API 26)',
            storageProvider: 'Alojamento Próprio (JIS Angola Cloud Server)',
            releaseNotes: 'Versão 6.0 Enterprise com suporte a Módulos Offline, Telemetria GPS 24h, Chat de Equipa com Alertas SOS, e Integração Contabilística em Tempo Real.',
            driverAppUrl: 'https://github.com/joseiwezasuana-ai/sistema-gestao-frota-MT/releases/download/v6.0.0/supertaxi-driver-v6.0.0.apk',
            driverAppSize: '18.4 MB',
            staffAppUrl: 'https://github.com/joseiwezasuana-ai/sistema-gestao-frota-MT/releases/download/v6.0.0/supertaxi-staff-v6.0.0.apk',
            staffAppSize: '21.2 MB',
            passengerAppUrl: 'https://github.com/joseiwezasuana-ai/sistema-gestao-frota-MT/releases/download/v6.0.0/supertaxi-passenger-v6.0.0.apk',
            passengerAppSize: '16.8 MB'
          }, { merge: true });
        } catch (err) {
          console.warn("Error seeding apk_distribution defaults:", err);
        }
        setVersionDiscrepancy(null);
      } else {
        const data = docSnap.data();
        const savedVersion = (data?.version || '').trim();
        if (savedVersion && savedVersion !== CURRENT_SYSTEM_VERSION) {
          console.warn(`[VersionCheck] Discrepancy: Running v${CURRENT_SYSTEM_VERSION} vs Firestore v${savedVersion}`);
          setVersionDiscrepancy({
            runningVersion: CURRENT_SYSTEM_VERSION,
            requiredVersion: savedVersion,
            apkDetails: data
          });
        } else {
          setVersionDiscrepancy(null);
        }
      }
    }, (err) => console.warn("APK startup check fallback:", err));

    return () => unsubApkCheck();
  }, []);

  useEffect(() => {
    // Safety timeout: if auth doesn't resolve in 12s, show login anyway
    const safetyTimeout = setTimeout(() => {
      if (loading) {
        console.warn("Auth initialization timed out, showing login.");
        finishLoading();
      }
    }, 12000);

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
              finishLoading();
              clearTimeout(safetyTimeout);
              return;
            } catch (e) {
              console.error("Local session error:", e);
            }
          }
          setUser(null);
          setUserProfile(null);
          finishLoading();
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
                finishLoading();
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
          finishLoading();
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
          finishLoading();
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
        finishLoading();
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
        <ConnectivityBanner user={userProfile || user} />
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
    const letters = "TAXICONTROL".split("");
    return (
      <ThemeProvider>
        <ConnectivityBanner user={userProfile || user} />
        <div key="loading-state" className="flex h-screen w-full items-center justify-center bg-slate-950 text-white overflow-hidden relative selection:bg-amber-500 selection:text-slate-950">
          {/* Ambient background glow */}
          <div className="absolute w-96 h-96 bg-blue-600/10 rounded-full blur-3xl -top-20 -left-20 pointer-events-none" />
          <div className="absolute w-96 h-96 bg-amber-500/10 rounded-full blur-3xl -bottom-20 -right-20 pointer-events-none" />

          <div className="flex flex-col items-center justify-center gap-6 relative z-10 px-4">
            {/* Animated Car Icon emblem */}
            <motion.div 
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
              className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-blue-600 via-blue-500 to-amber-500 p-0.5 shadow-2xl shadow-blue-500/30"
            >
              <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center p-1 overflow-hidden">
                <img src="/logo.svg" alt="TaxiControl" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              </div>
            </motion.div>

            {/* Letter-by-letter TAXICONTROL animation */}
            <div className="flex items-center justify-center gap-1 sm:gap-2">
              {letters.map((char, index) => (
                <motion.span
                  key={index}
                  initial={{ opacity: 0, y: 30, scale: 0.5, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                  transition={{ 
                    duration: 0.45, 
                    delay: index * 0.08,
                    ease: "easeOut"
                  }}
                  className={`text-3xl sm:text-5xl font-black tracking-widest uppercase font-sans drop-shadow-md ${
                    index < 4 ? 'text-blue-400' : 'text-amber-400'
                  }`}
                >
                  {char}
                </motion.span>
              ))}
            </div>

            {/* Animated Loading Bar */}
            <div className="w-48 sm:w-64 h-1.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-white/10 shadow-inner">
              <motion.div 
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 2.2, ease: "easeInOut", repeat: Infinity }}
                className="h-full bg-gradient-to-r from-blue-500 via-amber-400 to-amber-500 rounded-full shadow-lg shadow-amber-500/50"
              />
            </div>

            {/* Subtext */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9, duration: 0.5 }}
              className="flex items-center gap-2"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
              <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.35em] text-slate-400 italic">
                - JIS ANGOLA • MOBILIDADE OFICIAL -
              </p>
            </motion.div>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  if (showPublicPassengerFlow) {
    return (
      <ThemeProvider>
        {versionDiscrepancy && !dismissedUpdateNotice && (
          <MandatoryUpdateModal 
            versionDiscrepancy={versionDiscrepancy} 
            onDismiss={() => setDismissedUpdateNotice(true)} 
          />
        )}
        <PullToRefresh>
          <ConnectivityBanner user={userProfile || user} />
          <div className="min-h-screen relative w-full bg-slate-950 flex flex-col items-center justify-center">
            <React.Suspense fallback={
              <div className="flex flex-col items-center justify-center gap-4 text-white font-sans">
                <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-black uppercase tracking-widest text-slate-400 animate-pulse">A carregar aplicação...</span>
              </div>
            }>
              <PassengerFlow isPublicApp={true} />
            </React.Suspense>
          </div>
        </PullToRefresh>
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
        {versionDiscrepancy && !dismissedUpdateNotice && (
          <MandatoryUpdateModal 
            versionDiscrepancy={versionDiscrepancy} 
            onDismiss={() => setDismissedUpdateNotice(true)} 
          />
        )}
        <PullToRefresh>
          <ConnectivityBanner user={userProfile || user} />
          <Login 
            key="login-view" 
            onGoogleLogin={handleGoogleLogin} 
            onPassengerFlow={() => {
              localStorage.removeItem('collaborator_mode');
              setShowPublicPassengerFlow(true);
            }} 
          />
        </PullToRefresh>
      </ThemeProvider>
    );
  }

  if (!userProfile) {
    return (
      <ThemeProvider>
        {versionDiscrepancy && !dismissedUpdateNotice && (
          <MandatoryUpdateModal 
            versionDiscrepancy={versionDiscrepancy} 
            onDismiss={() => setDismissedUpdateNotice(true)} 
          />
        )}
        <PullToRefresh>
          <ConnectivityBanner user={userProfile || user} />
          <ProfileSetup key="setup-view" user={user} onComplete={setUserProfile} />
        </PullToRefresh>
      </ThemeProvider>
    );
  }

  const isMasterAdmin = user?.email?.toLowerCase() === 'joseiwezasuana@gmail.com';
  const isAdmin = isMasterAdmin || userProfile?.role === 'admin' || userProfile?.role === 'gerente';
  const isDriver = userProfile?.role === 'driver';
  const isMecanico = userProfile?.role === 'mecanico';
  const isContabilista = userProfile?.role === 'contabilista';
  const isOperator = isAdmin || userProfile?.role === 'operator';
  const shouldNotifyAlert = !!userProfile;

  // Admin, Operators, and Accounting roles get a specialized Mobile View on small screens
  // We check for viewPreference first, then fallback to isMobile if auto
  const shouldShowMobile = (viewPreference === 'mobile') || (viewPreference === 'auto' && isMobile);
  const isAdminOrStaff = (isAdmin || isOperator || isContabilista);

  if (shouldShowMobile && isAdminOrStaff) {
    return (
      <ThemeProvider>
        {versionDiscrepancy && !dismissedUpdateNotice && (
          <MandatoryUpdateModal 
            versionDiscrepancy={versionDiscrepancy} 
            onDismiss={() => setDismissedUpdateNotice(true)} 
          />
        )}
        <PullToRefresh>
          <ConnectivityBanner user={userProfile || user} />
          <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            {shouldNotifyAlert && <AlertNotificationManager user={userProfile} />}
            <React.Suspense fallback={
              <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-950 text-white font-sans">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-black uppercase tracking-widest text-slate-400 animate-pulse">A carregar portal...</span>
              </div>
            }>
              <StaffMobileView 
                user={userProfile} 
                onLogout={() => signOut(auth)} 
                onExitMobile={() => setViewPreference('desktop')}
              />
            </React.Suspense>
          </div>
        </PullToRefresh>
      </ThemeProvider>
    );
  }

  // Drivers and Mechanics get a full-screen mobile-style view
  if (isMecanico) {
    return (
      <ThemeProvider>
        {versionDiscrepancy && !dismissedUpdateNotice && (
          <MandatoryUpdateModal 
            versionDiscrepancy={versionDiscrepancy} 
            onDismiss={() => setDismissedUpdateNotice(true)} 
          />
        )}
        <PullToRefresh>
          <ConnectivityBanner user={userProfile || user} />
          <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            {shouldNotifyAlert && <AlertNotificationManager user={userProfile} />}
            <React.Suspense fallback={
              <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-950 text-white font-sans">
                <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-black uppercase tracking-widest text-slate-400 animate-pulse">A carregar painel mecânico...</span>
              </div>
            }>
              <MechanicView user={userProfile} />
            </React.Suspense>
          </div>
        </PullToRefresh>
      </ThemeProvider>
    );
  }

  if (isDriver) {
    return (
      <ThemeProvider>
        {versionDiscrepancy && !dismissedUpdateNotice && (
          <MandatoryUpdateModal 
            versionDiscrepancy={versionDiscrepancy} 
            onDismiss={() => setDismissedUpdateNotice(true)} 
          />
        )}
        <PullToRefresh>
          <ConnectivityBanner user={userProfile || user} />
          <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            {shouldNotifyAlert && <AlertNotificationManager user={userProfile} />}
            <React.Suspense fallback={
              <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-950 text-white font-sans">
                <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-black uppercase tracking-widest text-slate-400 animate-pulse">A carregar painel motorista...</span>
              </div>
            }>
              <DriverView user={userProfile} />
            </React.Suspense>
          </div>
        </PullToRefresh>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      {versionDiscrepancy && !dismissedUpdateNotice && (
        <MandatoryUpdateModal 
          versionDiscrepancy={versionDiscrepancy} 
          onDismiss={() => setDismissedUpdateNotice(true)} 
        />
      )}
      <PullToRefresh>
        <ConnectivityBanner user={userProfile || user} />
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
            {shouldNotifyAlert && <AlertNotificationManager user={userProfile} />}
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
            <React.Suspense fallback={
              <div className="p-12 flex flex-col items-center justify-center gap-4 text-slate-500 dark:text-slate-400 font-sans">
                <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-[10px] font-black uppercase tracking-widest animate-pulse">A carregar módulo...</span>
              </div>
            }>
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
              {activeTab === 'baileys_gateway' && <WhatsAppMonitor isAdmin={isAdmin} />}
              {activeTab === 'system_logs' && (isAdmin ? <SystemErrorLogs user={userProfile} /> : <Dashboard user={userProfile} />)}
              {activeTab === 'shift_monitor' && (isAdmin || isOperator || isMecanico ? <RealTimeMonitor user={userProfile} initialSubTab="shifts" /> : <Dashboard user={userProfile} />)}
              {activeTab === 'apk_distribution' && <ApkDistributionHub user={userProfile} />}
            </React.Suspense>
          </Layout>
        </div>
      </PullToRefresh>
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
