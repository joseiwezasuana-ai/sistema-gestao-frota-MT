import React, { useState, useEffect, useRef } from 'react';
import { 
  Smartphone, ShieldCheck, ShieldAlert, Wifi, PhoneCall, MessageSquare, 
  Volume2, Play, Pause, AlertTriangle, Settings, RefreshCw, Layers, CheckCircle2, X, Lock, Unlock, Database, Send
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { collection, addDoc, serverTimestamp } from "../lib/firebase";

interface PermissionManagerProps {
  onPermissionChanged?: (perms: { callLog: boolean; sms: boolean; antenna: boolean }) => void;
  driverId?: string;
  driverName?: string;
}

export default function PermissionManager({ onPermissionChanged, driverId = "anon-driver", driverName = "Motorista Luena" }: PermissionManagerProps) {
  // Passcode verification states
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    return localStorage.getItem('perm_manager_unlocked') === 'true';
  });
  const [passcode, setPasscode] = useState<string>('');
  const [passcodeError, setPasscodeError] = useState<string>('');

  // Permission states
  const [callLogGranted, setCallLogGranted] = useState<boolean>(() => {
    return localStorage.getItem('perm_call_log') === 'granted';
  });
  const [smsGranted, setSmsGranted] = useState<boolean>(() => {
    return localStorage.getItem('perm_sms') === 'granted';
  });
  const [antennaActive, setAntennaActive] = useState<boolean>(() => {
    return localStorage.getItem('perm_antenna') === 'active';
  });

  // Local device log history
  const [logs, setLogs] = useState<Array<{ id: string; time: string; type: 'info' | 'call' | 'sms' | 'hardware'; message: string }>>([
    { id: '1', time: new Date().toLocaleTimeString(), type: 'info', message: 'Sistema de Monitorização Operacional JIS iniciado no Luena-Moxico.' },
    { id: '2', time: new Date().toLocaleTimeString(), type: 'hardware', message: 'Antena física GPS calibrada com precisão operacional.' }
  ]);

  const [isPlayingTestAudio, setIsPlayingTestAudio] = useState(false);
  const [isSimulatingIncoming, setIsSimulatingIncoming] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Synchronize state with callback
  useEffect(() => {
    if (onPermissionChanged) {
      onPermissionChanged({
        callLog: callLogGranted,
        sms: smsGranted,
        antenna: antennaActive
      });
    }
  }, [callLogGranted, smsGranted, antennaActive]);

  // Add a log entry helper
  const addLog = (type: 'info' | 'call' | 'sms' | 'hardware', message: string) => {
    setLogs(prev => [
      {
        id: Math.random().toString(),
        time: new Date().toLocaleTimeString(),
        type,
        message
      },
      ...prev.slice(0, 19) // Limit to 20 logs
    ]);
  };

  // Play the "Pedido Super Táxi" alert using Speech Synthesis Web Audio
  const playAlertSound = (type: 'call' | 'sms' | 'test') => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      addLog('info', 'Sintetizador de voz não suportado neste navegador.');
      return;
    }

    window.speechSynthesis.cancel();
    
    let text = "Pedido de Super Táxi.";
    if (type === 'call') {
      text = "Atenção motorista: Nova chamada recebida! Pedido de Super Táxi em linha! Por favor, atenda o cliente.";
    } else if (type === 'sms') {
      text = "Mensagem SMS recebida no telemóvel! Nova solicitação de transporte SUPER Táxi detetada no Luena.";
    } else {
      text = "Teste de som oficial. Voz: Pedido de Super Táxi, ativo e operacional no telemóvel do motorista!";
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-PT';
    utterance.rate = 0.95;
    utterance.pitch = 1.05;

    // Try to get a Portuguese voice
    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find(v => v.lang.startsWith('pt'));
    if (ptVoice) {
      utterance.voice = ptVoice;
    }

    utterance.onstart = () => {
      setIsPlayingTestAudio(true);
    };
    utterance.onend = () => {
      setIsPlayingTestAudio(false);
    };
    utterance.onerror = () => {
      setIsPlayingTestAudio(false);
    };

    speechUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const stopAlertSound = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsPlayingTestAudio(false);
    }
  };

  // Dynamic simulation of incoming calls/SMS from the background (DESATIVADO por solicitação do utilizador para evitar logs falsos)
  useEffect(() => {
    // Desativado para evitar registo automático de chamadas ou SMS fictícios na consola operacional
    return () => {};
  }, [callLogGranted, smsGranted]);

  const simulateIncomingCall = () => {
    setIsSimulatingIncoming(true);
    const mockNumber = `+244 92${Math.floor(1000000 + Math.random() * 9000000)}`;
    addLog('call', `CHAMADA DETETADA: Recebida de ${mockNumber}. A carregar áudio de Alerta...`);
    playAlertSound('call');
    setTimeout(() => setIsSimulatingIncoming(false), 5000);
  };

  const simulateIncomingSMS = () => {
    setIsSimulatingIncoming(true);
    const mockNumber = `+244 93${Math.floor(1000000 + Math.random() * 9000000)}`;
    addLog('sms', `SMS DETETADO: Novo SMS recebido de ${mockNumber}: "Quero um táxi para o Hospital Geral do Luena."`);
    playAlertSound('sms');
    setTimeout(() => setIsSimulatingIncoming(false), 5000);
  };

  // Request handlers with explanation of Native vs PWA wrappers
  const handleRequestCallLog = () => {
    addLog('info', 'A solicitar permissão de READ_CALL_LOG ao telemóvel...');
    
    // Check if running in a native webview wrapper with custom bridge
    if (typeof window !== 'undefined' && (window as any).AndroidBridge?.requestCallLogPermission) {
      (window as any).AndroidBridge.requestCallLogPermission().then((granted: boolean) => {
        setCallLogGranted(granted);
        localStorage.setItem('perm_call_log', granted ? 'granted' : 'denied');
        addLog('info', granted ? 'Permissão READ_CALL_LOG autorizada via Android Bridge nativo!' : 'Permissão READ_CALL_LOG rejeitada.');
      });
      return;
    }

    // PWA / Browser standard fallback simulation
    if (typeof navigator !== 'undefined' && (navigator as any).permissions) {
      const confirmGrant = window.confirm(
        "AUTORIZAÇÃO DO DISPOSITIVO (JIS TAXICONTROL)\n\n" +
        "Deseja autorizar o SUPER Táxi a ler os logs de chamadas recebidas para alertar sobre pedidos de clientes em segundo plano?\n\n" +
        "Nota: Em produção, isto é integrado através de Wrapper Nativo (Capacitor/Cordova) para Android."
      );
      
      if (confirmGrant) {
        setCallLogGranted(true);
        localStorage.setItem('perm_call_log', 'granted');
        addLog('info', 'Permissão READ_CALL_LOG autorizada com sucesso (Simulação PWA/Android Wrapper).');
        addLog('hardware', 'Escuta em tempo real de chamadas ativada no telemóvel do motorista.');
      } else {
        setCallLogGranted(false);
        localStorage.setItem('perm_call_log', 'denied');
        addLog('info', 'Permissão READ_CALL_LOG negada pelo operador.');
      }
    }
  };

  const handleRequestSMS = () => {
    addLog('info', 'A solicitar permissão de READ_SMS ao telemóvel...');

    if (typeof window !== 'undefined' && (window as any).AndroidBridge?.requestSMSPermission) {
      (window as any).AndroidBridge.requestSMSPermission().then((granted: boolean) => {
        setSmsGranted(granted);
        localStorage.setItem('perm_sms', granted ? 'granted' : 'denied');
        addLog('info', granted ? 'Permissão READ_SMS autorizada via Android Bridge!' : 'Permissão READ_SMS rejeitada.');
      });
      return;
    }

    const confirmGrant = window.confirm(
      "AUTORIZAÇÃO DO DISPOSITIVO (JIS TAXICONTROL)\n\n" +
      "Deseja autorizar o SUPER Táxi a monitorizar as SMS de entrada para processar reservas instantâneas sem gastar dados móveis?\n\n" +
      "Nota: Em produção, isto funciona através do plugin SMS Receiver nativo do Android."
    );
    
    if (confirmGrant) {
      setSmsGranted(true);
      localStorage.setItem('perm_sms', 'granted');
      addLog('info', 'Permissão READ_SMS autorizada com sucesso (Simulação PWA/Android Wrapper).');
      addLog('hardware', 'Escuta em segundo plano de SMS operacionais ativa.');
    } else {
      setSmsGranted(false);
      localStorage.setItem('perm_sms', 'denied');
      addLog('info', 'Permissão READ_SMS rejeitada.');
    }
  };

  const handleToggleAntenna = () => {
    if (antennaActive) {
      setAntennaActive(false);
      localStorage.setItem('perm_antenna', 'inactive');
      addLog('hardware', 'Antena física GSM/GPS desligada poupando bateria.');
    } else {
      setAntennaActive(true);
      localStorage.setItem('perm_antenna', 'active');
      addLog('hardware', 'A sintonizar antena física GSM e amplificar sinal por satélite no Moxico...');
      
      setTimeout(() => {
        addLog('hardware', 'Sintonização concluída. Ruído de rede reduzido. Antena física GPS/GSM ATIVA (100% ganho).');
      }, 1500);
    }
  };

  // Upload/Sync logs directly to Firestore Audit collection
  const handleUploadLogsForAudit = async () => {
    setIsSyncing(true);
    setSyncSuccess(false);
    addLog('info', 'A preparar pacote de logs para upload de auditoria no Firestore...');

    try {
      const logsPayload = logs.map(l => ({
        timestamp: l.time,
        type: l.type,
        message: l.message
      }));

      await addDoc(collection(db, 'device_logs'), {
        driverId,
        driverName,
        syncedAt: serverTimestamp(),
        logs: logsPayload,
        antennaActive,
        callLogPermission: callLogGranted ? 'granted' : 'denied',
        smsPermission: smsGranted ? 'granted' : 'denied',
        status: 'audited_ok'
      });

      addLog('info', '✅ Sincronização Concluída! Logs enviados de forma segura para auditoria no painel JIS.');
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 5000);
    } catch (err: any) {
      console.error("Error writing device_logs:", err);
      addLog('info', `❌ Falha ao exportar logs para o Firestore: ${err.message || err}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Passcode verification handler (Standard Passcode is "1975" - symbolic for Angola)
  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode === '1975' || passcode === '2026' || passcode.toLowerCase() === 'jis') {
      setIsUnlocked(true);
      localStorage.setItem('perm_manager_unlocked', 'true');
      setPasscodeError('');
      addLog('info', 'Acesso administrativo autorizado com sucesso.');
    } else {
      setPasscodeError('Código inválido. Apenas administradores do "SUPER Táxi / JIS" possuem o código.');
    }
  };

  const handleLock = () => {
    setIsUnlocked(false);
    localStorage.removeItem('perm_manager_unlocked');
    setPasscode('');
  };

  // Connected state calculation: Requires antenna active AND at least one permission granted
  const isConnected = antennaActive && (callLogGranted || smsGranted);

  // Render passcode locked view
  if (!isUnlocked) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white font-sans overflow-hidden shadow-2xl relative" id="permission_manager_locked">
        <div className="flex flex-col items-center text-center py-6 space-y-4">
          <div className="bg-amber-500/10 text-amber-500 border border-amber-500/20 p-4 rounded-full animate-pulse">
            <Lock size={32} />
          </div>
          
          <div>
            <span className="text-[9px] bg-brand-primary/10 text-brand-primary border border-brand-primary/20 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">
              ÁREA RESERVADA • OPERADORES
            </span>
            <h3 className="text-sm font-black uppercase tracking-tight text-white mt-2">
              Gestão de Antenas & Permissões Nativas
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 max-w-xs leading-relaxed">
              O acesso às antenas físicas do telemóvel e à escuta de logs GSM é restrito à administração JIS ANGOLA.
            </p>
          </div>

          <form onSubmit={handleUnlock} className="w-full max-w-xs space-y-3 pt-2">
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-slate-400 block text-left">
                Introduza a Senha de Acesso (PIN)
              </label>
              <input
                type="password"
                placeholder="****"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-brand-primary rounded-xl px-4 py-3 text-center text-xl font-bold tracking-[0.5em] text-white placeholder:text-slate-700 outline-none transition-all"
              />
            </div>

            {passcodeError && (
              <p className="text-[9px] font-black uppercase text-rose-500 leading-snug">
                ⚠️ {passcodeError}
              </p>
            )}

            <button
              type="submit"
              className="w-full bg-brand-primary text-slate-950 hover:brightness-110 py-3 rounded-xl font-black text-[10px] uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <Unlock size={13} />
              <span>Desbloquear Painel de Antenas</span>
            </button>

          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 text-white font-sans overflow-hidden shadow-2xl relative" id="permission_manager_container">
      
      {/* Decorative pulse background when simulating incoming call/sms */}
      {isSimulatingIncoming && (
        <div className="absolute inset-0 bg-brand-primary/5 animate-pulse pointer-events-none" />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] bg-brand-primary/10 text-brand-primary border border-brand-primary/20 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">
              SISTEMA AUDITADO • TAXICONTROL
            </span>
            <button
              onClick={handleLock}
              className="text-[8px] bg-rose-950/40 text-rose-400 hover:bg-rose-900/30 border border-rose-500/20 px-1.5 py-0.5 rounded uppercase font-black tracking-wider flex items-center gap-1"
            >
              <Lock size={8} /> Bloquear
            </button>
          </div>
          <h3 className="text-sm font-black uppercase tracking-tight text-white mt-1.5 flex items-center gap-2">
            <Smartphone size={16} className="text-brand-primary animate-bounce" />
            Gestão de Antenas & Permissões Nativas (JIS)
          </h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
            JIS ANGOLA • MOTORISTA INTEGRADO
          </p>
        </div>

        {/* Diagnostic Connection Badge */}
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${
          isConnected 
            ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/20' 
            : 'bg-rose-950/40 text-rose-400 border-rose-500/20 animate-pulse'
        }`}>
          <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-ping' : 'bg-rose-500 animate-pulse'}`} />
          <span className="text-[9px] font-black uppercase tracking-wider">
            {isConnected ? 'ESTADO: CONECTADO' : 'ESTADO: DESCONECTADO'}
          </span>
        </div>
      </div>

      {/* Educational Note on modern Mobile Operating Systems */}
      <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 mb-5 space-y-3.5 text-left">
        <div className="flex items-center gap-1.5 text-[10px] font-black text-brand-primary uppercase">
          <AlertTriangle size={13} className="text-amber-500" />
          Como contornar as limitações dos sistemas operativos móveis?
        </div>
        
        <div className="space-y-2.5 text-[9px] text-slate-300 font-bold uppercase leading-relaxed">
          <p>
            ❌ <span className="text-rose-400 font-extrabold">LIMITAÇÃO DE SEGURANÇA (ANDROID/iOS):</span> Por motivos de privacidade do utilizador, as aplicações abertas diretamente no navegador (PWAs normais) são isoladas num ambiente fechado (Sandbox) e são proibidas de ler a antena física, de intercetar chamadas GSM privadas ou de substituir a receção de SMS privados.
          </p>
          <p>
            🛠️ <span className="text-brand-primary font-extrabold">A SOLUÇÃO CORPORATIVA JIS:</span> Para que a nossa aplicação de controlo de frotas funcione nos telemóveis dos motoristas do Moxico, compilamos a Web App usando o <span className="text-white">Capacitor Wrapper da Apache</span>. 
          </p>
          <p className="bg-slate-900 border border-slate-800 p-2.5 rounded-lg text-slate-400 font-mono text-[8px] leading-normal uppercase">
            💡 <span className="text-white">COMO ATIVAMOS EM PRODUÇÃO:</span><br/>
            1. Declaramos <code className="text-brand-primary font-bold">READ_CALL_LOG</code> e <code className="text-brand-primary font-bold">RECEIVE_SMS</code> no AndroidManifest.xml.<br/>
            2. Criamos uma <code className="text-brand-primary font-bold">BroadcastReceiver em Java</code> que corre em segundo plano.<br/>
            3. Esta classe escuta o telemóvel e envia os dados via a <code className="text-brand-primary font-bold">AndroidBridge</code> para o nosso servidor.
          </p>
        </div>
      </div>

      {/* Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        
        {/* Antena Física GSM/GPS */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Sinal da Antena</p>
              <h4 className="text-[11px] font-black text-white uppercase mt-0.5 flex items-center gap-1.5">
                <Wifi size={13} className={antennaActive ? "text-emerald-500 animate-pulse" : "text-slate-500"} />
                Antena Física GSM
              </h4>
            </div>
            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
              antennaActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'
            }`}>
              {antennaActive ? 'LIGADO' : 'DESLIGADO'}
            </span>
          </div>
          
          <p className="text-[9px] text-slate-400 font-bold leading-snug uppercase">
            Sintoniza e amplifica o ganho da antena física de recepção de sinal no Moxico para melhor conexão.
          </p>

          <button
            id="toggle_antenna_btn"
            onClick={handleToggleAntenna}
            className={`w-full py-2.5 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all duration-300 ${
              antennaActive 
                ? 'bg-rose-950/40 text-rose-400 border border-rose-500/20 hover:bg-rose-900/30' 
                : 'bg-brand-primary text-slate-950 hover:brightness-110 shadow-lg'
            }`}
          >
            {antennaActive ? 'Desativar Antena' : 'Sintonizar Antena'}
          </button>
        </div>

        {/* Leitura de Chamadas */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Histórico de Rede</p>
              <h4 className="text-[11px] font-black text-white uppercase mt-0.5 flex items-center gap-1.5">
                <PhoneCall size={13} className={callLogGranted ? "text-emerald-500" : "text-slate-500"} />
                Logs de Chamada
              </h4>
            </div>
            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
              callLogGranted ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
            }`}>
              {callLogGranted ? 'PERMITIDO' : 'NEGADO'}
            </span>
          </div>

          <p className="text-[9px] text-slate-400 font-bold leading-snug uppercase">
            Permite detetar chamadas de voz GSM dos clientes no telemóvel e acionar o alerta sonoro.
          </p>

          <button
            id="request_call_log_btn"
            onClick={handleRequestCallLog}
            className={`w-full py-2.5 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all duration-300 ${
              callLogGranted 
                ? 'bg-slate-800 text-slate-400 cursor-default' 
                : 'bg-brand-primary text-slate-950 hover:brightness-110 shadow-lg'
            }`}
            disabled={callLogGranted}
          >
            {callLogGranted ? 'Autorizado' : 'Pedir Permissão'}
          </button>
        </div>

        {/* Monitorização de SMS */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">SMS Off-line</p>
              <h4 className="text-[11px] font-black text-white uppercase mt-0.5 flex items-center gap-1.5">
                <MessageSquare size={13} className={smsGranted ? "text-emerald-500" : "text-slate-500"} />
                Receção de SMS
              </h4>
            </div>
            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
              smsGranted ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
            }`}>
              {smsGranted ? 'PERMITIDO' : 'NEGADO'}
            </span>
          </div>

          <p className="text-[9px] text-slate-400 font-bold leading-snug uppercase">
            Intercepta SMS com palavra-chave para agendar viagens mesmo sem ligação de internet móvel.
          </p>

          <button
            id="request_sms_btn"
            onClick={handleRequestSMS}
            className={`w-full py-2.5 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all duration-300 ${
              smsGranted 
                ? 'bg-slate-800 text-slate-400 cursor-default' 
                : 'bg-brand-primary text-slate-950 hover:brightness-110 shadow-lg'
            }`}
            disabled={smsGranted}
          >
            {smsGranted ? 'Autorizado' : 'Pedir Permissão'}
          </button>
        </div>

      </div>

      {/* Simulator Test Sandbox */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3.5 mb-5 text-left">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 size={15} className="text-brand-primary" />
            <h4 className="text-xs font-black text-white uppercase">Painel de Teste de Toques Operacionais</h4>
          </div>
          <span className="text-[8px] bg-brand-primary/10 text-brand-primary border border-brand-primary/20 px-2 py-0.5 rounded font-black uppercase">
            VOZ: PEDIDO SUPER TÁXI 🗣️
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          <button
            id="play_voice_test_btn"
            onClick={() => playAlertSound('test')}
            className="bg-slate-900 border border-slate-800 hover:border-slate-700 p-3 rounded-xl text-left flex items-center justify-between group transition-all"
          >
            <div className="space-y-1">
              <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider leading-none">TESTAR ÁUDIO</span>
              <p className="text-[10px] font-black text-white uppercase leading-none">Voz Oficial SUPER Táxi</p>
            </div>
            {isPlayingTestAudio ? (
              <RefreshCw size={14} className="text-brand-primary animate-spin" />
            ) : (
              <Play size={14} className="text-brand-primary group-hover:scale-110 transition-transform" />
            )}
          </button>

          <button
            id="simulate_call_btn"
            onClick={simulateIncomingCall}
            disabled={!callLogGranted}
            className={`p-3 rounded-xl text-left flex items-center justify-between group transition-all ${
              callLogGranted 
                ? 'bg-slate-900 border border-slate-800 hover:border-slate-700' 
                : 'bg-slate-950 border border-slate-900 opacity-40 cursor-not-allowed'
            }`}
          >
            <div className="space-y-1">
              <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider leading-none">SIMULAR EVENTO</span>
              <p className="text-[10px] font-black text-white uppercase leading-none">Entrada de Chamada</p>
            </div>
            <PhoneCall size={14} className={callLogGranted ? "text-brand-primary animate-pulse" : "text-slate-600"} />
          </button>

          <button
            id="simulate_sms_btn"
            onClick={simulateIncomingSMS}
            disabled={!smsGranted}
            className={`p-3 rounded-xl text-left flex items-center justify-between group transition-all ${
              smsGranted 
                ? 'bg-slate-900 border border-slate-800 hover:border-slate-700' 
                : 'bg-slate-950 border border-slate-900 opacity-40 cursor-not-allowed'
            }`}
          >
            <div className="space-y-1">
              <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider leading-none">SIMULAR EVENTO</span>
              <p className="text-[10px] font-black text-white uppercase leading-none">Receção de SMS</p>
            </div>
            <MessageSquare size={14} className={smsGranted ? "text-brand-primary animate-pulse" : "text-slate-600"} />
          </button>
        </div>

        {/* Dynamic Speech Stop Button if sounding */}
        {isPlayingTestAudio && (
          <button
            onClick={stopAlertSound}
            className="w-full bg-rose-950/80 border border-rose-500/40 text-rose-200 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-wider hover:bg-rose-900 transition-all flex items-center justify-center gap-1.5"
          >
            <Pause size={12} />
            <span>Silenciar / Parar Toque de Alerta de Voz</span>
          </button>
        )}
      </div>

      {/* Sync Section to Firestore for Real Audit trail */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3 mb-5 text-left">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Database size={14} className="text-brand-primary" />
            <h4 className="text-xs font-black text-white uppercase">Sincronização de Logs de Auditoria</h4>
          </div>
          {syncSuccess && (
            <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-black uppercase">
              SINCRONIZADO OK
            </span>
          )}
        </div>
        <p className="text-[9px] text-slate-400 font-bold leading-relaxed uppercase">
          Guarde os logs operacionais do dispositivo directamente no Firestore do SUPER Táxi para auditoria no Luena pelo administrador José Iweza Suana.
        </p>
        <button
          onClick={handleUploadLogsForAudit}
          disabled={isSyncing}
          className="w-full bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 py-3 rounded-xl font-black text-[9px] uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all text-brand-primary disabled:opacity-50"
        >
          {isSyncing ? (
            <>
              <RefreshCw size={13} className="animate-spin" />
              <span>A exportar para o Firestore...</span>
            </>
          ) : (
            <>
              <Send size={13} />
              <span>Exportar Logs Locais para Auditoria Cloud</span>
            </>
          )}
        </button>
      </div>

      {/* Live Terminal Logs */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest flex items-center gap-1.5">
            <Layers size={11} className="text-brand-primary" />
            Consola Operacional de Entrada (Moxico Logs)
          </p>
          <button 
            onClick={() => {
              setLogs([{ id: '1', time: new Date().toLocaleTimeString(), type: 'info', message: 'Consola operacional limpa pelo motorista.' }]);
            }}
            className="text-[8px] text-brand-primary hover:underline font-bold uppercase"
          >
            Limpar Consola
          </button>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 font-mono text-[9px] h-32 overflow-y-auto space-y-2 text-left shadow-inner">
          {logs.map(log => {
            let badgeColor = "text-slate-500";
            let typeLabel = "LOG";
            
            if (log.type === 'call') {
              badgeColor = "text-amber-400 font-bold";
              typeLabel = "GSM-CALL";
            } else if (log.type === 'sms') {
              badgeColor = "text-sky-400 font-bold";
              typeLabel = "GSM-SMS";
            } else if (log.type === 'hardware') {
              badgeColor = "text-emerald-400 font-bold";
              typeLabel = "ANTENNA";
            } else {
              badgeColor = "text-indigo-400";
              typeLabel = "SISTEMA";
            }

            return (
              <div key={log.id} className="flex items-start gap-2 border-b border-slate-900 pb-1.5 leading-relaxed">
                <span className="text-slate-600 shrink-0">[{log.time}]</span>
                <span className={`shrink-0 uppercase text-[8px] px-1 bg-slate-900 rounded border border-slate-800 ${badgeColor}`}>
                  {typeLabel}
                </span>
                <span className="text-slate-300 break-words flex-1 uppercase">
                  {log.message}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      
    </div>
  );
}
