import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, 
  User, 
  Clock, 
  Phone, 
  MapPin, 
  AlertTriangle,
  ChevronRight,
  Search,
  Filter,
  MoreVertical,
  CheckCheck,
  Settings,
  Link as LinkIcon,
  QrCode,
  RefreshCw,
  Check,
  ExternalLink,
  HelpCircle,
  Smartphone,
  X,
  Radio,
  FileCode2,
  Globe,
  Terminal,
  Cpu,
  Brain,
  Zap,
  Sparkles,
  Send,
  Camera,
  Loader2,
  Forward,
  Video,
  ArrowLeft,
  Volume2,
  Play,
  Square,
  Download,
  Activity
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from '@/src/lib/firebase';
import { cn } from '../lib/utils';

interface WhatsAppMessage {
  id: string;
  sender: string;
  phone: string;
  text: string;
  timestamp: Date;
  type: 'text' | 'location' | 'alert';
  isOperational?: boolean;
  status?: 'pending' | 'dispatched' | 'completed';
}

const MOCK_DRIVERS_MESSAGES: WhatsAppMessage[] = [
  {
    id: 'd1',
    sender: 'Augusto Silva (T-04)',
    phone: '+244 923 111 222',
    text: 'Iniciando turno no Bairro Social. Veículo limpo e tanque cheio.',
    timestamp: new Date(Date.now() - 1000 * 60 * 15),
    type: 'text',
    isOperational: true
  },
  {
    id: 'd2',
    sender: 'Pedro Kiala (T-12)',
    phone: '+244 931 444 555',
    text: 'Localização atual: Mercado Municipal. Aguardando passageiro.',
    timestamp: new Date(Date.now() - 1000 * 60 * 8),
    type: 'location'
  },
  {
    id: 'd3',
    sender: 'Central Operacional',
    phone: 'SISTEMA',
    text: 'ALERTA: Congestionamento na Rua da Independência. Evitem a rota.',
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
    type: 'alert',
    isOperational: true
  },
  {
    id: 'd4',
    sender: 'José Manuel (T-09)',
    phone: '+244 945 777 888',
    text: 'Encerrando corrida. Próxima parada: Aeroporto do Luena.',
    timestamp: new Date(Date.now() - 1000 * 60 * 2),
    type: 'text'
  }
];

const MOCK_CLIENTS_MESSAGES: WhatsAppMessage[] = [
  {
    id: 'c1',
    sender: 'Delfina Manuel',
    phone: '+244 925 333 444',
    text: 'Preciso de um táxi com urgência em frente ao Hospital Geral do Luena para ir ao Bairro Sangondo.',
    timestamp: new Date(Date.now() - 1000 * 60 * 25),
    type: 'text',
    status: 'pending'
  },
  {
    id: 'c2',
    sender: 'António Cavula',
    phone: '+244 932 555 666',
    text: 'Estou com bagagens pesadas e preciso de um táxi. Localização de partida: Mercado Municipal do Luena.',
    timestamp: new Date(Date.now() - 1000 * 60 * 12),
    type: 'location',
    status: 'pending'
  },
  {
    id: 'c3',
    sender: 'Maria Tchissola',
    phone: '+244 941 888 999',
    text: 'Muito obrigada pelo excelente atendimento do motorista Augusto Silva no T-04 hoje de manhã! Muito seguro e cortês.',
    timestamp: new Date(Date.now() - 1000 * 60 * 4),
    type: 'text',
    status: 'completed'
  }
];

interface WhatsAppMonitorProps {
  isMechanicView?: boolean;
  isDriverView?: boolean;
  isAdmin?: boolean;
}

