// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  Legend
} from 'recharts';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Phone, 
  PhoneIncoming,
  MessageSquare, 
  Clock, 
  CheckCircle,
  TrendingUp,
  MapPin,
  Download,
  Plus,
  AlertCircle,
  Activity,
  ShieldAlert,
  Gauge,
  Truck as TruckIcon,
  Search,
  Crosshair,
  User,
  Zap,
  X,
  Loader2,
  Calendar,
  MessageCircle,
  ExternalLink,
  Smartphone,
  FileText,
  History as HistoryIcon,
  Wallet,
  Navigation,
  Car,
  ChevronRight,
  User as UserIcon,
  Star,
  Award,
  AlertTriangle
} from 'lucide-react';
import { format, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { toSafeDate, formatSafe } from '../lib/dateUtils';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { InvoiceViewerModal } from './InvoiceViewerModal';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  limit,
  addDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  where,
  doc
} from '@/src/lib/firebase';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { smsService } from '../services/smsService';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTheme } from '../context/ThemeContext';

import { geminiService } from '../services/geminiService';
import WaitingTimer from './WaitingTimer';

// Leaflet icon fix
// @ts-ignore
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const createPanicIcon = (prefix: string) => {
  const html = `
    <div class="relative flex items-center justify-center">
      <span class="absolute inline-flex h-8 w-8 rounded-full bg-red-400 opacity-75 animate-ping"></span>
      <div class="relative p-1.5 rounded-xl bg-red-600 text-white border-2 border-white shadow-lg flex items-center gap-1.5 px-3">
         <span class="w-2 h-2 rounded-full bg-white animate-pulse"></span>
         <span class="text-[10px] font-black tracking-tighter">
           SOS: ${prefix || 'N/A'}
         </span>
      </div>
    </div>
  `;
  return L.divIcon({
    html,
    className: 'dashboard-panic-icon',
    iconSize: [80, 32],
    iconAnchor: [40, 16],
  });
};

