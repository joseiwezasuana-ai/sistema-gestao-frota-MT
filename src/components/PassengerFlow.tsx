import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { motion, AnimatePresence } from 'motion/react';
import useSWR from 'swr';
import { useTheme } from '../context/ThemeContext';
import { 
  Car, MapPin, Phone, User, Users, Camera, Sun, Moon, Sparkles, ShieldCheck, 
  MapPinCheck, Navigation, PhoneCall, PhoneOff, Check, X, CheckCircle, 
  Trash2, Landmark, Trophy, Smartphone, AlertCircle, RefreshCw, Lock, AlertOctagon,
  Wifi, ArrowRight, ShieldAlert, MessageSquare, Compass, Gift, MoreVertical, QrCode, Copy, Upload, Download,
  ThumbsUp, ThumbsDown, Clock, CheckCircle2, MessageCircle, Share2, Tag, LogOut
} from 'lucide-react';
import { cn } from '../lib/utils';
import { PWAInstallModal } from './PWAInstallBanner';
import { WebRTCAudioCall } from './WebRTCAudioCall';
import { db, getActiveTenantId, setActiveTenantId, addDoc, collection, getDocs, onSnapshot, query, where, doc, setDoc, getDoc, updateDoc, arrayUnion, limit, deleteDoc } from '../lib/firebase';
import { requestPassengerFcmToken, listenToFcmForegroundMessages } from '../lib/fcmService';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon issues with Vite
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Recenter helper for Leaflet Map
function RecenterMap({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  React.useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

const PROVINCE_COORDINATES: Record<string, [number, number]> = {
  'moxico': [-11.7833, 19.9167],
  'luena': [-11.7833, 19.9167],
  'luanda': [-8.8368, 13.2331],
  'benguela': [-12.5763, 13.4055],
  'huambo': [-12.7761, 15.7313],
  'cabinda': [-5.5500, 12.2000],
  'huila': [-14.9211, 13.4925],
  'huíla': [-14.9211, 13.4925],
  'namibe': [-15.1961, 12.1522],
  'cunene': [-17.0667, 15.7333],
  'cuando cubango': [-14.6583, 17.6833],
  'lunda norte': [-8.3000, 20.5000],
  'lunda sul': [-9.6667, 20.4000],
  'bengo': [-8.5833, 13.6667],
  'zaire': [-6.2667, 14.2333],
  'bié': [-12.3833, 16.9333],
  'malanje': [-9.5402, 16.3478],
  'uige': [-7.6186, 15.0617],
  'uíge': [-7.6186, 15.0617],
  'kwanza norte': [-9.3000, 14.9000],
  'kwanza sul': [-11.1961, 15.0117],
};

/**
 * Calcula a distância em quilômetros entre dois pontos usando a fórmula de Haversine.
 */
export function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Raio da Terra em km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distância em km
}

/**
 * Obtém as coordenadas de uma companhia específica ou da sua província correspondente.
 */
export function getCompanyCoordinates(comp: any): [number, number] {
  if (!comp) return [-11.7833, 19.9167];
  
  if (typeof comp.lat === 'number' && typeof comp.lng === 'number') {
    return [comp.lat, comp.lng];
  }
  if (typeof comp.latitude === 'number' && typeof comp.longitude === 'number') {
    return [comp.latitude, comp.longitude];
  }
  
  if (comp.province) {
    const provKey = comp.province.trim().toLowerCase();
    for (const [key, coords] of Object.entries(PROVINCE_COORDINATES)) {
      if (provKey.includes(key) || key.includes(provKey)) {
        return coords;
      }
    }
  }
  
  return [-11.7833, 19.9167];
}

/**
 * Hook para comparar a localização real do utilizador com a central da companhia e avisar se exceder 5km.
 */
export function useCompanyDistanceAlert(
  actualGpsCoords: [number, number] | null,
  activeCompany: any
) {
  const [distanceAlert, setDistanceAlert] = useState<{ show: boolean; distance: number; msg: string } | null>(null);

  useEffect(() => {
    if (!actualGpsCoords || !activeCompany) {
      setDistanceAlert(null);
      return;
    }

    const companyCoords = getCompanyCoordinates(activeCompany);
    const dist = calculateHaversineDistance(
      actualGpsCoords[0],
      actualGpsCoords[1],
      companyCoords[0],
      companyCoords[1]
    );

    if (dist > 5) {
      setDistanceAlert({
        show: true,
        distance: dist,
        msg: `Aviso de Cobertura: A sua localização real está a ${dist.toFixed(1)} km da central de "${activeCompany.name}". Excedeu o raio de cobertura de 5 km!`
      });
    } else {
      setDistanceAlert(null);
    }
  }, [actualGpsCoords, activeCompany]);

  return distanceAlert;
}

// Custom distinct Leaflet icons using divIcon with Tailwind classes
const passengerIcon = L.divIcon({
  className: 'custom-gps-marker-container',
  html: `
    <div class="relative flex items-center justify-center w-8 h-8">
      <div class="absolute w-7 h-7 bg-blue-500/35 rounded-full animate-ping"></div>
      <div class="w-4.5 h-4.5 bg-blue-600 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
        <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
      </div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const driverIconAvailable = L.divIcon({
  className: 'custom-driver-available-container',
  html: `
    <div class="relative flex items-center justify-center w-10 h-10">
      <div class="absolute w-9 h-9 bg-emerald-500/20 rounded-full animate-pulse"></div>
      <div class="w-7 h-7 bg-amber-400 text-slate-950 rounded-full border-2 border-slate-950 shadow-lg flex items-center justify-center text-xs select-none">
        🚕
      </div>
    </div>
  `,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

const driverIconAssigned = L.divIcon({
  className: 'custom-driver-assigned-container',
  html: `
    <div class="relative flex items-center justify-center w-12 h-12">
      <div class="absolute w-11 h-11 bg-amber-500/35 rounded-full animate-ping"></div>
      <div class="w-8.5 h-8.5 bg-amber-500 text-slate-950 rounded-full border-2 border-slate-950 shadow-xl flex items-center justify-center text-sm font-black select-none">
        🚕
      </div>
    </div>
  `,
  iconSize: [48, 48],
  iconAnchor: [24, 24],
});

interface VehicleOption {
  id: string;
  plate: string;
  driverName: string;
  phone: string;
  model: string;
  prefix?: string;
  driverId?: string;
  lat?: number;
  lng?: number;
}

// 4 custom preset themes for the Passenger Smart App to fulfill "alterar temas de sua preferência"
type PassengerTheme = 'gold' | 'blue' | 'cyberpunk' | 'emerald';

interface PresetTheme {
  name: string;
  bgClass: string;
  cardClass: string;
  textClass: string;
  btnClass: string;
  accentColor: string;
  borderClass: string;
}

const PALETTES: Record<PassengerTheme, PresetTheme> = {
  gold: {
    name: 'Pôr-do-Sol Dourado (SUPER Táxi)',
    bgClass: 'bg-slate-950 text-white',
    cardClass: 'bg-slate-900 border border-amber-500/20',
    textClass: 'text-amber-400',
    btnClass: 'bg-amber-500 hover:bg-amber-600 text-slate-950',
    accentColor: '#f59e0b',
    borderClass: 'border-amber-500'
  },
  blue: {
    name: 'Brisa Oceânica (Corporativo)',
    bgClass: 'bg-[#0f172a] text-white',
    cardClass: 'bg-slate-900 border border-blue-500/20',
    textClass: 'text-blue-400',
    btnClass: 'bg-blue-600 hover:bg-blue-700 text-white',
    accentColor: '#3b82f6',
    borderClass: 'border-blue-500'
  },
  cyberpunk: {
    name: 'Cyber Neon (Tecnologia Moxico)',
    bgClass: 'bg-neutral-950 text-white',
    cardClass: 'bg-neutral-900 border border-fuchsia-500/20',
    textClass: 'text-fuchsia-400',
    btnClass: 'bg-fuchsia-600 hover:bg-fuchsia-700 text-white shadow-lg shadow-fuchsia-600/25',
    accentColor: '#d946ef',
    borderClass: 'border-fuchsia-500'
  },
  emerald: {
    name: 'Esmeralda Clássica (Prestigio)',
    bgClass: 'bg-zinc-950 text-white',
    cardClass: 'bg-zinc-900 border border-emerald-500/20',
    textClass: 'text-emerald-400',
    btnClass: 'bg-[#10b981] hover:bg-emerald-600 text-slate-950 font-extrabold',
    accentColor: '#10b981',
    borderClass: 'border-[#10b981]'
  }
};

const PRESETS_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80"
];

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
    md: "w-10 h-10 text-xs rounded-full",
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
        className={`${sizeClasses[size]} object-cover border border-white/20 shrink-0`}
      />
    );
  }

  return (
    <div className={`${sizeClasses[size]} flex items-center justify-center font-black uppercase tracking-tight border shrink-0 ${getStableBg(name || "P")}`}>
      {initials || "P"}
    </div>
  );
}

interface ETACountdownProps {
  driverEtaResponse: string;
  driverEtaResponseAt?: string | null;
  onCountdownEnd: () => void;
}

function ETACountdown({ driverEtaResponse, driverEtaResponseAt, onCountdownEnd }: ETACountdownProps) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!driverEtaResponse) {
      setTimeLeft('');
      setSecondsRemaining(null);
      return;
    }

    // Se o motorista informou que já está no local
    if (driverEtaResponse.toLowerCase().includes('local') || driverEtaResponse.toLowerCase().includes('chegou')) {
      setTimeLeft('No Local');
      setSecondsRemaining(0);
      onCountdownEnd();
      return;
    }

    // Extrair os minutos (ex: "5 min" -> 5)
    const minutesMatch = driverEtaResponse.match(/\d+/);
    if (!minutesMatch) {
      setTimeLeft(driverEtaResponse);
      setSecondsRemaining(null);
      return;
    }

    const minutes = parseInt(minutesMatch[0], 10);
    const totalDurationSeconds = minutes * 60;

    // Usar o timestamp de criação da resposta do motorista
    const startTime = driverEtaResponseAt ? new Date(driverEtaResponseAt).getTime() : Date.now();

    const updateTimer = () => {
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, totalDurationSeconds - elapsedSeconds);
      setSecondsRemaining(remaining);

      if (remaining <= 0) {
        setTimeLeft('Tempo esgotado! Motorista a chegar.');
        onCountdownEnd();
      } else {
        const m = Math.floor(remaining / 60);
        const s = remaining % 60;
        setTimeLeft(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [driverEtaResponse, driverEtaResponseAt, onCountdownEnd]);

  if (secondsRemaining !== null && secondsRemaining > 0) {
    return (
      <div className="flex flex-col">
        <p className="text-[9px] font-black uppercase text-emerald-400 tracking-wider">
          ⏳ Contagem Regressiva em Tempo Real:
        </p>
        <p className="text-xl font-black text-emerald-300 font-mono tracking-widest mt-0.5 animate-pulse">
          {timeLeft}
        </p>
        <p className="text-[8.5px] text-slate-400 mt-0.5">
          O motorista informou: {driverEtaResponse}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <p className="text-[9px] font-black uppercase text-amber-400 tracking-wider">
        📍 Previsão de Chegada:
      </p>
      <p className="text-sm font-black text-white mt-0.5 leading-snug">
        {timeLeft || driverEtaResponse}
      </p>
    </div>
  );
}

export default function PassengerFlow({ isPublicApp = false, isEmbed = false, onBackToStaff }: { isPublicApp?: boolean; isEmbed?: boolean; onBackToStaff?: () => void }) {
  const [activePalette, setActivePalette] = useState<PassengerTheme>(() => {
    return (localStorage.getItem('psm-passenger-theme') as PassengerTheme) || 'gold';
  });

  const [hasClickedTheme, setHasClickedTheme] = useState(() => {
    return localStorage.getItem('psm-passenger-theme-clicked') === 'true';
  });

  // Dynamically loaded config from back-office Settings (with fallback parameters for Luena / AOA)
  const [appConfig, setAppConfig] = useState<any>({
    enabled: true,
    bookingEnabled: true,
    historyEnabled: true,
    supportChatEnabled: true,
    panicSosEnabled: true,
    fareEstimateEnabled: true,
    driverRatingEnabled: true,
    routeSharingEnabled: true,
    bonusClubEnabled: true,
    bonusClubCashbackPercent: 5,
    webrtcEnabled: true,
    searchRadiusKm: 15,
    driverWaitTimeSec: 90,
    baseFareKz: 500,
    perKmFareKz: 250,
    supportPhone: '+244999123456',
    primaryColor: '#eab308', // Amber/Yellow
    customWelcomeMsg: 'Bem-vindo ao SUPER Taxi! Para onde vamos hoje?',
    darkModeByDefault: false,
  });

  const [isConfigLoaded, setIsConfigLoaded] = useState(false);

  useEffect(() => {
    const configDocRef = doc(db, 'settings', 'passenger_app');
    const unsub = onSnapshot(configDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setAppConfig({
          enabled: data.enabled !== false,
          bookingEnabled: data.bookingEnabled !== false,
          historyEnabled: data.historyEnabled !== false,
          supportChatEnabled: data.supportChatEnabled !== false,
          panicSosEnabled: data.panicSosEnabled !== false,
          fareEstimateEnabled: data.fareEstimateEnabled !== false,
          driverRatingEnabled: data.driverRatingEnabled !== false,
          routeSharingEnabled: data.routeSharingEnabled !== false,
          bonusClubEnabled: data.bonusClubEnabled !== false,
          bonusClubCashbackPercent: data.bonusClubCashbackPercent || 5,
          webrtcEnabled: data.webrtcEnabled !== false,
          searchRadiusKm: data.searchRadiusKm || 15,
          driverWaitTimeSec: data.driverWaitTimeSec || 90,
          baseFareKz: data.baseFareKz || 500,
          perKmFareKz: data.perKmFareKz || 250,
          supportPhone: data.supportPhone || '+244999123456',
          primaryColor: data.primaryColor || '#eab308',
          customWelcomeMsg: data.customWelcomeMsg || 'Bem-vindo ao SUPER Taxi! Para onde vamos hoje?',
          darkModeByDefault: data.darkModeByDefault || false,
        });
        setIsConfigLoaded(true);
      } else {
        setIsConfigLoaded(true);
      }
    }, (err) => {
      console.warn("Erro ao carregar configurações do DB:", err);
      setIsConfigLoaded(true);
    });
    return () => unsub();
  }, []);

  const isDark = appConfig?.darkModeByDefault !== false;
  const primaryHex = (appConfig?.primaryColor && !hasClickedTheme) ? appConfig.primaryColor : PALETTES[activePalette].accentColor;

  const getDynamicTheme = () => {
    let textClass = PALETTES[activePalette].textClass;
    let btnClass = PALETTES[activePalette].btnClass;
    let borderClass = PALETTES[activePalette].borderClass;
    let accentColor = PALETTES[activePalette].accentColor;

    if (appConfig?.primaryColor && !hasClickedTheme) {
      const hex = appConfig.primaryColor;
      accentColor = hex;
      if (hex === '#0d6efd') { // Blue
        textClass = isDark ? 'text-blue-400' : 'text-blue-600';
        btnClass = 'bg-blue-600 hover:bg-blue-700 text-white';
        borderClass = isDark ? 'border-blue-500' : 'border-blue-400';
      } else if (hex === '#10b981') { // Emerald
        textClass = isDark ? 'text-emerald-400' : 'text-emerald-600';
        btnClass = 'bg-emerald-600 hover:bg-emerald-700 text-white';
        borderClass = isDark ? 'border-emerald-500 font-extrabold' : 'border-emerald-400 font-extrabold';
      } else if (hex === '#f97316') { // Orange
        textClass = isDark ? 'text-orange-400' : 'text-orange-600';
        btnClass = 'bg-orange-500 hover:bg-orange-600 text-white';
        borderClass = isDark ? 'border-orange-500' : 'border-orange-400';
      } else if (hex === '#f43f5e') { // Rose
        textClass = isDark ? 'text-rose-400' : 'text-rose-600';
        btnClass = 'bg-rose-500 hover:bg-rose-600 text-white';
        borderClass = isDark ? 'border-rose-500' : 'border-rose-400';
      } else if (hex === '#eab308') { // Amber
        textClass = isDark ? 'text-amber-400' : 'text-amber-600';
        btnClass = 'bg-amber-500 hover:bg-amber-600 text-slate-950';
        borderClass = isDark ? 'border-amber-500' : 'border-amber-400';
      } else if (hex === '#6366f1') { // Indigo
        textClass = isDark ? 'text-indigo-400' : 'text-indigo-600';
        btnClass = 'bg-indigo-600 hover:bg-indigo-700 text-white';
        borderClass = isDark ? 'border-indigo-500' : 'border-indigo-400';
      }
    }

    const bgClass = isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900';
    const cardClass = isDark 
      ? 'bg-slate-900 border border-white/5 text-slate-100' 
      : 'bg-white border border-slate-200 shadow-sm text-slate-800';

    return {
      name: PALETTES[activePalette].name,
      bgClass,
      cardClass,
      textClass,
      btnClass,
      accentColor,
      borderClass
    };
  };

  const currentTheme = getDynamicTheme();

  const handlePaletteChange = (pal: PassengerTheme) => {
    setActivePalette(pal);
    setHasClickedTheme(true);
    localStorage.setItem('psm-passenger-theme', pal);
    localStorage.setItem('psm-passenger-theme-clicked', 'true');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passengerProfile) return;
    setIsSavingProfile(true);
    setSaveSuccessMsg('');
    try {
      const updated = {
        ...passengerProfile,
        name: editName.trim(),
        province: editProvince,
        backupPhone: editBackupPhone.trim(),
        age: editAge,
        gender: editGender
      };

      // 1. Save to local state and localStorage
      setPassengerProfile(updated);
      localStorage.setItem('psm-passenger-profile', JSON.stringify(updated));

      // 2. Persist to Firestore
      if (passengerProfile.id) {
        await updateDoc(doc(db, 'passengers', passengerProfile.id), {
          name: editName.trim(),
          province: editProvince,
          backupPhone: editBackupPhone.trim(),
          age: editAge,
          gender: editGender
        });
      } else {
        // Fallback search by name
        const q = query(collection(db, 'passengers'), where('name', '==', passengerProfile.name));
        const snap = await getDocs(q);
        if (!snap.empty) {
          await updateDoc(doc(db, 'passengers', snap.docs[0].id), {
            name: editName.trim(),
            province: editProvince,
            backupPhone: editBackupPhone.trim(),
            age: editAge,
            gender: editGender
          });
        }
      }

      setSaveSuccessMsg('Perfil atualizado com sucesso!');
      setTimeout(() => setSaveSuccessMsg(''), 3000);
    } catch (err) {
      console.error("Erro ao salvar perfil:", err);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Passenger Logged-in State
  const [passengerProfile, setPassengerProfile] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('psm-passenger-profile');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Profile edit fields and states
  const [editName, setEditName] = useState('');
  const [editProvince, setEditProvince] = useState('Luena, Moxico');
  const [editBackupPhone, setEditBackupPhone] = useState('');
  const [editAge, setEditAge] = useState('');
  const [editGender, setEditGender] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  useEffect(() => {
    if (passengerProfile) {
      setEditName(passengerProfile.name || '');
      setEditProvince(passengerProfile.province || 'Luena, Moxico');
      setEditBackupPhone(passengerProfile.backupPhone || '');
      setEditAge(passengerProfile.age || '');
      setEditGender(passengerProfile.gender || '');
    }
  }, [passengerProfile]);

  useEffect(() => {
    if (passengerProfile && isConfigLoaded && !hasWelcomedRef.current) {
      hasWelcomedRef.current = true;
      setTimeout(() => {
        triggerBonusClubNotification(passengerProfile.name);
      }, 1200);
    }
  }, [passengerProfile, isConfigLoaded]);

  // Form Inputs
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [backupPhone, setBackupPhone] = useState('');
  const [province, setProvince] = useState('Luena, Moxico');
  const [password, setPassword] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(() => {
    try {
      const saved = localStorage.getItem('psm-passenger-profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.photoUrl || PRESETS_AVATARS[0];
      }
    } catch {}
    return PRESETS_AVATARS[0];
  });
  const [isUploading, setIsUploading] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [authPortalView, setAuthPortalView] = useState<'welcome' | 'form'>('welcome');
  const [loginName, setLoginName] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Active Booking state
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [useBonusForRide, setUseBonusForRide] = useState(false);
  const [showVehicleSelect, setShowVehicleSelect] = useState(false);
  const [showVehicleSelectModal, setShowVehicleSelectModal] = useState(false);

  useEffect(() => {
    if (!isBookModalOpen) {
      setShowVehicleSelect(false);
      setShowVehicleSelectModal(false);
    }
  }, [isBookModalOpen]);
  
  // Terms & Conditions and Safety Policies for Registration (JIS)
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showInstallPwaModal, setShowInstallPwaModal] = useState(false);
  const [showApkDownloadModal, setShowApkDownloadModal] = useState(false);
  const [passengerApkQrUrl, setPassengerApkQrUrl] = useState<string>('');
  const [apkConfig, setApkConfig] = useState<any>({
    version: '6.0.0',
    releaseDate: '2026-08-10',
    passengerAppUrl: 'https://github.com/joseiwezasuana-ai/sistema-gestao-frota-MT/releases/download/v6.0.0/supertaxi-passenger-v6.0.0.apk',
    passengerAppSize: '16.8 MB'
  });

  useEffect(() => {
    const unsubApk = onSnapshot(doc(db, 'settings', 'apk_distribution'), (snap) => {
      if (snap.exists()) {
        setApkConfig(snap.data());
      }
    }, (err) => console.warn("APK config sync error:", err));
    return () => unsubApk();
  }, []);

  useEffect(() => {
    if (showApkDownloadModal) {
      const rawUrl = apkConfig.passengerAppUrl || 'https://github.com/joseiwezasuana-ai/sistema-gestao-frota-MT/releases/download/v6.0.0/supertaxi-passenger-v6.0.0.apk';
      const fullDownloadUrl = rawUrl.startsWith('http') 
        ? rawUrl 
        : `${window.location.origin}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
      
      QRCode.toDataURL(fullDownloadUrl, {
        width: 280,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' }
      })
        .then(url => setPassengerApkQrUrl(url))
        .catch(() => setPassengerApkQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(fullDownloadUrl)}`));
    }
  }, [showApkDownloadModal, apkConfig.passengerAppUrl]);

  // Observer Pattern state & ref for Registration Form Scroll End Detection
  const [isFormEndVisible, setIsFormEndVisible] = useState(false);
  const formBottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (authMode !== 'register' || passengerProfile) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setIsFormEndVisible(true);
        } else {
          setIsFormEndVisible(false);
        }
      },
      {
        root: null,
        threshold: 0.1
      }
    );

    if (formBottomRef.current) {
      observer.observe(formBottomRef.current);
    }

    return () => {
      if (formBottomRef.current) {
        observer.unobserve(formBottomRef.current);
      }
    };
  }, [authMode, passengerProfile, authPortalView]);
  
  // New States requested by José Iweza Suana (JIS)
  const [showRidesHistoryModal, setShowRidesHistoryModal] = useState(false);
  const [showProfilePicModal, setShowProfilePicModal] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isNavMenuOpen, setIsNavMenuOpen] = useState(false);
  const [showComplaintsModal, setShowComplaintsModal] = useState(false);
  const navMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isNavMenuOpen && navMenuRef.current && !navMenuRef.current.contains(event.target as Node)) {
        setIsNavMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNavMenuOpen]);
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // States for Refusal Reason, Discount Proposal & ETA Questions
  const [showRefusalModal, setShowRefusalModal] = useState(false);
  const [refusalReasonOption, setRefusalReasonOption] = useState<string>('Preço Demasiado Alto');
  const [customDiscountPrice, setCustomDiscountPrice] = useState<string>('');
  const [isSubmittingDiscount, setIsSubmittingDiscount] = useState(false);
  const [selectedEtaQuestion, setSelectedEtaQuestion] = useState<string>('');
  const [isSubmittingEtaQuestion, setIsSubmittingEtaQuestion] = useState(false);
  const [etaSentMsg, setEtaSentMsg] = useState<string>('');
  const [isEtaExpired, setIsEtaExpired] = useState<boolean>(false);
  
  // Custom states for complaint submission and tracking
  const [complaintType, setComplaintType] = useState('excesso_velocidade');
  const [complaintText, setComplaintText] = useState('');
  const [complaintVehicle, setComplaintVehicle] = useState('');
  const [isSubmittingComplaint, setIsSubmittingComplaint] = useState(false);
  const [complaintSuccessMsg, setComplaintSuccessMsg] = useState('');
  const [complaintModalTab, setComplaintModalTab] = useState<'my_complaints' | 'new_complaint'>('my_complaints');
  const [passengerComplaints, setPassengerComplaints] = useState<any[]>([]);
  const [satisfactionComments, setSatisfactionComments] = useState<Record<string, string>>({});
  const [submittingSatisfactionId, setSubmittingSatisfactionId] = useState<string | null>(null);
  const [editingSatisfactionId, setEditingSatisfactionId] = useState<string | null>(null);

  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [passengerCount, setPassengerCount] = useState<number>(1);
  const [availableVehicles, setAvailableVehicles] = useState<VehicleOption[]>([]);
  const [isLoadingFleet, setIsLoadingFleet] = useState(false);

  // Real-time GPS location state for exact passenger coordinates
  const [passengerCoords, setPassengerCoords] = useState<[number, number]>([-11.784422, 20.067332]);
  const [isGpsExact, setIsGpsExact] = useState(false);
  const [locationAlert, setLocationAlert] = useState<{ show: boolean; msg: string } | null>(null);
  
  // Real raw GPS coordinates of the device (unprojected)
  const [actualDeviceCoords, setActualDeviceCoords] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          let lat = position.coords.latitude;
          let lng = position.coords.longitude;
          if (lat && lng) {
            // Guardar a localização física real obtida para monitoramento de distância (Haversine)
            setActualDeviceCoords([lat, lng]);
            
            // Se a localização estiver fora da área operacional do Luena (e.g. Lubango), projetamos no Luena
            if (Math.abs(lat - (-11.7833)) > 0.8 || Math.abs(lng - 19.9167) > 0.8) {
              // Projetar no centro do Luena com um pequeno desvio aleatório controlado para dispersar os pedidos
              lat = -11.7833 + (Math.random() - 0.5) * 0.015;
              lng = 19.9167 + (Math.random() - 0.5) * 0.015;
              console.log(`[GPS Projection] Passageiro fora de Luena detetado (${position.coords.latitude}, ${position.coords.longitude}). Projetando para Luena: ${lat}, ${lng}`);
            }
            setPassengerCoords([lat, lng]);
            setIsGpsExact(true);
            console.log("GPS exato obtido com sucesso para o Passageiro:", lat, lng);
          }
        },
        (error) => {
          console.warn("Permissão de GPS negada ou indisponível no iFrame/Browser. Usando centro de Luena:", error);
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
      );
    }
  }, []);

  const pullCurrentLocation = () => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          let lat = position.coords.latitude;
          let lng = position.coords.longitude;
          if (lat && lng) {
            // Guardar a localização física real manual para cálculo de distância Haversine
            setActualDeviceCoords([lat, lng]);
            
            if (Math.abs(lat - (-11.7833)) > 0.8 || Math.abs(lng - 19.9167) > 0.8) {
              lat = -11.7833 + (Math.random() - 0.5) * 0.015;
              lng = 19.9167 + (Math.random() - 0.5) * 0.015;
            }
            setPassengerCoords([lat, lng]);
            setIsGpsExact(true);
            console.log("GPS exato obtido com sucesso pelo utilizador manualmente:", lat, lng);
          }
        },
        (error) => {
          console.warn("Permissão de GPS indisponível no momento:", error);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  };

const validateRideTransactionId = (callId: string | null | undefined): boolean => {
  if (!callId) return false;
  const clean = String(callId).trim();
  if (!clean || clean.length < 5 || clean.length > 120) return false;
  if (['undefined', 'null', 'none', '[object object]', 'false', 'true', '<id>'].includes(clean.toLowerCase())) return false;
  const validIdPattern = /^[a-zA-Z0-9_\-]+$/;
  return validIdPattern.test(clean);
};

  const getPassengerShareUrl = () => {
    const callId = activeRideRecord?.id;
    const isIdValid = validateRideTransactionId(callId);
    const callParam = isIdValid ? `&callId=${encodeURIComponent(callId!)}` : '';
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}/?view=passenger${callParam}`;
    }
    return `https://jis-st.web.app/?view=passenger${callParam}`;
  };

  const copyShareLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(getPassengerShareUrl());
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // Selected company / tenant states
  const [companies, setCompanies] = useState<any[]>([]);
  const [activeTenant, setActiveTenant] = useState<string>(() => getActiveTenantId());
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [dismissedDistanceAlert, setDismissedDistanceAlert] = useState(false);
  const [dismissedLocationAlert, setDismissedLocationAlert] = useState(false);

  useEffect(() => {
    setDismissedDistanceAlert(false);
    setDismissedLocationAlert(false);
  }, [activeTenant]);

  const activeCompany = companies.find(c => c.id === activeTenant);
  const distanceAlert = useCompanyDistanceAlert(actualDeviceCoords, activeCompany);
  const activeWhatsappLink = activeCompany?.whatsappGroupCustomers || activeCompany?.whatsappGroupLink || activeCompany?.whatsappLink || (appConfig?.supportPhone ? `https://wa.me/${(appConfig?.supportPhone || '').replace(/\D/g, '')}` : "https://wa.me/244923456789");
  const activeWhatsappGroupLink = activeCompany?.whatsappGroupCustomers || activeCompany?.whatsappGroupLink || "";

  // Dynamic map re-centering and warning alert based on company registration and passenger location
  useEffect(() => {
    if (!activeTenant || companies.length === 0) {
      setLocationAlert(null);
      return;
    }

    const comp = companies.find(c => c.id === activeTenant);
    if (!comp) {
      setLocationAlert(null);
      return;
    }

    // Determine the coordinates of the company's province
    let provinceCoords: [number, number] | null = null;
    if (comp.province) {
      const provKey = comp.province.trim().toLowerCase();
      for (const [key, coords] of Object.entries(PROVINCE_COORDINATES)) {
        if (provKey.includes(key) || key.includes(provKey)) {
          provinceCoords = coords;
          break;
        }
      }
    }

    // If we don't have an exact GPS location, or if the passenger is far from this company's operational province,
    // we center the map on the company's province central coordinates with a small random offset.
    if (provinceCoords) {
      if (!isGpsExact) {
        // Recenter to company province with minor jitter
        const lat = provinceCoords[0] + (Math.random() - 0.5) * 0.005;
        const lng = provinceCoords[1] + (Math.random() - 0.5) * 0.005;
        setPassengerCoords([lat, lng]);
        console.log(`[Company Centering] Centering map on company province (${comp.province}): ${lat}, ${lng}`);
      }
    }

    // Check location mismatch warning
    if (passengerProfile && passengerProfile.province && comp.province) {
      const passProv = passengerProfile.province.trim().toLowerCase();
      const compProv = comp.province.trim().toLowerCase();

      // If provinces don't match, trigger location warning
      if (!passProv.includes(compProv) && !compProv.includes(passProv)) {
        setLocationAlert({
          show: true,
          msg: `Aviso de Localização: A sua localização atual é na província de "${passengerProfile.province}", mas a companhia "${comp.name}" que selecionou opera na província de "${comp.province}". Poderá estar fora da área de serviço!`
        });
        return;
      }
    }
    
    setLocationAlert(null);
  }, [activeTenant, companies, passengerProfile, isGpsExact]);

  // Call Sequence states
  // 'idle' | 'calling' | 'connected' | 'pricing' | 'offer_received' | 'ride_confirmed' | 'ride_completed' | 'cancelled_by_driver' | 'price_negotiation_requested'
  const [callState, setCallState] = useState<'idle' | 'calling' | 'connected' | 'pricing' | 'offer_received' | 'ride_confirmed' | 'ride_completed' | 'cancelled_by_driver' | 'price_negotiation_requested'>('idle');
  const [isCallMinimized, setIsCallMinimized] = useState<boolean>(false);
  const [negotiatedPrice, setNegotiatedPrice] = useState<number>(0);
  const [passengerRating, setPassengerRating] = useState<number>(5);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [activeRideRecord, setActiveRideRecord] = useState<any | null>(null);
  
  useEffect(() => {
    setIsEtaExpired(false);
  }, [activeRideRecord?.id, activeRideRecord?.driverEtaResponse]);
  const [isRestoringCall, setIsRestoringCall] = useState(true);
  const activeStatusRef = useRef<string | null>(null);
  const prevStatusRef = useRef<string | null>(null);
  const prevPriceRef = useRef<number | null>(null);
  const prevDriverEtaResponseRef = useRef<string | null>(null);

  // Real-time synchronization active toast notification
  const [notificationBanner, setNotificationBanner] = useState<{
    title: string;
    message: string;
    visible: boolean;
    type?: 'info' | 'discount' | 'success' | 'warning';
  }>({ title: '', message: '', visible: false, type: 'info' });

  const hasWelcomedRef = useRef(false);

  const triggerBonusClubNotification = (profileName: string, configData?: any) => {
    const activeConfig = configData || appConfig;
    if (activeConfig?.bonusClubEnabled !== false) {
      const cashbackPct = activeConfig?.bonusClubCashbackPercent || 5;
      setNotificationBanner({
        title: "🌟 CLUBE DE BÓNUS ATIVO!",
        message: `Olá, ${profileName}! O Clube de Bónus está ativo. Receba ${cashbackPct}% de cashback em cada viagem para acumular e viajar de graça!`,
        visible: true
      });
      playNotificationSound('success');
    }
  };

  // Pure Web Audio API Premium Sound Generators - 100% Reliable Offline Sound Chimes
  const playNotificationSound = (type: 'ding' | 'success' | 'alert', extTitle?: string, extBody?: string) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new (AudioContextClass as any)();
      
      if (type === 'ding') {
        const playDing = (delay: number) => {
          const oscNode = ctx.createOscillator();
          const gainNode = ctx.createGain();
          oscNode.type = 'sine';
          oscNode.frequency.setValueAtTime(987.77, ctx.currentTime + delay); // B5 note
          oscNode.frequency.exponentialRampToValueAtTime(1318.51, ctx.currentTime + delay + 0.15); // E6 note
          
          gainNode.gain.setValueAtTime(0.25, ctx.currentTime + delay);
          gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.55);
          oscNode.connect(gainNode);
          gainNode.connect(ctx.destination);
          oscNode.start(ctx.currentTime + delay);
          oscNode.stop(ctx.currentTime + delay + 0.6);
        };
        
        playDing(0);
        playDing(0.22); // play double-chime to awaken passenger actively
      } else if (type === 'success') {
        const freqs = [523.25, 659.25, 783.99, 1046.50]; 
        freqs.forEach((freq, i) => {
          const oscNode = ctx.createOscillator();
          const gainNode = ctx.createGain();
          oscNode.type = 'triangle';
          oscNode.frequency.value = freq;
          gainNode.gain.setValueAtTime(0.18, ctx.currentTime + i * 0.08); // elevated volume level
          gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4 + i * 0.08);
          oscNode.connect(gainNode);
          gainNode.connect(ctx.destination);
          oscNode.start(ctx.currentTime + i * 0.08);
          oscNode.stop(ctx.currentTime + 0.5 + i * 0.08);
        });
      } else if (type === 'alert') {
        const oscNode = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscNode.type = 'sawtooth';
        oscNode.frequency.setValueAtTime(440, ctx.currentTime);
        oscNode.frequency.linearRampToValueAtTime(330, ctx.currentTime + 0.18);
        gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        oscNode.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscNode.start();
        oscNode.stop(ctx.currentTime + 0.3);
      }

      // External native device push notifications for when tab is minimized or in background (JIS - Despertar Passageiro)
      if (extTitle && extBody && typeof window !== 'undefined' && 'Notification' in window && window.Notification) {
        if (window.Notification.permission === 'granted' && 'serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(registration => {
            registration.showNotification(`🚕 TAXICONTROL: ${extTitle}`, {
              body: extBody,
              icon: '/icon-192.png',
              tag: 'super-taxi-passenger',
              requireInteraction: true
            });
          }).catch(() => {
            // Fallback: do not invoke direct new Notification to avoid Illegal constructor
          });
        }
      }
    } catch (err) {
      console.warn("Could not play notification sound:", err);
    }
  };

  // Toast self-cleanup effect
  useEffect(() => {
    if (notificationBanner.visible) {
      const t = setTimeout(() => {
        setNotificationBanner(prev => ({ ...prev, visible: false }));
      }, 10000);
      return () => clearTimeout(t);
    }
  }, [notificationBanner.visible]);

  // Real-time listener for passenger profile status (banned check requested by JIS)
  useEffect(() => {
    if (!passengerProfile?.id) return;
    const unsub = onSnapshot(doc(db, 'passengers', passengerProfile.id), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.banned !== passengerProfile.banned) {
          const updated = { ...passengerProfile, ...data, id: snap.id };
          localStorage.setItem('psm-passenger-profile', JSON.stringify(updated));
          setPassengerProfile(updated);
        }
      }
    }, (err) => console.warn("Error listening to passenger ban status:", err));
    return () => unsub();
  }, [passengerProfile?.id]);

  // Stats / Confirmed Rides History
  const [myRides, setMyRides] = useState<any[]>([]);

  const getRidePriceText = (rd: any) => {
    if (rd.status === 'cancelled') return 'Cancelada';
    if (rd.status === 'rejected') return 'Recusada';
    if (rd.status === 'ignored') return 'Expirada';
    const isBonus = rd.usedBonus === true || rd.paidWithBonus === true || rd.paymentMethod === 'bonus';
    if (isBonus) {
      return rd.price ? `${Number(rd.price).toLocaleString()} Kz (Debitado por Bónus)` : 'Debitado por Bónus';
    }
    return rd.price ? `${Number(rd.price).toLocaleString()} Kz` : 'A negociar';
  };

  const getRideStatusBadge = (rd: any, isLarge = false) => {
    const sizeClass = isLarge ? "text-[8px] tracking-widest block text-center" : "text-[7.5px]";
    switch (rd.status) {
      case 'completed':
        return (
          <span className={`${sizeClass} font-black px-1.5 py-0.5 rounded border uppercase bg-emerald-500/10 text-emerald-400 border-emerald-500/20`}>
            Sucesso
          </span>
        );
      case 'confirmed':
        return (
          <span className={`${sizeClass} font-black px-1.5 py-0.5 rounded border uppercase bg-blue-500/10 text-blue-400 border-blue-500/20`}>
            Aceite
          </span>
        );
      case 'active':
        return (
          <span className={`${sizeClass} font-black px-1.5 py-0.5 rounded border uppercase bg-teal-500/10 text-teal-400 border-teal-500/20 animate-pulse`}>
            Em Curso
          </span>
        );
      case 'price_sent':
        return (
          <span className={`${sizeClass} font-black px-1.5 py-0.5 rounded border uppercase bg-yellow-500/10 text-yellow-400 border-yellow-500/20`}>
            Proposta
          </span>
        );
      case 'cancelled':
        return (
          <span className={`${sizeClass} font-black px-1.5 py-0.5 rounded border uppercase bg-slate-500/10 text-slate-400 border-slate-500/20`}>
            Cancelada
          </span>
        );
      case 'rejected':
        return (
          <span className={`${sizeClass} font-black px-1.5 py-0.5 rounded border uppercase bg-red-500/10 text-red-400 border-red-500/20`}>
            Recusada
          </span>
        );
      case 'ignored':
        return (
          <span className={`${sizeClass} font-black px-1.5 py-0.5 rounded border uppercase bg-rose-500/10 text-rose-400 border-rose-500/20`}>
            Expirada
          </span>
        );
      default:
        return (
          <span className={`${sizeClass} font-black px-1.5 py-0.5 rounded border uppercase bg-amber-500/10 text-amber-400 border-amber-500/20`}>
            Aguardando
          </span>
        );
    }
  };

  const [passengerTab, setPassengerTab] = useState<'viagem' | 'seguranca' | 'perfil'>('viagem');

  // SWR-based fleet fetcher for offline caching & instant navigability
  const { data: swrFleet, mutate: mutateFleet } = useSWR('firestore/drivers/fleet', async () => {
    const activeDriversSnap = await getDocs(collection(db, 'drivers'));
    const activeDriversList: VehicleOption[] = [];
    const activeStatuses = ['available', 'ativo', 'disponível', 'disponivel', 'busy', 'ocupado', 'em serviço', 'em curso'];
    
    activeDriversSnap.forEach(docSnap => {
      const data = docSnap.data();
      const status = (data.status || '').toLowerCase().trim();
      const isPassengerActive = data.passengerAppActive !== false;
      if ((activeStatuses.includes(status) || data.isOnline === true || data.online === true) && isPassengerActive) {
        activeDriversList.push({
          id: docSnap.id,
          plate: data.plate || 'LD-92-33-PX',
          driverName: data.name,
          phone: data.phone || data.secondaryPhone || '+244 923 456 789',
          model: data.vehicleModel || `Viatura ${data.prefix || ''}`,
          prefix: data.prefix || data.code || '',
          driverId: data.driverId || '',
          lat: typeof data.lat === 'number' ? data.lat : (data.location?.lat),
          lng: typeof data.lng === 'number' ? data.lng : (data.location?.lng)
        });
      }
    });
    
    // Save to local storage cache for absolute resilience
    if (activeDriversList.length > 0) {
      localStorage.setItem('cached_fleet_data', JSON.stringify(activeDriversList));
    }
    return activeDriversList;
  }, {
    refreshInterval: 12000, // revalidate every 12 seconds
    fallbackData: (() => {
      try {
        const local = localStorage.getItem('cached_fleet_data');
        return local ? JSON.parse(local) : [];
      } catch (e) {
        return [];
      }
    })(),
    revalidateOnFocus: true,
  });

  // Keep availableVehicles updated from SWR
  useEffect(() => {
    if (swrFleet && swrFleet.length > 0) {
      setAvailableVehicles(swrFleet);
      if (selectedVehicleId !== '' && selectedVehicleId !== 'auto' && !swrFleet.some(v => v.id === selectedVehicleId)) {
        setSelectedVehicleId('');
      }
    }
  }, [swrFleet]);

  // Fetch Vehicles & Drivers to Book
  const loadFleetData = async () => {
    setIsLoadingFleet(true);
    try {
      // SWR revalidates and returns instantly from cache
      const freshData = await mutateFleet();
      if (freshData && freshData.length > 0) {
        setAvailableVehicles(freshData);
      }
    } catch (e) {
      console.warn("Could not load fleet data (using cache):", e);
      // Fallback to localStorage if totally offline
      try {
        const local = localStorage.getItem('cached_fleet_data');
        if (local) {
          setAvailableVehicles(JSON.parse(local));
        }
      } catch (err) {}
    } finally {
      setIsLoadingFleet(false);
    }
  };

  // Real-time listener for live GPS tracking of active drivers/vehicles on the satellite map
  useEffect(() => {
    const activeStatuses = ['available', 'ativo', 'disponível', 'disponivel', 'busy', 'ocupado', 'em serviço', 'em curso'];
    const q = query(collection(db, 'drivers'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activeDriversList: VehicleOption[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const status = (data.status || '').toLowerCase().trim();
        const isPassengerActive = data.passengerAppActive !== false;
        if ((activeStatuses.includes(status) || data.isOnline === true || data.online === true) && isPassengerActive) {
          activeDriversList.push({
            id: docSnap.id,
            plate: data.plate || 'LD-92-33-PX',
            driverName: data.name,
            phone: data.phone || data.secondaryPhone || '+244 923 456 789',
            model: data.vehicleModel || `Viatura ${data.prefix || ''}`,
            prefix: data.prefix || data.code || '',
            driverId: data.driverId || '',
            lat: typeof data.lat === 'number' ? data.lat : (data.location?.lat),
            lng: typeof data.lng === 'number' ? data.lng : (data.location?.lng)
          });
        }
      });
      // Update both SWR cache and local state
      mutateFleet(activeDriversList, false);
      setAvailableVehicles(activeDriversList);
      if (activeDriversList.length > 0) {
        localStorage.setItem('cached_fleet_data', JSON.stringify(activeDriversList));
      }
    }, (error) => {
      console.warn("Error listening to real-time driver coordinates:", error);
      // Retrieve from cache if listener fails due to network
      try {
        const local = localStorage.getItem('cached_fleet_data');
        if (local) {
          const parsed = JSON.parse(local);
          setAvailableVehicles(parsed);
          mutateFleet(parsed, false);
        }
      } catch (e) {}
    });

    return () => unsubscribe();
  }, [mutateFleet]);

  const fetchCompanies = async () => {
    setIsLoadingCompanies(true);
    const list: any[] = [];
    try {
      const snap = await getDocs(collection(db, 'tenants'));
      snap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
    } catch (err) {
      console.error("Error fetching companies in passenger flow, using local fallbacks:", err);
    }

    if (!list.some(c => c.id === 'psm')) {
      list.unshift({ 
        id: 'psm', 
        name: 'PSM', 
        address: 'Luena, Moxico', 
        phone: '+244 923 456 789' 
      });
    }
    setCompanies(list);
    setIsLoadingCompanies(false);
  };

  const handleSelectCompany = (companyId: string) => {
    setActiveTenantId(companyId);
    setActiveTenant(companyId);
    loadFleetData();
  };

  const generateToken = () => Math.floor(1000 + Math.random() * 9000).toString();

  useEffect(() => {
    loadFleetData();
    fetchCompanies();
    // Request FCM notification permission and token for push notifications (JIS)
    requestPassengerFcmToken().catch(e => console.warn('[FCM] Token init warning:', e));

    // Listen to foreground push messages from Firebase Cloud Messaging
    listenToFcmForegroundMessages((payload) => {
      if (payload?.notification || payload?.data) {
        const title = payload.notification?.title || payload.data?.title || '🚕 TAXICONTROL';
        const body = payload.notification?.body || payload.data?.body || 'Atualização da sua corrida';
        playNotificationSound('ding', title, body);
        setNotificationBanner({
          title: title,
          message: body,
          visible: true
        });
      }
    });

    if (typeof window !== 'undefined' && 'Notification' in window && window.Notification && window.Notification.permission === 'default' && typeof window.Notification.requestPermission === 'function') {
      try {
        window.Notification.requestPermission();
      } catch (err) {
        console.warn("Notification.requestPermission is not supported here:", err);
      }
    }
  }, []);

  // Load saved active call on mount to prevent state drop upon unmounting / tab switching
  useEffect(() => {
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const rawUrlCallId = urlParams ? (urlParams.get('callId') || urlParams.get('rideId')) : null;

    if (rawUrlCallId && !validateRideTransactionId(rawUrlCallId)) {
      console.warn("[PassengerFlow] Invalid URL transaction ID supplied:", rawUrlCallId);
      if (typeof window !== 'undefined' && window.history?.replaceState) {
        window.history.replaceState({}, document.title, `${window.location.pathname}?view=passenger`);
      }
      setNotificationBanner({
        title: "⚠️ LINK DE PARTILHA INVÁLIDO",
        message: "O código de transação fornecido no link de partilha do WhatsApp é inválido ou malformado.",
        visible: true,
        type: 'warning'
      });
    }

    const urlCallId = (rawUrlCallId && validateRideTransactionId(rawUrlCallId)) ? rawUrlCallId : null;
    const savedCallId = urlCallId || localStorage.getItem('active_call_id');

    if (savedCallId) {
      const fetchSavedCall = async () => {
        try {
          const docSnap = await getDoc(doc(db, 'calls', savedCallId));
          if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Safety guard: if the passenger already started/joined another call during this flight, do not overwrite it
            if (activeStatusRef.current !== null && !urlCallId) {
              console.log("[PassengerFlow] Stale restore flight aborted because another active ride is already set.");
              return;
            }

            // Verify if call passenger matches currently logged-in passenger or opened via shared link
            const isMyCall = urlCallId || !passengerProfile || !passengerProfile.name || (data.passengerName === passengerProfile.name);

            // Only restore if the call is not ended
            if (isMyCall && !['completed', 'cancelled', 'rejected', 'ignored'].includes(data.status)) {
               console.log("Restoring active call from URL / localStorage:", savedCallId, data);
               activeStatusRef.current = data.status;
               setActiveRideRecord({ id: docSnap.id, ...data });

               if (urlCallId) {
                 setNotificationBanner({
                   title: "📍 ACOMPANHAMENTO EM TEMPO REAL",
                   message: `A visualizar o trajeto em tempo real da viagem de ${data.passengerName || 'Passageiro'} (${data.originName || data.pickup || 'Luena'} ➔ ${data.destinationName || data.destination || 'Destino'}).`,
                   visible: true,
                   type: 'info'
                 });
               }

              // Set correct status immediately to prevent any blank visual overlay
              if (data.status === 'pending' || data.status === 'calling') {
                setCallState('calling');
              } else if (data.status === 'connected') {
                setCallState('connected');
              } else if (data.status === 'pricing') {
                setCallState('pricing');
              } else if (data.status === 'price_sent') {
                setCallState('offer_received');
                if (data.price) setNegotiatedPrice(data.price);
              } else if (data.status === 'confirmed' || data.status === 'active' || data.status === 'arrived') {
                setCallState('ride_confirmed');
                if (data.price) setNegotiatedPrice(data.price);
              }
            } else {
              console.log("[PassengerFlow] Saved call is already ended/completed in database, clearing.");
              if (!urlCallId) localStorage.removeItem('active_call_id');
              setPickup('');
              setDestination('');
              setNegotiatedPrice(0);
              setActiveRideRecord(null);
              activeStatusRef.current = null;
              setCallState('idle');
            }
          } else {
            console.log("[PassengerFlow] Saved call ID does not exist, clearing localStorage.");
            if (!urlCallId) localStorage.removeItem('active_call_id');
            setActiveRideRecord(null);
            activeStatusRef.current = null;
            setCallState('idle');
          }
        } catch (err) {
          console.error("Error restoring call:", err);
          if (!urlCallId) localStorage.removeItem('active_call_id');
          setActiveRideRecord(null);
          activeStatusRef.current = null;
          setCallState('idle');
        } finally {
          setIsRestoringCall(false);
        }
      };
      fetchSavedCall();
    } else {
      setIsRestoringCall(false);
    }
  }, [passengerProfile?.name]);

  // Sync active_call_id in localStorage when activeRideRecord id changes (guarded by isRestoringCall)
  useEffect(() => {
    if (isRestoringCall) return;

    if (activeRideRecord?.id) {
      localStorage.setItem('active_call_id', activeRideRecord.id);
    } else {
      localStorage.removeItem('active_call_id');
    }
  }, [activeRideRecord?.id, isRestoringCall]);

  // Sync rides in real time
  useEffect(() => {
    if (!passengerProfile?.name) return;
    const qRides = query(
      collection(db, 'calls'), 
      where('passengerName', '==', passengerProfile.name)
    );
    const unsub = onSnapshot(qRides, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a: any, b: any) => {
        const tA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt).getTime();
        const tB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt).getTime();
        return tB - tA;
      });
      setMyRides(list);
    });
    return () => unsub();
  }, [passengerProfile]);

  // Sync passenger complaints in real-time
  useEffect(() => {
    if (!passengerProfile?.name && !passengerProfile?.backupPhone) return;
    const qComplaints = query(collection(db, 'complaints'), limit(100));
    const unsub = onSnapshot(qComplaints, (snap) => {
      const pName = (passengerProfile?.name || '').toLowerCase().trim();
      const pPhone = (passengerProfile?.backupPhone || passengerProfile?.phone || '').replace(/[^0-9]/g, '');

      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((c: any) => {
          const cName = (c.passengerName || '').toLowerCase().trim();
          const cPhone = (c.passengerPhone || '').replace(/[^0-9]/g, '');
          
          const isMyComplaint = (pName && cName && cName === pName) || (pPhone && cPhone && pPhone === cPhone);
          if (!isMyComplaint) return false;

          // REGRA 1: Avaliações com satisfação "satisfeito" desaparecem na mesma hora (imediatamente)
          if (c.satisfaction === 'satisfied') {
            return false;
          }

          // REGRA 2: Reclamações resolvidas desaparecem para o passageiro após 48 horas
          if (c.status === 'resolved') {
            const resolvedTime = c.resolvedAt?.seconds 
              ? c.resolvedAt.seconds * 1000 
              : (c.updatedAt?.seconds 
                ? c.updatedAt.seconds * 1000 
                : (c.satisfactionTimestamp?.seconds
                  ? c.satisfactionTimestamp.seconds * 1000
                  : (c.timestamp ? new Date(c.timestamp).getTime() : 0)));

            if (resolvedTime > 0) {
              const hoursPassed = (Date.now() - resolvedTime) / (1000 * 60 * 60);
              if (hoursPassed >= 48) {
                return false;
              }
            }
          }

          return true;
        });

      list.sort((a: any, b: any) => {
        const tA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
        const tB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.timestamp ? new Date(b.timestamp).getTime() : 0);
        return tB - tA;
      });

      setPassengerComplaints(list);
    }, (err) => console.error("Error fetching passenger complaints:", err));

    return () => unsub();
  }, [passengerProfile]);

  const handleSatisfactionSubmit = async (complaintId: string, satisfaction: 'satisfied' | 'unsatisfied') => {
    setSubmittingSatisfactionId(complaintId);
    try {
      const comment = satisfactionComments[complaintId] || '';
      await updateDoc(doc(db, 'complaints', complaintId), {
        satisfaction,
        satisfactionComment: comment,
        satisfactionTimestamp: new Date(),
        updatedByPassengerAt: new Date()
      });
      setEditingSatisfactionId(null);
    } catch (err) {
      console.error("Error submitting satisfaction:", err);
      alert("Ocorreu um erro ao registar a sua avaliação. Tente novamente.");
    } finally {
      setSubmittingSatisfactionId(null);
    }
  };

  // Synchronize activeRideRecord in real-time from Firestore if set
  useEffect(() => {
    if (!activeRideRecord?.id) return;

    const docId = activeRideRecord.id;
    const docRef = doc(db, 'calls', docId);

    const handleSync = (docSnap: any) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // Update ref IMMEDIATELY so any running asynchronous timer ticks see it instantly!
        activeStatusRef.current = data.status;

        // Sync attributes safely with fallback to prevent setting to null prematurely
        setActiveRideRecord((prev: any) => {
          if (!prev) return { id: docSnap.id, ...data };
          return { ...prev, ...data };
        });

        // Check for new ETA response from driver in real-time
        const prevDriverEtaResponse = prevDriverEtaResponseRef.current;
        if (data.driverEtaResponse && prevDriverEtaResponse && prevDriverEtaResponse !== data.driverEtaResponse) {
          playNotificationSound('ding', 'Previsão de Chegada!', `O motorista atualizou a previsão de chegada: ${data.driverEtaResponse}.`);
          setNotificationBanner({
            title: '⚡ PREVISÃO DE CHEGADA!',
            message: `O motorista informou que chega em: ${data.driverEtaResponse}.`,
            type: 'info',
            visible: true
          });
        }
        if (data.driverEtaResponse) {
          prevDriverEtaResponseRef.current = data.driverEtaResponse;
        }

        // Trigger real-time sound/visual notification on state change (JIS - Safety Notifications)
        const prevStatus = prevStatusRef.current;
        const prevPrice = prevPriceRef.current;
        const isNegotiation = prevStatus === 'price_negotiation_requested';
        const isPriceChange = prevPrice !== null && prevPrice !== data.price;
        const isNewOffer = prevStatus !== 'price_sent';

        // Custom real-time handling for price proposals and discounts
        if (data.status === 'price_sent' && (isNewOffer || isPriceChange || isNegotiation)) {
          const isDiscount = Boolean(data.discountPercent || (data.originalPrice && Number(data.price) < Number(data.originalPrice)) || isNegotiation);
          const driverName = data.driverName || 'O Motorista SUPER TÁXI';
          const newPrice = Number(data.price || 0);
          const pctLabel = data.discountPercent ? ` (${data.discountPercent})` : '';

          if (isDiscount) {
            playNotificationSound('ding', '🏷️ Desconto Oferecido!', `O motorista ${driverName} ofereceu um novo preço com desconto: ${newPrice.toLocaleString()} Kz.`);
            setNotificationBanner({
              title: '🏷️ O MOTORISTA OFERECEU UM DESCONTO!',
              message: `${driverName} aplicou um desconto! Novo valor da corrida: ${newPrice.toLocaleString()} Kz${pctLabel}. Toque para confirmar.`,
              type: 'discount',
              visible: true
            });
          } else {
            playNotificationSound('ding', 'Proposta Recebida!', `O motorista ${driverName} propôs o preço de ${newPrice.toLocaleString()} Kz para a sua viagem.`);
            setNotificationBanner({
              title: '💬 PROPOSTA DE PREÇO RECEBIDA!',
              message: `${driverName} propôs o preço de ${newPrice.toLocaleString()} Kz para a sua viagem.`,
              type: 'info',
              visible: true
            });
          }
          setIsCallMinimized(false);
          prevPriceRef.current = data.price;
        } else if (prevStatus && prevStatus !== data.status) {
          if (data.status === 'connected') {
            playNotificationSound('ding', 'Chamada Atendida!', 'O motorista está em linha.');
            setNotificationBanner({
              title: 'Chamada Atendida!',
              message: 'O motorista está em linha.',
              type: 'info',
              visible: true
            });
          } else if (data.status === 'confirmed' || data.status === 'active') {
            playNotificationSound('success', 'Viagem Ativada!', 'A viagem foi confirmada pelo motorista. Desfrute da viagem.');
            setNotificationBanner({
              title: 'Viagem Ativada!',
              message: 'A viagem foi confirmada pelo motorista. Desfrute da viagem.',
              type: 'success',
              visible: true
            });
          } else if (data.status === 'arrived') {
            playNotificationSound('ding', 'Motorista Chegou!', 'O seu motorista já está no ponto de recolha esperando por si.');
            setNotificationBanner({
              title: 'Motorista Chegou!',
              message: 'O seu motorista já está no ponto de recolha.',
              type: 'info',
              visible: true
            });
          } else if (data.status === 'completed') {
            playNotificationSound('success', 'Viagem Fechada!', 'O motorista encerrou com sucesso. Obrigado por viajar connosco.');
            setNotificationBanner({
              title: 'Viagem Fechada!',
              message: 'O motorista encerrou com sucesso. Obrigado por viajar connosco.',
              type: 'success',
              visible: true
            });

            // --- CLUB BONUS SYSTEM (JIS) ---
            if (appConfig?.bonusClubEnabled !== false && passengerProfile) {
              const usedBonus = data.usedBonus === true || data.paidWithBonus === true;
              const initialBonus = Number(passengerProfile.bonusBalance || 0);
              let currentBonus = initialBonus;
              let bonusDelta = 0;
              let logData: any = null;

              if (usedBonus) {
                // Deduct exactly the price proposed by the driver (exchange bonus for ride directly)
                const finalPrice = Number(data.price || negotiatedPrice || 0);
                currentBonus = Math.max(0, initialBonus - finalPrice);
                console.log(`Passenger used bonus. Subtracted proposed price of ${finalPrice} Kz. New bonus:`, currentBonus);
                logData = {
                  initial: initialBonus,
                  subtracted: finalPrice,
                  final: currentBonus,
                  type: 'deduction',
                  timestamp: new Date().toISOString()
                };
              } else {
                // Add dynamic cashback percent from appConfig
                const finalPrice = Number(data.price || negotiatedPrice || 0);
                const cashbackPct = Number(appConfig?.bonusClubCashbackPercent || 5) / 100;
                bonusDelta = Math.round(finalPrice * cashbackPct);
                currentBonus = initialBonus + bonusDelta;
                console.log(`Passenger earned ${bonusDelta} Kz from ${finalPrice} Kz spend. New bonus:`, currentBonus);
                logData = {
                  initial: initialBonus,
                  added: bonusDelta,
                  final: currentBonus,
                  type: 'cashback',
                  timestamp: new Date().toISOString()
                };
              }

              // Update profile locally
              const updatedProfile = { ...passengerProfile, bonusBalance: currentBonus };
              setPassengerProfile(updatedProfile);
              localStorage.setItem('psm-passenger-profile', JSON.stringify(updatedProfile));

              // Update profile in Firestore
              if (passengerProfile.id) {
                updateDoc(doc(db, 'passengers', passengerProfile.id), {
                  bonusBalance: currentBonus
                }).catch((err: any) => console.error("Error updating passenger bonusBalance in Firestore:", err));
              }

              // Write detailed transaction log to the call record
              if (docSnap.id) {
                updateDoc(doc(db, 'calls', docSnap.id), {
                  bonusLog: logData
                }).catch((err: any) => console.error("Error updating call bonusLog in Firestore:", err));
              }
            }
            setUseBonusForRide(false); // Reset checkbox for future bookings
            // ---------------------------------
          }
        }
        if (data.status !== prevStatusRef.current && prevStatusRef.current !== undefined && prevStatusRef.current !== null) {
          setIsCallMinimized(false);
        }
        prevStatusRef.current = data.status;
        
        // Let's change callState based on Firestore status
        console.log("Passenger Flow - Sync active ride. Status:", data.status, "Price:", data.price, "Doc ID:", docSnap.id);
        const hasRealtimeLocation = Boolean(
          data.localizacao_tempo_real || 
          data.localizacaoTempoReal || 
          data.hasRealtimeLocation ||
          (data.driverLat && data.driverLng)
        );
        const hasDriverLocationOrEta = Boolean(hasRealtimeLocation || data.driverEtaResponse || data.driverEta || data.eta);
        
        if (data.status === 'completed') {
          console.log("[PassengerFlow] Sync detected ride completed. Showing success receipt screen.");
          setCallState('ride_completed');
          // Note: We deliberately do NOT set activeRideRecord to null here so the success/receipt screen 
          // can display the actual trip details (driverName, vehiclePlate, negotiatedPrice) rather than fallback defaults!
        } else if (data.status === 'cancelled' || data.status === 'rejected' || data.status === 'ignored' || data.status === 'missed') {
          console.log("[PassengerFlow] Sync detected ride cancelled/rejected/missed.");
          setCallState('cancelled_by_driver');
          // Note: We deliberately do NOT set activeRideRecord to null here so the cancellation screen can read details.
        } else if (data.status === 'confirmed' || data.status === 'arrived' || data.status === 'active' || hasDriverLocationOrEta) {
          if (data.price !== undefined && data.price !== null) setNegotiatedPrice(data.price);
          setCallState('ride_confirmed');
        } else if (data.status === 'pending' || data.status === 'calling') {
          // Strict real alignment to calling status
          setCallState('calling');
        } else if (data.status === 'connected') {
          setCallState('connected');
        } else if (data.status === 'pricing') {
          setCallState('pricing');
        } else if (data.status === 'price_sent') {
          // Update price even if it's 0 to reflect the state accurately
          setNegotiatedPrice(data.price || 0); 
          setCallState('offer_received');
        }
      } else {
        console.warn("[Passenger Flow] Active call document does not exist in Firestore yet or was removed. ID:", docId);
        // Only clean up state immediately if the call isn't newly initiated or in progress
        const isCallInProgress = activeStatusRef.current === 'pending' || 
                                 activeStatusRef.current === 'calling' || 
                                 activeStatusRef.current === 'connected' || 
                                 activeStatusRef.current === 'pricing' || 
                                 activeStatusRef.current === 'price_sent' || 
                                 activeStatusRef.current === 'confirmed' || 
                                 activeStatusRef.current === 'active';
        if (!isCallInProgress) {
          setCallState('idle');
          setActiveRideRecord(null);
          activeStatusRef.current = null;
        }
      }
    };

    // 1) Real-time Stream Subscriber (Highly robust native channel)
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      handleSync(docSnap);
    }, (error) => {
      console.warn("Real-time stream error in PassengerFlow:", error);
    });

    return () => {
      unsubscribe();
    };
  }, [activeRideRecord?.id]);

  // Keep activeStatusRef always holding the absolute latest status
  useEffect(() => {
    activeStatusRef.current = activeRideRecord?.status || null;
    if (activeRideRecord?.status) {
      prevStatusRef.current = activeRideRecord.status;
    }
  }, [activeRideRecord?.status]);

  // Self-correcting alignment for callState to prevent any simulator race conditions
  useEffect(() => {
    if (!activeRideRecord) return;
    const dbStatus = activeRideRecord.status;
    const hasRealtimeLocation = Boolean(
      activeRideRecord.localizacao_tempo_real || 
      activeRideRecord.localizacaoTempoReal || 
      activeRideRecord.hasRealtimeLocation ||
      (activeRideRecord.driverLat && activeRideRecord.driverLng)
    );
    const hasDriverLocationOrEta = Boolean(
      hasRealtimeLocation || 
      activeRideRecord.driverEtaResponse || 
      activeRideRecord.driverEta || 
      activeRideRecord.eta
    );

    if (dbStatus === 'completed') {
      setCallState('ride_completed');
    } else if (dbStatus === 'cancelled' || dbStatus === 'rejected' || dbStatus === 'ignored' || dbStatus === 'missed') {
      setCallState('cancelled_by_driver');
    } else if (dbStatus === 'confirmed' || dbStatus === 'active' || dbStatus === 'arrived' || hasDriverLocationOrEta) {
      if (activeRideRecord.price !== undefined && activeRideRecord.price !== null) setNegotiatedPrice(activeRideRecord.price);
      setCallState('ride_confirmed');
    } else if (dbStatus === 'pending' || dbStatus === 'calling') {
      setCallState('calling');
    } else if (dbStatus === 'connected') {
      setCallState('connected');
    } else if (dbStatus === 'pricing') {
      setCallState('pricing');
    } else if (dbStatus === 'price_sent') {
      // Update price even if it's 0
      setNegotiatedPrice(activeRideRecord.price !== undefined && activeRideRecord.price !== null ? activeRideRecord.price : 0);
      setCallState('offer_received');
    }
  }, [activeRideRecord?.status, activeRideRecord?.price, activeRideRecord?.driverLat, activeRideRecord?.driverLng, activeRideRecord?.localizacao_tempo_real, activeRideRecord?.localizacaoTempoReal, activeRideRecord?.driverEtaResponse, activeRideRecord?.driverEta]);

  // Ticker for seconds elapsed
  useEffect(() => {
    let interval: any;
    if (callState === 'calling' || callState === 'connected' || callState === 'pricing') {
      interval = setInterval(() => {
        setSecondsElapsed(prev => prev + 1);
      }, 1000);
    } else {
      setSecondsElapsed(0);
    }
    return () => clearInterval(interval);
  }, [callState]);

  // Handle local simulator transitions (Only applicable if no real DB record is active. Fallback mock).
  useEffect(() => {
    // If we have an active real-time call connected on the network, we NEVER simulate DB states.
    // The passenger must wait for the actual driver to respond!
    if (activeRideRecord?.id) {
      return;
    }

    // Pure local simulator logic when no database record is set (e.g. running without internet/backend)
    if (activeStatusRef.current && activeStatusRef.current !== 'pending') {
      return;
    }
    
    if (callState === 'calling' && secondsElapsed >= 3) {
      setCallState('connected');
    } else if (callState === 'connected' && secondsElapsed >= 7) {
      setCallState('pricing');
    }
  }, [secondsElapsed, callState, activeRideRecord?.id]);

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !age.trim() || !gender.trim() || !password.trim()) {
      alert("Por favor, preencha todos os campos obrigatórios.");
      return;
    }
    if (Number(age) < 18) {
      alert("Apenas passageiros maiores de 18 anos são elegíveis.");
      return;
    }
    if (!acceptedTerms) {
      alert("Por favor, leia e aceite os Termos de Segurança e Políticas de Uso antes de criar o seu perfil.");
      return;
    }

    const newProfile = {
      name: name.trim(),
      age: Number(age),
      gender: gender.trim(),
      backupPhone,
      province,
      password,
      photoUrl: selectedAvatar,
      createdAt: new Date().toISOString()
    };

    // Save to Firestore passengers collection for persistence across devices/logins
    try {
      const docRef = await addDoc(collection(db, 'passengers'), newProfile);
      const profileWithId = { id: docRef.id, ...newProfile };
      localStorage.setItem('psm-passenger-profile', JSON.stringify(profileWithId));
      setPassengerProfile(profileWithId);
    } catch (err) {
      console.error("Erro ao persistir passageiro no Firestore:", err);
      localStorage.setItem('psm-passenger-profile', JSON.stringify(newProfile));
      setPassengerProfile(newProfile);
    }

    alert(`Perfil de ${name} criado com sucesso no ecossistema SUPER Taxi!`);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginName.trim() || !loginPassword.trim()) {
      alert("Por favor, preencha as suas credenciais.");
      return;
    }

    setIsLoggingIn(true);
    try {
      const trimmedLogin = loginName.trim();
      const pwd = loginPassword.trim();

      // Query direct matches on Name or backupPhone with Password
      const qName = query(
        collection(db, 'passengers'),
        where('name', '==', trimmedLogin),
        where('password', '==', pwd)
      );
      const qPhone = query(
        collection(db, 'passengers'),
        where('backupPhone', '==', trimmedLogin),
        where('password', '==', pwd)
      );

      const [snapName, snapPhone] = await Promise.all([
        getDocs(qName),
        getDocs(qPhone)
      ]);

      let profile: any = null;
      if (!snapName.empty) {
        const userData = snapName.docs[0].data();
        profile = { id: snapName.docs[0].id, ...userData };
      } else if (!snapPhone.empty) {
        const userData = snapPhone.docs[0].data();
        profile = { id: snapPhone.docs[0].id, ...userData };
      } else {
        // Fallback for case-insensitive, space matching or prefix variations (like +244 and without +244)
        const allPassengersSnap = await getDocs(collection(db, 'passengers'));
        const normalizedInputName = trimmedLogin.toLowerCase().replace(/\s+/g, '');
        // Strip out country code or leading zeros or spaces for relaxed phone comparison
        const cleanedInputPhone = trimmedLogin.replace(/[\s\-\+]/g, '');
        const normalizedInputPass = pwd;

        allPassengersSnap.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.password && String(data.password).trim() === normalizedInputPass) {
            const savedName = data.name ? String(data.name).trim().toLowerCase().replace(/\s+/g, '') : '';
            const savedBackupPhone = data.backupPhone ? String(data.backupPhone).replace(/[\s\-\+]/g, '') : '';
            const savedPhone = data.phone ? String(data.phone).replace(/[\s\-\+]/g, '') : '';

            const isNameMatch = savedName && savedName === normalizedInputName;
            const isPhoneMatch = (savedBackupPhone && savedBackupPhone.endsWith(cleanedInputPhone)) || 
                                 (savedPhone && savedPhone.endsWith(cleanedInputPhone)) ||
                                 (cleanedInputPhone && (savedBackupPhone.includes(cleanedInputPhone) || cleanedInputPhone.includes(savedBackupPhone)));

            if (isNameMatch || isPhoneMatch) {
              profile = { id: docSnap.id, ...data };
            }
          }
        });
      }

      if (!profile) {
        // Fallback for passengers registered under old tenant-scoped paths
        const legacyTenants = ['psm', 'jis', 'sps', 'moxico'];
        for (const tId of legacyTenants) {
          try {
            const legacySnap = await getDocs(collection(db, 'tenants', tId, 'passengers'));
            legacySnap.forEach((docSnap) => {
              const data = docSnap.data();
              if (data.password && String(data.password).trim() === pwd) {
                const savedName = data.name ? String(data.name).trim().toLowerCase().replace(/\s+/g, '') : '';
                const savedPhone = data.backupPhone || data.phone ? String(data.backupPhone || data.phone).replace(/[\s\-\+]/g, '') : '';
                const normalizedInputName = trimmedLogin.toLowerCase().replace(/\s+/g, '');
                const cleanedInputPhone = trimmedLogin.replace(/[\s\-\+]/g, '');

                if (savedName === normalizedInputName || (savedPhone && cleanedInputPhone && (savedPhone.endsWith(cleanedInputPhone) || cleanedInputPhone.endsWith(savedPhone)))) {
                  profile = { id: docSnap.id, ...data };
                  // Auto-migrate to global ecosystem
                  addDoc(collection(db, 'passengers'), data).catch(() => {});
                }
              }
            });
            if (profile) break;
          } catch {}
        }
      }

      if (profile) {
        localStorage.setItem('psm-passenger-profile', JSON.stringify(profile));
        setPassengerProfile(profile);
        alert(`Bem-vindo de volta, ${profile.name}!`);
        setTimeout(() => {
          triggerBonusClubNotification(profile.name);
        }, 1000);
      } else {
        alert("Credenciais inválidas. Verifique o seu nome/telefone e palavra-passe.");
      }
    } catch (e) {
      console.error("Erro ao fazer login:", e);
      alert("Ocorreu um erro ao aceder ao servidor.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    if (window.confirm("Deseja sair da sua conta de Passageiro?")) {
      localStorage.removeItem('psm-passenger-profile');
      localStorage.removeItem('active_call_id');
      setPassengerProfile(null);
      setAuthPortalView('welcome');
      setCallState('idle');
      setActiveRideRecord(null);
      activeStatusRef.current = null;
      setPickup('');
      setDestination('');
      setNegotiatedPrice(0);
    }
  };

  // Initiate call / request price
  const handleInitiateCall = async () => {
    if (!pickup.trim() || !destination.trim()) {
      alert("Indique o ponto de recolha e o destino final da viagem.");
      return;
    }

    let selectedVehicle = (selectedVehicleId && selectedVehicleId !== 'auto') 
      ? availableVehicles.find(v => v.id === selectedVehicleId)
      : availableVehicles[0];

    if (!selectedVehicle) {
      selectedVehicle = {
        id: 'auto',
        plate: 'Atribuição Automática',
        model: 'Frota SUPER Táxi',
        phone: '',
        driverName: 'Motorista de Turno',
        driverId: 'auto'
      };
    }

    console.log("[PassengerFlow] Initiating call. Available vehicles:", availableVehicles, "Selected ID:", selectedVehicleId, "Selected:", selectedVehicle);

    // Ensure any previous stale connection/ride state is thoroughly reset before starting a fresh call
    setCallState('calling');
    setIsBookModalOpen(false);
    setNegotiatedPrice(0); // Reset the price offer state for a clean new start
    setSecondsElapsed(0); // Reset simulated seconds ticker
    localStorage.removeItem('active_call_id'); // Clear any stale id from previous runs
    setActiveRideRecord(null); // Clear previous record to ensure new subscription starts fresh
    activeStatusRef.current = 'pending';

    // Write preliminary ride to Firestore
    try {
      const boardingToken = generateToken();
      const currentFcmToken = localStorage.getItem('passenger_fcm_token') || '';

      const resolvedPhone = passengerProfile?.backupPhone || passengerProfile?.phone || '+244923000000';
      const resolvedCount = Number(passengerCount) || 1;

      const docRef = await addDoc(collection(db, 'calls'), {
        passengerId: passengerProfile ? passengerProfile.name.toLowerCase().replace(/\s/g, '') : 'anon',
        passengerName: passengerProfile ? passengerProfile.name : 'Passageiro de Teste',
        passengerPhone: resolvedPhone,
        customerPhone: resolvedPhone,
        phone: resolvedPhone,
        passengerAge: passengerProfile?.age || 'N/A',
        passengerProvince: passengerProfile ? passengerProfile.province : 'Luena, Moxico',
        passengerPhoto: passengerProfile?.photoUrl || '',
        pickup,
        destination,
        passengerCount: resolvedCount,
        passengersCount: resolvedCount,
        numPassengers: resolvedCount,
        customerName: passengerProfile ? passengerProfile.name : 'Passageiro de Teste',
        pickupAddress: pickup,
        destinationAddress: destination,
        pickupLat: passengerCoords[0],
        pickupLng: passengerCoords[1],
        vehiclePlate: selectedVehicle.plate,
        driverName: selectedVehicle.driverName,
        driverPhone: selectedVehicle.phone,
        vehicleModel: selectedVehicle.model,
        driverId: selectedVehicle.driverId || selectedVehicle.id,
        price: null,
        status: 'pending',
        boardingToken,
        usedBonus: useBonusForRide,
        fcmToken: currentFcmToken,
        passengerFcmToken: currentFcmToken,
        createdAt: new Date().toISOString(),
        timestamp: new Date().toISOString()
      });

      // Request and attach fresh FCM token if it wasn't saved yet
      requestPassengerFcmToken(docRef.id).catch(err => console.warn('[FCM] Token update error:', err));

      activeStatusRef.current = 'pending';
      setActiveRideRecord({ 
        ...selectedVehicle, 
        id: docRef.id, 
        status: 'pending', // Explicitly initialize as 'pending' to resolve state conflicts with driver statuses
        price: null,
        usedBonus: useBonusForRide,
        passengerPhoto: passengerProfile?.photoUrl || '',
        pickup, 
        destination, 
        passengerCount,
        boardingToken,
        customerName: passengerProfile ? passengerProfile.name : 'Passageiro de Teste',
        customerPhone: passengerProfile?.backupPhone || passengerProfile?.phone || '+244 9XX XXX XXX',
        pickupAddress: pickup,
        destinationAddress: destination
      });
    } catch (e) {
      console.error("Erro firestore ao criar corrida:", e);
    }
  };

  // Motorista answers, sets a price and sends back to custom passenger UI
  const handleDriverSendPrice = async (priceInput: number) => {
    if (priceInput <= 0) {
      alert("Indique um preço válido.");
      return;
    }
    setNegotiatedPrice(priceInput);
    activeStatusRef.current = 'price_sent';

    if (activeRideRecord?.id) {
      try {
        const rideRef = doc(db, 'calls', activeRideRecord.id);
        await setDoc(rideRef, { 
          price: priceInput, 
          status: 'price_sent' 
        }, { merge: true });
      } catch (err) {
        console.error(err);
      }
    }
    setCallState('offer_received');
  };

  // Passenger confirms proposed price
  const handlePassengerConfirmRide = async () => {
    if (!activeRideRecord?.id) return;

    if (activeRideRecord?.usedBonus) {
      const extraPrice = negotiatedPrice || Number(activeRideRecord?.price || 0);
      const reqBonus = extraPrice; // Use only the trip price, remove the 1000 Kz base
      const currentBonus = Number(passengerProfile?.bonusBalance || 0);
      if (currentBonus < reqBonus) {
        alert(`Bónus Insuficiente! Esta corrida requer ${reqBonus.toLocaleString()} Kz em bónus, mas você possui apenas ${currentBonus.toLocaleString()} Kz.`);
        return;
      }
    }

    try {
      activeStatusRef.current = 'confirmed';
      const rideRef = doc(db, 'calls', activeRideRecord.id);
      await setDoc(rideRef, { 
        status: 'confirmed' 
      }, { merge: true });

      // Save to driver's daily records inside driver_scales as well 
      // or associate with general drivers_master total earnings.
      // Additionally, we persist confirmed ride amounts in localstorage to display in DriverView Rendas if needed.
      try {
        const driverKey = activeRideRecord.driverName || 'general';
        const currentDriverSavedRides = localStorage.getItem(`rides_driver_${driverKey}`) || '[]';
        const driverRides = JSON.parse(currentDriverSavedRides);
        if (Array.isArray(driverRides)) {
          driverRides.push({
            id: activeRideRecord.id,
            price: negotiatedPrice,
            pickup: activeRideRecord.pickup,
            destination: activeRideRecord.destination,
            createdAt: new Date().toISOString()
          });
          localStorage.setItem(`rides_driver_${driverKey}`, JSON.stringify(driverRides));
        }
      } catch (storageErr) {
        console.warn("Local storage save skipped:", storageErr);
      }

      alert("Corrida confirmada! O motorista iniciou viagem.");
      setCallState('ride_confirmed');
    } catch (err) {
      console.error(err);
    }
  };

  // Passenger cancels or opens refusal modal
  const handlePassengerCancelRide = async () => {
    if (!activeRideRecord?.id) return;
    setShowRefusalModal(true);
  };

  const handleConfirmDefinitiveCancellation = async (reason?: string) => {
    if (!activeRideRecord?.id) return;
    try {
      activeStatusRef.current = 'cancelled';
      const rideRef = doc(db, 'calls', activeRideRecord.id);
      await setDoc(rideRef, { 
        status: 'cancelled',
        refusalReason: reason || refusalReasonOption,
        cancelledBy: 'passenger'
      }, { merge: true });
      setShowRefusalModal(false);
      setCallState('cancelled_by_driver');
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendDiscountRequest = async () => {
    if (!activeRideRecord?.id) return;
    setIsSubmittingDiscount(true);
    try {
      const rideRef = doc(db, 'calls', activeRideRecord.id);
      await setDoc(rideRef, {
        status: 'price_negotiation_requested',
        refusalReason: 'Preço Demasiado Alto',
        passengerRequestedDiscount: true,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setCallState('price_negotiation_requested');
      setShowRefusalModal(false);
      alert("Pedido de desconto enviado ao motorista! A aguardar que o motorista defina o novo preço com desconto.");
    } catch (err) {
      console.error("Erro ao enviar pedido de desconto:", err);
      alert("Falha ao enviar solicitação de desconto.");
    } finally {
      setIsSubmittingDiscount(false);
    }
  };

  const handleSendEtaQuestion = async (questionText: string) => {
    if (!activeRideRecord?.id) return;
    setIsSubmittingEtaQuestion(true);
    try {
      const rideRef = doc(db, 'calls', activeRideRecord.id);
      await setDoc(rideRef, {
        passengerAskedEta: true,
        passengerEtaQuestion: questionText,
        askedEtaAt: new Date().toISOString(),
        driverEtaResponse: null,
        driverEta: null,
        eta: null,
        driverEtaResponseAt: null,
        passengerAcceptedEta: false
      }, { merge: true });

      setSelectedEtaQuestion(questionText);
      setIsEtaExpired(false);
      setEtaSentMsg(`Pergunta enviada ao motorista: "${questionText}"`);
      setTimeout(() => setEtaSentMsg(''), 5000);
    } catch (err) {
      console.error("Erro ao perguntar tempo de espera:", err);
    } finally {
      setIsSubmittingEtaQuestion(false);
    }
  };

  // Simulated Driver actions: Ends ride after success
  const handleFinishRideSuccess = async () => {
    if (!activeRideRecord?.id) return;
    try {
      activeStatusRef.current = 'completed';
      const rideRef = doc(db, 'calls', activeRideRecord.id);
      await setDoc(rideRef, { status: 'completed' }, { merge: true });
      setCallState('ride_completed');
    } catch (err) {
      console.error(err);
    }
  };

  const handleRateRide = async (star: number) => {
    setPassengerRating(star);
    if (activeRideRecord?.id) {
      try {
        const rideRef = doc(db, 'calls', activeRideRecord.id);
        const ratingData = { rating: star, passengerRating: star, stars: star, ratedAt: new Date().toISOString() };
        await updateDoc(rideRef, ratingData).catch(() => {
          setDoc(rideRef, ratingData, { merge: true });
        });

        // Also update driver rating in Firestore (drivers & users collections)
        const driverIdToUpdate = activeRideRecord.driverId;
        const driverNameToUpdate = activeRideRecord.driverName;

        if (driverIdToUpdate) {
          const updateDriverDoc = async (collName: string) => {
            try {
              const dRef = doc(db, collName, driverIdToUpdate);
              const dSnap = await getDoc(dRef);
              if (dSnap.exists()) {
                const dData = dSnap.data();
                const currentTotal = Number(dData.totalRatings || 0);
                const currentSum = Number(dData.ratingSum || 0);
                const newTotal = currentTotal + 1;
                const newSum = currentSum + star;
                const newAvg = Number((newSum / newTotal).toFixed(1));
                await updateDoc(dRef, {
                  rating: newAvg,
                  stars: newAvg,
                  totalRatings: newTotal,
                  ratingSum: newSum,
                }).catch(() => {
                  setDoc(dRef, {
                    rating: newAvg,
                    stars: newAvg,
                    totalRatings: newTotal,
                    ratingSum: newSum,
                  }, { merge: true });
                });
              }
            } catch (e) {
              console.warn(`Could not update rating in ${collName}:`, e);
            }
          };

          await updateDriverDoc('drivers');
          await updateDriverDoc('users');
        }

        // If driverName is available, update matching drivers in 'drivers' or 'users'
        if (driverNameToUpdate) {
          const qD = query(collection(db, 'drivers'), where('name', '==', driverNameToUpdate));
          const qSnap = await getDocs(qD);
          qSnap.docs.forEach(async (dSnap) => {
            const dData = dSnap.data();
            const currentTotal = Number(dData.totalRatings || 0);
            const currentSum = Number(dData.ratingSum || 0);
            const newTotal = currentTotal + 1;
            const newSum = currentSum + star;
            const newAvg = Number((newSum / newTotal).toFixed(1));
            await updateDoc(doc(db, 'drivers', dSnap.id), {
              rating: newAvg,
              stars: newAvg,
              totalRatings: newTotal,
              ratingSum: newSum,
            }).catch(() => {});
          });
        }
      } catch (err) {
        console.warn("Could not save rating to Firestore:", err);
      }
    }
  };

  const handleDismissCompletedRide = () => {
    setCallState('idle');
    setActiveRideRecord(null);
    activeStatusRef.current = null;
    setPickup('');
    setDestination('');
    setNegotiatedPrice(0);
    localStorage.removeItem('active_call_id');
  };

  const handleForwardCall = async () => {
    setIsForwardModalOpen(true);
    loadFleetData();
  };

  const handleConfirmForward = async (colleagueId: string) => {
    if (!activeRideRecord?.id) return;
    const selectedColleague = availableVehicles.find(v => v.id === colleagueId);
    if (!selectedColleague) return;

    try {
      const rideRef = doc(db, 'calls', activeRideRecord.id);
      const forwardPayload = { 
        status: 'calling', 
        forwarded: true,
        isForwarded: true,
        vehiclePlate: selectedColleague.plate,
        driverName: selectedColleague.driverName,
        driverPhone: selectedColleague.phone,
        vehicleModel: selectedColleague.model,
        forwardedAt: new Date().toISOString(),
      };
      await setDoc(rideRef, forwardPayload, { merge: true });

      // Sync to 'reencaminhamentos' collection
      await setDoc(doc(db, 'reencaminhamentos', activeRideRecord.id), {
        callId: activeRideRecord.id,
        ...activeRideRecord,
        ...forwardPayload,
        syncedAt: new Date().toISOString(),
      }, { merge: true }).catch(e => console.warn("Sync to reencaminhamentos error:", e));
      
      setCallState('calling');
      setActiveRideRecord((prev: any) => ({
        ...prev,
        forwarded: true,
        vehiclePlate: selectedColleague.plate,
        driverName: selectedColleague.driverName,
        phone: selectedColleague.phone, // Update contact number
        model: selectedColleague.model
      }));
      setIsForwardModalOpen(false);
      alert(`Chamada reencaminhada para ${selectedColleague.driverName}`);
    } catch (err) {
      console.error(err);
    }
  };

  // Helper formatting seconds
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIsUploading(true);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setSelectedAvatar(event.target.result as string);
        }
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className={isEmbed ? "w-full flex flex-col font-sans select-none h-full justify-center items-center" : (isPublicApp ? `h-[100dvh] w-full overflow-hidden flex flex-col font-sans select-none ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'}` : "min-h-screen w-full flex flex-col font-sans select-none")}>
      {/* Header removed by request of Jose Iweza Suana (JIS) */}

      {/* Centered Smartphone Layout - Simulator Controller panel removed for a clean, direct passenger experience by request of José Iweza Suana (JIS) */}
      <div className={isEmbed ? "w-full flex justify-center items-center h-full" : (isPublicApp ? "w-full flex-1 min-h-0 flex flex-col justify-stretch items-stretch" : "p-4 py-8 max-w-sm mx-auto w-full flex justify-center items-center min-h-[calc(100vh-80px)]")}>
        

      {/* Real-time Smartphone structure mockup */}
      <div className={isPublicApp 
        ? `w-full flex flex-col flex-1 min-h-0 bg-transparent overflow-hidden` 
        : `relative mx-auto w-full aspect-[9/18.5] bg-slate-900 rounded-[44px] p-3.5 shadow-2xl border-4 border-slate-800 shadow-slate-950/40 ring-1 ring-white/10 flex flex-col h-[740px] max-h-[90vh] overflow-hidden`
      }>
        
        {/* Dynamic Status bar phone decoration */}
        {!isPublicApp && (
          <div className="absolute top-0 inset-x-0 h-10 bg-slate-900 flex items-end justify-between px-7 pb-1.5 z-[110] select-none text-white shrink-0">
            <span className="text-[10px] font-bold tracking-widest font-mono">09:41</span>
            
            {/* Speaker / Camera Notch */}
            <div className="w-24 h-4 bg-slate-900 rounded-b-xl absolute left-1/2 -translate-x-1/2 top-0" />
            
            <div className="flex items-center gap-1.5 text-white font-mono">
              <Wifi size={10} className="text-white" />
              <span className="text-[9px] font-black tracking-tighter text-white">PSM LTE</span>
              <div className="w-4 h-2.5 border border-white/70 rounded-sm bg-white/20 p-0.5 flex">
                <div className="h-full bg-white flex-1 animate-pulse" />
              </div>
            </div>
          </div>
        )}

        {/* Spacer for phone status bar header inside screen */}
        {!isPublicApp && <div className="h-4 shrink-0 bg-slate-900" />}

        {/* INTERFACE LIVRE E REAL - Passenger App Interactive Screen */}
        <div className={`w-full h-full relative flex flex-col min-h-0 ${isPublicApp ? '' : 'rounded-[30px] shadow-inner'} ${currentTheme.bgClass} transition-colors duration-300 flex-1 overflow-hidden`}>
          
          {/* TOAST NOTIFICATION BANNER SINCRO SUPER TAXI (JIS) - FLUTUANTE COM Z-INDEX IMPEDIDOR DE OVERLAY COVERING */}
          <AnimatePresence>
            {notificationBanner.visible && (
              <motion.div 
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                className={`absolute top-4 left-4 right-4 p-4 sm:p-4.5 rounded-2xl shadow-2xl z-[100] flex items-start gap-3.5 backdrop-blur-md border-2 transition-all ${
                  notificationBanner.type === 'discount'
                    ? 'bg-slate-950/95 border-emerald-400 shadow-emerald-500/30 animate-pulse'
                    : 'bg-slate-900/95 border-amber-500 shadow-amber-500/20'
                }`}
              >
                <div className={`p-2.5 rounded-xl shrink-0 shadow-inner ${
                  notificationBanner.type === 'discount'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                  {notificationBanner.type === 'discount' ? (
                    <Tag size={20} className="animate-bounce" />
                  ) : (
                    <Sparkles size={20} className="animate-ping" />
                  )}
                </div>
                <div className="text-left leading-tight min-w-0 flex-1">
                  <h5 className={`text-xs sm:text-sm font-black uppercase tracking-widest ${
                    notificationBanner.type === 'discount' ? 'text-emerald-400' : 'text-amber-500'
                  }`}>
                    {notificationBanner.title}
                  </h5>
                  <p className="text-xs sm:text-sm text-slate-100 mt-1 leading-snug font-bold">
                    {notificationBanner.message}
                  </p>
                  {notificationBanner.type === 'discount' && (
                    <button
                      onClick={() => {
                        setIsCallMinimized(false);
                        setNotificationBanner(prev => ({ ...prev, visible: false }));
                      }}
                      className="mt-2.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-[10px] uppercase tracking-wider rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Ver e Aceitar Desconto</span>
                      <ArrowRight size={12} />
                    </button>
                  )}
                </div>
                <button 
                  onClick={() => setNotificationBanner(prev => ({ ...prev, visible: false }))}
                  className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors shrink-0 active:scale-95"
                >
                  <X size={16} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Passenger App Interactive Header - Only visible when passenger is logged into their account */}
          {passengerProfile && (
            <header className="p-2.5 sm:p-3 border-b border-white/10 flex items-center justify-between bg-slate-950/90 backdrop-blur-md shrink-0 relative z-50 gap-2 shadow-xl">
              
              {/* 1. BRANDING (SUPER TÁXI PASSAGEIRO OFICIAL - posição e tamanho originais) + PERFIL DO PASSAGEIRO */}
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Brand Logo & Title (Posição e tamanho originais) */}
                <div className="flex items-center gap-2 shrink-0 border-r border-white/10 pr-2.5">
                  <div className={`p-1.5 rounded-xl ${currentTheme.cardClass} border border-white/10 shadow-sm`}>
                    <Car size={14} className={currentTheme.textClass} />
                  </div>
                  <div className="leading-none">
                    <h1 className="text-xs font-black uppercase tracking-tighter italic text-white">SUPER TÁXI</h1>
                    <p className="text-[7.5px] text-amber-400 font-extrabold uppercase tracking-widest leading-none mt-0.5">Passageiro Oficial</p>
                  </div>
                </div>

                {/* Perfil do Passageiro (Foto, Nome, Endereço, Contacto) */}
                <div className="flex items-center gap-2 min-w-0">
                  <div 
                    onClick={() => setShowProfilePicModal(true)} 
                    className="relative shrink-0 cursor-pointer group"
                    title="Clique para trocar foto de perfil"
                  >
                    <PassengerAvatar 
                      src={passengerProfile.photoUrl || selectedAvatar} 
                      name={passengerProfile.name} 
                      size="sm" 
                    />
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-blue-600 rounded-full border border-slate-950 flex items-center justify-center text-white shadow">
                      <Camera size={7} />
                    </div>
                  </div>

                  <div className="min-w-0 leading-tight space-y-0.5">
                    <h2 className="text-[10px] font-black text-white uppercase tracking-tight truncate max-w-[120px]">
                      {passengerProfile.name || 'Passageiro'}
                    </h2>
                    <div className="flex flex-col text-[7.5px] text-slate-400 font-bold leading-none space-y-0.5">
                      <span className="truncate flex items-center gap-0.5">
                        <MapPin size={8} className="text-amber-500 shrink-0" />
                        <span className="truncate max-w-[105px]">{passengerProfile.address || passengerProfile.province || 'Luena, Moxico'}</span>
                      </span>
                      <span className="truncate font-mono flex items-center gap-0.5 text-slate-300">
                        <Phone size={8} className="text-emerald-400 shrink-0" />
                        <span className="truncate max-w-[105px]">{passengerProfile.phone || passengerProfile.backupPhone || '+244'}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. PALETA DE CORES EM CIMA DO MENU DOS TRÊS PONTINHOS (Direita) */}
              <div className="flex flex-col items-end gap-1 shrink-0 ml-auto">
                {/* Paleta de Cores (Cima) */}
                <div className="flex items-center gap-1 bg-slate-900/90 px-2 py-0.5 rounded-full border border-white/10 shadow-inner">
                  {(Object.keys(PALETTES) as PassengerTheme[]).map((pal) => (
                    <button
                      key={pal}
                      onClick={() => handlePaletteChange(pal)}
                      className={`w-3 h-3 rounded-full border transition-all cursor-pointer ${
                        activePalette === pal && hasClickedTheme 
                          ? 'scale-125 border-white shadow-lg ring-2 ring-amber-400/50' 
                          : 'border-white/20 hover:scale-110 opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: PALETTES[pal].accentColor }}
                      title={PALETTES[pal].name}
                    />
                  ))}
                  {hasClickedTheme && (
                    <button
                      onClick={() => {
                        setHasClickedTheme(false);
                        localStorage.removeItem('psm-passenger-theme-clicked');
                      }}
                      className="text-[6.5px] font-black text-amber-400 hover:text-white uppercase tracking-tighter px-0.5 cursor-pointer transition-colors"
                      title="Restaurar cor oficial da companhia"
                    >
                      Reset
                    </button>
                  )}
                </div>

                {/* Menu dos 3 Pontinhos (Baixo) */}
                <div ref={navMenuRef} className="relative z-[60]">
                  <button
                    onClick={() => setIsNavMenuOpen(!isNavMenuOpen)}
                    className={`p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-all active:scale-95 focus:outline-none border border-white/5 bg-black/35 flex items-center justify-center ${
                      isNavMenuOpen ? 'ring-1 ring-amber-500' : ''
                    }`}
                    title="Menu de Opções"
                  >
                    <MoreVertical size={14} />
                  </button>

                  {isNavMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-slate-950 border border-white/10 rounded-xl shadow-2xl z-[100] overflow-hidden py-1 animate-in slide-in-from-top-2 duration-100">
                      <div className="px-3 py-1.5 border-b border-white/5 bg-black/40">
                        <p className="text-[7.5px] text-slate-500 font-extrabold uppercase tracking-widest">Navegação Rápida</p>
                      </div>
                      <button
                        onClick={() => {
                          setPassengerTab('viagem');
                          setIsNavMenuOpen(false);
                        }}
                        className={`w-full text-left px-3.5 py-2.5 text-[10px] font-black uppercase tracking-wider flex items-center gap-2.5 transition-all ${
                          passengerTab === 'viagem'
                            ? 'bg-amber-500 text-slate-950 font-black'
                            : 'text-slate-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <Car size={13} />
                        Pedir Táxi
                      </button>

                      <button
                        onClick={() => {
                          setShowRidesHistoryModal(true);
                          setIsNavMenuOpen(false);
                        }}
                        className="w-full text-left px-3.5 py-2.5 text-[10px] font-black uppercase tracking-wider flex items-center gap-2.5 transition-all text-white hover:bg-white/5 border-b border-white/5 cursor-pointer"
                      >
                        <Trophy size={13} className="text-amber-400" />
                        Minhas Corridas Recentes
                      </button>

                      <button
                        onClick={() => {
                          setPassengerTab('seguranca');
                          setIsNavMenuOpen(false);
                        }}
                        className={`w-full text-left px-3.5 py-2.5 text-[10px] font-black uppercase tracking-wider flex items-center gap-2.5 transition-all ${
                          passengerTab === 'seguranca'
                            ? 'bg-rose-500 text-white font-black'
                            : 'text-slate-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <ShieldCheck size={13} />
                        Segurança
                      </button>

                      <button
                        onClick={() => {
                          setPassengerTab('perfil');
                          setIsNavMenuOpen(false);
                        }}
                        className={`w-full text-left px-3.5 py-2.5 text-[10px] font-black uppercase tracking-wider flex items-center gap-2.5 transition-all ${
                          passengerTab === 'perfil'
                            ? 'bg-[#3b82f6] text-white font-black'
                            : 'text-slate-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <User size={13} />
                        Minha Conta
                      </button>

                      {passengerProfile && (
                        <button
                          onClick={() => {
                            setIsNavMenuOpen(false);
                            handleLogout();
                          }}
                          className="w-full text-left px-3.5 py-2.5 text-[10px] font-black uppercase tracking-wider flex items-center gap-2.5 transition-all text-rose-400 hover:bg-rose-500/10 border-t border-white/5 cursor-pointer"
                        >
                          <LogOut size={13} />
                          Terminar Sessão
                        </button>
                      )}

                      {/* DESCARREGAR APK PASSAGEIRO */}
                      <button
                        onClick={() => {
                          setShowApkDownloadModal(true);
                          setIsNavMenuOpen(false);
                        }}
                        className="w-full text-left px-3.5 py-2.5 text-[10px] font-black uppercase tracking-wider flex items-center gap-2.5 transition-all text-emerald-400 hover:bg-emerald-500/10 border-t border-white/10 mt-1 cursor-pointer"
                      >
                        <Smartphone size={13} className="text-emerald-400" />
                        Download App Android (.APK)
                      </button>

                      {/* INSTALAR APLICAÇÃO (PWA) */}
                      <button
                        onClick={() => {
                          setShowInstallPwaModal(true);
                          setIsNavMenuOpen(false);
                        }}
                        className="w-full text-left px-3.5 py-2.5 text-[10px] font-black uppercase tracking-wider flex items-center gap-2.5 transition-all text-amber-400 hover:bg-amber-500/10 border-t border-white/5 cursor-pointer"
                      >
                        <Download size={13} className="text-amber-400" />
                        Instalar SUPER Táxi Web
                      </button>

                      {/* No collaborator buttons inside passenger app */}
                    </div>
                  )}
                </div>
              </div>
            </header>
          )}


            {/* SCREEN SCROLLABLE AREA */}
            <div className={`flex-1 min-h-0 relative ${passengerTab === 'viagem' && passengerProfile && !passengerProfile.banned ? 'overflow-hidden p-0' : 'overflow-y-auto overscroll-contain touch-pan-y p-5 pb-24'}`}>
              
              {!passengerProfile && passengerTab !== 'seguranca' ? (
                authPortalView === 'welcome' ? (
                  /* WELCOME PORTAL SELECTION PAGE */
                  <div className="space-y-6 py-6 flex flex-col items-center justify-center min-h-[420px]">
                    <div className="text-center space-y-3">
                      <div className="w-16 h-16 bg-blue-500/10 rounded-3xl flex items-center justify-center mx-auto border border-blue-500/20 mb-3 shadow-md">
                        <Car className="text-blue-500" size={32} />
                      </div>

                      <h1 className="text-3xl font-black tracking-tighter uppercase italic leading-none text-center">
                        <span className="text-blue-500">SUPER</span>
                        <span className={`ml-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>TAXI</span>
                      </h1>

                      <div className="flex items-center justify-center gap-2 mt-1">
                        <div className="h-0.5 w-6 bg-blue-500/40" />
                        <p className="text-[11px] text-blue-400 font-black uppercase tracking-[0.3em] whitespace-nowrap">
                          - JIS ANGOLA -
                        </p>
                        <div className="h-0.5 w-6 bg-blue-500/40" />
                      </div>
                    </div>

                    <div className="w-full space-y-3 max-w-sm pt-4">
                      {/* OPTION 1: CREATE ACCOUNT */}
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('register');
                          setAuthPortalView('form');
                        }}
                        className={`w-full p-4 rounded-2xl border text-left flex items-center gap-4 transition-all duration-300 transform active:scale-95 cursor-pointer ${
                          isDark 
                            ? 'bg-white/5 border-white/10 hover:border-amber-500/50 hover:bg-white/[0.08]' 
                            : 'bg-white border-slate-200 hover:border-amber-500/50 hover:bg-amber-50/20'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                          <User size={20} />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-xs font-black uppercase tracking-wider text-amber-500">Criar Perfil</h4>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">Criar uma nova conta de passageiro</p>
                        </div>
                        <ArrowRight size={14} className="text-slate-500 shrink-0" />
                      </button>

                      {/* OPTION 2: LOGIN */}
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('login');
                          setAuthPortalView('form');
                        }}
                        className={`w-full p-4 rounded-2xl border text-left flex items-center gap-4 transition-all duration-300 transform active:scale-95 cursor-pointer ${
                          isDark 
                            ? 'bg-white/5 border-white/10 hover:border-amber-500/50 hover:bg-white/[0.08]' 
                            : 'bg-white border-slate-200 hover:border-amber-500/50 hover:bg-amber-50/20'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                          <Lock size={20} />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-xs font-black uppercase tracking-wider text-amber-500">Entrar se já tiver perfil</h4>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">Aceder a uma conta existente</p>
                        </div>
                        <ArrowRight size={14} className="text-slate-500 shrink-0" />
                      </button>


                    </div>

                    {/* No staff portal buttons in passenger welcome flow */}

                    <p className="text-[8px] text-slate-500 font-extrabold uppercase tracking-widest text-center pt-2">
                      PLATAFORMA AUDITADA • CONTROLADO POR JIS
                    </p>
                  </div>
                ) : (
                  /* PROFILE CREATION OR PORTAL (REGISTER / LOGIN Toggle) */
                  <div className="space-y-4 py-2">
                    <button
                      type="button"
                      onClick={() => setAuthPortalView('welcome')}
                      className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 cursor-pointer transition-colors ${
                        isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      ← Voltar à Seleção
                    </button>

                    <div className="text-center space-y-1">
                      <span className="text-[9px] font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 uppercase tracking-widest italic">PRESTÍGIO MÁXIMO</span>
                      <h2 className="text-lg font-black tracking-tight mt-1">
                        {authMode === 'register' ? 'CRIAR CONTA PASSAGEIRO' : 'ENTRAR NA CONTA'}
                      </h2>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Luena - Moxico • Angola</p>
                    </div>

                    <div className={`flex p-1 rounded-xl border mb-2 ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-200/50 border-slate-300/60'}`}>
                      <button 
                        onClick={() => setAuthMode('register')}
                        className={`flex-1 py-2 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${authMode === 'register' ? currentTheme.btnClass : `text-slate-400 ${isDark ? 'hover:text-white' : 'hover:text-slate-900'}`}`}
                      >
                        Criar Conta
                      </button>
                      <button 
                        onClick={() => setAuthMode('login')}
                        className={`flex-1 py-2 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${authMode === 'login' ? currentTheme.btnClass : `text-slate-400 ${isDark ? 'hover:text-white' : 'hover:text-slate-900'}`}`}
                      >
                        Entrar
                      </button>
                    </div>

                  <AnimatePresence mode="wait">
                  {authMode === 'register' ? (
                    <motion.form 
                      key="register-form"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      onSubmit={handleCreateProfile} 
                      className="space-y-3 pb-28 sm:pb-36"
                    >
                      {/* Clickable Profile Photo */}
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: 0.05 }}
                        className="space-y-2 text-center flex flex-col items-center justify-center py-2"
                      >
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Foto de Perfil</label>
                        <label className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-dashed border-slate-500 hover:border-amber-500 cursor-pointer flex items-center justify-center transition-all bg-slate-900 group shadow-md">
                          {selectedAvatar ? (
                            <img src={selectedAvatar} alt="Foto de Perfil" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-slate-400 group-hover:text-amber-500">
                              <Camera size={20} className="mb-0.5" />
                              <span className="text-[7.5px] font-bold uppercase tracking-wider">Adicionar</span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Camera size={14} className="text-white" />
                          </div>
                          <input type="file" accept="image/*" onChange={handleAvatarFileChange} className="hidden" />
                        </label>
                        <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Toque acima para abrir a galeria</p>
                      </motion.div>

                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: 0.1 }}
                        className="space-y-1"
                      >
                        <label className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome de Passageiro</label>
                        <div className="relative">
                          <User size={12} className="absolute left-3.5 top-3.5 text-slate-500" />
                          <input 
                            type="text" 
                            placeholder="Nome Completo" 
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-xs font-bold outline-none border transition-all ${
                              isDark 
                                ? 'bg-white/5 border-white/10 text-white focus:border-white placeholder-slate-500' 
                                : 'bg-white border-slate-300 text-slate-900 focus:border-slate-500 placeholder-slate-400'
                            }`}
                          />
                        </div>
                      </motion.div>

                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: 0.15 }}
                        className="grid grid-cols-2 gap-3"
                      >
                        <div className="space-y-1">
                          <label className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest ml-1">Idade</label>
                          <select 
                            value={age}
                            onChange={e => setAge(e.target.value)}
                            className={`w-full px-4 py-2.5 rounded-xl text-xs font-bold outline-none border appearance-none transition-all cursor-pointer ${
                              isDark 
                                ? 'bg-white/5 border-white/10 text-white focus:border-white' 
                                : 'bg-white border-slate-300 text-slate-900 focus:border-slate-500'
                            }`}
                          >
                            <option value="" className={isDark ? "bg-slate-800 text-slate-400" : "bg-white text-slate-500"}>Selecione Idade...</option>
                            {Array.from({ length: 73 }, (_, i) => i + 18).map(num => (
                              <option key={num} value={String(num)} className={isDark ? "bg-slate-800 text-white font-bold" : "bg-white text-slate-900 font-bold"}>
                                {num} Anos
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest ml-1">Género</label>
                          <select 
                            value={gender}
                            onChange={e => setGender(e.target.value)}
                            className={`w-full px-4 py-2.5 rounded-xl text-xs font-bold outline-none border appearance-none transition-all ${
                              isDark 
                                ? 'bg-white/5 border-white/10 text-white focus:border-white' 
                                : 'bg-white border-slate-300 text-slate-900 focus:border-slate-500'
                            }`}
                          >
                            <option value="" className={isDark ? "bg-slate-800 text-slate-400" : "bg-white text-slate-500"}>Selecione...</option>
                            <option value="Masculino" className={isDark ? "bg-slate-800 text-white" : "bg-white text-slate-900"}>Masculino</option>
                            <option value="Feminino" className={isDark ? "bg-slate-800 text-white" : "bg-white text-slate-900"}>Feminino</option>
                            <option value="Outro" className={isDark ? "bg-slate-800 text-white" : "bg-white text-slate-900"}>Outro / Mais</option>
                          </select>
                        </div>
                      </motion.div>

                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: 0.2 }}
                        className="space-y-1"
                      >
                        <label className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest ml-1">Província Atual</label>
                        <select 
                          value={province}
                          onChange={e => setProvince(e.target.value)}
                          className={`w-full px-4 py-2.5 rounded-xl text-xs font-bold outline-none border appearance-none transition-all cursor-pointer ${
                            isDark 
                              ? 'bg-white/5 border-white/10 text-white focus:border-white' 
                              : 'bg-white border-slate-300 text-slate-900 focus:border-slate-500'
                          }`}
                        >
                          <option value="" className={isDark ? "bg-slate-800 text-slate-400" : "bg-white text-slate-500"}>Selecione Província...</option>
                          {[
                            "Bengo", "Benguela", "Bié", "Cabinda", "Cuanza Norte", "Cuanza Sul", "Cubango", 
                            "Cunene", "Huambo", "Huíla", "Icolo e Bengo", "Luanda", "Lunda Norte", "Lunda Sul", 
                            "Malanje", "Moxico (Luena)", "Moxico-Leste", "Namibe", "Quando Cubango", "Uíge", "Zaire"
                          ].map((prov) => (
                            <option key={prov} value={prov} className={isDark ? "bg-slate-800 text-white font-bold" : "bg-white text-slate-900 font-bold"}>
                              {prov}
                            </option>
                          ))}
                        </select>
                      </motion.div>

                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: 0.25 }}
                        className="space-y-1"
                      >
                        <label className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest ml-1">Contacto de Backup (Se Offline)</label>
                        <div className="relative">
                          <Phone size={12} className="absolute left-3.5 top-3.5 text-slate-500" />
                          <input 
                            type="text" 
                            placeholder="+244 9XX XXX XXX" 
                            value={backupPhone}
                            onChange={e => {
                              let val = e.target.value;
                              if (!val.startsWith('+244')) val = '+244 ' + val.replace('+244', '').trim();
                              setBackupPhone(val);
                            }}
                            className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-xs font-bold outline-none border transition-all ${
                              isDark 
                                ? 'bg-white/5 border-white/10 text-white focus:border-white placeholder-slate-500' 
                                : 'bg-white border-slate-300 text-slate-900 focus:border-slate-500 placeholder-slate-400'
                            }`}
                          />
                        </div>
                        <p className="text-[8px] text-slate-400 mt-1 font-extrabold uppercase tracking-tight">
                          * Usado se o telemóvel principal estiver offline.
                        </p>
                      </motion.div>

                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: 0.3 }}
                        className="space-y-1"
                      >
                        <label className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest ml-1">Palavra-passe</label>
                        <input 
                          type="password" 
                          placeholder="••••••••" 
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          className={`w-full px-4 py-2.5 rounded-xl text-xs font-bold outline-none border transition-all ${
                            isDark 
                              ? 'bg-white/5 border-white/10 text-white focus:border-white placeholder-slate-500' 
                              : 'bg-white border-slate-300 text-slate-900 focus:border-slate-500 placeholder-slate-400'
                          }`}
                        />
                      </motion.div>

                      {/* Checkbox de Termos e Politica de Segurança */}
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: 0.35 }}
                        className={`flex items-start gap-2.5 border p-3 rounded-xl mt-2 ${isDark ? 'bg-white/5 border-white/5 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                      >
                        <input 
                          type="checkbox" 
                          id="accept_security_terms"
                          checked={acceptedTerms}
                          onChange={(e) => setAcceptedTerms(e.target.checked)}
                          className={`mt-0.5 rounded border-white/10 text-brand-primary ${isDark ? 'accent-slate-800' : 'accent-slate-300'}`}
                        />
                        <label htmlFor="accept_security_terms" className={`text-[10px] font-bold leading-tight cursor-pointer ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                          Aceito e comprometo-me com os{' '}
                          <button 
                            type="button"
                            onClick={() => setShowTermsModal(true)}
                            className="text-amber-400 hover:underline font-extrabold cursor-pointer"
                          >
                            Termos de Segurança e Políticas de Uso
                          </button>{' '}
                          vigentes no ecossistema SUPER Táxi.
                        </label>
                      </motion.div>

                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: 0.4 }}
                      >
                        <button 
                          type="submit"
                          className={`w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${currentTheme.btnClass}`}
                        >
                          Registar e Entrar
                        </button>
                      </motion.div>
                    </motion.form>
                  ) : (
                    <motion.form 
                      key="login-form"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      onSubmit={handleLogin} 
                      className="space-y-4 pt-4 pb-28"
                    >
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: 0.05 }}
                        className="space-y-1"
                      >
                        <label className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome de Utilizador ou Nº de Telefone</label>
                        <div className="relative">
                          <User size={12} className="absolute left-3.5 top-3.5 text-slate-500" />
                          <input 
                            type="text" 
                            placeholder="Nome de utilizador ou Telefone (+244...)" 
                            value={loginName}
                            onChange={e => setLoginName(e.target.value)}
                            className={`w-full pl-10 pr-4 py-3 rounded-xl text-xs font-bold outline-none border transition-all ${
                              isDark 
                                ? 'bg-white/5 border-white/10 text-white focus:border-white placeholder-slate-500' 
                                : 'bg-white border-slate-300 text-slate-900 focus:border-slate-500 placeholder-slate-400'
                            }`}
                          />
                        </div>
                      </motion.div>

                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: 0.1 }}
                        className="space-y-1"
                      >
                        <label className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest ml-1">Palavra-passe</label>
                        <div className="relative">
                          <Lock size={12} className="absolute left-3.5 top-3.5 text-slate-500" />
                          <input 
                            type="password" 
                            placeholder="••••••••" 
                            value={loginPassword}
                            onChange={e => setLoginPassword(e.target.value)}
                            className={`w-full pl-10 pr-4 py-3 rounded-xl text-xs font-bold outline-none border transition-all ${
                              isDark 
                                ? 'bg-white/5 border-white/10 text-white focus:border-white placeholder-slate-500' 
                                : 'bg-white border-slate-300 text-slate-900 focus:border-slate-500 placeholder-slate-400'
                            }`}
                          />
                        </div>
                      </motion.div>

                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: 0.15 }}
                      >
                        <button 
                          type="submit"
                          disabled={isLoggingIn}
                          className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${currentTheme.btnClass} ${isLoggingIn ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {isLoggingIn ? <RefreshCw className="animate-spin" size={14} /> : 'Aceder à Minha Conta'}
                        </button>
                      </motion.div>
                    </motion.form>
                  )}
                  </AnimatePresence>

                  {/* No staff portal buttons in passenger auth portal */}
                </div>
              )
            ) : passengerProfile.banned ? (
                /* RESTRICTED/BANNED VIEW (Requested by JIS) */
                <div className="bg-red-950/45 border border-red-500/25 p-8 rounded-[2rem] text-center space-y-6 shadow-2xl relative overflow-hidden backdrop-blur-md text-white">
                  <div className="absolute -top-12 -left-12 w-40 h-40 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute -bottom-12 -right-12 w-40 h-40 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
                  
                  <div className="w-16 h-16 bg-red-500/15 border border-red-500/35 text-red-400 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                    <AlertOctagon size={32} className="animate-bounce" />
                  </div>
                  
                  <div className="space-y-2">
                    <span className="text-[9px] font-black tracking-widest text-red-400 bg-red-500/15 border border-red-500/25 px-3 py-1 rounded-full uppercase">
                      Acesso Bloqueado / Restringido
                    </span>
                    <h2 className="text-xl font-black text-rose-100 tracking-tight pt-1">
                      CONTA BLOQUEADA PERMANENTEMENTE
                    </h2>
                    <p className="text-[10px] text-slate-450 font-bold uppercase tracking-widest leading-none">
                      TAXICONTROL • OPERADOR PSM COMERCIAL
                    </p>
                  </div>
                  
                  <div className="bg-slate-950 text-slate-300 p-4 border border-white/5 rounded-2xl text-left text-xs leading-relaxed font-semibold">
                    <p className="mb-2 text-rose-450 font-black uppercase text-[10px] tracking-wider">Motivo de Segurança Centralizada:</p>
                    A administração central baniu este utilizador do ecossistema por violação grave de integridade nos nossos serviços de transporte de Luena, Moxico.
                  </div>
                  
                  <p className="text-[11px] text-slate-400 leading-relaxed font-bold">
                    Se julga tratar-se de um mal-entendido ou necessita de assistência de desbloqueio, por favor contacte o suporte oficial de imediato.
                  </p>
                  
                  <button 
                    onClick={() => {
                        localStorage.removeItem('psm-passenger-profile');
                        setPassengerProfile(null);
                        setAuthPortalView('welcome');
                    }}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all cursor-pointer border border-white/5"
                  >
                    Sair da Conta / Registar Outro
                  </button>
                </div>
              ) : (
                /* IN-APP LOGGED-IN PASSENGER HOME VIEW */
                <div className={passengerTab === 'viagem' ? "absolute inset-0 overflow-hidden" : "space-y-4"}>
                   
                  {/* ABA 1: VIAGEM / PEDIDOS */}
                  {passengerTab === 'viagem' && (
                    <div className="absolute inset-0 animate-in fade-in duration-300">
                      
                      {/* Real full-screen background map container */}
                      <div className="absolute inset-0 w-full h-full z-0">
                        {/* Real Leaflet Map */}
                        {/* @ts-ignore */}
                        {React.createElement(MapContainer as any, {
                          center: passengerCoords as any,
                          zoom: callState === 'idle' ? 13 : 14,
                          style: { height: '100%', width: '100%' },
                          zoomControl: false,
                          className: "w-full h-full grayscale-[0.2] contrast-[1.1] dark:invert dark:hue-rotate-180 dark:brightness-[0.75] dark:contrast-[1.25]"
                        }, 
                          <>
                            <RecenterMap center={passengerCoords} zoom={callState === 'idle' ? 13 : 14} />
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                            
                            {/* Passenger Marker */}
                            {/* @ts-ignore */}
                            <Marker position={passengerCoords} icon={passengerIcon}>
                              <Popup>
                                <div className="text-slate-950 text-[10px] font-black uppercase tracking-tight">Sua Localização {isGpsExact ? '(GPS Ativo)' : '(Luena Centro)'}</div>
                              </Popup>
                            </Marker>

                            {/* Render available vehicles or assigned vehicle depending on callState */}
                            {callState === 'idle' ? (
                              availableVehicles.map((vehicle, idx) => {
                                const vLat = vehicle.lat || (passengerCoords[0] + (idx * 0.003) - 0.0015);
                                const vLng = vehicle.lng || (passengerCoords[1] + (idx * 0.003) - 0.0015);
                                const prefixLabel = vehicle.prefix ? `Viatura ${vehicle.prefix}` : 'Viatura Oficial';
                                // @ts-ignore
                                return <Marker key={vehicle.id || idx} position={[vLat, vLng]} icon={driverIconAvailable}>
                                    <Popup>
                                      <div className="text-slate-900 text-xs font-bold p-1 space-y-1">
                                        <p className="font-extrabold uppercase text-[10px] text-amber-500">{prefixLabel}</p>
                                        <p className="text-[9px] text-slate-500 font-mono">Matrícula: {vehicle.plate || 'Sem Matrícula'}</p>
                                        <p className="text-[8px] bg-emerald-100 text-emerald-800 px-1 py-0.5 rounded font-black uppercase">Disponível</p>
                                      </div>
                                    </Popup>
                                  </Marker>;
                              })
                            ) : (
                              (() => {
                                const assigned = availableVehicles.find(v => v.driverName === activeRideRecord?.driverName || v.id === activeRideRecord?.vehicleId);
                                const dLat = assigned?.lat || -11.7825;
                                const dLng = assigned?.lng || 20.0695;
                                const prefixStr = activeRideRecord?.prefix || assigned?.prefix ? `Viatura ${activeRideRecord?.prefix || assigned?.prefix}` : 'Viatura Atribuída';
                                const plateStr = activeRideRecord?.plate || assigned?.plate || 'LD-92-33-PX';
                                // @ts-ignore
                                return <Marker position={[dLat, dLng]} icon={driverIconAssigned}>
                                    <Popup>
                                      <div className="text-slate-900 text-xs font-bold p-1 space-y-1">
                                        <p className="font-extrabold uppercase text-[10px] text-amber-500">{prefixStr}</p>
                                        <p className="text-[9px] text-slate-500 font-mono">Matrícula: {plateStr}</p>
                                        <p className="text-[8px] bg-rose-100 text-rose-850 px-1 py-0.5 rounded font-black uppercase">A Caminho</p>
                                      </div>
                                    </Popup>
                                  </Marker>;
                              })()
                            )}
                          </>
                        )}
                      </div>

                      {/* 1. BLOCO CENTRAL FLUTUANTE À ESQUERDA POR CIMA DO MAPA */}
                      <div className="absolute top-3 left-3 z-20 pointer-events-auto">
                        <div className="bg-slate-950/90 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/10 shadow-2xl flex flex-col items-center justify-center">
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                            <label htmlFor="passenger-company-select" className="text-[7.5px] text-slate-400 font-black uppercase tracking-widest shrink-0">Central:</label>
                            <select
                              id="passenger-company-select"
                              value={activeTenant}
                              onChange={(e) => handleSelectCompany(e.target.value)}
                              className="text-[8.5px] font-black bg-transparent text-amber-400 outline-none uppercase tracking-normal cursor-pointer max-w-[100px] truncate border-0 p-0 focus:ring-0"
                            >
                              {companies.map((comp) => (
                                <option key={comp.id} value={comp.id} className="text-[8.5px] uppercase font-bold bg-slate-950 text-white">
                                  {comp.id === 'psm' ? 'PSMOREIRA' : comp.name || comp.id}
                                </option>
                              ))}
                            </select>
                          </div>
                          <span className="text-[6.5px] text-slate-500 font-black uppercase tracking-widest leading-none mt-0.5">JIS ANGOLA • LUENA</span>
                        </div>
                      </div>

                      {/* 2. CANTO SUPERIOR DIREITO DO MAPA: Monitorização Satélite por cima do Raio Máx */}
                      <div className="absolute top-3 right-3 z-20 flex flex-col items-end gap-1.5 pointer-events-none">
                        {/* Monitorização Satélite Ativa */}
                        <div className="bg-slate-950/90 backdrop-blur px-2.5 py-1 rounded-xl border border-white/10 text-[7.5px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1.5 shadow-lg select-none pointer-events-auto">
                          <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" />
                          Monitorização Satélite Ativa
                        </div>

                        {/* Raio Máx */}
                        <span className="flex items-center gap-1 bg-slate-950/90 text-white text-[7.5px] font-bold px-2 py-1 rounded-xl backdrop-blur border border-white/10 shadow-lg pointer-events-auto select-none">
                          <Compass size={9} className="animate-spin text-amber-500" /> Raio Máx: {appConfig?.searchRadiusKm || 15}km
                        </span>
                        
                        {/* GPS Recenter button */}
                        <button
                          onClick={pullCurrentLocation}
                          className="flex items-center justify-center p-2.5 bg-slate-950/90 text-amber-500 hover:text-amber-450 rounded-xl border border-white/10 shadow-lg hover:bg-slate-900 transition-all active:scale-95 pointer-events-auto cursor-pointer"
                          title="Puxar Minha Localização Atual"
                        >
                          <Navigation size={14} className="fill-amber-500 rotate-45 text-amber-500" />
                        </button>
                      </div>

                      {/* UPPER LAYER FLOATING INFO & CONTROLS: */}
                      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 z-10">
                        {/* Upper panel - for messages, state banner alert (positioned below GPS reorientation button) */}
                        <div className="space-y-2 w-full pointer-events-auto mt-28">
                          {/* Active Background Ride / Call Alert Banner to Resume */}
                          {activeRideRecord && !['completed', 'cancelled', 'rejected', 'ignored'].includes(activeRideRecord.status) && (
                            <div className="bg-slate-900/95 backdrop-blur border border-amber-500/35 p-3 rounded-2xl flex items-center justify-between gap-3 shadow-xl">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="p-2 bg-amber-500 rounded-xl text-slate-950 shrink-0">
                                  <PhoneCall size={14} />
                                </div>
                                <div className="text-left min-w-0 leading-tight">
                                  <p className="text-[10px] font-black text-white truncate leading-none mt-0.5">
                                    {activeRideRecord.status === 'price_sent' ? 'Preço Proposto Enviado!' : 
                                     activeRideRecord.status === 'confirmed' || activeRideRecord.status === 'active' ? 'Viagem Confirmada!' : 'A Negociar / Chamar...'}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  const nextState = activeRideRecord.status === 'price_sent' ? 'offer_received' :
                                                   activeRideRecord.status === 'confirmed' || activeRideRecord.status === 'active' ? 'ride_confirmed' :
                                                   activeRideRecord.status === 'pricing' ? 'pricing' :
                                                   activeRideRecord.status === 'connected' ? 'connected' : 'calling';
                                  setCallState(nextState);
                                  setIsCallMinimized(false);
                                }}
                                className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 transition-colors text-slate-950 font-black text-[8.5px] uppercase tracking-wider rounded-lg shrink-0"
                              >
                                Retomar
                              </button>
                            </div>
                          )}

                          {/* Location Mismatch Alert */}
                          {locationAlert?.show && !dismissedLocationAlert && (
                            <div className="bg-rose-950/95 backdrop-blur border border-rose-500/40 p-3 rounded-2xl flex items-start gap-2.5 shadow-xl text-white relative">
                              <div className="p-1.5 bg-rose-600 rounded-lg shrink-0 text-white mt-0.5">
                                <ShieldAlert size={14} />
                              </div>
                              <div className="text-left leading-snug flex-1 pr-6">
                                <p className="text-[10px] font-black text-rose-300 uppercase tracking-wider leading-none mb-1">Aviso de Localização</p>
                                <p className="text-[9.5px] font-bold text-white">
                                  {locationAlert.msg}
                                </p>
                              </div>
                              <button 
                                onClick={() => setDismissedLocationAlert(true)}
                                className="absolute top-2.5 right-2.5 p-1 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white rounded-lg transition-all active:scale-90"
                                title="Fechar aviso"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          )}

                          {/* Distance Coverage Alert (Haversine > 5km) */}
                          {distanceAlert?.show && !dismissedDistanceAlert && (
                            <div className="bg-amber-950/95 backdrop-blur border border-amber-500/40 p-3 rounded-2xl flex items-start gap-2.5 shadow-xl text-white relative">
                              <div className="p-1.5 bg-amber-600 rounded-lg shrink-0 text-white mt-0.5 animate-pulse">
                                <AlertCircle size={14} />
                              </div>
                              <div className="text-left leading-snug flex-1 pr-6">
                                <p className="text-[10px] font-black text-amber-300 uppercase tracking-wider leading-none mb-1">Aviso de Distância (Haversine)</p>
                                <p className="text-[9.5px] font-bold text-white">
                                  {distanceAlert.msg}
                                </p>
                              </div>
                              <button 
                                onClick={() => setDismissedDistanceAlert(true)}
                                className="absolute top-2.5 right-2.5 p-1 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white rounded-lg transition-all active:scale-90"
                                title="Fechar aviso"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Lower panel - floating bottom sheet containing the welcome greeting + main action cards */}
                        <div className="space-y-3 w-full pointer-events-auto max-h-[60%] overflow-y-auto no-scrollbar bg-transparent border-none shadow-none p-4">
                          {callState === 'idle' ? (
                            <>
                              {/* Custom Welcome Message exactly as loved by JIS */}
                              <div className="space-y-0.5 bg-slate-950/95 border border-white/10 rounded-xl p-3 shadow-xl">
                                <p className="text-[12px] font-black tracking-tight leading-snug text-white">
                                  {appConfig?.customWelcomeMsg || 'Olá! Como o podemos ajudar por Luena hoje?'}
                                </p>
                                <p className="text-[9px] text-amber-400 font-extrabold uppercase tracking-wider">
                                  Bandeirada Base para serviços públicos: <strong className="text-white font-black">{appConfig?.baseFareKz || 500} Kz</strong>
                                </p>
                              </div>

                              {/* Action Buttons inside bottom panel */}
                              <div className="space-y-2.5">
                                {appConfig?.bookingEnabled !== false ? (
                                  <div className="flex flex-col gap-2">
                                    <button 
                                      disabled={!!locationAlert?.show}
                                      onClick={() => {
                                        if (locationAlert?.show) return;
                                        setIsBookModalOpen(true);
                                        loadFleetData();
                                      }}
                                      className={`w-full text-[10px] font-black py-3 px-4 rounded-xl flex items-center justify-between shadow-xl uppercase transition-all duration-300 transform ${
                                        locationAlert?.show 
                                          ? "opacity-50 cursor-not-allowed bg-slate-800 text-slate-500" 
                                          : "active:scale-95 cursor-pointer hover:brightness-110 text-slate-950"
                                      }`}
                                      style={locationAlert?.show ? undefined : { backgroundColor: currentTheme.accentColor }}
                                    >
                                      <span>Pedir Táxi Público</span>
                                      <ArrowRight size={13} className={locationAlert?.show ? "" : "animate-pulse"} />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="w-full bg-slate-950 border border-dashed border-white/15 text-slate-300 text-[9px] font-black py-3 px-4 rounded-xl text-center uppercase shadow-lg">
                                    ⚠️ Chamadas Rápidas Desativadas temporariamente
                                  </div>
                                )}

                                {appConfig?.bookingEnabled !== false && appConfig?.fareEstimateEnabled && (
                                  <div className="bg-slate-950 border border-white/10 p-2.5 rounded-xl text-[9px] flex justify-between items-center text-white shadow-lg">
                                    <div>
                                      <span className="block text-[7.5px] text-amber-400 font-extrabold uppercase tracking-widest">Tarifa Sugerida</span>
                                      <span className="font-bold text-rose-400">Estimativa por percurso</span>
                                    </div>
                                    <div className="text-right font-black">
                                      <span className="block text-[11px] text-white tracking-tighter">{(appConfig?.baseFareKz || 500) + ((appConfig?.perKmFareKz || 250) * 2.5)} <span className="text-[7.5px] opacity-75">Kz</span></span>
                                      <span className="text-[7px] text-slate-400 font-bold">2.5 KM Simulado</span>
                                    </div>
                                  </div>
                                )}

                                <div className="grid grid-cols-2 gap-2 text-[8.5px] font-black uppercase">
                                  {appConfig?.supportChatEnabled ? (
                                    <a 
                                      href={activeWhatsappLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-2.5 bg-[#25D366] hover:bg-[#20ba5a] rounded-xl flex items-center gap-1.5 text-center justify-center text-slate-950 font-black shadow-xl transition-all"
                                    >
                                      <MessageSquare size={11} className="text-slate-950 shrink-0" />
                                      <span>{(activeCompany?.whatsappGroupCustomers || activeCompany?.whatsappGroupLink) ? 'Grupo Clientes' : 'WhatsApp Chat'}</span>
                                    </a>
                                  ) : (
                                    <div className="p-2.5 bg-slate-950 border border-white/5 text-slate-650 rounded-xl text-center justify-center flex items-center gap-1 line-through select-none">
                                      <span>Apoio</span>
                                    </div>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => setShowQrModal(true)}
                                    className="p-2.5 bg-slate-900 border border-white/10 hover:bg-slate-800 rounded-xl flex items-center gap-1.5 text-center justify-center text-amber-400 font-black shadow-xl transition-all cursor-pointer"
                                  >
                                    <QrCode size={11} className="text-amber-500 shrink-0" />
                                    <span>Sugerir App</span>
                                  </button>
                                </div>
                              </div>

                              {appConfig?.driverRatingEnabled && (
                                <div className="bg-gradient-to-br from-amber-500/5 to-yellow-500/5 p-2 rounded-xl border border-amber-500/10 text-[8.5px] text-center space-y-0.5">
                                  <span className="font-extrabold uppercase text-amber-500 block tracking-wider leading-none">Como correu a sua viagem com Carlos?</span>
                                  <div className="flex justify-center gap-1 text-amber-400 text-xs py-0.5">
                                    <span>★</span><span>★</span><span>★</span><span>★</span><span className="opacity-40">★</span>
                                  </div>
                                  <span className="text-[7.5px] text-slate-450 block font-semibold leading-tight">Avaliações contam positivamente para o motorista</span>
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              {/* Destiny Preferido overlay */}
                              <div className="bg-slate-900/90 backdrop-blur p-2.5 rounded-xl border border-white/10 text-center relative">
                                <p className="text-[8.5px] font-black text-slate-300 uppercase tracking-wider leading-none">Destino Preferido</p>
                                <p className="text-[10px] font-black text-white uppercase italic tracking-tight mt-1 truncate">{pickup ? `${pickup} → ${destination}` : 'Luena Central'}</p>
                              </div>

                              {/* TOKEN DE EMBARQUE dinâmico (Segurança TAXICONTROL) */}
                              {(callState === 'ride_confirmed' || (activeRideRecord && ['confirmed', 'active', 'arrived'].includes(activeRideRecord.status))) && activeRideRecord?.boardingToken && (
                                <div className="bg-emerald-500/10 border border-emerald-500/30 p-3.5 rounded-2xl space-y-1 text-center shadow-lg shadow-emerald-500/5">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                                    <span className="text-[8.5px] font-black text-emerald-500 uppercase tracking-widest">Validar Viagem com Motorista</span>
                                  </div>
                                  <div className="text-2xl font-black text-white tracking-[0.2em] font-mono py-0.5 drop-shadow-lg">
                                    {activeRideRecord.boardingToken}
                                  </div>
                                  <p className="text-[8px] text-slate-400 font-bold uppercase tracking-tight italic">
                                    Mostre este código ao motorista para validação.
                                  </p>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                    </div>
                  )}

                  {/* ABA 2: SEGURANÇA E SUPORTE */}
                  {passengerTab === 'seguranca' && (
                    <div className="space-y-3.5 animate-in fade-in duration-300 text-left">
                      {/* RECOMENDAÇÃO DE SEGURANÇA TAXICONTROL - CENTRAL DE PROTEÇÃO */}
                      <div className="bg-slate-900 border border-white/5 rounded-2xl overflow-hidden shadow-xl text-left">
                        <div className="p-3 bg-rose-500/10 border-b border-rose-500/20 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ShieldCheck size={16} className="text-rose-500" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-white">Central de Segurança TAXICONTROL</span>
                          </div>
                          <span className="text-[7.5px] bg-rose-500/20 text-rose-400 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">24/7 Ativa</span>
                        </div>
                        
                        <div className="p-4 space-y-3.5">
                          <div className="flex gap-3 items-start">
                            <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20">
                              <Smartphone size={14} className="text-blue-400" />
                            </div>
                            <div className="space-y-0.5 min-w-0">
                              <p className="text-[10px] font-black text-white uppercase tracking-tight">Contacto de Reenvio Offline</p>
                              <p className="text-[8.5px] text-slate-400 leading-relaxed font-semibold">
                                Se ficar sem internet, a central liga diretamente para o número de emergência guardado no seu perfil.
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-3 items-start">
                            <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 border border-amber-500/20">
                              <RefreshCw size={14} className="text-amber-400" />
                            </div>
                            <div className="space-y-0.5 min-w-0">
                              <p className="text-[10px] font-black text-white uppercase tracking-tight">Chamada Auditada & Reencaminhada</p>
                              <p className="text-[8.5px] text-slate-400 leading-relaxed font-semibold">
                                As chamadas entre passageiros e motoristas são gravadas para auditoria de segurança no Luena.
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-3 items-start">
                            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20">
                              <Lock size={14} className="text-emerald-400" />
                            </div>
                            <div className="space-y-0.5 min-w-0">
                              <p className="text-[10px] font-black text-white uppercase tracking-tight">PIN & Token de Validação</p>
                              <p className="text-[8.5px] text-slate-400 leading-relaxed font-semibold">
                                O código de embarque único garante que você entra na viatura oficial autorizada pela central.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* AÇÕES DIRETA DE SEGURANÇA */}
                      <button
                        onClick={() => setShowComplaintsModal(true)}
                        className={`w-full p-3.5 border rounded-2xl flex items-center justify-between text-left transition-all group cursor-pointer ${
                          isDark 
                            ? 'bg-slate-900 border-white/5 hover:border-rose-500/35 hover:bg-slate-800/80' 
                            : 'bg-white border-slate-200 hover:border-rose-500/35 hover:bg-slate-50 shadow-sm'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0 group-hover:scale-110 transition-transform">
                            <AlertCircle size={16} />
                          </div>
                          <div>
                            <p className={`text-xs font-black uppercase tracking-tight m-0 ${isDark ? 'text-white' : 'text-slate-900'}`}>Reclamações & Ocorrências</p>
                            <p className="text-[8.5px] text-slate-400 font-bold m-0 uppercase tracking-widest">Denunciar conduta ou obter ajuda</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-black text-rose-500 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all">➔</span>
                      </button>

                      {/* CONSULTAR TERMOS DE SEGURANÇA E POLÍTICAS */}
                      <button
                        onClick={() => setShowTermsModal(true)}
                        className={`w-full p-3.5 border rounded-2xl flex items-center justify-between text-left transition-all group cursor-pointer ${
                          isDark 
                            ? 'bg-slate-900 border-white/5 hover:border-amber-500/35 hover:bg-slate-800/80' 
                            : 'bg-white border-slate-200 hover:border-amber-500/35 hover:bg-slate-50 shadow-sm'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0 group-hover:scale-110 transition-transform">
                            <ShieldCheck size={16} />
                          </div>
                          <div>
                            <p className={`text-xs font-black uppercase tracking-tight m-0 ${isDark ? 'text-white' : 'text-slate-900'}`}>Termos & Políticas de Segurança</p>
                            <p className="text-[8.5px] text-slate-400 font-bold m-0 uppercase tracking-widest">Consultar regulamento e privacidade JIS</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-black text-amber-500 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all">➔</span>
                      </button>
                    </div>
                  )}

                  {/* ABA 3: PERFIL E AJUSTES (MINHA CONTA) */}
                  {passengerTab === 'perfil' && (
                    <div className="space-y-3.5 animate-in fade-in duration-300 text-left">
                      
                      {/* CLUB BONUS & OFFERS PANEL (JIS) */}
                      {appConfig?.bonusClubEnabled !== false && (
                        <div className="bg-slate-900 border border-white/5 p-4 rounded-2xl text-left space-y-3 shadow-xl">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 bg-amber-500/10 rounded-xl text-amber-500 border border-amber-500/20">
                                <Gift size={14} />
                              </div>
                              <div>
                                <h4 className="text-[10px] font-black uppercase text-white tracking-wider leading-none">SUPER Táxi Clube de Bónus 🌟</h4>
                                <p className="text-[8px] text-slate-400 font-bold uppercase mt-0.5">Plano de fidelidade & ofertas JIS</p>
                              </div>
                            </div>
                            <span className="text-[8px] bg-emerald-500/10 text-emerald-400 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">{(appConfig?.bonusClubCashbackPercent || 5)}% Cashback</span>
                          </div>

                          {passengerProfile ? (
                            <div className="space-y-1">
                              <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
                                <span className="text-[9px] text-slate-400 font-bold uppercase">Saldo Atual de Bónus:</span>
                                <span className="text-base font-black text-amber-400 font-mono">
                                  {Number(passengerProfile.bonusBalance || 0).toLocaleString()} Kz
                                </span>
                              </div>
                              <p className="text-[8px] text-slate-400 font-bold uppercase tracking-tight text-center pt-1">
                                {Number(passengerProfile.bonusBalance || 0) > 0 
                                  ? "🎉 Utilize este saldo para descontar no valor total das suas corridas!" 
                                  : "Realize viagens para acumular bónus no seu perfil!"}
                              </p>
                            </div>
                          ) : (
                            <div className="text-left py-1 text-slate-400 text-[8.5px] leading-tight font-medium space-y-1">
                              <p>Acumule saldo em cada viagem realizada com motoristas oficiais TaxiControl.</p>
                              <p>Cada corrida atribui-lhe <strong className="text-white font-extrabold">{(appConfig?.bonusClubCashbackPercent || 5)}% de cashback</strong> direto.</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* FORMULÁRIO DE EDIÇÃO DE DADOS DE PERFIL */}
                      <div className={`p-4 border rounded-2xl space-y-3 text-left shadow-xl ${
                        isDark ? 'bg-slate-900 border-white/5 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-sm'
                      }`}>
                        <button
                          type="button"
                          onClick={() => setIsEditProfileOpen(!isEditProfileOpen)}
                          className="w-full flex items-center justify-between text-left focus:outline-none cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <User size={14} className="text-amber-500" />
                            <h4 className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-white' : 'text-slate-900'}`}>Editar Dados do Perfil</h4>
                          </div>
                          <span className="text-[9px] text-amber-400 font-bold uppercase tracking-wider">
                            {isEditProfileOpen ? 'Recolher ▲' : 'Expandir formulário ▼'}
                          </span>
                        </button>

                        {isEditProfileOpen && (
                          <form onSubmit={handleSaveProfile} className="space-y-3 pt-2 animate-in fade-in duration-200">
                            {saveSuccessMsg && (
                              <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-[9.5px] font-bold text-center uppercase tracking-wider animate-bounce">
                                {saveSuccessMsg}
                              </div>
                            )}

                            <div className="space-y-2.5">
                              {/* Campo: Nome */}
                              <div className="space-y-1">
                                <label className="text-[8px] text-slate-400 font-extrabold uppercase tracking-widest">Nome Completo</label>
                                <input
                                  type="text"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  required
                                  className={`w-full text-[10.5px] font-bold rounded-xl px-3 py-2 outline-none border transition-all ${
                                    isDark 
                                      ? 'bg-slate-950 border-white/5 text-white focus:border-amber-500/50 placeholder-slate-600' 
                                      : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-amber-500/50 placeholder-slate-400'
                                  }`}
                                  placeholder="Digite o seu nome completo"
                                />
                              </div>

                              {/* Campo: Província */}
                              <div className="space-y-1">
                                <label className="text-[8px] text-slate-400 font-extrabold uppercase tracking-widest">Província</label>
                                <select
                                  value={editProvince}
                                  onChange={(e) => setEditProvince(e.target.value)}
                                  className={`w-full text-[10.5px] font-bold rounded-xl px-3 py-2 outline-none border cursor-pointer transition-all ${
                                    isDark 
                                      ? 'bg-slate-950 border-white/5 text-white focus:border-amber-500/50' 
                                      : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-amber-500/50'
                                  }`}
                                >
                                  {[
                                    "Bengo", "Benguela", "Bié", "Cabinda", "Cuanza Norte", "Cuanza Sul", "Cubango", 
                                    "Cunene", "Huambo", "Huíla", "Icolo e Bengo", "Luanda", "Lunda Norte", "Lunda Sul", 
                                    "Malanje", "Moxico (Luena)", "Moxico-Leste", "Namibe", "Quando Cubango", "Uíge", "Zaire"
                                  ].map((prov) => (
                                    <option key={prov} value={prov} className={isDark ? "bg-slate-900 text-white font-bold" : "bg-white text-slate-900 font-bold"}>
                                      {prov}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                {/* Campo: Idade */}
                                <div className="space-y-1">
                                  <label className="text-[8px] text-slate-400 font-extrabold uppercase tracking-widest">Idade</label>
                                  <select
                                    value={editAge}
                                    onChange={(e) => setEditAge(e.target.value)}
                                    className={`w-full text-[10.5px] font-bold rounded-xl px-3 py-2 outline-none border cursor-pointer transition-all ${
                                      isDark 
                                        ? 'bg-slate-950 border-white/5 text-white focus:border-amber-500/50' 
                                        : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-amber-500/50'
                                    }`}
                                  >
                                    <option value="" className={isDark ? "bg-slate-900 text-slate-400" : "bg-white text-slate-400"}>Selecionar Idade...</option>
                                    {Array.from({ length: 73 }, (_, i) => i + 18).map(num => (
                                      <option key={num} value={String(num)} className={isDark ? "bg-slate-900 text-white font-bold" : "bg-white text-slate-900 font-bold"}>
                                        {num} Anos
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                {/* Campo: Gênero */}
                                <div className="space-y-1">
                                  <label className="text-[8px] text-slate-400 font-extrabold uppercase tracking-widest">Gênero</label>
                                  <select
                                    value={editGender}
                                    onChange={(e) => setEditGender(e.target.value)}
                                    className={`w-full text-[10.5px] font-bold rounded-xl px-3 py-2 outline-none border cursor-pointer transition-all ${
                                      isDark 
                                        ? 'bg-slate-950 border-white/5 text-white focus:border-amber-500/50' 
                                        : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-amber-500/50'
                                    }`}
                                  >
                                    <option value="" className={isDark ? "bg-slate-900 text-slate-400" : "bg-white text-slate-400"}>Selecionar...</option>
                                    <option value="Masculino" className={isDark ? "bg-slate-900 text-white font-bold" : "bg-white text-slate-900 font-bold"}>Masculino</option>
                                    <option value="Feminino" className={isDark ? "bg-slate-900 text-white font-bold" : "bg-white text-slate-900 font-bold"}>Feminino</option>
                                    <option value="Outro" className={isDark ? "bg-slate-900 text-white font-bold" : "bg-white text-slate-900 font-bold"}>Outro</option>
                                  </select>
                                </div>
                              </div>

                              {/* Campo: Contacto de Emergência */}
                              <div className="space-y-1">
                                <label className="text-[8px] text-slate-400 font-extrabold uppercase tracking-widest">Contacto de Emergência</label>
                                <input
                                  type="tel"
                                  value={editBackupPhone}
                                  onChange={(e) => setEditBackupPhone(e.target.value)}
                                  className={`w-full text-[10.5px] font-bold rounded-xl px-3 py-2 outline-none border transition-all ${
                                    isDark 
                                      ? 'bg-slate-950 border-white/5 text-white focus:border-amber-500/50' 
                                      : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-amber-500/50'
                                  }`}
                                  placeholder="Ex: 923456789"
                                />
                              </div>
                            </div>

                            <button
                              type="submit"
                              disabled={isSavingProfile}
                              className={`w-full py-2 px-4 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all duration-200 active:scale-95 shadow-md cursor-pointer ${
                                isSavingProfile 
                                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                                  : currentTheme.btnClass
                              }`}
                            >
                              {isSavingProfile ? 'A guardar alterações...' : 'Salvar Dados do Perfil'}
                            </button>
                          </form>
                        )}
                      </div>

                      {/* GRELHA DE OUTRAS OPÇÕES DA CONTA */}
                      <div className="grid grid-cols-2 gap-2.5">
                        {/* TROCAR FOTO DE PERFIL BUTTON */}
                        <button
                          onClick={() => setShowProfilePicModal(true)}
                          className={`p-3.5 border rounded-2xl flex flex-col items-center justify-center text-center transition-all group cursor-pointer ${
                            isDark 
                              ? 'bg-slate-900 border-white/5 hover:border-blue-500/35 hover:bg-slate-800/80' 
                              : 'bg-white border-slate-200 hover:border-blue-500/35 hover:bg-slate-50 shadow-sm'
                          }`}
                        >
                          <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0 group-hover:scale-110 transition-transform mb-1.5">
                            <Camera size={16} />
                          </div>
                          <p className={`text-[9.5px] font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Trocar Foto</p>
                          <p className="text-[7.5px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Alterar Avatar</p>
                        </button>

                        {/* SUGERIR APP (CÓDIGO QR) BUTTON */}
                        <button
                          onClick={() => setShowQrModal(true)}
                          className={`p-3.5 border rounded-2xl flex flex-col items-center justify-center text-center transition-all group cursor-pointer ${
                            isDark 
                              ? 'bg-slate-900 border-white/5 hover:border-amber-500/35 hover:bg-slate-800/80' 
                              : 'bg-white border-slate-200 hover:border-amber-500/35 hover:bg-slate-50 shadow-sm'
                          }`}
                        >
                          <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0 group-hover:scale-110 transition-transform mb-1.5">
                            <QrCode size={16} />
                          </div>
                          <p className={`text-[9.5px] font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Sugerir App</p>
                          <p className="text-[7.5px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Código QR</p>
                        </button>
                      </div>

                      {/* BOTAO SAIR DA CONTA */}
                      <button
                        onClick={handleLogout}
                        className="w-full p-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 rounded-2xl flex items-center justify-center gap-2 text-rose-400 font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 cursor-pointer mt-2"
                      >
                        <X size={14} />
                        Sair da Conta / Mudar Usuário
                      </button>

                    </div>
                  )}

                </div>
              )}

            </div>

            {/* Simulated Phone Call Interface Overlay Popup inside smartphone */}
            {callState !== 'idle' && !isCallMinimized && (
              <div className="absolute inset-0 bg-slate-950/95 z-50 p-6 flex flex-col justify-between overflow-y-auto no-scrollbar animate-fade-in text-white text-center">
                
                {callState === 'ride_completed' ? (
                  // BEAUTIFUL SUCCESS RECEIPT VIEW
                  <div className="flex flex-col h-full justify-between py-4 space-y-4">
                    <div className="space-y-4">
                      <div className="w-16 h-16 bg-emerald-500/10 rounded-full mx-auto flex items-center justify-center border border-emerald-500/30">
                        <svg className="w-8 h-8 text-emerald-400 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      
                      <div className="space-y-1">
                        <h3 className="text-lg font-black text-emerald-400 uppercase tracking-wide">Viagem Concluída!</h3>
                        <p className="text-[9px] text-slate-300 font-bold uppercase tracking-widest">Obrigado por Viajar na SUPER Taxi</p>
                      </div>

                      {/* Receipt Card */}
                      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-left space-y-3 mx-2">
                        <p className="text-[9px] font-black text-brand-primary uppercase tracking-widest text-center border-b border-white/5 pb-2">PSM COMERCIAL TAXI - TALÃO</p>
                        
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400 font-bold uppercase">Motorista:</span>
                          <span className="text-white font-black">{activeRideRecord?.driverName || "Motorista Oficial"}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400 font-bold uppercase">Viatura:</span>
                          <span className="text-white font-black">{activeRideRecord?.model || "Viatura Toyota"} ({activeRideRecord?.plate || "--"})</span>
                        </div>
                        
                        <div className="h-px bg-white/10 my-1 border-dashed" />

                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400 font-bold uppercase">Origem:</span>
                          <span className="text-white font-black truncate max-w-[150px]">{activeRideRecord?.pickup || "Luena Centro"}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400 font-bold uppercase">Destino:</span>
                          <span className="text-white font-black truncate max-w-[150px]">{activeRideRecord?.destination || "Aeroporto do Luena"}</span>
                        </div>
                        {activeRideRecord?.passengerCount !== undefined && (
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-400 font-bold uppercase">Passageiros:</span>
                            <span className="text-white font-black font-mono">{activeRideRecord?.passengerCount}</span>
                          </div>
                        )}

                        <div className="h-px bg-white/10 my-1 border-dashed" />

                        <div className="flex justify-between items-center bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/10">
                          <span className="text-[10px] text-emerald-400 font-black uppercase">Preço Pago:</span>
                          <span className="text-xl font-black text-emerald-400">{(negotiatedPrice || activeRideRecord?.price || 0).toLocaleString()} Kz</span>
                        </div>
                      </div>

                      {/* BÓNUS CLUB ALERT BANNER (JIS) */}
                      {appConfig?.bonusClubEnabled !== false && (
                        <div className="bg-amber-500/10 border-2 border-dashed border-amber-500/30 rounded-2xl p-4 mx-2 text-center space-y-2 relative overflow-hidden">
                          <div className="flex items-center justify-center gap-1.5 text-amber-400">
                            <span className="text-xs">✨</span>
                            <span className="text-[9px] font-black uppercase tracking-widest font-sans">CLUBE DE BÓNUS SUPER TÁXI</span>
                            <span className="text-xs">✨</span>
                          </div>
                          
                          {activeRideRecord?.usedBonus === true || activeRideRecord?.paidWithBonus === true ? (
                            <div className="space-y-1">
                              <p className="text-xs font-bold text-slate-200">
                                Usou bónus para pagar esta corrida! Consumiu: <span className="text-amber-400 font-extrabold">{Number(negotiatedPrice || activeRideRecord?.price || 0).toLocaleString()} Kz</span> de bónus.
                              </p>
                              <p className="text-[8px] text-slate-400 uppercase font-black tracking-wider">
                                Saldo Atual de Bónus: {Number(passengerProfile?.bonusBalance || 0).toLocaleString()} Kz
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <p className="text-xs font-bold text-emerald-400">
                                Ganhou <span className="text-emerald-300 font-extrabold">+{Math.round(Number(negotiatedPrice || activeRideRecord?.price || 0) * (Number(appConfig?.bonusClubCashbackPercent || 5) / 100)).toLocaleString()} Kz</span> de bónus nesta corrida!
                              </p>
                              <p className="text-[8px] text-slate-400 uppercase font-black tracking-wider">
                                Saldo Atual de Bónus: {Number(passengerProfile?.bonusBalance || 0).toLocaleString()} Kz
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Interactive Rating Component */}
                      <div className="space-y-2 py-2">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Como avalia o serviço de {activeRideRecord?.driverName || "parceiro"}?</p>
                        <div className="flex justify-center gap-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              onClick={() => handleRateRide(star)}
                              className="transition-transform active:scale-95 duration-200"
                            >
                              <svg
                                className={`w-8 h-8 ${star <= passengerRating ? 'text-amber-400 fill-current' : 'text-slate-600'}`}
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest leading-none">
                          {passengerRating === 5 && "⭐ Excelente Serviço!"}
                          {passengerRating === 4 && "⭐ Bom Serviço"}
                          {passengerRating === 3 && "⭐ Serviço Aceitável"}
                          {passengerRating === 2 && "⭐ Serviço Fraco"}
                          {passengerRating === 1 && "⭐ Muito Mau"}
                        </p>
                      </div>
                    </div>

                    <div className="px-4 pb-2">
                      <button
                        onClick={handleDismissCompletedRide}
                        className="w-full py-4 bg-brand-primary text-slate-950 hover:bg-yellow-500 font-extrabold text-xs uppercase tracking-widest rounded-2xl shadow-xl transition-all"
                      >
                        Recomeçar Nova Viagem
                      </button>
                    </div>
                  </div>
                ) : callState === 'cancelled_by_driver' ? (
                  // BEAUTIFUL REFUSED/CANCELLED OVERLAY
                  <div className="flex flex-col h-full justify-between py-4 space-y-4">
                    <div className="space-y-4 my-auto animate-fade-in">
                      <div className="w-16 h-16 bg-rose-500/10 rounded-full mx-auto flex items-center justify-center border border-rose-500/30">
                        <X className="w-8 h-8 text-rose-500" />
                      </div>
                      
                      <div className="space-y-1">
                        <h3 className="text-lg font-black text-rose-500 uppercase tracking-wide">
                          {activeStatusRef.current === 'cancelled' ? 'Chamada Cancelada' : 
                           activeStatusRef.current === 'missed' ? 'Chamada Perdida (Tempo Expirado)' : 'Chamada Não Atendida'}
                        </h3>
                        <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest leading-normal">
                          {activeStatusRef.current === 'cancelled'
                            ? `A ligação com a viatura ${activeRideRecord?.plate || "--"} foi cancelada e encerrada.`
                            : activeStatusRef.current === 'missed'
                            ? `O tempo limite de chamada de 60 segundos expirou sem que a viatura ${activeRideRecord?.plate || "--"} pudesse atender.`
                            : `A ligação com a viatura ${activeRideRecord?.plate || "--"} foi cancelada, rejeitada ou não pôde ser estabelecida.`}
                        </p>
                      </div>

                      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-left space-y-2 mx-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-bold uppercase">Motorista:</span>
                          <span className="text-white font-black">{activeRideRecord?.driverName || "oficial"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-bold uppercase">Estado Terminal:</span>
                          <span className="text-rose-400 font-black uppercase tracking-wider">{activeRideRecord?.status || "Cancelado/Sem Resposta"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="px-4 pb-2">
                      <button
                        onClick={handleDismissCompletedRide}
                        className="w-full py-4 bg-slate-900 text-white hover:bg-slate-800 font-extrabold text-xs uppercase tracking-widest rounded-2xl shadow-xl transition-all border border-white/10"
                      >
                        Voltar ao Menu Principal
                      </button>
                    </div>
                  </div>
                ) : (
                  // STANDARD ACTIVE CALLING SCREEN WITH INTEGRATED SANDBOX
                  <div className="flex flex-col h-full justify-between space-y-4">
                    
                    {/* Float Minimize Button to go back to menus but keep connection active in background */}
                    <button 
                      onClick={() => setIsCallMinimized(true)}
                      className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 transition-colors rounded-full text-slate-300 z-50 hover:scale-105 active:scale-95"
                      title="Minimizar Chamada (Guarda em Background)"
                    >
                      <X size={16} />
                    </button>

                    {/* Header Call state */}
                    <div className="pt-8 space-y-1.5 shrink-0">
                      <div className="w-14 h-14 bg-white/5 rounded-full mx-auto flex items-center justify-center border border-white/10 relative">
                        <Phone className="text-amber-500 animate-pulse" size={24} />
                        <div className="absolute inset-0 border-2 border-amber-500/40 rounded-full animate-ping" />
                      </div>
                      
                      <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 leading-tight">
                        {activeRideRecord?.status === 'price_sent' ? 'Preço Proposto!' : 
                         activeRideRecord?.status === 'arrived' ? '✨ O MOTORISTA CHEGOU!' :
                         activeRideRecord?.status === 'active' ? '🚀 CORRIDA EM CURSO!' :
                         activeRideRecord?.status === 'confirmed' ? 'Confirmado! A Caminho' :
                         (activeRideRecord?.status === 'completed' || activeRideRecord?.status === 'cancelled' || activeRideRecord?.status === 'rejected' || activeRideRecord?.status === 'ignored') ? 'Chamada Concluída!' :
                         callState === 'calling' ? (activeRideRecord?.forwarded ? 'Reencaminhando Chamada...' : 'A Chamar Motorista...') : 
                         callState === 'connected' ? 'Em Chamada...' : 
                         callState === 'pricing' ? 'Motorista a Escrever Preço...' : 
                         callState === 'offer_received' ? 'Preço Proposto!' : 
                         callState === 'ride_confirmed' ? 'Confirmado! A Caminho' : 'Chamada Concluída!'}
                      </h3>

                      {activeRideRecord?.forwarded && (
                        <div className="bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded inline-block">
                          <p className="text-[8px] font-black uppercase text-amber-500 tracking-tighter">Chamada Reencaminhada pela Central</p>
                        </div>
                      )}

                      <p className="text-[9px] text-slate-400 font-mono tracking-widest uppercase">
                        Tempo: {formatTime(secondsElapsed)}
                      </p>
                    </div>

                    {/* Canal de Voz Ativa Dedicada Sincronizado (JIS) */}
                    {(appConfig?.webrtcEnabled !== false) && (callState === 'connected' || callState === 'pricing' || activeRideRecord?.status === 'connected' || activeRideRecord?.status === 'pricing') && activeRideRecord?.id && (
                      <div className="mx-2 shrink-0">
                        <WebRTCAudioCall
                          callId={activeRideRecord.id}
                          role="passenger"
                          callStatus={activeRideRecord.status || callState}
                          partnerName={activeRideRecord.driverName || "Motorista SUPER TÁXI"}
                          partnerPhone={activeRideRecord.driverPhone}
                        />
                      </div>
                    )}

                    {/* Call details */}
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-2.5 mx-2 shrink-0">
                      <div>
                        <p className="text-[8px] text-slate-400 uppercase tracking-wider leading-none">Viatura Solicitada:</p>
                        <p className="text-xs font-black uppercase tracking-tight text-white mt-1 leading-none">
                          {activeRideRecord?.model} - <span className="text-brand-primary">{activeRideRecord?.plate}</span>
                        </p>
                      </div>

                      <div className="h-px bg-white/10 my-1.5" />

                      <div className="flex justify-between items-center">
                        <div className="text-left">
                          <p className="text-[8px] text-slate-400 uppercase tracking-wider leading-none">Motorista:</p>
                          <p className="text-xs font-black uppercase text-white mt-1 leading-none">
                            {activeRideRecord?.driverName}
                          </p>
                        </div>
                        {activeRideRecord?.passengerCount !== undefined && (
                          <div className="text-right">
                            <p className="text-[8px] text-slate-400 uppercase tracking-wider leading-none">Qtd. Passageiros:</p>
                            <p className="text-xs font-black uppercase text-slate-200 mt-1 leading-none font-mono">
                              {activeRideRecord?.passengerCount} {activeRideRecord?.passengerCount === 1 ? 'Pass' : 'Pass'}
                            </p>
                          </div>
                        )}
                        {(callState === 'offer_received' || activeRideRecord?.status === 'price_sent') && (negotiatedPrice > 0 || (activeRideRecord?.price && Number(activeRideRecord.price) > 0)) && (
                          <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                            <p className="text-[7.5px] uppercase font-bold text-slate-400 tracking-wider leading-none">Valor:</p>
                            <h4 className="text-sm font-black text-emerald-400 leading-none mt-1 animate-pulse">
                              {(negotiatedPrice || Number(activeRideRecord?.price || 0)).toLocaleString()} Kz
                            </h4>
                            {activeRideRecord?.usedBonus && (
                              <p className="text-[7.5px] font-black text-amber-400 uppercase tracking-widest mt-1.5 animate-pulse">
                                🌟 Pago com o seu saldo de bónus
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Partilha de Trajeto Ativo via WhatsApp (JIS) */}
                    {(appConfig?.routeSharingEnabled !== false) && activeRideRecord && activeRideRecord.status === 'active' && (
                      <div className="mx-2 shrink-0 my-1">
                        <button
                          type="button"
                          onClick={() => {
                            const callId = activeRideRecord?.id;
                            if (!validateRideTransactionId(callId)) {
                              setNotificationBanner({
                                title: "⚠️ ID DE TRANSAÇÃO INVÁLIDO",
                                message: "Não foi possível partilhar: A corrida atual não possui um ID de transação válido registado no sistema.",
                                visible: true,
                                type: 'warning'
                              });
                              return;
                            }

                            const driver = activeRideRecord.driverName || "Motorista SUPER Táxi";
                            const plate = activeRideRecord.plate || activeRideRecord.vehiclePlate || "SUPER TÁXI";
                            const model = activeRideRecord.model || activeRideRecord.vehicleModel || "Viatura";
                            const pickupAddr = activeRideRecord.pickup || pickup || "Luena";
                            const destAddr = activeRideRecord.destination || destination || "A definir";
                            
                            const shareUrl = getPassengerShareUrl();
                            const shareText = `*SUPER TÁXI ANGOLA - PARTILHA DE TRAJETO SEGURO* 🚕%0A%0A*Motorista:* ${encodeURIComponent(driver)}%0A*Viatura:* ${encodeURIComponent(model)} (${encodeURIComponent(plate)})%0A*Origem:* ${encodeURIComponent(pickupAddr)}%0A*Destino:* ${encodeURIComponent(destAddr)}%0A*Estado da Viagem:* ${activeRideRecord.status === 'confirmed' ? 'Motorista a caminho do local' : activeRideRecord.status === 'arrived' ? 'Motorista no ponto de recolha' : 'Em deslocamento'}%0A%0A📍 *Acompanhe em tempo real:* ${shareUrl}%0A%0A_Partilhado via SUPER Táxi Angola_`;

                            window.open(`https://api.whatsapp.com/send?text=${shareText}`, '_blank');
                          }}
                          className="w-full py-2.5 px-3 bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/40 text-[#25D366] font-black text-[10px] uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm"
                        >
                          <Share2 size={14} />
                          <span>Partilhar Trajeto Ativo (WhatsApp)</span>
                        </button>
                      </div>
                    )}

                    {/* Call Controls and Actions */}
                    <div className="pb-4 flex flex-col items-center gap-1.5 shrink-0">
                      {(callState === 'offer_received' || activeRideRecord?.status === 'price_sent') ? (
                        <div className="w-full space-y-2 px-2">
                          {activeRideRecord?.usedBonus && Number(passengerProfile?.bonusBalance || 0) < (negotiatedPrice || Number(activeRideRecord?.price || 0)) && (
                            <div className="p-2.5 bg-rose-500/10 border border-rose-500/35 rounded-xl text-center space-y-1 my-1.5">
                              <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest animate-pulse">⚠️ BÓNUS INSUFICIENTE!</p>
                              <p className="text-[8px] text-slate-300 leading-normal">
                                Esta corrida exige <strong>{(negotiatedPrice || Number(activeRideRecord?.price || 0)).toLocaleString()} Kz</strong> de bónus, mas você possui apenas <strong>{Number(passengerProfile?.bonusBalance || 0).toLocaleString()} Kz</strong>.
                              </p>
                            </div>
                          )}
                          <p className="text-[8px] text-slate-400 uppercase leading-none">Deseja confirmar o preço ou recusar esta corrida?</p>
                          <div className="flex gap-2">
                            <button 
                              onClick={handlePassengerConfirmRide}
                              className="flex-1 py-2.5 bg-[#10b981] hover:bg-emerald-600 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-500/20"
                            >
                              Confirmar
                            </button>
                            <button 
                              onClick={handlePassengerCancelRide}
                              className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider rounded-xl"
                            >
                              Recusar
                            </button>
                          </div>
                        </div>
                      ) : (callState === 'ride_confirmed' || activeRideRecord?.status === 'confirmed' || activeRideRecord?.status === 'active') ? (
                        <div className="w-full space-y-3 px-2">
                          <p className="text-xs text-emerald-400 uppercase font-black tracking-widest leading-none">Pedido Ativo & Confirmado</p>
                          
                          {activeRideRecord?.boardingToken && (
                            <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-2xl text-center space-y-2 my-2 shadow-lg shadow-emerald-500/5 animate-pulse">
                              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block">Código de Validação / Token</span>
                              <div className="text-4xl font-black text-white tracking-[0.2em] font-mono leading-none py-1">
                                {activeRideRecord.boardingToken}
                              </div>
                              <p className="text-[9.5px] text-slate-300 font-bold uppercase tracking-tight">
                                Mostre este código ao motorista para carregar/validar o seu embarque!
                              </p>
                            </div>
                          )}

                          {/* ETA Question Interactive Control */}
                          {activeRideRecord?.status !== 'active' && (
                            <div className="p-3 bg-slate-900 border border-blue-500/30 rounded-2xl space-y-2 text-left">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Clock size={12} />
                                Tempo de Espera & Chegada
                                <span className="text-[8px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-extrabold uppercase ml-0.5">
                                  OPCIONAL
                                </span>
                              </span>
                            </div>

                            {(() => {
                              const liveRide = (myRides && activeRideRecord?.id) ? (myRides.find((r: any) => r.id === activeRideRecord.id) || activeRideRecord) : activeRideRecord;
                              const currentDriverEta = liveRide?.driverEtaResponse || liveRide?.driverEta || liveRide?.eta || activeRideRecord?.driverEtaResponse || activeRideRecord?.driverEta || activeRideRecord?.eta;
                              const isEtaAccepted = Boolean(liveRide?.passengerAcceptedEta || activeRideRecord?.passengerAcceptedEta);
                              const hasRealtimeLoc = Boolean(
                                liveRide?.localizacao_tempo_real || 
                                liveRide?.localizacaoTempoReal || 
                                activeRideRecord?.localizacao_tempo_real || 
                                activeRideRecord?.localizacaoTempoReal ||
                                (liveRide?.driverLat && liveRide?.driverLng)
                              );
                              const isNegotiationBlocked = isEtaAccepted || hasRealtimeLoc;

                              return currentDriverEta ? (
                                <div className="bg-emerald-500/15 border border-emerald-500/30 p-3 rounded-xl text-left space-y-2">
                                  <div className="flex items-start justify-between gap-3">
                                    <ETACountdown 
                                      driverEtaResponse={currentDriverEta}
                                      driverEtaResponseAt={liveRide?.driverEtaResponseAt || activeRideRecord?.driverEtaResponseAt}
                                      onCountdownEnd={() => setIsEtaExpired(true)}
                                    />
                                    {isNegotiationBlocked ? (
                                      <span className="text-[9px] font-black uppercase text-emerald-300 bg-emerald-500/30 px-2.5 py-1 rounded-lg border border-emerald-500/40 animate-pulse shrink-0">
                                        ✅ {hasRealtimeLoc ? 'Aguardando Chegada (GPS Vivo)' : 'Tempo Confirmado'}
                                      </span>
                                    ) : (
                                      <span className="text-[8.5px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30 shrink-0">
                                        Pendente
                                      </span>
                                    )}
                                  </div>

                                  {!isNegotiationBlocked && (
                                    <div className="pt-1.5 border-t border-emerald-500/20 flex gap-2">
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          if (!activeRideRecord?.id) return;
                                          try {
                                            const rideRef = doc(db, 'calls', activeRideRecord.id);
                                            await setDoc(rideRef, { 
                                              passengerAcceptedEta: true,
                                              etaStatus: 'accepted'
                                            }, { merge: true });
                                            setEtaSentMsg(`Confirmou e aceitou a previsão de ${currentDriverEta}!`);
                                            setTimeout(() => setEtaSentMsg(''), 5000);
                                          } catch (err) {
                                            console.error("Erro ao aceitar ETA:", err);
                                          }
                                        }}
                                        className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-[10px] uppercase rounded-lg shadow transition-all active:scale-95 flex items-center justify-center gap-1"
                                      >
                                        <Check size={12} />
                                        Aceitar Tempo
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setRefusalReasonOption('Tempo de Espera Muito Alto');
                                          setShowRefusalModal(true);
                                        }}
                                        className="py-2 px-2.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-extrabold text-[9.5px] uppercase rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1"
                                      >
                                        ⏱️ Tempo Muito Alto
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <p className="text-[8.5px] text-slate-400 leading-normal">
                                  {hasRealtimeLoc 
                                    ? "📍 Motorista a caminho com localização em tempo real ativa."
                                    : "Perguntar ao motorista o tempo de demora para chegar:"}
                                </p>
                              );
                            })()}

                            {etaSentMsg && (
                              <div className="text-[9px] text-emerald-400 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20 font-bold">
                                {etaSentMsg}
                              </div>
                            )}

                            {(!(
                              activeRideRecord?.passengerAcceptedEta || 
                              activeRideRecord?.localizacao_tempo_real ||
                              activeRideRecord?.localizacaoTempoReal ||
                              (myRides && activeRideRecord?.id && myRides.find((r: any) => r.id === activeRideRecord.id)?.passengerAcceptedEta) ||
                              (myRides && activeRideRecord?.id && myRides.find((r: any) => r.id === activeRideRecord.id)?.localizacao_tempo_real)
                            ) || isEtaExpired) && (
                              <div className="space-y-1.5">
                                {isEtaExpired && (
                                  <p className="text-[8.5px] text-amber-400 font-bold leading-normal mb-1">
                                    ⏱️ O tempo de previsão expirou! Se o motorista ainda não chegou, pode perguntar novamente:
                                  </p>
                                )}
                                <div className="grid grid-cols-2 gap-1.5">
                                  {[
                                    "Quanto tempo demora a chegar?",
                                    "Qual é a sua previsão de chegada?",
                                    "Já está a caminho do local?",
                                    "Estou no ponto de encontro"
                                  ].map((q) => (
                                    <button
                                      key={q}
                                      disabled={isSubmittingEtaQuestion}
                                      onClick={() => handleSendEtaQuestion(q)}
                                      className={`px-2 py-1.5 text-[9px] font-bold rounded-lg border transition-all text-left truncate ${
                                        selectedEtaQuestion === q
                                          ? 'bg-blue-600 text-white border-blue-400'
                                          : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                                      }`}
                                    >
                                      💬 {q}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          )}

                          <button 
                            onClick={() => setIsCallMinimized(true)}
                            className="w-full py-3 bg-white/10 hover:bg-white/15 text-white font-black text-xs uppercase tracking-wide rounded-xl border border-white/10 active:scale-95 transition-transform"
                          >
                            Minimizar & Voltar ao Menu
                          </button>
                        </div>
                      ) : (
                        /* General Terminate Trigger always accessible */
                        <button 
                          onClick={async () => {
                            if (activeRideRecord?.id) {
                              try {
                                const rideRef = doc(db, 'calls', activeRideRecord.id);
                                await setDoc(rideRef, { status: 'cancelled' }, { merge: true });
                              } catch (err) {
                                console.error("Erro ao cancelar chamada no Firestore:", err);
                              }
                            }
                            setCallState('cancelled_by_driver');
                          }}
                          className="w-12 h-12 bg-rose-600 hover:bg-rose-700 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform shadow-xl hover:bg-rose-550"
                        >
                          <PhoneOff size={20} />
                        </button>
                      )}
                    </div>

                  </div>
                )}

              </div>
            )}

            {/* Smart Booking modal inside Phone frame */}
            {isBookModalOpen && (
              <div className="absolute inset-0 bg-black/75 z-[2000] flex flex-col justify-end">
                <div className="bg-slate-900 border-t border-white/10 rounded-t-[24px] p-6 space-y-4 animate-slide-up text-white max-h-[85%] overflow-y-auto no-scrollbar">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                      <Car size={14} className={currentTheme.textClass} />
                      Pedir Super Táxi
                    </h3>
                    <button 
                      onClick={() => setIsBookModalOpen(false)}
                      className="p-1 hover:bg-white/10 rounded text-slate-400"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Progressive Step Progress Header */}
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950/80 border border-white/10 rounded-xl text-[9px] font-black uppercase text-center shadow-inner">
                    <div className={cn(
                      "py-1.5 rounded-lg transition-all flex items-center justify-center gap-1",
                      pickup.trim() && destination.trim() ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-black" : "bg-amber-500/10 text-amber-400"
                    )}>
                      <span>1. Trajeto</span>
                      {pickup.trim() && destination.trim() && <CheckCircle2 size={11} className="text-emerald-400 animate-pulse" />}
                    </div>
                    <div className="py-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all flex items-center justify-center gap-1 font-black">
                      <span>2. Lotação ({passengerCount})</span>
                      <CheckCircle2 size={11} className="text-amber-400" />
                    </div>
                    <div className={cn(
                      "py-1.5 rounded-lg transition-all flex items-center justify-center gap-1",
                      selectedVehicleId ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-black" : "bg-slate-800/80 text-slate-400"
                    )}>
                      <span>3. Viatura</span>
                      {selectedVehicleId ? <CheckCircle2 size={11} className="text-emerald-400 animate-pulse" /> : null}
                    </div>
                  </div>

                  {/* Progressive Step Helper Callout */}
                  <AnimatePresence>
                    {pickup.trim() && destination.trim() && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0, y: -5 }}
                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -5 }}
                        className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-medium flex items-center gap-2 shadow-sm"
                      >
                        <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                        <span>Trajeto configurado! Confirme o número de passageiros e escolha a viatura abaixo.</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="space-y-3 text-xs">
                    <div className="space-y-1">
                      <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <MapPin size={11} className="text-amber-400" />
                        Ponto de Recolha (Passo 1)
                      </label>
                      <input 
                        className="w-full p-2.5 bg-white/5 border border-white/10 rounded-xl outline-none text-white focus:border-amber-400 font-bold transition-colors" 
                        placeholder="Ex: Aeroporto do Luena" 
                        value={pickup}
                        onChange={e => setPickup(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <Navigation size={11} className="text-amber-400" />
                        Destinos Finais (Passo 1)
                      </label>
                      <input 
                        className="w-full p-2.5 bg-white/5 border border-white/10 rounded-xl outline-none text-white focus:border-amber-400 font-bold transition-colors" 
                        placeholder="Ex: Mercado Central Luena" 
                        value={destination}
                        onChange={e => setDestination(e.target.value)}
                      />
                    </div>

                    {/* Número de Passageiros - Design Atractivo e Interativo */}
                    <div className="space-y-2 bg-white/5 border border-white/10 p-3 rounded-2xl">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Users size={13} />
                          Número de Passageiros (Passo 2)
                        </label>
                        <span className="text-[9px] font-extrabold text-slate-300 bg-white/10 px-2 py-0.5 rounded-full">
                          {passengerCount === 1 ? '1 Passageiro (Individual)' :
                           passengerCount <= 4 ? `${passengerCount} Passageiros (Lotação Padrão)` :
                           `${passengerCount} Passageiros (Lotação Máxima)`}
                        </span>
                      </div>

                      {/* Quick Select Pills with Smooth Scale Animation */}
                      <div className="grid grid-cols-6 gap-1.5">
                        {[1, 2, 3, 4, 5, 6].map((num) => (
                          <motion.button
                            key={num}
                            type="button"
                            whileHover={{ scale: 1.12 }}
                            whileTap={{ scale: 0.85 }}
                            transition={{ type: "spring", stiffness: 500, damping: 15 }}
                            onClick={() => setPassengerCount(num)}
                            className={cn(
                              "py-2 rounded-xl text-xs font-black transition-all flex flex-col items-center justify-center gap-0.5 border cursor-pointer select-none",
                              passengerCount === num 
                                ? "bg-amber-500 text-slate-950 border-amber-300 shadow-lg shadow-amber-500/30 font-mono ring-2 ring-amber-300 scale-105" 
                                : "bg-slate-900/80 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white"
                            )}
                          >
                            <span>{num}</span>
                            <span className="text-[8px] opacity-80">
                              {num === 1 ? '👤' : num <= 4 ? '👥' : '🚐'}
                            </span>
                          </motion.button>
                        ))}
                      </div>

                      {/* Fine-tuning Stepper Bar with Motion Scaling */}
                      <div className="flex items-center gap-2 pt-1">
                        <motion.button 
                          type="button"
                          whileHover={{ scale: 1.12 }}
                          whileTap={{ scale: 0.85 }}
                          transition={{ type: "spring", stiffness: 500, damping: 15 }}
                          onClick={() => setPassengerCount(prev => Math.max(1, prev - 1))}
                          className="w-9 h-9 bg-slate-900/90 border border-white/10 hover:bg-amber-500 hover:text-slate-950 hover:border-amber-400 transition-all text-white font-black rounded-xl text-base flex items-center justify-center cursor-pointer shadow"
                        >
                          -
                        </motion.button>
                        <div className="flex-1 bg-slate-950/80 border border-amber-500/30 rounded-xl py-2 text-center font-black text-xs text-amber-300 font-mono flex items-center justify-center gap-2">
                          <Users size={14} className="text-amber-400" />
                          <span>{passengerCount} {passengerCount === 1 ? 'Passageiro Selecionado' : 'Passageiros Selecionados'}</span>
                        </div>
                        <motion.button 
                          type="button"
                          whileHover={{ scale: 1.12 }}
                          whileTap={{ scale: 0.85 }}
                          transition={{ type: "spring", stiffness: 500, damping: 15 }}
                          onClick={() => setPassengerCount(prev => Math.min(6, prev + 1))}
                          className="w-9 h-9 bg-slate-900/90 border border-white/10 hover:bg-amber-500 hover:text-slate-950 hover:border-amber-400 transition-all text-white font-black rounded-xl text-base flex items-center justify-center cursor-pointer shadow"
                        >
                          +
                        </motion.button>
                      </div>
                    </div>

                    {/* Bloco Viatura Desejada -> Abre Modal de Viaturas em Serviço */}
                    <div className="space-y-2 bg-white/5 border border-white/10 p-3 rounded-2xl">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Car size={13} />
                          Viatura Desejada (Passo 3)
                        </label>
                        <span className="flex items-center gap-1 text-[8.5px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                          {availableVehicles.length} {availableVehicles.length === 1 ? 'Viatura em Serviço' : 'Viaturas em Serviço'}
                        </span>
                      </div>

                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowVehicleSelectModal(true)}
                        className="w-full p-3 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-amber-500/30 text-left transition-all flex items-center justify-between cursor-pointer shadow-md active:scale-98"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-amber-500 text-slate-950 rounded-xl font-black text-xs font-mono shrink-0 shadow-sm">
                            <Car size={16} />
                          </div>
                          <div>
                            <p className="text-xs font-black text-white uppercase tracking-tight">
                              {selectedVehicleId === '' || selectedVehicleId === 'auto'
                                ? 'Qualquer Viatura Disponível'
                                : (availableVehicles.find(v => v.id === selectedVehicleId)?.model || 'Viatura Selecionada')}
                            </p>
                            <p className="text-[9.5px] text-amber-400 font-medium">
                              {selectedVehicleId === '' || selectedVehicleId === 'auto'
                                ? 'Atribuição automática à viatura mais próxima'
                                : `Matrícula: ${availableVehicles.find(v => v.id === selectedVehicleId)?.plate || ''}`}
                            </p>
                          </div>
                        </div>
                        <div className="px-2.5 py-1.5 bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-slate-950 rounded-lg text-[9.5px] font-black uppercase tracking-wider transition-all border border-amber-500/30 flex items-center gap-1 shrink-0">
                          <span>Navegar Frota</span>
                          <ArrowRight size={12} />
                        </div>
                      </motion.button>
                    </div>

                    {/* Club Bonus Redemption options (JIS) */}
                    {appConfig?.bonusClubEnabled !== false && passengerProfile && (
                      <div className="pt-3 border-t border-white/5 space-y-2">
                        {Number(passengerProfile.bonusBalance || 0) > 0 ? (
                          <label className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 cursor-pointer hover:bg-amber-500/20 transition-all">
                            <input 
                              type="checkbox" 
                              checked={useBonusForRide} 
                              onChange={e => setUseBonusForRide(e.target.checked)}
                              className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-white/10 focus:ring-amber-500 focus:ring-opacity-25 cursor-pointer"
                            />
                            <div className="text-left leading-tight">
                              <p className="text-[10px] font-black uppercase text-amber-500 tracking-wider">Trocar Bónus por Viagem</p>
                              <p className="text-[9px] text-slate-300 font-medium">Tem {Number(passengerProfile.bonusBalance || 0).toLocaleString()} Kz de bónus. O preço final proposto pelo motorista será integralmente debitado do seu saldo de bónus.</p>
                            </div>
                          </label>
                        ) : (
                          <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-left leading-tight">
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">SUPER Táxi Clube de Bónus 🌟</p>
                            <p className="text-[9px] text-slate-400 font-medium mt-0.5">
                              Tem <strong className="text-white font-extrabold">{Number(passengerProfile.bonusBalance || 0).toLocaleString()} Kz</strong> acumulados. Faça viagens para acumular bónus e viajar de graça!
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={handleInitiateCall}
                    className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-widest mt-4 flex items-center justify-center gap-2 ${currentTheme.btnClass}`}
                  >
                    <Phone size={12} />
                    PEDIR PREÇO (LIGAR)
                  </button>
                </div>
              </div>
            )}

            {isForwardModalOpen && (
              <div className="absolute inset-0 bg-black/75 z-[2000] flex flex-col justify-end">
                <div className="bg-slate-900 border-t border-white/10 rounded-t-[24px] p-6 space-y-4 animate-slide-up text-white max-h-[85%] overflow-y-auto no-scrollbar">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                      <Navigation size={14} className={currentTheme.textClass} />
                      Reforço / Reencaminhar
                    </h3>
                    <button 
                      onClick={() => setIsForwardModalOpen(false)}
                      className="p-1 hover:bg-white/10 rounded text-slate-400"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <p className="text-slate-400 text-[10px]">
                      Selecione um colega para reencaminhar esta chamada em curso:
                    </p>
                    <div className="space-y-2 mt-4 max-h-48 overflow-y-auto pr-1">
                      {isLoadingFleet ? (
                        <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-center flex items-center justify-center gap-2">
                          <RefreshCw size={12} className="animate-spin text-slate-400" />
                          <span className="text-[10px] text-slate-300">A carregar colegas...</span>
                        </div>
                      ) : availableVehicles.filter(v => v.driverName !== activeRideRecord?.driverName).length === 0 ? (
                        <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-center text-[10px] text-slate-400">
                          Nenhum outro colega disponível no momento.
                        </div>
                      ) : (
                        availableVehicles.filter(v => v.driverName !== activeRideRecord?.driverName).map(veh => (
                          <div 
                            key={veh.id} 
                            onClick={() => handleConfirmForward(veh.id)}
                            className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl cursor-pointer flex items-center justify-between transition-colors group"
                          >
                            <div className="flex flex-col">
                              <span className="text-white font-black text-[11px] uppercase tracking-wide group-hover:text-emerald-400 transition-colors">
                                {veh.driverName}
                              </span>
                              <span className="text-slate-400 font-bold text-[9px] uppercase tracking-wider">
                                {veh.plate} • {veh.model}
                              </span>
                            </div>
                            <Navigation size={14} className="text-slate-500 group-hover:text-emerald-400 transition-colors" />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TELA DEDICADA: HISTÓRICO COMPLETO DE MINHAS CORRIDAS RECENTES (JIS) */}
            {showRidesHistoryModal && (
              <div className="absolute inset-0 bg-slate-950 z-[2000] flex flex-col p-4 sm:p-5 overflow-hidden animate-in slide-in-from-bottom duration-300 text-white">
                {/* Header da Tela Dedicada - FIXO */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3 shrink-0 bg-slate-950">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
                      <Trophy size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white truncate">
                          Minhas Corridas Recentes
                        </h3>
                        <span className="text-[8px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full uppercase shrink-0">
                          {myRides.length} {myRides.length === 1 ? 'Viagem' : 'Viagens'}
                        </span>
                      </div>
                      <p className="text-[8.5px] text-slate-400 font-extrabold uppercase tracking-widest truncate mt-0.5">
                        Tela Individual • Histórico Completo SUPER Táxi
                      </p>
                    </div>
                  </div>

                  <button 
                    onClick={() => setShowRidesHistoryModal(false)}
                    className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all active:scale-95 shrink-0 border border-white/5 cursor-pointer"
                    title="Fechar Tela"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Lista de Corridas - NAVEGAÇÃO E SCROLL APENAS AQUI */}
                <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 pb-8 pr-0.5">
                  {myRides.length === 0 ? (
                    <div className="p-8 text-center bg-white/5 rounded-2xl border border-white/5 space-y-3 my-auto">
                      <div className="w-14 h-14 bg-amber-500/10 rounded-2xl mx-auto flex items-center justify-center text-amber-500 border border-amber-500/20">
                        <Car size={28} className="animate-pulse" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-slate-200 uppercase font-black">Nenhuma corrida registada ainda</p>
                        <p className="text-[9.5px] text-slate-400 font-bold max-w-xs mx-auto">
                          Os seus pedidos de SUPER Táxi no Luena e Moxico ficarão arquivados detalhadamente nesta tela individual.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setShowRidesHistoryModal(false);
                          setPassengerTab('viagem');
                        }}
                        className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl ${currentTheme.btnClass} cursor-pointer inline-block`}
                      >
                        Pedir a Sua Primeira Corrida Agora
                      </button>
                    </div>
                  ) : (
                    myRides.map((rd: any) => (
                      <div 
                        key={rd.id} 
                        className="p-4 bg-slate-900/90 border border-white/10 hover:border-amber-500/30 rounded-2xl space-y-3 text-xs shadow-lg transition-all"
                      >
                        {/* Header da Corrida */}
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-extrabold uppercase">
                            <Clock size={11} className="text-amber-500" />
                            <span>
                              {rd.createdAt ? new Date(rd.createdAt).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Data Recente'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {getRideStatusBadge(rd, true)}
                            {(rd.usedBonus === true || rd.paidWithBonus === true || rd.paymentMethod === 'bonus') && (
                              <span className="text-[7.5px] font-black px-1.5 py-0.5 rounded border uppercase bg-amber-500/10 text-amber-400 border-amber-500/20">
                                🎁 Debitado por Bónus
                              </span>
                            )}
                            <span className="text-xs font-black text-amber-400 font-mono">
                              {getRidePriceText(rd)}
                            </span>
                          </div>
                        </div>

                        {/* Rota (Origem -> Destino) */}
                        <div className="space-y-1.5 bg-black/40 p-2.5 rounded-xl border border-white/5">
                          <div className="flex items-start gap-2">
                            <MapPin size={12} className="text-emerald-400 shrink-0 mt-0.5" />
                            <div>
                              <span className="text-[7.5px] font-extrabold text-emerald-400 uppercase tracking-widest block leading-none">Ponto de Recolha</span>
                              <span className="text-[10.5px] font-extrabold text-white">{rd.pickup}</span>
                            </div>
                          </div>
                          <div className="h-px bg-white/5 border-dashed my-1" />
                          <div className="flex items-start gap-2">
                            <Navigation size={12} className="text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <span className="text-[7.5px] font-extrabold text-amber-400 uppercase tracking-widest block leading-none">Destino Final</span>
                              <span className="text-[10.5px] font-extrabold text-white">{rd.destination}</span>
                            </div>
                          </div>
                        </div>

                        {/* Detalhes do Motorista e Viatura */}
                        <div className="grid grid-cols-2 gap-2 text-[9.5px]">
                          <div className="p-2 bg-white/5 rounded-xl border border-white/5">
                            <span className="text-[7.5px] text-slate-400 font-bold uppercase block">Motorista Atribuído</span>
                            <span className="font-extrabold text-white truncate block">{rd.driverName || 'Não Alocado'}</span>
                          </div>
                          <div className="p-2 bg-white/5 rounded-xl border border-white/5">
                            <span className="text-[7.5px] text-slate-400 font-bold uppercase block">Viatura & Matrícula</span>
                            <span className="font-extrabold text-slate-200 truncate block">
                              {rd.model || 'Táxi'} {rd.vehiclePlate ? `(${rd.vehiclePlate})` : ''}
                            </span>
                          </div>
                        </div>

                        {/* Token de Embarque e Avaliação */}
                        <div className="flex items-center justify-between text-[9px] pt-1">
                          {rd.boardingToken && (
                            <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                              <ShieldCheck size={11} className="text-emerald-400" />
                              <span className="text-slate-300 font-bold uppercase">Token Validação:</span>
                              <strong className="text-emerald-400 font-mono font-black">{rd.boardingToken}</strong>
                            </div>
                          )}

                          {(rd.rating || rd.passengerRating || rd.stars) ? (
                            <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg text-amber-400 font-black ml-auto">
                              <span>★ {rd.rating || rd.passengerRating || rd.stars}</span>
                              <span className="text-[8px] text-slate-400 uppercase font-bold">Avaliado</span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* MODAL 2: ALTERAR/TROCAR FOTO DE PERFIL (JIS) */}
            {showProfilePicModal && (
              <div className="absolute inset-0 bg-black/85 z-[2000] flex flex-col justify-end">
                <div className="bg-slate-900 border-t border-white/10 rounded-t-[24px] p-6 space-y-4 animate-slide-up text-white max-h-[85%] overflow-y-auto no-scrollbar">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                       <Camera size={14} className="text-amber-500" />
                       Atualizar Foto de Perfil
                    </h3>
                    <button 
                      onClick={() => setShowProfilePicModal(false)}
                      className="p-1 hover:bg-white/10 rounded text-slate-400"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="space-y-4 py-4 text-center flex flex-col items-center justify-center">
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">Clique na foto abaixo para abrir a galeria e escolher uma nova imagem de perfil:</p>
                    
                    <label className="relative w-32 h-32 rounded-full overflow-hidden border-2 border-dashed border-amber-500/60 hover:border-amber-500 cursor-pointer flex items-center justify-center transition-all bg-slate-950 group shadow-2xl">
                      {passengerProfile?.photoUrl || selectedAvatar ? (
                        <img 
                          src={passengerProfile?.photoUrl || selectedAvatar} 
                          alt="Foto Atual" 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-400 group-hover:text-amber-500">
                          <Camera size={32} className="mb-1" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Escolher</span>
                        </div>
                      )}
                      
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity">
                        <Upload size={20} className="text-white mb-1 animate-bounce" />
                        <span className="text-[8px] text-white font-black uppercase tracking-widest">Alterar</span>
                      </div>

                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            const file = e.target.files[0];
                            setIsUploading(true);
                            const reader = new FileReader();
                            reader.onload = async (event) => {
                              if (event.target?.result) {
                                const base64 = event.target.result as string;
                                setSelectedAvatar(base64);
                                const updated = { ...passengerProfile, photoUrl: base64 };
                                setPassengerProfile(updated);
                                localStorage.setItem('psm-passenger-profile', JSON.stringify(updated));
                                
                                // Also persist to Firestore
                                try {
                                  if (passengerProfile?.id) {
                                    await updateDoc(doc(db, 'passengers', passengerProfile.id), { photoUrl: base64 });
                                  } else if (passengerProfile?.name) {
                                    const q = query(collection(db, 'passengers'), where('name', '==', passengerProfile.name));
                                    const snap = await getDocs(q);
                                    if (!snap.empty) {
                                      await updateDoc(doc(db, 'passengers', snap.docs[0].id), { photoUrl: base64 });
                                    }
                                  }
                                } catch (err) {
                                  console.error("Erro ao persistir imagem carregada no Firestore:", err);
                                }
                              }
                              setIsUploading(false);
                              setShowProfilePicModal(false);
                            };
                            reader.readAsDataURL(file);
                          }
                        }} 
                        className="hidden" 
                      />
                    </label>

                    {isUploading && (
                      <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest animate-pulse">A carregar imagem do dispositivo...</p>
                    )}

                    <p className="text-[8px] text-slate-500 font-extrabold uppercase tracking-widest mt-2">Toque acima para selecionar uma foto da sua galeria</p>
                  </div>

                  <button
                    onClick={() => setShowProfilePicModal(false)}
                    className="w-full mt-4 py-2.5 bg-white/5 border border-white/10 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-white/10"
                  >
                    Concluído
                  </button>
                </div>
              </div>
            )}

            {/* MODAL 3: RECLAMAÇÕES & PROTEÇÃO (JIS) */}
            {showComplaintsModal && (
              <div className="absolute inset-0 bg-black/85 z-[2000] flex flex-col justify-end">
                <div className="bg-slate-900 border-t border-white/10 rounded-t-[24px] p-6 space-y-4 animate-slide-up text-white max-h-[92%] overflow-y-auto no-scrollbar">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                      <AlertCircle size={14} className="text-rose-500" />
                      Reclamações & Proteção do Passageiro
                    </h3>
                    <button 
                      onClick={() => {
                        setShowComplaintsModal(false);
                        setComplaintText('');
                        setComplaintSuccessMsg('');
                      }}
                      className="p-1 hover:bg-white/10 rounded text-slate-400"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* SUB-TABS: MINHAS RECLAMAÇÕES vs NOVA RECLAMAÇÃO */}
                  <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-white/10">
                    <button
                      onClick={() => setComplaintModalTab('my_complaints')}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                        complaintModalTab === 'my_complaints'
                          ? 'bg-brand-primary text-white shadow-md'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <span>Minhas Reclamações</span>
                      {passengerComplaints.length > 0 && (
                        <span className={`px-1.5 py-0.2 rounded-full text-[8.5px] font-black ${
                          complaintModalTab === 'my_complaints' ? 'bg-white/20 text-white' : 'bg-rose-500/20 text-rose-400'
                        }`}>
                          {passengerComplaints.length}
                        </span>
                      )}
                    </button>

                    <button
                      onClick={() => {
                        setComplaintModalTab('new_complaint');
                        setComplaintSuccessMsg('');
                      }}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                        complaintModalTab === 'new_complaint'
                          ? 'bg-brand-primary text-white shadow-md'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <span>+ Nova Reclamação</span>
                    </button>
                  </div>

                  {/* TAB 1: MINHAS RECLAMAÇÕES */}
                  {complaintModalTab === 'my_complaints' && (
                    <div className="space-y-4">
                      {passengerComplaints.length === 0 ? (
                        <div className="py-8 px-4 text-center space-y-3 bg-slate-950/60 rounded-2xl border border-white/5">
                          <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                            <ShieldAlert size={22} />
                          </div>
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-200">Sem Reclamações Registadas</h4>
                          <p className="text-[10px] text-slate-400 leading-relaxed font-bold max-w-xs mx-auto">
                            Se tiver alguma ocorrência (excesso de velocidade, perda de objeto, mau atendimento), registe aqui para a central de fiscalização auditá-la.
                          </p>
                          <button
                            onClick={() => setComplaintModalTab('new_complaint')}
                            className={`px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest ${currentTheme.btnClass}`}
                          >
                            Submeter Reclamação
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-slate-400 px-1">
                            <span>Total ({passengerComplaints.length})</span>
                            <div className="flex gap-2">
                              <span className="text-amber-400">
                                {passengerComplaints.filter(c => c.status !== 'resolved').length} Pendentes
                              </span>
                              <span className="text-emerald-400">
                                {passengerComplaints.filter(c => c.status === 'resolved').length} Resolvidas
                              </span>
                            </div>
                          </div>

                          <div className="space-y-3 max-h-[380px] overflow-y-auto no-scrollbar pr-0.5">
                            {passengerComplaints.map((item) => {
                              const isResolved = item.status === 'resolved';
                              const dateStr = item.createdAt?.seconds 
                                ? new Date(item.createdAt.seconds * 1000).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                : (item.timestamp ? new Date(item.timestamp).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recente');

                              const getTypeLabel = (t: string) => {
                                switch(t) {
                                  case 'excesso_velocidade': return 'Excesso de Velocidade (>80km/h)';
                                  case 'mau_atendimento': return 'Conduta Inadequada / Mau Atendimento';
                                  case 'perda_objeto': return 'Perda de Objeto Pessoal';
                                  case 'falta_troco': return 'Problema de Preço / Troco';
                                  case 'pane_viatura': return 'Avaria / Falha Técnica';
                                  case 'eliminar_conta': return 'Eliminar Conta / Dados';
                                  default: return t ? t.replace('_', ' ').toUpperCase() : 'Reclamação Operacional';
                                }
                              };

                              return (
                                <div 
                                  key={item.id}
                                  className={`p-3.5 rounded-2xl border space-y-3 transition-all ${
                                    isResolved
                                      ? 'bg-slate-950/80 border-emerald-500/30'
                                      : 'bg-slate-950/80 border-amber-500/30'
                                  }`}
                                >
                                  {/* Header Item */}
                                  <div className="flex items-start justify-between gap-2 border-b border-white/5 pb-2">
                                    <div className="space-y-1">
                                      <span className="px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider bg-slate-800 text-slate-200 border border-white/10 inline-block">
                                        {getTypeLabel(item.type)}
                                      </span>
                                      <p className="text-[8.5px] text-slate-400 font-extrabold uppercase tracking-tight">
                                        Viatura: <span className="text-white">{item.vehicle || 'Não especificada'}</span>
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <span className="text-[8.5px] font-bold text-slate-400">
                                        {dateStr}
                                      </span>
                                      <button
                                        onClick={async () => {
                                          if (confirm("Tem certeza de que deseja eliminar esta reclamação do seu histórico?")) {
                                            try {
                                              await deleteDoc(doc(db, 'complaints', item.id));
                                              setPassengerComplaints(prev => prev.filter(c => c.id !== item.id));
                                            } catch (err) {
                                              console.error("Erro ao eliminar reclamação:", err);
                                              alert("Não foi possível eliminar a reclamação.");
                                            }
                                          }
                                        }}
                                        className="w-6 h-6 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/20 flex items-center justify-center transition-all shrink-0 ml-1 active:scale-90"
                                        title="Eliminar reclamação do histórico"
                                      >
                                        <X size={12} />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Description */}
                                  <p className="text-[10.5px] font-medium text-slate-300 leading-relaxed bg-slate-900/60 p-2.5 rounded-xl border border-white/5 whitespace-pre-wrap">
                                    "{item.description}"
                                  </p>

                                  {/* Status Banner */}
                                  <div className="pt-0.5">
                                    {!isResolved ? (
                                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2 text-amber-400">
                                        <Clock size={14} className="shrink-0 mt-0.5 animate-pulse" />
                                        <div className="space-y-0.5">
                                          <p className="text-[9.5px] font-black uppercase tracking-wider m-0">
                                            PENDENTE • Em Análise na Central JIS
                                          </p>
                                          <p className="text-[8.5px] text-amber-300/80 font-bold leading-tight m-0">
                                            A fiscalização em Luena-Moxico está a auditar este caso. Receberá atualizações aqui.
                                          </p>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="space-y-2.5">
                                        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-2 text-emerald-400">
                                          <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                                          <div className="space-y-0.5">
                                            <p className="text-[9.5px] font-black uppercase tracking-wider m-0">
                                              RESOLVIDO • Concluído pela Central JIS
                                            </p>
                                            <p className="text-[8.5px] text-emerald-300/80 font-bold leading-tight m-0">
                                              {item.resolvedBy ? `Tratado por: ${item.resolvedBy}` : 'Atendido e resolvido pelo departamento de operações.'}
                                            </p>
                                          </div>
                                        </div>

                                        {/* SATISFACTION FEEDBACK SECTION */}
                                        {item.satisfaction && editingSatisfactionId !== item.id ? (
                                          <div className="space-y-2">
                                            <div className="p-2.5 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                              {item.satisfaction === 'satisfied' ? (
                                                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                                                  <ThumbsUp size={12} />
                                                </div>
                                              ) : (
                                                <div className="w-6 h-6 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                                                  <ThumbsDown size={12} />
                                                </div>
                                              )}
                                              <div>
                                                <p className="text-[9px] font-black uppercase tracking-wider text-white m-0">
                                                  Satisfação: {item.satisfaction === 'satisfied' ? '😊 Satisfeito com o atendimento' : '🙁 Insatisfeito com a resolução'}
                                                </p>
                                                {item.satisfactionComment && (
                                                  <p className="text-[8.5px] text-slate-400 font-bold m-0 italic">
                                                    "{item.satisfactionComment}"
                                                  </p>
                                                )}
                                              </div>
                                            </div>
                                            <button
                                              onClick={() => {
                                                setEditingSatisfactionId(item.id);
                                                setSatisfactionComments({ ...satisfactionComments, [item.id]: item.satisfactionComment || '' });
                                              }}
                                              className="text-[8px] font-black uppercase text-slate-400 hover:text-white underline shrink-0"
                                            >
                                              Alterar
                                            </button>
                                          </div>

                                          {item.satisfaction === 'unsatisfied' && (
                                            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 space-y-2 text-rose-200 mt-2">
                                              <div className="flex items-center gap-2">
                                                <AlertCircle size={15} className="text-rose-400 shrink-0 animate-pulse" />
                                                <p className="text-[9.5px] font-black uppercase tracking-wider text-rose-300 m-0">
                                                  Contacte a Central JIS Improrrogavelmente
                                                </p>
                                              </div>
                                              <p className="text-[8.5px] font-bold text-slate-300 leading-tight m-0">
                                                Lamentamos que a solução não tenha atendido às suas expectativas. Entre em contacto imediato com a fiscalização da Central no WhatsApp para suporte e revisão do processo.
                                              </p>
                                              <a
                                                href={activeWhatsappLink}
                                                target="_blank"
                                                referrerPolicy="no-referrer"
                                                className="w-full py-2 bg-[#25D366] hover:bg-[#20ba5a] text-slate-950 font-black text-[9.5px] uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95"
                                              >
                                                <MessageSquare size={13} /> Contactar Central no WhatsApp Agora
                                              </a>
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                          <div className="p-3 bg-slate-900 rounded-xl border border-white/10 space-y-2">
                                            <p className="text-[9px] font-black uppercase tracking-wider text-slate-200">
                                              Ficou satisfeito com a resolução desta reclamação?
                                            </p>

                                            <input
                                              type="text"
                                              className="w-full p-2 bg-slate-950 border border-white/10 rounded-lg text-[9px] text-white placeholder-slate-500 outline-none focus:border-emerald-500 font-bold"
                                              placeholder="Deixe um comentário curto (opcional)..."
                                              value={satisfactionComments[item.id] || ''}
                                              onChange={e => setSatisfactionComments({ ...satisfactionComments, [item.id]: e.target.value })}
                                            />

                                            <div className="flex items-center gap-2 pt-1">
                                              <button
                                                onClick={() => handleSatisfactionSubmit(item.id, 'satisfied')}
                                                disabled={submittingSatisfactionId === item.id}
                                                className="flex-1 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-400 rounded-lg font-black text-[9px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
                                              >
                                                <ThumbsUp size={11} /> Satisfeito 😊
                                              </button>

                                              <button
                                                onClick={() => handleSatisfactionSubmit(item.id, 'unsatisfied')}
                                                disabled={submittingSatisfactionId === item.id}
                                                className="flex-1 py-2 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-400 rounded-lg font-black text-[9px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
                                              >
                                                <ThumbsDown size={11} /> Insatisfeito 🙁
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: NOVA RECLAMAÇÃO */}
                  {complaintModalTab === 'new_complaint' && (
                    <div>
                      {complaintSuccessMsg ? (
                        <div className="space-y-4 py-6 text-center">
                          <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                            <Check size={24} />
                          </div>
                          <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400">Reclamação Submetida</h4>
                          <p className="text-[10px] text-slate-300 leading-relaxed uppercase font-bold max-w-sm mx-auto">
                            {complaintSuccessMsg}
                          </p>
                          <button
                            onClick={() => {
                              setComplaintModalTab('my_complaints');
                              setComplaintText('');
                              setComplaintSuccessMsg('');
                            }}
                            className={`w-full py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest ${currentTheme.btnClass}`}
                          >
                            Ver nas Minhas Reclamações
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-4 text-xs">
                          <p className="text-[9.5px] text-slate-400 font-bold uppercase tracking-tight">
                            {passengerProfile?.name ? <strong className="text-white">{passengerProfile.name}</strong> : 'Estimado(a) Passageiro(a)'}, utilize esta área para reportar qualquer má conduta ou infração operacional à central de fiscalização TaxiControl (JIS ANGOLA).
                          </p>

                          <div className="space-y-1.5">
                            <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest">Tipo de Ocorrência</label>
                            <select
                              className="w-full p-2.5 bg-slate-950 border border-white/10 rounded-xl outline-none text-white focus:border-white font-bold"
                              value={complaintType}
                              onChange={e => setComplaintType(e.target.value)}
                            >
                              <option value="excesso_velocidade">Excesso de Velocidade (&gt;80km/h)</option>
                              <option value="mau_atendimento">Conduta Inadequada / Mau Atendimento</option>
                              <option value="perda_objeto">Perda / Esquecimento de Objeto Pessoal</option>
                              <option value="falta_troco">Problema com Ajuste de Preços / Falta de Troco</option>
                              <option value="pane_viatura">Avaria / Falha Técnica do Táxi</option>
                              <option value="eliminar_conta">Pedido de Eliminação de Conta (Proteção de Dados)</option>
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest">Matrícula ou Viatura (Opcional)</label>
                            <input
                              type="text"
                              className="w-full p-2.5 bg-slate-950 border border-white/10 rounded-xl outline-none text-white focus:border-white font-bold"
                              placeholder="Ex: LD-82-41-MZ ou Viatura Prefix 12"
                              value={complaintVehicle}
                              onChange={e => setComplaintVehicle(e.target.value)}
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest">Descrição dos Factos</label>
                            <textarea
                              rows={3}
                              className="w-full p-2.5 bg-slate-950 border border-white/10 rounded-xl outline-none text-white focus:border-white font-bold resize-none"
                              placeholder="Fale brevemente do ocorrido. O relatório será enviado com a sua identificação (+244) e enviado ao operador JIS."
                              value={complaintText}
                              onChange={e => setComplaintText(e.target.value)}
                            />
                          </div>

                          <button
                            onClick={async () => {
                              if (!complaintText.trim()) {
                                alert("Por favor, descreva os factos da sua reclamação.");
                                return;
                              }
                              setIsSubmittingComplaint(true);
                              try {
                                await addDoc(collection(db, 'complaints'), {
                                  type: complaintType,
                                  vehicle: complaintVehicle || 'Não Especificado',
                                  description: complaintText,
                                  passengerName: passengerProfile?.name || 'Anónimo',
                                  passengerPhone: passengerProfile?.backupPhone || passengerProfile?.phone || 'N/A',
                                  source: 'app_passageiro',
                                  timestamp: new Date(),
                                  createdAt: new Date(),
                                  status: 'pending'
                                });
                                if (complaintType === 'eliminar_conta') {
                                  setComplaintSuccessMsg("O seu pedido de eliminação de conta foi registado com sucesso. De acordo com as diretivas de privacidade, a administração de José Iweza Suana (JIS) processará a eliminação definitiva dos seus dados em até 48 horas operacionais.");
                                } else {
                                  setComplaintSuccessMsg("A sua reclamação foi registada com sucesso. A fiscalização em Luena-Moxico iniciará uma auditoria.");
                                }
                              } catch (err) {
                                console.error("Error submitting complaint:", err);
                                alert("Ocorreu um erro ao submeter. Tente novamente.");
                              } finally {
                                setIsSubmittingComplaint(false);
                              }
                            }}
                            disabled={isSubmittingComplaint}
                            className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 ${currentTheme.btnClass} ${isSubmittingComplaint ? 'opacity-50' : ''}`}
                          >
                            {isSubmittingComplaint ? <RefreshCw className="animate-spin" size={14} /> : 'Enviar Reclamação à Central'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="pt-2 border-t border-white/15 space-y-2 text-center">
                    <p className="text-[8.5px] text-slate-500 uppercase font-black">Precisa de ajuda imediata?</p>
                    <div className="flex flex-col gap-2">
                      <a 
                        href={activeWhatsappLink} 
                        target="_blank" 
                        referrerPolicy="no-referrer"
                        className="w-full py-2.5 bg-[#25D366]/10 border border-[#25D366]/30 rounded-xl text-[10px] font-extrabold uppercase text-[#25D366] tracking-wider text-center flex items-center justify-center gap-1.5 hover:bg-[#25D366]/20 transition-all"
                      >
                        <MessageSquare size={11} /> {(activeCompany?.whatsappGroupCustomers || activeCompany?.whatsappGroupLink) ? 'Entrar no Grupo de Clientes (WhatsApp)' : 'Contactar Central Directo (WhatsApp)'}
                      </a>
                      {activeWhatsappGroupLink && activeWhatsappLink !== activeWhatsappGroupLink && (
                        <a 
                          href={activeWhatsappGroupLink} 
                          target="_blank" 
                          referrerPolicy="no-referrer"
                          className="w-full py-2.5 bg-teal-500/10 border border-teal-500/30 rounded-xl text-[10px] font-extrabold uppercase text-teal-400 tracking-wider text-center flex items-center justify-center gap-1.5 hover:bg-teal-500/20 transition-all"
                        >
                          <MessageSquare size={11} /> Entrar no Grupo da Filial (WhatsApp)
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* MODAL 4: TERMOS E POLÍTICAS DE SEGURANÇA DO PASSAGEIRO (JIS) */}
            {showTermsModal && (
              <div className="absolute inset-0 bg-black/90 z-[50] flex flex-col justify-end">
                <div className="bg-slate-900 border-t border-white/10 rounded-t-[24px] p-6 space-y-4 animate-slide-up text-white max-h-[85%] overflow-y-auto no-scrollbar">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                       <ShieldCheck size={14} className="text-amber-500" />
                       Termos de Segurança e Políticas de Uso
                    </h3>
                    <button 
                      onClick={() => setShowTermsModal(false)}
                      className="p-1 hover:bg-white/10 rounded text-slate-400"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="space-y-4 py-2 text-justify text-[10.5px] leading-relaxed text-slate-300">
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center space-y-1">
                      <p className="text-[10px] text-amber-400 uppercase font-black tracking-wider m-0">
                        PSM COMERCIAL (SU), LDA • LUENA-MOXICO
                      </p>
                      <p className="text-[8.5px] text-slate-400 font-bold uppercase tracking-widest m-0">
                        Regulamento de Segurança Operacional & Políticas de Privacidade (SUPER TÁXI / JIS ANGOLA)
                      </p>
                    </div>

                    <p>
                      <strong>1. Objeto e Âmbito Operacional:</strong> Estes Termos e Políticas regulam a prestação e a utilização do serviço de mobilidade urbana <strong>SUPER Táxi</strong> na província do Moxico (Luena), operado pela PSM Comercial (SU), Lda sob gestão da central <strong>TaxiControl (JIS ANGOLA)</strong>. Ao registar-se ou utilizar a aplicação, o utilizador aceita integralmente as normas operacionais e de segurança.
                    </p>

                    <p>
                      <strong>2. Veracidade de Dados e Perfil:</strong> O passageiro declara que todas as informações prestadas no cadastro (Nome Completo, Idade e Contacto Telefónico de Backup com prefixo fixo <strong>+244</strong>) são exatas, verdadeiras e ativas. O registo de contas com dados falsos ou de terceiros constitui infração grave sujeita a bloqueio imediato.
                    </p>

                    <p>
                      <strong>3. Segurança a Bordo & Norma de Conduta:</strong> O passageiro compromete-se a colaborar ativamente na manutenção de um ambiente seguro, urbano e respeitoso a bordo dos veículos. Fica estritamente proibido o transporte de qualquer tipo de material inflamável, corrosivo, explosivo, armas de qualquer natureza ou substâncias ilícitas.
                    </p>

                    <p>
                      <strong>4. Validação Obrigatória do Token de Embarque:</strong> Para prevenção de fraude, sequestros expressos ou trocas inadvertidas de viatura, o passageiro deve obrigatoriamente fornecer o seu <strong>Token de Embarque (Código PIN exclusivo)</strong> ao motorista no ato de entrada no táxi antes de iniciar a marcha.
                    </p>

                    <p>
                      <strong>5. Limite Telemático de Velocidade (80 km/h):</strong> A frota de táxis é monitorizada continuamente por telemetria GPS via satélite sob orientação do operador <strong>José Iweza Suana (JIS)</strong>. A velocidade máxima permitida em perímetro urbano é de <strong>80 km/h</strong>. Qualquer transgressão por parte do condutor pode e deve ser reportada de imediato no painel de Reclamações para instauração de processo disciplinar.
                    </p>

                    <p>
                      <strong>6. Protocolo de Emergência S.O.S (Botão de Pânico):</strong> O botão de Pânico S.O.S transmite instantaneamente a localização geoespacial exata do utilizador e da viatura à Central de Fiscalização e às autoridades policiais competentes. O acionamento indevido ou por negligência ("trotes") implicará o banimento irreversível da conta e responsabilização legal.
                    </p>

                    <p>
                      <strong>7. Proteção da Identidade e Privacidade do Motorista:</strong> Em observância às diretivas de segurança física dos condutores, a aplicação exibe publicamente aos passageiros apenas o prefixo numérico operacional da viatura (ex: <em>Viatura 12</em>) e a respetiva matrícula oficial (ex: <em>LD-92-33-PX</em>), protegendo os contactos pessoais e a privacidade do motorista.
                    </p>

                    <p>
                      <strong>8. Proteção de Dados e Direito de Eliminação:</strong> Os dados de geolocalização e histórico de viagens são encriptados e processados exclusivamente para fins operacionais da rede SUPER Táxi e do Firestore, em inteira conformidade com a legislação angolana de proteção de dados. O utilizador pode solicitar a eliminação definitiva dos seus dados a qualquer momento via painel de Reclamações, sendo a conta eliminada em até 48 horas operacionais.
                    </p>

                    <p>
                      <strong>9. Transparência Tarifária e Pagamentos:</strong> Os valores de corrida indicados no momento da solicitação ou acordados previamente no canal oficial são finais. É estritamente vedada a cobrança de sobretaxas não contratadas a bordo. O pagamento pode ser feito em dinheiro físico ou por transferência bancária (Kwanza - AOA).
                    </p>

                    <p>
                      <strong>10. Política de Cancelamentos e Assiduidade:</strong> Cancelamentos injustificados e reiterados após o descolamento ou chegada da viatura ao ponto de recolha causam prejuízos à frota e poderão originar a aplicação de restrições temporárias na realização de novos pedidos.
                    </p>

                    <p>
                      <strong>11. Continuidade Operacional Offline (Rede Móvel / SMS / Chamada):</strong> Em situações de oscilação ou quebra na transmissão de dados de internet móvel, a Central de Proteção JIS aciona automaticamente o canal analógico redundante (Chamadas de Voz e SMS) para garantir o contacto e o reencaminhamento seguro do passageiro.
                    </p>

                    <p>
                      <strong>12. Política de Achados e Perdidos:</strong> Quaisquer bens, documentos ou dispositivos esquecidos no interior dos táxis da rede serão recolhidos pelo condutor e depositados na Central da PSM Comercial (SU), Lda no Luena. O proprietário dispõe do prazo de 30 dias para efetuar a recolha mediante comprovação de identidade.
                    </p>

                    <p>
                      <strong>13. Utilização de Bónus e Cupões Promocionais:</strong> Quaisquer saldos de bónus ou créditos promocionais atribuídos pela administração da JIS ANGOLA são pessoais, intransferíveis e aplicáveis única e exclusivamente como desconto na contratação de corridas no aplicativo oficial SUPER Táxi.
                    </p>

                    <p>
                      <strong>14. Jurisdição e Resolução de Litígios:</strong> O presente regulamento rege-se pelas leis da República de Angola. Quaisquer divergências ou litígios não resolvidos por via amigável com a Central de Atendimento serão submetidos ao foro da comarca da província do Moxico (Luena).
                    </p>
                  </div>

                  <div className="pt-2 border-t border-white/5 flex gap-3">
                    <button
                      onClick={() => {
                        setAcceptedTerms(true);
                        setShowTermsModal(false);
                      }}
                      className={`flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl font-black text-[10px] uppercase tracking-widest`}
                    >
                      Aceitar Termos
                    </button>
                    <button
                      onClick={() => {
                        setAcceptedTerms(false);
                        setShowTermsModal(false);
                      }}
                      className="flex-1 py-3 bg-white/5 border border-white/10 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-white/10"
                    >
                      Rejeitar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* MODAL 5: SUGERIR APP / CÓDIGO QR */}
            {showQrModal && (
              <div className="absolute inset-0 bg-black/85 z-[60] flex flex-col justify-end">
                <div className="bg-slate-900 border-t border-white/10 rounded-t-[24px] p-6 space-y-4 animate-slide-up text-white max-h-[85%] overflow-y-auto no-scrollbar">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                      <QrCode size={14} className="text-amber-500" />
                      Sugerir App Passageiro
                    </h3>
                    <button 
                      onClick={() => setShowQrModal(false)}
                      className="p-1 hover:bg-white/10 rounded text-slate-400"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="space-y-4 text-center py-2">
                    <p className="text-[11px] text-amber-500 uppercase font-black tracking-widest max-w-xs mx-auto">
                      ACESSO AO APP DO PASSAGEIRO OFICIAL
                    </p>

                    {/* QR Code Graphic Frame */}
                    <div className="bg-white p-4 rounded-2xl w-48 h-48 mx-auto shadow-2xl flex flex-col items-center justify-center border-4 border-amber-500">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(typeof window !== 'undefined' ? `${window.location.origin}/?view=passenger` : "https://taxi-dev")}`} 
                        alt="Passenger App QR Code" 
                        className="w-full h-full object-contain"
                      />
                    </div>

                    <div className="space-y-1">
                      <p className="text-[11px] font-mono text-amber-500 font-extrabold select-all break-all">
                        {getPassengerShareUrl()}
                      </p>
                      <p className="text-[8px] text-slate-550 uppercase font-black tracking-widest">
                        URL Oficial de Divulgação • Luena-Moxico
                      </p>
                    </div>

                    <div className="pt-2 flex flex-col gap-2">
                      <button
                        onClick={copyShareLink}
                        className={`w-full py-3 ${copiedLink ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-amber-500 hover:bg-amber-600 text-slate-950'} rounded-xl font-black text-[10px] uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2`}
                      >
                        {copiedLink ? <Check size={12} className="animate-bounce" /> : <Copy size={12} />}
                        <span>{copiedLink ? 'Link Copiado com Sucesso!' : 'Copiar Link de Partilha'}</span>
                      </button>
                      <button
                        onClick={() => setShowQrModal(false)}
                        className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
                      >
                        Fechar Janela
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* MODAL INDIVIDUAL: VIATURAS EM SERVIÇO */}
            {showVehicleSelectModal && (
              <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[2000] flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
                  {/* Modal Header */}
                  <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-amber-500 text-slate-950 rounded-xl font-black">
                        <Car size={20} />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-tight">Viaturas em Serviço</h3>
                        <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                          {availableVehicles.length} {availableVehicles.length === 1 ? 'Táxi Ativo na Frota' : 'Táxis Ativos na Frota'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowVehicleSelectModal(false)}
                      className="p-2 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl transition-all cursor-pointer border border-slate-700/50"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Modal Body - List of Vehicles */}
                  <div className="p-4 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
                    <p className="text-[10.5px] text-slate-300 font-medium leading-relaxed">
                      Escolha a viatura de sua preferência para realizar a viagem ou selecione atribuição automática.
                    </p>

                    {/* Active Confirmation Toast Banner */}
                    <AnimatePresence>
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-300 flex items-center gap-2.5 shadow-lg shadow-amber-500/10"
                      >
                        <CheckCircle2 size={16} className="text-amber-400 animate-pulse shrink-0" />
                        <div className="text-[10px] font-bold">
                          <span className="text-white uppercase font-black">Seleção Ativa: </span>
                          <span className="text-amber-300 font-mono">
                            {selectedVehicleId === '' || selectedVehicleId === 'auto'
                              ? 'Qualquer Viatura Disponível (Atribuição Automática)'
                              : `${availableVehicles.find(v => v.id === selectedVehicleId)?.model || 'Viatura'} (${availableVehicles.find(v => v.id === selectedVehicleId)?.plate || ''})`}
                          </span>
                        </div>
                      </motion.div>
                    </AnimatePresence>

                    {/* Option 1: Any vehicle (Automatic Assignment) */}
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        setSelectedVehicleId('');
                        setTimeout(() => setShowVehicleSelectModal(false), 250);
                      }}
                      className={cn(
                        "w-full p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer active:scale-98 shadow-md relative overflow-hidden",
                        selectedVehicleId === '' || selectedVehicleId === 'auto'
                          ? "bg-amber-500/20 border-amber-400 text-white ring-2 ring-amber-400/50 shadow-amber-500/20"
                          : "bg-slate-950/80 border-slate-800 hover:bg-slate-800 text-slate-300"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2.5 rounded-xl font-black transition-colors",
                          selectedVehicleId === '' || selectedVehicleId === 'auto' 
                            ? "bg-amber-500 text-slate-950 animate-pulse" 
                            : "bg-slate-800 text-slate-300"
                        )}>
                          <Sparkles size={18} />
                        </div>
                        <div>
                          <p className="text-xs font-black text-white uppercase tracking-tight">Qualquer Viatura Disponível</p>
                          <p className="text-[10px] text-slate-400 font-medium mt-0.5">Atribuição automática à viatura livre mais próxima</p>
                        </div>
                      </div>
                      {(selectedVehicleId === '' || selectedVehicleId === 'auto') && (
                        <motion.div 
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: "spring", stiffness: 500, damping: 20 }}
                          className="flex items-center gap-1.5 bg-amber-500 text-slate-950 px-3 py-1.5 rounded-full text-[9.5px] font-black uppercase shrink-0 shadow-md ring-2 ring-amber-300"
                        >
                          <CheckCircle2 size={13} className="animate-bounce" />
                          <span>Selecionado ✔</span>
                        </motion.div>
                      )}
                    </motion.button>

                    {/* List of Individual Active Vehicles (NO DRIVER NAMES) */}
                    {availableVehicles.map((v) => {
                      const isSelected = selectedVehicleId === v.id;
                      return (
                        <motion.button
                          key={v.id}
                          type="button"
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => {
                            setSelectedVehicleId(v.id);
                            setTimeout(() => setShowVehicleSelectModal(false), 250);
                          }}
                          className={cn(
                            "w-full p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer active:scale-98 shadow-md relative overflow-hidden",
                            isSelected
                              ? "bg-amber-500/20 border-amber-400 text-white ring-2 ring-amber-400/50 shadow-amber-500/20"
                              : "bg-slate-950/80 border-slate-800 hover:bg-slate-800 text-slate-300"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "p-2.5 rounded-xl font-black text-xs font-mono shrink-0 transition-colors",
                              isSelected ? "bg-amber-500 text-slate-950 animate-pulse" : "bg-slate-800 text-amber-400"
                            )}>
                              {v.prefix || 'TAX'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-black text-white uppercase tracking-tight">{v.model}</p>
                                <span className={cn(
                                  "text-[9.5px] font-mono font-bold px-2 py-0.5 rounded border transition-colors",
                                  isSelected ? "bg-amber-500/30 text-amber-200 border-amber-400" : "bg-white/10 text-amber-300 border-white/10"
                                )}>
                                  {v.plate}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                                  Em Serviço / Disponível
                                </span>
                              </div>
                            </div>
                          </div>

                          {isSelected ? (
                            <motion.div 
                              initial={{ scale: 0.5, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ type: "spring", stiffness: 500, damping: 20 }}
                              className="flex items-center gap-1.5 bg-amber-500 text-slate-950 px-3 py-1.5 rounded-full text-[9.5px] font-black uppercase shrink-0 shadow-md ring-2 ring-amber-300"
                            >
                              <CheckCircle2 size={13} className="animate-bounce" />
                              <span>Selecionada ✔</span>
                            </motion.div>
                          ) : (
                            <div className="px-3 py-1.5 bg-slate-800 text-slate-300 hover:text-white hover:bg-amber-500 hover:text-slate-950 rounded-xl text-[10px] font-bold uppercase transition-all shrink-0">
                              Escolher
                            </div>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Modal Footer */}
                  <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-medium">
                      Frota SUPER Táxi Luena
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowVehicleSelectModal(false)}
                      className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase rounded-xl transition-all cursor-pointer shadow-md active:scale-95 flex items-center gap-1.5"
                    >
                      <CheckCircle2 size={14} />
                      <span>Confirmar Escolha</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* PWA INSTALLATION MODAL */}
            <PWAInstallModal isOpen={showInstallPwaModal} onClose={() => setShowInstallPwaModal(false)} />

            {/* MODAL REFUSAL REASON & DISCOUNT PROPOSAL */}
            {showRefusalModal && (
              <div className="absolute inset-0 bg-black/85 z-[1500] flex flex-col justify-end p-2">
                <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 space-y-4 text-white shadow-2xl animate-slide-up max-h-[90%] overflow-y-auto no-scrollbar">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <h3 className="text-xs font-black uppercase tracking-wider text-rose-400 flex items-center gap-2">
                      <AlertCircle size={16} />
                      Motivo da Recusa da Corrida
                    </h3>
                    <button 
                      onClick={() => setShowRefusalModal(false)}
                      className="p-1 hover:bg-white/10 rounded text-slate-400"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <p className="text-[10px] text-slate-300 leading-normal">
                    Por favor especifique a razão pela qual está a recusar a corrida. Se o problema for o valor, pode enviar um pedido de desconto direto ao motorista:
                  </p>

                  <div className="space-y-2">
                    {(() => {
                      const liveRide = (myRides && activeRideRecord?.id) ? (myRides.find((r: any) => r.id === activeRideRecord.id) || activeRideRecord) : activeRideRecord;
                      const hasDriverEta = Boolean(
                        liveRide?.driverEtaResponse || 
                        liveRide?.driverEta || 
                        liveRide?.eta || 
                        activeRideRecord?.driverEtaResponse ||
                        activeRideRecord?.driverEta ||
                        activeRideRecord?.eta
                      );
                      return [
                        { id: 'Preço Demasiado Alto', label: '💰 Preço Demasiado Alto (Pedir Desconto)' },
                        ...(hasDriverEta ? [{ id: 'Tempo de Espera Muito Alto', label: '⏱️ Tempo de Espera Muito Alto' }] : []),
                        { id: 'Arranjei Outro Transporte', label: '🚗 Consegui Outro Transporte' },
                        { id: 'Desisti da Viagem', label: '❌ Desisti da Viagem' },
                      ];
                    })().map((opt) => (
                      <label 
                        key={opt.id}
                        onClick={() => setRefusalReasonOption(opt.id)}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer text-xs font-bold transition-all ${
                          refusalReasonOption === opt.id 
                            ? 'bg-amber-500/20 border-amber-500 text-amber-300' 
                            : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        <input 
                          type="radio" 
                          name="refusalReason" 
                          checked={refusalReasonOption === opt.id}
                          onChange={() => setRefusalReasonOption(opt.id)}
                          className="accent-amber-500"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>

                  {refusalReasonOption === 'Tempo de Espera Muito Alto' ? (
                    <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl space-y-3">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-300 font-bold">Tempo Informado pelo Motorista:</span>
                        <span className="text-blue-400 font-black font-mono text-xs">
                          {activeRideRecord?.driverEtaResponse || activeRideRecord?.driverEta || activeRideRecord?.eta || '20 min'}
                        </span>
                      </div>

                      <p className="text-[9.5px] text-blue-200/90 leading-normal">
                        O tempo de espera indicado pelo motorista é demasiado longo. Pode notificar o motorista pedindo para vir mais rápido ou cancelar a corrida.
                      </p>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!activeRideRecord?.id) return;
                            try {
                              const rideRef = doc(db, 'calls', activeRideRecord.id);
                              await setDoc(rideRef, { 
                                passengerEtaFeedback: 'tempo_alto',
                                passengerAskedEta: true,
                                passengerEtaQuestion: 'O tempo de espera é muito alto! Pode acelerar ou vir mais rápido?' 
                              }, { merge: true });
                              setShowRefusalModal(false);
                              alert("Notificação enviada ao motorista pedindo para vir mais rápido!");
                            } catch (err) {
                              console.error(err);
                            }
                          }}
                          className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase rounded-xl transition-all shadow-md flex items-center justify-center gap-1"
                        >
                          ⚡ Pedir p/ Vir Mais Rápido
                        </button>

                        <button
                          type="button"
                          onClick={() => handleConfirmDefinitiveCancellation('Tempo de Espera Muito Alto')}
                          className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] uppercase rounded-xl transition-all shadow-md flex items-center justify-center gap-1"
                        >
                          ❌ Cancelar por Demora
                        </button>
                      </div>
                    </div>
                  ) : refusalReasonOption === 'Preço Demasiado Alto' ? (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-3">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-300 font-bold">Valor Proposto pelo Motorista:</span>
                        <span className="text-amber-400 font-black font-mono">
                          {(negotiatedPrice || Number(activeRideRecord?.price || 2000)).toLocaleString()} Kz
                        </span>
                      </div>

                      <p className="text-[9.5px] text-amber-200/90 leading-normal">
                        Notificar o motorista que o preço é elevado para que ele possa oferecer um valor reduzido com desconto.
                      </p>

                      <button
                        disabled={isSubmittingDiscount}
                        onClick={handleSendDiscountRequest}
                        className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-lg uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                      >
                        🙋 Solicitar Desconto ao Motorista
                      </button>

                      <div className="pt-2 border-t border-amber-500/20 text-center">
                        <button
                          onClick={() => handleConfirmDefinitiveCancellation('Preço Demasiado Alto')}
                          className="text-[9.5px] text-rose-400 hover:underline font-bold uppercase"
                        >
                          Cancelar corrida definitivamente
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 flex gap-2">
                      <button
                        onClick={() => setShowRefusalModal(false)}
                        className="flex-1 py-2.5 bg-white/10 hover:bg-white/15 text-slate-300 font-bold text-xs uppercase rounded-xl"
                      >
                        Voltar
                      </button>
                      <button
                        onClick={() => handleConfirmDefinitiveCancellation()}
                        className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase rounded-xl shadow-lg"
                      >
                        Confirmar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* APK DOWNLOAD & SCANNABLE QR CODE MODAL FOR PASSENGERS */}
          <AnimatePresence>
            {showApkDownloadModal && (
              <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 15 }}
                  className="bg-slate-900 border-2 border-amber-500/60 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-center relative overflow-hidden"
                >
                  <button
                    onClick={() => setShowApkDownloadModal(false)}
                    className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800 rounded-full transition-colors cursor-pointer"
                  >
                    <X size={16} />
                  </button>

                  <div className="w-12 h-12 bg-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto border border-amber-500/30">
                    <Smartphone size={24} />
                  </div>

                  <div>
                    <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">Aplicações Móveis JIS Angola</span>
                    <h3 className="text-base font-black uppercase tracking-tight text-white mt-1">App Passageiro Android</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Versão {apkConfig.version || '6.0.0'} • Tamanho: {apkConfig.passengerAppSize || '16.8 MB'}</p>
                  </div>

                  {/* Real Scannable QR Code */}
                  <div className="bg-white p-4 rounded-2xl border-2 border-slate-950 shadow-xl inline-block my-1 max-w-full">
                    {passengerApkQrUrl ? (
                      <img src={passengerApkQrUrl} alt="QR Code App Passageiro" className="w-48 h-48 mx-auto rounded-lg object-contain" />
                    ) : (
                      <div className="w-48 h-48 flex items-center justify-center bg-slate-100 text-slate-400">
                        <RefreshCw className="animate-spin text-amber-500" size={24} />
                      </div>
                    )}
                    <p className="text-[9.5px] font-black uppercase text-slate-800 tracking-wider mt-2.5">Digitalize com a câmara do telemóvel</p>
                  </div>

                  <p className="text-[10.5px] text-slate-300 leading-relaxed px-1 font-medium">
                    Aponte a câmara do seu smartphone para descarregar e instalar o ficheiro <strong>.APK oficial</strong> diretamente no seu telemóvel Android.
                  </p>

                  <div className="pt-2 flex gap-2">
                    <a
                      href={apkConfig.passengerAppUrl || 'https://github.com/joseiwezasuana-ai/sistema-gestao-frota-MT/releases/download/v6.0.0/supertaxi-passenger-v6.0.0.apk'}
                      download="supertaxi-passageiro-v6.0.0.apk"
                      className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                      <Download size={16} />
                      <span>Download Direto</span>
                    </a>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
          
          {/* Status bar base phone home bar decoration */}
          {!isPublicApp && (
            <div className="h-6 shrink-0 bg-slate-950 flex items-center justify-center border-t border-white/5 select-none z-[110]">
              <div className="w-24 h-1 bg-slate-600 rounded-full" />
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