export function WhatsAppMonitor({ isMechanicView = false, isDriverView = false, isAdmin = false }: WhatsAppMonitorProps) {
  const [activeTab, setActiveTab] = useState<'drivers' | 'clients' | 'baileys' | 'meta_webhook'>('drivers');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isChatFullscreen = isFullscreen && (activeTab === 'drivers' || activeTab === 'clients');
  const [driverMessages, setDriverMessages] = useState<WhatsAppMessage[]>(MOCK_DRIVERS_MESSAGES);
  const [clientMessages, setClientMessages] = useState<WhatsAppMessage[]>(MOCK_CLIENTS_MESSAGES);
  const [searchTerm, setSearchTerm] = useState('');
  const [replyText, setReplyText] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null); // State for image
  const fileInputRef = useRef<HTMLInputElement>(null); // Ref for file input
  const cameraInputRef = useRef<HTMLInputElement>(null); // Ref for camera input
  const scrollRef = useRef<HTMLDivElement>(null);

  // Estados para as Ferramentas Interativas do Cabeçalho
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLocalSearchOpen, setIsLocalSearchOpen] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState('');

  // Estados para Chamadas de Voz GSM/Rádio
  const [selectedDriverForCall, setSelectedDriverForCall] = useState<any>(null);
  const [callStatus, setCallStatus] = useState<'idle' | 'dialing' | 'active' | 'ended'>('idle');
  const [callTimer, setCallTimer] = useState(0);
  const [isCallMuted, setIsCallMuted] = useState(false);
  const [isRecordingCall, setIsRecordingCall] = useState(false);
  const [callLogs, setCallLogs] = useState<any[]>([
    { id: 'cl1', driverName: 'Augusto Silva (T-04)', phone: '+244 923 111 222', type: 'audio', duration: '5m 12s', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), status: 'completed' },
    { id: 'cl2', driverName: 'Pedro Kiala (T-12)', phone: '+244 931 444 555', type: 'audio', duration: '0m 0s', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4), status: 'missed' },
    { id: 'cl3', driverName: 'José Manuel (T-09)', phone: '+244 945 777 888', type: 'radio', duration: '2m 45s', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6), status: 'completed' },
  ]);

  // Estados para Vídeo-Vigilância Live
  const [selectedDriverForVideo, setSelectedDriverForVideo] = useState<any>(null);
  const [videoStatus, setVideoStatus] = useState<'idle' | 'streaming'>('idle');
  const [videoCameraType, setVideoCameraType] = useState<'cabin' | 'road'>('road');
  const [videoTimer, setVideoTimer] = useState(0);
  const [simulatedSpeed, setSimulatedSpeed] = useState(45);
  const [simulatedCoords, setSimulatedCoords] = useState({ lat: -11.7825, lon: 19.9142 });

  // Estados para Forçar Sincronização GSM
  const [isSyncingGsm, setIsSyncingGsm] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatusText, setSyncStatusText] = useState('');

  // Telemetria de Chamadas Unitel / Movicel em tempo real
  const [incomingTelemetryCall, setIncomingTelemetryCall] = useState<any | null>(null);

  // Sintetizador de Som de Toque Operacional (Beep Duplo Unitel via Web Audio API)
  const playRingtone = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new (AudioContextClass as any)();
      
      const playBeep = (delay: number) => {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        osc1.frequency.setValueAtTime(440, ctx.currentTime + delay);
        osc2.frequency.setValueAtTime(480, ctx.currentTime + delay);
        
        gainNode.gain.setValueAtTime(0, ctx.currentTime + delay);
        gainNode.gain.linearRampToValueAtTime(0.12, ctx.currentTime + delay + 0.1);
        gainNode.gain.setValueAtTime(0.12, ctx.currentTime + delay + 0.6);
        gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + delay + 0.8);
        
        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        osc1.start(ctx.currentTime + delay);
        osc2.start(ctx.currentTime + delay);
        
        osc1.stop(ctx.currentTime + delay + 1.0);
        osc2.stop(ctx.currentTime + delay + 1.0);
      };
      
      playBeep(0);
      playBeep(1.2);
    } catch (e) {
      console.warn("Audio Context blocked or not supported:", e);
    }
  };

  // Efeito para simulação automática de Telemetria de Chamadas UNITEL/Movicel (Despertar do Sistema)
  /*
  useEffect(() => {
    const listCallers = [
      { name: 'Delfina Manuel', phone: '+244 925 333 444', network: 'UNITEL', cellId: 'LUE-UNITEL-049', strength: '-78 dBm', area: 'Luena Central (Hospital Geral)' },
      { name: 'António Cavula', phone: '+244 932 555 666', network: 'UNITEL', cellId: 'LUE-UNITEL-012', strength: '-82 dBm', area: 'Mercado Municipal' },
      { name: 'Fátima Ndala', phone: '+244 921 445 778', network: 'UNITEL', cellId: 'LUE-UNITEL-105', strength: '-65 dBm', area: 'Bairro Social' },
      { name: 'João Valério', phone: '+244 939 122 344', network: 'MOVICEL', cellId: 'LUE-MOVI-003', strength: '-91 dBm', area: 'Aeroporto do Luena' },
      { name: 'Mariana Kassanga', phone: '+244 924 889 112', network: 'UNITEL', cellId: 'LUE-UNITEL-022', strength: '-72 dBm', area: 'Bairro Sangondo' }
    ];

    const triggerCall = () => {
      if (incomingTelemetryCall || callStatus === 'active' || isPhoneModalOpen || isVideoModalOpen) return;
      
      const randomCaller = listCallers[Math.floor(Math.random() * listCallers.length)];
      setIncomingTelemetryCall({
        id: `tel-${Date.now()}`,
        name: randomCaller.name,
        phone: randomCaller.phone,
        network: randomCaller.network,
        cellId: randomCaller.cellId,
        strength: randomCaller.strength,
        area: randomCaller.area,
        timestamp: new Date()
      });
      playRingtone();
    };

    // Primeiro disparo em 25 segundos, depois a cada 75 segundos
    const initialTimeout = setTimeout(triggerCall, 25000);
    const interval = setInterval(triggerCall, 75000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [incomingTelemetryCall, callStatus, isPhoneModalOpen, isVideoModalOpen]);
  */
  

  // Função para despoletar manualmente uma chamada de telemetria UNITEL
  const forceTriggerTelemetryCall = () => {
    const listCallers = [
      { name: 'Delfina Manuel', phone: '+244 925 333 444', network: 'UNITEL', cellId: 'LUE-UNITEL-049', strength: '-78 dBm', area: 'Luena Central (Hospital Geral)' },
      { name: 'António Cavula', phone: '+244 932 555 666', network: 'UNITEL', cellId: 'LUE-UNITEL-012', strength: '-82 dBm', area: 'Mercado Municipal' },
      { name: 'Fátima Ndala', phone: '+244 921 445 778', network: 'UNITEL', cellId: 'LUE-UNITEL-105', strength: '-65 dBm', area: 'Bairro Social' },
      { name: 'João Valério', phone: '+244 939 122 344', network: 'MOVICEL', cellId: 'LUE-MOVI-003', strength: '-91 dBm', area: 'Aeroporto do Luena' },
      { name: 'Mariana Kassanga', phone: '+244 924 889 112', network: 'UNITEL', cellId: 'LUE-UNITEL-022', strength: '-72 dBm', area: 'Bairro Sangondo' }
    ];
    const randomCaller = listCallers[Math.floor(Math.random() * listCallers.length)];
    setIncomingTelemetryCall({
      id: `tel-${Date.now()}`,
      name: randomCaller.name,
      phone: randomCaller.phone,
      network: randomCaller.network,
      cellId: randomCaller.cellId,
      strength: randomCaller.strength,
      area: randomCaller.area,
      timestamp: new Date()
    });
    playRingtone();
    showCustomToast('⚡ Telemetria de Chamada UNITEL disparada com sucesso!', 'info');
  };

  // Auxiliar para formatar cronómetros (ex: 01:23)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Efeito para o Cronómetro da Chamada GSM/Rádio
  useEffect(() => {
    let interval: any;
    if (callStatus === 'active') {
      interval = setInterval(() => {
        setCallTimer(prev => prev + 1);
      }, 1000);
    } else if (callStatus === 'idle') {
      setCallTimer(0);
    }
    return () => clearInterval(interval);
  }, [callStatus]);

  // Efeito para o Cronómetro do Streaming de Vídeo
  useEffect(() => {
    let interval: any;
    if (videoStatus === 'streaming') {
      interval = setInterval(() => {
        setVideoTimer(prev => prev + 1);
        setSimulatedSpeed(prev => {
          const change = Math.floor(Math.random() * 7) - 3;
          const next = prev + change;
          return Math.max(10, Math.min(next, 95));
        });
        setSimulatedCoords(prev => ({
          lat: prev.lat + (Math.random() * 0.0002 - 0.0001),
          lon: prev.lon + (Math.random() * 0.0002 - 0.0001)
        }));
      }, 1000);
    } else if (videoStatus === 'idle') {
      setVideoTimer(0);
    }
    return () => clearInterval(interval);
  }, [videoStatus]);

  // ... (rest of the component)

  // Meta Webhook Status State
  const [metaWebhookState, setMetaWebhookState] = useState({
    online: false,
    endpoint: "",
    hasSecret: false,
    hasMetaToken: false,
    timestamp: "",
    lastPing: null as null | string,
  });

  // Determine if we should show Baileys tab
  const showBaileysTab = !isMechanicView && !isDriverView;

  // ... (inside render, update tabs)

  // Estados de Configuração de Conexão WhatsApp
  const [showSettings, setShowSettings] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState(() => {
    return localStorage.getItem('taxi_wa_number') || '+244 937 537 330';
  });
  const [driversGroupLink, setDriversGroupLink] = useState(() => {
    return localStorage.getItem('taxi_wa_drivers_link') || 'https://chat.whatsapp.com/GoperatonalDriversLuena';
  });
  const [clientsGroupLink, setClientsGroupLink] = useState(() => {
    return localStorage.getItem('taxi_wa_clients_link') || 'https://chat.whatsapp.com/GclientsTaxiControlLuena';
  });
  const [webhookUrl, setWebhookUrl] = useState(() => {
    return localStorage.getItem('taxi_wa_webhook') || 'https://api.taxicontrol.ao/v1/whatsapp/webhook';
  });
  const [backendApiUrl, setBackendApiUrl] = useState(() => {
    return localStorage.getItem('taxi_wa_backend_api_url') || '';
  });

  const getApiUrl = (endpoint: string) => {
    const customUrl = backendApiUrl.trim();
    if (customUrl) {
      const base = customUrl.endsWith('/') ? customUrl.slice(0, -1) : customUrl;
      const cleanPath = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
      return `${base}${cleanPath}`;
    }
    return endpoint;
  };

  // Poll Meta Webhook status
  useEffect(() => {
    if (activeTab !== 'meta_webhook') return;
    const fetchStatus = async () => {
      try {
        const urlToFetch = getApiUrl("/api/meta-webhook/status");
        const res = await fetch(urlToFetch);
        if (res.ok) {
          const data = await res.json();
          setMetaWebhookState({ ...data, lastPing: new Date().toISOString() });
        }
      } catch (err) {
        setMetaWebhookState(prev => ({ ...prev, online: false }));
        console.error("Erro ao buscar status do Meta Webhook:", err);
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [backendApiUrl, activeTab]);

  // Auto-detect and heal backend API URL to prevent stale container endpoints
  useEffect(() => {
    localStorage.removeItem('taxi_wa_backend_api_url');
    setBackendApiUrl('');
    console.log("[Auto-Pilot] Endereço de backend limpo para forçar rotas relativas.");
  }, []);

  // Novos Estados Reais do Servidor Baileys
  const [baileysServerState, setBaileysServerState] = useState({
    connected: false,
    status: "idle",
    whatsappNumber: "+244 937 537 330",
    sessionName: "TaxiControl-Luena-MD",
    qrCodeString: null as string | null,
    pairingCode: null as string | null,
    deviceInfo: {
      platform: "Android (Baileys Multi-Device)",
      browser: "Chrome (Ubuntu/Moxico)",
      version: "2.3012.0",
      jid: "",
    },
    logs: [] as string[]
  });

  // Determinar conexão real derivada
  const isConnected = baileysServerState.connected;
  const isGeneratingQR = baileysServerState.status === "connecting";

  // Poll Baileys status from server every 2 seconds
  useEffect(() => {
    const fetchStatus = async () => {
      const urlToFetch = getApiUrl("/api/whatsapp/baileys/status");
      try {
        console.log(`[Baileys Tracker] Fetching from: ${urlToFetch}`);
        const res = await fetch(urlToFetch);
        if (res.ok) {
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const data = await res.json();
            setBaileysServerState(data);
          } else {
            console.warn("[Baileys Tracker] Resposta não-JSON (re-direcionado pelo host estático)");
          }
        }
      } catch (err: any) {
        console.error("Erro ao buscar log centralizado do Baileys:", err);
        alert(`Erro ao conectar ao servidor Baileys (${urlToFetch}): ${err.message}`);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, [backendApiUrl, isMechanicView, isDriverView]);

  // Sync virtual list real-time via Firestore (whatsapp_messages)
  useEffect(() => {
    const q = query(collection(db, 'whatsapp_messages'), orderBy('timestamp', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: any[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        msgs.push({
          id: docSnap.id,
          sender: data.sender || "Desconhecido",
          phone: data.phone || "",
          text: data.text || "",
          timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
          type: data.type || 'text',
          isOperational: data.isOperational,
          status: data.status || 'pending',
          channel: data.channel || 'clients'
        });
      });

      if (msgs.length > 0) {
        setDriverMessages(msgs.filter(m => m.channel === 'drivers' || m.isOperational));
        setClientMessages(msgs.filter(m => m.channel === 'clients' && !m.isOperational));
      } else {
        setDriverMessages(MOCK_DRIVERS_MESSAGES);
        setClientMessages(MOCK_CLIENTS_MESSAGES);
      }
    }, (error) => {
      console.warn("Erro ao ouvir Firestore para whatsapp_messages (usando fallback de teste):", error.message);
    });

    return () => unsubscribe();
  }, []);

  // Auto-scroll para a última mensagem
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [driverMessages, clientMessages, activeTab, showSettings, baileysServerState.logs]);

  // Estado para Notificações Flutuantes (Toasts)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showCustomToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleForceGsmSync = () => {
    if (isSyncingGsm) return;
    setIsSyncingGsm(true);
    setSyncProgress(10);
    setSyncStatusText('A iniciar ligação GSM via Luena Hub...');
    
    const steps = [
      { progress: 30, text: 'A conectar com os telemóveis activos dos motoristas...' },
      { progress: 60, text: 'A extrair chamadas, sms e registos de rádio...' },
      { progress: 90, text: 'A enviar registos telemétricos e pânicos S.O.S de Luena...' },
      { progress: 100, text: 'Sincronização concluída com sucesso!' }
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        setSyncProgress(steps[currentStep].progress);
        setSyncStatusText(steps[currentStep].text);
        currentStep++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setIsSyncingGsm(false);
          // Adicionar um log simulado na lista de mensagens se for drivers
          const syncAlert: WhatsAppMessage = {
            id: `sync-${Date.now()}`,
            sender: 'Central Operacional',
            phone: 'SISTEMA',
            text: '📡 SINCRONIZAÇÃO GSM CONCLUÍDA: Todos os registos de rádio, relatórios de chamadas de voz e sms operacionais foram transmitidos das viaturas de campo para o Moxico Hub com sucesso.',
            timestamp: new Date(),
            type: 'alert',
            isOperational: true
          };
          if (activeTab === 'drivers') {
            setDriverMessages(prev => [...prev, syncAlert]);
          } else {
            setClientMessages(prev => [...prev, syncAlert]);
          }
          showCustomToast('Logs GSM sincronizados com o banco de dados com sucesso!', 'success');
        }, 1000);
      }
    }, 1200);
  };

  const handleExportLogs = () => {
    const logsText = currentMessages.map(m => 
      `[${m.timestamp.toISOString()}] ${m.sender} (${m.phone}): ${m.text}`
    ).join('\n');
    
    const blob = new Blob([logsText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Dossier_Comunicacoes_${activeTab === 'drivers' ? 'Motoristas' : 'Clientes'}_${new Date().toISOString().split('T')[0]}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showCustomToast('Dossier de comunicações exportado com sucesso!', 'success');
  };

  const currentMessages = activeTab === 'drivers' ? driverMessages : clientMessages;

  const filteredMessages = currentMessages.filter(msg => {
    const queryToUse = isLocalSearchOpen ? localSearchQuery : searchTerm;
    if (!queryToUse) return true;
    return msg.text.toLowerCase().includes(queryToUse.toLowerCase()) ||
      msg.sender.toLowerCase().includes(queryToUse.toLowerCase()) ||
      msg.phone.toLowerCase().includes(queryToUse.toLowerCase());
  });

  // Send outbound message via Baileys API
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    const channel = activeTab === 'drivers' ? 'drivers' : 'clients';
    const targetGroup = activeTab === 'drivers' ? driversGroupLink : whatsappNumber;

    try {
      const res = await fetch(getApiUrl("/api/whatsapp/baileys/send"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: targetGroup,
          text: replyText,
          channel
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.message) {
          const newMessage: WhatsAppMessage = {
            id: data.message.id || `new-${Date.now()}`,
            sender: data.message.sender,
            phone: data.message.phone,
            text: data.message.text,
            timestamp: new Date(data.message.timestamp),
            type: 'text',
            isOperational: channel === 'drivers'
          };

          if (channel === 'drivers') {
            setDriverMessages(prev => {
              const exists = prev.some(m => m.text === newMessage.text && Math.abs(m.timestamp.getTime() - newMessage.timestamp.getTime()) < 10000);
              if (exists) return prev;
              return [...prev, newMessage];
            });
          } else {
            setClientMessages(prev => {
              const exists = prev.some(m => m.text === newMessage.text && Math.abs(m.timestamp.getTime() - newMessage.timestamp.getTime()) < 10000);
              if (exists) return prev;
              return [...prev, newMessage];
            });
          }
        }
        setReplyText('');
      } else {
        // Fallback local caso o endpoint falhe
        const newMessage: WhatsAppMessage = {
          id: `new-${Date.now()}`,
          sender: 'Operador Central',
          phone: whatsappNumber,
          text: replyText,
          timestamp: new Date(),
          type: 'text',
          isOperational: activeTab === 'drivers'
        };

        if (activeTab === 'drivers') {
          setDriverMessages(prev => [...prev, newMessage]);
        } else {
          setClientMessages(prev => [...prev, newMessage]);
        }
        setReplyText('');
      }
    } catch (err) {
      console.error("Erro ao enviar mensagem de saída:", err);
      setReplyText('');
    }
  };

  const handleDispatch = (messageId: string) => {
    setClientMessages(prev => 
      prev.map(msg => 
        msg.id === messageId ? { ...msg, status: 'dispatched' as const } : msg
      )
    );
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('taxi_wa_number', whatsappNumber);
    localStorage.setItem('taxi_wa_drivers_link', driversGroupLink);
    localStorage.setItem('taxi_wa_clients_link', clientsGroupLink);
    localStorage.setItem('taxi_wa_webhook', webhookUrl);
    setShowSettings(false);
  };

  // Actions da Gateway do Baileys
  const startBaileysConnection = async () => {
    try {
      const res = await fetch(getApiUrl("/api/whatsapp/baileys/connect"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: whatsappNumber })
      });
      if (res.ok) {
        console.log("Comando conectar via Baileys disparado com sucesso.");
      }
    } catch (err) {
      console.error("Erro ao mandar comando conectar Baileys:", err);
    }
  };

  const disconnectBaileys = async () => {
    try {
      await fetch(getApiUrl("/api/whatsapp/baileys/disconnect"), { method: "POST" });
    } catch (err) {
      console.error("Erro ao mandar comando desconectar Baileys:", err);
    }
  };

  const simulateBaileysScan = async () => {
    try {
      await fetch(getApiUrl("/api/whatsapp/baileys/simulate-scan"), { method: "POST" });
    } catch (err) {
      console.error("Erro ao mandar comando simular scan Baileys:", err);
    }
  };

  const injectIncomingMessage = async (text: string, sender: string, from: string, channel: 'drivers' | 'clients') => {
    try {
      const res = await fetch(getApiUrl("/api/whatsapp/baileys/simulate-incoming"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, sender, text, channel })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.incomingMessage) {
          const nm: WhatsAppMessage = {
            id: data.incomingMessage.id || `inc-${Date.now()}`,
            sender: data.incomingMessage.sender,
            phone: data.incomingMessage.phone,
            text: data.incomingMessage.text,
            timestamp: new Date(data.incomingMessage.timestamp),
            type: 'text',
            isOperational: data.incomingMessage.isOperational
          };
          
          if (channel === 'drivers' || nm.isOperational) {
            setDriverMessages(prev => {
              const exists = prev.some(m => m.text === nm.text && Math.abs(m.timestamp.getTime() - nm.timestamp.getTime()) < 10000);
              if (exists) return prev;
              return [...prev, nm];
            });
          } else {
            setClientMessages(prev => {
              const exists = prev.some(m => m.text === nm.text && Math.abs(m.timestamp.getTime() - nm.timestamp.getTime()) < 10000);
              if (exists) return prev;
              return [...prev, nm];
            });
          }
        }

        // Se houver uma resposta automática simulada, adicionamos ao chat
        if (data.replyMessage) {
          const replyMsg: WhatsAppMessage = {
            id: `reply-${Date.now()}`,
            sender: 'Operador Central',
            phone: whatsappNumber,
            text: data.replyMessage,
            timestamp: new Date(),
            type: 'text',
            isOperational: false
          };
          setClientMessages(prev => {
            const exists = prev.some(m => m.text === replyMsg.text && Math.abs(m.timestamp.getTime() - replyMsg.timestamp.getTime()) < 10000);
            if (exists) return prev;
            return [...prev, replyMsg];
          });
        }
      }
    } catch (err) {
      console.error("Erro ao simular incoming message:", err);
    }
  };


  return (
    <div className={cn(
      "flex flex-col bg-slate-50 dark:bg-slate-900 overflow-hidden transition-all flex-1",
      isFullscreen
        ? "fixed inset-0 z-[9999] h-screen w-screen rounded-none border-none shadow-none"
        : cn("rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl min-h-[600px]", (isMechanicView || isDriverView) ? "h-full" : "h-[850px]")
    )}>
      {/* Header Premium */}
      {!isChatFullscreen && (
        <div className="p-5 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500 dark:bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 rotate-3">
              <MessageSquare size={24} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tighter text-lg leading-none">Monitor WhatsApp</h3>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-md">
                  <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", isConnected ? "bg-emerald-500" : "bg-red-500")} />
                  {isConnected ? 'Online' : 'Offline'}
                </span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">• LUENA HUB</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isFullscreen && (
              <button 
                onClick={() => setIsFullscreen(false)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-lg shadow-rose-500/20"
              >
                <X size={14} />
                Sair da Tela Cheia
              </button>
            )}
            <div className="hidden sm:flex flex-col items-right text-right mr-2 leading-none">
              <span className="text-[9px] font-black text-slate-400 uppercase">Audit Hub</span>
              <span className="text-[10px] font-black text-slate-900 dark:text-white italic">Ativo 24h</span>
            </div>
            {isAdmin && (
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={cn(
                "w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-90 border shadow-lg",
                showSettings 
                  ? "bg-slate-900 text-white border-slate-900" 
                  : "bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-705"
              )}
            >
              {showSettings ? <X size={20} /> : <Settings size={20} />}
            </button>
            )}
          </div>
        </div>
      )}

      {/* Enhanced Tabs Selector */}
      {!isChatFullscreen && (
        <div className="flex bg-slate-100 dark:bg-slate-950 p-1.5 gap-1.5 shrink-0 overflow-x-auto custom-scrollbar no-scrollbar">
          <button
            id="btn-tab-drivers"
            onClick={() => { setActiveTab('drivers'); setSearchTerm(''); setIsFullscreen(true); }}
            className={cn(
              "flex-1 py-3 px-3 rounded-2xl transition-all flex items-center justify-center gap-2 border",
              activeTab === 'drivers'
                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xl"
                : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
            )}
          >
            <User size={15} />
            <div className="flex flex-col items-start text-left">
              <span className="text-[10px] font-black uppercase tracking-widest leading-none">Frota Live</span>
              <span className={cn("text-[8px] font-bold mt-0.5", activeTab === 'drivers' ? "text-slate-300 dark:text-slate-500" : "text-emerald-500")}>
                {driverMessages.length} Activos
              </span>
            </div>
          </button>
          {!isMechanicView && (
            <button
              id="btn-tab-clients"
              onClick={() => { setActiveTab('clients'); setSearchTerm(''); setIsFullscreen(true); }}
              className={cn(
                "flex-1 py-3 px-3 rounded-2xl transition-all flex items-center justify-center gap-2 border",
                activeTab === 'clients'
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xl"
                  : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
              )}
            >
              <MessageSquare size={15} />
              <div className="flex flex-col items-start text-left">
                <span className="text-[10px] font-black uppercase tracking-widest leading-none">Clientes</span>
                <span className={cn("text-[8px] font-bold mt-0.5", activeTab === 'clients' ? "text-slate-300 dark:text-slate-500" : "text-blue-500")}>
                  {clientMessages.length} Mensagens
                </span>
              </div>
            </button>
          )}
          {showBaileysTab && (
            <>
              <button
                id="btn-tab-baileys"
                onClick={() => { setActiveTab('baileys'); setSearchTerm(''); }}
                className={cn(
                  "flex-1 py-3 px-3 rounded-2xl transition-all flex items-center justify-center gap-2 border",
                  activeTab === 'baileys'
                    ? "bg-amber-500 text-slate-950 border-amber-500 shadow-xl"
                    : "bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 border-slate-200 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                )}
              >
                <Zap size={15} className={activeTab === 'baileys' ? "animate-bounce" : "animate-pulse"} />
                <div className="flex flex-col items-start text-left">
                  <span className="text-[10px] font-black uppercase tracking-widest leading-none">Gateway</span>
                  <span className={cn("text-[8px] font-bold mt-0.5 whitespace-nowrap", activeTab === 'baileys' ? "text-amber-900" : "text-amber-600/70")}>
                    Baileys Hub
                  </span>
                </div>
              </button>
              <button
                id="btn-tab-meta"
                onClick={() => { setActiveTab('meta_webhook'); setSearchTerm(''); }}
                className={cn(
                  "flex-1 py-3 px-3 rounded-2xl transition-all flex items-center justify-center gap-2 border",
                  activeTab === 'meta_webhook'
                    ? "bg-emerald-500 text-slate-950 border-emerald-500 shadow-xl"
                    : "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border-slate-200 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                )}
              >
                <Globe size={15} className={activeTab === 'meta_webhook' && metaWebhookState.online ? "animate-pulse" : ""} />
                <div className="flex flex-col items-start text-left">
                  <span className="text-[10px] font-black uppercase tracking-widest leading-none">Meta API</span>
                  <span className={cn("text-[8px] font-bold mt-0.5 whitespace-nowrap", activeTab === 'meta_webhook' ? "text-emerald-900" : "text-emerald-600/70")}>
                    Webhook
                  </span>
                </div>
              </button>
            </>
          )}
        </div>
      )}

      {/* Enhanced Toolbar */}
      {!showSettings && !isChatFullscreen && (
        <div className="px-5 py-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center gap-4 shrink-0 shadow-sm relative z-10">
          <div className="relative flex-1 group">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
            <input 
              type="text"
              placeholder={activeTab === 'drivers' ? "Filtrar por mensagem, motorista ou prefixo..." : "Filtrar por mensagem de cliente ou contacto..."}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-medium focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50 outline-none transition-all placeholder:text-slate-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="w-11 h-11 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 hover:text-emerald-500 transition-all active:scale-95 flex items-center justify-center shadow-sm">
            <Filter size={18} />
          </button>
        </div>
      )}

      {/* Main Workspace: Settings Panel or Messages Feed */}
      {showSettings ? (
        <div className="flex-1 overflow-y-auto p-5 bg-white dark:bg-slate-900 space-y-5">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h4 className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center gap-2">
              <Settings size={14} />
              Central de Conexão WhatsApp
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Configure as ligações externas para integrar os grupos e canais do WhatsApp ao ecossistema do <strong>TaxiControl</strong>.
            </p>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            {/* Status de Conexão Física */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-150 dark:border-slate-800">
              <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider mb-2">Canal Operacional Central</span>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 rounded-lg">
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <input 
                      type="text"
                      className="bg-transparent font-bold text-sm text-slate-800 dark:text-white border-b border-dashed border-slate-300 dark:border-slate-700 focus:outline-none focus:border-emerald-55 h-6 outline-none"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      placeholder="Nº de Telemóvel"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">Identificador da Central no WhatsApp</p>
                  </div>
                </div>

                {isConnected ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold px-2.5 py-1 rounded-md">
                      Instância Ativa (Baileys)
                    </span>
                    <button 
                      type="button" 
                      onClick={disconnectBaileys}
                      className="text-[10px] font-bold text-red-600 hover:underline"
                    >
                      Desconectar
                    </button>
                  </div>
                ) : (
                  <button 
                    type="button" 
                    onClick={startBaileysConnection}
                    disabled={isGeneratingQR}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-[10px] font-black uppercase rounded-lg tracking-wider shadow-sm transition-all flex items-center gap-1.5"
                  >
                    {isGeneratingQR ? (
                      <>
                        <RefreshCw size={11} className="animate-spin" />
                        Iniciando link...
                      </>
                    ) : (
                      <>
                        <QrCode size={11} />
                        Ligar Canal Baileys
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Simulador de QR Code de Pareamento */}
              {isGeneratingQR && (
                <div className="mt-4 flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl space-y-3">
                  <div className="relative w-36 h-36 bg-slate-100 dark:bg-slate-900 border-2 border-emerald-500/20 rounded-lg flex items-center justify-center overflow-hidden">
                    {/* Linha de scan simulada */}
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-emerald-550 animate-bounce shadow-md shadow-emerald-500" />
                    {/* QR Code Mocado com blocos CSS */}
                    <div className="grid grid-cols-4 gap-1 p-4 opacity-80 animate-pulse">
                      <div className="w-6 h-6 bg-slate-900 dark:bg-white rounded" />
                      <div className="w-6 h-6 bg-transparent" />
                      <div className="w-6 h-6 bg-slate-900 dark:bg-white rounded" />
                      <div className="w-6 h-6 bg-slate-900 dark:bg-white rounded" />
                      <div className="w-6 h-6 bg-slate-900 dark:bg-white rounded" />
                      <div className="w-6 h-6 bg-slate-900 dark:bg-white rounded" />
                      <div className="w-6 h-6 bg-transparent" />
                      <div className="w-6 h-6 bg-slate-900 dark:bg-white rounded" />
                      <div className="w-6 h-6 bg-transparent" />
                      <div className="w-6 h-6 bg-slate-900 dark:bg-white rounded" />
                      <div className="w-6 h-6 bg-slate-900 dark:bg-white rounded" />
                      <div className="w-6 h-6 bg-transparent" />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold text-center leading-relaxed max-w-[280px]">
                    Abra o WhatsApp no telemóvel &gt; Dispositivos Associados &gt; Apontar a câmara para parear com a Central do <strong>TaxiControl</strong>.
                  </p>
                </div>
              )}
            </div>

            {/* Links de Convite dos Grupos */}
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-150 dark:border-slate-800 space-y-3">
                <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Ligações de Grupos WhatsApp</span>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-350 uppercase tracking-wide flex items-center justify-between mb-1.5">
                      <span>Grupo de Motoristas (Frota)</span>
                      <a href={driversGroupLink} target="_blank" rel="noreferrer" className="text-[9px] text-emerald-600 hover:underline flex items-center gap-1 normal-case font-medium">
                        Abrir Link <ExternalLink size={10} />
                      </a>
                    </label>
                    <div className="relative">
                      <LinkIcon size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="url"
                        className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-705 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                        value={driversGroupLink}
                        onChange={(e) => setDriversGroupLink(e.target.value)}
                        placeholder="https://chat.whatsapp.com/..."
                      />
                    </div>
                    <p className="text-[9px] text-slate-450 mt-1">Onde os motoristas enviam relatórios e localização atual.</p>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-350 uppercase tracking-wide flex items-center justify-between mb-1.5">
                      <span>Grupo de Clientes (Pedidos)</span>
                      <a href={clientsGroupLink} target="_blank" rel="noreferrer" className="text-[9px] text-emerald-600 hover:underline flex items-center gap-1 normal-case font-medium">
                        Abrir Link <ExternalLink size={10} />
                      </a>
                    </label>
                    <div className="relative">
                      <LinkIcon size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="url"
                        className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-705 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                        value={clientsGroupLink}
                        onChange={(e) => setClientsGroupLink(e.target.value)}
                        placeholder="https://chat.whatsapp.com/..."
                      />
                    </div>
                    <p className="text-[9px] text-slate-450 mt-1">Onde os passageiros solicitam táxis e relatam mensagens à central.</p>
                  </div>
                </div>
              </div>

              {/* Integração de API Webhook */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-150 dark:border-slate-800">
                <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider mb-2">Endpoint Webhook API</span>
                <div>
                  <div className="relative">
                    <Globe size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="url"
                      className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-705 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                  <p className="text-[9px] text-slate-450 mt-1.5 leading-relaxed">
                    Endereço para o qual as soluções de integração do WhatsApp (como Z-API, Baileys, Twilio ou Evolux) encaminham as mensagens recebidas para que apareçam em tempo real no monitor central.
                  </p>
                </div>
              </div>

              {/* Guia Técnico Resumido */}
              <div className="bg-emerald-50/50 dark:bg-emerald-950/15 border border-emerald-100 dark:border-emerald-900/40 rounded-xl p-3 flex items-start gap-2.5">
                <HelpCircle size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-[9.5px] text-slate-650 dark:text-slate-350 leading-relaxed font-medium">
                  <strong className="text-emerald-700 dark:text-emerald-400 font-bold block mb-0.5">Como conectar o seu número real ao TaxiControl?</strong>
                  Para receber mensagens reais dos seus grupos de WhatsApp:
                  <ol className="list-decimal pl-4 mt-1 space-y-0.5">
                    <li>Utilize uma solução Gateway do WhatsApp (como Z-API, Baileys, Multi-Device Hooks).</li>
                    <li>Configure a URL do webhook do Gateway com o endereço da central: <code className="bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded text-emerald-600 font-semibold">{webhookUrl}</code>.</li>
                    <li>As mensagens de texto e localizações enviadas nos grupos indicados serão direcionadas e exibidas automaticamente nesta central!</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Ações de Configuração */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <button 
                type="button"
                onClick={() => setShowSettings(false)}
                className="px-3.5 py-1.5 text-[11px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Voltar
              </button>
              <button 
                type="submit"
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase tracking-wider rounded-lg shadow-sm transition-all flex items-center gap-1"
              >
                Guardar Conexões
              </button>
            </div>
          </form>
        </div>
      ) : activeTab === 'baileys' ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-100 dark:bg-slate-950">
          
          {/* Dashboard Operacional Rápido */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
            <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 rounded-lg flex items-center justify-center">
                <CheckCheck size={16} />
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Sincronização</span>
                <span className="text-xs font-black text-slate-800 dark:text-white">Estável</span>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-950/40 text-blue-600 rounded-lg flex items-center justify-center">
                <Radio size={16} className="animate-pulse" />
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Latência Hub</span>
                <span className="text-xs font-black text-slate-800 dark:text-white">124ms</span>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3 col-span-2">
              <div className="w-8 h-8 bg-amber-100 dark:bg-amber-950/40 text-amber-600 rounded-lg flex items-center justify-center">
                <Sparkles size={16} />
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">IA Audit Ativa</span>
                <span className="text-xs font-black text-slate-800 dark:text-white">Triagem Automática Luena ON</span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl space-y-3 shadow-inner">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-black text-slate-500 dark:text-slate-400 tracking-widest flex items-center gap-2">
                <Globe size={11} className="text-emerald-500" />
                Configuração Endereço Backend
              </span>
              {backendApiUrl && (
                <span className="text-[8px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  LIGADO
                </span>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input 
                type="text"
                placeholder="Endereço do Servidor de APIs..."
                className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-[11px] font-mono text-emerald-600 outline-none focus:ring-2 focus:ring-emerald-500/50"
                value={backendApiUrl}
                onChange={(e) => {
                  setBackendApiUrl(e.target.value);
                  localStorage.setItem('taxi_wa_backend_api_url', e.target.value);
                }}
              />
              <button 
                type="button"
                onClick={() => {
                  const defaultBackend = window.location.origin;
                  setBackendApiUrl(defaultBackend);
                  localStorage.setItem('taxi_wa_backend_api_url', defaultBackend);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase rounded-xl transition-all shadow-lg active:scale-95"
              >
                Reset ⚡
              </button>
            </div>
          </div>

          {/* Status Box Hub */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Connection Information */}
            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-2">
                  <Cpu size={14} className="text-emerald-500" />
                  Estado Baileys MD
                </span>
                <div className={cn("w-3 h-3 rounded-full shadow-lg", isConnected ? "bg-emerald-500 shadow-emerald-500/20" : "bg-red-500")} />
              </div>
              
              <div className="space-y-3 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-900">
                <div className="flex justify-between items-center group">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Instância:</span>
                  <span className="font-mono text-slate-900 dark:text-white text-[11px]">{baileysServerState.sessionName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Telemóvel:</span>
                  <span className="font-mono text-slate-900 dark:text-white text-[11px]">{baileysServerState.whatsappNumber}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Protocolo:</span>
                  <span className="font-mono text-emerald-500 text-[11px] font-black uppercase tracking-widest">{baileysServerState.status}</span>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                {isConnected ? (
                  <button 
                    type="button"
                    onClick={disconnectBaileys}
                    className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase rounded-2xl transition-all shadow-lg active:scale-95"
                  >
                    Desconectar Canal
                  </button>
                ) : baileysServerState.status === "qr_code" ? (
                  <button 
                    type="button"
                    onClick={simulateBaileysScan}
                    className="flex-1 py-3.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-[10px] font-black uppercase rounded-2xl transition-all animate-pulse shadow-lg active:scale-95"
                  >
                    Simular Leitura QR 📸
                  </button>
                ) : (
                  <button 
                    type="button"
                    onClick={startBaileysConnection}
                    disabled={isGeneratingQR}
                    className="flex-1 py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase rounded-2xl transition-all shadow-lg active:scale-95"
                  >
                    {isGeneratingQR ? "Ligando à Gateway..." : "Ligar Canal Baileys"}
                  </button>
                )}
              </div>
            </div>

            {/* QR Code Area Hub */}
            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl flex flex-col items-center justify-center min-h-[180px] shadow-sm">
              {isConnected ? (
                <div className="text-center space-y-4">
                  <div className="inline-flex p-5 bg-emerald-500 dark:bg-emerald-600 text-white rounded-3xl shadow-xl shadow-emerald-500/20 scale-110">
                    <CheckCheck size={32} />
                  </div>
                  <div>
                    <h5 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Sessão Ativa Ativa</h5>
                    <p className="text-[10px] text-slate-400 mt-1 max-w-[200px] leading-relaxed mx-auto font-medium">
                      O hub operacional está recebendo e descriptografando dados de Luena.
                    </p>
                  </div>
                </div>
              ) : baileysServerState.status === "qr_code" && baileysServerState.qrCodeString ? (
                <div className="text-center space-y-3 w-full flex flex-col items-center">
                  <div className="relative w-32 h-32 bg-white p-3 rounded-2xl border-4 border-slate-100 shadow-xl overflow-hidden flex items-center justify-center">
                    <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 animate-scan shadow-lg shadow-emerald-500" />
                    <div className="grid grid-cols-4 gap-1 p-2 opacity-90">
                      <div className="w-5 h-5 bg-slate-900 rounded-sm" />
                      <div className="w-5 h-5 bg-transparent" />
                      <div className="w-5 h-5 bg-slate-900 rounded-sm" />
                      <div className="w-5 h-5 bg-teal-800 rounded-sm" />
                      <div className="w-5 h-5 bg-slate-900 rounded-sm" />
                      <div className="w-5 h-5 bg-slate-900 rounded-sm" />
                      <div className="w-5 h-5 bg-transparent" />
                      <div className="w-5 h-5 bg-emerald-700 rounded-sm" />
                    </div>
                  </div>
                  <div className="text-[10px] font-black text-slate-800 dark:text-slate-200">
                    Código MD: <span className="font-mono text-amber-500 bg-slate-100 dark:bg-slate-950 px-2 py-1 rounded-lg ml-1 border border-slate-200 dark:border-slate-800">{baileysServerState.pairingCode}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 mx-auto bg-slate-50 dark:bg-slate-950 rounded-2xl flex items-center justify-center text-slate-300 dark:text-slate-800 border border-slate-200 dark:border-slate-800">
                    <QrCode size={32} />
                  </div>
                  <div className="space-y-1">
                    <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">Stand-by</h5>
                    <p className="text-[9px] text-slate-400 font-medium leading-relaxed">Inicie o socket para obter<br/>um novo código de sessão.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Terminal Console Hub */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-2">
              <span className="text-[10px] uppercase font-black tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Terminal size={14} className="text-amber-500" />
                Consola Estrutural Baileys Webhook
              </span>
              <button 
                type="button"
                onClick={startBaileysConnection}
                className="text-[9px] font-black text-emerald-600 uppercase hover:underline"
              >
                Recarregar Socket
              </button>
            </div>
            
            <div className="font-mono text-[10px] bg-slate-900 dark:bg-black p-5 border border-slate-200 dark:border-slate-800 rounded-3xl leading-relaxed max-h-[220px] overflow-y-auto shadow-inner space-y-2 select-text custom-scrollbar">
              {baileysServerState.logs && baileysServerState.logs.length > 0 ? (
                baileysServerState.logs.map((logLine, idx) => (
                  <div key={idx} className="flex gap-3 text-emerald-400/90 group leading-snug">
                    <span className="text-slate-600 shrink-0 select-none">[{idx.toString().padStart(3, '0')}]</span>
                    <span className="whitespace-pre-wrap">{logLine}</span>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center py-10 gap-3 text-slate-700 italic">
                  <Loader2 size={16} className="animate-spin text-emerald-500" />
                  Aguarda inicialização do socket...
                </div>
              )}
            </div>
          </div>

          {/* AI Autopilot Simulation Injection */}
          <div className="p-4 bg-slate-800/60 border border-slate-750 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-black tracking-wider text-slate-350 flex items-center gap-1.5">
                <Brain size={12} className="text-purple-400 animate-pulse" />
                Workspace Inteligência Autopilot (Simulador de Triggers)
              </span>
              <span className="text-[9px] font-semibold text-purple-400 uppercase tracking-widest bg-purple-950/40 border border-purple-900/35 px-2 py-0.5 rounded-full">
                Gemini 1.5 Flash Ativo
              </span>
            </div>

            <p className="text-[10.5px] text-slate-400 leading-relaxed mb-2">
              José, injete mensagens simuladas vindas de motoristas ou passageiros do Moxico no WhatsApp para testar a triagem e o piloto automático da central:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="p-3 bg-slate-800/80 border border-slate-700/60 rounded-lg space-y-2">
                <span className="text-[9px] uppercase font-black tracking-wider text-slate-400 block">Enviar como Passageiro</span>
                <div className="space-y-1.5">
                  <button 
                    type="button"
                    onClick={() => injectIncomingMessage(
                      "Preciso de um táxi com pressa em frente ao Hospital Geral do Luena para ir ao Bairro Sangondo. Meu nome é Delfina Manuel.",
                      "Delfina Manuel",
                      "+244 925 333 444",
                      "clients"
                    )}
                    className="w-full text-left p-1.5 bg-slate-700 hover:bg-slate-650 rounded text-[9.5px] text-slate-300 font-medium truncate flex items-center gap-1.5"
                    title="Simular pedido com endereço no Luena"
                  >
                    <Sparkles size={10} className="text-purple-400 shrink-0" />
                    Pedido: Hospital ➔ Sangondo
                  </button>
                  <button 
                    type="button"
                    onClick={() => injectIncomingMessage(
                      "Queria saber se tem um táxi livre para me levar da Administração Municipal do Luena até a Faculdade de Medicina no Moxico hoje de tarde. Aguardo.",
                      "Manuel Kapenda",
                      "+244 931 777 666",
                      "clients"
                    )}
                    className="w-full text-left p-1.5 bg-slate-700 hover:bg-slate-650 rounded text-[9.5px] text-slate-300 font-medium truncate flex items-center gap-1.5"
                  >
                    <Sparkles size={10} className="text-purple-400 shrink-0" />
                    Pedido: Administração ➔ Faculdade
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-800/80 border border-slate-700/60 rounded-lg space-y-2">
                <span className="text-[9px] uppercase font-black tracking-wider text-slate-400 block">Enviar como Motorista</span>
                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => injectIncomingMessage(
                        "!panico T-09",
                        "José Manuel (T-09)",
                        "+244 945 777 888",
                        "drivers"
                      )}
                      className="flex-1 p-1.5 bg-red-950/45 hover:bg-red-900/30 border border-red-800/25 text-red-400 rounded text-[9.5px] font-bold text-center uppercase tracking-wider"
                    >
                      🆘 SOS T-09
                    </button>
                    <button 
                      type="button"
                      onClick={() => injectIncomingMessage(
                        "!ativo T-04",
                        "Augusto Silva (T-04)",
                        "+244 923 111 222",
                        "drivers"
                      )}
                      className="flex-1 p-1.5 bg-emerald-950/45 hover:bg-emerald-900/30 border border-emerald-800/25 text-emerald-400 rounded text-[9.5px] font-bold text-center uppercase tracking-wider"
                    >
                      ✔ ATIVO T-04
                    </button>
                    <button 
                      type="button"
                      onClick={() => injectIncomingMessage(
                        "!ocupado T-12",
                        "Pedro Kiala (T-12)",
                        "+244 931 444 555",
                        "drivers"
                      )}
                      className="flex-1 p-1.5 bg-amber-950/45 hover:bg-amber-900/30 border border-amber-800/25 text-amber-400 rounded text-[9.5px] font-bold text-center uppercase tracking-wider"
                    >
                      🛑 BUSY T-12
                    </button>
                  </div>
                  <p className="text-[7.5px] text-slate-500 text-center leading-normal">
                    Comandos via Baileys WhatsApp modificam o estado operacional do motorista na base de dados global na hora!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'meta_webhook' ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-100 dark:bg-slate-950">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-2">
                  <Globe size={14} className="text-emerald-500" />
                  Meta Webhook Status
                </span>
                <div className={cn("w-3 h-3 rounded-full shadow-lg", metaWebhookState.online ? "bg-emerald-500 shadow-emerald-500/20" : "bg-red-500")} />
              </div>
              
              <div className="space-y-3 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-900">
                <div className="flex justify-between items-center group">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Endpoint:</span>
                  <span className="font-mono text-slate-900 dark:text-white text-[11px]">{metaWebhookState.endpoint}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Webhook Secret:</span>
                  <span className={cn("text-[11px] font-black uppercase tracking-widest", metaWebhookState.hasSecret ? "text-emerald-500" : "text-red-500")}>
                    {metaWebhookState.hasSecret ? "Configurado" : "Ausente"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Meta Token:</span>
                   <span className={cn("text-[11px] font-black uppercase tracking-widest", metaWebhookState.hasMetaToken ? "text-emerald-500" : "text-amber-500")}>
                    {metaWebhookState.hasMetaToken ? "Configurado" : "Opcional"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Último Ping:</span>
                  <span className="font-mono text-slate-900 dark:text-white text-[10px] text-right">
                    {metaWebhookState.lastPing ? new Date(metaWebhookState.lastPing).toLocaleTimeString() : 'A aguardar...'}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                 <button 
                   type="button"
                   onClick={() => window.open(webhookUrl || "https://api.taxicontrol.ao/v1/whatsapp/webhook", '_blank')}
                   className="w-full py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase rounded-2xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                 >
                   Testar Conectividade Externa
                   <ExternalLink size={12} />
                 </button>
              </div>
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm text-center flex flex-col items-center justify-center min-h-[220px]">
               {metaWebhookState.online && metaWebhookState.hasSecret ? (
                 <>
                   <div className="inline-flex p-5 bg-emerald-500/10 text-emerald-600 rounded-3xl scale-110 mb-4">
                     <CheckCheck size={40} />
                   </div>
                   <h5 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Handshake Seguro</h5>
                   <p className="text-[10px] text-slate-400 mt-2 max-w-[240px] leading-relaxed mx-auto font-medium">
                     O servidor está online e a responder ao challenge da Meta Cloud API com verificação 256 bits.
                   </p>
                 </>
               ) : (
                 <>
                   <div className="inline-flex p-5 bg-red-500/10 text-red-600 rounded-3xl scale-110 mb-4">
                     <AlertTriangle size={40} />
                   </div>
                   <h5 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Handshake Inativo</h5>
                   <p className="text-[10px] text-slate-400 mt-2 max-w-[240px] leading-relaxed mx-auto font-medium">
                     Webhook falhou verificação ou API está em baixo.
                   </p>
                 </>
               )}
            </div>
          </div>
          
          <div className="p-4 bg-slate-900 rounded-3xl shadow-inner border border-slate-800 overflow-hidden">
             <div className="flex items-center gap-2 mb-3 border-b border-slate-800 pb-3">
               <Terminal size={14} className="text-emerald-500" />
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Logs de Sincronização Webhook</span>
             </div>
             <div className="h-40 overflow-y-auto space-y-1 custom-scrollbar text-[9px] font-mono leading-relaxed">
                <div className="text-emerald-400/80">[{new Date().toLocaleTimeString()}] Handshake Meta Cloud API verificado com Sucesso.</div>
                {metaWebhookState.online && <div className="text-slate-400 mt-1">[{new Date().toISOString()}] Ping /api/meta-webhook/status HTTP 200 OK</div>}
                {!metaWebhookState.hasSecret && <div className="text-red-400 mt-1">[ALERTA] WEBHOOK_SECRET obrigatório não carregado nas env vars.</div>}
             </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Authentic WhatsApp Chat Header */}
          <div className="px-4 py-3 bg-[#075e54] dark:bg-[#202c33] text-white flex items-center justify-between shadow-md shrink-0 relative">
            {isLocalSearchOpen ? (
              <div className="flex items-center gap-3 w-full animate-in fade-in slide-in-from-top-1 duration-150">
                <button
                  type="button"
                  onClick={() => {
                    setIsLocalSearchOpen(false);
                    setLocalSearchQuery('');
                  }}
                  className="p-1.5 hover:bg-white/10 rounded-full transition-all text-white flex items-center justify-center cursor-pointer"
                  title="Voltar"
                >
                  <ArrowLeft size={18} />
                </button>
                <input
                  type="text"
                  placeholder="Pesquisar mensagens neste canal..."
                  value={localSearchQuery}
                  onChange={(e) => setLocalSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent border-none outline-none text-white placeholder-white/60 text-sm font-bold"
                  autoFocus
                />
                {localSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setLocalSearchQuery('')}
                    className="p-1 hover:bg-white/10 rounded-full text-white cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  {isFullscreen && (
                    <button
                      type="button"
                      onClick={() => setIsFullscreen(false)}
                      className="mr-1 p-2 bg-white/10 hover:bg-white/20 active:scale-95 rounded-full transition-all text-white flex items-center justify-center cursor-pointer"
                      title="Voltar / Sair da Tela Cheia"
                    >
                      <ArrowLeft size={18} />
                    </button>
                  )}
                  <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white text-base font-black uppercase">
                    {activeTab === 'drivers' ? '🚖' : '👥'}
                  </div>
                  <div className="text-left leading-tight">
                    <p className="text-sm font-black uppercase tracking-wide">
                      {activeTab === 'drivers' ? 'Central Geral de Motoristas (Luena)' : 'Canal Geral de Clientes (WhatsApp)'}
                    </p>
                    <span className="text-[10px] text-emerald-200 dark:text-emerald-400 font-bold flex items-center gap-1.5 animate-pulse">
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                      Piloto Automático Ativo (Triagem Live)
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3.5 text-white/80 relative">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPhoneModalOpen(true);
                      setCallStatus('idle');
                    }}
                    className="p-1.5 hover:bg-white/10 hover:text-white active:scale-90 rounded-full transition-all text-white/80 flex items-center justify-center cursor-pointer"
                    title="Chamada GSM / Rádio de Campo"
                  >
                    <Phone size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsVideoModalOpen(true);
                      setVideoStatus('idle');
                    }}
                    className="p-1.5 hover:bg-white/10 hover:text-white active:scale-90 rounded-full transition-all text-white/80 flex items-center justify-center cursor-pointer"
                    title="Vídeo-Vigilância Live da Cabine"
                  >
                    <Video size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsLocalSearchOpen(true)}
                    className="p-1.5 hover:bg-white/10 hover:text-white active:scale-90 rounded-full transition-all text-white/80 flex items-center justify-center cursor-pointer"
                    title="Pesquisar Mensagens"
                  >
                    <Search size={15} />
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsMenuOpen(!isMenuOpen)}
                      className={cn(
                        "p-1.5 hover:bg-white/10 hover:text-white active:scale-90 rounded-full transition-all flex items-center justify-center cursor-pointer",
                        isMenuOpen ? "bg-white/15 text-white" : "text-white/80"
                      )}
                      title="Menu de Operações Técnicas"
                    >
                      <MoreVertical size={15} />
                    </button>
                    {isMenuOpen && (
                      <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-850 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 py-2 z-50 text-slate-800 dark:text-slate-200 animate-in fade-in slide-in-from-top-2 duration-150 text-left">
                        <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-700 mb-1">
                          <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Ações do Canal</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setIsMenuOpen(false);
                            handleForceGsmSync();
                          }}
                          className="w-full px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 text-[10px] font-black uppercase text-left text-emerald-600 dark:text-emerald-400 cursor-pointer"
                        >
                          <RefreshCw size={12} className={isSyncingGsm ? "animate-spin" : ""} />
                          Forçar Sincronização GSM
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsMenuOpen(false);
                            handleExportLogs();
                          }}
                          className="w-full px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 text-[10px] font-black uppercase text-left cursor-pointer"
                        >
                          <Download size={12} />
                          Exportar Histórico
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsMenuOpen(false);
                            forceTriggerTelemetryCall();
                          }}
                          className="w-full px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 text-[10px] font-black uppercase text-left text-amber-500 dark:text-amber-400 cursor-pointer"
                        >
                          <Zap size={12} className="animate-pulse text-amber-500" />
                          Simular Entrada UNITEL
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsMenuOpen(false);
                            if (activeTab === 'drivers') {
                              setDriverMessages([]);
                            } else {
                              setClientMessages([]);
                            }
                            showCustomToast('Ecrã de monitorização limpo temporariamente.', 'info');
                          }}
                          className="w-full px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 text-[10px] font-black uppercase text-left text-rose-500 cursor-pointer"
                        >
                          <X size={12} />
                          Limpar Ecrã do Canal
                        </button>
                        <div className="border-t border-slate-100 dark:border-slate-700 my-1"></div>
                        <div className="px-3 py-1.5 text-[8.5px] font-bold text-slate-400 uppercase leading-none">
                          Canal: {activeTab === 'drivers' ? 'Motoristas' : 'Clientes'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Messages Scroll Area with WhatsApp background */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth bg-[#efeae2] dark:bg-[#0b141a] relative"
            style={{
              backgroundImage: 'radial-gradient(rgba(0,0,0,0.03) 1px, transparent 0)',
              backgroundSize: '24px 24px'
            }}
          >
            {/* End-to-end encryption notice */}
            <div className="flex justify-center my-2 select-none">
              <div className="bg-[#ffe596]/80 dark:bg-[#182229] border border-[#f3d274]/50 dark:border-white/5 px-3.5 py-1.5 rounded-xl max-w-[90%] text-center shadow-sm">
                <p className="text-[9.5px] text-[#514316] dark:text-[#8696a0] font-black leading-normal uppercase">
                  🔒 As mensagens e chamadas são encriptadas de ponta a ponta. Ninguém fora desta conversa pode ler.
                </p>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {filteredMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
                  <MessageSquare size={28} className="opacity-40 mb-2" />
                  <p className="text-xs font-bold uppercase tracking-wider">Nenhuma mensagem encontrada</p>
                </div>
              ) : (
                filteredMessages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className={`flex flex-col max-w-[85%] ${
                      msg.sender === 'Central Operacional' || msg.sender === 'Operador Central' 
                        ? 'ml-auto mr-0' 
                        : 'mr-auto ml-0'
                    }`}
                  >
                    {msg.type === 'alert' ? (
                      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 rounded-xl flex items-start gap-3 w-full shadow-sm">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/40 text-amber-600 rounded-lg shrink-0">
                          <AlertTriangle size={16} />
                        </div>
                        <div>
                          <span className="text-[10px] font-black uppercase text-amber-600 tracking-wider">Alerta de Sistema</span>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 leading-relaxed">
                            {msg.text}
                          </p>
                          <span className="text-[9px] text-amber-500 mt-1 block">
                            {msg.timestamp.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    ) : msg.sender === 'Operador Central' || msg.sender === 'Central Operacional' ? (
                      <div className="space-y-0.5">
                        <div className="bg-[#d9fdd3] dark:bg-[#005c4b] border border-[#d1f4cc]/85 dark:border-[#004d3e] p-3 rounded-2xl rounded-tr-none text-slate-900 dark:text-slate-100 shadow-sm relative">
                          <span className="text-[9px] font-black uppercase text-[#075e54] dark:text-[#00a884] block mb-1">
                            {msg.sender} • {msg.phone}
                          </span>
                          {msg.type === 'location' ? (
                            <div className="flex items-center gap-3 bg-black/5 dark:bg-black/20 p-2 rounded-xl">
                              <div className="p-2 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 rounded-lg shrink-0">
                                <MapPin size={16} />
                              </div>
                              <div>
                                <p className="text-xs font-semibold leading-normal">{msg.text}</p>
                                <button className="text-[10px] font-bold uppercase mt-1.5 flex items-center gap-1 hover:underline text-emerald-600 dark:text-emerald-400">
                                  Ver no Mapa <ChevronRight size={10} />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs font-semibold leading-relaxed whitespace-pre-wrap">
                              {msg.text}
                            </p>
                          )}

                          <div className="flex items-center justify-between gap-3 mt-2.5 pt-1.5 border-t border-black/5 dark:border-white/5">
                            <button
                              type="button"
                              onClick={() => alert('Forwarding: ' + msg.text)}
                              className="text-[9px] flex items-center gap-1 text-[#075e54]/70 dark:text-emerald-450/75 hover:text-emerald-500 font-extrabold uppercase transition-colors"
                            >
                              <Forward size={11} />
                              Reencaminhar
                            </button>
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400">
                                {msg.timestamp.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <CheckCheck size={12} className="text-[#53bdeb]" />
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        <div className={cn(
                          "p-3 rounded-2xl rounded-tl-none text-slate-900 dark:text-slate-100 shadow-sm border relative",
                          msg.isOperational 
                            ? "bg-[#e8f4fd] dark:bg-[#182229] border-[#d2eafb] dark:border-white/5"
                            : "bg-white dark:bg-[#202c33] border-slate-200/60 dark:border-white/5"
                        )}>
                          <span className="text-[9px] font-black uppercase text-[#00a884] dark:text-[#00a884] block mb-1">
                            {msg.sender} • {msg.phone}
                          </span>
                          {msg.type === 'location' ? (
                            <div className="flex items-center gap-3 bg-black/5 dark:bg-black/20 p-2 rounded-xl">
                              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg shrink-0">
                                <MapPin size={16} />
                              </div>
                              <div>
                                <p className="text-xs font-semibold leading-normal">{msg.text}</p>
                                <button className="text-[10px] font-bold uppercase mt-1.5 flex items-center gap-1 hover:underline text-blue-600 dark:text-blue-400">
                                  Ver no Mapa <ChevronRight size={10} />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs font-semibold leading-relaxed whitespace-pre-wrap">
                              {msg.text}
                            </p>
                          )}

                          {/* Controle Operativo dos Pedidos de Clientes */}
                          {activeTab === 'clients' && msg.sender !== 'Operador Central' && (
                            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-4">
                              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                Ação Operativa:
                              </span>
                              {msg.status === 'pending' ? (
                                <button
                                  type="button"
                                  onClick={() => handleDispatch(msg.id)}
                                  className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black rounded-lg transition-all uppercase tracking-wider shadow-sm flex items-center gap-1 cursor-pointer"
                                >
                                  Despachar Táxi 🚖
                                </button>
                              ) : msg.status === 'dispatched' ? (
                                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-black uppercase tracking-wider bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-md border border-amber-100 dark:border-amber-900/40">
                                  Táxi Despachado ⚡
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md">
                                  Concluído
                                </span>
                              )}
                            </div>
                          )}

                          <div className="flex items-center justify-between gap-3 mt-2.5 pt-1.5 border-t border-black/5 dark:border-white/5">
                            <button
                              type="button"
                              onClick={() => alert('Forwarding: ' + msg.text)}
                              className="text-[9px] flex items-center gap-1 text-slate-400 dark:text-slate-500 hover:text-emerald-500 font-extrabold uppercase transition-colors"
                            >
                              <Forward size={11} />
                              Reencaminhar
                            </button>
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400">
                                {msg.timestamp.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <CheckCheck size={12} className="text-slate-400 dark:text-slate-500" />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Quick Reply Form - Only visible when not in settings and not in Baileys panel */}
      {!showSettings && activeTab !== 'baileys' && (
        <form onSubmit={handleSendMessage} className="p-3 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex gap-2 shrink-0">
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={cn("p-2 rounded-xl transition-all", selectedImage ? "bg-emerald-100 text-emerald-700" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700")}
            title="Adicionar imagem"
          >
            <LinkIcon size={18} />
          </button>
          
          <button 
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="p-2 rounded-xl transition-all text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700"
            title="Tirar foto"
          >
            <Camera size={18} />
          </button>
          
          <input type="file" ref={fileInputRef} onChange={e => setSelectedImage(e.target.files?.[0] || null)} hidden accept="image/*" />
          <input type="file" ref={cameraInputRef} onChange={e => setSelectedImage(e.target.files?.[0] || null)} hidden accept="image/*" capture="environment" />
          
          <input 
            type="text"
            placeholder={selectedImage ? `Imagem selecionada: ${selectedImage.name}` : (activeTab === 'drivers' ? "Instrução para os motoristas no WhatsApp..." : "Responder ao grupo de clientes no WhatsApp...")}
            className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none transition-all dark:text-white"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
          />
          <button 
            type="submit"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm shrink-0 uppercase tracking-wider"
          >
            {selectedImage ? "Enviar Imagem" : "Enviar"}
          </button>
        </form>
      )}

      {/* Footer Info */}
      {!isChatFullscreen && (
        <div className="p-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            Total Ativo: {currentMessages.length} mensagens
          </p>
          <div className="flex items-center gap-2">
             <Phone size={12} className="text-slate-400" />
             <span className="text-[10px] font-black text-slate-400">+244 CENTRAL LUENA</span>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 📞 MODAL DE CHAMADA GSM & RÁDIO OPERACIONAL (LUENA HUB)   */}
      {/* ========================================================= */}
      {isPhoneModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-[#075e54] to-[#128c7e] text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                  <Radio size={20} className="animate-pulse text-emerald-200" />
                </div>
                <div>
                  <h4 className="font-black text-sm uppercase tracking-wider">Painel GSM & Rádio de Campo</h4>
                  <p className="text-[10px] font-bold text-emerald-100 uppercase tracking-widest mt-0.5">Moxico Despacho Live • +244 Central</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsPhoneModalOpen(false);
                  setCallStatus('idle');
                  setSelectedDriverForCall(null);
                }}
                className="p-1.5 hover:bg-white/10 rounded-xl text-white transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 flex-1 overflow-y-auto">
              {/* Left Column: Registered Channels */}
              <div className="p-5 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
                <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-3">Canais GSM/Rádio Activos</h5>
                <div className="space-y-2">
                  {[
                    { name: 'Augusto Silva (T-04)', phone: '+244 923 111 222', type: 'Motorista', initial: 'AS', isDriver: true },
                    { name: 'Pedro Kiala (T-12)', phone: '+244 931 444 555', type: 'Motorista', initial: 'PK', isDriver: true },
                    { name: 'José Manuel (T-09)', phone: '+244 945 777 888', type: 'Motorista', initial: 'JM', isDriver: true },
                    { name: 'Delfina Manuel', phone: '+244 925 333 444', type: 'Cliente', initial: 'DM', isDriver: false },
                    { name: 'António Cavula', phone: '+244 932 555 666', type: 'Cliente', initial: 'AC', isDriver: false },
                  ].map((chan) => (
                    <button
                      key={chan.phone}
                      onClick={() => {
                        setSelectedDriverForCall(chan);
                        setCallStatus('idle');
                      }}
                      className={cn(
                        "w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer",
                        selectedDriverForCall?.phone === chan.phone
                          ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500 shadow-sm"
                          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/50"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-xl font-black text-[10px] flex items-center justify-center text-white",
                          chan.isDriver ? "bg-slate-800 dark:bg-slate-700" : "bg-emerald-600"
                        )}>
                          {chan.initial}
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-900 dark:text-white">{chan.name}</p>
                          <p className="text-[9px] font-bold text-slate-400 mt-0.5">{chan.phone}</p>
                        </div>
                      </div>
                      <span className="text-[8px] font-black uppercase bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded text-slate-500">
                        {chan.type}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Right Column: Dialing and Active Screen */}
              <div className="p-5 flex flex-col justify-between bg-white dark:bg-slate-900 min-h-[300px]">
                {selectedDriverForCall ? (
                  <div className="flex flex-col flex-1">
                    {callStatus === 'idle' && (
                      <div className="text-center py-6 flex-1 flex flex-col justify-center items-center">
                        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-300 mb-4 border border-slate-200 dark:border-slate-700">
                          <Phone size={24} />
                        </div>
                        <h6 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Iniciar Canal de Voz</h6>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Conectando a {selectedDriverForCall.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 text-center px-4 leading-relaxed">
                          O sinal de voz será transmitido por GSM encriptado. O áudio e os registos de chamadas do motorista serão registados na central operacional.
                        </p>

                        <div className="grid grid-cols-2 gap-3 w-full mt-6">
                          <button
                            type="button"
                            onClick={() => {
                              setCallStatus('dialing');
                              setTimeout(() => setCallStatus('active'), 2000);
                            }}
                            className="py-2.5 px-4 bg-[#075e54] hover:bg-[#128c7e] text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md hover:scale-102 transition-all cursor-pointer"
                          >
                            <Phone size={12} /> Chamada GSM
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCallStatus('dialing');
                              setTimeout(() => setCallStatus('active'), 1500);
                            }}
                            className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md hover:scale-102 transition-all cursor-pointer"
                          >
                            <Radio size={12} /> Canal de Rádio
                          </button>
                        </div>
                      </div>
                    )}

                    {callStatus === 'dialing' && (
                      <div className="text-center py-8 flex-1 flex flex-col justify-center items-center">
                        <div className="w-20 h-20 rounded-full bg-amber-50 dark:bg-amber-950/20 text-amber-500 flex items-center justify-center mb-6 border border-amber-200 dark:border-amber-800/40 relative">
                          <span className="absolute inset-0 rounded-full bg-amber-400/20 animate-ping" />
                          <Phone size={30} className="animate-pulse" />
                        </div>
                        <h6 className="text-sm font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider animate-pulse">A Ligar...</h6>
                        <p className="text-[11px] font-black text-slate-800 dark:text-slate-200 mt-2">{selectedDriverForCall.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Via Canal de Voz Luena Hub</p>
                      </div>
                    )}

                    {callStatus === 'active' && (
                      <div className="text-center py-6 flex-1 flex flex-col justify-between items-center">
                        <div>
                          <div className="text-[9px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1 justify-center bg-emerald-50 dark:bg-emerald-950/25 px-2.5 py-1 rounded-full border border-emerald-200/45 dark:border-emerald-900/30">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                            Canal de Voz Conectado (Moxico GSM)
                          </div>
                          <p className="text-base font-black text-slate-900 dark:text-white mt-4">{selectedDriverForCall.name}</p>
                          <p className="text-xs font-bold text-slate-400 tracking-wider mt-1">{selectedDriverForCall.phone}</p>
                          
                          {/* Timer */}
                          <div className="text-3xl font-black text-slate-800 dark:text-white tracking-widest font-mono mt-4">
                            {formatTime(callTimer)}
                          </div>
                        </div>

                        {/* Pulsing Visualizer */}
                        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-800 px-6 py-4 rounded-2xl w-full max-w-[220px] justify-center my-4">
                          {[1, 2, 3, 4, 5, 4, 3, 2, 1].map((val, i) => (
                            <div 
                              key={i} 
                              className="w-1 bg-emerald-500 rounded-full transition-all duration-150" 
                              style={{ 
                                height: `${isCallMuted ? 3 : val * (Math.random() * 5 + 3)}px`, 
                                opacity: isCallMuted ? 0.3 : 1 
                              }} 
                            />
                          ))}
                        </div>

                        <div className="space-y-4 w-full">
                          <div className="flex justify-center gap-4">
                            <button
                              type="button"
                              onClick={() => {
                                setIsCallMuted(!isCallMuted);
                                showCustomToast(isCallMuted ? 'Microfone ativado' : 'Microfone silenciado', 'info');
                              }}
                              className={cn(
                                "w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer border shadow",
                                isCallMuted 
                                  ? "bg-rose-100 dark:bg-rose-950 text-rose-600 border-rose-300" 
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200"
                              )}
                              title={isCallMuted ? "Ativar Microfone" : "Silenciar Microfone"}
                            >
                              <Volume2 size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsRecordingCall(!isRecordingCall);
                                showCustomToast(isRecordingCall ? 'Gravação da chamada parada' : 'A gravar áudio do canal GSM...', 'info');
                              }}
                              className={cn(
                                "w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer border shadow",
                                isRecordingCall 
                                  ? "bg-rose-600 text-white border-rose-600 animate-pulse" 
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200"
                              )}
                              title={isRecordingCall ? "Parar Gravação" : "Gravar Chamada"}
                            >
                              <Activity size={16} />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setCallStatus('ended');
                              const durationStr = formatTime(callTimer);
                              // Adicionar registo de chamada à lista
                              const newLog = {
                                id: `cl-${Date.now()}`,
                                driverName: selectedDriverForCall.name,
                                phone: selectedDriverForCall.phone,
                                type: 'audio',
                                duration: durationStr,
                                timestamp: new Date(),
                                status: 'completed'
                              };
                              setCallLogs(prev => [newLog, ...prev]);

                              // Adicionar mensagem especial de log de sistema ao canal
                              const logAlert: WhatsAppMessage = {
                                id: `log-${Date.now()}`,
                                sender: 'Central Operacional',
                                phone: 'LOG_GSM',
                                text: `📞 LOG DE CHAMADA GSM OPERACIONAL: Conversação de voz com ${selectedDriverForCall.name} finalizada. Duração: ${durationStr}. Ficheiro de gravação de áudio arquivado na Central PSM.`,
                                timestamp: new Date(),
                                type: 'alert',
                                isOperational: true
                              };
                              if (activeTab === 'drivers') {
                                setDriverMessages(prev => [...prev, logAlert]);
                              } else {
                                setClientMessages(prev => [...prev, logAlert]);
                              }

                              showCustomToast(`Chamada terminada. Registos de chamada enviados para a central com sucesso!`, 'success');
                              setTimeout(() => {
                                setCallStatus('idle');
                                setSelectedDriverForCall(null);
                              }, 1500);
                            }}
                            className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-500/20 active:scale-95 cursor-pointer"
                          >
                            Encerrar Ligação GSM
                          </button>
                        </div>
                      </div>
                    )}

                    {callStatus === 'ended' && (
                      <div className="text-center py-8 flex-1 flex flex-col justify-center items-center">
                        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mb-4">
                          <X size={24} />
                        </div>
                        <h6 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">Chamada Terminada</h6>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Logs GSM Guardados</p>
                        <p className="text-[10px] text-emerald-500 font-extrabold mt-3 uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/20 px-3 py-1 rounded-full border border-emerald-100">
                          ✓ Sincronizado com Moxico Hub
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col flex-1 justify-between">
                    <div>
                      <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-3">Histórico de Chamadas Operacionais</h5>
                      <div className="space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar">
                        {callLogs.map((log) => (
                          <div key={log.id} className="p-3 bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center justify-between">
                            <div className="text-left">
                              <p className="text-[11px] font-black text-slate-900 dark:text-white leading-none">{log.driverName}</p>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className={cn(
                                  "w-1.5 h-1.5 rounded-full",
                                  log.status === 'completed' ? 'bg-emerald-500' : 'bg-rose-500'
                                )} />
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                                  {log.status === 'completed' ? `Atendida • ${log.duration}` : 'Perdida'}
                                </span>
                              </div>
                            </div>
                            <span className="text-[8px] font-bold text-slate-400 font-mono">
                              {log.timestamp.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="p-3 bg-slate-50 dark:bg-slate-950/30 rounded-2xl border border-slate-100 dark:border-slate-850 text-center text-[10px] text-slate-500 leading-normal">
                      📟 <strong className="text-slate-700 dark:text-slate-300">Dica Operacional:</strong> Os logs telefónicos dos motoristas (Augusto, Pedro, etc.) sincronizam automaticamente em segundo plano através do nosso canal GSM/Rádio.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 📹 MODAL DE VÍDEO-VIGILÂNCIA LIVE DO MOTORISTA (GSM 4G)    */}
      {/* ========================================================= */}
      {isVideoModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-rose-500/10 rounded-xl flex items-center justify-center border border-rose-500/30 animate-pulse">
                  <Video size={20} className="text-rose-500" />
                </div>
                <div>
                  <h4 className="font-black text-sm uppercase tracking-wider">Monitorização de Cabine & Via Live</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Transmissão em Directo via 4G GSM • Luena Central</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsVideoModalOpen(false);
                  setVideoStatus('idle');
                  setSelectedDriverForVideo(null);
                }}
                className="p-1.5 hover:bg-slate-800 rounded-xl text-white transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 flex-1 overflow-y-auto">
              {/* Left Column: Fleet Selection */}
              <div className="p-5 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
                <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-3">Viatura para Ligar Câmera</h5>
                <div className="space-y-2">
                  {[
                    { plate: 'T-04', driver: 'Augusto Silva', status: 'Online', signal: 'Excelente' },
                    { plate: 'T-12', driver: 'Pedro Kiala', status: 'Online', signal: 'Bom' },
                    { plate: 'T-09', driver: 'José Manuel', status: 'Online', signal: 'Excelente' },
                  ].map((car) => (
                    <button
                      key={car.plate}
                      onClick={() => {
                        setSelectedDriverForVideo(car);
                        setVideoStatus('idle');
                      }}
                      className={cn(
                        "w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer",
                        selectedDriverForVideo?.plate === car.plate
                          ? "bg-rose-50 dark:bg-rose-950/20 border-rose-500 shadow-sm"
                          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/50"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-slate-900 text-white font-black text-xs flex items-center justify-center">
                          {car.plate}
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-900 dark:text-white">{car.driver}</p>
                          <p className="text-[9px] font-bold text-slate-400 mt-0.5">Sinal: {car.signal}</p>
                        </div>
                      </div>
                      <span className="text-[8px] font-black uppercase bg-rose-50 dark:bg-rose-950/20 text-rose-600 px-2.5 py-1 rounded-md">
                        ✓ {car.status}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Right Column: Simulated Live Streaming View */}
              <div className="p-5 flex flex-col justify-between bg-slate-950 text-white min-h-[300px]">
                {selectedDriverForVideo ? (
                  <div className="flex flex-col flex-1 h-full">
                    {videoStatus === 'idle' ? (
                      <div className="text-center py-10 flex-1 flex flex-col justify-center items-center">
                        <Video size={36} className="text-slate-500 animate-pulse mb-3" />
                        <h6 className="text-xs font-black text-slate-300 uppercase tracking-widest">Feed de Vídeo Desligado</h6>
                        <p className="text-[10px] text-slate-500 uppercase mt-1">Viatura {selectedDriverForVideo.plate} - {selectedDriverForVideo.driver}</p>
                        
                        <button
                          type="button"
                          onClick={() => {
                            setVideoStatus('streaming');
                            showCustomToast('A iniciar link de vídeo GSM...', 'info');
                          }}
                          className="mt-6 py-2.5 px-5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-rose-600/20 active:scale-95 transition-all cursor-pointer"
                        >
                          <Play size={12} fill="currentColor" /> Conectar Vídeo Live
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col flex-1 justify-between h-full">
                        {/* High-Tech Animated Road SVG */}
                        <div className="relative">
                          <svg className="w-full h-44 bg-slate-950 rounded-2xl relative overflow-hidden border border-slate-800" viewBox="0 0 400 200">
                            {/* Background road effect with CSS motion */}
                            <rect width="400" height="200" fill="#0b0f19" />
                            {/* Star or landscape objects */}
                            <circle cx="50" cy="50" r="1" fill="#fff" opacity="0.8" />
                            <circle cx="120" cy="40" r="1.5" fill="#fff" opacity="0.5" />
                            <circle cx="280" cy="60" r="1" fill="#fff" opacity="0.6" />
                            {/* Road outlines */}
                            <path d="M 200 80 L 40 200 M 200 80 L 360 200" stroke="#334155" strokeWidth="2" />
                            {/* Dash Lines animating */}
                            <line 
                              x1="200" 
                              y1="85" 
                              x2="200" 
                              y2="200" 
                              stroke={videoCameraType === 'road' ? '#e2e8f0' : '#475569'} 
                              strokeWidth="2.5" 
                              strokeDasharray="12, 10" 
                              className="animate-pulse" 
                            />
                            
                            {videoCameraType === 'cabin' ? (
                              <>
                                {/* Simulated Cabin Dashboard view */}
                                <rect x="130" y="70" width="140" height="70" rx="15" fill="#1e293b" opacity="0.9" stroke="#475569" strokeWidth="1" />
                                <circle cx="200" cy="100" r="18" fill="#0f172a" />
                                <path d="M 190 100 Q 200 90 210 100" stroke="#f59e0b" strokeWidth="2" fill="none" />
                                <text x="175" y="130" fill="#10b981" fontSize="7" fontWeight="bold" fontFamily="monospace">PILOTO VIGILÂNCIA</text>
                              </>
                            ) : (
                              <>
                                {/* Simulated Driver windshield HUD or road line */}
                                <path d="M 0 160 Q 100 150 200 160 T 400 160 L 400 200 L 0 200 Z" fill="#0f172a" />
                                <rect x="150" y="165" width="100" height="25" rx="5" fill="#1e293b" />
                                <line x1="160" y1="177" x2="240" y2="177" stroke="#38bdf8" strokeWidth="2" />
                              </>
                            )}
                            
                            {/* HUD details */}
                            <text x="15" y="25" fill="#f43f5e" fontSize="9" fontWeight="900" fontFamily="monospace" className="animate-pulse">● LIVE [{videoCameraType === 'road' ? 'VIA ESTRADA' : 'INTERIOR CABINE'}]</text>
                            <text x="15" y="42" fill="#94a3b8" fontSize="8" fontWeight="bold" fontFamily="monospace">TEL: {selectedDriverForVideo.driver}</text>
                            <text x="15" y="54" fill="#94a3b8" fontSize="8" fontWeight="bold" fontFamily="monospace">GPS: {simulatedCoords.lat.toFixed(5)}, {simulatedCoords.lon.toFixed(5)}</text>
                            <text x="315" y="28" fill="#f59e0b" fontSize="15" fontWeight="900" fontFamily="monospace">{simulatedSpeed} km/h</text>
                            <text x="315" y="42" fill="#10b981" fontSize="8" fontWeight="bold" fontFamily="monospace">SINAL: LTE 4G</text>
                            
                            {/* Scanning Target */}
                            <circle cx="200" cy="100" r="18" stroke="#ef4444" strokeWidth="1" fill="none" opacity="0.3" className="animate-ping" />
                          </svg>
                        </div>

                        {/* Controls */}
                        <div className="mt-4 space-y-3">
                          <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase tracking-wider bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                            <span>Viatura: {selectedDriverForVideo.plate}</span>
                            <span>Tempo de Stream: {formatTime(videoTimer)}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setVideoCameraType(videoCameraType === 'road' ? 'cabin' : 'road');
                                showCustomToast(videoCameraType === 'road' ? 'Câmera interior de cabine ativada' : 'Câmera frontal de estrada ativada', 'info');
                              }}
                              className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
                            >
                              Alternar Câmera
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                showCustomToast('Foto capturada e arquivada nos logs da viatura!', 'success');
                              }}
                              className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
                            >
                              Capturar Foto
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setVideoStatus('idle');
                              showCustomToast('Transmissão de vídeo encerrada de forma segura.', 'info');
                            }}
                            className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-600/30 active:scale-95 transition-all cursor-pointer"
                          >
                            Encerrar Stream Live
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col flex-1 justify-center items-center text-center p-6 text-slate-500">
                    <Video size={40} className="text-slate-700 opacity-40 mb-3" />
                    <h6 className="text-xs font-black text-slate-400 uppercase tracking-widest">Nenhuma viatura selecionada</h6>
                    <p className="text-[10px] text-slate-500 mt-1 max-w-[200px] leading-relaxed">
                      Selecione um táxi activo à esquerda para carregar o feed de vídeo da cabine em directo.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 📡 OVERLAY DE TELEMETRIA UNITEL / MOVICEL EM TEMPO REAL     */}
      {/* ========================================================= */}
      {incomingTelemetryCall && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-[120] p-4 animate-in fade-in duration-300">
          <div className="bg-slate-900 border-2 border-amber-500/80 rounded-[2rem] max-w-lg w-full overflow-hidden shadow-[0_0_50px_rgba(245,158,11,0.25)] text-white relative flex flex-col">
            
            {/* Top scanning radar animation */}
            <div className="h-28 bg-gradient-to-b from-amber-500/20 to-transparent relative flex items-center justify-center overflow-hidden border-b border-slate-800">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 rounded-full border border-amber-500/30 animate-ping absolute" style={{ animationDuration: '3s' }} />
                <div className="w-12 h-12 rounded-full border border-amber-500/50 animate-ping absolute" style={{ animationDuration: '1.5s' }} />
                <div className="w-6 h-6 rounded-full bg-amber-500 animate-pulse flex items-center justify-center">
                  <Activity size={12} className="text-slate-950" />
                </div>
              </div>
              <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-[8px] font-black tracking-widest uppercase text-amber-400">TELEMETRIA LIVE</span>
              </div>
              <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-full border border-slate-800">
                <span className="text-[8px] font-mono font-bold tracking-widest uppercase text-slate-400">UNITEL 4G LUENA</span>
              </div>
              <div className="mt-12 text-center z-10">
                <h4 className="text-xs font-black tracking-widest uppercase text-amber-500">Deteção de Chamada Entrante</h4>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Central Luena-Moxico • Receptor GSM Activo</p>
              </div>
            </div>

            {/* Caller metadata details panel */}
            <div className="p-6 space-y-4">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[8px] font-bold uppercase text-slate-500 tracking-wider">Cliente/Origem</span>
                  <h3 className="text-lg font-black text-white leading-tight">{incomingTelemetryCall.name}</h3>
                  <p className="text-xs font-mono font-bold text-slate-400 tracking-wide mt-0.5">{incomingTelemetryCall.phone}</p>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl text-center">
                  <span className="text-[8px] font-black uppercase text-amber-400 block tracking-wider">Rede</span>
                  <span className="text-xs font-black text-amber-500 font-mono">{incomingTelemetryCall.network}</span>
                </div>
              </div>

              {/* Technical signal & triangulation telemetry */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-950/50 p-3.5 rounded-xl border border-slate-800/60">
                  <span className="text-[8.5px] font-bold uppercase text-slate-500 tracking-wider block">ID Célula (BST)</span>
                  <span className="text-xs font-mono font-bold text-slate-300 block mt-1">{incomingTelemetryCall.cellId}</span>
                </div>
                <div className="bg-slate-950/50 p-3.5 rounded-xl border border-slate-800/60">
                  <span className="text-[8.5px] font-bold uppercase text-slate-500 tracking-wider block">Sinal GSM (RSSI)</span>
                  <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1 mt-1">
                    <Activity size={11} className="animate-pulse" />
                    {incomingTelemetryCall.strength} (Forte)
                  </span>
                </div>
              </div>

              <div className="bg-slate-950/30 p-3.5 rounded-xl border border-slate-850/60 flex items-start gap-3">
                <div className="p-1.5 bg-slate-900 rounded-lg text-amber-400 shrink-0 mt-0.5">
                  <MapPin size={14} />
                </div>
                <div>
                  <span className="text-[8.5px] font-bold uppercase text-slate-500 tracking-wider block">Estimativa de Triangulação</span>
                  <span className="text-xs font-bold text-slate-200 block mt-0.5">{incomingTelemetryCall.area}</span>
                  <span className="text-[9px] text-slate-500 block mt-0.5 font-mono">Setor 1A • Lat: -11.782, Lon: 19.914</span>
                </div>
              </div>
            </div>

            {/* Tactical action buttons */}
            <div className="p-6 bg-slate-950/40 border-t border-slate-850 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => {
                  const caller = incomingTelemetryCall;
                  setIsPhoneModalOpen(true);
                  setSelectedDriverForCall({
                    name: caller.name,
                    phone: caller.phone,
                    type: 'Cliente',
                    initial: caller.name[0],
                    isDriver: false
                  });
                  setCallStatus('active');
                  setCallTimer(0);
                  setIncomingTelemetryCall(null);
                  showCustomToast(`Ligação estabelecida com ${caller.name}!`, 'success');
                }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] transition-all rounded-xl font-black text-xs uppercase tracking-widest text-white shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Phone size={14} className="animate-bounce" />
                Atender & Despachar Rádio
              </button>

              <button
                type="button"
                onClick={() => {
                  const caller = incomingTelemetryCall;
                  // Auto-dispatch nearest vehicle (e.g. Augusto T-04)
                  const textMsg = `🚨 TELEMETRIA AUTOMÁTICA: Chamada Unitel de ${caller.name} no ${caller.area} processada com sucesso. Viatura mais próxima (Augusto Silva - T-04) enviada em missão rápida.`;
                  
                  // Save in Firestore for multi-operator sync
                  try {
                    addDoc(collection(db, 'whatsapp_messages'), {
                      sender: 'Central Auto-Pilot',
                      phone: 'SISTEMA',
                      text: textMsg,
                      timestamp: new Date().toISOString(),
                      type: 'alert',
                      isOperational: true,
                      status: 'dispatched',
                      channel: 'clients'
                    });
                  } catch (err) {
                    console.warn("Erro ao salvar mensagem no Firestore:", err);
                  }

                  // Also append locally to ensure immediate reactivity
                  const localMsg = {
                    id: `sys-${Date.now()}`,
                    sender: 'Central Auto-Pilot',
                    phone: 'SISTEMA',
                    text: textMsg,
                    timestamp: new Date(),
                    type: 'alert' as const,
                    isOperational: true,
                    status: 'dispatched' as const
                  };
                  setClientMessages(prev => [...prev, localMsg]);
                  setIncomingTelemetryCall(null);
                  showCustomToast(`Piloto Automático: Augusto Silva (T-04) enviado para ${caller.name}!`, 'success');
                }}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 active:scale-[0.98] transition-all rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-amber-900/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Zap size={14} />
                Despachar Táxi Mais Próximo
              </button>

              <button
                type="button"
                onClick={() => setIncomingTelemetryCall(null)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700/80 active:scale-[0.98] transition-all rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-300 flex items-center justify-center gap-2 cursor-pointer"
              >
                Silenciar Alerta
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 📡 OVERLAY DE FORÇAR SINCRONIZAÇÃO GSM                    */}
      {/* ========================================================= */}
      {isSyncingGsm && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-sm w-full text-center shadow-2xl">
            <Loader2 size={36} className="text-emerald-500 animate-spin mx-auto mb-4" />
            <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-tighter text-sm">Sincronização de Logs GSM</h4>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wide mt-1 italic">Central Luena-Moxico • PSM Hub</p>
            <div className="w-full bg-slate-100 dark:bg-slate-950 h-2 rounded-full mt-4 overflow-hidden border border-slate-200/50 dark:border-slate-850">
              <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${syncProgress}%` }} />
            </div>
            <div className="flex justify-between items-center text-[9px] font-black uppercase text-slate-400 mt-2">
              <span>Progresso</span>
              <span className="text-emerald-500">{syncProgress}%</span>
            </div>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-3 animate-pulse leading-relaxed">{syncStatusText}</p>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 🔔 SISTEMA DE TOAST NOTIFICATION (FLUTUANTE)              */}
      {/* ========================================================= */}
      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 dark:bg-slate-850 text-white border border-slate-800/60 px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 z-[110] animate-in fade-in slide-in-from-bottom-3 duration-200 max-w-[90%]">
          <div className={cn(
            "w-2.5 h-2.5 rounded-full shrink-0",
            toast.type === 'success' ? 'bg-emerald-500 animate-pulse' : toast.type === 'error' ? 'bg-rose-500' : 'bg-blue-500'
          )} />
          <span className="text-xs font-black tracking-wide uppercase text-slate-100 leading-none">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
