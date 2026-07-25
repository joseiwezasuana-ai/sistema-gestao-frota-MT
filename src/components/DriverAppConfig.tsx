import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  ShieldAlert, 
  Volume2, 
  Clock, 
  Compass, 
  MapPin, 
  Save, 
  AlertCircle, 
  Eye, 
  Sliders, 
  Wifi, 
  User, 
  Check, 
  RotateCcw, 
  Info, 
  Phone, 
  Activity,
  Layers,
  Fuel,
  Users,
  Moon,
  Zap,
  Lock,
  MessageSquare
} from 'lucide-react';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from '@/src/lib/firebase';

interface DriverAppConfigProps {
  tenantId?: string;
  tenantName?: string;
}

export default function DriverAppConfig({ tenantId, tenantName = "SUPER Taxi" }: DriverAppConfigProps) {
  // Config state
  const [enabled, setEnabled] = useState(true);
  
  // Feature Toggles
  const [shiftApprovalRequired, setShiftApprovalRequired] = useState(true);
  const [speedWarningEnabled, setSpeedWarningEnabled] = useState(true);
  const [requireSelfie, setRequireSelfie] = useState(false);
  const [allowOfflineCash, setAllowOfflineCash] = useState(true);
  const [allowFuelDeclaration, setAllowFuelDeclaration] = useState(true);
  const [soundAlertsEnabled, setSoundAlertsEnabled] = useState(true);
  const [panicSosSmsEnabled, setPanicSosSmsEnabled] = useState(true);
  
  // Parameters
  const [maxSpeedThreshold, setMaxSpeedThreshold] = useState(80);
  const [gpsIntervalSec, setGpsIntervalSec] = useState(10);
  const [maxShiftHours, setMaxShiftHours] = useState(12);
  const [supportPhone, setSupportPhone] = useState('+244923456789');
  
  // Theme and Customization
  const [primaryColor, setPrimaryColor] = useState('#eab308'); // Yellow Taxi accent default
  const [darkModeByDefault, setDarkModeByDefault] = useState(true);
  const [driverWelcomeMsg, setDriverWelcomeMsg] = useState('Bom trabalho, parceiro! Conduza com cuidado e mantenha o foco.');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load configuration from settings/driver_app doc
  useEffect(() => {
    setLoading(true);
    const configDocRef = doc(db, 'settings', 'driver_app');
    
    const unsubscribe = onSnapshot(configDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setEnabled(data.enabled !== false);
        setShiftApprovalRequired(data.shiftApprovalRequired !== false);
        setSpeedWarningEnabled(data.speedWarningEnabled !== false);
        setRequireSelfie(data.requireSelfie === true);
        setAllowOfflineCash(data.allowOfflineCash !== false);
        setAllowFuelDeclaration(data.allowFuelDeclaration !== false);
        setSoundAlertsEnabled(data.soundAlertsEnabled !== false);
        setPanicSosSmsEnabled(data.panicSosSmsEnabled !== false);
        setMaxSpeedThreshold(data.maxSpeedThreshold || 80);
        setGpsIntervalSec(data.gpsIntervalSec || 10);
        setMaxShiftHours(data.maxShiftHours || 12);
        setSupportPhone(data.supportPhone || '+244923456789');
        setPrimaryColor(data.primaryColor || '#eab308');
        setDarkModeByDefault(data.darkModeByDefault !== false);
        setDriverWelcomeMsg(data.driverWelcomeMsg || 'Bom trabalho, parceiro! Conduza com cuidado e mantenha o foco.');
      }
      setLoading(false);
    }, (err) => {
      console.error("Erro ao ler configuração da App do Motorista:", err);
      setErrorMsg("Erro ao ler as definições guardadas no Firestore.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    setErrorMsg(null);

    try {
      const configDocRef = doc(db, 'settings', 'driver_app');
      await setDoc(configDocRef, {
        enabled,
        shiftApprovalRequired,
        speedWarningEnabled,
        requireSelfie,
        allowOfflineCash,
        allowFuelDeclaration,
        soundAlertsEnabled,
        panicSosSmsEnabled,
        maxSpeedThreshold: Number(maxSpeedThreshold),
        gpsIntervalSec: Number(gpsIntervalSec),
        maxShiftHours: Number(maxShiftHours),
        supportPhone: supportPhone.trim(),
        primaryColor,
        darkModeByDefault,
        driverWelcomeMsg: driverWelcomeMsg.trim(),
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.email || 'admin'
      }, { merge: true });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      console.error("Erro ao guardar configuração:", err);
      handleFirestoreError(err, OperationType.UPDATE, 'settings/driver_app');
      setErrorMsg("Falha ao registar dados no Firestore: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (window.confirm("Deseja restaurar as configurações padrão de fábrica para o App do Motorista?")) {
      setEnabled(true);
      setShiftApprovalRequired(true);
      setSpeedWarningEnabled(true);
      setRequireSelfie(false);
      setAllowOfflineCash(true);
      setAllowFuelDeclaration(true);
      setSoundAlertsEnabled(true);
      setPanicSosSmsEnabled(true);
      setMaxSpeedThreshold(80);
      setGpsIntervalSec(10);
      setMaxShiftHours(12);
      setSupportPhone('+244923456789');
      setPrimaryColor('#eab308');
      setDarkModeByDefault(true);
      setDriverWelcomeMsg('Bom trabalho, parceiro! Conduza com cuidado e mantenha o foco.');
    }
  };

  const colorOptions = [
    { name: 'Amarelo Táxi', hex: '#eab308', label: 'Clássico' },
    { name: 'Laranja Alerta', hex: '#f97316', label: 'Urbano' },
    { name: 'Verde Operador', hex: '#10b981', label: 'Segurança' },
    { name: 'Azul Central', hex: '#3b82f6', label: 'Corporativo' },
    { name: 'Vermelho SOS', hex: '#ef4444', label: 'Ativo' },
    { name: 'Branco Puro', hex: '#ffffff', label: 'Minimalista' },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 h-[400px]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-primary border-t-transparent shadow-md"></div>
        <p className="mt-4 text-xs font-bold text-slate-500 uppercase tracking-widest animate-pulse">A carregar consola de controlo...</p>
      </div>
    );
  }

  return (
    <div id="driver-app-config-root" className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
      
      {/* Configuration Controls (Left 7 cols) */}
      <form onSubmit={handleSave} className="lg:col-span-7 space-y-6">
        
        {/* Header alert about Driver App */}
        <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 dark:from-amber-950/20 dark:to-orange-950/20 p-5 rounded-2xl border border-amber-100 dark:border-amber-900/30 flex items-start gap-4">
          <div className="p-2 bg-amber-500/20 rounded-xl text-amber-600 dark:text-amber-400">
            <Smartphone size={24} className="animate-bounce" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Consola de Funcionalidades do App do Motorista</h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Configure as validações de turno, comportamento do GPS e de velocidade em tempo real que serão consumidas pelos motoristas em <strong>Luena, Moxico (+244)</strong>.
            </p>
          </div>
        </div>

        {/* Master Control Toggle Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Estado Global do App do Motorista</h3>
              <p className="text-xs text-slate-500">Se desativado, os motoristas não conseguirão iniciar turnos ou reportar faturamentos.</p>
            </div>
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                enabled ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Features list Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
              <Layers size={14} className="text-amber-500" />
              Funcionalidades do Aplicativo
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5 font-medium uppercase">Defina o nível de permissões do condutor no smartphone</p>
          </div>

          <div className="space-y-4">
            
            {/* 1. Aprovação de Turnos */}
            <div className="flex items-start justify-between p-3.5 bg-slate-50 dark:bg-slate-850 rounded-xl hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-all border border-slate-100 dark:border-white/5">
              <div className="flex items-start gap-3">
                <div className="mt-1 p-1.5 bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 rounded-lg">
                  <Clock size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Validação Prévia de Turnos</h4>
                  <p className="text-[11px] text-slate-550 dark:text-slate-400 leading-normal">O início de turno fica pendente de aprovação por um operador da central.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShiftApprovalRequired(!shiftApprovalRequired)}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  shiftApprovalRequired ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    shiftApprovalRequired ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* 2. Alerta de Excesso de Velocidade */}
            <div className="flex items-start justify-between p-3.5 bg-slate-50 dark:bg-slate-850 rounded-xl hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-all border border-slate-100 dark:border-white/5">
              <div className="flex items-start gap-3">
                <div className="mt-1 p-1.5 bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 rounded-lg">
                  <ShieldAlert size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Alerta Sonoro de Velocidade</h4>
                  <p className="text-[11px] text-slate-550 dark:text-slate-400 leading-normal">Bipa na app do motorista quando ultrapassa o limite de velocidade configurado.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSpeedWarningEnabled(!speedWarningEnabled)}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  speedWarningEnabled ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    speedWarningEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* 3. Selfie no Início de Turno */}
            <div className="flex items-start justify-between p-3.5 bg-slate-50 dark:bg-slate-850 rounded-xl hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-all border border-slate-100 dark:border-white/5">
              <div className="flex items-start gap-3">
                <div className="mt-1 p-1.5 bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 rounded-lg">
                  <User size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Fotografia (Selfie) Obrigatória</h4>
                  <p className="text-[11px] text-slate-550 dark:text-slate-400 leading-normal">Exige o envio de uma foto do motorista ao abrir a escala diária para garantir identificação.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRequireSelfie(!requireSelfie)}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  requireSelfie ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    requireSelfie ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* 4. Registo de Receitas Fora do Sistema */}
            <div className="flex items-start justify-between p-3.5 bg-slate-50 dark:bg-slate-850 rounded-xl hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-all border border-slate-100 dark:border-white/5">
              <div className="flex items-start gap-3">
                <div className="mt-1 p-1.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-lg">
                  <Zap size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Depósito de Faturamento Manual</h4>
                  <p className="text-[11px] text-slate-550 dark:text-slate-400 leading-normal">Permite que o motorista declare faturamentos físicos ou corridas de rua diretamente no app.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAllowOfflineCash(!allowOfflineCash)}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  allowOfflineCash ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    allowOfflineCash ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* 5. Registo de Abastecimento */}
            <div className="flex items-start justify-between p-3.5 bg-slate-50 dark:bg-slate-850 rounded-xl hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-all border border-slate-100 dark:border-white/5">
              <div className="flex items-start gap-3">
                <div className="mt-1 p-1.5 bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-lg">
                  <Fuel size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Declaração de Combustível</h4>
                  <p className="text-[11px] text-slate-550 dark:text-slate-400 leading-normal">Permite submeter comprovativos e faturas de abastecimento de combustível no final do dia.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAllowFuelDeclaration(!allowFuelDeclaration)}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  allowFuelDeclaration ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    allowFuelDeclaration ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* 6. Envio SMS de SOS */}
            <div className="flex items-start justify-between p-3.5 bg-slate-50 dark:bg-slate-850 rounded-xl hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-all border border-slate-100 dark:border-white/5">
              <div className="flex items-start gap-3">
                <div className="mt-1 p-1.5 bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400 rounded-lg">
                  <Lock size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">SOS por Redes de Back-up (SMS)</h4>
                  <p className="text-[11px] text-slate-550 dark:text-slate-400 leading-normal">O botão Pânico SOS também emite um SMS silencioso ao gestor na ausência de dados 4G.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPanicSosSmsEnabled(!panicSosSmsEnabled)}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  panicSosSmsEnabled ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    panicSosSmsEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

          </div>
        </div>

        {/* Technical parameters Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
              <Sliders size={14} className="text-amber-500" />
              Parâmetros Operacionais & GPS
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5 font-medium uppercase">Definições matemáticas e de rastreio por satélite</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wide flex items-center gap-1.5">
                Limite de Velocidade Máx (km/h)
                <span className="text-rose-500 font-black">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="30"
                  max="160"
                  required
                  value={maxSpeedThreshold}
                  onChange={(e) => setMaxSpeedThreshold(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-xs font-black text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-mono"
                />
                <span className="absolute right-4 top-3 text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase">km/h</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wide flex items-center gap-1.5">
                Intervalo de Envio GPS (Segundos)
                <span className="text-rose-500 font-black">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="2"
                  max="300"
                  required
                  value={gpsIntervalSec}
                  onChange={(e) => setGpsIntervalSec(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-xs font-black text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-mono"
                />
                <span className="absolute right-4 top-3 text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase">seg</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wide flex items-center gap-1.5">
                Duração Máxima de Turno (Horas)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={maxShiftHours}
                  onChange={(e) => setMaxShiftHours(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-xs font-black text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-mono"
                />
                <span className="absolute right-4 top-3 text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase">horas</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wide flex items-center gap-1.5">
                Linha Central SOS / Rádio (GSM)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={supportPhone}
                  onChange={(e) => setSupportPhone(e.target.value)}
                  placeholder="+244923456789"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-xs font-black text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-mono"
                />
                <Phone className="absolute right-4 top-3.5 text-slate-400" size={14} />
              </div>
            </div>

          </div>
        </div>

        {/* Theme and Layout Customization Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
              <Volume2 size={14} className="text-amber-500" />
              Estilo, Sons & Interface
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5 font-medium uppercase">Personalize a identidade da interface do motorista</p>
          </div>

          <div className="space-y-4">
            
            <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-100 dark:border-white/5">
              <div className="flex items-start gap-3">
                <div className="mt-1 p-1.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg">
                  <Moon size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Ativar Modo Escuro por Defeito</h4>
                  <p className="text-[11px] text-slate-550 dark:text-slate-400 leading-normal">Otimiza o consumo de bateria no ecrã OLED e reduz fadiga ocular em turnos noturnos.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDarkModeByDefault(!darkModeByDefault)}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  darkModeByDefault ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    darkModeByDefault ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-100 dark:border-white/5">
              <div className="flex items-start gap-3">
                <div className="mt-1 p-1.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg">
                  <Volume2 size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Sons para Novas Corridas</h4>
                  <p className="text-[11px] text-slate-550 dark:text-slate-400 leading-normal">Sinal sonoro de alta frequência para alertar novas chamadas mesmo com a app minimizada.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSoundAlertsEnabled(!soundAlertsEnabled)}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  soundAlertsEnabled ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    soundAlertsEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wide">Mensagem Motivacional Inicial</label>
              <textarea
                rows={3}
                value={driverWelcomeMsg}
                onChange={(e) => setDriverWelcomeMsg(e.target.value)}
                placeholder="Ex: Bom trabalho, parceiro! Conduza com cuidado."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 leading-relaxed"
              />
            </div>

            {/* Color accent options */}
            <div className="space-y-2.5">
              <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wide block">Cor de Destaque da App</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {colorOptions.map((opt) => (
                  <button
                    key={opt.hex}
                    type="button"
                    onClick={() => setPrimaryColor(opt.hex)}
                    className={`flex items-center gap-2 p-2 rounded-xl border text-[11px] font-bold transition-all ${
                      primaryColor === opt.hex 
                        ? 'border-slate-900 dark:border-white bg-slate-100 dark:bg-slate-800 font-extrabold text-slate-900 dark:text-white' 
                        : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-450'
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: opt.hex }} />
                    <span className="truncate">{opt.name}</span>
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Submission Action bar */}
        <div className="flex items-center gap-4 bg-slate-900 dark:bg-slate-950 p-4 rounded-2xl border border-white/5 shadow-lg">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-750 text-slate-950 font-black text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-lg shadow-amber-500/10 active:scale-95"
          >
            {saving ? (
              <>
                <div className="h-4 w-4 border-2 border-slate-950 border-t-transparent animate-spin rounded-full" />
                A Guardar Alterações...
              </>
            ) : (
              <>
                <Save size={14} />
                Guardar Configurações
              </>
            )}
          </button>
          
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-4 py-3.5 bg-white/5 hover:bg-white/10 text-white font-black text-[10px] uppercase tracking-wider rounded-xl border border-white/10 transition-all cursor-pointer"
          >
            <RotateCcw size={14} />
          </button>
        </div>

        {saveSuccess && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs font-black uppercase tracking-tight flex items-center gap-2 animate-bounce">
            <Check size={14} /> Configurações da App do Motorista sincronizadas com sucesso!
          </div>
        )}

        {errorMsg && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-xs font-bold flex items-center gap-2">
            <AlertCircle size={14} /> {errorMsg}
          </div>
        )}

      </form>

      {/* Dynamic Live Device Mock (Right 5 cols) */}
      <div className="lg:col-span-5 flex flex-col items-center">
        <div className="sticky top-6 w-full max-w-[340px] space-y-4">
          <div className="text-center">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Pré-visualização Dinâmica</h4>
            <p className="text-[10px] text-slate-500 uppercase font-medium">Demonstração ao vivo no smartphone do condutor</p>
          </div>

          {/* Smartphone container */}
          <div className="w-full aspect-[9/18] bg-slate-950 rounded-[40px] border-[10px] border-slate-900 shadow-2xl relative overflow-hidden flex flex-col ring-1 ring-white/10">
            {/* Dynamic camera notch */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-5 bg-slate-900 rounded-full z-50 flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-850" />
            </div>

            {/* Smart Screen */}
            <div className={`flex-1 flex flex-col p-4 pt-8 text-left transition-all ${darkModeByDefault ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
              
              {/* Top status bar */}
              <div className="flex items-center justify-between text-[8px] font-black uppercase mb-4 tracking-wider text-slate-450 dark:text-slate-500">
                <span>08:42</span>
                <span className="flex items-center gap-1.5 font-mono">
                  <Wifi size={8} className="text-emerald-500" />
                  PSM_4G
                </span>
              </div>

              {/* Dynamic Welcome Message */}
              <div className="p-3.5 bg-slate-900/40 dark:bg-white/5 rounded-2xl border border-slate-200/5 dark:border-white/5 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-slate-800 dark:bg-slate-900 flex items-center justify-center font-bold text-[9px] uppercase border border-white/10">
                    JD
                  </div>
                  <div>
                    <h5 className="text-[9px] font-black uppercase tracking-wider text-slate-500">Olá João Driver</h5>
                    <p className="text-[8px] font-bold text-slate-400">JIS ANGOLA</p>
                  </div>
                </div>
                <p className="text-[9px] font-black italic text-slate-650 dark:text-slate-350 leading-normal mt-1 border-t border-white/5 pt-1.5">
                  "{driverWelcomeMsg}"
                </p>
              </div>

              {/* Active Duty Status Widget */}
              <div className="mt-3.5 bg-slate-900/90 border border-white/10 rounded-2xl p-3.5 flex flex-col gap-2 relative shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Turno Ativo</span>
                    <h4 className="text-[11px] font-black text-white uppercase tracking-tight flex items-center gap-1.5 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Em Serviço
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono font-black text-amber-500">03h 15m</span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-1 pt-2 border-t border-white/5">
                  <div className="p-1.5 bg-white/5 rounded-lg">
                    <span className="text-[7px] font-black uppercase tracking-wider text-slate-400 block">Rendas Diárias</span>
                    <span className="text-[10px] font-black font-mono" style={{ color: primaryColor }}>34.500 Kz</span>
                  </div>
                  <div className="p-1.5 bg-white/5 rounded-lg">
                    <span className="text-[7px] font-black uppercase tracking-wider text-slate-400 block">Viagens Hoje</span>
                    <span className="text-[10px] font-black font-mono text-emerald-400">12</span>
                  </div>
                </div>
              </div>

              {/* Speed warning dynamic preview */}
              {speedWarningEnabled && (
                <div className="mt-3 bg-rose-500/15 border border-rose-500/20 p-2.5 rounded-xl flex items-center gap-2.5 animate-pulse">
                  <ShieldAlert className="text-rose-500" size={16} />
                  <div>
                    <h6 className="text-[8px] font-black text-rose-500 uppercase tracking-wider">Aviso de Velocidade</h6>
                    <p className="text-[7px] text-rose-450">Limite máximo de {maxSpeedThreshold}km/h ultrapassado (84km/h)</p>
                  </div>
                </div>
              )}

              {/* Action buttons inside mock app */}
              <div className="mt-auto grid grid-cols-3 gap-2">
                <div className="p-2 bg-slate-900/40 dark:bg-white/5 rounded-xl border border-white/5 text-center flex flex-col items-center gap-1">
                  <MapPin size={12} className="text-blue-400" />
                  <span className="text-[7px] font-black uppercase tracking-tighter">Corridas</span>
                </div>
                
                {allowOfflineCash && (
                  <div className="p-2 bg-slate-900/40 dark:bg-white/5 rounded-xl border border-white/5 text-center flex flex-col items-center gap-1">
                    <Zap size={12} className="text-amber-500 animate-pulse" />
                    <span className="text-[7px] font-black uppercase tracking-tighter">Renda +</span>
                  </div>
                )}

                {allowFuelDeclaration && (
                  <div className="p-2 bg-slate-900/40 dark:bg-white/5 rounded-xl border border-white/5 text-center flex flex-col items-center gap-1">
                    <Fuel size={12} className="text-emerald-400" />
                    <span className="text-[7px] font-black uppercase tracking-tighter">Abastec.</span>
                  </div>
                )}
              </div>

              {/* Urgent SOS Button */}
              <div className="mt-3 p-2 bg-rose-600 rounded-xl flex items-center justify-center gap-1.5 text-white font-black text-[9px] uppercase tracking-widest shadow-md">
                <Activity size={10} className="animate-pulse" />
                Pânico S.O.S Activo
              </div>

            </div>

            {/* Bottom screen navigator line */}
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-24 h-1 bg-slate-800 rounded-full" />
          </div>

          <div className="p-3 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl flex items-start gap-2.5">
            <Info size={14} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[9px] text-slate-500 leading-normal">
              Esta visualização adapta-se em tempo real conforme as alterações feitas no painel ao lado. Os motoristas receberão estas atualizações imediatamente ao carregar o aplicativo.
            </p>
          </div>

        </div>
      </div>

    </div>
  );
}
