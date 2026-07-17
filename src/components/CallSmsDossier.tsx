import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, 
  Phone, 
  MessageSquare, 
  Search, 
  AlertCircle, 
  Trash2, 
  Plus, 
  X, 
  Loader2, 
  ShieldCheck, 
  Activity, 
  Calendar, 
  Send, 
  Smartphone, 
  Download, 
  User, 
  CheckCircle2, 
  Calculator, 
  TrendingUp, 
  Sparkles,
  ArrowUpRight,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy, getDocs, where, serverTimestamp } from '@/src/lib/firebase';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { cn } from '../lib/utils';
import { smsService } from '../services/smsService';
import { geminiService } from '../services/geminiService';

export default function CallSmsDossier() {
  // Core state
  const [drivers, setDrivers] = useState<any[]>([]);
  const [calls, setCalls] = useState<any[]>([]);
  const [smsLogs, setSmsLogs] = useState<any[]>([]);
  const [phones, setPhones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search and Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [activityFilter, setActivityFilter] = useState<'all' | 'high' | 'low' | 'none'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'dashboard'>('table');
  
  // Selected Driver for detailed Dossier Modal
  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  const [dossierTab, setDossierTab] = useState<'calls' | 'sms' | 'audit' | 'device_logs'>('calls');
  
  // AI Audit states
  const [isAuditing, setIsAuditing] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);

  // Device Logs Audit states
  const [deviceLogs, setDeviceLogs] = useState<any[]>([]);
  const [loadingDeviceLogs, setLoadingDeviceLogs] = useState(false);

  // Device Log Filters
  const [devLogStartDate, setDevLogStartDate] = useState<string>('');
  const [devLogEndDate, setDevLogEndDate] = useState<string>('');
  const [devLogTypeFilter, setDevLogTypeFilter] = useState<'all' | 'call' | 'sms'>('all');
  const [devLogMinDuration, setDevLogMinDuration] = useState<number>(0); // 0 = any, 1 = answered (>0s), 30, 60

  // Manual Import Device Logs states
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importDriverId, setImportDriverId] = useState('');
  const [importFileContent, setImportFileContent] = useState<any[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  
  // Create SMS Modal state
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [smsTargetNumber, setSmsTargetNumber] = useState('');
  const [smsContent, setSmsContent] = useState('');
  const [smsSending, setSmsSending] = useState(false);
  const [smsError, setSmsError] = useState<string | null>(null);

  // Manual Log Call Modal state
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [callDriverName, setCallDriverName] = useState('');
  const [callCustomerName, setCallCustomerName] = useState('');
  const [callCustomerPhone, setCallCustomerPhone] = useState('');
  const [callPickupAddress, setCallPickupAddress] = useState('');
  const [callPrice, setCallPrice] = useState('0');
  const [callStatus, setCallStatus] = useState('completed');
  const [callSubmitting, setCallSubmitting] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [isClearingCalls, setIsClearingCalls] = useState(false);

  // Subscribe to central collections real-time
  useEffect(() => {
    setLoading(true);

    // 1. Master Drivers List
    const qDrivers = query(collection(db, 'drivers_master'), orderBy('name', 'asc'));
    const unsubDrivers = onSnapshot(qDrivers, (snapshot) => {
      setDrivers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'drivers_master');
    });

    // 2. All calls logs
    const qCalls = query(collection(db, 'calls'), orderBy('timestamp', 'desc'));
    const unsubCalls = onSnapshot(qCalls, (snapshot) => {
      setCalls(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'calls');
    });

    // 3. All SMS logs
    const qSms = query(collection(db, 'sms_logs'), orderBy('timestamp', 'desc'));
    const unsubSms = onSnapshot(qSms, (snapshot) => {
      setSmsLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'sms_logs');
    });

    // 4. PSM Phones list to match assigned driver terminals
    const qPhones = query(collection(db, 'psm_phones'));
    const unsubPhones = onSnapshot(qPhones, (snapshot) => {
      setPhones(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'psm_phones');
      setLoading(false);
    });

    return () => {
      unsubDrivers();
      unsubCalls();
      unsubSms();
      unsubPhones();
    };
  }, []);

  // Helper: cleans phone for matching (+244 923 111 222 -> 923111222)
  const cleanPhoneNum = (num: string): string => {
    return (num || '').replace(/\D/g, '').replace(/^244/, '').trim();
  };

  // Compile calculations for each driver
  const compiledDrivers = drivers.map(driver => {
    const driverCleanPhone = cleanPhoneNum(driver.phone);
    
    // Find all terminals linked (assigned) to this driver in psm_phones
    const assignedTerminals = phones.filter(p => 
      p.assignedToId === driver.id || 
      p.assignedTo?.toLowerCase() === driver.name?.toLowerCase()
    );
    const terminalPhones = assignedTerminals.map(p => cleanPhoneNum(p.number));

    // Calls where driverName matches OR driverId matches OR driver's personal/assigned terminal phone matches
    const driverCalls = calls.filter(call => {
      const matchName = call.driverName?.toLowerCase() === driver.name?.toLowerCase() ||
                        call.driverInfo?.name?.toLowerCase() === driver.name?.toLowerCase();
      const matchId = call.driverId === driver.id;
      
      const cleanCustomerPhone = cleanPhoneNum(call.customerPhone);
      const matchTerminalPhone = terminalPhones.includes(cleanCustomerPhone) || 
                                 cleanCustomerPhone === driverCleanPhone;
                                 
      return matchName || matchId || matchTerminalPhone;
    });

    // SMS where driver's clean phone matches OR linked terminalPhones matches targets
    const driverSms = smsLogs.filter(sms => {
      const targets = sms.targets || [];
      return targets.some((t: string) => {
        const ct = cleanPhoneNum(t);
        return ct === driverCleanPhone || terminalPhones.includes(ct);
      });
    });

    const totalLogs = driverCalls.length + driverSms.length;
    const completedCalls = driverCalls.filter(c => c.status === 'completed' || c.status === 'concluída').length;
    const conversionRate = driverCalls.length > 0 
      ? Math.round((completedCalls / driverCalls.length) * 100) 
      : 100;

    const totalEarnings = driverCalls
      .filter(c => c.status === 'completed' || c.status === 'concluída')
      .reduce((sum, c) => sum + (Number(c.price) || 0), 0);

    // Get last active communication date
    let lastActive: any = null;
    if (driverCalls.length > 0 || driverSms.length > 0) {
      const dates: Date[] = [];
      if (driverCalls[0]?.timestamp) {
        const cDate = driverCalls[0].timestamp.toDate ? driverCalls[0].timestamp.toDate() : new Date(driverCalls[0].timestamp);
        dates.push(cDate);
      }
      if (driverSms[0]?.timestamp) {
        const sDate = driverSms[0].timestamp.toDate ? driverSms[0].timestamp.toDate() : new Date(driverSms[0].timestamp);
        dates.push(sDate);
      }
      if (dates.length > 0) {
        lastActive = new Date(Math.max(...dates.map(d => d.getTime())));
      }
    }

    return {
      ...driver,
      assignedTerminals,
      callsCount: driverCalls.length,
      completedCallsCount: completedCalls,
      smsCount: driverSms.length,
      totalLogs,
      conversionRate,
      totalEarnings,
      lastActive,
      rawCalls: driverCalls,
      rawSms: driverSms
    };
  });

  // Filter based on search and activity
  const filteredDrivers = compiledDrivers.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          d.phone.includes(searchTerm) ||
                          (d.licenseNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activityFilter === 'high') {
      return matchesSearch && d.totalLogs >= 10;
    }
    if (activityFilter === 'low') {
      return matchesSearch && d.totalLogs > 0 && d.totalLogs < 10;
    }
    if (activityFilter === 'none') {
      return matchesSearch && d.totalLogs === 0;
    }
    return matchesSearch;
  });

  // Run Gemini Performance Audit
  const handleRunAudit = async (driver: any) => {
    setIsAuditing(true);
    setAiReport(null);
    try {
      const stats = {
        totalCalls: driver.callsCount,
        completedCalls: driver.completedCallsCount,
        totalSms: driver.smsCount,
        conversionRate: `${driver.conversionRate}%`,
        totalEarnings: `${driver.totalEarnings} AOA`,
        recentCallStatus: driver.rawCalls.slice(0, 5).map((c: any) => c.status),
        fleetOperatorLabel: "PSM TaxiControl Luena"
      };
      
      const report = await geminiService.getDriverPerformanceAudit(driver, stats);
      setAiReport(report);
    } catch (err: any) {
      console.error("Gemini Performance Audit Error:", err);
      setAiReport("Falha ao gerar auditoria de desempenho via IA.");
    } finally {
      setIsAuditing(false);
    }
  };

  // Close logs dossier modal and reset AI reports
  const handleCloseDossier = () => {
    setSelectedDriver(null);
    setAiReport(null);
  };

  // Device Logs Fetching & Formatting
  const fetchDeviceLogs = useCallback(async (driver: any) => {
    if (!driver) return;
    setLoadingDeviceLogs(true);
    try {
      const q = query(
        collection(db, 'device_logs'),
        where('driverId', '==', driver.id)
      );
      const snap = await getDocs(q);
      let list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      if (list.length === 0 && driver.name) {
        const qName = query(
          collection(db, 'device_logs'),
          where('driverName', '==', driver.name)
        );
        const snapName = await getDocs(qName);
        list = snapName.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      }
      setDeviceLogs(list);
    } catch (err) {
      console.error("Error fetching device_logs:", err);
    } finally {
      setLoadingDeviceLogs(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDriver) {
      fetchDeviceLogs(selectedDriver);
    } else {
      setDeviceLogs([]);
    }
  }, [selectedDriver, fetchDeviceLogs]);

  // Flatten and parse all logs from device_logs documents
  const flattenedDeviceLogs = React.useMemo(() => {
    const list: any[] = [];
    deviceLogs.forEach(doc => {
      const logsArray = doc.logs || [];
      const docDateStr = doc.syncedAt?.toDate 
        ? doc.syncedAt.toDate().toISOString().split('T')[0] 
        : new Date(doc.syncedAt || Date.now()).toISOString().split('T')[0];
        
      logsArray.forEach((l: any, idx: number) => {
        let eventDateStr = docDateStr;
        // If there's an explicit ISO timestamp, use its date
        if (l.timestamp && l.timestamp.includes('T')) {
          eventDateStr = l.timestamp.split('T')[0];
        }
        let eventTimeStr = l.time || l.timestamp || "00:00:00";
        if (eventTimeStr.includes('T')) {
          eventTimeStr = eventTimeStr.split('T')[1].substring(0, 8);
        }
        
        let duration = l.duration !== undefined ? Number(l.duration) : (l.type === 'call' ? 45 : 0);

        list.push({
          id: `${doc.id}-${idx}`,
          date: eventDateStr,
          time: eventTimeStr,
          type: l.type || 'info',
          message: l.message || '',
          duration: duration,
          docSyncedAt: doc.syncedAt
        });
      });
    });
    
    // Sort by Date + Time descending
    return list.sort((a, b) => {
      const dtA = `${a.date}T${a.time}`;
      const dtB = `${b.date}T${b.time}`;
      return dtB.localeCompare(dtA);
    });
  }, [deviceLogs]);

  // Filtered device logs based on admin selections
  const filteredDeviceLogs = React.useMemo(() => {
    return flattenedDeviceLogs.filter(log => {
      // Date range filter
      if (devLogStartDate && log.date < devLogStartDate) return false;
      if (devLogEndDate && log.date > devLogEndDate) return false;
      
      // Type filter
      if (devLogTypeFilter !== 'all' && log.type !== devLogTypeFilter) return false;
      
      // Duration filter (only applies to call logs)
      if (log.type === 'call') {
        if (log.duration < devLogMinDuration) return false;
      } else if (devLogMinDuration > 0) {
        // If minimum duration filter is active, exclude non-calls
        return false;
      }
      
      return true;
    });
  }, [flattenedDeviceLogs, devLogStartDate, devLogEndDate, devLogTypeFilter, devLogMinDuration]);

  // File Upload parsing handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!Array.isArray(json)) {
          setImportError("O ficheiro JSON deve ser uma lista de logs (Array).");
          return;
        }
        
        const isValid = json.every((item: any) => {
          return item.type && item.message;
        });
        
        if (!isValid) {
          setImportError("Cada log na lista deve ter os campos 'type' (call ou sms) e 'message'.");
          return;
        }
        
        setImportFileContent(json);
      } catch (err) {
        setImportError("Erro ao ler o ficheiro JSON. Certifique-se de que é um formato válido.");
      }
    };
    reader.readAsText(file);
  };

  // Generate simulated local device logs for testing
  const handleGenerateSampleLogs = () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    const sample = [
      {
        time: "10:30:15",
        timestamp: yesterday.toISOString(),
        type: "call",
        message: "CHAMADA RECEBIDA: +244 923 888 111 (Atendida)",
        duration: 85
      },
      {
        time: "11:15:00",
        timestamp: yesterday.toISOString(),
        type: "sms",
        message: "SMS RECEBIDO: +244 933 222 333: 'Quero um táxi para o Luena.'"
      },
      {
        time: "14:45:22",
        timestamp: yesterday.toISOString(),
        type: "call",
        message: "CHAMADA RECEBIDA: +244 924 999 000 (Atendida)",
        duration: 120
      },
      {
        time: "09:05:10",
        timestamp: today.toISOString(),
        type: "call",
        message: "CHAMADA RECEBIDA: +244 921 555 444 (Tocou, Não Atendida)",
        duration: 0
      },
      {
        time: "12:51:26",
        timestamp: today.toISOString(),
        type: "sms",
        message: "SMS RECEBIDO: +244 925 111 222: 'Estou à espera do SUPER Táxi.'"
      }
    ];
    setImportFileContent(sample);
    setImportError(null);
  };

  // Upload imported logs to Firestore
  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importDriverId) {
      setImportError("Por favor, selecione um motorista.");
      return;
    }
    if (!importFileContent || importFileContent.length === 0) {
      setImportError("Por favor, carregue um ficheiro JSON ou gere dados de teste.");
      return;
    }
    
    setImporting(true);
    try {
      const driver = drivers.find(d => d.id === importDriverId);
      const driverName = driver ? driver.name : "Motorista Luena";
      
      const logsPayload = importFileContent.map((l: any) => ({
        time: l.time || new Date(l.timestamp || Date.now()).toLocaleTimeString(),
        timestamp: l.timestamp || new Date().toISOString(),
        type: l.type,
        message: l.message,
        duration: l.duration !== undefined ? Number(l.duration) : (l.type === 'call' ? 45 : 0)
      }));
      
      await addDoc(collection(db, 'device_logs'), {
        driverId: importDriverId,
        driverName: driverName,
        syncedAt: serverTimestamp(),
        logs: logsPayload,
        antennaActive: true,
        callLogPermission: 'granted',
        smsPermission: 'granted',
        status: 'audited_ok'
      });
      
      setImportSuccess(true);
      if (selectedDriver && selectedDriver.id === importDriverId) {
        fetchDeviceLogs(selectedDriver);
      }
      
      setTimeout(() => {
        setIsImportModalOpen(false);
        setImportSuccess(false);
        setImportFileContent(null);
        setImportDriverId('');
      }, 2000);
      
    } catch (err: any) {
      setImportError("Erro ao gravar logs no Firestore: " + err.message);
    } finally {
      setImporting(false);
    }
  };

  // Send communication log (SMS)
  const dispatchSmsForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSmsError(null);
    
    if (!smsTargetNumber) {
      setSmsError("Por favor, introduza um número de telefone.");
      return;
    }
    if (!smsContent) {
      setSmsError("Escreva o conteúdo da mensagem.");
      return;
    }

    const formattedTarget = smsTargetNumber.startsWith('+244') 
      ? smsTargetNumber 
      : `+244${smsTargetNumber.replace(/\D/g, '')}`;

    setSmsSending(true);
    try {
      const res = await smsService.sendSMS([formattedTarget], smsContent);
      if (res.success) {
        alert("Comunicação SMS registada e enviada com sucesso!");
        setIsSmsModalOpen(false);
        setSmsTargetNumber('');
        setSmsContent('');
      } else {
        setSmsError(res.error || "Ocorreu um erro no Gateway de SMS.");
      }
    } catch (err: any) {
      setSmsError(err.message || "Erro de ligação.");
    } finally {
      setSmsSending(false);
    }
  };

  // Log Call manually
  const submitManualCall = async (e: React.FormEvent) => {
    e.preventDefault();
    setCallError(null);

    if (!callDriverName) {
      setCallError("Selecione um motorista para vincular a chamada.");
      return;
    }
    if (!callCustomerPhone) {
      setCallError("Indique o telefone do cliente.");
      return;
    }

    setCallSubmitting(true);
    try {
      const matchedDriver = drivers.find(d => d.name === callDriverName);
      
      const trimmedPhone = callCustomerPhone.replace(/\D/g, '');
      const phoneWithPrefix = trimmedPhone.startsWith('244')
        ? `+${trimmedPhone}`
        : `+244${trimmedPhone}`;

      await addDoc(collection(db, "calls"), {
        customerPhone: phoneWithPrefix,
        customerName: callCustomerName || "Cliente Particular",
        pickupAddress: callPickupAddress || "Solicitação de Corrida Direta",
        destinationAddress: "Destino Urbano Luena",
        price: Number(callPrice) || 0,
        status: callStatus,
        driverId: matchedDriver?.id || Math.random().toString(),
        driverName: callDriverName,
        timestamp: serverTimestamp(),
        responseHistory: [
          {
            action: callStatus === 'completed' ? 'completed' : 'accepted',
            timestamp: new Date().toISOString(),
            driverId: matchedDriver?.id || "manual"
          }
        ]
      });

      alert("Chamada registada no Dossiê com sucesso!");
      setIsCallModalOpen(false);
      setCallDriverName('');
      setCallCustomerName('');
      setCallCustomerPhone('');
      setCallPickupAddress('');
      setCallPrice('0');
    } catch (err: any) {
      setCallError(err.message || "Erro ao adicionar chamada.");
    } finally {
      setCallSubmitting(false);
    }
  };

  const handleClearAllCalls = async () => {
    const confirmMsg = "Tem a certeza absoluta de que deseja ZERAR todos os Registos de Chamadas de Passageiros?\n\nEsta ação apagará permanentemente todos os logs de chamadas da central de dados.";
    if (window.confirm(confirmMsg)) {
      setIsClearingCalls(true);
      try {
        const q = query(collection(db, "calls"));
        const snap = await getDocs(q);
        const promises = snap.docs.map(docSnap => deleteDoc(doc(db, "calls", docSnap.id)));
        await Promise.all(promises);
        alert("Todos os registos de chamadas foram apagados com sucesso!");
      } catch (err: any) {
        console.error("Erro ao zerar chamadas:", err);
        alert("Ocorreu um erro ao limpar as chamadas do Dossiê: " + err.message);
      } finally {
        setIsClearingCalls(false);
      }
    }
  };

  // Export Complete communications dossier
  const handleExportDossier = () => {
    const reportHeader = `===========================================================\n` + 
                         `         PSM COMERCIAL • DOSSIÊ GERAL DE COMUNICAÇÕES        \n` +
                         `                   REGISTROS DE CHAMADAS & SMS             \n` +
                         `===========================================================\n` +
                         `Emitido em: ${new Date().toLocaleString('pt-PT')}\n` +
                         `Filtro Ativo: ${activityFilter.toUpperCase()}\n` +
                         `Total de Motoristas: ${compiledDrivers.length}\n` +
                         `Total Geral de Chamadas: ${calls.length}\n` +
                         `Total Geral de SMS Disparados: ${smsLogs.length}\n\n`;

    const reportContent = compiledDrivers.map(d => {
      return `Motorista: ${d.name}\n` +
             `Telemóvel: ${d.phone}\n` +
             `Carta Nº  : ${d.licenseNumber || 'Não indicado'}\n` +
             `Status    : ${d.status}\n` +
             `📊 LOGS TOTAIS DE COMUNICAÇÃO: ${d.totalLogs}\n` +
             `  - Chamadas Recebidas/Iniciadas: ${d.callsCount}\n` +
             `  - SMS Enviados de Alerta      : ${d.smsCount}\n` +
             `  - Taxa de Conclusão Chamadas  : ${d.conversionRate}%\n` +
             `  - Faturamento Est. Acumulado  : ${d.totalEarnings} AOA\n` +
             `  - Última Atividade           : ${d.lastActive ? d.lastActive.toLocaleString('pt-PT') : 'Sem registros'}\n` +
             `-----------------------------------------------------------\n`;
    }).join('\n');

    const combinedBlob = new Blob([reportHeader + reportContent], { type: 'text/plain;charset=utf-8' });
    const fileUrl = URL.createObjectURL(combinedBlob);
    const hiddenLink = document.createElement('a');
    hiddenLink.href = fileUrl;
    hiddenLink.download = `dossie_comunicacoes_psm_${new Date().getTime()}.txt`;
    hiddenLink.click();
  };

  const totalCallsCount = calls.length;
  const totalSmsCount = smsLogs.length;
  const overallCompletedCalls = calls.filter(c => c.status === 'completed' || c.status === 'concluída').length;
  const overallConversion = totalCallsCount > 0 ? Math.round((overallCompletedCalls / totalCallsCount) * 100) : 0;

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-10">
      
      {/* Title & Actions Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white px-6 py-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-[30%] h-full bg-slate-50 border-l border-slate-100 -mr-16 rotate-12 -z-0 opacity-50 group-hover:rotate-6 transition-transform duration-1000" />
        
        <div className="relative z-10 flex items-center gap-4 lg:gap-6">
          <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-xl rotate-2 group-hover:rotate-0 transition-all duration-500 border border-white/10">
             <FileText size={20} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-black text-xl lg:text-2xl text-slate-900 tracking-tighter uppercase italic">
                Dossiê de Comunicações
              </h2>
              <span className="px-2 py-0.5 bg-brand-primary/10 text-brand-primary text-[8px] font-black rounded-full uppercase tracking-tighter border border-brand-primary/20">
                AUDITORIA INTERNA
              </span>
            </div>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
              <Activity size={10} className="text-brand-primary" />
              Logs integrados de Chamadas e SMS por Motorista da PSM COMERCIAL COM LUENA-MOXICO
            </p>
          </div>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2 mt-4 md:mt-0">
          <div className="flex bg-slate-100 p-1 rounded-xl mr-1">
            <button 
              type="button"
              onClick={() => setViewMode('table')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer",
                viewMode === 'table' ? "bg-slate-950 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
              )}
            >
              Tabela
            </button>
            <button 
              type="button"
              onClick={() => setViewMode('dashboard')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer",
                viewMode === 'dashboard' ? "bg-slate-950 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
              )}
            >
              <TrendingUp size={10} className={viewMode === 'dashboard' ? "text-brand-primary" : "text-slate-500"} /> Gráficos
            </button>
          </div>

          <button 
            onClick={() => {
              setSmsTargetNumber('');
              setSmsContent('');
              setSmsError(null);
              setIsSmsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-white text-slate-800 rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-slate-50 transition-all border border-slate-200 shadow-sm"
          >
            <Send size={12} className="text-brand-primary" />
            SMS Alerta
          </button>
          
          <button 
            onClick={() => {
              setCallError(null);
              setIsCallModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-white text-slate-800 rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-slate-50 transition-all border border-slate-200 shadow-sm"
          >
            <Plus size={12} className="text-emerald-500" />
            Registar Chamada
          </button>

          <button 
            type="button"
            disabled={isClearingCalls}
            onClick={handleClearAllCalls}
            className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-400 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border border-transparent shadow-sm active:scale-95 cursor-pointer"
          >
            {isClearingCalls ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            Zerar Chamadas
          </button>

          <button 
            onClick={() => {
              setImportDriverId('');
              setImportFileContent(null);
              setImportError(null);
              setImportSuccess(false);
              setIsImportModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border border-transparent shadow-sm active:scale-95 cursor-pointer"
          >
            <Smartphone size={12} className="text-white" />
            Importar Logs Telemóvel
          </button>

          <button 
            onClick={handleExportDossier}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-black transition-all shadow-md active:scale-95"
          >
            <Download size={12} className="text-brand-primary" />
            Exportar Dossier
          </button>
        </div>
      </div>

      {/* Metrics Strips */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Chamadas Registadas</span>
            <p className="text-2xl font-black text-slate-900 mt-0.5">{totalCallsCount}</p>
            <span className="text-[8.5px] text-emerald-500 font-bold flex items-center gap-1 mt-0.5">
              <TrendingUp size={9} /> Central PSM Luena
            </span>
          </div>
          <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-white">
            <Phone size={18} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Disparos de SMS Alerta</span>
            <p className="text-2xl font-black text-slate-900 mt-0.5">{totalSmsCount}</p>
            <span className="text-[8.5px] text-brand-primary font-bold flex items-center gap-1 mt-0.5">
              Gateway Ativo Unitel
            </span>
          </div>
          <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-white">
            <MessageSquare size={18} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Taxa Conclusão Média</span>
            <p className="text-2xl font-black text-slate-900 mt-0.5">{overallConversion}%</p>
            <div className="w-24 bg-slate-100 h-1 rounded-full mt-1.5 overflow-hidden">
              <div className="bg-emerald-500 h-full" style={{ width: `${overallConversion}%` }} />
            </div>
          </div>
          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center font-black">
            %
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Logs Unificados</span>
            <p className="text-2xl font-black text-slate-900 mt-0.5">{totalCallsCount + totalSmsCount}</p>
            <span className="text-[8.5px] text-slate-500 font-bold mt-0.5 block">Comunicação Acumulada</span>
          </div>
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
            <FileText size={18} />
          </div>
        </div>
      </div>

      {/* Main List & Controls */}
      {viewMode === 'table' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          
          {/* Search & Filters Toolbar */}
          <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row gap-4 justify-between items-center bg-slate-50/50">
            <div className="relative w-full lg:max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text"
                placeholder="Pesquisar por motorista, telemóvel ou carta..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-primary transition-all uppercase tracking-tight"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-2 flex items-center gap-1">
                <Filter size={10} /> Filtro de Conversas
              </span>
              <button
                onClick={() => setActivityFilter('all')}
                className={cn(
                  "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                  activityFilter === 'all' 
                    ? "bg-slate-900 text-white shadow-md" 
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                )}
              >
                Todos ({compiledDrivers.length})
              </button>
              <button
                onClick={() => setActivityFilter('high')}
                className={cn(
                  "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                  activityFilter === 'high' 
                    ? "bg-brand-primary text-white shadow-md" 
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                )}
              >
                Alta Atividade (10+)
              </button>
              <button
                onClick={() => setActivityFilter('low')}
                className={cn(
                  "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                  activityFilter === 'low' 
                    ? "bg-amber-600 text-white shadow-md" 
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                )}
              >
                Baixa Atividade (&lt;10)
              </button>
              <button
                onClick={() => setActivityFilter('none')}
                className={cn(
                  "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                  activityFilter === 'none' 
                    ? "bg-rose-600 text-white shadow-md" 
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                )}
              >
                Sem Registro
              </button>
            </div>
          </div>

          {/* Master Driver Table */}
          {loading ? (
            <div className="py-24 text-center">
              <Loader2 className="animate-spin text-brand-primary mx-auto mb-4" size={32} />
              <p className="text-xs uppercase font-black text-slate-400 tracking-widest animate-pulse">Consultando dados do Dossiê...</p>
            </div>
          ) : filteredDrivers.length === 0 ? (
            <div className="py-24 text-center space-y-4">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mx-auto">
                <Search size={24} />
              </div>
              <p className="text-sm font-black text-slate-300 uppercase tracking-[0.2em] italic">Nenhum motorista encontrado com estes parâmetros</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-100/50">
                    <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Motorista / ID</th>
                    <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Contacto GSM</th>
                    <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Chamadas</th>
                    <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Msn / SMS</th>
                    <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Total Logs</th>
                    <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Eficácia Corridas</th>
                    <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Último Log</th>
                    <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDrivers.map(driver => (
                    <tr 
                      key={driver.id}
                      className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                      onClick={() => {
                        setSelectedDriver(driver);
                        setDossierTab('calls');
                      }}
                    >
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white text-xs font-black uppercase italic">
                            {driver.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-950 uppercase tracking-tight group-hover:text-brand-primary transition-colors italic">{driver.name}</p>
                            <p className="text-[9px] font-mono text-slate-400 mt-0.5 uppercase">Carta: {driver.licenseNumber || 'Indisponível'}</p>
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-xs font-bold font-mono tracking-tight text-slate-700 bg-slate-100 px-2.5 py-1 rounded-[6px] inline-block w-fit">
                            {driver.phone}
                          </span>
                          {driver.assignedTerminals && driver.assignedTerminals.length > 0 && (
                            <div className="flex flex-col gap-1">
                              {driver.assignedTerminals.map((phone: any) => (
                                <span key={phone.id} className="text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-[4px] w-fit flex items-center gap-1 uppercase italic tracking-tighter">
                                  <Smartphone size={8} /> Terminal: {phone.label} ({phone.number})
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-5 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="relative group/tooltip inline-block">
                          <div 
                            onClick={() => {
                              setSelectedDriver(driver);
                              setDossierTab('calls');
                            }}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 font-bold text-xs text-slate-800 hover:bg-indigo-100 hover:text-indigo-700 transition-colors cursor-help"
                          >
                            {driver.callsCount}
                          </div>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-slate-900 text-white text-[10px] p-3 rounded-xl opacity-0 pointer-events-none group-hover/tooltip:opacity-100 group-hover/tooltip:pointer-events-auto transition-all duration-200 shadow-xl z-50 text-left font-sans normal-case">
                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
                            <span className="font-black uppercase tracking-wider text-indigo-400 block mb-1">Últimas Chamadas:</span>
                            {driver.rawCalls && driver.rawCalls.length > 0 ? (
                              <div className="space-y-1.5 max-h-24 overflow-y-auto">
                                {driver.rawCalls.slice(0, 4).map((c: any, i: number) => {
                                  const dateStr = c.timestamp?.toDate 
                                    ? c.timestamp.toDate().toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) 
                                    : new Date(c.timestamp).toLocaleString();
                                  return (
                                    <div key={i} className="flex justify-between border-b border-white/5 pb-1 gap-2">
                                      <span className="truncate max-w-[90px] font-bold text-slate-200 uppercase">{c.customerName || "Particular"}</span>
                                      <span className="font-mono text-[8.5px] text-indigo-300 whitespace-nowrap">{dateStr}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-slate-400 uppercase text-[8px] font-black">Sem registros de chamadas</span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-5 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="relative group/tooltip inline-block">
                          <div 
                            onClick={() => {
                              setSelectedDriver(driver);
                              setDossierTab('sms');
                            }}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 font-bold text-xs text-slate-800 hover:bg-emerald-100 hover:text-emerald-700 transition-colors cursor-help"
                          >
                            {driver.smsCount}
                          </div>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-slate-900 text-white text-[10px] p-3 rounded-xl opacity-0 pointer-events-none group-hover/tooltip:opacity-100 group-hover/tooltip:pointer-events-auto transition-all duration-200 shadow-xl z-50 text-left font-sans normal-case">
                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
                            <span className="font-black uppercase tracking-wider text-emerald-400 block mb-1">Últimos SMS de Alerta:</span>
                            {driver.rawSms && driver.rawSms.length > 0 ? (
                              <div className="space-y-1.5 max-h-24 overflow-y-auto">
                                {driver.rawSms.slice(0, 3).map((s: any, i: number) => {
                                  const dateStr = s.timestamp?.toDate 
                                    ? s.timestamp.toDate().toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) 
                                    : new Date(s.timestamp).toLocaleString();
                                  return (
                                    <div key={i} className="flex flex-col border-b border-white/5 pb-1">
                                      <span className="truncate text-slate-300 font-medium italic">"{s.content}"</span>
                                      <span className="font-mono text-[8px] text-emerald-300 align-right self-end mt-0.5">{dateStr}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-slate-400 uppercase text-[8px] font-black">Sem registros de SMS</span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-5 text-center">
                        <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full font-black text-xs ${
                          driver.totalLogs > 15 
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                            : driver.totalLogs > 0 
                              ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' 
                              : 'bg-rose-50 text-rose-500 border border-rose-100'
                        }`}>
                          {driver.totalLogs} logs
                        </span>
                      </td>

                      <td className="px-6 py-5">
                        <div className="flex flex-col items-center gap-1.5">
                          <span className="text-xs font-black text-slate-900 tracking-tight italic">{driver.conversionRate}%</span>
                          <div className="w-16 bg-slate-100 h-1 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${driver.conversionRate > 80 ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                              style={{ width: `${driver.conversionRate}%` }} 
                            />
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-5">
                        <span className="text-[10px] font-bold text-slate-400 block">
                          {driver.lastActive 
                            ? driver.lastActive.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) 
                            : 'Sem atividade'
                          }
                        </span>
                      </td>

                      <td className="px-8 py-5 text-right" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => {
                            setSelectedDriver(driver);
                            setDossierTab('calls');
                          }}
                          className="p-2 py-1.5 bg-slate-950 text-white rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-black flex items-center gap-1 inline-flex hover:shadow-md transition-all select-none"
                        >
                          Abrir Pasta <ArrowUpRight size={12} className="text-brand-primary" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-6">
          {/* Top KPIs Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Leader Call Card */}
            {(() => {
              const topCaller = [...compiledDrivers].sort((a, b) => b.callsCount - a.callsCount)[0];
              return (
                <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest block">Líder de Chamadas Central</span>
                    <span className="text-sm font-black text-indigo-950 uppercase italic block mt-1 truncate max-w-[180px]">
                      {topCaller ? topCaller.name : 'Nenhum'}
                    </span>
                    <span className="text-[10px] font-bold text-indigo-700 font-mono mt-0.5 block">
                      {topCaller ? `${topCaller.callsCount} chamadas registradas` : '0 chamadas'}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700">
                    <Phone size={18} />
                  </div>
                </div>
              );
            })()}

            {/* Leader SMS Card */}
            {(() => {
              const topSms = [...compiledDrivers].sort((a, b) => b.smsCount - a.smsCount)[0];
              return (
                <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest block">Líder de Mensagens SMS</span>
                    <span className="text-sm font-black text-emerald-950 uppercase italic block mt-1 truncate max-w-[180px]">
                      {topSms ? topSms.name : 'Nenhum'}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 font-mono mt-0.5 block">
                      {topSms ? `${topSms.smsCount} SMS de alerta disparados` : '0 SMS'}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                    <MessageSquare size={18} />
                  </div>
                </div>
              );
            })()}

            {/* Max Volume Card */}
            {(() => {
              const topTotal = [...compiledDrivers].sort((a, b) => b.totalLogs - a.totalLogs)[0];
              return (
                <div className="p-4 bg-violet-50/50 border border-violet-100 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[8px] font-black text-violet-600 uppercase tracking-widest block">Maior Volume Unificado</span>
                    <span className="text-sm font-black text-violet-950 uppercase italic block mt-1 truncate max-w-[180px]">
                      {topTotal ? topTotal.name : 'Nenhum'}
                    </span>
                    <span className="text-[10px] font-bold text-violet-700 font-mono mt-0.5 block">
                      {topTotal ? `${topTotal.totalLogs} comunicações acumuladas` : '0 registros'}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-violet-700">
                    <TrendingUp size={18} />
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Visual Bar Charts Block */}
          <div className="bg-white p-6 border border-slate-200 rounded-2xl space-y-4 shadow-sm">
            <div>
              <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Volume de Comunicações por Motorista</h3>
              <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Gráfico de barras agrupando chamadas e mensagens para auditoria de tráfego</p>
            </div>

            <div className="h-80 w-full font-mono text-[10px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={compiledDrivers}
                  margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#94a3b8" 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(value) => value ? (value.length > 12 ? `${value.substring(0, 10)}...` : value) : ''}
                  />
                  <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '10px', fontWeight: 'bold' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Legend iconType="circle" />
                  <Bar name="Chamadas" dataKey="callsCount" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  <Bar name="Mensagens SMS" dataKey="smsCount" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Second Row: Top Performers & Dynamic Operator Insight list */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Table of Volume Rank */}
            <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-sm">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-2">Ordenação de Tráfego de Voz e Mensagem</span>
              <div className="space-y-2 max-h-[220px] overflow-y-auto">
                {[...compiledDrivers]
                  .sort((a, b) => b.totalLogs - a.totalLogs)
                  .map((d, i) => (
                    <div 
                      key={d.id} 
                      onClick={() => {
                        setSelectedDriver(d);
                        setDossierTab('calls');
                      }}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-slate-400 w-5">#{i+1}</span>
                        <div>
                          <span className="text-xs font-black text-slate-800 uppercase italic">{d.name}</span>
                          <span className="text-[8px] font-black text-slate-400 uppercase block tracking-wider">Última Ativ: {d.lastActive ? d.lastActive.toLocaleDateString('pt-PT') : 'Sem logs'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[9px] font-black font-mono">
                          {d.callsCount}C
                        </span>
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[9px] font-black font-mono">
                          {d.smsCount}S
                        </span>
                        <span className="px-2 py-0.5 bg-slate-900 text-white rounded text-[9px] font-black font-mono">
                          {d.totalLogs}T
                        </span>
                      </div>
                    </div>
                ))}
              </div>
            </div>

            {/* Dynamic Operator Insights */}
            <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[8px] font-black text-violet-500 uppercase tracking-widest block mb-2">Sugestões de Escalonamento e Auditoria</span>
                <div className="space-y-3">
                  {compiledDrivers.length > 0 ? (
                    <>
                      {/* Dynamic insights based on data */}
                      {(() => {
                        const inactiveDrivers = compiledDrivers.filter(d => d.totalLogs === 0);
                        const highActivityDrivers = compiledDrivers.filter(d => d.totalLogs >= 10);
                        const lowConversion = compiledDrivers.filter(d => d.totalLogs > 0 && d.conversionRate < 70);

                        return (
                          <div className="space-y-2">
                            {highActivityDrivers.length > 0 && (
                              <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/30 flex gap-2.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-1 flex-shrink-0" />
                                <p className="text-[10px] text-indigo-950 font-bold leading-relaxed">
                                  <span className="font-black uppercase">ALTA DEMANDA:</span> Os motoristas <span className="underline">{highActivityDrivers.map(d => d.name).slice(0, 2).join(', ')}</span> estão com volumes significativos de comunicações. Recomendamos certificar o balanceamento de rotas.
                                </p>
                              </div>
                            )}
                            {lowConversion.length > 0 && (
                              <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100/30 flex gap-2.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1 flex-shrink-0" />
                                <p className="text-[10px] text-amber-950 font-bold leading-relaxed">
                                  <span className="font-black uppercase">ALERTA DE CONVERSÃO:</span> <span className="underline">{lowConversion.map(d => d.name).slice(0, 2).join(', ')}</span> registram taxas de conclusão abaixo de 70%. Agende auditoria preventiva de rádio.
                                </p>
                              </div>
                            )}
                            {inactiveDrivers.length > 0 && (
                              <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-100/30 flex gap-2.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-rose-600 mt-1 flex-shrink-0" />
                                <p className="text-[10px] text-rose-950 font-bold leading-relaxed">
                                  <span className="font-black uppercase">SEM ATIVIDADE:</span> Existem {inactiveDrivers.length} motoristas sem qualquer log centralizado. Favor inspecionar os respectivos Terminais Móveis da Unitel.
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </>
                  ) : (
                    <p className="text-slate-400 text-[10px] font-bold uppercase italic">A carregar sugestões...</p>
                  )}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[8px] font-black text-slate-400 uppercase tracking-widest">
                <span>Auditado em Tempo Real</span>
                <span className="text-violet-600 font-mono">Gemini Flash Activo</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DETAILED DOSSIER DIALOG / OVERLAY OVER CARDS */}
      <AnimatePresence>
        {selectedDriver && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseDossier}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden z-10 my-8"
            >
              {/* Header bar */}
              <div className="px-8 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white relative">
                <div className="absolute top-0 right-0 py-8 px-12 opacity-5 pointer-events-none">
                  <FileText size={180} />
                </div>
                
                <div className="flex items-center gap-6 relative z-10">
                  <div className="w-14 h-14 bg-white/10 rounded-[1rem] flex items-center justify-center text-brand-primary text-xl font-black italic border border-white/10">
                    {selectedDriver.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-2xl font-black tracking-tight uppercase italic">{selectedDriver.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${
                        selectedDriver.status === 'Ativo' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>{selectedDriver.status}</span>
                    </div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1.5 flex items-center gap-2">
                      <Smartphone size={11} className="text-brand-primary" /> {selectedDriver.phone} • Carta: {selectedDriver.licenseNumber || 'Indefinida'}
                    </p>
                  </div>
                </div>

                <button 
                  onClick={handleCloseDossier}
                  className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl transition-all relative z-10 border border-white/5"
                >
                  <X size={20} className="text-slate-300" />
                </button>
              </div>

              {/* Core tabs selectors */}
              <div className="border-b border-slate-100 flex items-center justify-between px-8 bg-slate-50">
                <div className="flex gap-1 py-3">
                  <button 
                    onClick={() => setDossierTab('calls')}
                    className={cn(
                      "px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2",
                      dossierTab === 'calls' ? "bg-slate-900 text-white shadow-md font-black" : "text-slate-500 hover:text-slate-950 font-bold"
                    )}
                  >
                    <Phone size={12} /> Chamadas ({selectedDriver.callsCount})
                  </button>
                  <button 
                    onClick={() => setDossierTab('sms')}
                    className={cn(
                      "px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2",
                      dossierTab === 'sms' ? "bg-slate-900 text-white shadow-md font-black" : "text-slate-500 hover:text-slate-950 font-bold"
                    )}
                  >
                    <MessageSquare size={12} /> SMS ({selectedDriver.smsCount})
                  </button>
                  <button 
                    onClick={() => setDossierTab('device_logs')}
                    className={cn(
                      "px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2",
                      dossierTab === 'device_logs' ? "bg-slate-900 text-white shadow-md font-black" : "text-slate-500 hover:text-slate-950 font-bold"
                    )}
                  >
                    <Smartphone size={12} /> Telemóvel Nativo ({flattenedDeviceLogs.length})
                  </button>
                  <button 
                    onClick={() => {
                      setDossierTab('audit');
                      if (!aiReport) {
                        handleRunAudit(selectedDriver);
                      }
                    }}
                    className={cn(
                      "px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 border border-violet-100/10",
                      dossierTab === 'audit' ? "bg-violet-600 text-white shadow-md font-black" : "text-violet-600 hover:text-violet-800 font-bold bg-violet-50"
                    )}
                  >
                    <Sparkles size={12} /> Auditoria IA Gemini 1.5
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">
                    Logs Totais: {selectedDriver.totalLogs} central | {flattenedDeviceLogs.length} nativos
                  </span>
                </div>
              </div>

              {/* Dossier contents view containers */}
              <div className="p-8 max-h-[450px] overflow-y-auto min-h-[300px]">
                
                {/* CHAMADAS TAB */}
                {dossierTab === 'calls' && (
                  <div className="space-y-4">
                    {selectedDriver.rawCalls.length === 0 ? (
                      <div className="py-12 text-center text-slate-300 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center">
                        <Phone size={24} className="mb-2" />
                        <span className="text-xs uppercase font-bold tracking-wider">Sem registros de chamadas nos logs deste motorista</span>
                      </div>
                    ) : (
                      <div className="overflow-hidden border border-slate-100 rounded-2xl">
                        <table className="w-full text-left font-sans text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-secondary-100 font-black uppercase text-[8px] tracking-widest text-slate-400">
                              <th className="p-4">Cliente</th>
                              <th className="p-4">Contacto</th>
                              <th className="p-4">Recolha</th>
                              <th className="p-4">Preço</th>
                              <th className="p-4 text-center">Status</th>
                              <th className="p-4">Data/Hora</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {selectedDriver.rawCalls.map((c: any) => (
                              <tr key={c.id} className="hover:bg-slate-50/20">
                                <td className="p-4 font-black text-slate-800 uppercase italic">{c.customerName || "Particular"}</td>
                                <td className="p-4 font-mono font-bold">{c.customerPhone}</td>
                                <td className="p-4 truncate max-w-[150px] italic text-slate-500">{c.pickupAddress || 'Directo'}</td>
                                <td className="p-4 font-bold text-slate-900">{c.price || 0} AOA</td>
                                <td className="p-4 text-center">
                                  <span className={`px-2 pb-0.5 pt-1 rounded-full text-[8px] font-black uppercase tracking-wider inline-block ${
                                    c.status === 'completed' || c.status === 'concluída' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                    c.status === 'cancelled' || c.status === 'cancelada' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-slate-100 text-slate-600 border border-slate-200'
                                  }`}>
                                    {c.status}
                                  </span>
                                </td>
                                <td className="p-4 text-slate-400 text-[10px] font-bold">
                                  {c.timestamp?.toDate 
                                    ? c.timestamp.toDate().toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) 
                                    : new Date(c.timestamp).toLocaleString()
                                  }
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* SMS HISTORIC LOGS TAB */}
                {dossierTab === 'sms' && (
                  <div className="space-y-4">
                    {selectedDriver.rawSms.length === 0 ? (
                      <div className="py-12 text-center text-slate-300 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center">
                        <MessageSquare size={24} className="mb-2" />
                        <span className="text-xs uppercase font-bold tracking-wider">Sem logs de mensagens despachadas para este telemóvel</span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedDriver.rawSms.map((sms: any) => {
                          const cleanTargetPhone = selectedDriver.phone;
                          const op = smsService.getOperator(cleanTargetPhone);
                          return (
                            <div key={sms.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-2 relative overflow-hidden">
                              <div className="absolute top-0 right-0 w-16 bg-brand-primary text-white text-[8px] font-black tracking-widest uppercase text-center py-1 select-none">
                                {op}
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 bg-brand-primary/10 text-brand-primary rounded-[4px] text-[8px] font-black uppercase tracking-wider">
                                    {sms.status || 'Enviado'}
                                  </span>
                                  <span className="text-[8px] uppercase font-black text-slate-400">SMS Gateway</span>
                                </div>
                                <span className="text-[10px] text-slate-400 font-bold">
                                  {sms.timestamp?.toDate 
                                    ? sms.timestamp.toDate().toLocaleString('pt-PT') 
                                    : new Date(sms.timestamp).toLocaleString()
                                  }
                                </span>
                              </div>
                              <p className="text-xs text-slate-800 leading-relaxed font-bold border-l-2 border-slate-300 pl-3 italic">
                                "{sms.content}"
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* DEVICE LOGS AUDIT TRAIL TAB */}
                {dossierTab === 'device_logs' && (
                  <div className="space-y-4">
                    {/* Filters & KPI Row */}
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">De (Data)</label>
                        <input 
                          type="date"
                          value={devLogStartDate}
                          onChange={(e) => setDevLogStartDate(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-[10px] font-bold outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Até (Data)</label>
                        <input 
                          type="date"
                          value={devLogEndDate}
                          onChange={(e) => setDevLogEndDate(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-[10px] font-bold outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Filtro de Tipo</label>
                        <select
                          value={devLogTypeFilter}
                          onChange={(e) => setDevLogTypeFilter(e.target.value as any)}
                          className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-[10px] font-bold outline-none"
                        >
                          <option value="all">TODOS OS LOGS</option>
                          <option value="call">APENAS CHAMADAS</option>
                          <option value="sms">APENAS SMS</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Mín. Duração (Chamada)</label>
                        <select
                          value={devLogMinDuration}
                          onChange={(e) => setDevLogMinDuration(Number(e.target.value))}
                          className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-[10px] font-bold outline-none"
                        >
                          <option value={0}>TODAS AS DURAÇÕES</option>
                          <option value={1}>ATENDIDAS (&gt; 0s)</option>
                          <option value={30}>LONGA (&gt; 30s)</option>
                          <option value={60}>MUITO LONGA (&gt; 60s)</option>
                        </select>
                      </div>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-indigo-50 border border-indigo-100/50 rounded-xl flex items-center justify-between">
                        <div>
                          <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest block">Chamadas no Dispositivo</span>
                          <span className="text-lg font-black text-indigo-950 italic">
                            {filteredDeviceLogs.filter(l => l.type === 'call').length} rec.
                          </span>
                        </div>
                        <Phone size={16} className="text-indigo-500" />
                      </div>
                      <div className="p-3 bg-emerald-50 border border-emerald-100/50 rounded-xl flex items-center justify-between">
                        <div>
                          <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest block">SMS no Dispositivo</span>
                          <span className="text-lg font-black text-emerald-950 italic">
                            {filteredDeviceLogs.filter(l => l.type === 'sms').length} rec.
                          </span>
                        </div>
                        <MessageSquare size={16} className="text-emerald-600" />
                      </div>
                      <div className="p-3 bg-amber-50 border border-amber-100/50 rounded-xl flex items-center justify-between">
                        <div>
                          <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest block">Ligação Wrapper</span>
                          <span className="text-[10px] font-black text-amber-800 uppercase italic flex items-center gap-1 mt-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-ping" />
                            Auditoria OK
                          </span>
                        </div>
                        <Smartphone size={16} className="text-amber-600" />
                      </div>
                    </div>

                    {/* Timeline logs output */}
                    {loadingDeviceLogs ? (
                      <div className="py-12 text-center">
                        <Loader2 className="animate-spin text-indigo-600 mx-auto" size={24} />
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mt-2">A carregar logs do telemóvel...</span>
                      </div>
                    ) : filteredDeviceLogs.length === 0 ? (
                      <div className="py-12 text-center text-slate-300 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center">
                        <Smartphone size={24} className="mb-2 text-slate-400" />
                        <span className="text-xs uppercase font-bold tracking-wider">Nenhum log nativo encontrado para estes filtros</span>
                        <p className="text-[9px] text-slate-400 mt-1 uppercase">Importe novos logs ou utilize o PermissionManager no motorista para sincronizar.</p>
                      </div>
                    ) : (
                      <div className="overflow-hidden border border-slate-100 rounded-2xl max-h-[300px] overflow-y-auto">
                        <table className="w-full text-left font-sans text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 font-black uppercase text-[8px] tracking-widest text-slate-400">
                              <th className="p-3 w-28">Data / Hora</th>
                              <th className="p-3 w-20 text-center">Tipo</th>
                              <th className="p-3">Descrição Detalhada do Evento</th>
                              <th className="p-3 w-24 text-right">Duração</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredDeviceLogs.map((log: any) => (
                              <tr key={log.id} className="hover:bg-slate-50/50">
                                <td className="p-3 font-mono font-bold text-slate-500 text-[10px]">
                                  {log.date} <span className="text-slate-400 font-normal">{log.time}</span>
                                </td>
                                <td className="p-3 text-center">
                                  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider inline-block ${
                                    log.type === 'call' ? 'bg-indigo-100 text-indigo-700 animate-pulse' :
                                    log.type === 'sms' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {log.type === 'call' ? 'Chamada' : log.type === 'sms' ? 'SMS' : log.type}
                                  </span>
                                </td>
                                <td className="p-3 text-slate-800 font-medium">
                                  {log.message}
                                </td>
                                <td className="p-3 text-right font-mono font-bold text-slate-600">
                                  {log.type === 'call' ? `${log.duration}s` : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* AI AUDIT ACTION INSIGHTS TAB */}
                {dossierTab === 'audit' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-violet-50 rounded-2xl border border-violet-100 flex items-start gap-4">
                      <div className="p-2.5 bg-violet-600 rounded-xl text-white flex-shrink-0">
                         <Sparkles size={18} />
                      </div>
                      <div>
                        <h4 className="text-xs font-black uppercase text-violet-900 tracking-wider">Auditoria IA de Comunicações do Campo</h4>
                        <p className="text-[10px] text-violet-700 font-semibold mt-1">
                          Auditoria gerada de forma dinâmica utilizando o modelo Gemini 1.5 Flash. Analisa o faturamento estimado, a taxa de sucesso nas chamadas e no recebimento de SMS das escalas.
                        </p>
                      </div>
                    </div>

                    {isAuditing ? (
                      <div className="py-16 text-center space-y-3">
                        <Loader2 className="animate-spin text-violet-600 mx-auto" size={32} />
                        <p className="text-xs uppercase font-black text-slate-400 tracking-widest animate-pulse">Consultando Redes do Comando Central...</p>
                      </div>
                    ) : aiReport ? (
                      <div className="p-6 bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 font-mono text-[11px] leading-relaxed relative overflow-hidden shadow-xl whitespace-pre-line">
                         <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
                            <span className="text-[8px] font-black tracking-widest text-[#2563eb] uppercase">Relatório de Desempenho Operacional Gemini</span>
                            <button 
                              onClick={() => {
                                const blob = new Blob([aiReport], { type: "text/plain;charset=utf-8" });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `auditoria_ia_${selectedDriver.name.replace(/\s+/g, '_').toLowerCase()}.txt`;
                                a.click();
                              }}
                              className="text-[8px] bg-white/5 font-black uppercase tracking-widest px-2.5 py-1 rounded hover:bg-white/10 flex items-center gap-1 leading-none text-slate-300 border border-white/5"
                            >
                               <Download size={10} /> Gravar Auditoria
                            </button>
                         </div>
                         {aiReport}
                      </div>
                    ) : (
                      <div className="py-12 text-center">
                         <button 
                           onClick={() => handleRunAudit(selectedDriver)}
                           className="px-6 py-3 bg-violet-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-violet-700 transition-all shadow-md active:scale-95"
                         >
                           Disparar Nova Análise
                         </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal controls footer */}
              <div className="p-8 border-t border-slate-100 flex items-center justify-end bg-slate-50 gap-3">
                <button 
                  onClick={() => {
                    setSmsTargetNumber(selectedDriver.phone);
                    setIsSmsModalOpen(true);
                  }}
                  className="px-6 py-3 bg-white text-slate-800 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-slate-50 border border-slate-200"
                >
                  Registar Disparo de SMS Especial
                </button>
                <button 
                  onClick={handleCloseDossier}
                  className="px-8 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black"
                >
                  Fechar Dossiê
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SEND QUICK SMS OVERLAY MODAL */}
      <AnimatePresence>
        {isSmsModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSmsModalOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-[2rem] shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden z-[101]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div>
                   <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase italic flex items-center gap-2">
                     <Send size={16} className="text-brand-primary animate-pulse" /> Dispatcher de SMS
                   </h3>
                   <p className="text-[8px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Registado permanentemente no Unitel Gateway</p>
                </div>
                <button 
                  onClick={() => setIsSmsModalOpen(false)}
                  className="w-10 h-10 flex items-center justify-center hover:bg-slate-200 rounded-xl transition-all"
                >
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <form onSubmit={dispatchSmsForm} className="p-6 space-y-4">
                {smsError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-[10px] font-black uppercase flex items-center gap-2">
                    <AlertCircle size={14} /> {smsError}
                  </div>
                )}
                
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Número de Destino</label>
                  <div className="flex gap-0">
                     <span className="px-3.5 py-3 bg-slate-900 text-white rounded-l-xl text-xs font-black flex items-center italic select-none">+244</span>
                     <input 
                       required
                       type="tel"
                       placeholder="9XXXXXXXX"
                       maxLength={9}
                       value={smsTargetNumber.startsWith('+244') ? smsTargetNumber.slice(4) : smsTargetNumber}
                       onChange={(e) => setSmsTargetNumber(e.target.value.replace(/\D/g, ''))}
                       className="flex-1 border border-slate-200 rounded-r-xl px-4 py-3 text-xs font-black outline-none italic tracking-wider focus:ring-1 focus:ring-slate-400 focus:bg-white"
                     />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Conteúdo da Mensagem de Alerta</label>
                  <textarea 
                    required
                    rows={4}
                    placeholder="Escreva a mensagem aqui (Mantenha o tom profissional PSM)..."
                    value={smsContent}
                    onChange={(e) => setSmsContent(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-slate-400 focus:bg-white font-medium"
                  />
                  <div className="text-[8px] text-slate-400 font-mono text-right font-semibold">
                    {smsContent.length} caracteres • 1 segmento de cobrança
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsSmsModalOpen(false)}
                    className="flex-1 py-3 text-[10px] bg-slate-100 text-slate-600 rounded-xl uppercase font-black"
                  >
                    Descartar Alerta
                  </button>
                  <button 
                    type="submit"
                    disabled={smsSending}
                    className="flex-1 py-3 bg-slate-900 hover:bg-black text-white rounded-xl text-[10px] uppercase font-black tracking-widest flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-60"
                  >
                    {smsSending ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} className="text-emerald-500" />}
                    Logar Envio SMS
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* REGISTER MANUAL CALL OVERLAY MODAL */}
      <AnimatePresence>
        {isCallModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCallModalOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-[2rem] shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden z-[101]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div>
                   <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase italic flex items-center gap-2">
                     <Phone size={16} className="text-emerald-500" /> Registro de Corrida
                   </h3>
                   <p className="text-[8px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Registado permanentemente nos canais da Central</p>
                </div>
                <button 
                  onClick={() => setIsCallModalOpen(false)}
                  className="w-10 h-10 flex items-center justify-center hover:bg-slate-200 rounded-xl transition-all"
                >
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <form onSubmit={submitManualCall} className="p-6 space-y-4">
                {callError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-[10px] font-black uppercase flex items-center gap-2">
                    <AlertCircle size={14} /> {callError}
                  </div>
                )}
                
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Vincular ao Motorista</label>
                  <select
                    required
                    value={callDriverName}
                    onChange={(e) => setCallDriverName(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-xs font-black outline-none uppercase italic"
                  >
                    <option value="">Selecione o motorista...</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Cliente</label>
                    <input 
                      type="text"
                      placeholder="Ex: Particular"
                      value={callCustomerName}
                      onChange={(e) => setCallCustomerName(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-xs font-black outline-none uppercase italic"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Contacto Telemóvel</label>
                    <input 
                      required
                      type="tel"
                      placeholder="9XXXXXXXX"
                      maxLength={9}
                      value={callCustomerPhone}
                      onChange={(e) => setCallCustomerPhone(e.target.value.replace(/\D/g, ''))}
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-xs font-black outline-none tracking-widest font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Ponto de Recolha / Descrição</label>
                  <input 
                    type="text"
                    required
                    placeholder="Ex: Aeroporto do Luena"
                    value={callPickupAddress}
                    onChange={(e) => setCallPickupAddress(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none uppercase italic"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Status da Chamada</label>
                    <select
                      value={callStatus}
                      onChange={(e) => setCallStatus(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-xs font-black outline-none uppercase text-slate-700"
                    >
                      <option value="completed">Concluída</option>
                      <option value="pending">Pendente</option>
                      <option value="cancelled">Cancelada</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Preço Cobrado (AOA)</label>
                    <input 
                      type="number"
                      required
                      value={callPrice}
                      onChange={(e) => setCallPrice(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-xs font-black outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsCallModalOpen(false)}
                    className="flex-1 py-3 text-[10px] bg-slate-100 text-slate-600 rounded-xl uppercase font-black"
                  >
                    Descartar Registro
                  </button>
                  <button 
                    type="submit"
                    disabled={callSubmitting}
                    className="flex-1 py-3 bg-slate-900 hover:bg-black text-white rounded-xl text-[10px] uppercase font-black tracking-widest flex items-center justify-center gap-2 shadow-lg disabled:opacity-60"
                  >
                    {callSubmitting ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} className="text-emerald-500" />}
                    Auditar Corrida Log
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* IMPORT NATIVE DEVICE LOGS MODAL */}
      <AnimatePresence>
        {isImportModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsImportModalOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-[2rem] shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden z-[101]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div>
                   <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase italic flex items-center gap-2">
                     <Smartphone size={16} className="text-indigo-600 animate-pulse" /> Importador de Logs do Telemóvel
                   </h3>
                   <p className="text-[8px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Carregar ficheiro nativo ou gerar simulação de teste</p>
                </div>
                <button 
                  onClick={() => setIsImportModalOpen(false)}
                  className="w-10 h-10 flex items-center justify-center hover:bg-slate-200 rounded-xl transition-all"
                >
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleImportSubmit} className="p-6 space-y-4">
                {importError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-[10px] font-black uppercase flex items-center gap-2">
                    <AlertCircle size={14} /> {importError}
                  </div>
                )}

                {importSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-[10px] font-black uppercase flex items-center gap-2">
                    <ShieldCheck size={14} /> IMPORTAÇÃO CONCLUÍDA COM SUCESSO!
                  </div>
                )}
                
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Vincular Logs ao Motorista</label>
                  <select
                    required
                    value={importDriverId}
                    onChange={(e) => setImportDriverId(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-xs font-black outline-none uppercase italic"
                  >
                    <option value="">Selecione o motorista...</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 block">Carregar Ficheiro JSON de Logs</label>
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center bg-slate-50/50 hover:bg-slate-50 transition-all relative">
                    <input 
                      type="file"
                      accept=".json"
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <Download size={24} className="text-slate-400 mb-1" />
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-wide">Arraste ou clique para selecionar ficheiro .json</span>
                    <span className="text-[8px] text-slate-400 font-bold mt-1 uppercase">Máximo 1MB • Formato Array JSON</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Alternativa Rápida para Auditoria</span>
                  <button
                    type="button"
                    onClick={handleGenerateSampleLogs}
                    className="px-3 py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 hover:bg-indigo-100 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
                  >
                    Gerar Logs de Teste
                  </button>
                </div>

                {importFileContent && (
                  <div className="p-3 bg-slate-900 text-white rounded-xl space-y-1.5">
                    <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest block">Pré-visualização dos Dados ({importFileContent.length} itens)</span>
                    <div className="max-h-24 overflow-y-auto space-y-1 font-mono text-[9px] leading-tight text-slate-300">
                      {importFileContent.map((l: any, idx: number) => (
                        <div key={idx} className="truncate border-b border-white/5 pb-1 flex justify-between">
                          <span>[{l.type?.toUpperCase()}] {l.message}</span>
                          <span className="text-indigo-300">{l.duration !== undefined ? `${l.duration}s` : ''}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => {
                      setIsImportModalOpen(false);
                      setImportFileContent(null);
                      setImportDriverId('');
                    }}
                    className="flex-1 py-3 text-[10px] bg-slate-100 text-slate-600 rounded-xl uppercase font-black"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={importing || !importDriverId || !importFileContent}
                    className="flex-1 py-3 bg-slate-900 hover:bg-black text-white rounded-xl text-[10px] uppercase font-black tracking-widest flex items-center justify-center gap-2 shadow-lg disabled:opacity-60"
                  >
                    {importing ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} className="text-indigo-400" />}
                    Confirmar Importação
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
