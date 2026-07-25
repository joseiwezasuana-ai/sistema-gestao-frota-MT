import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  DollarSign, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  ArrowUpRight, 
  Search, 
  Filter, 
  MoreVertical,
  TrendingUp,
  User,
  Truck,
  CreditCard,
  Banknote,
  ArrowRightLeft,
  ArrowDownCircle,
  Info,
  ShieldCheck,
  Download,
  FileText,
  Loader2,
  Printer,
  Trash2,
  BarChart3,
  Bell,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { InvoiceViewerModal } from './InvoiceViewerModal';
import { DriverRevenueAnalysisModal } from './DriverRevenueAnalysisModal';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, where, addDoc, getDocs, deleteDoc, limit } from '@/src/lib/firebase';
import { cn } from '../lib/utils';

interface RevenueLog {
  id: string;
  driverId: string;
  driverName: string;
  prefix: string;
  amount: number;
  date: string;
  status: 'pending_approval' | 'approved_by_operator' | 'approved_by_accountant' | 'finalized' | 'rejected_by_operator' | 'rejected_by_accountant' | 'archived' | 'paid_to_staff';
  rejectionReason?: string;
  breakdown: {
    tpa: number;
    cash: number;
    transfer: number;
    expenses: number;
    appRides?: number;
  };
  timestamp: any;
  validatedAt?: string;
  validatedBy?: string;
  validatedByName?: string;
}

