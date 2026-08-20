import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Power, 
  LogOut, 
  Smartphone, 
  RefreshCw, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  Send, 
  User, 
  Phone, 
  Car, 
  Clock, 
  Sparkles, 
  Download, 
  Info, 
  Lock, 
  Unlock, 
  WifiOff, 
  Zap, 
  X,
  MessageSquare,
  ShieldCheck,
  Radio,
  FileSpreadsheet,
  LifeBuoy,
  Building,
  Building2
} from 'lucide-react';
import { 
  db, 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  serverTimestamp, 
  getActiveTenantId 
} from '../lib/firebase';
import { geminiService } from '../services/geminiService';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DriverSessionShiftAuditProps {
  user?: any;
  onClose?: () => void;
  isModal?: boolean;
}

export interface DriverAuditStatus {
  id: string;
  name: string;
  prefix: string;
  phone: string;
  plate?: string;
  photo?: string;
  status?: string;
  status_operacional?: string;
  // Session indicators
  sessionActive?: boolean;
  isLoggedIn?: boolean;
  online?: boolean;
  isOnline?: boolean;
  disponibilidade_app?: boolean;
  passengerAppActive?: boolean;
  lastActiveAt?: string;
  fcmToken?: string;
  deviceModel?: string;
  // Shift indicators
  shiftActive?: boolean;
  shiftEnded?: boolean;
  lastShiftStartedAt?: string;
  lastShiftEndedAt?: string;
  lastShiftEndedBy?: string;
  // Tenant
  tenantId?: string;
}

