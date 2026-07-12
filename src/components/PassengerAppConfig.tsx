import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  ShieldAlert, 
  MessageSquare, 
  Clock, 
  Compass, 
  MapPin, 
  Sparkles, 
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
  Map, 
  Star, 
  Share2, 
  Layers,
  ArrowRight,
  Activity,
  UserCheck,
  Copy,
  ExternalLink,
  Gift
} from 'lucide-react';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from '@/src/lib/firebase';
import PassengerFlow from './PassengerFlow';

interface PassengerAppConfigProps {
  tenantId?: string;
  tenantName?: string;
}

export default function PassengerAppConfig({ tenantId, tenantName = "SUPER Taxi" }: PassengerAppConfigProps) {
  // Config state
  const [enabled, setEnabled] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    const url = typeof window !== 'undefined' ? `${window.location.origin}/?view=passenger` : '';
    if (url) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  // Features toggles
  const [bookingEnabled, setBookingEnabled] = useState(true);
  const [historyEnabled, setHistoryEnabled] = useState(true);
  const [supportChatEnabled, setSupportChatEnabled] = useState(true);
  const [panicSosEnabled, setPanicSosEnabled] = useState(true);
  const [fareEstimateEnabled, setFareEstimateEnabled] = useState(true);
  const [driverRatingEnabled, setDriverRatingEnabled] = useState(true);
  const [routeSharingEnabled, setRouteSharingEnabled] = useState(true);
  const [bonusClubEnabled, setBonusClubEnabled] = useState(true);
  const [bonusClubCashbackPercent, setBonusClubCashbackPercent] = useState(5);
  
  // Parameters
  const [searchRadiusKm, setSearchRadiusKm] = useState(15);
  const [driverWaitTimeSec, setDriverWaitTimeSec] = useState(90);
  const [baseFareKz, setBaseFareKz] = useState(500);
  const [perKmFareKz, setPerKmFareKz] = useState(250);
  const [supportPhone, setSupportPhone] = useState('999123456');
  
  // Styling preferences
  const [primaryColor, setPrimaryColor] = useState('#0d6efd'); // hex or tailwind equivalent
  const [darkModeByDefault, setDarkModeByDefault] = useState(false);
  const [customWelcomeMsg, setCustomWelcomeMsg] = useState('Bem-vindo ao SUPER Taxi! Para onde vamos hoje?');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load configuration from settings/passenger_app doc
  useEffect(() => {
    setLoading(true);
    const configDocRef = doc(db, 'settings', 'passenger_app');
    
    const unsubscribe = onSnapshot(configDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setEnabled(data.enabled !== false);
        setBookingEnabled(data.bookingEnabled !== false);
        setHistoryEnabled(data.historyEnabled !== false);
        setSupportChatEnabled(data.supportChatEnabled !== false);
        setPanicSosEnabled(data.panicSosEnabled !== false);
        setFareEstimateEnabled(data.fareEstimateEnabled !== false);
        setDriverRatingEnabled(data.driverRatingEnabled !== false);
        setRouteSharingEnabled(data.routeSharingEnabled !== false);
        setBonusClubEnabled(data.bonusClubEnabled !== false);
        setBonusClubCashbackPercent(data.bonusClubCashbackPercent || 5);
        setSearchRadiusKm(data.searchRadiusKm || 15);
        setDriverWaitTimeSec(data.driverWaitTimeSec || 90);
        setBaseFareKz(data.baseFareKz || 500);
        setPerKmFareKz(data.perKmFareKz || 250);
        setSupportPhone(data.supportPhone || '999123456');
        setPrimaryColor(data.primaryColor || '#0d6efd');
        setDarkModeByDefault(data.darkModeByDefault || false);
        setCustomWelcomeMsg(data.customWelcomeMsg || 'Bem-vindo ao SUPER Taxi! Para onde vamos hoje?');
      }
      setLoading(false);
    }, (err) => {
      console.error("Erro ao ler configuração da App do Passageiro:", err);
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
      const configDocRef = doc(db, 'settings', 'passenger_app');
      await setDoc(configDocRef, {
        enabled,
        bookingEnabled,
        historyEnabled,
        supportChatEnabled,
        panicSosEnabled,
        fareEstimateEnabled,
        driverRatingEnabled,
        routeSharingEnabled,
        bonusClubEnabled,
        bonusClubCashbackPercent: Number(bonusClubCashbackPercent),
        searchRadiusKm: Number(searchRadiusKm),
        driverWaitTimeSec: Number(driverWaitTimeSec),
        baseFareKz: Number(baseFareKz),
        perKmFareKz: Number(perKmFareKz),
        supportPhone: supportPhone.trim(),
        primaryColor,
        darkModeByDefault,
        customWelcomeMsg: customWelcomeMsg.trim(),
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.email || 'admin'
      }, { merge: true });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      console.error("Erro ao guardar configuração:", err);
      handleFirestoreError(err, OperationType.UPDATE, 'settings/passenger_app');
      setErrorMsg("Falha ao registar dados no Firestore: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (window.confirm("Deseja restaurar as configurações padrão de fábrica para o App do Passageiro?")) {
      setEnabled(true);
      setBookingEnabled(true);
      setHistoryEnabled(true);
      setSupportChatEnabled(true);
      setPanicSosEnabled(true);
      setFareEstimateEnabled(true);
      setDriverRatingEnabled(true);
      setRouteSharingEnabled(true);
      setBonusClubEnabled(true);
      setBonusClubCashbackPercent(5);
      setSearchRadiusKm(15);
      setDriverWaitTimeSec(90);
      setBaseFareKz(500);
      setPerKmFareKz(250);
      setSupportPhone('999123456');
      setPrimaryColor('#0d6efd');
      setDarkModeByDefault(false);
      setCustomWelcomeMsg('Bem-vindo ao SUPER Taxi! Para onde vamos hoje?');
    }
  };

  const colorOptions = [
    { name: 'Azul PSM', hex: '#0d6efd', label: 'Azul Técnico' },
    { name: 'Verde Esmeralda', hex: '#10b981', label: 'Ecológico' },
    { name: 'Laranja Radiante', hex: '#f97316', label: 'Urbano' },
    { name: 'Vermelho Alerta', hex: '#f43f5e', label: 'Dinâmico' },
    { name: 'Amarelo Táxi', hex: '#eab308', label: 'Clássico' },
    { name: 'Índigo Escuro', hex: '#6366f1', label: 'Premium' },
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
    <div id="passenger-app-config-root" className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
      
      {/* Configuration Controls (Left 7 cols) */}
      <form onSubmit={handleSave} className="lg:col-span-7 space-y-6">
        
        {/* Header alert about Passenger App */}
        <div className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 dark:from-blue-950/20 dark:to-indigo-950/20 p-5 rounded-2xl border border-blue-100 dark:border-blue-900/30 flex items-start gap-4">
          <div className="p-2 bg-blue-500/20 rounded-xl text-blue-600 dark:text-blue-400">
            <Smartphone size={24} className="animate-bounce" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Consola de Funcionalidades do App do Passageiro</h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Configure as permissões, parâmetros técnicos e funcionalidades em tempo real que serão consumidas pela aplicação móvel dos passageiros em <strong>Luena, Moxico (+244)</strong> para a filial <strong>{tenantName}</strong>.
            </p>
          </div>
        </div>

        {/* Master Control Toggle Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Estado Global da Integração</h3>
              <p className="text-xs text-slate-500">Permitir ligações de novos clientes e downloads de perfil de passageiro.</p>
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
              <Layers size={14} className="text-brand-primary" />
              Funcionalidades do Aplicativo
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5 font-medium uppercase">Defina o nível de controlo que o cliente possui no smartphone</p>
          </div>

          <div className="space-y-4">
            
            {/* 1. Reserva de Táxi */}
            <div className="flex items-start justify-between p-3.5 bg-slate-50 dark:bg-slate-850 rounded-xl hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-all border border-slate-100 dark:border-white/5">
              <div className="flex items-start gap-3">
                <div className="mt-1 p-1.5 bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-lg">
                  <MapPin size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Reserva & Chamada de Táxi</h4>
                  <p className="text-[11px] text-slate-550 dark:text-slate-400 leading-normal">Permite solicitar veículos instantâneos em Luena ou programar viagens.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBookingEnabled(!bookingEnabled)}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  bookingEnabled ? 'bg-brand-primary' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    bookingEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* 2. Histórico de Viagens */}
            <div className="flex items-start justify-between p-3.5 bg-slate-50 dark:bg-slate-850 rounded-xl hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-all border border-slate-100 dark:border-white/5">
              <div className="flex items-start gap-3">
                <div className="mt-1 p-1.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-lg">
                  <Compass size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Histórico de Corridas</h4>
                  <p className="text-[11px] text-slate-550 dark:text-slate-400 leading-normal">Acesso a faturas digitais, rotas efetuadas, preços pagos e relatórios de uso.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHistoryEnabled(!historyEnabled)}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  historyEnabled ? 'bg-brand-primary' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    historyEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* 3. Chat de Suporte */}
            <div className="flex items-start justify-between p-3.5 bg-slate-50 dark:bg-slate-850 rounded-xl hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-all border border-slate-100 dark:border-white/5">
              <div className="flex items-start gap-3">
                <div className="mt-1 p-1.5 bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 rounded-lg">
                  <MessageSquare size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Chat de Apoio ao Passageiro</h4>
                  <p className="text-[11px] text-slate-550 dark:text-slate-400 leading-normal">Comunicação imediata via WhatsApp ou chat incorporado com a central de despacho.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSupportChatEnabled(!supportChatEnabled)}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  supportChatEnabled ? 'bg-brand-primary' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    supportChatEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* 4. Panic S.O.S Button */}
            <div className="flex items-start justify-between p-3.5 bg-slate-50 dark:bg-slate-850 rounded-xl hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-all border border-slate-100 dark:border-white/5">
              <div className="flex items-start gap-3">
                <div className="mt-1 p-1.5 bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-450 rounded-lg">
                  <ShieldAlert size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Botão S.O.S / Alerta de Pânico</h4>
                  <p className="text-[11px] text-slate-550 dark:text-slate-400 leading-normal">Notificação instantânea para a central e gravação de rota em caso de ameaça.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPanicSosEnabled(!panicSosEnabled)}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  panicSosEnabled ? 'bg-brand-primary' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    panicSosEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* 5. Estimativa Dinâmica de Tarifas */}
            <div className="flex items-start justify-between p-3.5 bg-slate-50 dark:bg-slate-850 rounded-xl hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-all border border-slate-100 dark:border-white/5">
              <div className="flex items-start gap-3">
                <div className="mt-1 p-1.5 bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-450 rounded-lg">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Estimativa Prévia de Preço</h4>
                  <p className="text-[11px] text-slate-550 dark:text-slate-400 leading-normal">Cálculo preditivo de Kwanza em tempo real com base no percurso indicado.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFareEstimateEnabled(!fareEstimateEnabled)}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  fareEstimateEnabled ? 'bg-brand-primary' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    fareEstimateEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* 6. Avaliação de Motoristas */}
            <div className="flex items-start justify-between p-3.5 bg-slate-50 dark:bg-slate-850 rounded-xl hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-all border border-slate-100 dark:border-white/5">
              <div className="flex items-start gap-3">
                <div className="mt-1 p-1.5 bg-yellow-105 dark:bg-yellow-950 text-yellow-600 dark:text-yellow-400 rounded-lg">
                  <Star size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Feedback de Viagem (Rating)</h4>
                  <p className="text-[11px] text-slate-550 dark:text-slate-400 leading-normal">Permite classificar o motorista e o estado de conservação do veículo após a corrida.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDriverRatingEnabled(!driverRatingEnabled)}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  driverRatingEnabled ? 'bg-brand-primary' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    driverRatingEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* 7. Partilha de Rota */}
            <div className="flex items-start justify-between p-3.5 bg-slate-50 dark:bg-slate-850 rounded-xl hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-all border border-slate-100 dark:border-white/5">
              <div className="flex items-start gap-3">
                <div className="mt-1 p-1.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-lg">
                  <Share2 size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Partilha de Trajeto Ativo</h4>
                  <p className="text-[11px] text-slate-550 dark:text-slate-400 leading-normal">Gera link encriptado para partilhar com familiares no WhatsApp acompanhando o táxi.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRouteSharingEnabled(!routeSharingEnabled)}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  routeSharingEnabled ? 'bg-brand-primary' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    routeSharingEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* 8. Clube de Bónus */}
            <div className="flex flex-col gap-3 p-3.5 bg-slate-50 dark:bg-slate-850 rounded-xl hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-all border border-slate-100 dark:border-white/5">
              <div className="flex items-start justify-between w-full">
                <div className="flex items-start gap-3">
                  <div className="mt-1 p-1.5 bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-450 rounded-lg">
                    <Gift size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">SUPER Táxi Clube de Bónus 🌟</h4>
                    <p className="text-[11px] text-slate-550 dark:text-slate-400 leading-normal">Plano de fidelização por cada viagem efetuada (O saldo acumula para viagens grátis).</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setBonusClubEnabled(!bonusClubEnabled)}
                  className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    bonusClubEnabled ? 'bg-brand-primary' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      bonusClubEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {bonusClubEnabled && (
                <div className="flex items-center gap-3 pl-9 pt-1.5 border-t border-slate-200/50 dark:border-white/5">
                  <label htmlFor="bonus-cashback-input" className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Percentagem de Cashback (%):
                  </label>
                  <input
                    id="bonus-cashback-input"
                    type="number"
                    min="1"
                    max="100"
                    value={bonusClubCashbackPercent}
                    onChange={(e) => setBonusClubCashbackPercent(Math.max(1, Math.min(100, Number(e.target.value))))}
                    className="w-16 px-2 py-1 text-xs font-black text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg text-slate-800 dark:text-slate-100 outline-none focus:border-brand-primary"
                  />
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Technical Parametrization */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 p-6 shadow-sm space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
              <Sliders size={14} className="text-indigo-600" />
              Parâmetros Técnicos de Pesquisa & Tarifação
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5 font-medium uppercase">Configurações de proximidade e custos de deslocação em Angola</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Raio Limite de Procura (km)</label>
              <div className="relative flex items-center bg-slate-50 dark:bg-slate-850 rounded-xl overflow-hidden border border-slate-200 dark:border-white/5">
                <input
                  type="number"
                  min="1"
                  max="50"
                  required
                  value={searchRadiusKm}
                  onChange={(e) => setSearchRadiusKm(Math.max(1, Number(e.target.value)))}
                  className="w-full px-4 py-2.5 bg-transparent text-xs font-bold outline-none text-slate-900 dark:text-white"
                />
                <span className="px-3 bg-slate-200 dark:bg-slate-800 text-[10px] font-black text-slate-500 py-3 block shrink-0">KM</span>
              </div>
              <p className="text-[9px] text-slate-400 leading-tight">Distância radial máxima em Luena para avisar os motoristas.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Tempo Aceitação Motorista (s)</label>
              <div className="relative flex items-center bg-slate-50 dark:bg-slate-850 rounded-xl overflow-hidden border border-slate-200 dark:border-white/5">
                <input
                  type="number"
                  min="10"
                  max="300"
                  required
                  value={driverWaitTimeSec}
                  onChange={(e) => setDriverWaitTimeSec(Math.max(10, Number(e.target.value)))}
                  className="w-full px-4 py-2.5 bg-transparent text-xs font-bold outline-none text-slate-900 dark:text-white"
                />
                <span className="px-3 bg-slate-200 dark:bg-slate-800 text-[10px] font-black text-slate-500 py-3 block shrink-0">SEG</span>
              </div>
              <p className="text-[9px] text-slate-400 leading-tight">Tempo limite de toque de chamada no terminal móvel do condutor.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Bandeirada Base de Viagem (Kz)</label>
              <div className="relative flex items-center bg-slate-50 dark:bg-slate-850 rounded-xl overflow-hidden border border-slate-200 dark:border-white/5">
                <input
                  type="number"
                  min="0"
                  step="50"
                  required
                  value={baseFareKz}
                  onChange={(e) => setBaseFareKz(Math.max(0, Number(e.target.value)))}
                  className="w-full px-4 py-2.5 bg-transparent text-xs font-bold outline-none text-slate-900 dark:text-white"
                />
                <span className="px-3 bg-slate-200 dark:bg-slate-800 text-[10px] font-black text-slate-500 py-3 block shrink-0">AOA (Kz)</span>
              </div>
              <p className="text-[9px] text-slate-400 leading-tight">Preço inicial fixo cobrado no momento da confirmação.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Custo por Quilómetro Percorrido (Kz/km)</label>
              <div className="relative flex items-center bg-slate-50 dark:bg-slate-850 rounded-xl overflow-hidden border border-slate-200 dark:border-white/5">
                <input
                  type="number"
                  min="0"
                  step="10"
                  required
                  value={perKmFareKz}
                  onChange={(e) => setPerKmFareKz(Math.max(0, Number(e.target.value)))}
                  className="w-full px-4 py-2.5 bg-transparent text-xs font-bold outline-none text-slate-900 dark:text-white"
                />
                <span className="px-3 bg-slate-200 dark:bg-slate-800 text-[10px] font-black text-slate-500 py-3 block shrink-0">Kz/km</span>
              </div>
              <p className="text-[9px] text-slate-400 leading-tight">Valor adicionado ao trajeto sugerido por cada km percorrido.</p>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Linha de Telefone do Despacho (+244)</label>
              <div className="relative flex rounded-xl overflow-hidden border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-850">
                <span className="bg-slate-200 dark:bg-slate-800 px-3 flex items-center text-xs font-black text-slate-500 border-r border-slate-100 dark:border-white/5">+244</span>
                <input
                  type="text"
                  required
                  value={supportPhone}
                  onChange={(e) => setSupportPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="923 000 000"
                  className="w-full px-4 py-2.5 bg-transparent text-xs font-bold outline-none text-slate-900 dark:text-white"
                />
              </div>
              <p className="text-[9px] text-slate-400 leading-tight">Número ao qual o passageiro se conectará ao acionar SOS ou suporte telefónico.</p>
            </div>

          </div>
        </div>

        {/* Visual Customization */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 p-6 shadow-sm space-y-5">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
              <Sparkles size={14} className="text-amber-500" />
              Identidade Visual & Experiência de Entrada
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5 font-medium uppercase">Defina a imagem de marca da filial no telemóvel do cliente</p>
          </div>

          <div className="space-y-4">
            
            {/* Color selector */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Paleta Primária do Aplicativo</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {colorOptions.map((opt) => (
                  <button
                    key={opt.hex}
                    type="button"
                    onClick={() => setPrimaryColor(opt.hex)}
                    className={`p-2.5 rounded-xl border flex items-center gap-2 text-[11px] font-bold transition-all hover:bg-slate-50 dark:hover:bg-slate-850/50 ${
                      primaryColor === opt.hex 
                        ? 'border-slate-900 bg-slate-50 dark:border-white dark:bg-slate-850' 
                        : 'border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: opt.hex }} />
                    <div className="text-left font-black leading-tight text-slate-800 dark:text-slate-100">
                      <p>{opt.name}</p>
                      <span className="text-[9px] text-slate-400 font-medium">{opt.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Welcome messages customizer */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Mensagem de Boas-Vindas Principal</label>
              <input
                type="text"
                required
                maxLength={80}
                value={customWelcomeMsg}
                onChange={(e) => setCustomWelcomeMsg(e.target.value)}
                placeholder="Ex e.g. Olá! Peça o seu Táxi de Confiança agora."
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-white/5 rounded-xl text-xs font-bold outline-none text-slate-900 dark:text-white"
              />
              <div className="flex justify-between items-center text-[9px] text-slate-400">
                <span>Será apresentada no ecrã inicial de introdução da aplicação móvel.</span>
                <span className="font-mono">{customWelcomeMsg.length}/80 chars</span>
              </div>
            </div>

            {/* Dark mode toggle */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-100 dark:border-white/5">
              <div>
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Forçar Modo Noite por Defeito</h4>
                <p className="text-[10px] text-slate-500">Garante menor cansaço visual aos passageiros no Moxico durante as chamadas noturnas.</p>
              </div>
              <button
                type="button"
                onClick={() => setDarkModeByDefault(!darkModeByDefault)}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  darkModeByDefault ? 'bg-brand-primary' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    darkModeByDefault ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-slate-950 dark:bg-white text-white dark:text-slate-950 font-black text-xs py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 font-sans tracking-widest uppercase cursor-pointer"
          >
            {saving ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <>
                <Save size={16} />
                Sincronizar Definições (Firestore)
              </>
            )}
          </button>
          
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-6 py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-650 dark:text-slate-305 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-widest"
          >
            <RotateCcw size={16} />
            Padrão
          </button>
        </div>

        {/* Toast/Alert messages */}
        {errorMsg && (
          <div className="bg-red-50 text-red-600 text-xs font-bold py-3 px-4 rounded-xl border border-red-100 flex items-center gap-2 animate-bounce">
            <AlertCircle size={14} />
            <span>{errorMsg}</span>
          </div>
        )}

        {saveSuccess && (
          <div className="bg-emerald-50 text-emerald-700 text-xs font-black py-3 px-4 rounded-xl border border-emerald-150 flex items-center gap-2 animate-pulse">
            <Check size={14} className="text-emerald-500" />
            <span>Sincronização bem-sucedida! Parâmetros gravados no nó federado com sucesso.</span>
          </div>
        )}

        {/* PUBLIC ACCESS / SHARING PANEL (Added for José Iweza Suana) */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden text-white mt-8 space-y-6">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center gap-2.5 border-b border-white/5 pb-4">
            <div className="p-2 bg-brand-primary/20 rounded-xl text-brand-primary">
              <Share2 size={18} className="animate-pulse" />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Distribuição e Links Públicos</h3>
              <h2 className="text-sm font-black text-white uppercase italic mt-0.5">Partilhar App do Passageiro</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            
            {/* Left part: instructions and URL */}
            <div className="md:col-span-8 space-y-4">
              <p className="text-[11.5px] text-slate-300 leading-relaxed font-semibold">
                José Iweza Suana (**JIS**), utilize as opções de sincronização rápida abaixo para distribuir a aplicação móvel oficial de passageiros em Luena. Qualquer utilizador poderá usufruir da experiência simulada ou real de táxis.
              </p>

              <div className="space-y-1.5 font-sans">
                <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest block font-mono">Link de Acesso Público</label>
                <div className="flex items-center gap-2 bg-slate-950/85 p-2 rounded-xl border border-white/5">
                  <span className="text-[10.5px] font-mono text-blue-400 font-bold select-all truncate flex-1">
                    {typeof window !== 'undefined' ? `${window.location.origin}/?view=passenger` : "SUPER Taxi App"}
                  </span>
                  
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                      copied 
                        ? 'bg-emerald-600 text-white' 
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check size={11} /> Copiado!
                      </>
                    ) : (
                      <>
                        <Copy size={11} /> Copiar Link
                      </>
                    )}
                  </button>

                  <a
                    href={typeof window !== 'undefined' ? `${window.location.origin}/?view=passenger` : "#"}
                    target="_blank"
                    className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-slate-300 transition-colors shrink-0"
                    title="Abrir App Pública num Novo Separador"
                  >
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>

              {/* Direct share with WhatsApp button */}
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Aceda já à aplicação pública de passageiros da nossa operadora LUENA-MOXICO! Peça o seu Táxi ou envie propostas diretamente do seu telemóvel: ${typeof window !== 'undefined' ? `${window.location.origin}/?view=passenger` : ""}`)}`}
                target="_blank"
                className="inline-flex items-center gap-2 bg-[#25d366] hover:bg-[#20ba5a] text-xs font-black uppercase text-slate-950 px-4 py-2.5 rounded-xl transition-all shadow-lg active:scale-[0.98]"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.5-5.739-1.453L0 24zm6.59-4.846c1.6.95 3.1 1.45 4.8 1.45 5.518 0 10.007-4.49 10.012-10.01.002-2.673-1.037-5.187-2.923-7.076C16.65 1.63 14.137.59 11.467.59 5.949.59 1.46 5.08 1.455 10.6c-.001 1.76.46 3.48 1.33 5.02c.16.28.09.43-.16 1.32-.4 1.48-1 3.58-1 3.58l3.66-.96c.74-.2 1.05-.1 1.34.05zm12.35-8.4l-.8-.4a.55.55 0 00-.7.2l-.7 1a.5.5 0 01-.6.1l-2.4-1.2-1.6-1.6c-.1-.1-.1-.3 0-.5l.8-.9a.4.4 0 000-.5l-1.2-2.9c-.3-.7-.6-.6-.8-.6h-.6a1.1 1.1 0 00-.8.4C6 5.3 5.6 6 5.6 7.2c0 1.5.6 2.9 1.5 4l4.5 5.2a5.5 5.5 0 003.8 2.2c1.2.1 2.3 0 3-.1.7-.1 1.5-.6 1.7-1.1s.2-1 .1-1.1c-.1-.2-.3-.3-.6-.5z" />
                </svg>
                Partilhar no WhatsApp
              </a>
            </div>

            {/* Right part: Scan QR code */}
            <div className="md:col-span-4 flex flex-col items-center text-center space-y-2 shrink-0 bg-white/5 p-4 rounded-xl border border-white/5">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest font-mono">Digitalizar QR</span>
              
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(typeof window !== 'undefined' ? `${window.location.origin}/?view=passenger` : "https://taxi-dev")}`} 
                alt="Passenger App QR Code" 
                className="w-24 h-24 bg-white p-1 rounded-lg shadow-inner border border-slate-705"
                referrerPolicy="no-referrer"
              />
              
              <span className="text-[7.5px] text-slate-400 font-extrabold leading-none uppercase tracking-wider">Acesso Instantâneo</span>
            </div>

          </div>
        </div>

      </form>

      {/* Real-time Interactive mobile preview screen (Right 5 cols) */}
      <div className="lg:col-span-5 flex flex-col items-center">
        <div className="sticky top-6 w-full max-w-[340px]">
          
          <div className="mb-2 text-center">
            <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-500 px-3 py-1 rounded-full border border-slate-200 dark:border-white/5">
              <Eye size={12} className="text-slate-400" /> SIMULADOR EM TEMPO REAL
            </span>
          </div>

          {/* Smartphone structure mockup */}
          <div className="relative mx-auto w-full aspect-[9/18.5] bg-slate-900 rounded-[44px] p-3.5 shadow-2xl border-4 border-slate-800 shadow-slate-900/30 overflow-hidden ring-1 ring-white/15">
            
            {/* Dynamic Status bar phone decoration */}
            <div className="absolute top-0 inset-x-0 h-10 bg-slate-950 flex items-end justify-between px-7 pb-1 z-30 select-none">
              <span className="text-[10px] font-bold text-white tracking-widest">09:41</span>
              
              {/* Speaker / Camera Notch */}
              <div className="w-20 h-4 bg-slate-950 rounded-b-xl absolute left-1/2 -translate-x-1/2 top-0" />
              
              <div className="flex items-center gap-1.5 text-white">
                <Wifi size={10} />
                <span className="text-[10px] font-black tracking-tighter">PSM LTE</span>
                <div className="w-4 h-2.5 border border-white/70 rounded-sm bg-white/20 p-0.5 flex">
                  <div className="h-full bg-white flex-1" />
                </div>
              </div>
            </div>

            {/* Main view container mimicking mobile passenger app */}
            <div className={`w-full h-full rounded-[32px] overflow-hidden flex flex-col font-sans transition-all z-10 ${
              darkModeByDefault ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'
            }`}>
              
              {/* App Status banner */}
              <div className="h-10 shrink-0" /> {/* spacer for status bar */}

              {/* App Navigation top Header */}
              <div className="p-4 flex items-center justify-between border-b border-slate-150/50 dark:border-white/5 shrink-0 bg-white dark:bg-slate-900">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white font-black text-xs transition-colors" style={{ backgroundColor: primaryColor }}>
                    S
                  </div>
                  <div>
                    <h5 className="text-[11px] font-black tracking-tight leading-none uppercase">{tenantName}</h5>
                    <span className="text-[8px] text-slate-400 leading-none">Passageiro Oficial</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[8px] font-black uppercase text-slate-450 dark:text-slate-350">Moxico Ativo</span>
                </div>
              </div>

              {/* Simulation message banner if master toggle is off */}
              {!enabled && (
                <div className="bg-rose-500 text-white text-[9px] font-black py-1.5 px-3 uppercase tracking-wider text-center flex items-center justify-center gap-1">
                  <AlertCircle size={10} /> Canal Desativado na Sede
                </div>
              )}

              {/* Interactive body */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs select-none custom-scrollbar">
                
                {/* Custom Welcome Message */}
                <div className="space-y-1">
                  <p className="text-[13px] font-black tracking-tight leading-tight pt-1">
                    {customWelcomeMsg || 'Olá! Como o podemos ajudar por Luena hoje?'}
                  </p>
                  <p className="text-[9px] text-slate-405 dark:text-slate-450 font-medium">Bandeirada Base para serviços públicos: <strong className="text-slate-905 dark:text-white font-extrabold">{baseFareKz} Kz</strong></p>
                </div>

                {/* Simulated Map placeholder */}
                <div className="relative aspect-[16/9] bg-slate-200 dark:bg-slate-800 rounded-xl overflow-hidden shadow-inner flex items-center justify-center border border-slate-300/40 dark:border-white/5">
                  {/* Mock map details */}
                  <div className="absolute inset-0 bg-blue-50/10 opacity-30 pointer-events-none" />
                  
                  {/* Street simulation lines */}
                  <div className="absolute top-1/3 left-0 right-0 h-1 bg-slate-300 dark:bg-slate-700/60 rotate-12 transform" />
                  <div className="absolute top-0 bottom-0 left-1/2 w-1 bg-slate-300 dark:bg-slate-700/60 -rotate-12 transform" />
                  
                  {/* Moxico map Pin indicator */}
                  <div className="absolute top-1/4 right-1/3 flex flex-col items-center">
                    <div className="px-1.5 py-0.5 bg-slate-950 text-white text-[7px] font-black rounded shadow leading-none uppercase">Táxi Próximo</div>
                    <div className="w-2 h-2 rounded-full absolute -bottom-1" style={{ backgroundColor: primaryColor }} />
                  </div>

                  <div className="absolute bottom-1/4 left-1/3 flex flex-col items-center">
                    <div className="w-4 h-4 bg-rose-500 rounded-full flex items-center justify-center text-white scale-110 shadow-lg shadow-rose-500/20">
                      <User size={10} />
                    </div>
                  </div>

                  <span className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/70 text-white text-[7.5px] font-bold px-1.5 py-0.5 rounded backdrop-blur">
                    <Compass size={8} className="animate-spin" /> Raio Máx: {searchRadiusKm}km
                  </span>
                </div>

                {/* Action Buttons in client app based on active controls */}
                <div className="space-y-2">
                  
                  {/* Dynamic booking button */}
                  {bookingEnabled ? (
                    <div 
                      className="w-full text-white text-[10px] font-black py-2.5 px-3 rounded-xl flex items-center justify-between shadow-md uppercase transition-all cursor-pointer"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <span>Pedir Táxi Público Moxico</span>
                      <ArrowRight size={12} className="animate-pulse" />
                    </div>
                  ) : (
                    <div className="w-full bg-slate-200 dark:bg-slate-850 text-slate-400 dark:text-slate-600 text-[9px] font-black py-2.5 px-3 rounded-xl text-center border border-dashed border-slate-300 dark:border-slate-800 uppercase">
                      ⚠️ Chamadas Rápidas Desativadas temporariamente
                    </div>
                  )}

                  {/* Fare dynamic preview */}
                  {bookingEnabled && fareEstimateEnabled && (
                    <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-white/5 p-2.5 rounded-lg text-[9px] flex justify-between items-center text-slate-700 dark:text-slate-300">
                      <div>
                        <span className="block text-[8px] text-slate-400 font-bold uppercase tracking-wider">Tarifa Sugerida</span>
                        <span className="font-black text-rose-500">Estimativa baseada no percurso</span>
                      </div>
                      <div className="text-right font-black">
                        <span className="block text-[11px] text-slate-800 dark:text-white tracking-tighter">{baseFareKz + (perKmFareKz * 2.5)} <span className="text-[8px] opacity-75">Kz</span></span>
                        <span className="text-[7.5px] text-slate-400 font-bold">2.5 KM Simulado</span>
                      </div>
                    </div>
                  )}

                  {/* S.O.S Trigger button inside client app */}
                  {panicSosEnabled && (
                    <div className="w-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-[9.5px] font-extrabold py-2 px-3 rounded-xl flex items-center gap-1.5 border border-rose-500/20 active:scale-95 transition-all">
                      <ShieldAlert size={12} className="text-rose-500 animate-pulse" />
                      <span className="uppercase tracking-wide flex-1">BOTÃO S.O.S (ALERTA DE SEGURANÇA)</span>
                      <span className="text-[7.5px] font-mono text-slate-400">{supportPhone}</span>
                    </div>
                  )}

                  {/* Quick-links secondary actions based on configurations */}
                  <div className="grid grid-cols-2 gap-2 text-[8.5px] font-black uppercase">
                    
                    {/* Support Chat option */}
                    {supportChatEnabled ? (
                      <div className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-lg flex items-center gap-1.5 text-center justify-center text-slate-650 dark:text-slate-300 font-mono shadow-sm">
                        <MessageSquare size={10} className="text-indigo-500" />
                        <span>Chat WhatsApp</span>
                      </div>
                    ) : (
                      <div className="p-2 bg-slate-100 dark:bg-slate-850/50 border border-slate-200/40 dark:border-slate-800 text-slate-400 rounded-lg text-center justify-center flex items-center gap-1 line-through">
                        <span>Apoio</span>
                      </div>
                    )}

                    {/* Trip history option */}
                    {historyEnabled ? (
                      <div className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-lg flex items-center gap-1.5 text-center justify-center text-slate-650 dark:text-slate-300 font-mono shadow-sm">
                        <Compass size={10} className="text-emerald-500" />
                        <span>Minhas Viagens</span>
                      </div>
                    ) : (
                      <div className="p-2 bg-slate-100 dark:bg-slate-850/50 border border-slate-200/40 dark:border-slate-800 text-slate-400 rounded-lg text-center justify-center flex items-center gap-1 line-through">
                        <span>Histórico</span>
                      </div>
                    )}

                  </div>

                </div>

                {/* Star rating preview card */}
                {driverRatingEnabled && (
                  <div className="bg-gradient-to-br from-amber-50/10 to-yellow-50/5 dark:from-amber-950/10 dark:to-yellow-950/5 p-2.5 rounded-xl border border-amber-200/30 dark:border-amber-950/20 text-[9px] text-center space-y-1">
                    <span className="font-extrabold uppercase text-amber-600 block tracking-wider">Como correu a sua viagem com JIS?</span>
                    <div className="flex justify-center gap-1.5 text-amber-400 text-xs py-0.5">
                      <span>★</span><span>★</span><span>★</span><span>★</span><span className="opacity-40">★</span>
                    </div>
                    <span className="text-[7.5px] text-slate-405 dark:text-slate-450 block font-semibold leading-tight">Avaliações enviadas contam positivamente para o bónus do motorista</span>
                  </div>
                )}

              </div>

              {/* Status bar base phone home bar decoration */}
              <div className="h-6 shrink-0 bg-white dark:bg-slate-900 flex items-center justify-center border-t border-slate-150/40 dark:border-white/5">
                <div className="w-24 h-1 bg-slate-350 dark:bg-slate-600 rounded-full" />
              </div>

            </div>

          </div>

          <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-white/5 text-[10.5px] leading-relaxed text-slate-500 text-left font-medium">
            <Info size={12} className="inline mr-1 text-indigo-500 -mt-0.5" />
            Esta simulação interativa reflete os parâmetros exatos que o seu cliente visualizará no ecrã do telemóvel ao descarregar a aplicação da sua companhia.
          </div>

        </div>
      </div>

    </div>
  );
}