const createDashboardIcon = (driver: any) => {
  const getMarkerColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'available': case 'ativo': case 'disponível': return 'bg-green-600';
      case 'busy': case 'ocupado': return 'bg-amber-600';
      case 'offline': case 'inativo': case 'indisponível': return 'bg-red-600';
      default: return 'bg-slate-500';
    }
  };

  const html = `
    <div class="p-1 rounded bg-white border border-slate-200 shadow-sm flex items-center gap-1.5 px-2">
       <div class="w-2 h-2 rounded-full ${getMarkerColor(driver.status)}"></div>
       <span class="text-[10px] font-black text-slate-800 tracking-tighter">
         ${driver.prefix || ''}
       </span>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'dashboard-taxi-icon',
    iconSize: [60, 24],
    iconAnchor: [30, 24],
  });
};

export default function Dashboard({ user }: { user: any }) {
  const { theme } = useTheme();
  const [calls, setCalls] = useState<any[]>([]);
  const [revenues, setRevenues] = useState<any[]>([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState<any[]>([]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [driverCount, setDriverCount] = useState(0);
  const [vehicleCount, setVehicleCount] = useState(0);
  const [activeVehicles, setActiveVehicles] = useState(0);
  const [activeUnitelDrivers, setActiveUnitelDrivers] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [accidents, setAccidents] = useState<any[]>([]);
  const [rankingFilter, setRankingFilter] = useState<'todos' | 'BOM' | 'NORMAL' | 'RUIM'>('todos');
  const [rankingSearch, setRankingSearch] = useState('');
  const [smsLogs, setSmsLogs] = useState<any[]>([]);
  const [missedCalls, setMissedCalls] = useState<any[]>([]);
  const [criticalAlerts, setCriticalAlerts] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [panicAlerts, setPanicAlerts] = useState<any[]>([]);
  const [driversMaster, setDriversMaster] = useState<any[]>([]);
  const [mapCenter, setMapCenter] = useState<[number, number]>([-11.7833, 19.9167]);
  const [mapZoom, setMapZoom] = useState<number>(13);
  const [speedViolations, setSpeedViolations] = useState<any[]>([]);
  const [whatsAppLink, setWhatsAppLink] = useState('');
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Set<string>>(new Set());
  const [callSearchTerm, setCallSearchTerm] = useState('');
  const [isInvoiceViewerOpen, setIsInvoiceViewerOpen] = useState(false);
  const [selectedInvoiceData, setSelectedInvoiceData] = useState<any>(null);
  const [aiInsight, setAiInsight] = useState<string>("A carregar análise inteligente...");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [interactionLogs, setInteractionLogs] = useState<any[]>([]);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [assigningLoading, setAssigningLoading] = useState(false);

  const isInitialLoadRef = React.useRef(true);

  const generateAiInsight = async () => {
    setIsAiLoading(true);
    try {
      const insight = await geminiService.getFleetInsights({
        activeVehicles,
        totalVehicles: vehicleCount,
        callsCount: calls.length,
        speedViolations: speedViolations.length,
        missedCalls: missedCalls.length,
        unitelPerformance: activeUnitelDrivers > 0 ? 'Bom' : 'Verificar Terminais',
        pendingRevenues: pendingRevenueCount
      });
      setAiInsight(insight);
    } catch (err) {
      setAiInsight("Erro ao gerar análise.");
    } finally {
      setIsAiLoading(false);
    }
  };

  useEffect(() => {
    if (activeVehicles > 0 && !isAiLoading && aiInsight === "A carregar análise inteligente...") {
      generateAiInsight();
    }
  }, [activeVehicles]);

  const handleResolveAlert = async (alertId: string) => {
    if (alertId.startsWith('panic-')) {
      const id = alertId.replace('panic-', '');
      try {
        await updateDoc(doc(db, 'panic_alerts', id), { status: 'resolved' });
      } catch (err) {
        console.error("Erro ao resolver alerta de pânico:", err);
      }
    } else {
      setAcknowledgedAlerts(prev => new Set(prev).add(alertId));
    }
  };

  const handleResolveMissedCall = async (callId: string) => {
    try {
      await updateDoc(doc(db, 'calls', callId), { status: 'archived' });
    } catch (err) {
      console.error("Erro ao arquivar chamada perdida:", err);
    }
  };

  useEffect(() => {
    // Listen for Revenues for performance charts
    const qRev = query(collection(db, 'revenue_logs'), orderBy('timestamp', 'desc'), limit(150));
    const unsubRev = onSnapshot(qRev, (snapshot) => {
      setRevenues(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'revenue_logs'));

    // Listen for accidents for driver performance classification
    const qAcc = query(collection(db, 'accident_logs'), limit(50));
    const unsubAcc = onSnapshot(qAcc, (snapshot) => {
      setAccidents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("Error listening to accident_logs in Dashboard:", error));

    // Listen for Maintenance logs for financial charts
    const qMaint = query(collection(db, 'maintenance_logs'), orderBy('timestamp', 'desc'), limit(100));
    const unsubMaint = onSnapshot(qMaint, (snapshot) => {
      setMaintenanceLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("Error listening to maintenance_logs in Dashboard:", error));

    // Listen for global settings for WhatsApp link
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        setWhatsAppLink(docSnap.data().whatsAppLink || '');
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'settings'));

    // ... existing listeners ...
    // Timeout for missed calls (in minutes)
    const MISSED_CALL_TIMEOUT = 5;

    // Listen for Panic Alerts
    const qPanic = query(
      collection(db, 'panic_alerts'), 
      where('status', '==', 'active')
    );
    const unsubPanic = onSnapshot(qPanic, (snapshot) => {
      const activePanics = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() as any }))
        .sort((a, b) => {
          const dateA = toSafeDate(a.timestamp)?.getTime() || 0;
          const dateB = toSafeDate(b.timestamp)?.getTime() || 0;
          return dateB - dateA;
        })
        .slice(0, 10);
      setPanicAlerts(activePanics);
      
      const alerts = activePanics.map((p: any) => ({
        id: `panic-${p.id}`,
        type: 'danger',
        title: 'S.O.S - BOTÃO DE PÂNICO',
        message: `Motorista ${p.driverName} (${p.prefix}) solicitou emergência!`,
        time: toSafeDate(p.timestamp) || new Date(),
        lat: p.lat,
        lng: p.lng,
        driverId: p.driverId,
        driverName: p.driverName,
        prefix: p.prefix,
        driverPhone: p.driverPhone
      }));

      setCriticalAlerts(prev => {
        const others = prev.filter(a => !a.id.startsWith('panic-'));
        return [...alerts, ...others].sort((a, b) => b.time.getTime() - a.time.getTime());
      });
    }, (error) => handleFirestoreError(error, OperationType.GET, 'panic_alerts'));

    // Listen for Speed Violations (Historical/Recent)
    const qSpeed = query(collection(db, 'speed_violations'), orderBy('timestamp', 'desc'), limit(10));
    const unsubSpeedLogs = onSnapshot(qSpeed, (snapshot) => {
      setSpeedViolations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'speed_violations'));

    const qCalls = query(collection(db, 'calls'), orderBy('timestamp', 'desc'), limit(150));
    const unsubCalls = onSnapshot(qCalls, (snapshot) => {
      const allCalls = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Filter missed calls: status is 'pending' and timestamp is older than MISSED_CALL_TIMEOUT
      const missed = allCalls.filter((call: any) => {
        if (call.status !== 'pending') return false;
        
        const ts = call.timestamp;
        if (!ts) return false;
        
        const callDate = toSafeDate(ts);
        
        if (!callDate) return false;
        
        const diffInMinutes = (new Date().getTime() - callDate.getTime()) / (1000 * 60);
        return diffInMinutes > MISSED_CALL_TIMEOUT;
      });

      setMissedCalls(missed);
      setCalls(allCalls); 
      
      if (!isInitialLoadRef.current) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const addedCall = change.doc.data();
            const id = Math.random().toString(36).substr(2, 9);
            setNotifications(prev => [...prev, { 
              id, 
              customer: addedCall.customerName || 'Novo Cliente',
              pickup: addedCall.pickupAddress || 'Local não especificado',
              timestamp: new Date()
            }]);
            
            setTimeout(() => {
              setNotifications(prev => prev.filter(n => n.id !== id));
            }, 6000);
          }
        });
      }
      
      isInitialLoadRef.current = false;
    }, (error) => handleFirestoreError(error, OperationType.GET, 'calls'));

    // Listen for Mobile Interface Interactions (Gateway)
    const qInteractions = query(
      collection(db, 'interaction_logs'), 
      orderBy('serverTimestamp', 'desc'),
      limit(20)
    );
    const unsubInteractions = onSnapshot(qInteractions, (snapshot) => {
      setInteractionLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'interaction_logs'));

    const qDrivers = query(collection(db, 'drivers_master'));
    const unsubDrivers = onSnapshot(qDrivers, (snapshot) => {
      setDriverCount(snapshot.size);
      setDriversMaster(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'drivers_master'));

    const qSms = query(collection(db, 'sms_logs'), orderBy('timestamp', 'desc'), limit(50));
    const unsubSms = onSnapshot(qSms, (snapshot) => {
      setSmsLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'sms_logs'));

    const qVehicles = query(collection(db, 'drivers'));
    const unsubVehicles = onSnapshot(qVehicles, (snapshot) => {
      setVehicleCount(snapshot.size);
      const docs = snapshot.docs.map((d, idx) => {
        const data = d.data();
        const jitter = idx * 0.0002;
        return { 
          id: d.id, 
          ...data,
          lat: Number(data.lat || -11.7833 + jitter),
          lng: Number(data.lng || 19.9167 + jitter)
        };
      });
      setVehicles(docs);
      
      const active = docs.filter((data: any) => 
        ['available', 'ativo', 'disponível', 'busy', 'ocupado'].includes(data.status?.toLowerCase())
      );
      setActiveVehicles(active.length);
      
      const unitelActive = active.filter((data: any) => {
        return smsService.getOperator(data.phone) === 'Unitel' || 
               smsService.getOperator(data.secondaryPhone) === 'Unitel';
      }).length;
      setActiveUnitelDrivers(unitelActive);

      // Extract critical vehicle alerts (e.g. speed > 85)
      const speedAlerts = docs
        .filter((v: any) => v.speed > 85)
        .map((v: any) => ({
          id: `speed-${v.id}`,
          type: 'danger',
          title: 'Excesso de Velocidade',
          message: `Viatura ${v.prefix} a ${v.speed}km/h!`,
          time: new Date()
        }));

      // Geofence check (Limit Moxico - simplified 15km radius)
      const LUENA_CENTER = { lat: -11.7833, lng: 19.9167 };
      const MAX_RADIUS_KM = 15;
      
      const geofenceAlerts = docs
        .filter((v: any) => {
          if (!v.lat || !v.lng) return false;
          const dist = Math.sqrt(Math.pow(v.lat - LUENA_CENTER.lat, 2) + Math.pow(v.lng - LUENA_CENTER.lng, 2)) * 111; // Approx km
          return dist > MAX_RADIUS_KM;
        })
        .map((v: any) => ({
          id: `geofence-${v.id}`,
          type: 'warning',
          title: 'Violação de Perímetro',
          message: `Viatura ${v.prefix} fora do Limite Moxico!`,
          time: new Date()
        }));
      
      setCriticalAlerts(prev => {
        const others = prev.filter(a => !a.id.startsWith('speed-') && !a.id.startsWith('geofence-'));
        return [...speedAlerts, ...geofenceAlerts, ...others].sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 10);
      });

    }, (error) => handleFirestoreError(error, OperationType.GET, 'drivers'));

    return () => {
      unsubCalls();
      unsubDrivers();
      unsubVehicles();
      unsubSms();
      unsubPanic();
      unsubSpeedLogs();
      unsubRev();
      unsubMaint();
      unsubSettings();
      unsubInteractions();
      unsubAcc();
    };
  }, []);

  const handleAssignDriver = async (requestId: string, driver: any) => {
    setAssigningLoading(true);
    try {
      // Determine if this is a taxi_request or a call from the Dashboard list
      const isCall = selectedRequest?.type === 'direct_referral' || !selectedRequest?.status || selectedRequest?.customerPhone;
      const collectionName = isCall ? 'calls' : 'taxi_requests';
      
      await updateDoc(doc(db, collectionName, requestId), {
        status: 'accepted',
        driverId: driver.id,
        driverName: driver.name,
        driverInfo: {
          name: driver.name,
          phone: driver.phone || driver.phoneNumber || '',
          vehicleModel: driver.vehicleModel || driver.brand || 'Táxi PSM',
          vehiclePlate: driver.vehiclePlate || driver.licensePlate || '',
          prefix: driver.prefix || ''
        }
      });
      setIsAssignModalOpen(false);
      setSelectedRequest(null);
    } catch (err) {
      console.error("Error assigning driver:", err);
      alert("Erro ao atribuir motorista.");
    } finally {
      setAssigningLoading(false);
    }
  };

  const getDriverPhone = (driverId: string, driverName?: string, prefix?: string, alertPhone?: string) => {
    if (alertPhone) return alertPhone;

    // 1. Try to find in driversMaster by UID or ID
    let match = driversMaster.find(d => d.id === driverId || d.uid === driverId);
    if (match && match.phone) return match.phone;

    // 2. Try to find in driversMaster by name
    if (driverName) {
      match = driversMaster.find(d => d.name?.toLowerCase() === driverName.toLowerCase());
      if (match && match.phone) return match.phone;
    }

    // 3. Try to find in vehicles (drivers active list) by driverId, ID, prefix or name
    let vMatch = vehicles.find(v => v.id === driverId || v.driverId === driverId);
    if (vMatch && vMatch.phone) return vMatch.phone;

    if (prefix && prefix !== 'N/A') {
      vMatch = vehicles.find(v => v.prefix === prefix);
      if (vMatch && vMatch.phone) return vMatch.phone;
    }

    if (driverName) {
      vMatch = vehicles.find(v => v.name?.toLowerCase() === driverName.toLowerCase());
      if (vMatch && vMatch.phone) return vMatch.phone;
    }

    return '';
  };

  const pendingRevenueCount = revenues.filter(r => r.status === 'pending_approval').length;

  const stats = [
    { label: 'Motoristas Registados', value: driverCount.toString(), icon: Phone, color: 'text-brand-primary', trend: '+12%', sub: 'Base Staff' },
    { label: 'Viaturas na Frota', value: vehicleCount.toString(), icon: TruckIcon, color: 'text-slate-600', trend: 'Total', sub: 'Ativos: ' + activeVehicles },
    { label: 'Eficiência de Luena', value: `${vehicleCount > 0 ? Math.round((activeVehicles / vehicleCount) * 100) : 0}%`, icon: Activity, color: 'text-emerald-600', trend: 'Frota Ativa', sub: 'Em Operação' },
    { label: 'Validações Pendentes', value: pendingRevenueCount.toString(), icon: Wallet, color: 'text-amber-500', trend: 'Rendas', sub: 'Pendente Operador' },
  ];

  const getUnitelStats = () => {
    const unitelCalls = calls.filter(c => smsService.getOperator(c.customerPhone || c.phone) === 'Unitel').length;
    
    let unitelSms = 0;
    smsLogs.forEach(log => {
      const targets = log.targets || [];
      unitelSms += targets.filter((n: string) => smsService.getOperator(n) === 'Unitel').length;
    });

    return { calls: unitelCalls, sms: unitelSms };
  };

  const unitelStats = getUnitelStats();
  
  // Real performance data calculations
  const getCallsPerHourData = () => {
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i.toString().padStart(2, '0')}h`,
      count: 0
    }));

    calls.forEach(call => {
      const date = toSafeDate(call.timestamp);
      if (date) {
        const hour = date.getHours();
        hourlyData[hour].count++;
      }
    });

    return hourlyData;
  };

  const getAverageEarningsData = () => {
    // Group by date
    const dailyEarnings: { [key: string]: { total: number, drivers: Set<string> } } = {};
    
    if (!Array.isArray(revenues)) return [];

    revenues.forEach(rev => {
      const date = rev?.date;
      if (!date || typeof date !== 'string') return;
      
      if (!dailyEarnings[date]) {
        dailyEarnings[date] = { total: 0, drivers: new Set() };
      }
      
      dailyEarnings[date].total += (rev.amount || 0);
      const driverId = rev.driverId || rev.driverName || 'Unknown';
      dailyEarnings[date].drivers.add(driverId);
    });

    try {
      return Object.entries(dailyEarnings)
        .map(([date, data]) => ({
          date: typeof date === 'string' ? (date.split('-').length > 1 ? date.split('-').slice(1).reverse().join('/') : date) : 'N/A',
          avg: data.drivers.size > 0 ? Math.round(data.total / data.drivers.size) : 0,
          rawDate: date
        }))
        .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
        .slice(-7);
    } catch (e) {
      console.error("Error formatting earnings data:", e);
      return [];
    }
  };

  const [selectedFinancialFleet, setSelectedFinancialFleet] = useState('todos');

  const getMonthlyFinancialData = () => {
    const monthlyMap = {};
    const now = new Date();
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap[mKey] = {
        monthLabel: `${months[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`,
        revenue: 0,
        expense: 0,
        profit: 0
      };
    }

    if (Array.isArray(revenues)) {
      revenues.forEach(rev => {
        let dateStr = rev.date;
        if (!dateStr && rev.timestamp) {
          dateStr = typeof rev.timestamp === 'string' ? rev.timestamp.slice(0, 10) : '';
        }
        if (!dateStr || typeof dateStr !== 'string') return;

        const parts = dateStr.split('-');
        if (parts.length < 2) return;
        const mKey = `${parts[0]}-${parts[1]}`;

        const prefix = (rev.prefix || '').toUpperCase();
        const isTaxi = prefix.includes('TAX');
        const isRent = prefix.includes('ALG') || prefix.includes('RENT');

        if (selectedFinancialFleet === 'taxi' && !isTaxi) return;
        if (selectedFinancialFleet === 'rent' && !isRent) return;
        if (selectedFinancialFleet === 'geral' && (isTaxi || isRent)) return;

        if (monthlyMap[mKey]) {
          monthlyMap[mKey].revenue += (rev.amount || 0);
        }
      });
    }

    if (Array.isArray(maintenanceLogs)) {
      maintenanceLogs.forEach(maint => {
        let dateStr = maint.date;
        if (!dateStr && maint.timestamp) {
          dateStr = typeof maint.timestamp === 'string' ? maint.timestamp.slice(0, 10) : '';
        }
        if (!dateStr || typeof dateStr !== 'string') return;

        const parts = dateStr.split('-');
        if (parts.length < 2) return;
        const mKey = `${parts[0]}-${parts[1]}`;

        const prefix = (maint.prefix || '').toUpperCase();
        const isTaxi = prefix.includes('TAX');
        const isRent = prefix.includes('ALG') || prefix.includes('RENT');

        if (selectedFinancialFleet === 'taxi' && !isTaxi) return;
        if (selectedFinancialFleet === 'rent' && !isRent) return;
        if (selectedFinancialFleet === 'geral' && (isTaxi || isRent)) return;

        if (monthlyMap[mKey]) {
          monthlyMap[mKey].expense += (maint.cost || 0);
        }
      });
    }

    return Object.entries(monthlyMap).map(([mKey, data]) => {
      return {
        mKey,
        monthLabel: data.monthLabel,
        revenue: data.revenue,
        expense: data.expense,
        profit: data.revenue - data.expense
      };
    }).sort((a, b) => a.mKey.localeCompare(b.mKey));
  };

  const getFleetBreakdownStats = () => {
    const stats = {
      taxi: { revenue: 0, expense: 0 },
      rent: { revenue: 0, expense: 0 },
      geral: { revenue: 0, expense: 0 }
    };

    if (Array.isArray(revenues)) {
      revenues.forEach(rev => {
        const prefix = (rev.prefix || '').toUpperCase();
        const amount = rev.amount || 0;
        if (prefix.includes('TAX')) {
          stats.taxi.revenue += amount;
        } else if (prefix.includes('ALG') || prefix.includes('RENT')) {
          stats.rent.revenue += amount;
        } else {
          stats.geral.revenue += amount;
        }
      });
    }

    if (Array.isArray(maintenanceLogs)) {
      maintenanceLogs.forEach(maint => {
        const prefix = (maint.prefix || '').toUpperCase();
        const cost = maint.cost || 0;
        if (prefix.includes('TAX')) {
          stats.taxi.expense += cost;
        } else if (prefix.includes('ALG') || prefix.includes('RENT')) {
          stats.rent.expense += cost;
        } else {
          stats.geral.expense += cost;
        }
      });
    }

    return stats;
  };

  const callsPerHourData = getCallsPerHourData();
  const averageEarningsData = getAverageEarningsData();

  const filteredCallsForList = calls.filter(call => {
    // 1. Search term filter
    const customerName = String(call?.customerName || '').toLowerCase();
    const customerPhone = String(call?.customerPhone || '');
    const pickupAddress = String(call?.pickupAddress || '').toLowerCase();
    const driverName = String(call?.driverName || '').toLowerCase();
    const term = (callSearchTerm || '').toLowerCase();

    const matchesSearch = 
      customerName.includes(term) ||
      customerPhone.includes(callSearchTerm || '') ||
      pickupAddress.includes(term) ||
      driverName.includes(term);

    if (!matchesSearch) return false;

    // 2. Date filters
    if (!startDate && !endDate) return true;
    
    const ts = call.timestamp;
    if (!ts) return false;
    const callDate = toSafeDate(ts);
                     
    if (!callDate) return false;

    if (startDate && endDate) {
      return isWithinInterval(callDate, {
        start: startOfDay(toSafeDate(startDate) || new Date()),
        end: endOfDay(toSafeDate(endDate) || new Date())
      });
    } else if (startDate) {
      return callDate >= startOfDay(toSafeDate(startDate) || new Date());
    } else if (endDate) {
      return callDate <= endOfDay(toSafeDate(endDate) || new Date());
    }
    return true;
  });

  const exportLogs = () => {
    if (filteredCallsForList.length === 0) {
      alert("Nenhum log para exportar no período selecionado.");
      return;
    }

    const headers = ["Data", "Cliente", "Telemóvel Cliente", "Ponto de Recolha", "Estado", "Motorista Assigned", "Operador"];
    const rows = filteredCallsForList.map(call => [
      formatSafe(call.timestamp, 'dd/MM/yyyy HH:mm:ss', '--:--:--'),
      call.customerName || 'Cliente Direto',
      call.customerPhone || 'N/A',
      `"${(call.pickupAddress || '').replace(/"/g, '""')}"`,
      call.status,
      call.driverName || 'N/A',
      call.op || 'System Central'
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `logs_psm_comercial_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-amber-600 bg-amber-50';
      case 'active': return 'text-brand-primary bg-blue-50';
      case 'completed': return 'text-green-600 bg-green-50';
      case 'cancelled': return 'text-red-600 bg-red-50';
      default: return 'text-slate-500 bg-slate-50';
    }
  };

  const getDriverClassification = (rewards: any[], driverCallsList: any[], accidentsList: any[]) => {
    const totalRev = rewards.reduce((sum, log) => sum + (Number(log.amount) || Number(log.value) || 0), 0);
    const completedCallsCount = driverCallsList.filter(c => c.status === 'completed' || c.status === 'concluída').length;
    const totalCallsCount = driverCallsList.length;
    const compRate = totalCallsCount > 0 ? (completedCallsCount / totalCallsCount) * 100 : 0;
    
    const severeCount = accidentsList.filter(a => a.severity === 'Grave').length;
    const totalAccidents = accidentsList.length;

    if (severeCount > 0 || totalAccidents >= 2) {
      return {
        label: 'RUIM',
        color: 'text-red-600 bg-red-50 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/30',
        borderColor: 'border-red-200 hover:border-red-400 dark:border-red-900/40 dark:hover:border-red-800',
        badgeColor: 'bg-red-500 text-white',
        bulletColor: 'bg-red-500',
        desc: 'Classificação Ruim: Registou acidentes graves ou histórico recorrente de sinistros (>1), indicando risco elevado para a frota.',
        reason: severeCount > 0 ? 'Sinistro Grave Registado' : 'Múltiplos Sinistros / Rendimento Nulo'
      };
    } else if (totalAccidents === 1) {
      if (totalRev >= 100000 && compRate >= 75) {
        return {
          label: 'NORMAL',
          color: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/30',
          borderColor: 'border-amber-200 hover:border-amber-400 dark:border-amber-900/40 dark:hover:border-amber-800',
          badgeColor: 'bg-amber-500 text-slate-900',
          bulletColor: 'bg-amber-500',
          desc: 'Classificação Normal: Enquadrado devido a um único sinistro leve ou médio registado, apesar do bom faturamento e atendimento.',
          reason: 'Faturamento Bom com 1 Sinistro'
        };
      } else {
        return {
          label: 'RUIM',
          color: 'text-red-600 bg-red-50 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/30',
          borderColor: 'border-red-200 hover:border-red-400 dark:border-red-900/40 dark:hover:border-red-800',
          badgeColor: 'bg-red-500 text-white',
          bulletColor: 'bg-red-500',
          desc: 'Classificação Ruim: Possui um acidente registado conjugado com baixos rendimentos monetários ou baixo volume de chamadas.',
          reason: 'Baixo Desempenho + 1 Sinistro'
        };
      }
    } else { // 0 accidents
      if (totalRev === 0 && totalCallsCount === 0) {
        return {
          label: 'NORMAL',
          color: 'text-slate-500 bg-slate-50 border-slate-200 dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-800/30',
          borderColor: 'border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700',
          badgeColor: 'bg-slate-500 text-white',
          bulletColor: 'bg-slate-400',
          desc: 'Classificação Normal: Colaborador sem histórico operacional recente ou recém-admitido na frota (0 sinistros).',
          reason: 'Sem Atividade / Recém-admitido'
        };
      } else if (totalRev >= 35000 && compRate >= 70) {
        return {
          label: 'BOM',
          color: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/30',
          borderColor: 'border-emerald-200 hover:border-emerald-400 dark:border-emerald-900/40 dark:hover:border-emerald-800 shadow-md shadow-emerald-50/50',
          badgeColor: 'bg-emerald-500 text-white',
          bulletColor: 'bg-emerald-400',
          desc: 'Classificação Excelente/Bom: Rendimento financeiro consistente, bom índice de atendimento e ausência total de acidentes.',
          reason: 'Faturamento Excelente + Sem Sinistros'
        };
      } else {
        return {
          label: 'NORMAL',
          color: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/30',
          borderColor: 'border-amber-200 hover:border-amber-400 dark:border-amber-900/40 dark:hover:border-amber-800',
          badgeColor: 'bg-amber-500 text-slate-900',
          bulletColor: 'bg-amber-500',
          desc: 'Classificação Normal: Histórico impecável de zero sinistros, com entregas de faturamento e chamadas moderadas.',
          reason: 'Operação Regular + Sem Sinistros'
        };
      }
    }
  };

  const rankedDrivers = React.useMemo(() => {
    return driversMaster.map(driver => {
      const driverRev = revenues.filter(r => r.driverName === driver.name);
      const driverCallsList = calls.filter(c => c.driverName === driver.name);
      const driverAccs = accidents.filter(a => a.driverName === driver.name);
      
      const totalRev = driverRev.reduce((sum, r) => sum + (Number(r.amount) || Number(r.value) || 0), 0);
      const callsCount = driverCallsList.length;
      const completedCalls = driverCallsList.filter(c => c.status === 'completed' || c.status === 'concluída').length;
      const compRate = callsCount > 0 ? Math.round((completedCalls / callsCount) * 100) : 0;
      const speedVioCount = speedViolations.filter(s => s.driverName === driver.name).length;
      
      const classif = getDriverClassification(driverRev, driverCallsList, driverAccs);
      
      return {
        ...driver,
        totalRevenue: totalRev,
        callsCount,
        completedCalls,
        completionRate: compRate,
        accidentCount: driverAccs.length,
        speedViolationCount: speedVioCount,
        classification: classif
      };
    });
  }, [driversMaster, revenues, calls, accidents, speedViolations]);

  const filteredRankedDrivers = React.useMemo(() => {
    return rankedDrivers.filter(d => {
      // Filter by classification label
      if (rankingFilter !== 'todos' && d.classification.label !== rankingFilter) {
        return false;
      }
      // Filter by search bar matching name or license plate
      const search = rankingSearch.toLowerCase();
      if (search) {
        const matchesName = (d.name || '').toLowerCase().includes(search);
        const matchesLicense = (d.licenseNumber || '').toLowerCase().includes(search);
        return matchesName || matchesLicense;
      }
      return true;
    }).sort((a, b) => {
      // Sort: BOM first, then NORMAL, then RUIM, and secondary sort by revenue
      const tierMap = { 'BOM': 1, 'NORMAL': 2, 'RUIM': 3 };
      const tierA = tierMap[a.classification.label] || 2;
      const tierB = tierMap[b.classification.label] || 2;
      if (tierA !== tierB) return tierA - tierB;
      return b.totalRevenue - a.totalRevenue; // higher revenues first
    });
  }, [rankedDrivers, rankingFilter, rankingSearch]);

  const rankingStats = React.useMemo(() => {
    const total = rankedDrivers.length;
    const bom = rankedDrivers.filter(d => d.classification.label === 'BOM').length;
    const normal = rankedDrivers.filter(d => d.classification.label === 'NORMAL').length;
    const ruim = rankedDrivers.filter(d => d.classification.label === 'RUIM').length;
    return { total, bom, normal, ruim };
  }, [rankedDrivers]);

  return (
    <div className="space-y-8 max-w-[1500px] mx-auto pb-20 relative">
      {/* Notifications Overlay */}
      <div className="fixed top-24 right-8 z-[60] flex flex-col gap-4 pointer-events-none">
        <AnimatePresence>
          {notifications.map(n => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.9 }}
              className="bg-slate-900 text-white p-5 rounded-2xl shadow-2xl border border-white/10 min-w-[320px] pointer-events-auto flex items-start gap-4"
            >
              <div className="bg-brand-primary p-2.5 rounded-xl shadow-lg shadow-brand-primary/20">
                <AlertCircle size={20} />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-brand-primary mb-1.5 italic">Atenção Central: Nova Chamada</p>
                <p className="font-black text-[13px] tracking-tight">{n.customer}</p>
                <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1 italic">Para: {n.pickup}</p>
              </div>
              <button 
                onClick={() => setNotifications(prev => prev.filter(notif => notif.id !== n.id))}
                className="text-slate-500 hover:text-white transition-colors p-1"
              >
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="bg-white dark:bg-slate-900 px-10 py-10 rounded-[2.25rem] border border-slate-200 dark:border-white/5 shadow-sm relative overflow-hidden flex flex-col lg:flex-row lg:items-center justify-between gap-8 group">
          <div className="absolute top-0 right-0 w-[40%] h-full bg-slate-50 dark:bg-slate-800/50 border-l border-slate-100 dark:border-white/5 -mr-20 rotate-12 -z-0 opacity-50 group-hover:rotate-6 transition-transform duration-1000" />
          
          <div className="relative z-10 flex items-center gap-8">
            <div className="w-20 h-20 bg-slate-900 dark:bg-black rounded-[2.25rem] flex items-center justify-center text-white shadow-2xl shadow-slate-900/20 rotate-3 group-hover:rotate-0 transition-all duration-500">
               <Gauge size={40} className="text-brand-primary" />
            </div>
            <div>
              <h2 className="font-black text-4xl text-slate-900 dark:text-white tracking-tighter uppercase italic">
                Painel de comando
              </h2>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-[0.4em] mt-2 flex items-center gap-3">
                <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                SISTEMA INTEGRADO PS MOREIRA • LUENA
              </p>
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-6">
             <div className="text-right hidden sm:block">
                <div className="flex items-center gap-2 justify-end mb-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Canal Unitel Gateway</span>
                  <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
                </div>
                <p className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  {unitelStats.calls} <span className="text-[10px] text-slate-400 font-bold ml-1 uppercase">Entradas Ativas</span>
                </p>
             </div>
             
             <div className="h-14 w-px bg-slate-200 dark:bg-white/10" />
             
             <div className="text-right">
                <div className="flex items-center gap-2 justify-end mb-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronização Cloud</span>
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                </div>
                <p className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  v.6.5 ESTÁVEL <span className="text-[10px] text-slate-400 font-bold ml-1 uppercase">Monitor Live</span>
                </p>
             </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-10">
        {/* Main Column */}
        <div className="space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {stats.map((stat, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white dark:bg-slate-900 p-7 rounded-[2.25rem] border border-slate-200 dark:border-white/5 shadow-sm relative overflow-hidden hover:border-brand-primary/20 hover:shadow-xl hover:shadow-slate-100 dark:hover:shadow-black transition-all group"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-brand-primary group-hover:text-white transition-all shadow-inner">
                    <stat.icon size={22} />
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-800/30 uppercase tracking-wider">{stat.trend}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-1.5">{stat.sub}</span>
                  </div>
                </div>
                <div className="flex flex-col">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{stat.label}</p>
                   <p className={cn("text-4xl font-black tracking-tighter", stat.color)}>{stat.value}</p>
                </div>
              </motion.div>
            ))}

            {/* Real-Time Mobile Interactions Monitor - NEW GATEWAY */}
            <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               className="col-span-1 md:col-span-2 bg-gradient-to-r from-slate-900 to-slate-950 p-1 rounded-[2.25rem] shadow-2xl shadow-slate-900/30 border border-slate-800"
            >
               <div className="bg-white dark:bg-slate-900 rounded-[2.15rem] p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-emerald-500/20">
                      <Zap size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">
                        Gateway de Monitorização <span className="text-emerald-500">(DIRECTO)</span>
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">Interações intercetadas via telemóvel (Viatura)</p>
                        <span className="text-[10px] bg-slate-100 dark:bg-white/5 text-slate-500 px-2 py-0.5 rounded-full font-mono font-bold">/api/gateway/telemetry</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                    <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest">LIVE SYNC</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {interactionLogs.length > 0 ? interactionLogs.map((log) => (
                    <div key={log.id} className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-3xl border border-slate-100 dark:border-white/5 hover:border-emerald-500/30 transition-all group relative overflow-hidden">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                           <div className={cn(
                             "w-8 h-8 rounded-xl flex items-center justify-center shadow-sm",
                             log.type?.toLowerCase().includes("chamada") ? "bg-emerald-500 text-white" : "bg-blue-500 text-white"
                           )}>
                             {log.type?.toLowerCase().includes("chamada") ? <Phone size={14} /> : <MessageSquare size={14} />}
                           </div>
                           <div>
                              <p className="text-xs font-black text-slate-900 dark:text-white italic">{log.vehicle}</p>
                              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{log.driverName}</p>
                           </div>
                        </div>
                        <p className="text-[8px] font-mono font-bold text-slate-400">
                          {formatSafe(log.serverTimestamp, 'HH:mm:ss')}
                        </p>
                      </div>

                      <div className="space-y-1 mt-4">
                        <p className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-tight flex items-center gap-1.5">
                           <Phone size={10} className="text-emerald-500" />
                           {log.clientPhone}
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest italic pt-1 border-t border-slate-200/50 dark:border-white/5">
                           Acção: {log.type}
                        </p>
                      </div>
                    </div>
                  )) : (
                    <div className="col-span-full py-10 border-2 border-dashed border-slate-100 dark:border-white/5 rounded-3xl flex flex-col items-center justify-center text-slate-300">
                       <Smartphone size={32} className="mb-2 opacity-20" />
                       <p className="text-[10px] font-black uppercase tracking-widest italic">A aguardar telemetria dos táxis...</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Smart Network Status - Rigorous Management Request */}
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-gradient-to-r from-slate-900 to-slate-950 p-7 rounded-[2.25rem] border border-white/10 dark:border-white/5 shadow-2xl relative overflow-hidden group col-span-1 md:col-span-2"
              >
                <div className="absolute top-0 right-0 p-8 opacity-[0.05] pointer-events-none rotate-12">
                   <Smartphone size={140} />
                </div>
                <div className="flex items-center justify-between mb-6 relative z-10">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-brand-primary rounded-2xl flex items-center justify-center text-white shadow-xl shadow-brand-primary/20">
                         <Smartphone size={24} />
                      </div>
                      <div>
                         <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Smartphone Fleet Gateway</h4>
                         <div className="text-lg font-black text-white italic tracking-tighter flex items-center gap-2">
                           Sincronização Rigorosa
                           <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                         </div>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-[9px] font-black text-brand-primary uppercase tracking-widest mb-1">Canais Activos</p>
                      <p className="text-2xl font-black text-white italic tracking-tighter">21 Terminais</p>
                   </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10 pt-4 border-t border-white/5">
                   <div className="space-y-1">
                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Protocolo Unitel</p>
                      <p className="text-sm font-black text-slate-300 italic">GATEWAY 100% OK</p>
                   </div>
                   <div className="space-y-1">
                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Monitorização</p>
                      <p className="text-sm font-black text-slate-300 italic">24H AUDITADO</p>
                   </div>
                   <div className="space-y-1 text-right">
                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Integridade APP</p>
                      <p className="text-sm font-black text-emerald-400 italic">TOTAL (ENCRYPTED)</p>
                   </div>
                </div>
             </motion.div>
          </div>


          {/* SECÇÃO DE RANKING DE MOTORISTAS - REMOVIDO PARA ESTATÍSTICAS */}
          <div className="hidden bg-white dark:bg-slate-900 rounded-[2.25rem] border border-slate-200 dark:border-white/5 shadow-sm overflow-hidden group/ranking">
             <div className="px-10 py-8 border-b border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-slate-800/20 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                   <h3 className="font-black text-lg text-slate-900 dark:text-white uppercase tracking-tighter italic flex items-center gap-3">
                      <Award className="text-brand-primary animate-pulse" size={24} />
                      Classificação e Ranking de Motoristas
                   </h3>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Auditado com base em faturamento, chamadas atendidas e sinistros</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 flex-1 justify-end">
                   <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input 
                        type="text"
                        placeholder="Pesquisar motorista..."
                        value={rankingSearch}
                        onChange={(e) => setRankingSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:border-brand-primary shadow-sm text-slate-900 dark:text-white"
                      />
                   </div>

                   <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200/50 dark:border-white/5 gap-1 shadow-inner">
                     <button
                       onClick={() => setRankingFilter('todos')}
                       className={cn(
                         "px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all",
                         rankingFilter === 'todos' ? "bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-sm" : "text-slate-400 hover:text-slate-650 dark:hover:text-slate-350"
                       )}
                     >
                       Todos ({rankingStats.total})
                     </button>
                     <button
                       onClick={() => setRankingFilter('BOM')}
                       className={cn(
                         "px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all",
                         rankingFilter === 'BOM' ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/20" : "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/10"
                       )}
                     >
                       Bom ({rankingStats.bom})
                     </button>
                     <button
                       onClick={() => setRankingFilter('NORMAL')}
                       className={cn(
                         "px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all",
                         rankingFilter === 'NORMAL' ? "bg-amber-500 text-slate-900 shadow-sm shadow-amber-500/20" : "text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/10"
                       )}
                     >
                       Normal ({rankingStats.normal})
                     </button>
                     <button
                       onClick={() => setRankingFilter('RUIM')}
                       className={cn(
                         "px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all",
                         rankingFilter === 'RUIM' ? "bg-red-500 text-white shadow-sm shadow-red-500/20" : "text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10"
                       )}
                     >
                       Ruim ({rankingStats.ruim})
                     </button>
                   </div>
                </div>
             </div>

             <div className="p-8 bg-slate-50/10 dark:bg-slate-950/20">
               {/* Resumo da Distribuição do Ranking */}
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 pt-2">
                 <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-white/5 flex items-center justify-between">
                   <div>
                     <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Classe A (Excelente)</p>
                     <p className="text-2xl font-black text-emerald-600 tracking-tight mt-1">
                       {rankingStats.total > 0 ? Math.round((rankingStats.bom / rankingStats.total) * 100) : 0}%
                     </p>
                   </div>
                   <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500 rounded-xl flex items-center justify-center font-bold">A</div>
                 </div>
                 
                 <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-white/5 flex items-center justify-between">
                   <div>
                     <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Classe B (Operação Regular)</p>
                     <p className="text-2xl font-black text-amber-500 tracking-tight mt-1">
                       {rankingStats.total > 0 ? Math.round((rankingStats.normal / rankingStats.total) * 100) : 0}%
                     </p>
                   </div>
                   <div className="w-10 h-10 bg-amber-50 dark:bg-amber-950/30 text-amber-550 rounded-xl flex items-center justify-center font-bold">B</div>
                 </div>

                 <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-white/5 flex items-center justify-between">
                   <div>
                     <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Classe C (Atenção Central)</p>
                     <p className="text-2xl font-black text-red-600 tracking-tight mt-1">
                       {rankingStats.total > 0 ? Math.round((rankingStats.ruim / rankingStats.total) * 100) : 0}%
                     </p>
                   </div>
                   <div className="w-10 h-10 bg-red-50 dark:bg-red-950/30 text-red-500 rounded-xl flex items-center justify-center font-bold">C</div>
                 </div>
               </div>

               {/* Grid Cards of ranked drivers */}
               {filteredRankedDrivers.length > 0 ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {filteredRankedDrivers.map((driver, idx) => (
                     <motion.div
                       key={`${driver.id}-${idx}`}
                       initial={{ opacity: 0, y: 10 }}
                       animate={{ opacity: 1, y: 0 }}
                       className={cn(
                         "bg-white dark:bg-slate-900 p-6 rounded-3xl border transition-all hover:shadow-lg flex flex-col justify-between",
                         driver.classification.borderColor
                       )}
                     >
                       <div>
                         {/* Card Header with Name & Classification Badge */}
                         <div className="flex justify-between items-start mb-4">
                           <div className="flex items-center gap-3">
                             <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold flex items-center justify-center border border-slate-200/20">
                               {driver.name ? driver.name[0]?.toUpperCase() : 'M'}
                             </div>
                             <div>
                               <h4 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-tight">{driver.name}</h4>
                               <p className="text-[9px] text-slate-400 font-semibold uppercase">{driver.licenseNumber || 'Licenca N/D'}</p>
                             </div>
                           </div>
                           
                           <span className={cn("px-3 py-1 rounded-full text-[9px] font-black tracking-widest border flex items-center gap-1.5", driver.classification.color)}>
                             <span className={cn("w-1.5 h-1.5 rounded-full", driver.classification.bulletColor)} />
                             {driver.classification.label}
                           </span>
                         </div>

                         {/* Classification Detail Reason */}
                         <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed mb-4 italic p-2.5 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-white/5 uppercase font-bold tracking-tight">
                           {driver.classification.desc}
                         </p>

                         {/* Driver Operational Metrics */}
                         <div className="grid grid-cols-3 gap-2 py-3 border-t border-b border-slate-100 dark:border-white/5 mb-4">
                           <div className="text-center">
                             <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Rendimentos</span>
                             <span className="text-[11px] font-black text-slate-800 dark:text-slate-200 font-mono italic">
                               {driver.totalRevenue ? driver.totalRevenue.toLocaleString() + ' Akz' : '0 Akz'}
                             </span>
                           </div>
                           
                           <div className="text-center border-l border-r border-slate-100 dark:border-white/5">
                             <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Chamadas</span>
                             <span className="text-[11px] font-black text-slate-800 dark:text-slate-200">
                               {driver.callsCount} <span className="text-[8px] text-slate-400 font-bold ml-1">({driver.completionRate}%)</span>
                             </span>
                           </div>

                           <div className="text-center">
                             <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Sinistros</span>
                             <span className={cn("text-[11px] font-black", driver.accidentCount > 0 ? "text-red-600 animate-pulse font-extrabold" : "text-green-600")}>
                               {driver.accidentCount} {driver.accidentCount > 0 ? '⚠️' : '✓'}
                             </span>
                           </div>
                         </div>
                       </div>

                       {/* Action Block */}
                       <div className="flex items-center justify-between pt-2">
                         <div className="flex gap-2">
                           {driver.phone && (
                             <a
                               href={`tel:${driver.phone}`}
                               className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-650 dark:text-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all inline-flex items-center gap-1 border border-slate-200/20"
                             >
                               <Phone size={10} /> Chamar
                             </a>
                           )}
                           {driver.phone && (
                             <a
                               href={`https://wa.me/${driver.phone.replace(/\D/g, '')}?text=Aviso%20Central%20TaxiControl%3A%20Olá%20${encodeURIComponent(driver.name)}.%20Aguardamos%20contacto%20para%20revisão%20operacional.`}
                               target="_blank"
                               className="px-3 py-1.5 bg-emerald-50 bg-opacity-80 dark:bg-emerald-950/20 hover:bg-emerald-500 hover:text-white text-emerald-600 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all inline-flex items-center gap-1 border border-emerald-250/20"
                             >
                               WhatsApp
                             </a>
                           )}
                         </div>
                         
                         <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest italic">
                           {driver.classification.reason}
                         </span>
                       </div>
                     </motion.div>
                   ))}
                 </div>
               ) : (
                 <div className="py-16 text-center bg-white dark:bg-slate-900 border border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center text-slate-400">
                    <Award size={36} className="text-slate-300 dark:text-slate-750 mb-3 opacity-30" />
                    <p className="text-[10px] font-black uppercase tracking-widest italic">Nenhum motorista corresponde aos critérios de pesquisa</p>
                 </div>
               )}
             </div>
          </div>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-10">
              {/* Technical Node Status */}
              <div className="bg-slate-950 border border-slate-850 dark:border-white/5 shadow-xl rounded-[2.25rem] p-6 space-y-4">
                 <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Estado da Central</span>
                    <span className="text-[9px] font-black text-brand-primary uppercase animate-pulse italic">Live Feed</span>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                       <p className="text-[8px] text-slate-500 font-black uppercase mb-1">Carga CPU</p>
                       <p className="text-sm font-black text-white italic tracking-tighter">12% <span className="text-emerald-500 text-[8px]">Ok</span></p>
                    </div>
                    <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                       <p className="text-[8px] text-slate-500 font-black uppercase mb-1">Database</p>
                       <p className="text-sm font-black text-white italic tracking-tighter">9ms <span className="text-emerald-500 text-[8px]">Low Lat</span></p>
                    </div>
                 </div>
              </div>

              {/* AI Insights Section */}
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-brand-primary/5 dark:bg-brand-primary/10 border border-brand-primary/20 rounded-[2.25rem] p-8 relative overflow-hidden"
              >
                 <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Zap size={64} className="text-brand-primary" />
                 </div>
                 <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 bg-brand-primary rounded-lg flex items-center justify-center text-white shadow-lg shadow-brand-primary/20">
                       <Zap size={16} />
                    </div>
                    <h3 className="font-black text-sm uppercase tracking-widest italic">Análise Inteligente (IA)</h3>
                 </div>
                 <div className="space-y-4">
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-1 italic">Resumo de Performance:</p>
                    <div className="bg-white/80 dark:bg-slate-900/80 p-4 rounded-2xl border border-brand-primary/10 shadow-sm backdrop-blur-sm">
                       <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-bold italic">
                          {isAiLoading ? "A gerar relatório estratégico..." : aiInsight}
                       </p>
                    </div>
                    <button 
                      onClick={generateAiInsight}
                      disabled={isAiLoading}
                      className="w-full py-3 bg-brand-primary text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-brand-primary/20 disabled:opacity-50"
                    >
                       {isAiLoading ? "A Processar..." : "Gerar Novo Insight IA"}
                    </button>
                 </div>
              </motion.div>

              {missedCalls.length > 0 && (
            <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 rounded-[2.25rem] overflow-hidden shadow-2xl relative"
            >
               <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none" />
               
               <div className="px-8 py-6 bg-rose-600 text-white flex items-center justify-between shadow-lg relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center animate-pulse">
                       <AlertCircle size={24} />
                    </div>
                    <div>
                       <h3 className="font-black text-sm uppercase tracking-[0.2em] italic leading-none">Alerta: Perdidas</h3>
                       <p className="text-[9px] font-bold text-rose-200 mt-1 uppercase tracking-widest">SLA crítico ultrapassado</p>
                    </div>
                  </div>
                  <span className="bg-white text-rose-600 w-10 h-10 flex items-center justify-center rounded-2xl text-lg font-black shadow-inner">
                    {missedCalls.length}
                  </span>
               </div>
               
               <div className="p-2 space-y-2 max-h-[350px] overflow-y-auto no-scrollbar relative z-10">
                  {missedCalls.map((call) => (
                  <div key={call.id} className="bg-white/60 dark:bg-slate-900/60 p-5 rounded-2xl border border-rose-100 dark:border-rose-900/20 hover:bg-white dark:hover:bg-slate-900 transition-all shadow-sm group">
                     <div className="flex justify-between items-start mb-3">
                        <p className="text-[13px] font-black text-slate-900 dark:text-white uppercase tracking-tight italic group-hover:text-rose-600 transition-colors">{call.customerName || 'Cliente sem ID'}</p>
                        <div className="flex flex-col items-end gap-1.5">
                           <span className="text-[10px] font-black text-rose-500 bg-rose-50 dark:bg-rose-900/40 px-2 py-0.5 rounded-full border border-rose-100 dark:border-rose-800/40">
                             PERDIDA • <WaitingTimer timestamp={call.timestamp} />
                           </span>
                           <button 
                              onClick={() => handleResolveMissedCall(call.id)}
                              className="p-1.5 bg-rose-50 dark:bg-rose-900/30 text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-800 transition-colors shadow-sm"
                              title="Limpar Alerta"
                           >
                              <CheckCircle size={14} />
                           </button>
                        </div>
                     </div>
                     <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 mb-2">
                        <div className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg">
                           <Phone size={12} className="text-rose-400" />
                        </div>
                        <span className="text-[11px] font-black tracking-widest">{call.customerPhone}</span>
                     </div>
                     <p className="text-[11px] text-slate-400 dark:text-slate-500 italic flex items-center gap-2 tracking-tight">
                        <MapPin size={12} className="text-brand-primary" /> {call.pickupAddress}
                     </p>
                  </div>
                  ))}
               </div>
               
               <div className="p-6 bg-rose-100/50 dark:bg-rose-900/20 text-center border-t border-rose-100/50 dark:border-rose-900/20">
                  <p className="text-[10px] font-black text-rose-800 dark:text-rose-400 uppercase tracking-[0.1em] italic">
                    Acção necessária: Auditoria de Atendimento REQUERIDA
                  </p>
              </div>
            </motion.div>
          )}

          <div className="bg-white dark:bg-slate-900 rounded-[2.25rem] border border-slate-200 dark:border-white/5 shadow-sm overflow-hidden h-[650px] flex flex-col group">
             <div className="px-8 py-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                <div>
                   <h3 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-widest italic flex items-center gap-3 text-brand-primary">
                     <MapPin size={20} />
                     Centro de Tracking
                   </h3>
                   <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-[0.2em] mt-1">Frota Activa em Luena</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-100 dark:border-emerald-800/30 text-[10px] font-black uppercase italic tracking-widest shadow-sm">
                   <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                   Monitor Activo
                </div>
             </div>
             <div className="flex-1 bg-slate-50 dark:bg-slate-950 relative z-0">
                {/* @ts-ignore */}
                <MapContainer key={`${mapCenter[0]}-${mapCenter[1]}-${mapZoom}`} center={mapCenter} zoom={mapZoom} style={{ height: '100%', width: '100%' }} zoomControl={false} className="grayscale-[0.2] contrast-[1.1]">
                   {/* @ts-ignore */}
                   <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                   {vehicles.map((driver, idx) => (
                   /* @ts-ignore */
                   <Marker key={`${driver.id}-${idx}`} position={[Number(driver.lat) || -11.7833, Number(driver.lng) || 19.9167]} icon={createDashboardIcon(driver)}>
                      {/* @ts-ignore */}
                      <Popup offset={[0, -15]}>
                         <div className="p-3 min-w-[140px] font-sans dark:bg-slate-900">
                            <p className={cn("font-black text-brand-primary text-sm mb-1 italic tracking-tight", driver.speed > 85 ? "text-red-600 animate-pulse" : "")}>{driver.prefix} {driver.speed > 85 && "⚠️"}</p>
                            <p className="text-[11px] text-slate-900 dark:text-white font-black uppercase">Staff: {driver.name}</p>
                            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/5">
                               <p className="text-[9px] text-slate-500 font-bold uppercase">Status: <span className="text-slate-900 dark:text-white">{driver.status}</span></p>
                               <p className={cn("text-[11px] font-black uppercase mt-0.5", driver.speed > 85 ? "text-red-600" : "text-slate-900 dark:text-white")}>V: {driver.speed || 0} km/h</p>
                            </div>
                         </div>
                      </Popup>
                   </Marker>
                   ))}
                    {panicAlerts.map(alert => {
                      if (!alert.lat || !alert.lng) return null;
                      return (
                        /* @ts-ignore */
                        <Marker key={`panic-marker-${alert.id}`} position={[alert.lat, alert.lng]} icon={createPanicIcon(alert.prefix)}>
                          {/* @ts-ignore */}
                          <Popup offset={[0, -15]}>
                            <div className="p-3 min-w-[150px] font-sans dark:bg-slate-900">
                              <p className="font-sans font-black text-rose-600 text-sm mb-1 italic tracking-tight animate-pulse">⚠️ ALERTA DE PÂNICO ⚠️</p>
                              <p className="text-[11px] text-slate-1050 dark:text-white font-black uppercase">Viatura: {alert.prefix || 'N/A'}</p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">Motorista: {alert.driverName || 'Motorista'}</p>
                              {alert.driverPhone && (
                                <p className="text-[10px] text-emerald-600 font-bold uppercase mt-1 font-mono">Contacto: {alert.driverPhone}</p>
                              )}
                              <p className="text-[8px] text-slate-400 mt-2 italic font-mono">{alert.timestamp ? new Date(alert.timestamp).toLocaleString() : ''}</p>
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}
                </MapContainer>
                {/* ... existing legend ... */}
             </div>
          </div>

          <div className="bg-slate-950 rounded-[2.25rem] border border-slate-850 dark:border-white/5 shadow-2xl overflow-hidden group">
             <div className="px-8 py-6 bg-red-600 flex items-center justify-between text-white">
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                      <Zap size={20} className="fill-white" />
                   </div>
                   <div>
                      <h3 className="font-black text-sm uppercase tracking-widest italic leading-none">Rastreador de Risco</h3>
                      <p className="text-[9px] font-bold text-red-100 mt-1 uppercase tracking-widest italic opacity-80">Log de Infrações Técnicas em Luena</p>
                   </div>
                </div>
                <div className="w-2.5 h-2.5 bg-white rounded-full animate-ping" />
             </div>
             
             <div className="p-2 space-y-2 max-h-[400px] overflow-y-auto no-scrollbar">
                {speedViolations.length > 0 ? speedViolations.map((v, idx) => (
                  <div key={idx} className="bg-white/5 p-4 rounded-2xl border border-white/5 hover:bg-white/10 transition-all flex items-center justify-between group/v">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-red-500/20 text-red-500 rounded-xl flex items-center justify-center font-black italic text-lg shadow-inner">
                        {v.speed}
                      </div>
                      <div>
                        <p className="text-[12px] font-black text-white italic tracking-tight">{v.prefix} • {v.driverName}</p>
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                           Excesso de Velocidade @ {formatSafe(v.timestamp, 'HH:mm:ss')}
                        </p>
                      </div>
                    </div>
                    <a 
                      href={`https://wa.me/${v.phone || ''}?text=ALERTA%20TECNICO%3A%20Viatura%20${v.prefix}%20detectada%20a%20${v.speed}km/h.%20Reduza%20imediatamente!`}
                      target="_blank"
                      className="p-2.5 bg-emerald-500/20 text-emerald-500 rounded-xl hover:bg-emerald-500 hover:text-white transition-all opacity-0 group-hover/v:opacity-100"
                    >
                      <Smartphone size={16} />
                    </a>
                  </div>
                )) : (
                  <div className="py-12 text-center">
                    <CheckCircle size={32} className="mx-auto text-emerald-500 mb-3 opacity-20" />
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sem infrações críticas nas últimas 24h</p>
                  </div>
                )}
             </div>

             <div className="p-5 border-t border-white/5 text-center">
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest italic opacity-50">Dados Transmitidos via Central Unitel PSM</p>
             </div>
          </div>

          <div className="bg-slate-950 rounded-[2.25rem] border border-slate-850 dark:border-white/5 shadow-2xl relative overflow-hidden group">
             <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none" />
             
             <div className="px-8 py-8 border-b border-white/5 bg-transparent flex items-center justify-between text-white relative z-10 font-sans italic">
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20 rotate-3 group-hover:rotate-0 transition-all">
                      <Smartphone size={20} className="text-white" />
                   </div>
                   <h3 className="font-black text-md">Gateway Monitor (Unitel)</h3>
                </div>
                <span className="text-[10px] font-black text-orange-500 uppercase tracking-[0.2em] opacity-80">PSM COMERCIAL LUENA</span>
             </div>
             <div className="p-8 grid grid-cols-2 gap-8 relative z-10">
                <div className="bg-white/5 p-5 rounded-[1.5rem] border border-white/5 shadow-inner">
                   <p className="text-[10px] font-black text-orange-500 uppercase mb-2 tracking-widest italic opacity-80">Entradas de Rede</p>
                   <p className="text-3xl font-black text-white italic tracking-tighter">{unitelStats.calls}</p>
                   <div className="mt-4 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-orange-500" style={{ width: `${(unitelStats.calls / (calls.length || 1)) * 100}%` }} />
                   </div>
                </div>
                <div className="bg-white/5 p-5 rounded-[1.5rem] border border-white/5 shadow-inner">
                   <p className="text-[10px] font-black text-orange-400 uppercase mb-2 tracking-widest italic opacity-80">Sync com Drivers</p>
                   <p className="text-3xl font-black text-white italic tracking-tighter">{unitelStats.sms}</p>
                   <div className="mt-4 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-orange-400" style={{ width: `${(activeUnitelDrivers / (activeVehicles || 1)) * 100}%` }} />
                   </div>
                </div>
                <div className="col-span-2 bg-[#0f172a] p-4 rounded-2xl border border-white/5 flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
                      <span className="text-[10px] font-black text-slate-300 uppercase italic tracking-widest">Activos Luena</span>
                   </div>
                   <span className="text-[14px] font-black text-orange-500 tracking-tight">{activeUnitelDrivers} <span className="text-white opacity-20 text-[10px] italic">/ {activeVehicles} Terminal</span></span>
                </div>
             </div>
          </div>
          
          <div className="bg-white dark:bg-slate-900 rounded-[2.25rem] border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-200 bg-red-600 flex items-center justify-between">
              <h3 className="font-bold text-[13px] text-white uppercase tracking-widest flex items-center gap-2">
                <ShieldAlert size={16} className="animate-pulse" />
                Alertas de Emergência
              </h3>
              <span className="text-[10px] font-black bg-white/20 px-2 py-0.5 rounded text-white uppercase tracking-widest">Live</span>
            </div>
            <div className="p-4 space-y-3">
              {criticalAlerts.filter(a => !acknowledgedAlerts.has(a.id)).length > 0 ? (
                criticalAlerts.filter(a => !acknowledgedAlerts.has(a.id)).map((alert, idx) => (
                  <div key={idx} className={`p-3 border-l-4 rounded shadow-sm ${
                    alert.id.startsWith('panic-') 
                      ? 'bg-red-600 border-white text-white animate-pulse shadow-xl shadow-red-200' 
                      : alert.type === 'danger' || alert.id.startsWith('speed-')
                        ? 'bg-red-50 dark:bg-red-950/20 border-red-600' 
                        : 'bg-amber-50 dark:bg-amber-950/20 border-amber-500'
                  }`}>
                    <div className="flex justify-between items-start mb-1">
                      <span className={`text-[10px] font-black uppercase tracking-tighter ${
                        alert.id.startsWith('panic-') ? 'text-white' : alert.type === 'danger' ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'
                      }`}>
                        {formatSafe(alert.time, 'HH:mm')} - {alert.title}
                      </span>
                      <button 
                        onClick={() => handleResolveAlert(alert.id)}
                        className={cn(
                          "p-1 rounded-md transition-all",
                          alert.id.startsWith('panic-') ? "hover:bg-white/20 text-white" : "hover:bg-black/5 text-slate-400 hover:text-slate-600"
                        )}
                        title="Marcar como Resolvido"
                      >
                        <CheckCircle size={14} />
                      </button>
                    </div>
                    <p className={`text-[12px] font-bold leading-tight ${alert.id.startsWith('panic-') ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>{alert.message}</p>
                    {alert.id.startsWith('panic-') && (
                      <div className="mt-3 flex items-center gap-2 pt-2 border-t border-white/20">
                        {(() => {
                          const phone = getDriverPhone(alert.driverId, alert.driverName, alert.prefix, alert.driverPhone);
                          return phone ? (
                            <a 
                              href={`tel:${phone}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all font-mono"
                            >
                              Ligar Já
                            </a>
                          ) : (
                            <span className="text-[8px] font-bold text-white/50 uppercase tracking-widest italic">Sem Contacto</span>
                          );
                        })()}
                        {alert.lat && alert.lng && (
                          <button 
                            onClick={() => {
                              setMapCenter([alert.lat, alert.lng]);
                              setMapZoom(16);
                            }}
                            className="inline-flex items-center bg-white/10 hover:bg-white/20 text-white border border-white/15 py-1.5 px-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 cursor-pointer"
                            title="Focar no Mapa"
                          >
                            Focar Mapa
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-10 text-center text-slate-400">
                  <p className="text-[11px] font-bold uppercase tracking-widest opacity-30">Nenhum evento crítico detectado</p>
                </div>
              )}
              
              {/* Simulation Note for Demo */}
              <div className="pt-2 border-t border-slate-100">
                <p className="text-[9px] text-slate-400 italic">O sistema monitoriza automaticamente telemetria GPS e falhas de serviço em tempo real.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Invoice Viewer Modal */}
      {isInvoiceViewerOpen && selectedInvoiceData && (
        <InvoiceViewerModal 
          isOpen={isInvoiceViewerOpen}
          onClose={() => setIsInvoiceViewerOpen(false)}
          data={selectedInvoiceData}
          documentNumber={'FR WT2025/' + (selectedInvoiceData.id?.slice(-4).toUpperCase() || '----')}
        />
      )}

      {/* Driver Assignment Modal */}
      <AnimatePresence>
        {isAssignModalOpen && selectedRequest && (
          <motion.div 
            key="assign-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAssignModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 bg-brand-primary text-white flex items-center justify-between">
                <div>
                   <h3 className="text-xl font-black uppercase italic tracking-tighter">Atribuir Motorista</h3>
                   <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mt-1 italic">Pedido #{selectedRequest?.id?.slice(-6)?.toUpperCase() || '---'}</p>
                </div>
                <button onClick={() => setIsAssignModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all">
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 overflow-y-auto no-scrollbar space-y-6">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100">
                  <div className="flex items-start gap-3">
                    <MapPin size={16} className="text-brand-primary mt-1" />
                    <p className="text-sm font-bold leading-tight">{selectedRequest?.pickup || 'Não Definido'}</p>
                  </div>
                </div>

                <div className="space-y-4">
                   <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Motoristas Disponíveis</h4>
                   {vehicles.filter(v => ['available', 'ativo', 'disponível'].includes(v.status?.toLowerCase())).length > 0 ? (
                     <div className="space-y-2">
                       {vehicles
                        .filter(v => ['available', 'ativo', 'disponível'].includes(v.status?.toLowerCase()))
                        .map((driver, idx) => (
                          <button
                            key={`${driver.id}-${idx}`}
                            onClick={() => selectedRequest?.id && handleAssignDriver(selectedRequest.id, driver)}
                            className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-2xl hover:border-brand-primary hover:shadow-lg transition-all flex items-center justify-between group"
                          >
                            <div className="flex items-center gap-4 text-left">
                               <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-brand-primary group-hover:text-white transition-all">
                                  {/* @ts-ignore */}
                                  <Car size={18} />
                               </div>
                               <div>
                                  <p className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-[13px]">{driver.name}</p>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase italic">{driver.prefix} • {driver.licensePlate || '---'}</p>
                               </div>
                            </div>
                            <div className="flex items-center gap-3">
                               <ChevronRight className="text-slate-200 group-hover:text-brand-primary transition-all" size={20} />
                            </div>
                          </button>
                        ))
                       }
                     </div>
                   ) : (
                     <div className="py-10 text-center bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-dashed border-slate-200">
                        {/* @ts-ignore */}
                        <Car size={32} className="mx-auto text-slate-300 mb-3 opacity-20" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">Nenhum motorista disponível no momento</p>
                     </div>
                   )}
                </div>
              </div>
              
              {assigningLoading && (
                <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-center z-50">
                   <Loader2 size={32} className="text-brand-primary animate-spin mb-4" />
                   <p className="text-[10px] font-black uppercase tracking-widest italic animate-pulse">A comunicar com o motorista...</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Truck({ size }: { size: number }) {
  return <MapPin size={size} />;
}