export default function RevenueManagement({ user }: { user: any }) {
  const [revenues, setRevenues] = useState<RevenueLog[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedDriver, setSelectedDriver] = useState('all');
  const [isProcessing, setIsProcessing] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [isRevenueAlertsModalOpen, setIsRevenueAlertsModalOpen] = useState(false);
  const [revenueMessages, setRevenueMessages] = useState<any[]>([]);
  const [analysisDriverId, setAnalysisDriverId] = useState<string | null>('all');
  const [archivedRevenues, setArchivedRevenues] = useState<RevenueLog[]>([]);

  const handleDeleteRevenueMessage = async (msgId: string) => {
    try {
      await deleteDoc(doc(db, 'messages', msgId));
    } catch (err) {
      console.error("Erro ao eliminar mensagem de tesouraria:", err);
    }
  };

  const handleDeleteAllRevenueMessages = async () => {
    if (!window.confirm("Tem a certeza que deseja ELIMINAR PERMANENTEMENTE todos os alertas críticos da tesouraria?")) return;
    try {
      for (const msg of revenueMessages) {
        await deleteDoc(doc(db, 'messages', msg.id));
      }
    } catch (err) {
      console.error("Erro ao eliminar todas as mensagens de tesouraria:", err);
    }
  };

  const handleOpenAnalysis = (driverId?: string) => {
    setAnalysisDriverId(driverId || 'all');
    setIsAnalysisModalOpen(true);
  };
  const [calls, setCalls] = useState<any[]>([]);
  const [smsLogs, setSmsLogs] = useState<any[]>([]);

  // Manual Revenue Declaration States
  const [isManualDeclareOpen, setIsManualDeclareOpen] = useState(false);
  const [manualDriverId, setManualDriverId] = useState('');
  const [manualPrefix, setManualPrefix] = useState('');
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualTpa, setManualTpa] = useState('');
  const [manualCash, setManualCash] = useState('');
  const [manualTransfer, setManualTransfer] = useState('');
  const [manualExpenses, setManualExpenses] = useState('');
  const [manualAppRides, setManualAppRides] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [activeFleetDrivers, setActiveFleetDrivers] = useState<any[]>([]);

  const isAdmin = user?.role === 'admin' || user?.role === 'gerente' || user?.email === 'joseiwezasuana@gmail.com';

  useEffect(() => {
    if (manualDriverId) {
      const selectedDrv = drivers.find(d => d.id === manualDriverId);
      const activeAssignment = activeFleetDrivers.find(
        fd => fd.driverId === manualDriverId || (selectedDrv && fd.name === selectedDrv.name)
      );

      if (activeAssignment && activeAssignment.prefix) {
        setManualPrefix(activeAssignment.prefix);
      } else if (selectedDrv) {
        const inferredPrefix = selectedDrv.prefix || selectedDrv.vehiclePrefix || (selectedDrv.vehicleLabel ? selectedDrv.vehicleLabel.split(' ')[0] : '');
        setManualPrefix(inferredPrefix || '');
      }

      // Automatically default date to today's local date
      if (!manualDate) {
        setManualDate(new Date().toISOString().split('T')[0]);
      }
    }
  }, [manualDriverId, drivers, activeFleetDrivers]);
  const isContabilista = user?.role === 'contabilista';
  const isOperator = user?.role === 'operator' || isAdmin;
  const isContabRole = isContabilista || isAdmin;

  useEffect(() => {
    // Fetch Revenues
    const q = query(collection(db, 'revenue_logs'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RevenueLog));
      
      // Accountant restriction: Only see revenues ready for their stage (approved by admin) or finalized/paid
      // @ts-ignore
      if (isContabilista && !isAdmin) {
        data = data.filter(r => ['approved_by_accountant', 'finalized', 'paid_to_staff'].includes(r.status));
      }
      
      setRevenues(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'revenue_logs');
    });

    // Fetch Drivers for Filter
    const qDrivers = query(collection(db, 'drivers_master'), orderBy('name', 'asc'));
    
    // Fetch Calls and SMS
    const qCalls = query(collection(db, 'calls'), orderBy('timestamp', 'desc'));
    const qSms = query(collection(db, 'sms_logs'), orderBy('timestamp', 'desc'));
    const qActiveFleet = query(collection(db, 'drivers'));

    const unsubscribeDrivers = onSnapshot(qDrivers, (snapshot) => {
      setDrivers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeCalls = onSnapshot(qCalls, (snapshot) => {
      setCalls(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeSms = onSnapshot(qSms, (snapshot) => {
      setSmsLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qRevenueMsgs = query(collection(db, 'messages'), orderBy('timestamp', 'desc'), limit(50));
    const unsubscribeActiveFleet = onSnapshot(qActiveFleet, (snapshot) => {
      setActiveFleetDrivers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeRevenueMsgs = onSnapshot(qRevenueMsgs, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const filtered = msgs.filter((m: any) => 
        ['revenue_operator_approved', 'revenue_delivered_to_accountant', 'revenue_approval', 'revenue_rejection'].includes(m.category) ||
        (m.title && (m.title.toLowerCase().includes('renda') || m.title.toLowerCase().includes('tesouraria')))
      );
      setRevenueMessages(filtered);
    });

    return () => {
      unsubscribe();
      unsubscribeDrivers();
      unsubscribeCalls();
      unsubscribeSms();
      unsubscribeActiveFleet();
      unsubscribeRevenueMsgs();
    };
  }, [isContabilista, isAdmin]);

  useEffect(() => {
    if (isHistoryModalOpen) {
      const q = query(
        collection(db, 'revenue_logs'), 
        orderBy('timestamp', 'desc')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RevenueLog));
        const filtered = logs.filter(log => ['archived', 'finalized', 'paid_to_staff'].includes(log.status));
        setArchivedRevenues(filtered);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'revenue_logs (archived)');
      });
      return () => unsubscribe();
    }
  }, [isHistoryModalOpen]);

  const handleStatusChange = async (revenueId: string, newStatus: string, reason?: string) => {
    setIsProcessing(true);
    setGlobalError(null);
    try {
      const revenue = revenues.find(r => r.id === revenueId);
      if (!revenue) return;

      const revRef = doc(db, 'revenue_logs', revenueId);
      const updateData: any = { 
        status: newStatus,
        validatedAt: new Date().toISOString(),
        validatedBy: user.uid,
        validatedByName: user.name
      };

      if (reason) {
        updateData.rejectionReason = reason;
      } else {
        updateData.rejectionReason = ""; // Clear reason if approving
      }

      await updateDoc(revRef, updateData);

      // Mark matching calls as approved/reverted based on status to synchronize driver view
      if (newStatus === 'approved_by_operator' || newStatus === 'approved_by_accountant' || newStatus === 'finalized') {
        try {
          const callsQuery = query(collection(db, 'calls'), where('revenueLogId', '==', revenueId));
          const callsSnap = await getDocs(callsQuery);
          for (const callDoc of callsSnap.docs) {
            await updateDoc(doc(db, 'calls', callDoc.id), {
              approvedByOperator: true,
              approvedAt: new Date().toISOString()
            });
          }
        } catch (callsErr) {
          console.warn("Error marking calls as approved:", callsErr);
        }
      } else if (newStatus.includes('rejected')) {
        try {
          const callsQuery = query(collection(db, 'calls'), where('revenueLogId', '==', revenueId));
          const callsSnap = await getDocs(callsQuery);
          for (const callDoc of callsSnap.docs) {
            await updateDoc(doc(db, 'calls', callDoc.id), {
              declared: false,
              revenueLogId: ""
            });
          }
        } catch (callsErr) {
          console.warn("Error reverting calls status for rejected revenue:", callsErr);
        }
      }

      // 1. Unbind driver if approved/rejected by operator (or finalized)
      if (newStatus === 'approved_by_operator' || newStatus === 'rejected_by_operator' || newStatus === 'finalized') {
        const q = query(collection(db, 'drivers'), where('driverId', '==', revenue.driverId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          for (const d of snap.docs) {
            await deleteDoc(doc(db, 'drivers', d.id));
          }
        } else {
          // Fallback to name if driverId wasn't stored (for older records)
          const qByName = query(collection(db, 'drivers'), where('name', '==', revenue.driverName));
          const snapByName = await getDocs(qByName);
          for (const d of snapByName.docs) {
            await deleteDoc(doc(db, 'drivers', d.id));
          }
        }

        // Notify driver of approval (ONLY when approved by operator to avoid duplicates)
        if (revenue.driverId && newStatus === 'approved_by_operator') {
          await addDoc(collection(db, 'messages'), {
            type: 'success',
            category: 'revenue_approval',
            title: 'Renda Aprovada',
            content: `A sua renda do dia ${revenue.date} foi validada com sucesso pelo profissional operador. Obrigado!`,
            targets: [revenue.driverId],
            driverId: revenue.driverId,
            prefix: revenue.prefix,
            status: 'unread',
            timestamp: new Date().toISOString()
          });
        }
      }

      // 2. Notify Admin & Gerente when Operator approves revenue
      if (newStatus === 'approved_by_operator') {
        await addDoc(collection(db, 'messages'), {
          type: 'alert',
          category: 'revenue_operator_approved',
          title: '🚨 Renda Validada pelo Operador',
          content: `A renda do dia ${revenue.date} (Viatura ${revenue.prefix || 'N/A'} - ${revenue.driverName || 'Motorista'}) no valor de ${Number(revenue.amount || 0).toLocaleString()} Kz foi validada pelo operador (${user?.name || 'Operador'}) e aguarda aprovação do Admin/Gerente.`,
          targets: ['admin', 'gerente', 'administrator', 'manager'],
          targetRoles: ['admin', 'gerente'],
          driverId: revenue.driverId || 'N/A',
          prefix: revenue.prefix || 'N/A',
          revenueId: revenueId,
          status: 'unread',
          timestamp: new Date().toISOString()
        });
      }

      // 3. Notify Contabilista when Admin/Gerente approves & delivers revenue to Accountant
      if (newStatus === 'approved_by_accountant') {
        await addDoc(collection(db, 'messages'), {
          type: 'info',
          category: 'revenue_delivered_to_accountant',
          title: '💰 Renda Entregue ao Contabilista',
          content: `O Admin/Gerente (${user?.name || 'Admin'}) entregou a renda do dia ${revenue.date} (Viatura ${revenue.prefix || 'N/A'} - ${revenue.driverName || 'Motorista'}) no valor de ${Number(revenue.amount || 0).toLocaleString()} Kz para auditoria e encerramento contabilístico.`,
          targets: ['contabilista', 'admin', 'gerente'],
          targetRoles: ['contabilista'],
          driverId: revenue.driverId || 'N/A',
          prefix: revenue.prefix || 'N/A',
          revenueId: revenueId,
          status: 'unread',
          timestamp: new Date().toISOString()
        });
      }

      // 2. Notify driver if rejected
      if (newStatus.includes('rejected')) {
        await addDoc(collection(db, 'messages'), {
          type: 'alert',
          category: 'revenue_rejection',
          title: 'Renda Reprovada',
          content: `A sua renda do dia ${revenue.date} foi reprovada. Motivo: ${reason || 'Não especificado'}. Por favor, verifique e corrija os dados.`,
          targets: [revenue.driverId],
          driverId: revenue.driverId,
          prefix: revenue.prefix,
          status: 'unread',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error: any) {
      console.error("Revenue Status Change Error:", error);
      let errorMessage = "Ocorreu um erro ao atualizar o estado da renda.";
      try {
        const parsed = JSON.parse(error.message);
        if (parsed.error.includes('permission-denied')) {
          errorMessage = "Erro de Permissão: O seu utilizador não tem autorização para validar esta renda.";
        } else if (parsed.error.includes('index')) {
          errorMessage = "O Firebase está a configurar a base de dados. Tente novamente em 2-3 minutos.";
        } else {
          errorMessage = "Erro técnico: " + (parsed.error || "Desconhecido");
        }
      } catch {
        errorMessage = "Erro: " + error.message;
      }
      setGlobalError(errorMessage);
      handleFirestoreError(error, OperationType.UPDATE, `revenue_logs/${revenueId}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (revenueId: string, currentStatus: string) => {
    const reason = window.prompt("Porquê está a reprovar esta renda? (Opcional)");
    if (reason === null) return; // Cancelled prompt
    
    const nextStatus = currentStatus === 'approved_by_accountant' ? 'rejected_by_accountant' : 'rejected_by_operator';
    handleStatusChange(revenueId, nextStatus, reason);
  };

  const handleResetCycle = async () => {
    if (!isAdmin) return;
    if (!confirm('Deseja zerar o ciclo atual? Todos os registos ativos (pendentes e finalizados) serão movidos para o histórico (archived).')) return;
    
    setIsProcessing(true);
    try {
      // Archive everything that isn't already archived
      // @ts-ignore
      const toArchive = revenues.filter(r => r.status !== 'archived');
      for (const rev of toArchive) {
        await updateDoc(doc(db, 'revenue_logs', rev.id), { status: 'archived' });
      }
      alert('Ciclo reiniciado com sucesso! Registos arquivados.');
    } catch (error) {
      console.error(error);
      alert('Erro ao reiniciar ciclo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteArchive = async () => {
    if (!isAdmin) return;
    if (!confirm('Deseja eliminar permanentemente TODOS os registos arquivados? Esta ação é irreversível.')) return;
    
    setIsProcessing(true);
    try {
      for (const rev of archivedRevenues) {
        await deleteDoc(doc(db, 'revenue_logs', rev.id));
      }
      alert('Arquivo limpo com sucesso!');
      setIsHistoryModalOpen(false);
    } catch (error) {
      console.error(error);
      alert('Erro ao eliminar arquivo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteSingleArchive = async (revenueId: string) => {
    if (!isAdmin) return;
    if (!confirm('Deseja eliminar este registo? Esta ação é irreversível.')) return;
    
    try {
      await deleteDoc(doc(db, 'revenue_logs', revenueId));
      alert('Registo eliminado!');
    } catch (error) {
      console.error(error);
      alert('Erro ao eliminar registo.');
    }
  };

  const handleManualDeclareSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualDriverId) {
      setGlobalError("Por favor, selecione um motorista.");
      return;
    }
    if (!manualPrefix) {
      setGlobalError("Por favor, introduza o prefixo da viatura.");
      return;
    }

    const tpa = parseFloat(manualTpa) || 0;
    const cash = parseFloat(manualCash) || 0;
    const transfer = parseFloat(manualTransfer) || 0;
    const expenses = parseFloat(manualExpenses) || 0;
    const appRides = parseFloat(manualAppRides) || 0;

    const total = tpa + cash + transfer - expenses;

    setIsProcessing(true);
    setGlobalError(null);

    try {
      const selectedDrv = drivers.find(d => d.id === manualDriverId);
      const driverName = selectedDrv ? selectedDrv.name : "Motorista Manual";

      const revenueData = {
        driverId: manualDriverId,
        driverName: driverName,
        prefix: manualPrefix,
        amount: total,
        breakdown: {
          tpa,
          cash,
          transfer,
          expenses,
          appRides
        },
        description: manualDescription || "Declarado manualmente pelo Administrador",
        date: manualDate,
        status: "approved_by_operator", // Direct to Operator approved (Pendente Admin)
        timestamp: new Date().toISOString(),
        rejectionReason: ""
      };

      await addDoc(collection(db, 'revenue_logs'), revenueData);

      // Unlink driver from active assignments ('drivers' collection) since manual declaration goes direct as approved
      try {
        const qActive = query(collection(db, 'drivers'), where('driverId', '==', manualDriverId));
        const snapActive = await getDocs(qActive);
        if (!snapActive.empty) {
          for (const d of snapActive.docs) {
            await deleteDoc(doc(db, 'drivers', d.id));
          }
        } else {
          const qByName = query(collection(db, 'drivers'), where('name', '==', driverName));
          const snapByName = await getDocs(qByName);
          for (const d of snapByName.docs) {
            await deleteDoc(doc(db, 'drivers', d.id));
          }
        }
      } catch (unbindErr) {
        console.warn("Error unbinding driver on manual declare:", unbindErr);
      }

      alert("Renda declarada com sucesso pelo Administrador!");
      setIsManualDeclareOpen(false);
      
      // Reset form states
      setManualDriverId('');
      setManualPrefix('');
      setManualDate(new Date().toISOString().split('T')[0]);
      setManualTpa('');
      setManualCash('');
      setManualTransfer('');
      setManualExpenses('');
      setManualAppRides('');
      setManualDescription('');
    } catch (error: any) {
      console.error("Error declaring manual revenue:", error);
      setGlobalError("Erro ao declarar renda manualmente: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'pending_approval': return { label: 'Pendente Operador', color: 'bg-amber-50 text-amber-600 border-amber-100', icon: Clock };
      case 'rejected_by_operator': return { label: 'Reprovado Operador', color: 'bg-red-50 text-red-600 border-red-100', icon: XCircle };
      case 'rejected_by_accountant': return { label: 'Reprovado Contab.', color: 'bg-rose-50 text-rose-600 border-rose-100', icon: XCircle };
      case 'approved_by_operator': return { label: 'Pendente Admin', color: 'bg-blue-50 text-blue-600 border-blue-100', icon: Clock };
      case 'approved_by_accountant': return { label: 'Pendente Contab.', color: 'bg-purple-50 text-purple-600 border-purple-100', icon: Clock };
      case 'finalized': return { label: 'Finalizado (Auditado)', color: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: CheckCircle2 };
      case 'paid_to_staff': return { label: 'Pago (Histórico)', color: 'bg-slate-200 text-slate-500 border-slate-300', icon: ShieldCheck };
      default: return { label: status, color: 'bg-slate-50 text-slate-500', icon: Clock };
    }
  };

  const filteredRevenues = revenues.filter(rev => {
    const today = new Date().toISOString().split('T')[0];
    
    if (filter === 'all') {
      // Hide paid logs and finalized logs from previous days
      if (rev.status === 'paid_to_staff') return false;
      if (rev.status === 'finalized' && rev.date < today) return false;
    } else if (filter !== 'all' && rev.status !== filter) {
      return false;
    }
    
    const driverMatch = selectedDriver === 'all' || rev.driverId === selectedDriver || rev.driverName === selectedDriver;
    return driverMatch;
  });

  const canApproveOperator = (status: string) => (isOperator || isAdmin) && status === 'pending_approval';
  const canApproveAdmin = (status: string) => isAdmin && status === 'approved_by_operator';
  const canApproveAccountant = (status: string) => (isContabRole || isAdmin) && status === 'approved_by_accountant';

  const stats = {
    totalFinalized: revenues
      .filter(r => (r.status === 'finalized' || r.status === 'paid_to_staff'))
      .reduce((acc, curr) => acc + (curr.amount || 0), 0),
    totalProcess: revenues
      .filter(r => !['finalized', 'paid_to_staff', 'archived'].includes(r.status))
      .reduce((acc, curr) => acc + (curr.amount || 0), 0),
    totalExpenses: revenues
      .filter(r => r.status !== 'archived')
      .reduce((acc, curr) => acc + (curr.breakdown?.expenses || 0), 0),
    todayCount: revenues.filter(r => r.date === new Date().toISOString().split('T')[0] && r.status !== 'archived').length
  };

  const exportSingleTransactionReceipt = (rev: RevenueLog) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const receiptNo = `RCB-${(rev.id || '000000').slice(0, 8).toUpperCase()}`;
      const issueDate = new Date().toLocaleDateString('pt-PT', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });

      // Dark Blue Header Bar
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 210, 38, 'F');

      // Accent Line (Gold / Amber)
      doc.setFillColor(234, 179, 8); // amber-500
      doc.rect(0, 38, 210, 3, 'F');

      // Header Typography
      doc.setFontSize(15);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('JIS ANGOLA', 14, 16);

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(203, 213, 225); // slate-300
      doc.text('SUPER TÁXI • CENTRAL DE CONTABILIDADE E VALIDAÇÃO DE RECEITAS', 14, 23);
      doc.text('NIF: 5000984122 | Tel: +244 923 000 000 | Luena, Moxico - Angola', 14, 29);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(251, 191, 36); // amber-400
      doc.text(receiptNo, 196, 16, { align: 'right' });
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(203, 213, 225);
      doc.text(`Emissão: ${issueDate}`, 196, 23, { align: 'right' });

      // Document Title Banner
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.roundedRect(14, 48, 182, 18, 3, 3, 'FD');

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('RECIBO DE CAIXA & COMPROVATIVO DE RECEITA', 105, 57, { align: 'center' });
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`REGISTO OPERACIONAL DE TURNO DO DIA ${rev.date}`, 105, 62, { align: 'center' });

      // Transaction & Driver Summary Box
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(14, 72, 182, 38, 3, 3, 'FD');

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('DADOS DA TRANSAÇÃO & COLABORADOR', 20, 80);

      doc.setLineWidth(0.2);
      doc.setDrawColor(226, 232, 240);
      doc.line(20, 83, 190, 83);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      
      doc.text('Colaborador / Motorista:', 20, 90);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`${rev.driverName} (ID: ${rev.driverId || 'N/A'})`, 65, 90);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('Viatura / Prefixo:', 20, 97);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`${rev.prefix || 'N/A'}`, 65, 97);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('Estado de Validação:', 20, 104);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 185, 129); // emerald-600
      doc.text(`${getStatusDisplay(rev.status).label.toUpperCase()}`, 65, 104);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('Data do Fecho:', 130, 90);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`${rev.date}`, 160, 90);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('Validado Por:', 130, 97);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`${rev.validatedByName || rev.validatedBy || 'Central Operacional'}`, 160, 97);

      // Breakdown Table
      const breakdownRows = [
        ['Pagamento em Dinheiro Físico (Cash)', `${(rev.breakdown?.cash || 0).toLocaleString()} Kz`],
        ['Pagamento por TPA / Multicaixa', `${(rev.breakdown?.tpa || 0).toLocaleString()} Kz`],
        ['Transferência Bancária', `${(rev.breakdown?.transfer || 0).toLocaleString()} Kz`],
        ['Corridas via App (SUPER Táxi)', `${(rev.breakdown?.appRides || 0).toLocaleString()} Kz`],
        ['Dedução de Despesas Operacionais (-)', `- ${(rev.breakdown?.expenses || 0).toLocaleString()} Kz`]
      ];

      autoTable(doc, {
        startY: 116,
        head: [['Discriminação dos Valores / Meio de Pagamento', 'Montante (Kz)']],
        body: breakdownRows,
        theme: 'grid',
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9
        },
        bodyStyles: {
          fontSize: 9,
          textColor: [51, 65, 85]
        },
        columnStyles: {
          0: { cellWidth: 130 },
          1: { cellWidth: 52, halign: 'right', fontStyle: 'bold' }
        },
        margin: { left: 14, right: 14 }
      });

      const finalY = (doc as any).lastAutoTable.finalY + 8;

      // Total Amount Box
      doc.setFillColor(241, 245, 249); // slate-100
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(14, finalY, 182, 20, 3, 3, 'FD');

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('TOTAL LÍQUIDO ARRECADADO:', 20, finalY + 12);

      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 185, 129); // emerald-600
      doc.text(`${(rev.amount || 0).toLocaleString()} Kz`, 190, finalY + 12, { align: 'right' });

      // Quotas Breakdown
      const quotaY = finalY + 25;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, quotaY, 182, 20, 3, 3, 'FD');

      const jisShare = (rev.amount || 0) * 0.9;
      const driverShare = (rev.amount || 0) * 0.1;

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('Divisão Contábil Regulamentar:', 20, quotaY + 8);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(225, 29, 72); // rose-600
      doc.text(`Quota JIS (90%): ${jisShare.toLocaleString()} Kz`, 20, quotaY + 15);

      doc.setTextColor(16, 185, 129); // emerald-600
      doc.text(`Comissão Colaborador (10%): ${driverShare.toLocaleString()} Kz`, 110, quotaY + 15);

      // Signatures Section
      const sigY = quotaY + 28;
      doc.setLineWidth(0.3);
      doc.setDrawColor(148, 163, 184); // slate-400

      doc.line(20, sigY + 16, 85, sigY + 16);
      doc.line(120, sigY + 16, 185, sigY + 16);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('O CONTABILISTA / OPERADOR', 52.5, sigY + 21, { align: 'center' });
      doc.text('O COLABORADOR / MOTORISTA', 152.5, sigY + 21, { align: 'center' });

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text('Carimbo & Assinatura Autorizada', 52.5, sigY + 25, { align: 'center' });
      doc.text('Assinatura de Conformidade', 152.5, sigY + 25, { align: 'center' });

      // Footer Watermark & Authenticity
      const footerY = 280;
      doc.setFillColor(248, 250, 252);
      doc.rect(0, footerY, 210, 17, 'F');

      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('Documento emitido eletronicamente pela Plataforma TaxiControl - JIS ANGOLA', 105, footerY + 6, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.text(`Autenticidade Verificada • Hash: SHA256-${Date.now().toString(36).toUpperCase()}`, 105, footerY + 11, { align: 'center' });

      doc.save(`Recibo_JIS_${rev.prefix || 'TAXA'}_${rev.date}_${(rev.id || '0').slice(0, 6)}.pdf`);
    } catch (err: any) {
      console.error('Error generating PDF receipt:', err);
      alert('Erro ao gerar o PDF do Recibo: ' + err.message);
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    const today = new Date().toLocaleDateString();
    
    doc.setFontSize(18);
    doc.text('PSM COMERCIAL LUENA MOXICO', 105, 15, { align: 'center' });
    doc.setFontSize(14);
    doc.text('Mapa de Validação de Receitas', 105, 25, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Data do Relatório: ${today}`, 105, 32, { align: 'center' });

    const tableData = filteredRevenues.map(rev => [
      rev.driverName,
      rev.prefix,
      rev.date,
      `${(rev.amount || 0).toLocaleString()} Kz`,
      getStatusDisplay(rev.status).label
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Colaborador', 'Viatura', 'Data', 'Saldo Líquido', 'Estado']],
      body: tableData,
    });

    doc.save(`receitas_psm_${Date.now()}.pdf`);
  };

  return (
    <div className="max-w-[1500px] mx-auto space-y-8 pb-20">
      {globalError && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <XCircle className="text-red-500" size={20} />
            <div>
              <p className="text-[10px] font-black text-red-700 uppercase tracking-widest">Alerta de Sistema</p>
              <p className="text-xs text-red-600 font-bold">{globalError}</p>
            </div>
          </div>
          <button 
            onClick={() => setGlobalError(null)}
            className="text-red-400 hover:text-red-600 transition-colors"
          >
            <XCircle size={18} />
          </button>
        </motion.div>
      )}
      <div className="bg-white px-10 py-10 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden flex flex-col lg:flex-row lg:items-center justify-between gap-8 group">
          <div className="absolute top-0 right-0 w-[40%] h-full bg-slate-50 border-l border-slate-100 -mr-20 rotate-12 -z-0 opacity-50 group-hover:rotate-6 transition-transform duration-1000" />
          
          <div className="relative z-10 flex items-center gap-8">
            <div className="w-20 h-20 bg-emerald-600 rounded-[2.5rem] flex items-center justify-center text-white shadow-2xl shadow-emerald-600/20 rotate-3 group-hover:rotate-0 transition-all duration-500">
               <Wallet size={40} />
            </div>
            <div>
              <h2 className="font-black text-4xl text-slate-900 tracking-tighter uppercase italic">
                Validação de Fluxos
              </h2>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em] mt-2 flex items-center gap-3">
                <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                CONCILIAÇÃO FINANCEIRA • PSM CORPORATE
              </p>
            </div>
          </div>

          {/* Action Buttons in the Header Card */}
          <div className="relative z-10 flex flex-wrap items-center gap-3">
            <button 
              onClick={() => setIsRevenueAlertsModalOpen(true)}
              className="px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-xl shadow-rose-600/20 cursor-pointer relative"
              title="Gestão de Alertas Críticos da Tesouraria"
            >
              <Bell size={16} />
              Alertas da Tesouraria
              {revenueMessages.length > 0 && (
                <span className="px-2 py-0.5 bg-white text-rose-600 font-black rounded-full text-[9px] animate-pulse">
                  {revenueMessages.length}
                </span>
              )}
            </button>
            <button 
              onClick={() => handleOpenAnalysis('all')}
              className="px-5 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-xl shadow-amber-500/20 cursor-pointer"
            >
              <BarChart3 size={16} />
              Análise de Receitas & Custos
            </button>
            <button 
              onClick={() => setIsManualDeclareOpen(true)}
              className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-xl shadow-emerald-600/20 cursor-pointer"
            >
              <ArrowUpRight size={16} />
              Declarar Renda
            </button>
            {isAdmin && (
              <button 
                onClick={handleResetCycle}
                disabled={isProcessing}
                className="px-5 py-3 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all flex items-center gap-2 border border-rose-100 italic"
              >
                {isProcessing ? <Clock className="animate-spin" size={14} /> : <XCircle size={14} />}
                Zerar Ciclo
              </button>
            )}
            <button 
              onClick={() => setIsHistoryModalOpen(true)}
              className="px-5 py-3 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2 border border-slate-200 hover:text-slate-900 group/hist"
            >
              <Clock size={16} className="group-hover/hist:rotate-[-45deg] transition-transform" /> 
              Ver Histórico
            </button>
          </div>

          <div className="relative z-10 flex items-center gap-10">
             <div className="text-right">
                <div className="flex items-center gap-2 justify-end mb-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado da Tesouraria</span>
                  <div className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(37,99,235,0.8)]" />
                </div>
                <p className="text-xl font-black text-slate-900 tracking-tight uppercase italic">
                  Fluxo Contínuo
                </p>
             </div>
             
             <div className="h-14 w-px bg-slate-200" />
             
             <div className="text-right">
                <div className="flex items-center gap-2 justify-end mb-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nível de Auditoria</span>
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                </div>
                <p className="text-xl font-black text-slate-900 tracking-tight uppercase italic text-emerald-600">
                  Total
                </p>
             </div>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { 
            label: 'Cofre Finalizado (Mês)', 
            value: (stats.totalFinalized || 0).toLocaleString() + ' Kz', 
            subValue: `Plataforma (90%): ${(stats.totalFinalized * 0.9).toLocaleString()} Kz | Motorista (10%): ${(stats.totalFinalized * 0.1).toLocaleString()} Kz`,
            color: 'text-emerald-600', 
            border: 'border-emerald-500', 
            icon: ShieldCheck 
          },
          { 
            label: 'Processando (Mês)', 
            value: (stats.totalProcess || 0).toLocaleString() + ' Kz', 
            subValue: `Plataforma (90%): ${(stats.totalProcess * 0.9).toLocaleString()} Kz | Motorista (10%): ${(stats.totalProcess * 0.1).toLocaleString()} Kz`,
            color: 'text-amber-500', 
            border: 'border-amber-500', 
            icon: Clock 
          },
          { 
            label: 'Despesas (Mês)', 
            value: (stats.totalExpenses || 0).toLocaleString() + ' Kz', 
            subValue: 'Custos Operacionais do período',
            color: 'text-rose-600', 
            border: 'border-rose-500', 
            icon: ArrowDownCircle 
          },
          { 
            label: 'Registos Hoje', 
            value: stats.todayCount.toString(), 
            subValue: 'Declarações recebidas hoje',
            color: 'text-brand-primary', 
            border: 'border-brand-primary', 
            icon: TrendingUp 
          },
        ].map((s, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className={cn("bg-white p-7 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden transition-all group hover:shadow-xl", s.border.replace('border-', 'hover:border-'))}
          >
            <div className="flex justify-between items-start mb-6">
               <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-current transition-colors">
                 <s.icon size={20} />
               </div>
               <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Live Sync</span>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{s.label}</p>
            <p className={cn("text-2xl font-black tracking-tighter", s.color)}>{s.value}</p>
            {s.subValue && (
              <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 leading-tight">{s.subValue}</p>
            )}
          </motion.div>
        ))}
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden group">
        <div className="px-10 py-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between bg-slate-50/50 gap-6">
          <div className="flex items-center gap-6">
             <div className="p-3 bg-white border border-slate-200 rounded-xl">
               <Filter size={18} className="text-slate-400" />
             </div>
             <div className="flex gap-2 p-1.5 bg-white border border-slate-200 rounded-2xl">
                {['all', 'pending_approval', 'approved_by_operator', 'approved_by_accountant', 'finalized', 'rejected_by_operator', 'rejected_by_accountant', 'paid_to_staff'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                      filter === f ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-900 hover:bg-slate-50"
                    )}
                  >
                    {f === 'all' ? 'Ativos' : f === 'paid_to_staff' ? 'Histórico' : f.includes('rejected') ? 'Reprovado' : f.split('_')[0]}
                  </button>
                ))}
             </div>
             <button 
                onClick={exportPDF}
                className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2 shadow-xl shadow-black/10"
              >
                <Download size={16} /> PDF
              </button>
          </div>
          <div className="flex items-center gap-4 bg-white border border-slate-200 px-6 py-3 rounded-[1.25rem] shadow-sm">
             <User size={16} className="text-brand-primary" />
             <select 
               value={selectedDriver}
               onChange={(e) => setSelectedDriver(e.target.value)}
               className="bg-transparent border-none text-[10px] font-black text-slate-900 outline-none uppercase tracking-widest cursor-pointer"
             >
               <option value="all">Filtro por Colaborador</option>
               {drivers.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
             </select>
          </div>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                <th className="px-10 py-5">Colaborador / Viatura</th>
                <th className="px-10 py-5">Análise de Receitas & Custos</th>
                <th className="px-10 py-5">Faturamento da Viatura</th>
                <th className="px-10 py-5">Divisão (JIS 90% / Motorista 10%)</th>
                <th className="px-10 py-5 text-center">Protocolo de Aprovação</th>
                <th className="px-10 py-5 text-right">Acções Operacionais</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRevenues.map((rev) => {
                const { label, color, icon: StatusIcon } = getStatusDisplay(rev.status);
                return (
                  <tr key={rev.id} className="hover:bg-slate-50 transition-colors group/row">
                    <td className="px-10 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-bold group-hover/row:bg-brand-primary group-hover/row:text-white transition-all">
                           {rev.driverName[0]}
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{rev.driverName}</p>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">{rev.prefix} • <span className="italic">{rev.date}</span></p>
                          <button
                            onClick={() => handleOpenAnalysis(rev.driverId)}
                            className="mt-1.5 px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all border border-amber-500/20 cursor-pointer"
                          >
                            <BarChart3 size={12} />
                            Análise de Receitas & Custos
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-6">
                      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 min-w-[200px]">
                         <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">TPA:</span>
                            <span className="text-[11px] font-bold text-slate-700">{(rev.breakdown?.tpa || 0).toLocaleString()} Kz</span>
                         </div>
                         <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Dinheiro:</span>
                            <span className="text-[11px] font-bold text-slate-700">{(rev.breakdown?.cash || 0).toLocaleString()} Kz</span>
                         </div>
                         <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Transferência:</span>
                            <span className="text-[11px] font-bold text-slate-700">{(rev.breakdown?.transfer || 0).toLocaleString()} Kz</span>
                         </div>
                         {(rev.breakdown?.appRides ?? 0) > 0 && (
                           <div className="flex items-center justify-between border-t border-slate-50 pt-1.5 mt-1 col-span-2">
                             <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Saldo (App):</span>
                             <span className="text-[11px] font-black text-emerald-600">+{(rev.breakdown?.appRides || 0).toLocaleString()} Kz</span>
                           </div>
                         )}
                         {rev.breakdown?.expenses > 0 && (
                           <div className="flex items-center justify-between border-t border-slate-50 pt-1.5 mt-1 col-span-2">
                             <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Saídas / Despesas:</span>
                             <span className="text-[11px] font-black text-rose-600">-{rev.breakdown.expenses.toLocaleString()} Kz</span>
                           </div>
                         )}
                      </div>
                    </td>
                    <td className="px-10 py-6">
                       <p className="text-base font-black text-slate-900 tracking-tighter italic">
                         {(rev.amount || 0).toLocaleString()} <span className="text-[10px] uppercase font-bold opacity-60">Kz</span>
                       </p>
                    </td>
                    <td className="px-10 py-6">
                      <div className="text-[11px] font-bold uppercase tracking-tight space-y-0.5">
                        <p className="text-rose-600">JIS (90%): <span className="font-black font-mono">{((rev.amount || 0) * 0.9).toLocaleString()} Kz</span></p>
                        <p className="text-emerald-600">Motorista (10%): <span className="font-black font-mono">{((rev.amount || 0) * 0.1).toLocaleString()} Kz</span></p>
                      </div>
                    </td>
                    <td className="px-10 py-6 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={cn("inline-flex items-center gap-2 px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-[0.1em] border transition-all", color)}>
                          <StatusIcon size={12} className={cn(status !== 'finalized' && status !== 'paid_to_staff' && "animate-pulse")} /> {label}
                        </span>
                        {rev.rejectionReason && (
                          <p className="text-[9px] text-red-500 font-bold max-w-[120px] truncate italic" title={rev.rejectionReason}>
                            Motivo: {rev.rejectionReason}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-10 py-6 text-right">
                      <div className="flex justify-end gap-3 items-center">
                        <button 
                          onClick={() => exportSingleTransactionReceipt(rev)}
                          className="px-3.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center gap-1.5 transition-all shadow-sm active:scale-95 shrink-0 cursor-pointer"
                          title="Exportar Recibo em PDF"
                        >
                          <Download size={13} className="text-amber-600" />
                          Exportar Recibo
                        </button>
                        {canApproveOperator(rev.status) && (
                          <>
                            <button 
                              onClick={() => handleReject(rev.id, rev.status)}
                              className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-100 transition-all"
                            >
                              Reprovar
                            </button>
                            <button 
                              onClick={() => handleStatusChange(rev.id, 'approved_by_operator')}
                              className="bg-brand-primary text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-blue-600/20 active:scale-95 transition-all hover:bg-blue-700"
                            >
                              Validar Operador
                            </button>
                          </>
                        )}
                        {canApproveAdmin(rev.status) && (
                          <>
                            <button 
                              onClick={() => handleReject(rev.id, rev.status)}
                              className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-100 transition-all"
                            >
                              Reprovar
                            </button>
                            <button 
                              onClick={() => handleStatusChange(rev.id, 'approved_by_accountant')}
                              className="bg-purple-600 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-purple-600/20 active:scale-95 transition-all hover:bg-purple-700"
                            >
                              Entregar Contab.
                            </button>
                          </>
                        )}
                        {canApproveAccountant(rev.status) && (
                          <>
                            <button 
                              onClick={() => handleReject(rev.id, rev.status)}
                              className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-100 transition-all"
                            >
                              Reprovar
                            </button>
                            <button 
                              onClick={() => handleStatusChange(rev.id, 'finalized')}
                              className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-emerald-500/20 active:scale-95 transition-all hover:bg-emerald-700"
                            >
                              Auditar & Finalizar
                            </button>
                          </>
                        )}
                        {rev.status === 'finalized' && (
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-100 italic font-black shadow-inner">
                              <CheckCircle2 size={24} />
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {/* Archived Records Modal */}
      <AnimatePresence>
        {isHistoryModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHistoryModalOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-6xl overflow-hidden flex flex-col h-[85vh]"
            >
              <div className="px-10 py-8 bg-slate-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center">
                    <Clock size={28} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black uppercase italic tracking-tight">Arquivo Histórico de Rendas</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Registos de Ciclos Encerrados & Auditados</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="w-12 h-12 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors"
                >
                  <XCircle size={32} />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-10 custom-scrollbar">
                {archivedRevenues.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-20 grayscale opacity-40">
                    <Clock size={64} className="text-slate-300" />
                    <p className="text-sm font-black text-slate-500 uppercase tracking-widest italic">Nenhum registo arquivado encontrado</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-200">
                        <th className="px-8 py-5">Colaborador / Viatura</th>
                        <th className="px-8 py-5">Registos & Breakdown</th>
                        <th className="px-8 py-5">Líquido PSM</th>
                        <th className="px-8 py-5">Comunicações</th>
                        <th className="px-8 py-5">Data Fecho</th>
                        <th className="px-8 py-5 text-right">Acções</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {archivedRevenues.map((rev) => {
                        const driverCalls = calls.filter(c => c.driverId === rev.driverId || c.driverName === rev.driverName);
                        // Filter calls for this specific date
                        const dailyCalls = driverCalls.filter(c => {
                          const callDate = c.timestamp?.toDate ? c.timestamp.toDate().toISOString().split('T')[0] : new Date(c.timestamp).toISOString().split('T')[0];
                          return callDate === rev.date;
                        });
                        const driverSms = smsLogs.filter(s => s.driverId === rev.driverId);
                        const dailySms = driverSms.filter(s => {
                          const smsDate = s.timestamp?.toDate ? s.timestamp.toDate().toISOString().split('T')[0] : new Date(s.timestamp).toISOString().split('T')[0];
                          return smsDate === rev.date;
                        });

                        return (
                        <tr key={rev.id} className="hover:bg-slate-50 transition-colors group/arch">
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-[10px] font-black text-slate-400 uppercase">
                                {rev.driverName[0]}
                              </div>
                              <div>
                                <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{rev.driverName}</p>
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{rev.prefix}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[9px] font-bold text-slate-500 uppercase tracking-tight">
                              <span>TPA: {(rev.breakdown?.tpa || 0).toLocaleString()} Kz</span>
                              <span>Din: {(rev.breakdown?.cash || 0).toLocaleString()} Kz</span>
                              <span>Trans: {(rev.breakdown?.transfer || 0).toLocaleString()} Kz</span>
                              {(rev.breakdown?.appRides ?? 0) > 0 && <span>App: {(rev.breakdown?.appRides || 0).toLocaleString()} Kz</span>}
                              <span className="text-rose-500 italic">Desp: {(rev.breakdown?.expenses || 0).toLocaleString()} Kz</span>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <span className="text-sm font-black text-emerald-700 italic">{(rev.amount || 0).toLocaleString()} Kz</span>
                          </td>
                          <td className="px-8 py-6">
                              <div className="flex flex-col gap-1 text-[9px] font-bold text-slate-500 uppercase tracking-tight">
                                <span>📞 {dailyCalls.length} Chamadas</span>
                                <span>💬 {dailySms.length} Alertas SMS</span>
                              </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-2 text-slate-400">
                               <Calendar size={12} />
                               <span className="text-[10px] font-black uppercase tracking-tight">{rev.date}</span>
                            </div>
                          </td>
                          <td className="px-8 py-6 text-right">
                             <div className="flex items-center justify-end gap-4 text-[10px] font-black text-slate-400 uppercase italic">
                                <button 
                                  onClick={() => exportSingleTransactionReceipt(rev)}
                                  className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center gap-1 transition-all cursor-pointer"
                                  title="Exportar Recibo em PDF"
                                >
                                  <Download size={12} className="text-amber-600" />
                                  Recibo
                                </button>
                                <button 
                                  onClick={() => handleDeleteSingleArchive(rev.id)}
                                  className="text-rose-500 hover:text-rose-700 p-2 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="Eliminar registo"
                                >
                                  <Trash2 size={16} />
                                </button>
                                <div className="flex items-center gap-2">
                                  <CheckCircle2 size={14} className="text-emerald-500" />
                                  Arquivado
                                </div>
                             </div>
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                )}
              </div>
              
              <div className="px-10 py-6 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
                <div className="flex gap-10">
                   <div className="flex flex-col">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Arquivado Bruto</span>
                      <span className="text-lg font-black text-slate-900 italic tracking-tighter">
                         {archivedRevenues.reduce((acc, curr) => acc + (curr.breakdown?.tpa || 0) + (curr.breakdown?.cash || 0) + (curr.breakdown?.transfer || 0), 0).toLocaleString()} Kz
                      </span>
                   </div>
                   <div className="flex flex-col">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Despesas Arquivadas</span>
                      <span className="text-lg font-black text-rose-600 italic tracking-tighter">
                         {archivedRevenues.reduce((acc, curr) => acc + (curr.breakdown?.expenses || 0), 0).toLocaleString()} Kz
                      </span>
                   </div>
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={handleDeleteArchive}
                    disabled={isProcessing || archivedRevenues.length === 0}
                    className="px-6 py-3 bg-rose-50 text-rose-600 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all border border-rose-100 disabled:opacity-50"
                  >
                    {isProcessing ? 'A eliminar...' : 'Eliminar Arquivo'}
                  </button>
                  <button 
                    onClick={() => setIsHistoryModalOpen(false)}
                    className="px-10 py-3 bg-slate-900 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-black/20"
                  >
                    Fechar Arquivo
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manual Revenue Declaration Modal */}
      <AnimatePresence>
        {isManualDeclareOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsManualDeclareOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="px-10 py-8 bg-slate-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center">
                    <Wallet size={28} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black uppercase italic tracking-tight">Declaração Manual de Renda</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Lançamento Administrativo Directo (JIS ANGOLA)</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsManualDeclareOpen(false)}
                  className="w-12 h-12 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors"
                >
                  <XCircle size={32} />
                </button>
              </div>

              <form onSubmit={handleManualDeclareSubmit} className="flex-1 overflow-auto p-10 space-y-6 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Select Driver */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Colaborador / Motorista</label>
                    <select
                      value={manualDriverId}
                      onChange={(e) => setManualDriverId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    >
                      <option value="">Selecione o Motorista...</option>
                      {drivers.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name} {d.vehicleLabel ? `(${d.vehicleLabel})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Prefix (Viatura) */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Prefixo da Viatura</label>
                    <input
                      type="text"
                      placeholder="Ex: TX-01"
                      value={manualPrefix}
                      onChange={(e) => setManualPrefix(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>

                  {/* Date of Declaration */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Data da Renda</label>
                    <input
                      type="date"
                      value={manualDate}
                      onChange={(e) => setManualDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>

                  {/* Description / Notes */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Observações</label>
                    <input
                      type="text"
                      placeholder="Declaração manual pelo Admin"
                      value={manualDescription}
                      onChange={(e) => setManualDescription(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="h-px bg-slate-100" />

                <div className="space-y-4">
                  <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest italic flex items-center gap-2">
                    <DollarSign size={14} className="text-emerald-600" />
                    Discriminação dos Valores de Entrada & Saída
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* TPA */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Multicaixa / TPA (Kz)</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={manualTpa}
                        onChange={(e) => setManualTpa(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-xs font-bold text-slate-850 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    {/* Cash */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Dinheiro Físico (Kz)</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={manualCash}
                        onChange={(e) => setManualCash(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-xs font-bold text-slate-850 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    {/* Transfer */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Transferência (Kz)</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={manualTransfer}
                        onChange={(e) => setManualTransfer(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-xs font-bold text-slate-850 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    {/* App Rides */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Corridas por App (Kz)</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={manualAppRides}
                        onChange={(e) => setManualAppRides(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-xs font-bold text-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    {/* Expenses */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Saídas / Despesas (Kz)</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={manualExpenses}
                        onChange={(e) => setManualExpenses(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-xs font-bold text-rose-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Live Preview Calculation */}
                {(() => {
                  const netTotal = (parseFloat(manualTpa) || 0) + (parseFloat(manualCash) || 0) + (parseFloat(manualTransfer) || 0) - (parseFloat(manualExpenses) || 0);
                  return (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total Líquido Estimado</span>
                        <span className={cn(
                          "text-3xl font-black tracking-tighter italic",
                          netTotal >= 0 ? "text-emerald-600" : "text-rose-600"
                        )}>
                          {netTotal.toLocaleString()} Kz
                        </span>
                      </div>
                      <div className="text-right border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-6 space-y-1">
                        <div>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-2">JIS (90%):</span>
                          <span className="text-xs font-black text-rose-600 font-mono">{(netTotal * 0.9).toLocaleString()} Kz</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-2">Motorista (10%):</span>
                          <span className="text-xs font-black text-emerald-600 font-mono">{(netTotal * 0.1).toLocaleString()} Kz</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Submit & Cancel Buttons */}
                <div className="pt-4 flex justify-end gap-4">
                  <button
                    type="button"
                    onClick={() => setIsManualDeclareOpen(false)}
                    className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-xl shadow-emerald-600/20"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        Declarando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} />
                        Declarar Renda
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Driver Revenue & Cost Analysis Modal */}
      <DriverRevenueAnalysisModal
        isOpen={isAnalysisModalOpen}
        onClose={() => setIsAnalysisModalOpen(false)}
        driverId={analysisDriverId}
        drivers={drivers}
        revenues={revenues}
      />

      {/* Treasury Critical Alerts Management Modal */}
      <AnimatePresence>
        {isRevenueAlertsModalOpen && (
          <div className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] p-8 max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 relative overflow-hidden"
            >
              <div className="flex items-center justify-between pb-6 border-b border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl shadow-sm">
                    <ShieldAlert size={28} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">
                      Alertas Críticos da Tesouraria
                    </h3>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">
                      Notificações de validação e entrega de rendas na base de dados
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsRevenueAlertsModalOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                >
                  <XCircle size={24} />
                </button>
              </div>

              {revenueMessages.length > 0 && (
                <div className="pt-4 flex justify-end">
                  <button
                    onClick={handleDeleteAllRevenueMessages}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Trash2 size={14} />
                    Eliminar Todos os Alertas da BD ({revenueMessages.length})
                  </button>
                </div>
              )}

              <div className="flex-1 overflow-y-auto py-6 space-y-4 no-scrollbar">
                {revenueMessages.length === 0 ? (
                  <div className="text-center py-16 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                    <CheckCircle2 size={40} className="mx-auto text-emerald-500 mb-3" />
                    <p className="text-sm font-black text-slate-700 uppercase tracking-tight">Sem Alertas Críticos Pendentes</p>
                    <p className="text-xs text-slate-400 mt-1 font-bold">Todas as notificações da tesouraria foram liquidadas e limpas.</p>
                  </div>
                ) : (
                  revenueMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className="p-5 bg-slate-50 border border-slate-200 rounded-2xl flex items-start justify-between gap-4 hover:border-slate-300 transition-all shadow-sm"
                    >
                      <div className="flex items-start gap-4 flex-1">
                        <div className="p-2.5 bg-rose-600 text-white rounded-xl shadow-md mt-0.5">
                          <Wallet size={20} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-900 uppercase italic">{msg.title || 'Alerta de Tesouraria'}</span>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                              {msg.timestamp?.toDate ? format(msg.timestamp.toDate(), 'dd/MM/yyyy HH:mm') : (msg.timestamp || 'Agora')}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 font-medium leading-relaxed mt-1">
                            {msg.content}
                          </p>
                          {msg.prefix && (
                            <span className="inline-block mt-2 px-2.5 py-0.5 bg-slate-200 text-slate-800 rounded-md text-[9px] font-black uppercase tracking-wider">
                              Viatura: {msg.prefix}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteRevenueMessage(msg.id)}
                        className="px-3 py-2 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all border border-rose-200 cursor-pointer shadow-sm"
                        title="Eliminar este alerta permanentemente da base de dados"
                      >
                        <Trash2 size={14} />
                        Eliminar
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setIsRevenueAlertsModalOpen(false)}
                  className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