export default function DriverSessionShiftAudit({ user, onClose, isModal = false }: DriverSessionShiftAuditProps) {
  const [drivers, setDrivers] = useState<DriverAuditStatus[]>([]);
  const [tenantsList, setTenantsList] = useState<{ id: string; name: string }[]>([]);
  const [selectedTenantFilter, setSelectedTenantFilter] = useState<string>('all');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'critical' | 'ghost' | 'synced' | 'all'>('critical');
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [selectedDriverForMsg, setSelectedDriverForMsg] = useState<DriverAuditStatus | null>(null);
  const [remoteMsgText, setRemoteMsgText] = useState('');
  const [isSendingMsg, setIsSendingMsg] = useState(false);
  const [aiDiagnosis, setAiDiagnosis] = useState<string | null>(null);
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);
  const [processingDriverId, setProcessingDriverId] = useState<string | null>(null);

  // Set default tenant filter if user is locked to a specific tenant
  useEffect(() => {
    if (user?.tenantId || user?.companyId) {
      setSelectedTenantFilter(user.tenantId || user.companyId);
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    let unsubDrivers = () => {};
    let unsubLogs = () => {};
    let unsubTenants = () => {};

    if (db) {
      // 1. Listen to tenants collection
      const qTenants = query(collection(db, 'tenants'));
      unsubTenants = onSnapshot(qTenants, (snapshot) => {
        const list = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          name: docSnap.data().name || docSnap.id,
          ...docSnap.data()
        }));
        setTenantsList(list);
      }, (err) => {
        console.warn('Erro ao carregar lista de companhias/tenants:', err);
      });

      // 2. Listen to drivers collection
      const qDrivers = query(collection(db, 'drivers'));
      unsubDrivers = onSnapshot(qDrivers, (snapshot) => {
        const list = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        })) as DriverAuditStatus[];
        setDrivers(list);
        setLoading(false);
      }, (err) => {
        console.warn('Erro ao carregar motoristas para auditoria:', err);
        setLoading(false);
      });

      // 3. Listen to audit support logs
      const qLogs = query(collection(db, 'driver_session_audit_logs'));
      unsubLogs = onSnapshot(qLogs, (snapshot) => {
        const logs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        // Sort descending by timestamp
        logs.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
        setAuditLogs(logs.slice(0, 30));
      }, (err) => {
        console.warn('Erro ao carregar logs de auditoria:', err);
      });
    }

    return () => {
      unsubDrivers();
      unsubLogs();
      unsubTenants();
    };
  }, []);

  const triggerToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Helper function to resolve company / tenant display name
  const getTenantName = (tId?: string): string => {
    if (!tId || tId === 'psm') return 'PSMoreira Comercial';
    if (tId === 'jis') return 'SUPER Táxi JIS';
    const found = tenantsList.find(t => t.id === tId);
    return found ? found.name : tId.toUpperCase();
  };

  // Helper function to check if a driver belongs to the selected tenant
  const checkDriverMatchesTenant = (d: DriverAuditStatus): boolean => {
    if (selectedTenantFilter === 'all') return true;
    const driverTenant = d.tenantId || (d as any).tenant || (d as any).companyId || (d as any).company || 'psm';
    return driverTenant === selectedTenantFilter;
  };

  // Evaluation Helper Functions
  const checkHasActiveSession = (d: DriverAuditStatus): boolean => {
    return Boolean(
      d.sessionActive === true || 
      d.isLoggedIn === true || 
      d.online === true || 
      d.isOnline === true || 
      d.disponibilidade_app === true || 
      d.passengerAppActive === true
    );
  };

  const checkIsShiftActive = (d: DriverAuditStatus): boolean => {
    if (d.shiftEnded === true) return false;
    if (d.shiftActive === false) return false;
    const st = String(d.status || '').toLowerCase();
    if (st === 'offline' || st === 'indisponível' || st === 'inativo') return false;
    return Boolean(
      d.shiftActive === true || 
      st === 'available' || 
      st === 'disponível' || 
      st === 'disponivel' || 
      st === 'busy' || 
      st === 'ocupado' || 
      st === 'ativo'
    );
  };

  const checkIsShiftEnded = (d: DriverAuditStatus): boolean => {
    const st = String(d.status || '').toLowerCase();
    return Boolean(
      d.shiftEnded === true || 
      d.shiftActive === false || 
      st === 'offline' || 
      st === 'indisponível' || 
      st === 'inativo' || 
      d.status_operacional === 'inativo'
    );
  };

  // Filter drivers base list by company (tenantId)
  const tenantFilteredDrivers = drivers.filter(checkDriverMatchesTenant);

  // Categorize drivers within selected tenant
  const criticalConflictDrivers = tenantFilteredDrivers.filter(d => checkHasActiveSession(d) && checkIsShiftEnded(d));
  const ghostDrivers = tenantFilteredDrivers.filter(d => checkIsShiftActive(d) && !checkHasActiveSession(d));
  const syncedDrivers = tenantFilteredDrivers.filter(d => 
    (checkHasActiveSession(d) && checkIsShiftActive(d)) || 
    (!checkHasActiveSession(d) && checkIsShiftEnded(d))
  );

  // Filtered drivers list according to category tab & search
  const filteredDrivers = tenantFilteredDrivers.filter(d => {
    const hasSession = checkHasActiveSession(d);
    const shiftEnded = checkIsShiftEnded(d);
    const shiftActive = checkIsShiftActive(d);

    let matchesCategory = true;
    if (filterType === 'critical') {
      matchesCategory = hasSession && shiftEnded;
    } else if (filterType === 'ghost') {
      matchesCategory = shiftActive && !hasSession;
    } else if (filterType === 'synced') {
      matchesCategory = (hasSession && shiftActive) || (!hasSession && shiftEnded);
    }

    const queryStr = searchTerm.toLowerCase().trim();
    const matchesSearch = !queryStr || 
      (d.name || '').toLowerCase().includes(queryStr) ||
      (d.prefix || '').toLowerCase().includes(queryStr) ||
      (d.phone || '').toLowerCase().includes(queryStr) ||
      (d.plate || '').toLowerCase().includes(queryStr);

    return matchesCategory && matchesSearch;
  });

  // Construct available tenant options dynamically
  const availableTenantsMap = new Map<string, string>();
  availableTenantsMap.set('psm', 'PSMoreira Comercial, (SU) Lda');
  availableTenantsMap.set('jis', 'SUPER TÁXI JIS ANGOLA');
  tenantsList.forEach(t => {
    if (t.id) availableTenantsMap.set(t.id, t.name || t.id);
  });
  drivers.forEach(d => {
    const tid = d.tenantId || (d as any).tenant || (d as any).companyId || (d as any).company;
    if (tid && !availableTenantsMap.has(tid)) {
      availableTenantsMap.set(tid, `Companhia ${tid.toUpperCase()}`);
    }
  });

  const availableTenantOptions = Array.from(availableTenantsMap.entries()).map(([id, name]) => ({
    id,
    name,
    count: drivers.filter(d => (d.tenantId || (d as any).tenant || (d as any).companyId || 'psm') === id).length
  }));

  // Action 1: Force Session Logout (Desconectar Sessão Remotamente)
  const handleForceLogoutSession = async (driver: DriverAuditStatus) => {
    if (!db || !driver.id) return;
    const confirmText = `Confirma o fecho remoto da SESSÃO do motorista ${driver.name} (${driver.prefix})?\n\nIsto irá desligar o acesso ativo no dispositivo móvel mantendo o registo de turno em conformidade.`;
    if (!confirm(confirmText)) return;

    setProcessingDriverId(driver.id);
    try {
      const nowIso = new Date().toISOString();
      const operatorName = user?.name || user?.email || 'JIS (Administrador)';

      await updateDoc(doc(db, 'drivers', driver.id), {
        sessionActive: false,
        isLoggedIn: false,
        online: false,
        isOnline: false,
        disponibilidade_app: false,
        passengerAppActive: false,
        lastRemoteSessionLogoutAt: nowIso,
        lastRemoteSessionLogoutBy: operatorName
      });

      await addDoc(collection(db, 'driver_session_audit_logs'), {
        driverId: driver.id,
        driverName: driver.name || 'Motorista',
        prefix: driver.prefix || 'N/A',
        action: 'FORCE_LOGOUT_SESSION',
        details: 'Sessão remota encerrada pela central para resolver conflito com turno finalizado',
        operator: operatorName,
        timestamp: nowIso,
        tenantId: getActiveTenantId() || 'jis'
      });

      triggerToast(`Sessão de ${driver.prefix} - ${driver.name} encerrada remotamente!`, 'success');
    } catch (e: any) {
      console.error('Erro ao encerrar sessão:', e);
      triggerToast(`Erro ao encerrar sessão: ${e.message}`, 'error');
    } finally {
      setProcessingDriverId(null);
    }
  };

  // Action 2: Reactivate Shift Remotely (Reabrir Turno Remotamente)
  const handleReactivateShift = async (driver: DriverAuditStatus) => {
    if (!db || !driver.id) return;
    const confirmText = `Deseja REATIVAR o TURNO do motorista ${driver.name} (${driver.prefix}) remotamente?\n\nO motorista voltará ao estado DISPONÍVEL no mapa e na app de passageiros.`;
    if (!confirm(confirmText)) return;

    setProcessingDriverId(driver.id);
    try {
      const nowIso = new Date().toISOString();
      const operatorName = user?.name || user?.email || 'JIS (Administrador)';

      await updateDoc(doc(db, 'drivers', driver.id), {
        shiftActive: true,
        shiftEnded: false,
        status: 'disponível',
        status_operacional: 'ativo',
        online: true,
        isOnline: true,
        disponibilidade_app: true,
        lastShiftReactivatedAt: nowIso,
        lastShiftReactivatedBy: operatorName
      });

      await addDoc(collection(db, 'driver_session_audit_logs'), {
        driverId: driver.id,
        driverName: driver.name || 'Motorista',
        prefix: driver.prefix || 'N/A',
        action: 'REACTIVATE_SHIFT_REMOTE',
        details: 'Turno reativado remotamente a pedido de suporte/erro do motorista',
        operator: operatorName,
        timestamp: nowIso,
        tenantId: getActiveTenantId() || 'jis'
      });

      triggerToast(`Turno de ${driver.prefix} reativado com sucesso!`, 'success');
    } catch (e: any) {
      console.error('Erro ao reativar turno:', e);
      triggerToast(`Erro ao reativar turno: ${e.message}`, 'error');
    } finally {
      setProcessingDriverId(null);
    }
  };

  // Action 3: Full Sync Reset (Reset Total Limpo: Desconectar Sessão e Turno)
  const handleFullStateReset = async (driver: DriverAuditStatus) => {
    if (!db || !driver.id) return;
    const confirmText = `Executar RESET LIMPO de estado para ${driver.name} (${driver.prefix})?\n\nSessão e Turno serão definidos como INATIVOS e o motorista terá de iniciar novo login na aplicação.`;
    if (!confirm(confirmText)) return;

    setProcessingDriverId(driver.id);
    try {
      const nowIso = new Date().toISOString();
      const operatorName = user?.name || user?.email || 'JIS (Administrador)';

      await updateDoc(doc(db, 'drivers', driver.id), {
        sessionActive: false,
        isLoggedIn: false,
        online: false,
        isOnline: false,
        disponibilidade_app: false,
        passengerAppActive: false,
        shiftActive: false,
        shiftEnded: true,
        status: 'indisponível',
        status_operacional: 'inativo',
        lastFullResetAt: nowIso,
        lastFullResetBy: operatorName
      });

      await addDoc(collection(db, 'driver_session_audit_logs'), {
        driverId: driver.id,
        driverName: driver.name || 'Motorista',
        prefix: driver.prefix || 'N/A',
        action: 'FULL_STATE_RESET',
        details: 'Reset completo de estado (Sessão & Turno inativados em sincronia)',
        operator: operatorName,
        timestamp: nowIso,
        tenantId: getActiveTenantId() || 'jis'
      });

      triggerToast(`Reset limpo executado para ${driver.prefix}!`, 'success');
    } catch (e: any) {
      console.error('Erro no reset de estado:', e);
      triggerToast(`Erro ao executar reset: ${e.message}`, 'error');
    } finally {
      setProcessingDriverId(null);
    }
  };

  // Bulk Action: Force Logout for ALL Critical Mismatch Drivers
  const handleBulkLogoutCriticalDrivers = async () => {
    if (criticalConflictDrivers.length === 0) {
      triggerToast('Nenhum motorista com conflito de sessão/turno no momento.', 'info');
      return;
    }

    const confirmMsg = `ATENÇÃO ADMINISTRADOR JIS:\n\nConfirma o Fecho Forçado de SESSÃO para TODOS os ${criticalConflictDrivers.length} motoristas que estão com sessão aberta e turno encerrado?\n\nEsta ação limpará remotamente o acesso pendente no dispositivo dos motoristas.`;
    if (!confirm(confirmMsg)) return;

    let successCount = 0;
    const nowIso = new Date().toISOString();
    const operatorName = user?.name || user?.email || 'JIS (Administrador)';

    for (const d of criticalConflictDrivers) {
      if (!d.id) continue;
      try {
        await updateDoc(doc(db, 'drivers', d.id), {
          sessionActive: false,
          isLoggedIn: false,
          online: false,
          isOnline: false,
          disponibilidade_app: false,
          passengerAppActive: false,
          lastRemoteSessionLogoutAt: nowIso,
          lastRemoteSessionLogoutBy: operatorName
        });
        successCount++;
      } catch (err) {
        console.warn(`Erro no logout em massa para ${d.prefix}:`, err);
      }
    }

    await addDoc(collection(db, 'driver_session_audit_logs'), {
      driverId: 'BULK_ALL',
      driverName: 'Sincronização em Massa',
      prefix: 'FROTA',
      action: 'BULK_FORCE_LOGOUT',
      details: `Executado fecho forçado de sessão em massa para ${successCount} motoristas em conflito de turno`,
      operator: operatorName,
      timestamp: nowIso,
      tenantId: getActiveTenantId() || 'jis'
    });

    triggerToast(`Suporte Remoto: ${successCount} sessões encerradas em massa com sucesso!`, 'success');
  };

  // Send Remote Support Message / Push Directive
  const handleSendRemoteMessage = async () => {
    if (!selectedDriverForMsg || !db || !remoteMsgText.trim()) return;

    setIsSendingMsg(true);
    try {
      const nowIso = new Date().toISOString();
      const operatorName = user?.name || user?.email || 'Suporte Central JIS';

      // Record in driver's messages or alert collection
      await addDoc(collection(db, 'driver_notifications'), {
        driverId: selectedDriverForMsg.id,
        driverName: selectedDriverForMsg.name,
        prefix: selectedDriverForMsg.prefix,
        type: 'REMOTE_SUPPORT_INSTRUCTION',
        title: '⚠️ Instrução de Suporte Remoto - Central SUPER Táxi',
        message: remoteMsgText,
        sentBy: operatorName,
        createdAt: nowIso,
        read: false,
        tenantId: getActiveTenantId() || 'jis'
      });

      await addDoc(collection(db, 'driver_session_audit_logs'), {
        driverId: selectedDriverForMsg.id,
        driverName: selectedDriverForMsg.name,
        prefix: selectedDriverForMsg.prefix,
        action: 'SEND_SUPPORT_MESSAGE',
        details: `Mensagem de suporte enviada: "${remoteMsgText.slice(0, 60)}..."`,
        operator: operatorName,
        timestamp: nowIso,
        tenantId: getActiveTenantId() || 'jis'
      });

      triggerToast(`Notificação enviada ao telemóvel de ${selectedDriverForMsg.prefix}!`, 'success');
      setSelectedDriverForMsg(null);
      setRemoteMsgText('');
    } catch (e: any) {
      triggerToast(`Erro ao enviar mensagem: ${e.message}`, 'error');
    } finally {
      setIsSendingMsg(false);
    }
  };

  // Gemini IA Audit Insights
  const handleRunAiDiagnostics = async () => {
    setIsAnalyzingAi(true);
    try {
      const stats = {
        totalDrivers: drivers.length,
        criticalCount: criticalConflictDrivers.length,
        ghostCount: ghostDrivers.length,
        syncedCount: syncedDrivers.length,
        criticalDriversList: criticalConflictDrivers.map(d => ({
          name: d.name,
          prefix: d.prefix,
          phone: d.phone,
          lastActive: d.lastActiveAt || 'N/A',
          lastShiftEnd: d.lastShiftEndedAt || 'N/A'
        }))
      };

      const result = await geminiService.getDriverPerformanceAudit(
        { name: 'Sessões & Turnos da Frota (Luena)', prefix: 'AUDIT' },
        stats
      );

      setAiDiagnosis(result);
      triggerToast('Auditoria Gemini 1.5 Flash concluída com sucesso!', 'success');
    } catch (e: any) {
      setAiDiagnosis('Não foi possível gerar análise no momento. Verifique a ligação à internet.');
      triggerToast('Erro na auditoria IA', 'error');
    } finally {
      setIsAnalyzingAi(false);
    }
  };

  // Export PDF Report
  const handleExportPdfReport = () => {
    try {
      const docPdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const nowStr = new Date().toLocaleString('pt-PT');

      // Title Header
      docPdf.setFillColor(15, 23, 42); // slate-900
      docPdf.rect(0, 0, 210, 32, 'F');

      docPdf.setFont('helvetica', 'bold');
      docPdf.setFontSize(16);
      docPdf.setTextColor(245, 158, 11); // amber-500
      docPdf.text("JIS ANGOLA • SUPER TÁXI CONTROL", 14, 12);

      docPdf.setFontSize(10);
      docPdf.setTextColor(255, 255, 255);
      docPdf.text("RELATÓRIO DE AUDITORIA: SESSÕES ATIVAS VS TURNOS ENCERRADOS", 14, 20);

      docPdf.setFontSize(8);
      docPdf.setTextColor(148, 163, 184);
      const companyScopeName = selectedTenantFilter === 'all' ? 'Todas as Companhias' : getTenantName(selectedTenantFilter);
      docPdf.text(`Data de Emissão: ${nowStr} | Emitido por: ${user?.name || 'Administrador JIS'} | Âmbito: ${companyScopeName}`, 14, 27);

      // Metrics Summary
      docPdf.setFillColor(248, 250, 252);
      docPdf.rect(14, 36, 182, 22, 'F');
      docPdf.setDrawColor(226, 232, 240);
      docPdf.rect(14, 36, 182, 22, 'S');

      docPdf.setFontSize(9);
      docPdf.setTextColor(15, 23, 42);
      docPdf.text(`Total Frota Auditada (${companyScopeName}): ${tenantFilteredDrivers.length} Motoristas`, 20, 43);
      docPdf.setTextColor(225, 29, 72); // rose-600
      docPdf.text(`Sessão Ativa com Turno Encerrado: ${criticalConflictDrivers.length} Motoristas (Anomalia Crítica)`, 20, 49);
      docPdf.setTextColor(217, 119, 6); // amber-600
      docPdf.text(`Turno Ativo com Sessão Inativa: ${ghostDrivers.length} Motoristas`, 20, 55);

      // Table Data
      const tableData = criticalConflictDrivers.map(d => [
        d.prefix || 'N/A',
        d.name || 'N/A',
        d.phone || 'N/A',
        d.sessionActive || d.isLoggedIn || d.online ? 'Logado / Ativo' : 'Desconectado',
        d.shiftEnded || !d.shiftActive ? 'Encerrado / Inativo' : 'Em Turno',
        d.lastActiveAt ? new Date(d.lastActiveAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
        'Incompatibilidade de Fecho'
      ]);

      autoTable(docPdf, {
        startY: 64,
        head: [['Viatura', 'Motorista', 'Contacto', 'Estado Sessão', 'Estado Turno', 'Últ. Ativ.', 'Diagnóstico']],
        body: tableData.length > 0 ? tableData : [['-', 'Nenhum conflito crítico detetado na frota.', '-', '-', '-', '-', 'OK']],
        theme: 'striped',
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [245, 158, 11],
          fontStyle: 'bold',
          fontSize: 8
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [30, 41, 59]
        },
        alternateRowStyles: {
          fillColor: [241, 245, 249]
        }
      });

      docPdf.save(`Auditoria_Sessoes_Turnos_JIS_${new Date().toISOString().slice(0,10)}.pdf`);
      triggerToast('Relatório PDF exportado com sucesso!', 'success');
    } catch (e: any) {
      console.error('Erro PDF:', e);
      triggerToast('Erro ao exportar PDF: ' + e.message, 'error');
    }
  };

  const formattedTime = (iso?: string) => {
    if (!iso) return 'Sem registo';
    const date = new Date(iso);
    if (isNaN(date.getTime())) return iso;
    return date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
  };

  const containerContent = (
    <div className="space-y-6">
      {/* Banner Superior & Título */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-12 -bottom-12 w-56 h-56 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-rose-500 via-amber-500 to-violet-600 p-0.5 shadow-xl shadow-rose-500/20 flex items-center justify-center shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <ShieldAlert className="text-rose-400" size={26} />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-black uppercase tracking-wider text-white">
                  Auditoria de Sessão vs Turno de Condução
                </h2>
                <span className="px-3 py-0.5 text-[9px] font-black uppercase tracking-widest bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-full flex items-center gap-1.5">
                  <Radio size={12} className="animate-pulse text-rose-400" /> Suporte Remoto JIS
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1.5 max-w-2xl leading-relaxed">
                Ferramenta administrativa para deteção e resolução em tempo real de motoristas com <strong className="text-rose-400 font-bold">Sessão Ativa na aplicação telemóvel, mas com Turno Encerrado</strong> no sistema.
              </p>
            </div>
          </div>

          {/* Botões Superiores de Ação Geral */}
          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <button
              onClick={handleRunAiDiagnostics}
              disabled={isAnalyzingAi}
              className="px-3.5 py-2.5 rounded-xl bg-violet-600/30 hover:bg-violet-600/50 border border-violet-500/40 text-violet-200 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-md disabled:opacity-50"
            >
              <Sparkles size={14} className={isAnalyzingAi ? "animate-spin text-amber-400" : "text-violet-400"} />
              {isAnalyzingAi ? 'A Analisar...' : 'Auditoria IA Gemini'}
            </button>

            <button
              onClick={handleExportPdfReport}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-md"
            >
              <Download size={14} className="text-amber-400" />
              Relatório PDF
            </button>

            {isModal && onClose && (
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-all"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between shadow-xl animate-fade-in ${
          toastMessage.type === 'success' 
            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' 
            : toastMessage.type === 'error'
            ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
            : 'bg-blue-500/15 border-blue-500/40 text-blue-300'
        }`}>
          <div className="flex items-center gap-3">
            {toastMessage.type === 'success' && <CheckCircle2 size={18} className="text-emerald-400" />}
            {toastMessage.type === 'error' && <AlertTriangle size={18} className="text-rose-400" />}
            {toastMessage.type === 'info' && <Info size={18} className="text-blue-400" />}
            <span>{toastMessage.text}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      {/* KPI Cards de Estado da Frota */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Critical Anomaly (Sessão Ativa + Turno Encerrado) */}
        <div 
          onClick={() => setFilterType('critical')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
            filterType === 'critical'
              ? 'bg-rose-950/40 border-rose-500/80 shadow-xl shadow-rose-500/10 ring-2 ring-rose-500/30'
              : 'bg-slate-900 border-slate-800 hover:border-rose-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-rose-400 block mb-1">
                Conflito Crítico
              </span>
              <p className="text-2xl font-black text-rose-400">
                {criticalConflictDrivers.length}
              </p>
            </div>
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
              criticalConflictDrivers.length > 0 
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse' 
                : 'bg-slate-800 text-slate-500'
            }`}>
              <Smartphone size={22} />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 font-medium">
            Sessão ativa na app com turno já encerrado
          </p>
        </div>

        {/* Card 2: Ghost Drivers (Turno Ativo + Sessão Desconectada) */}
        <div 
          onClick={() => setFilterType('ghost')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
            filterType === 'ghost'
              ? 'bg-amber-950/40 border-amber-500/80 shadow-xl shadow-amber-500/10 ring-2 ring-amber-500/30'
              : 'bg-slate-900 border-slate-800 hover:border-amber-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block mb-1">
                Turno Sem Sessão
              </span>
              <p className="text-2xl font-black text-amber-400">
                {ghostDrivers.length}
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <WifiOff size={22} />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 font-medium">
            Turno ligado mas app/sessão desconectada
          </p>
        </div>

        {/* Card 3: Synced Drivers */}
        <div 
          onClick={() => setFilterType('synced')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
            filterType === 'synced'
              ? 'bg-emerald-950/40 border-emerald-500/80 shadow-xl shadow-emerald-500/10 ring-2 ring-emerald-500/30'
              : 'bg-slate-900 border-slate-800 hover:border-emerald-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block mb-1">
                Sincronizados OK
              </span>
              <p className="text-2xl font-black text-emerald-400">
                {syncedDrivers.length}
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <ShieldCheck size={22} />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 font-medium">
            Sessão e turno devidamente harmonizados
          </p>
        </div>

        {/* Card 4: Total Fleet Audited */}
        <div 
          onClick={() => setFilterType('all')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
            filterType === 'all'
              ? 'bg-slate-800 border-blue-500/80 shadow-xl shadow-blue-500/10 ring-2 ring-blue-500/30'
              : 'bg-slate-900 border-slate-800 hover:border-blue-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 block mb-1">
                Total Auditado
              </span>
              <p className="text-2xl font-black text-blue-400">
                {drivers.length}
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <Car size={22} />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 font-medium">
            Total de viaturas na base de dados
          </p>
        </div>
      </div>

      {/* Seção AI Diagnostic Alert (Se gerada) */}
      {aiDiagnosis && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-violet-950/80 via-slate-900 to-slate-900 border border-violet-500/40 shadow-xl relative overflow-hidden animate-fade-in">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-violet-600/30">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-violet-300">
                  Parecer da Auditoria Automatizada (Gemini 1.5 Flash)
                </h3>
                <p className="text-[10px] text-slate-400">Análise inteligente de estado de sessão e suporte à frota</p>
              </div>
            </div>
            <button 
              onClick={() => setAiDiagnosis(null)} 
              className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800"
            >
              <X size={14} />
            </button>
          </div>
          <div className="mt-3 pt-3 border-t border-violet-500/20 text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-mono">
            {aiDiagnosis}
          </div>
        </div>
      )}

      {/* Ação em Massa para Resolver Todos os Conflitos Críticos */}
      {criticalConflictDrivers.length > 0 && (
        <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/40 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30">
              <AlertTriangle size={20} className="animate-bounce" />
            </div>
            <div>
              <p className="text-xs font-black text-rose-300 uppercase tracking-wider">
                Ação de Suporte em Massa Disponível ({criticalConflictDrivers.length} Motoristas)
              </p>
              <p className="text-[11px] text-slate-400">
                Existem motoristas que terminaram o turno mas mantêm a sessão ativa na aplicação. Pode desconectá-los a todos com um clique.
              </p>
            </div>
          </div>
          <button
            onClick={handleBulkLogoutCriticalDrivers}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-rose-600/20 shrink-0"
          >
            <LogOut size={16} />
            Desconectar Todas as Sessões em Conflito
          </button>
        </div>
      )}

      {/* Controles de Filtros e Pesquisa */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          {/* Pesquisa por Texto */}
          <div className="relative w-full sm:w-64">
            <Search size={16} className="absolute left-3.5 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="Pesquisar motorista, viatura, contacto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-all"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-3 top-2.5 text-slate-500 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filtro por Companhia / Frota (tenantId) */}
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 w-full sm:w-auto shrink-0">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
              <Building2 size={15} />
            </div>
            <div className="flex flex-col w-full sm:w-auto">
              <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                Companhia / Frota
              </span>
              <select
                value={selectedTenantFilter}
                onChange={(e) => setSelectedTenantFilter(e.target.value)}
                disabled={Boolean(user?.tenantId && user?.role !== 'admin' && user?.permissao !== 'admin')}
                className="bg-transparent text-xs font-black text-amber-300 outline-none cursor-pointer pr-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <option value="all" className="bg-slate-900 text-white">
                  Todas as Companhias ({drivers.length} Motoristas)
                </option>
                {availableTenantOptions.map(t => (
                  <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                    {t.name} ({t.count} viaturas)
                  </option>
                ))}
              </select>
            </div>
            {selectedTenantFilter !== 'all' && (
              <span className="px-2 py-0.5 text-[8px] font-extrabold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-full shrink-0">
                Ativo
              </span>
            )}
          </div>
        </div>

        {/* Abas de Categoria */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setFilterType('critical')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all whitespace-nowrap ${
              filterType === 'critical' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldAlert size={13} />
            Sessão Ativa / Turno Encerrado ({criticalConflictDrivers.length})
          </button>

          <button
            onClick={() => setFilterType('ghost')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all whitespace-nowrap ${
              filterType === 'ghost' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <WifiOff size={13} />
            Turno Sem Sessão ({ghostDrivers.length})
          </button>

          <button
            onClick={() => setFilterType('synced')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all whitespace-nowrap ${
              filterType === 'synced' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldCheck size={13} />
            Sincronizados ({syncedDrivers.length})
          </button>

          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all whitespace-nowrap ${
              filterType === 'all' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Car size={13} />
            Todos ({drivers.length})
          </button>
        </div>
      </div>

      {/* Lista Principal de Auditoria */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-12 text-center bg-slate-900/60 rounded-3xl border border-slate-800 space-y-3">
            <RefreshCw size={28} className="animate-spin text-amber-500 mx-auto" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              A carregar telemetria e sessões dos motoristas...
            </p>
          </div>
        ) : filteredDrivers.length === 0 ? (
          <div className="p-12 text-center bg-slate-900/60 rounded-3xl border border-slate-800 space-y-3">
            <CheckCircle2 size={32} className="text-emerald-400 mx-auto" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Nenhum motorista encontrado nesta categoria
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {filterType === 'critical' 
                ? 'Excelente! Não há nenhum motorista com sessão aberta após o encerramento do turno.'
                : 'Não foram encontrados registos correspondentes aos critérios selecionados.'}
            </p>
          </div>
        ) : (
          filteredDrivers.map(driver => {
            const hasSession = checkHasActiveSession(driver);
            const shiftEnded = checkIsShiftEnded(driver);
            const shiftActive = checkIsShiftActive(driver);
            const isCritical = hasSession && shiftEnded;
            const isGhost = shiftActive && !hasSession;

            return (
              <div 
                key={driver.id}
                className={`p-5 rounded-2xl border transition-all ${
                  isCritical
                    ? 'bg-slate-900/90 border-rose-500/50 hover:border-rose-500 shadow-lg shadow-rose-950/20'
                    : isGhost
                    ? 'bg-slate-900/90 border-amber-500/50 hover:border-amber-500'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  
                  {/* Bloco de Dados do Motorista & Viatura */}
                  <div className="flex items-start gap-3.5">
                    <div className="relative">
                      {driver.photo ? (
                        <img 
                          src={driver.photo} 
                          alt={driver.name} 
                          className="w-12 h-12 rounded-2xl object-cover border-2 border-slate-700 shadow-md" 
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-amber-400 font-black text-base shadow-md">
                          {driver.prefix ? driver.prefix.slice(-2) : 'TX'}
                        </div>
                      )}

                      {/* Dot de Sessão */}
                      <div 
                        className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-950 flex items-center justify-center ${
                          hasSession ? 'bg-emerald-500' : 'bg-slate-600'
                        }`}
                        title={hasSession ? 'Sessão Ativa no Dispositivo' : 'Sessão Inativa'}
                      >
                        <Smartphone size={8} className="text-slate-950" />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-black uppercase tracking-wider">
                          Viatura {driver.prefix || 'N/A'}
                        </span>
                        <h3 className="text-sm font-black text-white">
                          {driver.name || 'Motorista sem nome'}
                        </h3>
                        {driver.plate && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            ({driver.plate})
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold flex items-center gap-1">
                          <Building2 size={11} className="text-amber-400 shrink-0" />
                          <span>{getTenantName(driver.tenantId || (driver as any).tenant || (driver as any).companyId)}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Phone size={12} className="text-slate-500" />
                          <a href={`tel:${driver.phone || ''}`} className="hover:text-amber-400 transition-colors">
                            {driver.phone || '+244 ...'}
                          </a>
                        </span>
                        <span className="text-slate-700">•</span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} className="text-slate-500" />
                          Última Atividade: <strong className="text-slate-300">{formattedTime(driver.lastActiveAt)}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Indicadores Visuais de Estado Incompatível */}
                  <div className="flex items-center gap-3 flex-wrap bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                    
                    {/* Badge Sessão */}
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-0.5">
                        Estado da Sessão
                      </span>
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                        hasSession 
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        <Smartphone size={12} />
                        {hasSession ? 'Sessão Ativa (Logado)' : 'Desconectado'}
                      </span>
                    </div>

                    <span className="text-slate-700 font-bold hidden sm:inline">↔</span>

                    {/* Badge Turno */}
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-0.5">
                        Estado do Turno
                      </span>
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                        shiftEnded 
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        <Power size={12} />
                        {shiftEnded ? 'Turno Encerrado' : 'Turno Ativo'}
                      </span>
                    </div>
                  </div>

                  {/* Botões de Ação de Suporte Remoto para o Administrador */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    
                    {/* Botão 1: Force Logout (Para Conflito Crítico) */}
                    {hasSession && (
                      <button
                        onClick={() => handleForceLogoutSession(driver)}
                        disabled={processingDriverId === driver.id}
                        className="px-3 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md disabled:opacity-50"
                        title="Encerrar sessão remota deste motorista"
                      >
                        <LogOut size={14} />
                        {processingDriverId === driver.id ? 'A Desconectar...' : 'Desconectar Sessão'}
                      </button>
                    )}

                    {/* Botão 2: Reactivate Shift */}
                    {shiftEnded && (
                      <button
                        onClick={() => handleReactivateShift(driver)}
                        disabled={processingDriverId === driver.id}
                        className="px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md disabled:opacity-50"
                        title="Reabrir turno do motorista"
                      >
                        <Power size={14} />
                        Reabrir Turno
                      </button>
                    )}

                    {/* Botão 3: Clean State Reset */}
                    <button
                      onClick={() => handleFullStateReset(driver)}
                      disabled={processingDriverId === driver.id}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 border border-slate-700 text-xs transition-all"
                      title="Reset Limpo de Estado (Sessão & Turno Inativos)"
                    >
                      <RefreshCw size={14} />
                    </button>

                    {/* Botão 4: Notify / Remote Message */}
                    <button
                      onClick={() => setSelectedDriverForMsg(driver)}
                      className="p-2 rounded-xl bg-violet-600/20 hover:bg-violet-600 text-violet-300 hover:text-white border border-violet-500/40 text-xs transition-all"
                      title="Enviar instrução de suporte ao ecran do motorista"
                    >
                      <MessageSquare size={14} />
                    </button>
                  </div>
                </div>

                {/* Explicador do Diagnóstico em destaque se for crítico */}
                {isCritical && (
                  <div className="mt-3 pt-3 border-t border-rose-500/20 flex items-center justify-between text-[11px] text-rose-300 gap-2 flex-wrap bg-rose-950/20 -mx-5 -mb-5 p-3 rounded-b-2xl">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={14} className="text-rose-400 shrink-0" />
                      <span>
                        <strong>Incompatibilidade de Estado:</strong> O motorista terminou o turno na aplicação mas a sessão permanece ativa. Recomenda-se clicar em <strong>"Desconectar Sessão"</strong>.
                      </span>
                    </div>
                    {driver.lastShiftEndedAt && (
                      <span className="text-[10px] text-slate-400">
                        Encerrado às: {formattedTime(driver.lastShiftEndedAt)} {driver.lastShiftEndedBy ? `por ${driver.lastShiftEndedBy}` : ''}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Histórico Recente de Intervenções de Suporte Auditoria */}
      {auditLogs.length > 0 && (
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Clock size={14} className="text-amber-400" />
              Histórico de Ações de Auditoria e Suporte Remoto
            </h3>
            <span className="text-[10px] font-mono text-slate-500">Últimos {auditLogs.length} registos</span>
          </div>

          <div className="divide-y divide-slate-800/60 max-h-48 overflow-y-auto pr-1">
            {auditLogs.map(log => (
              <div key={log.id} className="py-2.5 flex items-center justify-between text-[11px] gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-400 font-mono font-bold text-[9px] uppercase">
                    {log.prefix || 'FROTA'}
                  </span>
                  <span className="font-bold text-white">{log.driverName}</span>
                  <span className="text-slate-400">• {log.details}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500 shrink-0 font-mono">
                  <span>{log.operator}</span>
                  <span>{formattedTime(log.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal para Enviar Mensagem de Suporte Remoto */}
      {selectedDriverForMsg && (
        <div className="fixed inset-0 z-[999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-violet-600/20 text-violet-400 flex items-center justify-center">
                  <LifeBuoy size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-white">Instrução Remota de Suporte</h3>
                  <p className="text-[10px] text-slate-400">Enviar ao telemóvel do motorista {selectedDriverForMsg.prefix}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedDriverForMsg(null)}
                className="text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
                <p className="font-bold text-amber-400">{selectedDriverForMsg.prefix} • {selectedDriverForMsg.name}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Contacto: {selectedDriverForMsg.phone || 'Sem número'}</p>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Mensagem de Instrução / Alerta para o Ecran:
                </label>
                <textarea
                  rows={4}
                  value={remoteMsgText}
                  onChange={e => setRemoteMsgText(e.target.value)}
                  placeholder="Ex: Caro motorista, detetamos que o seu turno foi encerrado mas a sessão continua aberta. Por favor feche a app e volte a entrar para sincronizar."
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              {/* Botões pré-definidos de instrução rápida */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setRemoteMsgText('Aviso: Por favor feche e volte a abrir a aplicação SUPER Táxi para sincronizar o seu turno encerrado.')}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 font-medium"
                >
                  + Reiniciar App
                </button>
                <button
                  type="button"
                  onClick={() => setRemoteMsgText('Alerta Suporte: O seu turno foi encerrado no sistema central. Caso precise reabrir, contacte o operador.')}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 font-medium"
                >
                  + Turno Encerrado
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedDriverForMsg(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSendRemoteMessage}
                disabled={isSendingMsg || !remoteMsgText.trim()}
                className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 disabled:opacity-50"
              >
                <Send size={14} />
                {isSendingMsg ? 'A Enviar...' : 'Enviar Instrução'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md overflow-y-auto p-4 sm:p-6 lg:p-8 flex items-center justify-center">
        <div className="bg-slate-950 border border-slate-800 rounded-3xl max-w-6xl w-full p-6 shadow-2xl my-8">
          {containerContent}
        </div>
      </div>
    );
  }

  return containerContent;
}
