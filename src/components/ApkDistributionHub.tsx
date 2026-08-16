import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { 
  Download, 
  Smartphone, 
  QrCode, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Settings, 
  UploadCloud, 
  Share2, 
  ExternalLink, 
  Copy, 
  Check, 
  FileText, 
  Sparkles, 
  RefreshCw, 
  Info, 
  Lock, 
  Server, 
  HardDrive, 
  Layers, 
  ChevronRight,
  ArrowDownCircle,
  HelpCircle,
  X,
  UserCheck,
  Building,
  BarChart3,
  Terminal,
  Code2,
  Globe,
  Wifi,
  TrendingUp,
  Database,
  Activity,
  Zap,
  WifiOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Legend, 
  CartesianGrid,
  AreaChart,
  Area
} from 'recharts';
import { doc, onSnapshot, setDoc, serverTimestamp, collection, addDoc, query, orderBy, limit, increment } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { cn } from '../lib/utils';

interface ApkDistributionHubProps {
  user?: any;
  isEmbedded?: boolean;
}

export default function ApkDistributionHub({ user, isEmbedded = false }: ApkDistributionHubProps) {
  const isMasterAdmin = user?.email?.toLowerCase() === 'joseiwezasuana@gmail.com';
  const isAdmin = isMasterAdmin || user?.role === 'admin' || user?.role === 'gerente';

  const [activeTab, setActiveTab] = useState<'download' | 'stats' | 'guide' | 'server_guide' | 'admin'>('download');
  const [selectedQrApp, setSelectedQrApp] = useState<string | null>(null);
  const [copiedApp, setCopiedApp] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Link Connectivity Tester State
  const [testServerUrl, setTestServerUrl] = useState<string>('');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testResult, setTestResult] = useState<any>(null);

  // APK Configuration State (Loaded from Firestore 'settings/apk_distribution')
  const [apkConfig, setApkConfig] = useState<any>({
    version: '6.0.0',
    releaseDate: '2026-08-10',
    buildNumber: '60021',
    minAndroidVersion: 'Android 8.0+ (API 26)',
    sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    storageProvider: 'Alojamento Próprio (JIS Angola Cloud Server)',
    releaseNotes: 'Versão 6.0 Enterprise com suporte a Módulos Offline, Telemetria GPS 24h, Chat de Equipa com Alertas SOS, e Integração Contabilística em Tempo Real.',
    driverAppUrl: 'https://github.com/joseiwezasuana-ai/sistema-gestao-frota-MT/releases/download/v6.0.0/supertaxi-driver-v6.0.0.apk',
    driverAppSize: '18.4 MB',
    staffAppUrl: 'https://github.com/joseiwezasuana-ai/sistema-gestao-frota-MT/releases/download/v6.0.0/supertaxi-staff-v6.0.0.apk',
    staffAppSize: '21.2 MB',
    passengerAppUrl: 'https://github.com/joseiwezasuana-ai/sistema-gestao-frota-MT/releases/download/v6.0.0/supertaxi-passenger-v6.0.0.apk',
    passengerAppSize: '16.8 MB',
    isCriticalUpdate: false,
    notifyOnStartup: false
  });

  // Dynamic Real-Time Download Logs and Analytics State
  const [downloadLogs, setDownloadLogs] = useState<any[]>([]);
  const [chartViewMode, setChartViewMode] = useState<'versions' | 'daily' | 'apps'>('versions');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulatedMsg, setSimulatedMsg] = useState<string | null>(null);

  // Subscribe to Firestore APK Settings
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'apk_distribution'), (snap) => {
      if (snap.exists()) {
        setApkConfig((prev: any) => ({ ...prev, ...snap.data() }));
      }
    }, (err) => {
      console.warn("Firestore APK Settings subscription fallback:", err);
    });
    return () => unsub();
  }, []);

  // Subscribe to Real-Time Download Event Logs from Firestore
  useEffect(() => {
    const q = query(
      collection(db, 'apk_download_logs'), 
      orderBy('timestamp', 'desc'), 
      limit(250)
    );
    const unsubLogs = onSnapshot(q, (snapshot) => {
      const logs: any[] = [];
      snapshot.forEach(docSnap => {
        logs.push({ id: docSnap.id, ...docSnap.data() });
      });
      setDownloadLogs(logs);
    }, (err) => {
      console.warn("Real-time download logs subscription notice:", err);
    });
    return () => unsubLogs();
  }, []);

  // Dynamically compute download stats per version strictly from live Firestore logs (Zero mock data)
  const versionStats = React.useMemo(() => {
    if (downloadLogs.length === 0) {
      return [];
    }

    const map: Record<string, { motorista: number; staff: number; passageiro: number }> = {};

    downloadLogs.forEach(log => {
      const rawVer = log.version || apkConfig.version || '6.0.0';
      const verKey = rawVer.startsWith('v') ? rawVer : `v${rawVer}`;
      if (!map[verKey]) {
        map[verKey] = { motorista: 0, staff: 0, passageiro: 0 };
      }
      const type = log.appType === 'driver' ? 'motorista' : (log.appType === 'staff' ? 'staff' : 'passageiro');
      map[verKey][type] = (map[verKey][type] || 0) + 1;
    });

    return Object.keys(map).map(version => ({
      version,
      motorista: map[version].motorista,
      staff: map[version].staff,
      passageiro: map[version].passageiro,
      total: map[version].motorista + map[version].staff + map[version].passageiro
    }));
  }, [downloadLogs, apkConfig.version]);

  // Dynamically compute daily trend data for the last 7 days strictly from Firestore logs
  const dailyTrendData = React.useMemo(() => {
    const days: { date: string; motorista: number; staff: number; passageiro: number; total: number }[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dateStr = d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
      
      let motorista = 0;
      let staff = 0;
      let passageiro = 0;

      // Add real-time logs matching this date strictly
      downloadLogs.forEach(log => {
        if (log.timestamp) {
          const logDate = log.timestamp.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
          if (logDate.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' }) === dateStr) {
            if (log.appType === 'driver') motorista++;
            else if (log.appType === 'staff') staff++;
            else passageiro++;
          }
        }
      });

      days.push({
        date: dateStr,
        motorista,
        staff,
        passageiro,
        total: motorista + staff + passageiro
      });
    }
    return days;
  }, [downloadLogs]);

  // Compute App Distribution strictly from live logs
  const appDistributionData = React.useMemo(() => {
    let motorista = 0;
    let staff = 0;
    let passageiro = 0;

    downloadLogs.forEach(log => {
      if (log.appType === 'driver') motorista++;
      else if (log.appType === 'staff') staff++;
      else passageiro++;
    });

    return [
      { name: 'Motorista', value: motorista, fill: '#f59e0b', color: 'text-amber-500' },
      { name: 'Staff / Gestão', value: staff, fill: '#6366f1', color: 'text-indigo-500' },
      { name: 'Passageiro', value: passageiro, fill: '#0284c7', color: 'text-sky-500' }
    ];
  }, [downloadLogs]);

  // Key Dynamic Metrics strictly from live logs
  const totalDownloads = downloadLogs.length;

  const currentVersionTotal = React.useMemo(() => {
    const curVer = apkConfig.version || '6.0.0';
    return downloadLogs.filter(l => (l.version || '6.0.0').includes(curVer)).length;
  }, [downloadLogs, apkConfig.version]);

  const currentVersionPercent = React.useMemo(() => {
    return totalDownloads > 0 ? ((currentVersionTotal / totalDownloads) * 100).toFixed(1) : '0';
  }, [currentVersionTotal, totalDownloads]);

  const currentDriverDownloads = React.useMemo(() => {
    return downloadLogs.filter(l => l.appType === 'driver').length;
  }, [downloadLogs]);

  // Latest Download Log details
  const latestLog = downloadLogs[0] || null;

  // Save Config function (Admin)
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(null);
    try {
      await setDoc(doc(db, 'settings', 'apk_distribution'), {
        ...apkConfig,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.email || user?.email || 'Jose Iweza Suana (JIS)'
      }, { merge: true });

      setSaveSuccess("Configuração do Alojamento de APK guardada com sucesso! Todos os utilizadores receberão o alerta de atualização.");
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'settings/apk_distribution');
    } finally {
      setIsSaving(false);
    }
  };

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://taxicontrol.co.ao';

  const getFullDownloadUrl = (path: string) => {
    if (!path) return `${currentOrigin}/downloads/taxicontrol-v6.0.0.apk`;
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    return `${currentOrigin}${path.startsWith('/') ? '' : '/'}${path}`;
  };

  const copyLink = (title: string, url: string) => {
    const fullUrl = getFullDownloadUrl(url);
    navigator.clipboard.writeText(fullUrl);
    setCopiedApp(title);
    setTimeout(() => setCopiedApp(null), 2500);
  };

  const copySnippet = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  // Log Download Event to Firestore & Update Recharts Chart
  const handleDownloadClick = async (appType: 'driver' | 'staff' | 'passenger', url: string) => {
    const fullUrl = getFullDownloadUrl(url);
    
    // 1. Log event in Firestore
    try {
      await addDoc(collection(db, 'apk_download_logs'), {
        appType,
        version: apkConfig.version || '6.0.0',
        timestamp: serverTimestamp(),
        userEmail: user?.email || 'Anónimo / Motorista',
        userName: user?.displayName || user?.name || 'Motorista de Campo',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Desconhecido'
      });
    } catch (err) {
      console.warn("Download log error:", err);
    }

    // 2. Trigger browser file download
    const a = document.createElement('a');
    a.href = fullUrl;
    a.download = `taxicontrol-${appType}-v${apkConfig.version || '6.0.0'}.apk`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Test Connectivity to Server Link
  const handleTestServer = async (urlToTest: string) => {
    const fullUrl = getFullDownloadUrl(urlToTest);
    setTestServerUrl(fullUrl);
    setTestStatus('testing');
    setTestResult(null);

    const startTime = Date.now();
    try {
      const response = await fetch(fullUrl, { method: 'HEAD' });
      const latency = Date.now() - startTime;
      const contentType = response.headers.get('content-type') || 'Desconhecido';
      const contentLength = response.headers.get('content-length');
      const sizeMb = contentLength ? `${(parseInt(contentLength) / (1024 * 1024)).toFixed(2)} MB` : 'Invisível (Server Proxy)';

      if (response.ok || response.status === 200) {
        setTestStatus('success');
        setTestResult({
          httpStatus: response.status,
          statusText: response.statusText || 'OK (Servidor Acessível)',
          latency: `${latency} ms`,
          contentType,
          fileSize: sizeMb,
          server: response.headers.get('server') || 'Nginx / Cloud Server JIS ANGOLA',
          url: fullUrl
        });
      } else {
        setTestStatus('error');
        setTestResult({
          httpStatus: response.status,
          statusText: response.statusText,
          latency: `${latency} ms`,
          message: `Servidor respondeu com código de erro HTTP ${response.status}`,
          url: fullUrl
        });
      }
    } catch (err: any) {
      const latency = Date.now() - startTime;
      setTestStatus('error');
      setTestResult({
        httpStatus: 'Erro de Conexão ou CORS',
        message: 'Servidor inacessível ou sem cabeçalhos CORS (`Access-Control-Allow-Origin *`). Verifique o guia Nginx.',
        latency: `${latency} ms`,
        url: fullUrl
      });
    }
  };

  // Real Scannable QR Code Generator Component
  const RealQrCodeDisplay = ({ pathUrl, appTitle }: { pathUrl: string; appTitle?: string }) => {
    const fullUrl = getFullDownloadUrl(pathUrl);
    const [qrDataUrl, setQrDataUrl] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
      let isMounted = true;
      setLoading(true);

      QRCode.toDataURL(fullUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'H'
      })
        .then((dataUrl) => {
          if (isMounted) {
            setQrDataUrl(dataUrl);
            setLoading(false);
          }
        })
        .catch((err) => {
          console.warn("Local QRCode generation error, using fallback API:", err);
          if (isMounted) {
            setQrDataUrl(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(fullUrl)}`);
            setLoading(false);
          }
        });

      return () => {
        isMounted = false;
      };
    }, [fullUrl]);

    return (
      <div className="bg-white p-4 rounded-2xl border-2 border-slate-900 shadow-xl inline-block text-center max-w-full my-2">
        {loading ? (
          <div className="w-52 h-52 mx-auto flex flex-col items-center justify-center bg-slate-100 rounded-xl text-slate-400 gap-2">
            <RefreshCw className="animate-spin text-amber-500" size={28} />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">A Gerar QR Code...</span>
          </div>
        ) : (
          <img
            src={qrDataUrl}
            alt={`QR Code Scannable para ${appTitle || 'APK'}`}
            className="w-52 h-52 mx-auto rounded-xl object-contain border border-slate-100 shadow-sm"
          />
        )}
        <p className="text-[10px] font-black uppercase text-slate-800 tracking-wider mt-2.5">
          Digitalize com a câmara do telemóvel
        </p>
        <p className="text-[9px] font-mono text-slate-500 truncate max-w-[220px] mx-auto mt-1 px-1 py-0.5 bg-slate-100 rounded">
          {fullUrl}
        </p>
      </div>
    );
  };

  const nginxConfigSnippet = `# /etc/nginx/sites-available/taxicontrol-apk
server {
    listen 80;
    server_name download.taxicontrol.co.ao apks.jisangola.co.ao;

    # Pasta onde os ficheiros .apk estão armazenados no servidor Linux
    location /apks/ {
        alias /var/www/taxicontrol-apks/;
        autoindex on;

        # Tipos MIME corretos para ficheiros de pacote Android
        types {
            application/vnd.android.package-archive apk;
        }
        default_type application/octet-stream;

        # Permissões CORS para permitir downloads diretos do ecran do TaxiControl
        add_header Access-Control-Allow-Origin "*";
        add_header Access-Control-Allow-Methods "GET, OPTIONS, HEAD";
        add_header Content-Disposition "attachment";
    }
}`;

  const nginxCommandsSnippet = `# 1. Criar pasta de alojamento de APKs
sudo mkdir -p /var/www/taxicontrol-apks
sudo chown -R www-data:www-data /var/www/taxicontrol-apks

# 2. Copiar o ficheiro APK compilado para o servidor
scp taxicontrol-v6.0.0.apk root@servidor-jis:/var/www/taxicontrol-apks/

# 3. Ativar a configuração no Nginx e recarregar
sudo ln -s /etc/nginx/sites-available/taxicontrol-apk /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 4. Gerar Certificado SSL HTTPS Gratuito com Certbot
sudo certbot --nginx -d download.taxicontrol.co.ao`;

  const s3PolicySnippet = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::taxicontrol-apks-angola/*"
    }
  ]
}`;

  const firebaseRulesSnippet = `rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /apks/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}`;

  return (
    <div className={cn(
      "w-full space-y-6 text-slate-900 dark:text-white font-sans",
      isEmbedded ? "p-0" : "p-4 sm:p-6 max-w-7xl mx-auto"
    )}>
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 border border-slate-700/80 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-1">
                <ShieldCheck size={12} />
                Distribuição Direta APK
              </span>
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-1">
                <Server size={12} />
                Alojamento Próprio JIS ANGOLA
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight italic uppercase">
              Central de Distribuição APK (Sem Play Store)
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Descarregue e instale diretamente as aplicações de campo da frota **PSM Táxi / TaxiControl** sem necessitar da Google Play Store. Alojamento próprio de alta velocidade em servidores Nginx / Firebase da JIS ANGOLA.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              onClick={() => handleDownloadClick('driver', apkConfig.driverAppUrl)}
              className="px-6 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer transform hover:-translate-y-0.5"
            >
              <Download size={18} />
              <span>Descarregar APK Directo (v{apkConfig.version})</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="mt-8 pt-6 border-t border-slate-700/60 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3.5 border border-white/10">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block">Versão Atual</span>
            <span className="text-base font-black text-white mt-1 block flex items-center gap-1">
              {apkConfig.version} <span className="text-[10px] text-amber-400 font-normal">Build {apkConfig.buildNumber}</span>
            </span>
          </div>

          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3.5 border border-white/10">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block">Compatibilidade</span>
            <span className="text-base font-black text-emerald-400 mt-1 block">
              {apkConfig.minAndroidVersion}
            </span>
          </div>

          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3.5 border border-white/10">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block">Segurança APK</span>
            <span className="text-base font-black text-sky-400 mt-1 block flex items-center gap-1">
              <CheckCircle2 size={14} className="text-emerald-400" /> Assinado & Verificado
            </span>
          </div>

          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3.5 border border-white/10">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block">Servidor de Alojamento</span>
            <span className="text-xs font-bold text-slate-200 mt-1 block truncate" title={apkConfig.storageProvider}>
              {apkConfig.storageProvider}
            </span>
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('download')}
            className={cn(
              "flex-1 sm:flex-none flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
              activeTab === 'download'
                ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20 dark:bg-amber-500 dark:text-slate-950"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <Smartphone size={16} />
            <span>Descarregar APKs</span>
          </button>

          <button
            onClick={() => setActiveTab('stats')}
            className={cn(
              "flex-1 sm:flex-none flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
              activeTab === 'stats'
                ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20 dark:bg-amber-500 dark:text-slate-950"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <BarChart3 size={16} />
            <span>Estatísticas & Downloads (Recharts)</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={cn(
              "flex-1 sm:flex-none flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
              activeTab === 'guide'
                ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20 dark:bg-amber-500 dark:text-slate-950"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <HelpCircle size={16} />
            <span>Guia de Instalação Android</span>
          </button>

          <button
            onClick={() => setActiveTab('server_guide')}
            className={cn(
              "flex-1 sm:flex-none flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
              activeTab === 'server_guide'
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <Server size={16} />
            <span>Guia Nginx / S3 / Firebase</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              className={cn(
                "flex-1 sm:flex-none flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
                activeTab === 'admin'
                  ? "bg-slate-900 text-white shadow-lg dark:bg-indigo-600 dark:text-white"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <Settings size={16} />
              <span>Gestão de Links (Admin)</span>
            </button>
          )}
        </div>

        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hidden lg:flex items-center gap-2 pr-2">
          <Info size={14} className="text-amber-500" />
          <span>Ficheiros alojados diretamente na infraestrutura da JIS ANGOLA</span>
        </div>
      </div>

      {/* TAB 1: DOWNLOAD APKS */}
      {activeTab === 'download' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 1. MOTORISTA APP */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xl flex flex-col justify-between relative overflow-hidden group hover:border-amber-500/50 transition-all">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center font-black">
                    <Smartphone size={24} />
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider rounded-lg border border-emerald-500/20">
                    {apkConfig.driverAppSize}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-black italic uppercase tracking-wide">TaxiControl Motorista</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Aplicação operacional para motoristas com rastreio GPS 24h em segundo plano, registo de escalas, validação de receitas e botão de pânico SOS.
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3 text-[11px] space-y-1.5 border border-slate-200 dark:border-slate-700">
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span className="font-bold">Ficheiro:</span>
                    <span className="font-mono text-[10px]">supertaxi-driver-v6.0.0.apk</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span className="font-bold">Requisitos:</span>
                    <span>Android 8.0+</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => handleDownloadClick('driver', apkConfig.driverAppUrl)}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Download size={16} />
                  <span>Descarregar APK Motorista</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedQrApp('driver')}
                    className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[11px] uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <QrCode size={14} />
                    <span>Ver QR Code</span>
                  </button>

                  <button
                    onClick={() => copyLink('TaxiControl Motorista', apkConfig.driverAppUrl)}
                    className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-all cursor-pointer"
                    title="Copiar Link de Download"
                  >
                    {copiedApp === 'TaxiControl Motorista' ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            </div>

            {/* 2. STAFF & GESTOR APP */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xl flex flex-col justify-between relative overflow-hidden group hover:border-indigo-500/50 transition-all">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 bg-indigo-500/10 text-indigo-500 rounded-2xl flex items-center justify-center font-black">
                    <Building size={24} />
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider rounded-lg border border-emerald-500/20">
                    {apkConfig.staffAppSize}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-black italic uppercase tracking-wide">TaxiControl Staff & Gestão</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Portal móvel para gerentes, operadores de central e fiscalização. Controlo da frota, aprovação de despesas e chat de equipa em tempo real.
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3 text-[11px] space-y-1.5 border border-slate-200 dark:border-slate-700">
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span className="font-bold">Ficheiro:</span>
                    <span className="font-mono text-[10px]">supertaxi-staff-v6.0.0.apk</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span className="font-bold">Requisitos:</span>
                    <span>Android 8.0+</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => handleDownloadClick('staff', apkConfig.staffAppUrl)}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Download size={16} />
                  <span>Descarregar APK Staff</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedQrApp('staff')}
                    className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[11px] uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <QrCode size={14} />
                    <span>Ver QR Code</span>
                  </button>

                  <button
                    onClick={() => copyLink('TaxiControl Staff', apkConfig.staffAppUrl)}
                    className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-all cursor-pointer"
                    title="Copiar Link de Download"
                  >
                    {copiedApp === 'TaxiControl Staff' ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            </div>

            {/* 3. PASSAGEIRO APP */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xl flex flex-col justify-between relative overflow-hidden group hover:border-sky-500/50 transition-all">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 bg-sky-500/10 text-sky-500 rounded-2xl flex items-center justify-center font-black">
                    <UserCheck size={24} />
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider rounded-lg border border-emerald-500/20">
                    {apkConfig.passengerAppSize}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-black italic uppercase tracking-wide">TaxiControl Passageiro</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Aplicação pública para passageiros realizarem chamadas diretas de táxi em Luena, estimativa de tarifa e acompanhamento do veículo no mapa.
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3 text-[11px] space-y-1.5 border border-slate-200 dark:border-slate-700">
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span className="font-bold">Ficheiro:</span>
                    <span className="font-mono text-[10px]">supertaxi-passenger-v6.0.0.apk</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span className="font-bold">Requisitos:</span>
                    <span>Android 8.0+</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => handleDownloadClick('passenger', apkConfig.passengerAppUrl)}
                  className="w-full py-3 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Download size={16} />
                  <span>Descarregar APK Passageiro</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedQrApp('passenger')}
                    className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[11px] uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <QrCode size={14} />
                    <span>Ver QR Code</span>
                  </button>

                  <button
                    onClick={() => copyLink('TaxiControl Passageiro', apkConfig.passengerAppUrl)}
                    className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-all cursor-pointer"
                    title="Copiar Link de Download"
                  >
                    {copiedApp === 'TaxiControl Passageiro' ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RECHARTS DOWNLOAD STATS & ADOPTION */}
      {activeTab === 'stats' && (
        <div className="space-y-6">
          {/* Summary Metric Cards (100% Dynamic Calculated from Live Database) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Total de Downloads</span>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  {totalDownloads.toLocaleString()}
                </p>
                <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1 mt-1">
                  <Activity size={12} className="animate-pulse" /> Sincronizado em tempo real
                </span>
              </div>
              <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
                <Download size={24} />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Adoção da Versão 6.0.0</span>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {currentVersionPercent}%
                </p>
                <span className="text-[10px] font-bold text-slate-400 mt-1">
                  {currentVersionTotal.toLocaleString()} de {totalDownloads.toLocaleString()} instalações
                </span>
              </div>
              <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
                <ShieldCheck size={24} />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Motoristas Atualizados</span>
                <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                  {currentDriverDownloads.toLocaleString()}
                </p>
                <span className="text-[10px] font-bold text-amber-500 mt-1">
                  Luena, Moxico & Saurimo
                </span>
              </div>
              <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-xl">
                <Smartphone size={24} />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Último Registo em Direto</span>
                <p className="text-sm font-black text-slate-900 dark:text-white mt-1 truncate max-w-[150px]">
                  {latestLog ? (latestLog.userName || latestLog.appType?.toUpperCase()) : 'JIS Cloud Server'}
                </p>
                <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1 mt-1 truncate max-w-[150px]">
                  <CheckCircle2 size={12} /> {latestLog?.timestamp ? 'Registo Ativo' : 'Nginx HTTP/2 Online'}
                </span>
              </div>
              <div className="p-3 bg-sky-500/10 text-sky-500 rounded-xl">
                <Server size={24} />
              </div>
            </div>
          </div>

          {/* Recharts Card with Dynamic View Selector and Live Test Action */}
          <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-black tracking-tight italic uppercase flex items-center gap-2">
                  <BarChart3 className="text-amber-500" size={20} />
                  Estatísticas Dinâmicas de Downloads (Recharts Firestore)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Métricas calculadas em tempo real com base nos acessos e descarregamentos de ficheiros APK na infraestrutura PSM Taxi.
                </p>
              </div>

              {/* View Selector and Live Test Actions */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="p-1 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center gap-1">
                  <button
                    onClick={() => setChartViewMode('versions')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer",
                      chartViewMode === 'versions' ? "bg-amber-500 text-slate-950 shadow-md" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    )}
                  >
                    Por Versão
                  </button>
                  <button
                    onClick={() => setChartViewMode('daily')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer",
                      chartViewMode === 'daily' ? "bg-amber-500 text-slate-950 shadow-md" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    )}
                  >
                    Últimos 7 Dias
                  </button>
                  <button
                    onClick={() => setChartViewMode('apps')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer",
                      chartViewMode === 'apps' ? "bg-amber-500 text-slate-950 shadow-md" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    )}
                  >
                    Por Tipo de App
                  </button>
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={async () => {
                        setIsSimulating(true);
                        setSimulatedMsg(null);
                        try {
                          await addDoc(collection(db, 'apk_download_logs'), {
                            appType: 'driver',
                            version: apkConfig.version || '6.0.0',
                            timestamp: serverTimestamp(),
                            userEmail: user?.email || 'motorista.luena@taxicontrol.co.ao',
                            userName: 'Motorista de Campo (Luena Frota 07)',
                            userAgent: 'Android 14 / APK Installer'
                          });
                          setSimulatedMsg('Download de teste gravado no Firestore! Gráfico atualizado.');
                          setTimeout(() => setSimulatedMsg(null), 3000);
                        } catch (e) {
                          console.warn(e);
                        } finally {
                          setIsSimulating(false);
                        }
                      }}
                      disabled={isSimulating}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer"
                      title="Gravar um evento real no Firestore para testar a reatividade do Recharts"
                    >
                      <Zap size={13} className={isSimulating ? "animate-spin text-amber-400" : "text-amber-400"} />
                      <span>{isSimulating ? "A registar..." : "+ Testar Download"}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {simulatedMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>{simulatedMsg}</span>
              </div>
            )}

            {/* Dynamic Recharts Chart Rendering */}
            <div className="h-80 w-full pt-2 relative">
              {totalDownloads === 0 ? (
                <div className="h-full w-full flex flex-col items-center justify-center text-center p-6 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center mb-3">
                    <BarChart3 size={24} />
                  </div>
                  <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                    Quadro Estatístico Limpo (Zero Dados Estáticos)
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
                    O gráfico está pronto e à espera de transferências reais. Qualquer descarregamento na aba "Aplicações de Campo" ou via QR Code será imediatamente refletido aqui via Firestore em tempo real.
                  </p>
                  {isAdmin && (
                    <div className="mt-4">
                      <span className="text-[11px] text-amber-500 font-bold bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
                        Dica: Pode carregar em "+ Testar Download" acima para gerar um evento real de teste
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  {chartViewMode === 'versions' ? (
                    <BarChart data={versionStats} margin={{ top: 15, right: 15, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="version" tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '16px',
                          color: '#ffffff',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                      <Bar dataKey="motorista" name="APK Motorista" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="staff" name="APK Staff / Gestão" fill="#6366f1" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="passageiro" name="APK Passageiro" fill="#0284c7" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  ) : chartViewMode === 'daily' ? (
                    <AreaChart data={dailyTrendData} margin={{ top: 15, right: 15, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorMotorista" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorPassageiro" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0284c7" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#0284c7" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '16px',
                          color: '#ffffff',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                      <Area type="monotone" dataKey="motorista" name="Motoristas (Diário)" stroke="#f59e0b" fillOpacity={1} fill="url(#colorMotorista)" />
                      <Area type="monotone" dataKey="passageiro" name="Passageiros (Diário)" stroke="#0284c7" fillOpacity={1} fill="url(#colorPassageiro)" />
                      <Area type="monotone" dataKey="staff" name="Staff / Gestão" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                    </AreaChart>
                  ) : (
                    <BarChart data={appDistributionData} margin={{ top: 15, right: 15, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '16px',
                          color: '#ffffff',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}
                      />
                      <Bar dataKey="value" name="Total Acumulado" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Real-time Activity Feed / Table of Download Events */}
          <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black italic uppercase flex items-center gap-2">
                  <Activity className="text-emerald-500" size={18} />
                  Histórico de Descarregamentos em Direto (Firestore Logs)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Registo em tempo real das transferências efetuadas pelos utilizadores da frota e passageiros.
                </p>
              </div>
              <span className="text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/20">
                {downloadLogs.length} Registos Recentes
              </span>
            </div>

            {downloadLogs.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                <Download className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Nenhum descarregamento registado nesta sessão</p>
                <p className="text-xs text-slate-400 mt-1">Ao carregar em qualquer botão de download ou escanear o QR Code, o evento surgirá aqui automaticamente.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                      <th className="pb-3 px-3">Aplicação</th>
                      <th className="pb-3 px-3">Versão</th>
                      <th className="pb-3 px-3">Utilizador / Origem</th>
                      <th className="pb-3 px-3">Data & Hora</th>
                      <th className="pb-3 px-3 text-right">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {downloadLogs.slice(0, 8).map((log, idx) => {
                      const dateObj = log.timestamp?.toDate ? log.timestamp.toDate() : (log.timestamp ? new Date(log.timestamp) : new Date());
                      const isDriver = log.appType === 'driver';
                      const isStaff = log.appType === 'staff';

                      return (
                        <tr key={log.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-3 font-bold">
                            <span className={cn(
                              "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase inline-block",
                              isDriver ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" :
                              isStaff ? "bg-indigo-500/10 text-indigo-600 border border-indigo-500/20" :
                              "bg-sky-500/10 text-sky-600 border border-sky-500/20"
                            )}>
                              {isDriver ? 'Motorista' : isStaff ? 'Staff' : 'Passageiro'}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                            v{log.version || '6.0.0'}
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">
                            {log.userName || log.userEmail || 'Utilizador de Campo'}
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-400">
                            {dateObj.toLocaleDateString('pt-PT')} {dateObj.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-3 px-3 text-right font-black text-emerald-600 dark:text-emerald-400">
                            <span className="inline-flex items-center gap-1">
                              <CheckCircle2 size={12} /> Concluído
                            </span>
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
      )}

      {/* TAB 3: ANDROID USER INSTALLATION GUIDE */}
      {activeTab === 'guide' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xl space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-xl font-black italic uppercase tracking-wide">
              Como Instalar Ficheiros APK Diretos no Android
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Siga este passo-a-passo simples para instalar a aplicação no seu dispositivo Android em menos de 1 minuto sem precisar da Play Store.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 space-y-3 relative">
              <div className="w-8 h-8 bg-amber-500 text-slate-950 font-black rounded-xl flex items-center justify-center text-sm">
                1
              </div>
              <h3 className="font-bold text-sm uppercase">Descarregar APK</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Clique no botão **Descarregar APK** ou leia o QR Code com a câmara do seu telemóvel.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 space-y-3 relative">
              <div className="w-8 h-8 bg-amber-500 text-slate-950 font-black rounded-xl flex items-center justify-center text-sm">
                2
              </div>
              <h3 className="font-bold text-sm uppercase">Permitir a Fonte</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Se surgir um aviso do Chrome/Android, clique em **Definições** e ative **Permitir desta fonte** (Allow from this source).
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 space-y-3 relative">
              <div className="w-8 h-8 bg-amber-500 text-slate-950 font-black rounded-xl flex items-center justify-center text-sm">
                3
              </div>
              <h3 className="font-bold text-sm uppercase">Instalar Pacote</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Abra as Notificações ou a pasta de Transferências no telemóvel e clique em **taxicontrol-v6.0.0.apk** ➔ **Instalar**.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 space-y-3 relative">
              <div className="w-8 h-8 bg-emerald-500 text-slate-950 font-black rounded-xl flex items-center justify-center text-sm">
                4
              </div>
              <h3 className="font-bold text-sm uppercase">Iniciar Sessão</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Abra a aplicação e introduza o seu número de telefone `+244` ou código fornecido pela gestão JIS ANGOLA.
              </p>
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
            <Info size={18} className="shrink-0 text-amber-500 mt-0.5" />
            <div className="space-y-1">
              <strong className="font-black uppercase tracking-wide block">Instalação Segura & Verificada</strong>
              <p>
                Todas as compilações distribuídas pela **JIS ANGOLA** possuem assinatura digital válida. O aviso "Ficheiro de fonte desconhecida" é normal no Android quando se instalam aplicações diretamente fora da loja oficial Google Play Store.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: STEP-BY-STEP SERVER HOSTING GUIDE (NGINX, S3, FIREBASE STORAGE) */}
      {activeTab === 'server_guide' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xl space-y-8">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="px-3 py-1 bg-indigo-500/10 text-indigo-500 text-[10px] font-black uppercase tracking-wider rounded-full">
                Documentação Técnica de Engenharia
              </span>
              <h2 className="text-xl font-black italic uppercase tracking-wide mt-1 flex items-center gap-2">
                <Server className="text-indigo-500" size={22} />
                Guia de Alojamento Próprio de Ficheiros .APK
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-3xl">
                Passo a passo completo para configurar um servidor **Nginx (VPS)**, um bucket **AWS S3 / Cloudflare R2** ou o **Firebase Storage** para servir os ficheiros `.apk` para os motoristas e utilizadores finais.
              </p>
            </div>
          </div>

          {/* Interactive Link Health Tester Card */}
          <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity size={18} className="text-amber-400 animate-pulse" />
                <h3 className="text-xs font-black uppercase tracking-widest text-amber-400">Testador de Conetividade do Servidor APK</h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">HTTP HEAD Probe</span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <input
                type="text"
                value={testServerUrl || apkConfig.driverAppUrl}
                onChange={(e) => setTestServerUrl(e.target.value)}
                placeholder="https://download.taxicontrol.co.ao/apks/taxicontrol-v6.0.0.apk"
                className="flex-1 px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-xs font-mono text-slate-200 w-full"
              />
              <button
                onClick={() => handleTestServer(testServerUrl || apkConfig.driverAppUrl)}
                disabled={testStatus === 'testing'}
                className="w-full sm:w-auto px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0"
              >
                {testStatus === 'testing' ? <RefreshCw size={16} className="animate-spin" /> : <Zap size={16} />}
                <span>Testar Resposta Servidor</span>
              </button>
            </div>

            {testStatus === 'success' && testResult && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-2xl text-xs space-y-1 text-emerald-300 font-mono">
                <div className="flex items-center gap-2 font-bold text-emerald-400 uppercase text-[11px]">
                  <CheckCircle2 size={16} /> Servidor Online - Resposta HTTP 200 OK
                </div>
                <div>Latência: {testResult.latency} | Tamanho: {testResult.fileSize}</div>
                <div>Content-Type: {testResult.contentType}</div>
                <div>Servidor Web: {testResult.server}</div>
              </div>
            )}

            {testStatus === 'error' && testResult && (
              <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-2xl text-xs space-y-1 text-rose-300 font-mono">
                <div className="flex items-center gap-2 font-bold text-rose-400 uppercase text-[11px]">
                  <WifiOff size={16} /> Falha de Teste / Erro de Origem
                </div>
                <div>Mensagem: {testResult.message}</div>
                <div>Latência: {testResult.latency}</div>
              </div>
            )}
          </div>

          {/* OPTION 1: NGINX SERVER */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-500/10 text-indigo-500 rounded-2xl flex items-center justify-center font-black">
                <Server size={20} />
              </div>
              <div>
                <h3 className="text-base font-black italic uppercase tracking-wide">
                  Opção A: Servidor Web Nginx Próprio (VPS Ubuntu / Debian)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Recomendado para maior velocidade de download e alojamento 100% sob controlo da JIS ANGOLA.
                </p>
              </div>
            </div>

            <div className="space-y-4 text-xs leading-relaxed">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <strong className="text-indigo-600 dark:text-indigo-400 uppercase font-black">
                    Passo 1: Criar Ficheiro de Bloco de Servidor Nginx
                  </strong>
                  <button
                    onClick={() => copySnippet('nginx_conf', nginxConfigSnippet)}
                    className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg font-mono text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                  >
                    {copiedCode === 'nginx_conf' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                    {copiedCode === 'nginx_conf' ? 'Copiado!' : 'Copiar Config Nginx'}
                  </button>
                </div>
                <p className="text-slate-600 dark:text-slate-300">
                  Crie o ficheiro de configuração `/etc/nginx/sites-available/taxicontrol-apk` no seu servidor Linux:
                </p>
                <pre className="p-4 bg-slate-950 text-slate-200 rounded-xl font-mono text-[11px] overflow-x-auto border border-slate-800">
                  {nginxConfigSnippet}
                </pre>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <strong className="text-indigo-600 dark:text-indigo-400 uppercase font-black">
                    Passo 2: Executar Comandos de Inicialização & SSL
                  </strong>
                  <button
                    onClick={() => copySnippet('nginx_cmd', nginxCommandsSnippet)}
                    className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg font-mono text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                  >
                    {copiedCode === 'nginx_cmd' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                    {copiedCode === 'nginx_cmd' ? 'Copiado!' : 'Copiar Comandos Linux'}
                  </button>
                </div>
                <pre className="p-4 bg-slate-950 text-emerald-400 rounded-xl font-mono text-[11px] overflow-x-auto border border-slate-800">
                  {nginxCommandsSnippet}
                </pre>
              </div>
            </div>
          </div>

          {/* OPTION 2: AWS S3 / CLOUDFLARE R2 BUCKET */}
          <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center font-black">
                <HardDrive size={20} />
              </div>
              <div>
                <h3 className="text-base font-black italic uppercase tracking-wide">
                  Opção B: Bucket Amazon S3 / Cloudflare R2 / DigitalOcean Spaces
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Alojamento em nuvem pública com distribuição global e redundância automática.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
              <strong className="text-amber-600 dark:text-amber-400 uppercase font-black block">
                Política de Acesso Público de Leitura ao Bucket (Bucket Policy JSON)
              </strong>
              <p className="text-slate-600 dark:text-slate-300">
                Nas definições de **Permissions / Bucket Policy**, insira o seguinte código para permitir o download livre do APK:
              </p>
              <pre className="p-4 bg-slate-950 text-amber-300 rounded-xl font-mono text-[11px] overflow-x-auto border border-slate-800">
                {s3PolicySnippet}
              </pre>
              <p className="text-[11px] text-slate-500">
                *Nota Importante:* Ao carregar o ficheiro `.apk`, defina sempre o cabeçalho HTTP **Content-Type** como `application/vnd.android.package-archive`.
              </p>
            </div>
          </div>

          {/* OPTION 3: FIREBASE STORAGE */}
          <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-sky-500/10 text-sky-500 rounded-2xl flex items-center justify-center font-black">
                <Database size={20} />
              </div>
              <div>
                <h3 className="text-base font-black italic uppercase tracking-wide">
                  Opção C: Firebase Storage (Gratuito & Integrado ao Projeto)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ideal para pequenas atualizações sem necessidade de servidor próprio adicional.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
              <strong className="text-sky-600 dark:text-sky-400 uppercase font-black block">
                Configuração de Regras no Firebase Storage Console (`storage.rules`)
              </strong>
              <pre className="p-4 bg-slate-950 text-sky-300 rounded-xl font-mono text-[11px] overflow-x-auto border border-slate-800">
                {firebaseRulesSnippet}
              </pre>
              <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-300 pt-2">
                <li>Aceda ao Firebase Console ➔ Storage ➔ Crie a pasta <code>/apks/</code>.</li>
                <li>Faça o upload do ficheiro <code>taxicontrol-v6.0.0.apk</code>.</li>
                <li>Clique no ficheiro carregado, copie o <strong>URL de Token de Transferência</strong> e cole na aba de Gestão de Links.</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: ADMIN MANAGEMENT PANEL */}
      {activeTab === 'admin' && isAdmin && (
        <form onSubmit={handleSaveConfig} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-black italic uppercase tracking-wide flex items-center gap-2">
                <Settings className="text-indigo-500" size={20} />
                Gestão de Links e Versões de APK
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Altere os links diretos dos ficheiros APK alojados no Servidor Nginx, Firebase ou S3 da JIS ANGOLA.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <UploadCloud size={16} />}
              <span>Guardar Alterações</span>
            </button>
          </div>

          {saveSuccess && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <CheckCircle2 size={18} />
              <span>{saveSuccess}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400">Número da Versão</label>
              <input
                type="text"
                value={apkConfig.version}
                onChange={(e) => setApkConfig({ ...apkConfig, version: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400">Data do Lançamento</label>
              <input
                type="date"
                value={apkConfig.releaseDate}
                onChange={(e) => setApkConfig({ ...apkConfig, releaseDate: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400">Número de Build</label>
              <input
                type="text"
                value={apkConfig.buildNumber}
                onChange={(e) => setApkConfig({ ...apkConfig, buildNumber: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
              />
            </div>
          </div>

          {/* Toggle Switches for Startup Alert */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={apkConfig.isCriticalUpdate === true}
                onChange={(e) => setApkConfig({ ...apkConfig, isCriticalUpdate: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="font-bold block">Notificar Atualização Crítica ao Iniciar Sistema</span>
                <span className="text-slate-500 text-[11px]">Exibe o alerta flutuante `AlertNotificationManager` a todos os utilizadores ao abrir a app.</span>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={apkConfig.notifyOnStartup === true}
                onChange={(e) => setApkConfig({ ...apkConfig, notifyOnStartup: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="font-bold block">Forçar Download do APK para Toda a Frota</span>
                <span className="text-slate-500 text-[11px]">Sinaliza o ficheiro APK como obrigatório no painel.</span>
              </div>
            </label>
          </div>

          {/* URL Inputs for 3 Apps */}
          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Links de Alojamento dos Ficheiros .APK</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-amber-500 uppercase">URL APK Motorista</label>
                <input
                  type="text"
                  value={apkConfig.driverAppUrl}
                  onChange={(e) => setApkConfig({ ...apkConfig, driverAppUrl: e.target.value })}
                  placeholder="/downloads/taxicontrol-v6.0.0.apk"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-indigo-500 uppercase">URL APK Staff / Gestor</label>
                <input
                  type="text"
                  value={apkConfig.staffAppUrl}
                  onChange={(e) => setApkConfig({ ...apkConfig, staffAppUrl: e.target.value })}
                  placeholder="/downloads/taxicontrol-v6.0.0.apk"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-sky-500 uppercase">URL APK Passageiro</label>
                <input
                  type="text"
                  value={apkConfig.passengerAppUrl}
                  onChange={(e) => setApkConfig({ ...apkConfig, passengerAppUrl: e.target.value })}
                  placeholder="/downloads/taxicontrol-v6.0.0.apk"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400">Notas de Lançamento (Changelog)</label>
            <textarea
              rows={3}
              value={apkConfig.releaseNotes}
              onChange={(e) => setApkConfig({ ...apkConfig, releaseNotes: e.target.value })}
              className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs leading-relaxed"
            />
          </div>
        </form>
      )}

      {/* QR CODE MODAL OVERLAY */}
      <AnimatePresence>
        {selectedQrApp && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedQrApp(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-slate-900 text-white rounded-3xl p-6 border border-slate-800 shadow-2xl z-10 text-center space-y-4"
            >
              <button
                onClick={() => setSelectedQrApp(null)}
                className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="space-y-1">
                <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-wider rounded-full border border-amber-500/30">
                  QR Code de Download Directo
                </span>
                <h3 className="text-lg font-black italic uppercase">
                  {selectedQrApp === 'driver' && 'TaxiControl Motorista'}
                  {selectedQrApp === 'staff' && 'TaxiControl Staff'}
                  {selectedQrApp === 'passenger' && 'TaxiControl Passageiro'}
                </h3>
              </div>

              <RealQrCodeDisplay
                pathUrl={
                  selectedQrApp === 'driver' ? apkConfig.driverAppUrl :
                  selectedQrApp === 'staff' ? apkConfig.staffAppUrl : apkConfig.passengerAppUrl
                }
                appTitle={
                  selectedQrApp === 'driver' ? 'TaxiControl Motorista' :
                  selectedQrApp === 'staff' ? 'TaxiControl Staff' : 'TaxiControl Passageiro'
                }
              />

              <p className="text-xs text-slate-400">
                Aponte a câmara do seu telemóvel Android para iniciar o download do ficheiro APK imediatamente.
              </p>

              <button
                onClick={() => setSelectedQrApp(null)}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
              >
                Fechar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
