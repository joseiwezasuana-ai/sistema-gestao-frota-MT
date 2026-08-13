import React, { useState, useEffect } from "react";
import {
  Calculator,
  TrendingUp,
  FileText,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Calendar,
  Search,
  Filter,
  Users,
  CheckCircle2,
  Clock,
  Send,
  Loader2,
  ChevronRight,
  AlertCircle,
  ShieldCheck,
  Info,
  User,
  ArrowRightLeft,
  X,
  Plus,
  Trash2,
  Pencil,
  Printer,
  Package,
  Trophy,
  Award,
  Crown,
  Medal,
  Sparkles,
  Star,
  Zap,
  DollarSign,
  ShieldAlert,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { jsPDF } from "jspdf";
import html2canvas from 'html2canvas';
import { InvoiceViewerModal } from './InvoiceViewerModal';
import DriverDiscountsAudit, { DiscountAuditLog } from "./DriverDiscountsAudit";
import DriverSubsidiesAudit, { SubsidyAuditLog } from "./DriverSubsidiesAudit";
import { Gift } from "lucide-react";
import autoTable from "jspdf-autotable";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { db, handleFirestoreError, OperationType, getActiveTenantId } from "../lib/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  deleteDoc,
  writeBatch,
} from '@/src/lib/firebase';
import { cn } from "../lib/utils";
import RevenueManagement from "./RevenueManagement";
import InvoiceDrafting from "./InvoiceDrafting";

export default function AccountingManager({ user }: { user?: any }) {
  const [activeView, setActiveView] = useState<
    "revenue" | "income" | "salaries" | "individual" | "balance" | "invoicing" | "ranking" | "discounts_audit" | "subsidies_audit"
  >("income");
  const [currentMonth] = useState(new Date().toISOString().slice(0, 7));
  const [finalizedRevenues, setFinalizedRevenues] = useState<any[]>([]);
  const [allRevenues, setAllRevenues] = useState<any[]>([]);
  const [salarySheets, setSalarySheets] = useState<any[]>([]);
  const [individualReports, setIndividualReports] = useState<any[]>([]);
  const [driversMaster, setDriversMaster] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingReport, setEditingReport] = useState<string | null>(null);
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [selectedStaffForReport, setSelectedStaffForReport] =
    useState<string>("");
  const [detailedReportData, setDetailedReportData] = useState<any>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<any>(null);
  const [receiptMonth, setReceiptMonth] = useState("");
  const [isPrintingInvoice, setIsPrintingInvoice] = useState<string | null>(null);
  const [isInvoiceViewerOpen, setIsInvoiceViewerOpen] = useState(false);
  const [selectedInvoiceData, setSelectedInvoiceData] = useState<any>(null);
  const [activeTenantData, setActiveTenantData] = useState<{
    id: string;
    name: string;
    phone: string;
    address: string;
    logoUrl?: string;
  } | null>(null);

  // Estados e filtros para Classificação de Produção dos Motoristas (Ranking JIS)
  const [rankingSearchTerm, setRankingSearchTerm] = useState("");
  const [rankingPeriodFilter, setRankingPeriodFilter] = useState<"all" | "current_month">("current_month");

  // Estados e Log de Auditoria para Descontos dos Motoristas
  const [discountAuditLogs, setDiscountAuditLogs] = useState<DiscountAuditLog[]>(() => {
    try {
      const saved = localStorage.getItem('jis_discount_audit_logs_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Erro ao carregar auditoria de descontos:", e);
    }
    return [
      {
        id: "AUD-892101",
        driverId: "drv-1",
        driverName: "António Manuel",
        category: "manutencao",
        categoryLabel: "Manutenção / Reparação",
        amount: 5500,
        date: new Date().toISOString().slice(0, 10),
        timestamp: new Date().toISOString(),
        motive: "Substituição de pastilhas de travão por uso indevido.",
        registeredBy: "JIS Operações",
      },
      {
        id: "AUD-892102",
        driverId: "drv-2",
        driverName: "Mateus Domingos",
        category: "multas",
        categoryLabel: "Multa de Trânsito",
        amount: 3000,
        date: new Date().toISOString().slice(0, 10),
        timestamp: new Date().toISOString(),
        motive: "Excesso de velocidade na travessia Luena-Moxico (>80km/h).",
        registeredBy: "Auditoria Financeira",
      }
    ];
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('jis_discount_audit_logs_v1', JSON.stringify(discountAuditLogs));
    } catch (e) {
      console.error("Erro ao guardar auditoria de descontos:", e);
    }
  }, [discountAuditLogs]);

  const handleAddDiscountLog = (newLog: Omit<DiscountAuditLog, "id" | "timestamp">) => {
    const fullLog: DiscountAuditLog = {
      ...newLog,
      id: `AUD-${Math.floor(100000 + Math.random() * 900000)}`,
      timestamp: new Date().toISOString(),
    };

    setDiscountAuditLogs(prev => [fullLog, ...prev]);

    // Atualiza automaticamente o mapa customDriverDiscounts
    const key = (newLog.driverId || newLog.driverName || '').toLowerCase().trim();
    setCustomDriverDiscounts(prev => {
      const current = prev[key] || { manutencao: 0, multas: 0, adiantamentos: 0, outros: 0 };
      const updated = { ...current };
      if (newLog.category === "manutencao") updated.manutencao += newLog.amount;
      else if (newLog.category === "multas") updated.multas += newLog.amount;
      else if (newLog.category === "adiantamentos") updated.adiantamentos += newLog.amount;
      else updated.outros += newLog.amount;

      return {
        ...prev,
        [key]: updated,
      };
    });
  };

  const handleDeleteDiscountLog = (logId: string) => {
    const logToDelete = discountAuditLogs.find((l) => l.id === logId);
    setDiscountAuditLogs((prev) => prev.filter((l) => l.id !== logId));

    if (logToDelete) {
      const key = (logToDelete.driverId || logToDelete.driverName || "")
        .toLowerCase()
        .trim();
      setCustomDriverDiscounts((prev) => {
        const current = prev[key];
        if (!current) return prev;
        const updated = { ...current };
        if (logToDelete.category === "manutencao") {
          updated.manutencao = Math.max(0, updated.manutencao - logToDelete.amount);
        } else if (logToDelete.category === "multas") {
          updated.multas = Math.max(0, updated.multas - logToDelete.amount);
        } else if (logToDelete.category === "adiantamentos") {
          updated.adiantamentos = Math.max(0, updated.adiantamentos - logToDelete.amount);
        } else {
          updated.outros = Math.max(0, updated.outros - logToDelete.amount);
        }
        return {
          ...prev,
          [key]: updated,
        };
      });
    }
  };

  const handleResetDiscountLogs = () => {
    setDiscountAuditLogs([]);
    setCustomDriverDiscounts({});
    try {
      localStorage.removeItem("jis_discount_audit_logs_v1");
      localStorage.removeItem("jis_custom_driver_discounts");
    } catch (e) {
      console.error("Erro ao zerar auditoria de descontos:", e);
    }
  };

  // Estados e Log de Auditoria para Subsídios e Bónus dos Motoristas
  const [subsidyAuditLogs, setSubsidyAuditLogs] = useState<SubsidyAuditLog[]>(() => {
    try {
      const saved = localStorage.getItem('jis_subsidy_audit_logs_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Erro ao carregar auditoria de subsídios:", e);
    }
    return [
      {
        id: "SUB-891001",
        driverId: "drv-1",
        driverName: "António Manuel",
        category: "alimentacao",
        categoryLabel: "Subsídio de Alimentação",
        amount: 15000,
        date: new Date().toISOString().slice(0, 10),
        timestamp: new Date().toISOString(),
        motive: "Subsídio de Alimentação mensal aprovado pela direção.",
        registeredBy: "JIS Operações",
      },
      {
        id: "SUB-891002",
        driverId: "drv-2",
        driverName: "Mateus Domingos",
        category: "desempenho",
        categoryLabel: "Prémio de Desempenho / Meta",
        amount: 25000,
        date: new Date().toISOString().slice(0, 10),
        timestamp: new Date().toISOString(),
        motive: "Superação da meta semanal de produção em 120%.",
        registeredBy: "Auditoria Financeira",
      }
    ];
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('jis_subsidy_audit_logs_v1', JSON.stringify(subsidyAuditLogs));
    } catch (e) {
      console.error("Erro ao guardar auditoria de subsídios:", e);
    }
  }, [subsidyAuditLogs]);

  const handleAddSubsidyLog = (newLog: Omit<SubsidyAuditLog, "id" | "timestamp">) => {
    const fullLog: SubsidyAuditLog = {
      ...newLog,
      id: `SUB-${Math.floor(100000 + Math.random() * 900000)}`,
      timestamp: new Date().toISOString(),
    };
    setSubsidyAuditLogs(prev => [fullLog, ...prev]);
  };

  const handleDeleteSubsidyLog = (logId: string) => {
    setSubsidyAuditLogs(prev => prev.filter(l => l.id !== logId));
  };

  const handleResetSubsidyLogs = () => {
    setSubsidyAuditLogs([]);
    try {
      localStorage.removeItem("jis_subsidy_audit_logs_v1");
    } catch (e) {
      console.error("Erro ao zerar auditoria de subsídios:", e);
    }
  };

  // Estados para Lançamento de Descontos por Motorista (Manutenção, Multas, Adiantamentos)
  const [customDriverDiscounts, setCustomDriverDiscounts] = useState<Record<string, {
    manutencao: number;
    multas: number;
    adiantamentos: number;
    outros: number;
  }>>({});
  const [selectedDriverForDiscount, setSelectedDriverForDiscount] = useState<any | null>(null);
  const [discountForm, setDiscountForm] = useState({
    manutencao: 0,
    multas: 0,
    adiantamentos: 0,
    outros: 0,
  });

  const handleOpenDiscountModal = (driver: any) => {
    setSelectedDriverForDiscount(driver);
    const key = (driver.driverId || driver.driverName || '').toLowerCase().trim();
    const existing = customDriverDiscounts[key] || { manutencao: 0, multas: 0, adiantamentos: 0, outros: 0 };
    setDiscountForm(existing);
  };

  const handleSaveDriverDiscounts = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDriverForDiscount) return;
    const key = (selectedDriverForDiscount.driverId || selectedDriverForDiscount.driverName || '').toLowerCase().trim();
    setCustomDriverDiscounts(prev => ({
      ...prev,
      [key]: {
        manutencao: Number(discountForm.manutencao) || 0,
        multas: Number(discountForm.multas) || 0,
        adiantamentos: Number(discountForm.adiantamentos) || 0,
        outros: Number(discountForm.outros) || 0,
      }
    }));
    setSelectedDriverForDiscount(null);
  };

  // Cálculo memoizado de ranking de produção (do 1º ao último colocado)
  const driverRankingList = React.useMemo(() => {
    const driverMap = new Map<string, {
      driverId: string;
      driverName: string;
      prefix: string;
      plate: string;
      totalGross: number;
      totalExpenses: number;
      totalDiscounts: number;
      totalNet: number;
      logCount: number;
      status: string;
    }>();

    // 1. Motoristas cadastrados no driversMaster
    (driversMaster || []).forEach((d: any) => {
      const nameKey = (d.name || d.driverName || '').trim();
      const idKey = d.id || d.driverId || nameKey;
      if (idKey || nameKey) {
        const key = nameKey ? nameKey.toLowerCase() : idKey;
        driverMap.set(key, {
          driverId: d.id || d.driverId || '',
          driverName: d.name || d.driverName || 'Motorista',
          prefix: d.prefix || d.code || 'N/A',
          plate: d.plate || d.vehiclePlate || 'LD-92-33-PX',
          totalGross: 0,
          totalExpenses: 0,
          totalDiscounts: 0,
          totalNet: 0,
          logCount: 0,
          status: d.status || 'ativo',
        });
      }
    });

    // 2. Registos de rendimento em allRevenues
    (allRevenues || []).forEach((rev: any) => {
      if (rev.status === 'archived' || rev.status === 'rejected_by_operator' || rev.status === 'rejected_by_accountant') {
        return;
      }
      
      if (rankingPeriodFilter === "current_month") {
        const rMonth = rev.date ? rev.date.slice(0, 7) : (rev.timestamp ? rev.timestamp.slice(0, 7) : '');
        if (rMonth && rMonth !== currentMonth) return;
      }

      const driverNameStr = (rev.driverName || '').trim();
      const key = driverNameStr ? driverNameStr.toLowerCase() : (rev.driverId || '');
      if (!key) return;

      const isBonusRev = rev.usedBonus === true || rev.paidWithBonus === true || rev.paymentMethod === 'bonus' || rev.isBonus === true;
      const gross = isBonusRev ? 0 : ((rev.breakdown?.tpa || 0) + (rev.breakdown?.cash || 0) + (rev.breakdown?.transfer || 0) || (rev.amount || 0));
      const exp = rev.breakdown?.expenses || 0;
      const disc = rev.breakdown?.discounts || rev.discounts || rev.discountValue || 0;
      const net = gross - exp - disc;

      if (driverMap.has(key)) {
        const existing = driverMap.get(key)!;
        existing.totalGross += gross;
        existing.totalExpenses += exp;
        existing.totalDiscounts += disc;
        existing.totalNet += net;
        existing.logCount += 1;
        if (rev.prefix && (existing.prefix === 'N/A' || !existing.prefix)) existing.prefix = rev.prefix;
        if (rev.plate && existing.plate === 'LD-92-33-PX') existing.plate = rev.plate;
      } else {
        driverMap.set(key, {
          driverId: rev.driverId || '',
          driverName: rev.driverName || 'Motorista',
          prefix: rev.prefix || 'N/A',
          plate: rev.plate || 'LD-92-33-PX',
          totalGross: gross,
          totalExpenses: exp,
          totalDiscounts: disc,
          totalNet: net,
          logCount: 1,
          status: 'ativo',
        });
      }
    });

    // 3. Sincronizar com relatórios individuais se houver valores superiores
    (individualReports || []).forEach((rep: any) => {
      const driverNameStr = (rep.driverName || '').trim();
      const key = driverNameStr ? driverNameStr.toLowerCase() : (rep.driverId || '');
      if (!key) return;

      const repGross = rep.totalGross || 0;
      const repDisc = rep.totalDiscounts || rep.discounts || rep.descontoDanos || 0;
      if (driverMap.has(key)) {
        const existing = driverMap.get(key)!;
        if (repGross > existing.totalGross) {
          existing.totalGross = repGross;
          existing.totalNet = rep.totalNet || repGross;
          if (rep.totalExpenses) existing.totalExpenses = rep.totalExpenses;
          if (repDisc > existing.totalDiscounts) existing.totalDiscounts = repDisc;
        }
      } else {
        driverMap.set(key, {
          driverId: rep.driverId || '',
          driverName: rep.driverName || 'Motorista',
          prefix: rep.prefix || 'N/A',
          plate: rep.plate || 'LD-92-33-PX',
          totalGross: repGross,
          totalExpenses: rep.totalExpenses || 0,
          totalDiscounts: repDisc,
          totalNet: rep.totalNet || repGross,
          logCount: rep.workingDays || 1,
          status: 'ativo',
        });
      }
    });

    const list = Array.from(driverMap.values());
    // Aplicação dos descontos operacionais manuais (Manutenção, Multas, Adiantamentos, Outros)
    list.forEach((driver) => {
      const key = (driver.driverId || driver.driverName || '').toLowerCase().trim();
      const custom = customDriverDiscounts[key] || { manutencao: 0, multas: 0, adiantamentos: 0, outros: 0 };
      const customTotal = (custom.manutencao || 0) + (custom.multas || 0) + (custom.adiantamentos || 0) + (custom.outros || 0);
      driver.totalDiscounts += customTotal;
      driver.totalNet = driver.totalGross - driver.totalExpenses - driver.totalDiscounts;
    });

    // Ordenar estritamente por produção bruta decrescente (do 1º ao último)
    list.sort((a, b) => b.totalGross - a.totalGross);

    return list;
  }, [driversMaster, allRevenues, individualReports, currentMonth, rankingPeriodFilter, customDriverDiscounts]);

  const filteredRankingList = React.useMemo(() => {
    if (!rankingSearchTerm.trim()) return driverRankingList;
    const term = rankingSearchTerm.toLowerCase();
    return driverRankingList.filter(
      (d) =>
        d.driverName.toLowerCase().includes(term) ||
        d.prefix.toLowerCase().includes(term) ||
        d.plate.toLowerCase().includes(term)
    );
  }, [driverRankingList, rankingSearchTerm]);

  const exportRankingToPDF = () => {
    try {
      const doc = new jsPDF();
      const tenantName = activeTenantData?.name || 'PSM COMERCIAL (SU), LDA • JIS ANGOLA';

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 38, 'F');

      doc.setTextColor(245, 158, 11);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("SUPER TÁXI • TAXICONTROL (JIS ANGOLA)", 14, 16);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("RELATÓRIO DE CLASSIFICAÇÃO DE PRODUÇÃO DOS MOTORISTAS", 14, 25);

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(148, 163, 184);
      doc.text(`Entidade: ${tenantName} | Emissão: ${new Date().toLocaleDateString('pt-AO')} | Período: ${rankingPeriodFilter === 'current_month' ? currentMonth : 'Histórico Consolidado'}`, 14, 32);

      const top1 = driverRankingList[0];
      const top2 = driverRankingList[1];
      const top3 = driverRankingList[2];

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("PÓDIO DE DESTAQUES (TOP 3 PRODUTORES)", 14, 46);

      let topText = "";
      if (top1) topText += `1º LUGAR (OURO): ${top1.driverName} - ${top1.totalGross.toLocaleString('pt-AO')} Kz\n`;
      if (top2) topText += `2º LUGAR (PRATA): ${top2.driverName} - ${top2.totalGross.toLocaleString('pt-AO')} Kz\n`;
      if (top3) topText += `3º LUGAR (BRONZE): ${top3.driverName} - ${top3.totalGross.toLocaleString('pt-AO')} Kz`;

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(topText, 14, 52);

      const highestGross = top1?.totalGross || 1;
      const tableData = driverRankingList.map((driver, index) => {
        const pos = index + 1;
        const posLabel = pos === 1 ? '1º (OURO)' : pos === 2 ? '2º (PRATA)' : pos === 3 ? '3º (BRONZE)' : `${pos}º`;
        const salary10Pct = driver.totalGross * 0.1;
        const pctOfLeader = highestGross > 0 ? ((driver.totalGross / highestGross) * 100).toFixed(1) + '%' : '0%';

        return [
          posLabel,
          driver.driverName,
          `${driver.logCount} dia(s)`,
          `${driver.totalGross.toLocaleString('pt-AO')} Kz`,
          `${driver.totalExpenses.toLocaleString('pt-AO')} Kz`,
          `${driver.totalDiscounts.toLocaleString('pt-AO')} Kz`,
          `${salary10Pct.toLocaleString('pt-AO')} Kz`,
          pctOfLeader,
        ];
      });

      autoTable(doc, {
        startY: top3 ? 68 : 56,
        head: [['Posição', 'Motorista', 'Registos', 'Produção Bruta', 'Custos', 'Descontos', 'Salário 10%', '% do Líder']],
        body: tableData,
        theme: 'striped',
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [245, 158, 11],
          fontStyle: 'bold',
          fontSize: 8,
        },
        bodyStyles: {
          fontSize: 7.5,
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 26 },
          1: { fontStyle: 'bold' },
          3: { fontStyle: 'bold', textColor: [16, 185, 129] },
          5: { fontStyle: 'bold', textColor: [225, 29, 72] },
          6: { fontStyle: 'bold', textColor: [245, 158, 11] },
        },
      });

      const finalY = (doc as any).lastAutoTable?.finalY || 200;
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(100, 116, 139);
      doc.text(`Documento emitido automaticamente pela Central de Contabilidade TaxiControl (JIS ANGOLA). Auditado para apuramento de prémios de produtividade.`, 14, finalY + 12);

      doc.save(`Classificacao_Producao_Motoristas_${currentMonth}.pdf`);
    } catch (err) {
      console.error("Erro ao gerar PDF de classificação:", err);
      alert("Erro ao exportar o documento PDF do Ranking.");
    }
  };

  // Filtros rápidos para conciliação mensal na aba de Relatório Individual Analítico
  const monthlyPendingLogs = allRevenues.filter(r => {
    const rMonth = r.date ? r.date.slice(0, 7) : (r.timestamp ? r.timestamp.slice(0, 7) : '');
    return r.status === 'pending_approval' && rMonth === currentMonth;
  });
  
  const monthlyApprovedLogs = allRevenues.filter(r => {
    const rMonth = r.date ? r.date.slice(0, 7) : (r.timestamp ? r.timestamp.slice(0, 7) : '');
    return (r.status === 'approved_by_operator' || r.status === 'approved_by_accountant' || r.status === 'finalized' || r.status === 'paid_to_staff') && rMonth === currentMonth;
  });

  const totalPendingSum = monthlyPendingLogs.reduce((acc, curr) => {
    const isBonus = curr.usedBonus === true || curr.paidWithBonus === true || curr.paymentMethod === 'bonus' || curr.isBonus === true;
    return acc + (isBonus ? 0 : (curr.amount || 0));
  }, 0);
  const totalApprovedSum = monthlyApprovedLogs.reduce((acc, curr) => {
    const isBonus = curr.usedBonus === true || curr.paidWithBonus === true || curr.paymentMethod === 'bonus' || curr.isBonus === true;
    return acc + (isBonus ? 0 : (curr.amount || 0));
  }, 0);

  // Estados para intervalo customizável do PDF Consolidado de Receita de Rendas (José Iweza Suana)
  const [consolidatedStartDate, setConsolidatedStartDate] = useState<string>(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 6); // default 7 dias incluindo hoje
    return start.toISOString().split('T')[0];
  });
  const [consolidatedEndDate, setConsolidatedEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const isAdmin =
    user?.email === "joseiwezasuana@gmail.com" || user?.role === "admin" || user?.role === "gerente";
  const isAccountant = user?.role === "contabilista";

  const exportToPDF = (type: "salary" | "report" | "balance", data: any) => {
    try {
      const doc = new jsPDF();

      // Header
      doc.setFontSize(22);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(activeTenantData?.name.toUpperCase() || "JIS LUENA MOXICO", 105, 20, { align: "center" });
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text("HUB DE CONTABILIDADE & GESTÃO DE FROTA", 105, 28, {
        align: "center",
      });
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.line(15, 35, 195, 35);

      if (type === "salary") {
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42);
        doc.text(`FOLHA DE SALÁRIO - ${data.month}`, 15, 45);

        const tableData = (data.staff || []).map((s: any) => [
          s.name,
          s.role,
          `${(s.baseSalary || 0).toLocaleString()} Kz`,
          `${(s.subsSalary || 0).toLocaleString()} Kz`,
          `${((s.baseSalary || 0) + (s.subsSalary || 0)).toLocaleString()} Kz`,
        ]);

        autoTable(doc, {
          startY: 55,
          head: [["Colaborador", "Cargo", "Base", "Subsídios", "Total"]],
          body: tableData,
          theme: "grid",
          headStyles: { fillColor: [15, 23, 42] },
        });
      } else if (type === "report") {
        doc.setFontSize(14);
        doc.text(
          `EXTRATO INDIVIDUAL: ${data.staffName || "Colaborador"}`,
          15,
          45,
        );

        const tableData = (data.logs || []).map((l: any) => [
          l.date,
          l.prefix,
          `${(l.amount || 0).toLocaleString()} Kz`,
          l.status.toUpperCase(),
        ]);

        autoTable(doc, {
          startY: 55,
          head: [["Data", "Placa/Prefixo", "Valor Bruto", "Estado"]],
          body: tableData,
          theme: "striped",
        });
      }

      doc.setFontSize(8);
      doc.text(
        `Documento gerado automaticamente pelo TaxiControl em ${new Date().toLocaleString()}`,
        105,
        285,
        { align: "center" },
      );
      doc.save(`PSM_${type}_${Date.now()}.pdf`);
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      alert(
        "Erro ao gerar PDF. Verifique se as bibliotecas jspdf estão carregadas.",
      );
    }
  };

  // Month filter (current month by default)

  const [administrativeStaff, setAdministrativeStaff] = useState<any[]>([]);
  const [showAdminStaffForm, setShowAdminStaffForm] = useState(false);
  const [newAdminStaff, setNewAdminStaff] = useState({
    name: "",
    role: "",
    base: 0,
    subs: 0,
    phone: "",
  });
  const [editingAdminStaffId, setEditingAdminStaffId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    // Fetch Active Tenant Info
    const tenantId = getActiveTenantId();
    const unsubTenant = onSnapshot(doc(db, "tenants", tenantId), (snapshot) => {
      if (snapshot.exists()) {
        setActiveTenantData({ id: snapshot.id, ...snapshot.data() } as any);
      } else {
        setActiveTenantData({
          id: tenantId,
          name: tenantId === 'psm' ? 'PSMOREIRA COMERCIAL (SU), LDA' : 'JIS ANGOLA',
          phone: '+244 921 277 223',
          address: 'Bairro Social Da Juventude, Luena-Moxico',
        });
      }
    });

    // 1. Fetch APPROVED and FINALIZED revenues for the current month
    const qRev = query(
      collection(db, "revenue_logs"),
      orderBy("timestamp", "desc"),
    );
    const unsubRev = onSnapshot(qRev, (snapshot) => {
      const logs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setAllRevenues(logs);
      // Local filter as extra safety
      setFinalizedRevenues(
        logs.filter((r: any) => 
          r.status !== 'archived' &&
          r.status !== 'rejected_by_operator' &&
          r.status !== 'rejected_by_accountant' &&
          (r.status === 'approved_by_operator' || r.status === 'approved_by_accountant' || r.status === 'finalized' || r.status === 'paid_to_staff')
        )
      );
    }, (error) => handleFirestoreError(error, OperationType.GET, "revenue_logs"));

    // 2. Fetch Salary Sheets
    const qSal = query(
      collection(db, "salary_sheets"),
      orderBy("month", "desc"),
    );
    const unsubSal = onSnapshot(qSal, (snapshot) => {
      setSalarySheets(
        snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((s: any) => s.status !== 'archived')
      );
    }, (error) => handleFirestoreError(error, OperationType.GET, "salary_sheets"));

    // 3. Fetch Individual Reports
    const qInd = query(
      collection(db, "individual_reports"),
      where("month", "==", currentMonth),
    );
    const unsubInd = onSnapshot(qInd, (snapshot) => {
      const reports = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((r: any) => r.status !== 'archived');

      // Deduplicate reports to guarantee each driver only appears once per period/month
      const uniqueReportsMap = new Map<string, any>();
      reports.forEach((report: any) => {
        const key = report.driverId || report.driverName;
        if (!uniqueReportsMap.has(key)) {
          uniqueReportsMap.set(key, report);
        } else {
          // If duplicate exists, keep the one with higher totalGross or updatedAt (most recent)
          const existing = uniqueReportsMap.get(key);
          const existingTime = existing.updatedAt?.seconds || 0;
          const reportTime = report.updatedAt?.seconds || 0;
          if (reportTime > existingTime) {
            uniqueReportsMap.set(key, report);
          }
        }
      });
      const uniqueReports = Array.from(uniqueReportsMap.values());

      // Sort client-side by driverName to avoid composite index requirement
      uniqueReports.sort((a: any, b: any) => {
        const nameA = (a.driverName || "").toUpperCase();
        const nameB = (b.driverName || "").toUpperCase();
        return nameA.localeCompare(nameB);
      });
      setIndividualReports(uniqueReports);
    }, (error) => handleFirestoreError(error, OperationType.GET, "individual_reports"));

    // 4. Fetch Administrative Staff
    const qAdmin = query(
      collection(db, "administrative_staff"),
      orderBy("name", "asc"),
    );
    const unsubAdmin = onSnapshot(qAdmin, (snapshot) => {
      setAdministrativeStaff(
        snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      );
    }, (error) => handleFirestoreError(error, OperationType.GET, "administrative_staff"));

    // 5. Fetch Drivers Master (for salary configs)
    const qDrivers = query(collection(db, "drivers_master"));
    const unsubDrivers = onSnapshot(qDrivers, (snapshot) => {
      setDriversMaster(
        snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      );
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, "drivers_master"));

    return () => {
      unsubTenant();
      unsubRev();
      unsubSal();
      unsubInd();
      unsubAdmin();
      unsubDrivers();
    };
  }, [currentMonth]);

  const handleAddAdminStaff = async () => {
    if (!newAdminStaff.name || !newAdminStaff.role) return;
    try {
      if (editingAdminStaffId) {
        await updateDoc(
          doc(db, "administrative_staff", editingAdminStaffId),
          newAdminStaff,
        );
        setEditingAdminStaffId(null);
      } else {
        await addDoc(collection(db, "administrative_staff"), newAdminStaff);
      }
      setNewAdminStaff({ name: "", role: "", base: 0, subs: 0, phone: "" });
      setShowAdminStaffForm(false);
    } catch (error) {
      handleFirestoreError(error, editingAdminStaffId ? OperationType.UPDATE : OperationType.CREATE, 'administrative_staff');
    }
  };

  const handleEditAdminStaff = (staff: any) => {
    setNewAdminStaff({
      name: staff.name,
      role: staff.role,
      base: staff.base || 0,
      subs: staff.subs || 0,
      phone: staff.phone || "",
    });
    setEditingAdminStaffId(staff.id);
    setShowAdminStaffForm(true);
  };

  const handleDeleteAdminStaff = async (id: string) => {
    if (confirm("Remover este funcionário administrativo?")) {
      await deleteDoc(doc(db, "administrative_staff", id));
    }
  };

  const generateIndividualSlip = (person: any, month: string) => {
    // Robust mapping of subsidy fields from different potential source structures
    const subs = person.subs || 0;
    const subsAliment = person.subsAliment || 0;
    const subsTransp = person.subsTransp || 0;
    
    // Determine exact days worked, respecting 0 when no days are logged
    const daysWorked = person.days ?? person.logCount ?? person.diasTrabalho ?? (person.role === "Motorista" ? 0 : 30);

    // Cross-reference with subsidyAuditLogs for real-time synchronization
    const pName = (person.name || person.driverName || "").toLowerCase().trim();
    const pId = (person.id || person.driverId || "").toLowerCase().trim();

    const matchedSubsidyLogs = (subsidyAuditLogs || []).filter((log) => {
      const lName = (log.driverName || "").toLowerCase().trim();
      const lId = (log.driverId || "").toLowerCase().trim();
      return (pName && lName === pName) || (pId && lId === pId);
    });

    const sumAlimentacao = matchedSubsidyLogs
      .filter((l) => l.category === "alimentacao")
      .reduce((a, c) => a + Number(c.amount || 0), 0);
    const sumTransporte = matchedSubsidyLogs
      .filter((l) => l.category === "transporte")
      .reduce((a, c) => a + Number(c.amount || 0), 0);
    const sumFerias = matchedSubsidyLogs
      .filter((l) => l.category === "ferias")
      .reduce((a, c) => a + Number(c.amount || 0), 0);
    const sumReforco = matchedSubsidyLogs
      .filter((l) => l.category === "reforco" || l.category === "desempenho" || l.category === "ajudas_custo" || l.category === "outros")
      .reduce((a, c) => a + Number(c.amount || 0), 0);
    const sumRenda1 = matchedSubsidyLogs
      .filter((l) => l.category === "renda1")
      .reduce((a, c) => a + Number(c.amount || 0), 0);
    const sumRenda2 = matchedSubsidyLogs
      .filter((l) => l.category === "renda2")
      .reduce((a, c) => a + Number(c.amount || 0), 0);
    const sumRenda3 = matchedSubsidyLogs
      .filter((l) => l.category === "renda3")
      .reduce((a, c) => a + Number(c.amount || 0), 0);

    const baseAliment = subs > 0 ? subs / 2 : subsAliment;
    const baseTransp = subs > 0 ? subs / 2 : subsTransp;
    
    setActiveReceipt({
      name: person.name || person.driverName,
      categoria: person.role || "Colaborador",
      dataProcessamento: new Date().toLocaleDateString("pt-PT"),
      diasTrabalho: daysWorked,
      salarioBase: person.baseSalary || person.commissions || 0,
      subsidioAlimentacao: (person.subsidioAlimentacao ?? baseAliment) + sumAlimentacao,
      subsidioTransporte: (person.subsidioTransporte ?? baseTransp) + sumTransporte,
      subsidioFerias: (person.subsidioFerias || 0) + sumFerias,
      subsidioReforco: (person.subsidioReforco || 0) + sumReforco,
      subsidioRenda1: (person.subsidioRenda1 || 0) + sumRenda1,
      subsidioRenda2: (person.subsidioRenda2 || 0) + sumRenda2,
      subsidioRenda3: (person.subsidioRenda3 || 0) + sumRenda3,
      descontoDanos: person.descontoDanos || 0,
      numeroFaltas: person.numeroFaltas || 0,
      outrosDescontos: person.discounts || person.totalDiscounts || 0,
    });
    setReceiptMonth(month);
    setIsReceiptModalOpen(true);
  };

  const calculateReceiptTotals = (data: any) => {
    const totalRemun = 
      (Number(data.salarioBase) || 0) + 
      (Number(data.subsidioFerias) || 0) + 
      (Number(data.subsidioAlimentacao) || 0) + 
      (Number(data.subsidioTransporte) || 0) + 
      (Number(data.subsidioReforco) || 0) + 
      (Number(data.subsidioRenda1) || 0) + 
      (Number(data.subsidioRenda2) || 0) + 
      (Number(data.subsidioRenda3) || 0);
    const totalDisc = (Number(data.descontoDanos) || 0) + (Number(data.outrosDescontos) || 0);
    const net = totalRemun - totalDisc;
    return { totalRemun, totalDisc, net };
  };

  const handleDownloadReceiptPDF = (data: any) => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const { totalRemun, totalDisc, net } = calculateReceiptTotals(data);
      const docCode = `BIL-SAL-PSM-${Math.floor(100000 + Math.random() * 900000)}`;
      const issueDate = `${new Date().toLocaleDateString("pt-PT")} ${new Date().toLocaleTimeString("pt-PT")}`;

      // Timbre Oficial PSM - Faixa Superior Slate-900 com Detalhes Amber
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 210, 42, "F");

      doc.setFillColor(245, 158, 11); // amber-500
      doc.rect(0, 41, 210, 1.5, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.text("PSM COMERCIAL (SU), LDA • SUPER TÁXI", 14, 14);

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(251, 191, 36);
      doc.text("DEPARTAMENTO DE RECURSOS HUMANOS & CONTABILIDADE CENTRAL", 14, 20);

      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(203, 213, 225);
      doc.text("Filial Principal: Luena, Província do Moxico • República de Angola | NIF: 5417089201", 14, 26);
      doc.text(`Cód Ref: ${docCode} | Período: ${receiptMonth} | Emissão: ${issueDate}`, 14, 31);
      doc.text("Sistema Oficial JIS ANGOLA • TAXICONTROL HUB", 14, 36);

      // Carimbo Digital de Verificação no Timbre
      doc.setDrawColor(245, 158, 11);
      doc.setFillColor(30, 41, 59);
      doc.roundedRect(150, 7, 48, 28, 3, 3, "FD");
      doc.setTextColor(251, 191, 36);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text("TIMBRE OFICIAL", 154, 14);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.text("PSM LUENA MOXICO", 154, 19);
      doc.text("BILHETE DE SALÁRIO", 154, 24);
      doc.text("PROCESSADO POR COMPUTADOR", 154, 29);

      // Title
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("BILHETE DE SALÁRIO E DEMONSTRATIVO DE RENDIMENTOS", pageWidth / 2, 52, { align: "center" });

      // Info Table Box
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(`COLABORADOR: ${data.name.toUpperCase()}`, 14, 61);
      doc.text(`CATEGORIA: ${data.categoria.toUpperCase()}`, 14, 67);
      doc.text(`DIAS TRABALHADOS: ${data.diasTrabalho} DIAS`, 14, 73);

      doc.text(`DATA PROCESSAMENTO: ${data.dataProcessamento}`, pageWidth - 14, 61, { align: "right" });
      doc.text(`MÊS REFERÊNCIA: ${receiptMonth}`, pageWidth - 14, 67, { align: "right" });
      doc.text(`ENTIDADE PATRONAL: PSM COMERCIAL (SU), LDA`, pageWidth - 14, 73, { align: "right" });

      // Remunerations
      const remunerations = [
        ["Salário Base / Produção", `${Number(data.salarioBase)?.toLocaleString()} Kz`],
        ["Subsídio de Alimentação", `${Number(data.subsidioAlimentacao)?.toLocaleString()} Kz`],
        ["Subsídio de Transporte", `${Number(data.subsidioTransporte)?.toLocaleString()} Kz`],
        ["Subsídio de Férias", `${Number(data.subsidioFerias)?.toLocaleString()} Kz`],
        ["Subsídio de Reforço", `${Number(data.subsidioReforco)?.toLocaleString()} Kz`],
        ["Subsídio de Renda 1", `${Number(data.subsidioRenda1)?.toLocaleString()} Kz`],
        ["Subsídio de Renda 2", `${Number(data.subsidioRenda2)?.toLocaleString()} Kz`],
        ["Subsídio de Renda 3", `${Number(data.subsidioRenda3)?.toLocaleString()} Kz`],
      ];

      const discountsTable = [
        ["Desconto de Danos / Avarias", `${Number(data.descontoDanos)?.toLocaleString()} Kz`],
        ["Nº de Faltas", `${data.numeroFaltas}`],
        ["Outros Descontos Auditados (Multas / Válens)", `${Number(data.outrosDescontos)?.toLocaleString()} Kz`],
      ];

      autoTable(doc, {
        startY: 78,
        head: [["CRÉDITOS DE REMUNERAÇÃO", "VALOR (KZ)"]],
        body: remunerations,
        theme: "striped",
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
        styles: { fontSize: 8 },
        columnStyles: { 0: { cellWidth: 130 }, 1: { cellWidth: 50, halign: "right", fontStyle: "bold" } }
      });

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 5,
        head: [["DEDUÇÕES & ABATES AUDITADOS", "VALOR (KZ)"]],
        body: discountsTable,
        theme: "striped",
        headStyles: { fillColor: [225, 29, 72], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
        styles: { fontSize: 8 },
        columnStyles: { 0: { cellWidth: 130 }, 1: { cellWidth: 50, halign: "right", fontStyle: "bold" } }
      });

      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(`TOTAL BRUTO REMUNERAÇÕES: ${totalRemun.toLocaleString()} Kz`, pageWidth - 14, finalY, { align: "right" });
      doc.setTextColor(225, 29, 72);
      doc.text(`TOTAL DEDUÇÕES E ABATES: -${totalDisc.toLocaleString()} Kz`, pageWidth - 14, finalY + 6, { align: "right" });
      
      doc.setFontSize(12);
      doc.setTextColor(16, 185, 129);
      doc.text(`VALOR LÍQUIDO A RECEBER: ${net.toLocaleString()} Kz`, pageWidth - 14, finalY + 15, { align: "right" });

      // Signatures
      const sigY = finalY + 34;
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);

      doc.text("__________________________________________", 20, sigY);
      doc.text("O Colaborador / Beneficiário", 28, sigY + 5);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text(`Data: ____/____/2026`, 32, sigY + 9);

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("__________________________________________", 120, sigY);
      doc.text("Pela Direção de RH & Finanças", 128, sigY + 5);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text("PSM COMERCIAL (SU), LDA • LUENA MOXICO", 122, sigY + 9);

      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text("Documento oficial de bilhete de salário emitido com o Timbre Oficial da PSM COMERCIAL (SU), LDA.", pageWidth / 2, 285, { align: "center" });

      const tenantSlug = activeTenantData?.id.toUpperCase() || "JIS";
      doc.save(`RECIBO_TIMBRADO_${tenantSlug}_${data.name.replace(/\s+/g, '_')}_${receiptMonth}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Erro ao gerar PDF do recibo.");
    }
  };

  const handleSendWhatsApp = (data: any) => {
    const { totalRemun, totalDisc, net } = calculateReceiptTotals(data);
    const month = receiptMonth;
    
    // Find person's phone in master lists
    const driver = driversMaster.find(d => d.name === data.name);
    const admin = administrativeStaff.find(a => a.name === data.name);
    let phone = driver?.phone || admin?.phone;
    
    if (!phone) {
       const manualPhone = prompt("TElEFONE NÃO ENCONTRADO. Digite o número (ex: 923...):");
       if (!manualPhone) return;
       phone = manualPhone;
    }
    
    // Format phone
    let cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone.startsWith('244')) {
      cleanPhone = '244' + cleanPhone;
    }
    
    const companyTitle = activeTenantData?.name.toUpperCase() || "JIS ANGOLA";
    const message = `*BILHETE DE SALÁRIO - ${companyTitle}*\n\n` +
      `Olá *${data.name}*,\n` +
      `O seu bilhete de salário referente a *${month}* já está disponível.\n\n` +
      `*RESUMO FINANCEIRO:*\n` +
      `• Vencimento Bruto: ${totalRemun.toLocaleString()} Kz\n` +
      `• Descontos Totais: ${totalDisc.toLocaleString()} Kz\n` +
      `• *LADO LÍQUIDO A RECEBER: ${net.toLocaleString()} Kz*\n\n` +
      `Data de Processamento: ${data.dataProcessamento}\n` +
      `Gestão TaxiControl - Luena, Moxico`;
      
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleOpenInvoiceViewer = (rev: any) => {
    // Map RevenueLog to InvoiceData
    const invoiceData = {
      id: rev.id,
      client: rev.driverName || "CLIENTE GERAL",
      vehicle: rev.prefix || rev.vehiclePrefix || "PSM-FLEET",
      startDate: rev.date || new Date().toISOString(),
      endDate: rev.date || new Date().toISOString(),
      dailyPrice: rev.amount || 0,
      createdAt: rev.timestamp
    };

    setSelectedInvoiceData(invoiceData);
    setIsInvoiceViewerOpen(true);
  };

  const handleGenerateSheet = async () => {
    setIsProcessing(true);
    try {
      // 1. Fetch only Approved Individual Reports (by Admin)
      const approvedReports = individualReports.filter(
        (r) => r.status === "approved_by_admin",
      );

      if (approvedReports.length === 0) {
        alert(
          "Nenhum relatório individual foi aprovado pelo Admin ainda. Aprove os relatórios primeiro.",
        );
        return;
      }

      const driverMapConsolidated = new Map<string, any>();
      approvedReports.forEach((report) => {
        const driverId = report.driverId;
        const grossSalary = (report.baseSalary || 0) + (report.subs || 0);
        const inssEmployee = grossSalary * 0.03;
        const netSalary = grossSalary - inssEmployee - (report.discounts || 0);

        if (!driverMapConsolidated.has(driverId)) {
          driverMapConsolidated.set(driverId, {
            id: driverId,
            name: report.driverName,
            role: "Motorista",
            baseSalary: report.baseSalary || 0,
            subsAliment: (report.subs || 0) / 2,
            subsTransp: (report.subs || 0) / 2,
            grossSalary,
            inssEmployee,
            inssEmployer: grossSalary * 0.08,
            irt: 0,
            discounts: report.discounts || 0,
            netSalary,
            status: "pending",
          });
        } else {
          const existing = driverMapConsolidated.get(driverId);
          existing.baseSalary += report.baseSalary || 0;
          existing.subsAliment += (report.subs || 0) / 2;
          existing.subsTransp += (report.subs || 0) / 2;
          existing.grossSalary += grossSalary;
          existing.inssEmployee += inssEmployee;
          existing.inssEmployer += grossSalary * 0.08;
          existing.discounts += report.discounts || 0;
          existing.netSalary += netSalary;
        }
      });
      const driverStaff = Array.from(driverMapConsolidated.values());

      // 2. Add Administrative Staff (From Firestore)
      const adminStaffMapped = administrativeStaff.map((admin) => {
        const grossSalary = (admin.base || 0) + (admin.subs || 0);
        const inssEmployee = grossSalary * 0.03;
        return {
          id: admin.id,
          name: admin.name,
          role: admin.role,
          baseSalary: admin.base || 0,
          subsAliment: (admin.subs || 0) / 2,
          subsTransp: (admin.subs || 0) / 2,
          grossSalary,
          inssEmployee,
          inssEmployer: grossSalary * 0.08,
          irt: 0,
          discounts: 0,
          netSalary: grossSalary - inssEmployee,
          status: "pending",
        };
      });

      const fullStaffList = [...driverStaff, ...adminStaffMapped];

      await addDoc(collection(db, "salary_sheets"), {
        month: currentMonth,
        status: "draft",
        totalPayable: fullStaffList.reduce((acc, s) => acc + s.netSalary, 0),
        totalBruto: fullStaffList.reduce((acc, s) => acc + s.grossSalary, 0),
        totalInssEmployee: fullStaffList.reduce(
          (acc, s) => acc + s.inssEmployee,
          0,
        ),
        totalInssEmployer: fullStaffList.reduce(
          (acc, s) => acc + s.inssEmployer,
          0,
        ),
        totalIrt: fullStaffList.reduce((acc, s) => acc + s.irt, 0),
        staff: fullStaffList,
        createdAt: serverTimestamp(),
      });
      alert(
        "Folha de Salário Gerada com Sucesso baseada nos relatórios e staff administrativo!",
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'salary_sheets');
    } finally {
      setIsProcessing(false);
    }
  };

  const exportMapToPDF = () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(22);
      doc.setTextColor(15, 23, 42);
      doc.text(activeTenantData?.name.toUpperCase() || "PSM COMERCIAL LUENA MOXICO", 105, 20, { align: "center" });
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text("MAPA DE RENDIMENTOS - FECHO DE CAIXA", 105, 28, {
        align: "center",
      });
      doc.line(15, 35, 195, 35);

      const tableData = finalizedRevenues.map((rev) => [
        rev.driverName,
        rev.date,
        `${((rev.breakdown?.tpa || 0) + (rev.breakdown?.cash || 0) + (rev.breakdown?.transfer || 0)).toLocaleString()} Kz`,
        `${(rev.breakdown?.expenses || 0).toLocaleString()} Kz`,
        `${(rev.amount || 0).toLocaleString()} Kz`,
      ]);

      autoTable(doc, {
        startY: 45,
        head: [["Colaborador", "Data", "Bruto", "Custos", "Líquido PSM"]],
        body: tableData,
        theme: "grid",
        headStyles: { fillColor: [15, 23, 42] },
      });

      doc.save(`mapa_rendimento_${currentMonth}.pdf`);
    } catch (err) {
      console.error(err);
    }
  };

  const generateWeeklyConsolidatedPDF = () => {
    try {
      const doc = new jsPDF();
      
      const startDateObj = new Date(consolidatedStartDate);
      startDateObj.setHours(0, 0, 0, 0);
      
      const endDateObj = new Date(consolidatedEndDate);
      endDateObj.setHours(23, 59, 59, 999);

      const formatDatePT = (d: Date) => {
        return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
      };

      const dateRangeStr = `Período: ${formatDatePT(startDateObj)} a ${formatDatePT(endDateObj)}`;

      // Filter revenues for the custom period
      const weeklyRevenues = finalizedRevenues.filter((rev: any) => {
        if (!rev.date && !rev.timestamp) return false;
        let itemDate: Date;
        if (rev.date) {
          itemDate = new Date(rev.date);
          if (isNaN(itemDate.getTime()) && rev.timestamp) {
            itemDate = rev.timestamp.seconds ? new Date(rev.timestamp.seconds * 1000) : new Date(rev.timestamp);
          }
        } else {
          itemDate = rev.timestamp.seconds ? new Date(rev.timestamp.seconds * 1000) : new Date(rev.timestamp);
        }
        return itemDate >= startDateObj && itemDate <= endDateObj;
      });

      // Calculate aggregates
      let totalBruto = 0;
      let totalDinheiro = 0;
      let totalTransferencias = 0;
      let totalTPA = 0;
      let totalDespesas = 0;
      let totalLiquidoPSM = 0;

      weeklyRevenues.forEach((rev: any) => {
        const cashValue = Number(rev.breakdown?.cash || 0);
        const transValue = Number(rev.breakdown?.transfer || 0);
        const tpaValue = Number(rev.breakdown?.tpa || 0);
        const expenseValue = Number(rev.breakdown?.expenses || 0);

        totalDinheiro += cashValue;
        totalTransferencias += transValue;
        totalTPA += tpaValue;
        totalDespesas += expenseValue;
        totalBruto += (cashValue + transValue + tpaValue);
        totalLiquidoPSM += Number(rev.amount || 0);
      });

      // Cover / Header Info
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(activeTenantData?.name.toUpperCase() || "PSM COMERCIAL. (SU), LDA LUENA-MOXICO", 105, 20, { align: "center" });
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text("SISTEMA TAXICONTROL - HUB DE CONTABILIDADE E AUDITORIA", 105, 26, { align: "center" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(220, 100, 20); // highlight/brand color
      doc.text("RESUMO CONSOLIDADO DE RECEITA DE RENDAS", 105, 34, { align: "center" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(dateRangeStr, 105, 41, { align: "center" });

      doc.setDrawColor(226, 232, 240); // slate-200
      doc.line(15, 46, 195, 46);

      // Add small summary boxes (styled visually)
      doc.setFillColor(248, 250, 252); // slate-50 background shadow
      doc.rect(15, 50, 180, 28, "F");
      doc.setDrawColor(226, 232, 240);
      doc.rect(15, 50, 180, 28, "S");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text("RENDIMENTO BRUTO DO PERÍODO:", 20, 56);
      doc.setFont("helvetica", "normal");
      doc.text(`Dinheiro: ${totalDinheiro.toLocaleString()} Kz`, 20, 62);
      doc.text(`Transferências: ${totalTransferencias.toLocaleString()} Kz`, 20, 68);
      doc.text(`TPA: ${totalTPA.toLocaleString()} Kz`, 20, 74);

      doc.setFont("helvetica", "bold");
      doc.text("DEDUÇÕES & CUSTOS:", 95, 56);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(225, 29, 72); // rose-600
      doc.text(`Despesas Oficinas/Outras: -${totalDespesas.toLocaleString()} Kz`, 95, 62);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("FALHAMENTOS & AJUSTES:", 95, 68);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text("Zero pendentes ou desvios", 95, 74);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(5, 150, 105); // emerald-600
      const tenantSlug = activeTenantData?.id.toUpperCase() || "PSM";
      doc.text(`TOTAL LÍQUIDO ${tenantSlug}:`, 152, 58);
      doc.setFontSize(13);
      doc.text(`${totalLiquidoPSM.toLocaleString()} Kz`, 152, 67);
      
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text("100% Auditado", 152, 73);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(`Lista de Recebimentos Realizados (Qtd: ${weeklyRevenues.length} fechos de caixa):`, 15, 87);

      // Table data
      const tableRows = weeklyRevenues.map((rev: any) => {
        const cashValue = Number(rev.breakdown?.cash || 0);
        const transValue = Number(rev.breakdown?.transfer || 0);
        const tpaValue = Number(rev.breakdown?.tpa || 0);
        const expenseValue = Number(rev.breakdown?.expenses || 0);
        const totalNetRow = Number(rev.amount || 0);

        return [
          rev.prefix || rev.vehiclePlate || "N/A",
          rev.driverName || "Motorista Oficial",
          rev.date || "N/A",
          `${cashValue.toLocaleString()} Kz`,
          `${transValue.toLocaleString()} Kz`,
          `${tpaValue.toLocaleString()} Kz`,
          `-${expenseValue.toLocaleString()} Kz`,
          `${totalNetRow.toLocaleString()} Kz`
        ];
      });

      // Add a final total row
      tableRows.push([
        "TOTAIS",
        "",
        "",
        `${totalDinheiro.toLocaleString()} Kz`,
        `${totalTransferencias.toLocaleString()} Kz`,
        `${totalTPA.toLocaleString()} Kz`,
        `-${totalDespesas.toLocaleString()} Kz`,
        `${totalLiquidoPSM.toLocaleString()} Kz`
      ]);

      autoTable(doc, {
        startY: 92,
        head: [["Pref.", "Motorista", "Data Fecho", "Dinheiro", "Transf.", "TPA", "Desp. / Ofic.", `Líq. ${tenantSlug}`]],
        body: tableRows,
        theme: "grid",
        headStyles: { fillColor: [15, 23, 42], fontSize: 8.5, fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: 12 },
          1: { cellWidth: 32 },
          2: { cellWidth: 19 },
          3: { cellWidth: 23 },
          4: { cellWidth: 23 },
          5: { cellWidth: 20 },
          6: { cellWidth: 23 },
          7: { cellWidth: 26 },
        },
        styles: { fontSize: 8, cellPadding: 2.5 },
        didParseCell: (data) => {
          // highlight totals row at the bottom
          if (data.row.index === tableRows.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [241, 245, 249];
            if (data.column.index === 7) {
              data.cell.styles.textColor = [5, 150, 105]; // Emerald
            }
          }
        }
      });

      // Signatures at the bottom
      const finalY = (doc as any).lastAutoTable.finalY || 120;
      
      if (finalY + 45 > 280) {
        doc.addPage();
        // and draw lines relative to top of new page
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        
        doc.line(20, 50, 85, 50);
        doc.text("O Contabilista Oficial", 52, 55, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text("Assinatura e Carimbo", 52, 60, { align: "center" });

        doc.line(125, 50, 190, 50);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("José Iweza Suana", 157, 55, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text("Administrador Geral / Fleet Operator", 157, 60, { align: "center" });
      } else {
        doc.line(20, finalY + 28, 85, finalY + 28);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("O Contabilista Oficial", 52, finalY + 33, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text("Assinatura e Carimbo", 52, finalY + 38, { align: "center" });

        doc.line(125, finalY + 28, 190, finalY + 28);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("José Iweza Suana", 157, finalY + 33, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text("Administrador Geral / Fleet Operator", 157, finalY + 38, { align: "center" });
      }

      // Footer
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(
        `Documento oficial consolidado e assinado digitalmente pelo TaxiControl em ${new Date().toLocaleString()}`,
        105,
        288,
        { align: "center" },
      );

      doc.save(`${tenantSlug}_Consolidado_Rendas_${consolidatedStartDate}_a_${consolidatedEndDate}.pdf`);
    } catch (err) {
      console.error("Erro ao gerar PDF Consolidado:", err);
      alert("Erro ao carregar renderizador PDF ou processar dados de receita.");
    }
  };

  const handleResetAccountingCycle = async () => {
    if (!isAdmin) return;
    if (
      !confirm(
        "ATENÇÃO: Deseja ZERAR o Hub de Contabilidade? Todos os dados de receita, alertas, histórico de análise, folhas de salário, despesas, relatórios individuais e auditorias de descontos serão completamente zerados e limpos. Esta operação é irreversível.",
      )
    )
      return;

    setIsProcessing(true);
    try {
      // 1. Archive Revenue Logs
      const revDocs = await getDocs(query(collection(db, "revenue_logs"), where("status", "!=", "archived")));
      
      const chunks = [];
      for (let i = 0; i < revDocs.docs.length; i += 500) {
        chunks.push(revDocs.docs.slice(i, i + 500));
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(d => {
          batch.update(d.ref, { status: "archived", archivedAt: serverTimestamp() });
        });
        await batch.commit();
      }

      // 2. Archive Individual Reports
      const reportBatch = writeBatch(db);
      individualReports.forEach(report => {
        if (report.status !== "archived") {
          reportBatch.update(doc(db, "individual_reports", report.id), { status: "archived" });
        }
      });
      try { await reportBatch.commit(); } catch (e) {}

      // 3. Archive Salary Sheets
      const sheetBatch = writeBatch(db);
      salarySheets.forEach(sheet => {
        if (sheet.status !== "archived") {
          sheetBatch.update(doc(db, "salary_sheets", sheet.id), { status: "archived" });
        }
      });
      try { await sheetBatch.commit(); } catch (e) {}

      // 4. Archive Expense Logs
      const expDocs = await getDocs(query(collection(db, "expense_logs"), where("status", "==", "approved")));
      const expBatch = writeBatch(db);
      expDocs.docs.forEach(d => expBatch.update(d.ref, { status: "archived" }));
      try { await expBatch.commit(); } catch (e) {}

      // 5. Reset Internal Contracts
      const internalDocs = await getDocs(query(collection(db, "internal_contracts"), where("paymentStatus", "==", "Pago")));
      const internalBatch = writeBatch(db);
      internalDocs.docs.forEach(d => internalBatch.update(d.ref, { paymentStatus: "Pendente" }));
      try { await internalBatch.commit(); } catch (e) {}

      // 6. Reset Calls & Alerts in Firestore
      try {
        const callsDocs = await getDocs(query(collection(db, "calls"), where("status", "==", "pending")));
        const callsBatch = writeBatch(db);
        callsDocs.docs.forEach(d => callsBatch.update(d.ref, { status: "resolved", resolvedAt: new Date().toISOString() }));
        await callsBatch.commit();
      } catch (e) {}

      // 7. Reset Driver/Vehicle Call Counts, Missed Calls & Panic/Speed Alerts
      const driversDocs = await getDocs(collection(db, "drivers"));
      const driversBatch = writeBatch(db);
      driversDocs.docs.forEach(d => {
        driversBatch.update(d.ref, { 
          callCount: 0,
          missedCalls: 0,
          recentCalls: [],
          speedAlerts: [],
          panicAlerts: [],
          sos: false,
        });
      });
      try { await driversBatch.commit(); } catch (e) {}

      // 8. Zerar Descontos e Subsídios Auditados e Limpar LocalStorage
      handleResetDiscountLogs();
      handleResetSubsidyLogs();

      // 9. Repor Estados Locais do React a ZERO
      setAllRevenues([]);
      setFinalizedRevenues([]);
      setSalarySheets([]);
      setIndividualReports([]);

      // 10. Disparar Eventos Centralizados para Reiniciar o 'Análise de Receitas & Custos do Motorista'
      window.dispatchEvent(new CustomEvent('accounting_hub_reset'));
      window.dispatchEvent(new CustomEvent('revenue_logs_updated'));

      alert("HUB DE CONTABILIDADE ZERADO COM SUCESSO!\n\nTodos os dados de receita, alertas de chamadas/velocidade, histórico de análise, relatórios individuais e auditoria de descontos foram reposição a zero.");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "accounting_cycle_reset");
      alert("Erro ao reiniciar ciclo contábil.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetMonthlyReports = async () => {
    if (!isAdmin) return;
    if (!confirm("Deseja apagar permanentemente todos os relatórios individuais deste mês?")) return;
    
    setIsProcessing(true);
    try {
      const batch = writeBatch(db);
      individualReports.forEach(report => {
        batch.delete(doc(db, "individual_reports", report.id));
      });
      await batch.commit();
      setIndividualReports([]);
      window.dispatchEvent(new CustomEvent('accounting_hub_reset'));
      alert("Relatórios individuais removidos com sucesso.");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "individual_reports");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateIndividualReports = async () => {
    setIsProcessing(true);
    try {
      // 1. Group revenue logs by driver for the current month
      const driverMap = new Map();
      
      const monthlyRevenues = finalizedRevenues.filter(rev => {
        if (!rev.driverId) return false;
        const revDate = rev.date || (rev.timestamp ? rev.timestamp.split("T")[0] : "");
        return revDate && revDate.startsWith(currentMonth);
      });
      
      monthlyRevenues.forEach(rev => {
        if (!driverMap.has(rev.driverId)) {
          driverMap.set(rev.driverId, {
            driverName: rev.driverName || "Motorista Desconhecido",
            totalGross: 0,
            totalCosts: 0,
            revenueCount: 0
          });
        }
        const stats = driverMap.get(rev.driverId);
        stats.totalGross += (rev.breakdown?.tpa || 0) + (rev.breakdown?.cash || 0) + (rev.breakdown?.transfer || 0);
        stats.totalCosts += (rev.breakdown?.expenses || 0);
        stats.revenueCount += 1;
      });

      const batch = writeBatch(db);
      for (const [driverId, stats] of driverMap.entries()) {
        const netIncome = stats.totalGross - stats.totalCosts;
        const tenPercent = netIncome * 0.1;
        
        // Find all existing reports for this driver in state
        const existingReports = individualReports.filter(r => r.driverId === driverId);
        
        if (existingReports.length > 0) {
          // Update the first one
          batch.update(doc(db, "individual_reports", existingReports[0].id), {
            totalGross: stats.totalGross,
            totalCosts: stats.totalCosts,
            baseSalary: tenPercent,
            days: stats.revenueCount,
            updatedAt: serverTimestamp()
          });
          
          // Delete any subsequent duplicate documents to clean up the database
          for (let i = 1; i < existingReports.length; i++) {
            batch.delete(doc(db, "individual_reports", existingReports[i].id));
          }
        } else {
          const newReportRef = doc(collection(db, "individual_reports"));
          batch.set(newReportRef, {
            driverId,
            driverName: stats.driverName,
            totalGross: stats.totalGross,
            totalCosts: stats.totalCosts,
            baseSalary: tenPercent,
            subs: 0,
            discounts: 0,
            days: stats.revenueCount,
            month: currentMonth,
            status: "pending",
            createdAt: serverTimestamp()
          });
        }
      }
      
      await batch.commit();
      alert("Relatórios individuais sincronizados com sucesso!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "individual_reports");
    } finally {
      setIsProcessing(false);
    }
  };

  const totalGrossIncome = finalizedRevenues.reduce(
    (acc, curr) =>
      acc +
      (curr.breakdown?.tpa || 0) +
      (curr.breakdown?.cash || 0) +
      (curr.breakdown?.transfer || 0),
    0,
  );
  const totalExpenses = finalizedRevenues.reduce(
    (acc, curr) => acc + (curr.breakdown?.expenses || 0),
    0,
  );
  const totalNetIncome = finalizedRevenues.reduce(
    (acc, curr) => acc + (curr.amount || 0),
    0,
  );

  const handleUpdateDiscount = async (reportId: string, value: number) => {
    try {
      await updateDoc(doc(db, "individual_reports", reportId), {
        discounts: value,
      });
      setEditingReport(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `individual_reports/${reportId}`);
    }
  };

  const handleUpdateSubs = async (reportId: string, value: number) => {
    try {
      await updateDoc(doc(db, "individual_reports", reportId), {
        subs: value,
      });
      setEditingReport(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `individual_reports/${reportId}`);
    }
  };

  const approveIndividualReport = async (
    reportId: string,
    currentStatus: string,
  ) => {
    try {
      const nextStatus =
        currentStatus === "pending"
          ? "approved_by_contab"
          : "approved_by_admin";
      await updateDoc(doc(db, "individual_reports", reportId), {
        status: nextStatus,
        approvedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error(error);
    }
  };

  const deleteIndividualReport = async (id: string) => {
    if (
      confirm(
        "Eliminar este relatório individual? Esta ação reverterá o estado para o cálculo dinâmico.",
      )
    ) {
      try {
        await deleteDoc(doc(db, "individual_reports", id));
      } catch (error) {
        console.error(error);
      }
    }
  };

  const deleteSalarySheet = async (id: string) => {
    if (
      confirm(
        "Tem certeza que deseja eliminar esta folha de salário? Esta ação é irreversível e os registos de faturamento permanecerão com o status atual.",
      )
    ) {
      try {
        await deleteDoc(doc(db, "salary_sheets", id));
        alert("Folha de salário eliminada com sucesso.");
      } catch (error) {
        console.error(error);
      }
    }
  };

  const approveSheet = async (sheetId: string) => {
    setIsProcessing(true);
    try {
      const sheet = salarySheets.find((s) => s.id === sheetId);
      if (!sheet) return;

      const nextStatus = sheet.status === "draft" ? "analyzed" : "approved";

      await updateDoc(doc(db, "salary_sheets", sheetId), {
        status: nextStatus,
        lastApprovedAt: serverTimestamp(),
      });

      if (nextStatus === "analyzed") {
        // "uma vez que o balanço e validado, zera o Relatório Analítico Individual para nao duplicar as mesmas contas"
        // 1. Set all related individual reports status to archived (which hides them from view and locks them)
        const relevantReports = individualReports.filter((r) => r.month === sheet.month);
        for (const report of relevantReports) {
          await updateDoc(doc(db, "individual_reports", report.id), {
            status: "archived",
          });
        }

        // 2. Archive corresponding revenues so they won't be counted again or duplicate the accounts
        const relevantRevenues = finalizedRevenues.filter((r) =>
          r.date?.startsWith(sheet.month)
        );
        for (const rev of relevantRevenues) {
          await updateDoc(doc(db, "revenue_logs", rev.id), {
            status: "archived",
            archivedAt: serverTimestamp(),
          });
        }

        alert(
          "Balanço validado com sucesso! Relatório Analítico Individual foi arquivado/zerado e as contas correspondentes foram guardadas para evitar duplicações."
        );
      }

      if (nextStatus === "approved") {
        // Trigger automatic messages (with proper targets and status so collaborators receive notifications on their dashboard)
        for (const person of sheet.staff) {
          if (person.id) {
            await addDoc(collection(db, "messages"), {
              type: "success",
              category: "salary_approval",
              title: "Salário Aprovado 💰",
              subject: "Salário Aprovado 💰",
              content: `Olá ${person.name}, o seu salário referente a ${sheet.month} foi aprovado e processado com sucesso. Base: ${person.baseSalary.toLocaleString()} Kz, Subsídios: ${(person.subsAliment + person.subsTransp).toLocaleString()} Kz, Descontos: ${person.discounts.toLocaleString()} Kz. Valor Líquido a Receber: ${person.netSalary.toLocaleString()} Kz. PSM LUENA MOXICO.`,
              targets: [person.id],
              to: person.id,
              toName: person.name,
              status: "unread",
              read: false,
              timestamp: new Date().toISOString()
            });
          }
        }

        // RESET LOGIC: "uma vez que os salários forem transferido, o sistema zera tudo para começar um ciclo novo limpo"
        // 1. Archive related revenues of this month/sheet to paid_to_staff / archived status to reset current cycle
        const relevantRevenues = finalizedRevenues.filter((r) =>
          r.date?.startsWith(sheet.month)
        );
        for (const rev of relevantRevenues) {
          await updateDoc(doc(db, "revenue_logs", rev.id), {
            status: "archived",
            archivedAt: serverTimestamp(),
          });
        }

        // 2. Archive related individual reports
        const relevantReports = individualReports.filter((r) => r.month === sheet.month);
        for (const report of relevantReports) {
          await updateDoc(doc(db, "individual_reports", report.id), {
            status: "archived",
          });
        }

        // 3. Reset internal drivers' call counts and recent alerts so everything starts completely fresh
        try {
          const driversDocs = await getDocs(collection(db, "drivers"));
          const driversBatch = writeBatch(db);
          driversDocs.docs.forEach(d => {
            driversBatch.update(d.ref, { 
              callCount: 0,
              recentCalls: [] 
            });
          });
          await driversBatch.commit();
        } catch (e) {
          console.warn("Erro ao zerar contadores de chamadas:", e);
        }

        alert(
          "Folha APROVADA e PAGAMENTOS PROCESSADOS! Mensagens de confirmação de salário enviadas e ciclo contábil reiniciado (tudo zerado e limpo!).",
        );
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 pb-20">
      {/* Navigation & Header matching RecruitmentPortal style */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between bg-white px-10 py-10 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-primary/5 rounded-full -mr-48 -mt-48 blur-[80px] opacity-50 group-hover:bg-brand-primary/10 transition-colors duration-700 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6">
          <div className="w-24 h-24 bg-slate-900 rounded-[2.5rem] flex items-center justify-center text-white shadow-2xl relative overflow-hidden group border-4 border-slate-100 ring-4 ring-slate-900/5 shrink-0">
            <Calculator className="relative z-10" size={42} />
            <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/40 to-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="absolute top-0 right-0 w-12 h-12 bg-brand-primary/20 blur-xl animate-pulse" />
          </div>
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <h2 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tighter uppercase italic flex items-center gap-3 leading-none">
                PS MOREIRA
              </h2>
              <div className="inline-flex w-fit px-4 py-1.5 bg-brand-primary text-white rounded-xl text-[11px] font-black uppercase tracking-[0.2em] italic shadow-lg shadow-brand-primary/20">
                HUB DE CONTABILIDADE
              </div>
            </div>
            <p className="text-[12px] text-slate-500 font-black uppercase tracking-[0.3em] mt-3 flex items-center gap-3">
              <span className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-ping shrink-0" />
              CENTRO INTEGRADO DE TESOURARIA & AUDITORIA FINANCEIRA
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-2 text-[10px] font-black text-slate-400 uppercase tracking-widest italic border-t border-slate-100 pt-4">
              <span className="flex items-center gap-2.5">
                <span className="text-slate-300">NIF:</span>
                <span className="text-slate-800">5001062654</span>
              </span>
              <span className="flex items-center gap-2.5">
                <span className="text-slate-300">UNIDADE:</span>
                <span className="text-slate-800">LUENA, MOXICO</span>
              </span>
              <span className="flex items-center gap-2.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100 shadow-sm">
                <ShieldCheck size={12} /> SISTEMA AUDITADO V.6.5 ESTÁVEL
              </span>
            </div>
          </div>
        </div>

        {/* Separator */}
        <div className="hidden lg:block w-px h-20 bg-slate-100 mx-10 relative z-10" />

        {/* Actions Group (Right Hand Side) */}
        <div className="relative z-10 flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-4 mt-6 lg:mt-0">
          {/* Seletor Dinâmico de Período do Relatório Consolidado */}
          <div className="flex items-center gap-2 bg-slate-100 px-4 py-2.5 rounded-xl border border-slate-200 shadow-inner">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">De:</span>
            <input
              type="date"
              value={consolidatedStartDate}
              onChange={(e) => setConsolidatedStartDate(e.target.value)}
              className="bg-transparent border-none text-[10px] font-extrabold text-slate-700 outline-none p-0 focus:ring-0 cursor-pointer"
            />
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest border-l border-slate-300 pl-2">Até:</span>
            <input
              type="date"
              value={consolidatedEndDate}
              onChange={(e) => setConsolidatedEndDate(e.target.value)}
              className="bg-transparent border-none text-[10px] font-extrabold text-slate-700 outline-none p-0 focus:ring-0 cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={generateWeeklyConsolidatedPDF}
              className="flex-1 sm:flex-initial px-5 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center justify-center gap-2 border border-emerald-500 shadow-md active:scale-95 hover:shadow-lg whitespace-nowrap cursor-pointer"
              title="Descarregar PDF consolidado com o total de rendas fechadas no período selecionado"
            >
              <Download size={13} />
              Consolidado (PDF)
            </button>

            {isAdmin && (
              <button
                onClick={handleResetAccountingCycle}
                disabled={isProcessing}
                className="flex-1 sm:flex-initial px-5 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all flex items-center justify-center gap-2 border border-rose-100 active:scale-95 whitespace-nowrap cursor-pointer"
              >
                {isProcessing ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <TrendingUp size={13} className="rotate-180" />
                )}
                Zerar Hub
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Tab selector row below header, matching RecruitmentPortal tabs style */}
      <div className="flex flex-wrap gap-4 p-1.5 bg-white border border-slate-200 rounded-[1.5rem] w-full max-w-[1400px] shadow-sm">
        {[
          { id: "revenue", label: "Fluxo de Renda", icon: Wallet, roles: ["operator", "contabilista", "admin"] },
          { id: "income", label: "Mapa de Faturamento", icon: TrendingUp },
          { id: "ranking", label: "Classificação de Produção", icon: Trophy, roles: ["operator", "contabilista", "admin"] },
          { id: "discounts_audit", label: "Descontos & Auditoria", icon: ShieldAlert, roles: ["operator", "contabilista", "admin"] },
          { id: "subsidies_audit", label: "Subsídios & Auditoria", icon: Gift, roles: ["operator", "contabilista", "admin"] },
          { id: "balance", label: "Balanço de Análise", icon: Calculator, roles: ["admin"] },
          { id: "individual", label: "Relatório Individual Analítico", icon: User, roles: ["operator", "contabilista", "admin"] },
          { id: "salaries", label: "Folha de Salários", icon: Users },
          { id: "invoicing", label: "Redactor Faturas", icon: FileText },
        ]
        .filter(tab => {
          if (!tab.roles) return true;
          return tab.roles.includes(user?.role) || (tab.roles.includes("admin") && isAdmin);
        })
        .map((tab) => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id as any)}
              className={cn(
                "flex items-center gap-3 px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap cursor-pointer",
                activeView === tab.id
                  ? "bg-brand-primary text-slate-900 shadow-sm"
                  : "text-slate-400 hover:text-slate-650 hover:bg-slate-50"
              )}
            >
              <TabIcon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeView === "revenue" && <RevenueManagement user={user} />}

      <AnimatePresence>
        {isReceiptModalOpen && activeReceipt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsReceiptModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-sm bg-[#fffcf5] rounded-[2rem] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.2)] border-2 border-[#e6dfc8] overflow-hidden relative"
            >
              {/* TIMBRE OFICIAL DA COMPANHIA */}
              <div className="bg-slate-900 text-white p-5 relative overflow-hidden border-b-2 border-amber-500">
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-amber-500/20 border border-amber-500/40 rounded-xl flex items-center justify-center text-amber-400 font-black">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <span className="text-[8px] font-black uppercase tracking-[0.25em] text-amber-400 block">
                        TIMBRE OFICIAL • RH & RECURSOS HUMANOS
                      </span>
                      <h3 className="text-sm font-black uppercase tracking-tight italic text-white">
                        PSM COMERCIAL (SU), LDA
                      </h3>
                      <p className="text-[8px] text-slate-300 font-bold uppercase tracking-wider">
                        SUPER TÁXI • LUENA, MOXICO
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsReceiptModalOpen(false)} 
                    className="w-7 h-7 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              <div className="p-4 border-b border-dashed border-[#e6dfc8] text-center bg-[#fdfbf7]">
                <h4 className="text-base font-black uppercase italic tracking-tighter text-slate-900">Bilhete de Salário</h4>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Ref: {receiptMonth} • {activeReceipt.dataProcessamento}</p>
              </div>

              <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar space-y-6">
                {/* Header Information - Compact */}
                <div className="space-y-3 bg-[#f7f3e9] p-4 rounded-2xl border border-[#e6dfc8]">
                  <div className="flex justify-between items-center">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Colaborador</span>
                    <span className="text-[10px] font-black text-slate-900 uppercase italic leading-none">{activeReceipt.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Categoria</span>
                    <input 
                      type="text" 
                      value={activeReceipt.categoria} 
                      onChange={(e) => setActiveReceipt({...activeReceipt, categoria: e.target.value})}
                      className="text-right text-[10px] font-bold text-slate-700 bg-transparent border-b border-transparent focus:border-brand-primary outline-none"
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Dias Trab.</span>
                    <input 
                      type="number" 
                      value={activeReceipt.diasTrabalho} 
                      onChange={(e) => setActiveReceipt({...activeReceipt, diasTrabalho: Number(e.target.value)})}
                      className="w-10 text-right text-[10px] font-bold text-slate-700 bg-transparent border-b border-transparent focus:border-brand-primary outline-none"
                    />
                  </div>
                </div>

                {/* Remunerations - Compact Stack */}
                <div className="space-y-3">
                  <h4 className="text-[8px] font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2">
                    <div className="w-1 h-3 bg-brand-primary rounded-full" />
                    Créditos de Remuneração
                  </h4>
                  <div className="space-y-0.5">
                    <ReceiptPostalField label="Salário Base" value={activeReceipt.salarioBase} onChange={(v) => setActiveReceipt({...activeReceipt, salarioBase: Number(v)})} />
                    <ReceiptPostalField label="S. Alimentação" value={activeReceipt.subsidioAlimentacao} onChange={(v) => setActiveReceipt({...activeReceipt, subsidioAlimentacao: Number(v)})} />
                    <ReceiptPostalField label="S. Transporte" value={activeReceipt.subsidioTransporte} onChange={(v) => setActiveReceipt({...activeReceipt, subsidioTransporte: Number(v)})} />
                    
                    <div className="pt-1 border-t border-[#e6dfc8]/50 mt-1">
                      <ReceiptPostalField label="S. Férias" value={activeReceipt.subsidioFerias} onChange={(v) => setActiveReceipt({...activeReceipt, subsidioFerias: Number(v)})} />
                      <ReceiptPostalField label="S. Reforço" value={activeReceipt.subsidioReforco} onChange={(v) => setActiveReceipt({...activeReceipt, subsidioReforco: Number(v)})} />
                      <ReceiptPostalField label="S. Renda 1" value={activeReceipt.subsidioRenda1} onChange={(v) => setActiveReceipt({...activeReceipt, subsidioRenda1: Number(v)})} />
                      <ReceiptPostalField label="S. Renda 2" value={activeReceipt.subsidioRenda2} onChange={(v) => setActiveReceipt({...activeReceipt, subsidioRenda2: Number(v)})} />
                      <ReceiptPostalField label="S. Renda 3" value={activeReceipt.subsidioRenda3} onChange={(v) => setActiveReceipt({...activeReceipt, subsidioRenda3: Number(v)})} />
                    </div>
                  </div>
                </div>

                {/* Discounts - Compact Stack */}
                <div className="space-y-3">
                  <h4 className="text-[8px] font-black text-rose-600 uppercase tracking-[0.2em] flex items-center gap-2">
                    <div className="w-1 h-3 bg-rose-500 rounded-full" />
                    Deduções & Faltas
                  </h4>
                  <div className="space-y-0.5">
                    <ReceiptPostalField label="Desconto Danos" value={activeReceipt.descontoDanos} onChange={(v) => setActiveReceipt({...activeReceipt, descontoDanos: Number(v)})} isDiscount />
                    <ReceiptPostalField label="Outros Desc." value={activeReceipt.outrosDescontos} onChange={(v) => setActiveReceipt({...activeReceipt, outrosDescontos: Number(v)})} isDiscount />
                  </div>
                </div>

                {/* Totals Section - Poster Style */}
                <div className="mt-8 p-6 bg-slate-900 rounded-[1.8rem] text-white shadow-xl shadow-slate-900/20 relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-12 -mt-12 blur-2xl" />
                   <div className="relative z-10 flex flex-col gap-1">
                      <div className="flex justify-between items-center text-[7px] font-black uppercase tracking-widest text-slate-400">
                         <span>Bruto Acumulado</span>
                         <span>{calculateReceiptTotals(activeReceipt).totalRemun.toLocaleString()} Kz</span>
                      </div>
                      <div className="flex justify-between items-center text-[7px] font-black uppercase tracking-widest text-rose-400">
                         <span>Retenções Totais</span>
                         <span>-{calculateReceiptTotals(activeReceipt).totalDisc.toLocaleString()} Kz</span>
                      </div>
                      <div className="h-px bg-white/10 my-2" />
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest leading-none mb-1">Valor Líquido a Receber</span>
                        <span className="text-3xl font-black italic tracking-tighter text-white">
                          {calculateReceiptTotals(activeReceipt).net.toLocaleString()} <span className="text-[10px] italic opacity-50 font-medium">Kz</span>
                        </span>
                      </div>
                   </div>
                </div>
              </div>

              <div className="p-6 bg-[#f7f3e9] border-t-2 border-dashed border-[#e6dfc8] flex flex-col gap-3">
                 <div className="grid grid-cols-2 gap-3">
                   <button 
                    onClick={() => handleDownloadReceiptPDF(activeReceipt)}
                    className="w-full py-3.5 bg-brand-primary text-white rounded-2xl text-[9.5px] font-black uppercase tracking-[0.15em] hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-primary/10 cursor-pointer"
                   >
                     <Download size={15} /> Exportar PDF
                   </button>
                   <button 
                    onClick={() => window.print()}
                    className="w-full py-3.5 bg-slate-900 text-amber-400 rounded-2xl text-[9.5px] font-black uppercase tracking-[0.15em] hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10 cursor-pointer border border-slate-700"
                   >
                     <Printer size={15} /> Imprimir Recibo
                   </button>
                 </div>
                 <button 
                  onClick={() => handleSendWhatsApp(activeReceipt)}
                  className="w-full py-3.5 bg-emerald-500 text-white rounded-2xl text-[9.5px] font-black uppercase tracking-[0.15em] hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 cursor-pointer"
                 >
                   <Send size={15} /> Enviar p/ Colaborador (WhatsApp)
                 </button>
                 <p className="text-[7px] text-slate-400 text-center font-black uppercase tracking-[0.2em] italic">Comprovativo PSM TAXICONTROL • Luena, Moxico • v.6.5</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

        {selectedDriverForDiscount && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDriverForDiscount(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden relative z-10 p-8 space-y-6"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center font-black">
                    <DollarSign size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase text-slate-900 italic tracking-tight">Registar Descontos</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedDriverForDiscount.driverName}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedDriverForDiscount(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveDriverDiscounts} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                    Desconto por Manutenção (Kz)
                  </label>
                  <input 
                    type="number"
                    min="0"
                    value={discountForm.manutencao}
                    onChange={(e) => setDiscountForm({...discountForm, manutencao: Number(e.target.value)})}
                    placeholder="Ex: 5000"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                    Multas de Trânsito / Infrações (Kz)
                  </label>
                  <input 
                    type="number"
                    min="0"
                    value={discountForm.multas}
                    onChange={(e) => setDiscountForm({...discountForm, multas: Number(e.target.value)})}
                    placeholder="Ex: 2500"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                    Adiantamentos / Válens (Kz)
                  </label>
                  <input 
                    type="number"
                    min="0"
                    value={discountForm.adiantamentos}
                    onChange={(e) => setDiscountForm({...discountForm, adiantamentos: Number(e.target.value)})}
                    placeholder="Ex: 10000"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                    Outros Descontos / Danos (Kz)
                  </label>
                  <input 
                    type="number"
                    min="0"
                    value={discountForm.outros}
                    onChange={(e) => setDiscountForm({...discountForm, outros: Number(e.target.value)})}
                    placeholder="Ex: 1500"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div className="pt-2">
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl mb-4 flex items-center justify-between text-xs font-black text-rose-700">
                    <span className="uppercase text-[9px] tracking-widest">Total de Descontos a Subtrair:</span>
                    <span className="font-mono text-sm">{((Number(discountForm.manutencao)||0) + (Number(discountForm.multas)||0) + (Number(discountForm.adiantamentos)||0) + (Number(discountForm.outros)||0)).toLocaleString()} Kz</span>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedDriverForDiscount(null)}
                      className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="w-1/2 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-lg shadow-rose-600/20"
                    >
                      Guardar Descontos
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}

      {activeView === "invoicing" && <InvoiceDrafting />}

      {activeView === "discounts_audit" && (
        <DriverDiscountsAudit
          drivers={driverRankingList}
          user={user}
          discountAuditLogs={discountAuditLogs}
          onAddDiscountLog={handleAddDiscountLog}
          onDeleteDiscountLog={handleDeleteDiscountLog}
          onResetDiscountLogs={handleResetDiscountLogs}
          currentMonth={currentMonth}
        />
      )}

      {activeView === "subsidies_audit" && (
        <DriverSubsidiesAudit
          drivers={driverRankingList}
          user={user}
          subsidyAuditLogs={subsidyAuditLogs}
          onAddSubsidyLog={handleAddSubsidyLog}
          onDeleteSubsidyLog={handleDeleteSubsidyLog}
          onResetSubsidyLogs={handleResetSubsidyLogs}
          currentMonth={currentMonth}
        />
      )}

      {activeView === "ranking" && (
        <div className="space-y-10 animate-in fade-in duration-300">
          {/* Header Banner & Controls */}
          <div className="bg-slate-900 rounded-[2.5rem] p-8 md:p-10 text-white shadow-2xl relative overflow-hidden border border-white/10">
            <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full -mr-40 -mt-40 blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                    <Trophy size={22} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-400">
                    PSM COMERCIAL • SUPER TÁXI (JIS ANGOLA)
                  </span>
                </div>
                <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter italic">
                  Classificação de Produção dos Motoristas
                </h2>
                <p className="text-xs text-slate-400 max-w-2xl font-medium">
                  Apuramento hierárquico de faturação e produtividade em tempo real. Pódio de destaques em evidência (Ouro 🥇, Prata 🥈 e Bronze 🥉) e tabela completa do 1º ao último classificado.
                </p>
              </div>

              {/* Action & Filter Controls */}
              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <div className="flex items-center p-1 bg-white/5 border border-white/10 rounded-2xl">
                  <button
                    onClick={() => setRankingPeriodFilter("current_month")}
                    className={cn(
                      "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer",
                      rankingPeriodFilter === "current_month"
                        ? "bg-amber-500 text-slate-950 font-black shadow-lg"
                        : "text-slate-400 hover:text-white"
                    )}
                  >
                    Mês Atual ({currentMonth})
                  </button>
                  <button
                    onClick={() => setRankingPeriodFilter("all")}
                    className={cn(
                      "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer",
                      rankingPeriodFilter === "all"
                        ? "bg-amber-500 text-slate-950 font-black shadow-lg"
                        : "text-slate-400 hover:text-white"
                    )}
                  >
                    Consolidado Total
                  </button>
                </div>

                <button
                  onClick={exportRankingToPDF}
                  className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-xl shadow-amber-500/10 cursor-pointer"
                >
                  <Download size={15} /> Exportar Ranking PDF
                </button>
              </div>
            </div>
          </div>

          {/* PODIUM HIGHLIGHTS (Top 3 Produção) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 1º LUGAR (OURO) */}
            {driverRankingList[0] ? (
              <div className="relative bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-slate-900 border-2 border-amber-400/80 rounded-[2.5rem] p-8 text-white shadow-2xl overflow-hidden group hover:scale-[1.02] transition-all">
                <div className="absolute top-4 right-4 bg-amber-400 text-slate-950 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-lg">
                  <Crown size={13} /> 1º Lugar • Ouro
                </div>
                <div className="w-14 h-14 rounded-2xl bg-amber-400/20 border border-amber-400/50 flex items-center justify-center text-amber-300 mb-6 shadow-inner">
                  <Trophy size={28} />
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest">Campeão de Produção</span>
                  <h3 className="text-2xl font-black uppercase tracking-tight text-white">{driverRankingList[0].driverName}</h3>
                  <p className="text-xs text-slate-400 font-mono font-bold">
                    PSM COMERCIAL • SUPER TÁXI
                  </p>
                </div>

                <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Total Produzido</span>
                    <span className="text-2xl font-black text-emerald-400 font-mono italic">
                      {driverRankingList[0].totalGross.toLocaleString()} <span className="text-xs opacity-60">Kz</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Salário (10%)</span>
                    <span className="text-xl font-black text-amber-400 font-mono italic">
                      {(driverRankingList[0].totalGross * 0.1).toLocaleString()} <span className="text-xs opacity-60">Kz</span>
                    </span>
                  </div>
                </div>

                <div className="mt-4 bg-amber-500/20 rounded-xl p-3 border border-amber-500/30 flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase text-amber-300">Nº de Dias com Registos</span>
                  <span className="text-xs font-black text-white">{driverRankingList[0].logCount} dia(s)</span>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 text-center text-slate-500">
                Sem dados para 1º Lugar
              </div>
            )}

            {/* 2º LUGAR (PRATA) */}
            {driverRankingList[1] ? (
              <div className="relative bg-gradient-to-br from-slate-300/10 via-slate-400/5 to-slate-900 border-2 border-slate-300/60 rounded-[2.5rem] p-8 text-white shadow-xl overflow-hidden group hover:scale-[1.02] transition-all">
                <div className="absolute top-4 right-4 bg-slate-200 text-slate-900 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-md">
                  <Medal size={13} /> 2º Lugar • Prata
                </div>
                <div className="w-14 h-14 rounded-2xl bg-slate-300/20 border border-slate-300/40 flex items-center justify-center text-slate-300 mb-6">
                  <Medal size={28} />
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Vice-Campeão</span>
                  <h3 className="text-2xl font-black uppercase tracking-tight text-white">{driverRankingList[1].driverName}</h3>
                  <p className="text-xs text-slate-400 font-mono font-bold">
                    PSM COMERCIAL • SUPER TÁXI
                  </p>
                </div>

                <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Total Produzido</span>
                    <span className="text-2xl font-black text-emerald-400 font-mono italic">
                      {driverRankingList[1].totalGross.toLocaleString()} <span className="text-xs opacity-60">Kz</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Salário (10%)</span>
                    <span className="text-xl font-black text-slate-300 font-mono italic">
                      {(driverRankingList[1].totalGross * 0.1).toLocaleString()} <span className="text-xs opacity-60">Kz</span>
                    </span>
                  </div>
                </div>

                <div className="mt-4 bg-slate-100/10 rounded-xl p-3 border border-slate-300/20 flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase text-slate-300">% em Relação ao 1º</span>
                  <span className="text-xs font-black text-white">
                    {driverRankingList[0]?.totalGross ? ((driverRankingList[1].totalGross / driverRankingList[0].totalGross) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 text-center text-slate-500">
                Sem dados para 2º Lugar
              </div>
            )}

            {/* 3º LUGAR (BRONZE) */}
            {driverRankingList[2] ? (
              <div className="relative bg-gradient-to-br from-amber-800/20 via-orange-900/10 to-slate-900 border-2 border-amber-700/50 rounded-[2.5rem] p-8 text-white shadow-xl overflow-hidden group hover:scale-[1.02] transition-all">
                <div className="absolute top-4 right-4 bg-amber-700 text-amber-100 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-md">
                  <Award size={13} /> 3º Lugar • Bronze
                </div>
                <div className="w-14 h-14 rounded-2xl bg-amber-700/20 border border-amber-700/40 flex items-center justify-center text-amber-500 mb-6">
                  <Award size={28} />
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Terceiro Colocado</span>
                  <h3 className="text-2xl font-black uppercase tracking-tight text-white">{driverRankingList[2].driverName}</h3>
                  <p className="text-xs text-slate-400 font-mono font-bold">
                    PSM COMERCIAL • SUPER TÁXI
                  </p>
                </div>

                <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Total Produzido</span>
                    <span className="text-2xl font-black text-emerald-400 font-mono italic">
                      {driverRankingList[2].totalGross.toLocaleString()} <span className="text-xs opacity-60">Kz</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Salário (10%)</span>
                    <span className="text-xl font-black text-amber-500 font-mono italic">
                      {(driverRankingList[2].totalGross * 0.1).toLocaleString()} <span className="text-xs opacity-60">Kz</span>
                    </span>
                  </div>
                </div>

                <div className="mt-4 bg-amber-700/20 rounded-xl p-3 border border-amber-700/30 flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase text-amber-400">% em Relação ao 1º</span>
                  <span className="text-xs font-black text-white">
                    {driverRankingList[0]?.totalGross ? ((driverRankingList[2].totalGross / driverRankingList[0].totalGross) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 text-center text-slate-500">
                Sem dados para 3º Lugar
              </div>
            )}
          </div>

          {/* TABELA DE CLASSIFICAÇÃO COMPLETA (1º AO ÚLTIMO CLASSIFICADO) */}
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between bg-slate-50/60 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center shrink-0">
                  <Trophy size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-tight italic">
                    Tabela Hierárquica Completa de Produção
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    Listagem ordenada da maior para a menor faturação ({filteredRankingList.length} motoristas)
                  </p>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative w-full md:w-80">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={rankingSearchTerm}
                  onChange={(e) => setRankingSearchTerm(e.target.value)}
                  placeholder="Pesquisar motorista..."
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white text-[9.5px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                    <th className="px-6 py-4 text-center">Classificação</th>
                    <th className="px-6 py-4">Motorista</th>
                    <th className="px-6 py-4 text-center">Registos</th>
                    <th className="px-6 py-4 text-right">Produção Bruta (Kz)</th>
                    <th className="px-6 py-4 text-right">Despesas Operacionais</th>
                    <th className="px-6 py-4 text-right font-black">Descontos</th>
                    <th className="px-6 py-4 text-right font-black">Total Líquido (Kz)</th>
                    <th className="px-6 py-4 text-right font-black">Salário 10%</th>
                    <th className="px-6 py-4 text-center">% vs Líder</th>
                    <th className="px-6 py-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRankingList.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-20 text-center text-slate-400 italic text-xs uppercase font-bold">
                        Nenhum motorista encontrado no ranking
                      </td>
                    </tr>
                  ) : (
                    filteredRankingList.map((driver, index) => {
                      const pos = index + 1;
                      const isTop1 = pos === 1;
                      const isTop2 = pos === 2;
                      const isTop3 = pos === 3;
                      const isTop10 = pos <= 10;
                      const leaderGross = driverRankingList[0]?.totalGross || 1;
                      const pctVsLeader = leaderGross > 0 ? (driver.totalGross / leaderGross) * 100 : 0;

                      let posBadge = (
                        <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 font-black text-xs flex items-center justify-center mx-auto border border-slate-200">
                          #{pos}
                        </span>
                      );

                      if (isTop1) {
                        posBadge = (
                          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 font-black text-xs flex items-center justify-center mx-auto shadow-md shadow-amber-500/20 border border-amber-300">
                            1º 🥇
                          </span>
                        );
                      } else if (isTop2) {
                        posBadge = (
                          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-200 to-slate-300 text-slate-900 font-black text-xs flex items-center justify-center mx-auto shadow-sm border border-slate-300">
                            2º 🥈
                          </span>
                        );
                      } else if (isTop3) {
                        posBadge = (
                          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-700 to-orange-800 text-amber-100 font-black text-xs flex items-center justify-center mx-auto shadow-sm border border-amber-600">
                            3º 🥉
                          </span>
                        );
                      } else if (isTop10) {
                        posBadge = (
                          <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 font-black text-xs flex items-center justify-center mx-auto border border-blue-200">
                            #{pos}
                          </span>
                        );
                      }

                      return (
                        <tr
                          key={driver.driverId || driver.driverName || index}
                          className={cn(
                            "transition-colors group",
                            isTop1 ? "bg-amber-500/5 hover:bg-amber-500/10" :
                            isTop2 ? "bg-slate-50 hover:bg-slate-100/80" :
                            isTop3 ? "bg-orange-500/5 hover:bg-orange-500/10" :
                            "hover:bg-slate-50"
                          )}
                        >
                          <td className="px-6 py-5 text-center">
                            {posBadge}
                          </td>

                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3.5">
                              <div className={cn(
                                "w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-sm",
                                isTop1 ? "bg-amber-400 text-slate-950" :
                                isTop2 ? "bg-slate-300 text-slate-900" :
                                isTop3 ? "bg-amber-700 text-amber-100" :
                                "bg-slate-100 text-slate-600"
                              )}>
                                {driver.driverName[0] || 'M'}
                              </div>
                              <div>
                                <p className="text-xs font-black uppercase text-slate-900 tracking-tight flex items-center gap-2">
                                  {driver.driverName}
                                  {isTop1 && (
                                    <span className="bg-amber-400/20 text-amber-700 border border-amber-400/40 text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-widest">
                                      Líder
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-5 text-center">
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[10px] font-black rounded-lg font-mono">
                              {driver.logCount} dia(s)
                            </span>
                          </td>

                          <td className="px-6 py-5 text-right font-mono text-sm font-black text-emerald-600 italic">
                            {driver.totalGross.toLocaleString()} <span className="text-[9px] opacity-60 text-slate-400">Kz</span>
                          </td>

                          <td className="px-6 py-5 text-right font-mono text-xs font-black text-rose-500">
                            {driver.totalExpenses.toLocaleString()} Kz
                          </td>

                          <td className="px-6 py-5 text-right font-mono text-xs font-black text-rose-600">
                            {driver.totalDiscounts.toLocaleString()} Kz
                          </td>

                          <td className="px-6 py-5 text-right font-mono text-xs font-black text-emerald-700 bg-emerald-500/10 rounded-xl">
                            {driver.totalNet.toLocaleString()} Kz
                          </td>

                          <td className="px-6 py-5 text-right font-mono text-xs font-black text-amber-500 italic">
                            {(driver.totalGross * 0.1).toLocaleString()} Kz
                          </td>

                          <td className="px-6 py-5">
                            <div className="w-24 mx-auto space-y-1">
                              <div className="flex items-center justify-between text-[8.5px] font-black text-slate-500 font-mono">
                                <span>{pctVsLeader.toFixed(0)}%</span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all duration-500",
                                    isTop1 ? "bg-amber-500" :
                                    isTop2 ? "bg-slate-400" :
                                    isTop3 ? "bg-amber-700" :
                                    "bg-blue-500"
                                  )}
                                  style={{ width: `${Math.min(100, Math.max(2, pctVsLeader))}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-5 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => {
                                  generateIndividualSlip(
                                    {
                                      name: driver.driverName,
                                      role: "Motorista",
                                      days: driver.logCount || 0,
                                      baseSalary: driver.totalGross * 0.1,
                                      totalDiscounts: driver.totalDiscounts,
                                    },
                                    currentMonth
                                  );
                                }}
                                className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500 text-amber-700 hover:text-slate-950 border border-amber-500/30 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-sm"
                                title="Ver e Imprimir Recibo do Motorista"
                              >
                                Ver Recibo
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeView === "balance" && (
        <div className="space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/5 rounded-full -mr-32 -mt-32 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
              <div className="flex items-center justify-between mb-10 relative z-10">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">
                    Fluxo de Caixa Analítico
                  </h3>
                  <div className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] mt-2 flex items-center gap-3">
                    <div className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-pulse" />
                    HISTÓRICO DE DESEMPENHO FINANCEIRO • 15 DIAS
                  </div>
                </div>
                <button
                  onClick={() => exportToPDF("balance", {})}
                  className="w-12 h-12 flex items-center justify-center bg-slate-50 text-slate-400 rounded-2xl hover:bg-brand-primary hover:text-white transition-all shadow-sm"
                >
                  <Download size={20} />
                </button>
              </div>

              <div className="h-[400px] relative z-10">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={finalizedRevenues
                      .reduce((acc: any[], curr) => {
                        const date = curr.date;
                        const existing = acc.find((a) => a.date === date);
                        if (existing) existing.total += curr.amount || 0;
                        else acc.push({ date, total: curr.amount || 0 });
                        return acc;
                      }, [])
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .slice(-15)}
                  >
                    <CartesianGrid
                      strokeDasharray="10 10"
                      vertical={false}
                      stroke="#f1f5f9"
                    />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fontWeight: 900, fill: "#94a3b8" }}
                      tickFormatter={(val) =>
                        val.split("-").slice(1).reverse().join("/")
                      }
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fontWeight: 900, fill: "#94a3b8" }}
                      tickFormatter={(val) => `${val / 1000}k`}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        borderRadius: "24px",
                        border: "none",
                        boxShadow: "0 25px 50px -12px rgb(0 0 0 / 0.15)",
                        padding: "20px",
                      }}
                      itemStyle={{
                        fontSize: "12px",
                        fontWeight: 900,
                        textTransform: "uppercase",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="#2563eb"
                      strokeWidth={5}
                      dot={{
                        r: 6,
                        fill: "#2563eb",
                        strokeWidth: 3,
                        stroke: "#fff",
                      }}
                      activeDot={{ r: 10, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-8">
              <div className="bg-slate-900 p-10 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-48 h-48 bg-brand-primary/20 rounded-full -mr-24 -mt-24 blur-3xl group-hover:scale-150 transition-transform duration-1000" />
                <div className="relative z-10">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-6 italic">
                    Liquidez Mensal
                  </p>
                  <h4 className="text-4xl font-black italic tracking-tighter mb-4">
                    {finalizedRevenues
                      .reduce((acc, curr) => acc + (curr.amount || 0), 0)
                      .toLocaleString()}{" "}
                    <span className="text-xl opacity-40 uppercase">Kz</span>
                  </h4>
                  <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-xl border border-white/10 w-fit">
                    <TrendingUp size={16} className="text-emerald-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                      Desempenho Estável
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] italic">
                    Distribuição de Status
                  </h4>
                  <Calculator size={18} className="text-slate-300" />
                </div>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-tight">
                      Rendas Pagas
                    </span>
                    <span className="text-xs font-black text-emerald-600 italic">
                      {
                        finalizedRevenues.filter(
                          (r) => r.status === "paid_to_staff",
                        ).length
                      }{" "}
                      Unidades
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-1000"
                      style={{ width: "85%" }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeView === "income" ? (
        <div className="space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <StatBox
              label="Faturamento Bruto (Mês)"
              value={totalGrossIncome}
              color="emerald"
              icon={TrendingUp}
              sub="Total Entradas"
            />
            <StatBox
              label="Custos Operacionais"
              value={totalExpenses}
              color="rose"
              icon={ArrowDownRight}
              sub="Despesas PSM"
            />
            <StatBox
              label="Rendimento Líquido"
              value={totalNetIncome}
              color="blue"
              icon={Wallet}
              sub="Cofre Disponível"
            />
          </div>

          {/* Quick Ranking Highlights Widget in Income View */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 rounded-[2rem] border border-slate-800 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                <Trophy size={24} />
              </div>
              <div>
                <h4 className="text-sm font-black uppercase tracking-tight italic flex items-center gap-2">
                  Líderes de Produção do Mês ({currentMonth})
                  <span className="bg-amber-400/20 text-amber-300 text-[8px] px-2 py-0.5 rounded-full border border-amber-400/30">Top 3</span>
                </h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                  1º: {driverRankingList[0] ? `${driverRankingList[0].driverName} (${driverRankingList[0].totalGross.toLocaleString()} Kz)` : 'N/A'} • 2º: {driverRankingList[1] ? driverRankingList[1].driverName : 'N/A'} • 3º: {driverRankingList[2] ? driverRankingList[2].driverName : 'N/A'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setActiveView("ranking")}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer shadow-lg shadow-amber-500/10"
            >
              Ver Classificação Completa <ArrowUpRight size={14} />
            </button>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden group">
            <div className="px-10 py-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between bg-slate-50/50 gap-6">
              <div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter italic flex items-center gap-3">
                  <TrendingUp className="text-emerald-500" size={24} />
                  Mapa de Rendimentos: {currentMonth}
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">
                  Dados auditados e validados pela tesouraria central
                </p>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={exportMapToPDF}
                  className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2 shadow-xl shadow-black/10"
                >
                  <Download size={16} /> Exportar Balanço Geral
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                    <th className="px-10 py-5">Data</th>
                    <th className="px-10 py-5">Colaborador</th>
                    <th className="px-10 py-5 text-center">
                      Rendimento
                    </th>
                    <th className="px-10 py-5 text-center">
                      Custos
                    </th>
                    <th className="px-10 py-5 text-right font-black">Salário 10%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {finalizedRevenues.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-32 text-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                          <TrendingUp className="text-slate-200" size={32} />
                        </div>
                        <p className="opacity-30 italic text-xs uppercase font-black tracking-widest text-slate-400">
                          Sem dados consolidados para este período
                        </p>
                      </td>
                    </tr>
                  ) : (
                    finalizedRevenues.map((rev) => (
                      <tr
                        key={rev.id}
                        className="hover:bg-slate-50 transition-colors group/row"
                      >
                        <td className="px-10 py-6 text-[10px] text-slate-400 font-black tracking-widest italic uppercase">
                          {rev.date}
                        </td>
                        <td className="px-10 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 font-black group-hover/row:bg-brand-primary group-hover/row:text-white transition-all text-[10px]">
                              {rev.driverName[0]}
                            </div>
                            <p className="text-xs font-black uppercase text-slate-900 tracking-tight">
                              {rev.driverName}
                            </p>
                          </div>
                        </td>
                        <td className="px-10 py-6 text-center text-[12px] font-bold text-slate-600 font-mono">
                          {(
                            (rev.breakdown?.tpa || 0) +
                            (rev.breakdown?.cash || 0) +
                            (rev.breakdown?.transfer || 0)
                          ).toLocaleString()}{" "}
                          Kz
                        </td>
                        <td className="px-10 py-6 text-center text-[12px] font-black text-rose-500 font-mono">
                          {(rev.breakdown?.expenses || 0).toLocaleString()} Kz
                        </td>
                        <td className="px-10 py-6 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <span className="text-[14px] font-black text-brand-primary tracking-tighter italic">
                              {((rev.amount || 0) * 0.1).toLocaleString()}{" "}
                              <span className="text-[9px] opacity-40">Kz</span>
                            </span>
                            {isAdmin && (
                              <button
                                onClick={async () => {
                                  if (
                                    confirm("Eliminar este registo de rendimento?")
                                  ) {
                                    await deleteDoc(
                                      doc(db, "revenue_logs", rev.id),
                                    );
                                  }
                                }}
                                className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                title="Eliminar Registo"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {finalizedRevenues.length > 0 && (
                  <tfoot className="bg-slate-900 text-white">
                    <tr>
                      <td className="px-10 py-8 font-black uppercase text-xs tracking-widest border-t border-white/5">
                        Fecho Mensal PSM
                      </td>
                      <td className="px-10 py-8 text-center text-lg font-black tracking-tighter italic border-t border-white/5 text-slate-400">
                        {(totalGrossIncome || 0).toLocaleString()} Kz
                      </td>
                      <td className="px-10 py-8 text-center text-lg font-black tracking-tighter italic border-t border-white/5 text-rose-400">
                        {(totalExpenses || 0).toLocaleString()} Kz
                      </td>
                      <td className="px-10 py-8 text-center text-lg font-black tracking-tighter italic border-t border-white/5 text-blue-400">
                        {((totalNetIncome || 0) * 0.1).toLocaleString()} Kz
                      </td>
                      <td className="px-10 py-8 text-right text-3xl font-black tracking-tighter italic border-t border-white/5 text-emerald-400">
                        {(totalNetIncome || 0).toLocaleString()} Kz
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      ) : activeView === "salaries" ? (
        <div className="space-y-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-[2rem] border border-slate-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white">
                <Users size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic">
                  Folhas de Pagamento
                </h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                  Gestão de remunerações staff administrativo e operacional
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAdminStaffForm(!showAdminStaffForm)}
                className="flex items-center gap-2 px-6 py-4 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all font-bold"
              >
                <Users size={16} /> Gestão Staff Fixo
              </button>
              <button
                onClick={handleGenerateSheet}
                disabled={isProcessing}
                className="bg-brand-primary text-white px-10 py-4 rounded-[1.25rem] text-[11px] font-black uppercase tracking-widest hover:bg-brand-secondary transition-all flex items-center gap-3 shadow-2xl shadow-blue-600/30 active:scale-95 disabled:opacity-50 font-bold"
              >
                {isProcessing ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Calculator size={18} />
                )}
                Processar Nova Folha Bancária
              </button>
            </div>
          </div>

          <AnimatePresence>
            {showAdminStaffForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl mb-10 space-y-8 relative">
                  <div className="absolute top-0 right-0 p-8 opacity-[0.03] rotate-12 pointer-events-none">
                    <Users size={120} />
                  </div>

                  <div className="flex items-center justify-between border-b border-slate-100 pb-6">
                    <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                      <Pencil size={14} className="text-brand-primary" />
                      {editingAdminStaffId
                        ? `Editando: ${newAdminStaff.name}`
                        : "Gestão de Staff Reservado (Admin/Gerais)"}
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-400 rounded text-[9px] font-bold tracking-normal italic uppercase tracking-widest">
                        Controlo Manual
                      </span>
                    </h4>
                    <button
                      onClick={() => setShowAdminStaffForm(false)}
                      className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
                        Nome Completo
                      </label>
                      <input
                        type="text"
                        value={newAdminStaff.name}
                        onChange={(e) =>
                          setNewAdminStaff({
                            ...newAdminStaff,
                            name: e.target.value.toUpperCase(),
                          })
                        }
                        placeholder="EX: PAULO S. MOREIRA"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-brand-primary transition-all uppercase"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
                        Função / Cargo
                      </label>
                      <input
                        type="text"
                        value={newAdminStaff.role}
                        onChange={(e) =>
                          setNewAdminStaff({
                            ...newAdminStaff,
                            role: e.target.value.toUpperCase(),
                          })
                        }
                        placeholder="EX: CONTABILISTA"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-brand-primary transition-all uppercase"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
                        Salário Base (Kz)
                      </label>
                      <input
                        type="number"
                        value={newAdminStaff.base}
                        onChange={(e) =>
                          setNewAdminStaff({
                            ...newAdminStaff,
                            base: Number(e.target.value),
                          })
                        }
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-brand-primary transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
                        Telefone (+244)
                      </label>
                      <input
                        type="text"
                        value={newAdminStaff.phone}
                        onChange={(e) =>
                          setNewAdminStaff({
                            ...newAdminStaff,
                            phone: e.target.value,
                          })
                        }
                        placeholder="9XX XXX XXX"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-brand-primary transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
                        Subsídios Totais (Kz)
                      </label>
                      <div className="flex gap-3">
                        <input
                          type="number"
                          value={newAdminStaff.subs}
                          onChange={(e) =>
                            setNewAdminStaff({
                              ...newAdminStaff,
                              subs: Number(e.target.value),
                            })
                          }
                          className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-brand-primary transition-all"
                        />
                        <button
                          onClick={handleAddAdminStaff}
                          className="px-6 bg-brand-primary text-white rounded-xl hover:bg-brand-secondary transition-all flex items-center justify-center shadow-lg shadow-blue-600/20 active:scale-95"
                        >
                          {editingAdminStaffId ? (
                            <CheckCircle2 size={20} />
                          ) : (
                            <Plus size={20} />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-8 border-t border-slate-50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {administrativeStaff.map((staff) => (
                        <div
                          key={staff.id}
                          className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 group/item hover:bg-white hover:shadow-xl hover:border-brand-primary/20 transition-all cursor-default"
                        >
                          <div>
                            <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight italic">
                              {staff.name}
                            </p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5 tracking-widest italic">
                              {staff.role} •{" "}
                              {(staff.base + staff.subs).toLocaleString()} Kz
                              {staff.phone && ` • ${staff.phone}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditAdminStaff(staff)}
                              className="p-2 text-slate-300 hover:text-brand-primary hover:bg-brand-primary/10 rounded-lg opacity-0 group-hover/item:opacity-100 transition-all shadow-sm"
                              title="Editar Funcionário"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteAdminStaff(staff.id)}
                              className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg opacity-0 group-hover/item:opacity-100 transition-all shadow-sm"
                              title="Remover Funcionário"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 gap-12">
            {salarySheets.length === 0 ? (
              <div className="bg-white p-32 rounded-[3rem] border border-slate-200 border-dashed text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                  <Users size={40} className="text-slate-200" />
                </div>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">
                  Ambiente sem registos de payroll activos
                </p>
              </div>
            ) : (
              salarySheets.map((sheet) => (
                <motion.div
                  key={sheet.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden group"
                >
                  <div className="px-10 py-10 flex flex-col xl:flex-row xl:items-center justify-between bg-slate-900 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-[50%] h-full bg-brand-primary/5 -mr-40 rotate-12 blur-3xl pointer-events-none" />

                    <div className="relative z-10 flex items-center gap-8">
                      <div className="w-20 h-20 bg-brand-primary rounded-[2rem] flex items-center justify-center shadow-2xl shadow-brand-primary/20 rotate-3 group-hover:rotate-0 transition-transform duration-700">
                        <FileText size={36} />
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-2xl font-black uppercase tracking-tighter italic">
                            PSM PAYROLL: {sheet.month}
                          </h4>
                          <span
                            className={cn(
                              "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-white/10",
                              sheet.status === "draft"
                                ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                : sheet.status === "analyzed"
                                  ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                            )}
                          >
                            {sheet.status === "draft"
                              ? "Rascunho"
                              : sheet.status === "analyzed"
                                ? "Analítica"
                                : "Aprovada"}
                          </span>
                        </div>
                        <div className="flex items-center gap-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <span className="flex items-center gap-2">
                            <Calendar
                              size={12}
                              className="text-brand-primary"
                            />{" "}
                            Período: {sheet.month}
                          </span>
                          <span className="w-1 h-1 bg-slate-700 rounded-full" />
                          <span className="flex items-center gap-2">
                            <Users size={12} className="text-brand-primary" />{" "}
                            Staff: {sheet.staff.length} Membros
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-10 mt-8 xl:mt-0 bg-white/5 p-6 rounded-[2rem] border border-white/5 backdrop-blur-sm">
                      <div className="text-right border-r border-white/10 pr-10 last:border-0 last:pr-0">
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">
                          Salário Líquido (Massa)
                        </p>
                        <p className="text-3xl font-black text-brand-primary tracking-tighter italic">
                          {(sheet.totalPayable || 0).toLocaleString()}{" "}
                          <span className="text-xs opacity-50">Kz</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">
                          Encargos Fiscais (INSS)
                        </p>
                        <p className="text-xl font-black text-slate-100 tracking-tighter italic opacity-80">
                          {(
                            (sheet.totalInssEmployee || 0) +
                            (sheet.totalInssEmployer || 0)
                          ).toLocaleString()}{" "}
                          <span className="text-xs opacity-50">Kz</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        {sheet.status !== "approved" && isAdmin && (
                          <button
                            onClick={() => approveSheet(sheet.id)}
                            disabled={isProcessing}
                            className="px-10 py-4 bg-white text-slate-900 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-brand-primary hover:text-white transition-all shadow-2xl active:scale-95 flex items-center gap-3 font-bold"
                          >
                            <CheckCircle2 size={18} />
                            {sheet.status === "draft"
                              ? "Validar Balanço"
                              : "Transferir Salários"}
                          </button>
                        )}
                        <button
                          onClick={() => deleteSalarySheet(sheet.id)}
                          className="p-4 bg-white/10 hover:bg-rose-500 rounded-2xl text-white transition-all shadow-2xl active:scale-95 border border-white/5 flex items-center justify-center group/del"
                          title="Eliminar Registro Permanente"
                        >
                          <Trash2
                            size={20}
                            className="group-hover/del:scale-110 transition-transform"
                          />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto border-b border-slate-100">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-200">
                          <th className="px-10 py-5">Colaborador / Função</th>
                          <th className="px-10 py-5 text-center">
                            Vencimento Base
                          </th>
                          <th className="px-10 py-5 text-center">Subsídios</th>
                          <th className="px-10 py-5 text-center">
                            Remuneração Bruta
                          </th>
                          <th className="px-10 py-5 text-center text-rose-500 italic">
                            INSS Est. (3%)
                          </th>
                          <th className="px-10 py-5 text-right font-black">
                            VALOR LÍQUIDO
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sheet.staff.map((person: any, idx: number) => (
                          <tr
                            key={`${person.id}-${idx}`}
                            className="hover:bg-slate-50/50 transition-colors group/row"
                          >
                            <td className="px-10 py-6">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-[11px] font-black text-slate-400 group-hover/row:bg-brand-primary group-hover/row:text-white transition-all">
                                  {String(idx + 1).padStart(2, "0")}
                                </div>
                                <div>
                                  <p className="text-sm font-black text-slate-900 uppercase tracking-tight italic">
                                    {person.name}
                                  </p>
                                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">
                                    {person.role}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-10 py-6 text-center text-[12px] font-bold text-slate-600 font-mono italic">
                              {(person.baseSalary || 0).toLocaleString()}
                            </td>
                            <td className="px-10 py-6 text-center text-[12px] font-bold text-slate-500 font-mono">
                              {(
                                (person.subsAliment || 0) +
                                (person.subsTransp || 0)
                              ).toLocaleString()}
                            </td>
                            <td className="px-10 py-6 text-center text-[12px] font-black text-slate-900 bg-slate-50/30 font-mono italic">
                              {(person.grossSalary || 0).toLocaleString()}
                            </td>
                            <td className="px-10 py-6 text-center text-[12px] font-black text-rose-500 font-mono">
                              -{(person.inssEmployee || 0).toLocaleString()}
                            </td>
                            <td className="px-10 py-6 text-right">
                              <div className="flex items-center justify-end gap-3">
                                <p className="text-lg font-black text-slate-900 tracking-tighter italic">
                                  {(person.netSalary || 0).toLocaleString()}{" "}
                                  <span className="text-[10px] font-bold opacity-40 uppercase">
                                    Kz
                                  </span>
                                </p>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() =>
                                      generateIndividualSlip(
                                        person,
                                        sheet.month,
                                      )
                                    }
                                    className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100 hover:bg-blue-100 transition-all flex items-center gap-2 group/btn"
                                    title="Gerar Recibo Individual"
                                  >
                                    <Download size={14} className="group-hover/btn:scale-110 transition-transform" />
                                    <span className="text-[8px] font-black uppercase">Recibo</span>
                                  </button>
                                  {sheet.status === "approved" ? (
                                    <div className="p-1 bg-emerald-50 rounded-lg text-emerald-500 border border-emerald-100">
                                      <CheckCircle2 size={16} />
                                    </div>
                                  ) : (
                                    <div className="p-1 bg-slate-50 rounded-lg text-slate-300 border border-slate-100">
                                      <Clock size={16} />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-10 bg-slate-50 flex flex-col lg:flex-row justify-between items-start gap-16">
                    <div className="w-full lg:max-w-md space-y-4 bg-white p-8 rounded-[2rem] border border-slate-200 shadow-xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-6 opacity-[0.03] rotate-12">
                        <ShieldCheck size={100} />
                      </div>

                      <h5 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                        <div className="w-2 h-2 bg-brand-primary rounded-full animate-pulse" />
                        Auditória de Encargos PSM
                      </h5>
                      <div className="space-y-3">
                        <ResumoRow
                          label="Total Salários Líquidos"
                          value={sheet.totalPayable}
                        />
                        <ResumoRow
                          label="3% Segurança Social"
                          value={sheet.totalInssEmployee}
                        />
                        <ResumoRow
                          label="8% Encargo Empresa"
                          value={sheet.totalInssEmployer}
                        />
                        <div className="h-px bg-slate-100 my-4" />
                        <ResumoRow
                          label="Obrigações Segurança Social (11%)"
                          value={
                            sheet.totalInssEmployee + sheet.totalInssEmployer
                          }
                          highlight
                        />
                        <ResumoRow
                          label="Imposto sobre Rendimento (IRT)"
                          value={sheet.totalIrt}
                        />
                        <div className="pt-4 border-t border-slate-200 mt-4">
                          <ResumoRow
                            label="Custo Total de Operação Staff"
                            value={sheet.totalBruto + sheet.totalInssEmployer}
                            bold
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 space-y-12 text-right">
                      <div className="inline-block border-b-4 border-brand-primary pb-4 px-12">
                        <p className="text-[11px] font-black text-slate-400 tracking-widest uppercase mb-1">
                          Assinatura Certificada
                        </p>
                        <p className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">
                          ADMINISTRAÇÃO • PS MOREIRA
                        </p>
                      </div>
                      <div className="space-y-4">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] italic">
                          CENTRAL LUENA, MOXICO • ANGOLA
                        </p>
                        <div className="flex justify-end gap-4">
                          <button className="flex items-center gap-3 px-8 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase text-slate-600 hover:bg-slate-100 transition-all shadow-sm">
                            <Download
                              size={16}
                              className="text-brand-primary"
                            />{" "}
                            PDF Comprovativo
                          </button>
                          <button className="flex items-center gap-3 px-8 py-3 bg-brand-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-secondary transition-all shadow-lg shadow-blue-600/20">
                            <Send size={16} /> Enviar p/ Arquivo
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      ) : activeView === "individual" ? (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl overflow-hidden min-h-[600px]">
          <div className="px-10 py-10 bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-8 relative">
            <div className="absolute top-0 left-0 w-full h-full bg-brand-primary/5 opacity-50 skew-y-3 -mt-20 pointer-events-none" />
            <div className="relative z-10">
              <h3 className="text-3xl font-black uppercase tracking-tighter italic">
                Relatório Analítico Individual
              </h3>
              <div className="text-[10px] text-[rgba(255,255,255,0.4)] font-black uppercase tracking-[0.3em] mt-2 flex items-center gap-3">
                <div className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-ping" />
                CONCILIAÇÃO MENSAL • {currentMonth}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 relative z-10">
              {isAdmin && individualReports.length > 0 && (
                <button
                  onClick={handleResetMonthlyReports}
                  disabled={isProcessing}
                  className="flex items-center gap-3 px-6 py-4 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-[1.25rem] text-[11px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all active:scale-95 disabled:opacity-50"
                >
                  <Trash2 size={18} /> Zerar Relatórios
                </button>
              )}
              <button
                onClick={handleGenerateIndividualReports}
                disabled={isProcessing}
                className="flex items-center gap-3 px-10 py-4 bg-brand-primary text-white rounded-[1.25rem] text-[11px] font-black uppercase tracking-widest hover:bg-brand-secondary transition-all shadow-2xl shadow-blue-600/30 active:scale-95 disabled:opacity-50"
              >
                {isProcessing ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Calculator size={18} />
                )}
                Sincronizar Dados de Renda
              </button>
            </div>
          </div>

          {/* PAINEL INFORMATIVO DE CONCILIAÇÃO DE RENDAS */}
          <div className="px-10 py-8 bg-slate-50 border-b border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Mês de Referência</div>
              <div className="text-xl font-black text-slate-800 mt-1 uppercase italic tracking-tight">{currentMonth}</div>
              <div className="text-[10px] text-slate-500 mt-1">Todas as conciliações e relatórios são limitados a este período.</div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm shadow-emerald-500/5">
              <div className="text-[9px] font-black uppercase text-emerald-600 tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Rendas Aprovadas (Sincronizáveis)
              </div>
              <div className="text-xl font-black text-emerald-700 mt-1">{monthlyApprovedLogs.length} Envios</div>
              <div className="text-[11px] font-bold text-slate-600 mt-1">Total pronto: <span className="font-mono text-emerald-600 font-extrabold">{totalApprovedSum.toLocaleString()} Kz</span></div>
            </div>
            <div className={`p-5 rounded-2xl border shadow-sm transition-all ${
              monthlyPendingLogs.length > 0 
                ? "bg-amber-500/5 border-amber-200 shadow-amber-500/5" 
                : "bg-white border-slate-200"
            }`}>
              <div className={`text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                monthlyPendingLogs.length > 0 ? "text-amber-600" : "text-slate-400"
              }`}>
                {monthlyPendingLogs.length > 0 && <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />}
                Rendas Pendentes de Aprovação
              </div>
              <div className={`text-xl font-black mt-1 ${monthlyPendingLogs.length > 0 ? "text-amber-700" : "text-slate-800"}`}>
                {monthlyPendingLogs.length} Envios Pendentes
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                {monthlyPendingLogs.length > 0 
                  ? "⚠️ IMPORTANTE: Estas rendas precisam ser APROVADAS na aba 'Gestão de Receitas' para aparecerem no relatório."
                  : "Não existem rendas pendentes de aprovação para este mês."}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#bfdbfe]/40 text-[#1e3a8a] text-[10px] font-black uppercase tracking-[0.2em] border-b border-[#93c5fd]">
                  <th className="px-6 py-6 border-r border-slate-200">
                    Colaborador
                  </th>
                  <th className="px-6 py-6 border-r border-slate-200 text-center">
                    Rendimento
                  </th>
                  <th className="px-6 py-6 border-r border-slate-200 text-center">
                    Custos
                  </th>
                  <th className="px-6 py-6 border-r border-slate-200 text-center">
                    Comissão 10%
                  </th>
                  <th className="px-6 py-6 border-r border-slate-200 text-center">
                    Subsídios
                  </th>
                  <th className="px-6 py-6 border-r border-slate-200 text-center bg-slate-50">
                    Total Bruto
                  </th>
                  <th className="px-6 py-6 border-r border-slate-200 text-center">
                    Descontos
                  </th>
                  <th className="px-6 py-6 border-r border-slate-200 text-center bg-emerald-50 text-emerald-700">
                    Salário Líquido
                  </th>
                  <th className="px-6 py-6 border-r border-slate-200 text-center">
                    Dias Trab.
                  </th>
                  <th className="px-6 py-6 text-center">Aprovação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {individualReports.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="py-20 text-center text-slate-400 font-black uppercase tracking-widest text-[11px] opacity-40"
                    >
                      Clique em "Sincronizar Dados" para gerar os relatórios
                      deste mês.
                    </td>
                  </tr>
                ) : (
                  individualReports.map((item, idx) => {
                    const total = (item.baseSalary || 0) + (item.subs || 0);
                    const net = total - (item.discounts || 0);
                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-blue-50 transition-colors group/row"
                      >
                        <td className="px-6 py-4 border-r border-slate-100 text-[11px] font-black text-slate-800 uppercase italic tracking-tighter bg-slate-50/50 group-hover/row:text-brand-primary">
                          {idx + 1}. {item.driverName}
                        </td>
                        <td className="px-6 py-4 border-r border-slate-100 text-center text-[10px] font-bold text-slate-600 font-mono">
                          {(item.totalGross || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 border-r border-slate-100 text-center text-[10px] font-bold text-rose-500 font-mono">
                          {(item.totalCosts || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 border-r border-slate-100 text-center text-[10px] font-bold text-brand-primary font-mono italic">
                          {(item.baseSalary || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 border-r border-slate-100 text-center text-[10px] font-bold text-slate-500 font-mono">
                          {editingReport === `subs-${item.id}` ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                defaultValue={item.subs}
                                onBlur={(e) => handleUpdateSubs(item.id, Number(e.target.value))}
                                className="w-16 px-1 py-0.5 bg-white border border-brand-primary rounded text-[10px] outline-none"
                                autoFocus
                              />
                            </div>
                          ) : (
                            <div 
                              className="cursor-pointer hover:text-brand-primary"
                              onClick={() => setEditingReport(`subs-${item.id}`)}
                            >
                              {(item.subs || 0).toLocaleString()}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 border-r border-slate-100 text-center text-[10px] font-black text-slate-900 font-mono italic bg-slate-50/10">
                          {(total || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 border-r border-slate-100 text-center text-[10px] font-black text-rose-600 font-mono">
                          {editingReport === item.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                defaultValue={item.discounts}
                                onBlur={(e) => {
                                  handleUpdateDiscount(item.id, Number(e.target.value));
                                }}
                                className="w-16 px-1 py-0.5 bg-white border border-brand-primary rounded text-[10px] outline-none"
                                autoFocus
                              />
                            </div>
                          ) : (
                            <div
                              className="flex items-center justify-center gap-1 cursor-pointer group/disc"
                              onClick={() => {
                                setEditingReport(item.id);
                                setDiscountValue(item.discounts || 0);
                              }}
                            >
                              <span>
                                {item.discounts > 0
                                  ? `-${(item.discounts || 0).toLocaleString()}`
                                  : "0"}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 border-r border-slate-100 text-center text-[12px] font-black text-emerald-800 bg-emerald-50/50 font-mono italic">
                          {(net || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 border-r border-slate-100 text-center text-[10px] font-black text-slate-500">
                          {item.days || 30}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {item.status === "approved_by_admin" ? (
                              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full text-[8px] font-black uppercase tracking-widest">
                                <ShieldCheck size={10} /> OK
                              </div>
                            ) : isAdmin ? (
                              <button
                                onClick={() =>
                                  approveIndividualReport(item.id, item.status)
                                }
                                className={cn(
                                  "px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all",
                                  item.status === "pending"
                                    ? "bg-amber-500 text-white"
                                    : "bg-blue-600 text-white",
                                )}
                              >
                                {item.status === "pending"
                                  ? "Validar"
                                  : "Aprovar"}
                              </button>
                            ) : (
                              <div className="px-3 py-1 bg-slate-100 text-slate-400 rounded-lg text-[8px] font-black uppercase tracking-widest italic">
                                Aguardando Admin
                              </div>
                            )}
                            {isAdmin && (
                              <button
                                onClick={() => deleteIndividualReport(item.id)}
                                className="p-1 text-slate-300 hover:text-rose-500"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {individualReports.length > 0 && (
                <tfoot className="bg-slate-900 text-white font-black text-sm italic">
                  <tr>
                    <td className="px-6 py-8 border-r border-white/5 uppercase tracking-widest text-brand-primary">
                      Massa Salarial Operacional
                    </td>
                    <td className="px-6 py-8 border-r border-white/5 text-center font-mono opacity-80">
                      {individualReports
                        .reduce((a, b) => a + (b.totalGross || 0), 0)
                        .toLocaleString()}
                    </td>
                    <td className="px-6 py-8 border-r border-white/5 text-center font-mono text-rose-400">
                      {individualReports
                        .reduce((a, b) => a + (b.totalCosts || 0), 0)
                        .toLocaleString()}
                    </td>
                    <td className="px-6 py-8 border-r border-white/5 text-center font-mono opacity-60">
                      {individualReports
                        .reduce((a, b) => a + (b.baseSalary || 0), 0)
                        .toLocaleString()}
                    </td>
                    <td className="px-6 py-8 border-r border-white/5 text-center font-mono opacity-60">
                      {individualReports
                        .reduce((a, b) => a + (b.subs || 0), 0)
                        .toLocaleString()}
                    </td>
                    <td className="px-6 py-8 border-r border-white/5 text-center font-mono opacity-80">
                      {individualReports
                        .reduce((a, b) => a + ((b.baseSalary || 0) + (b.subs || 0)), 0)
                        .toLocaleString()}
                    </td>
                    <td className="px-6 py-8 border-r border-white/5 text-center font-mono text-rose-400 font-bold">
                      {individualReports
                        .reduce((a, b) => a + (b.discounts || 0), 0)
                        .toLocaleString()}
                    </td>
                    <td
                      className="px-6 py-8 border-r border-white/5 text-center font-mono text-emerald-400 text-xl tracking-tighter"
                      colSpan={2}
                    >
                      {individualReports
                        .reduce(
                          (a, b) => a + ((b.baseSalary || 0) + (b.subs || 0) - (b.discounts || 0)),
                          0,
                        )
                        .toLocaleString()}{" "}
                      Kz
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="p-10 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <p className="text-[10px] text-slate-400 font-black uppercase italic tracking-widest leading-loose">
              Este relatório individual é gerado através do processamento
              cruzado de telemetria gps e validação de tesouraria.
            </p>
            <div className="flex items-center gap-4 text-[9px] font-black uppercase text-slate-500">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-amber-500 rounded-full" /> Ag.
                Contabilista
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-blue-600 rounded-full" /> Ag. Admin
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-emerald-500 rounded-full" /> Pronto
                p/ Folha
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {/* Invoice Viewer Modal */}
      {isInvoiceViewerOpen && selectedInvoiceData && (
        <InvoiceViewerModal 
          isOpen={isInvoiceViewerOpen}
          onClose={() => setIsInvoiceViewerOpen(false)}
          data={selectedInvoiceData}
          documentNumber={'FP WT2025/' + (selectedInvoiceData.id?.slice(-4).toUpperCase() || '0000')}
        />
      )}
    </div>
  );
}

function ReceiptField({ label, value, onChange, readOnly, type = "text" }: any) {
  return (
    <div className="space-y-1">
      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
        {label}
      </label>
      <input
        type={type}
        readOnly={readOnly}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className={cn(
          "w-full px-4 py-2 rounded-xl text-xs font-bold outline-none border transition-all",
          readOnly 
            ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed" 
            : "bg-white border-slate-200 focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/5 text-slate-900"
        )}
      />
    </div>
  );
}

function ReceiptPostalField({ label, value, onChange, isDiscount }: any) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-[#e6dfc8]/30 last:border-0 group">
      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
      <div className="flex items-center gap-1">
        {isDiscount && <span className="text-[10px] font-bold text-rose-400">-</span>}
        <input 
          type="number"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className={cn(
            "w-20 text-right text-[11px] font-black bg-transparent outline-none focus:text-brand-primary transition-colors",
            isDiscount ? "text-rose-500" : "text-slate-900"
          )}
        />
        <span className="text-[8px] font-bold text-slate-300 uppercase">Kz</span>
      </div>
    </div>
  );
}

function ResumoRow({ label, value, highlight, bold }: any) {
  return (
    <div
      className={cn(
        "flex justify-between items-center text-[10px]",
        bold ? "font-black text-slate-900" : "font-bold text-slate-500",
      )}
    >
      <span>{label}</span>
      <span className={cn(highlight ? "text-brand-primary" : "")}>
        {(value || 0).toLocaleString()} Kz
      </span>
    </div>
  );
}

function StatBox({ label, value, color, icon: Icon, sub }: any) {
  const colors: any = {
    emerald:
      "bg-emerald-50 text-emerald-600 border-emerald-100 shadow-emerald-500/5",
    rose: "bg-rose-50 text-rose-600 border-rose-100 shadow-rose-500/5",
    blue: "bg-blue-50 text-blue-600 border-blue-100 shadow-blue-500/5",
  };

  return (
    <div
      className={cn(
        "bg-white p-8 rounded-[2rem] border shadow-2xl transition-all hover:scale-[1.02] cursor-default group",
        colors[color],
      )}
    >
      <div className="flex justify-between items-start mb-6">
        <div className="p-3 bg-white rounded-2xl shadow-sm group-hover:bg-slate-900 group-hover:text-white transition-all duration-500">
          <Icon size={24} />
        </div>
        <div className="flex flex-col items-end">
          <div className="px-2 py-0.5 bg-white/50 rounded text-[8px] font-black uppercase tracking-widest border border-black/5 opacity-40">
            Live Sync
          </div>
        </div>
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-1 opacity-40 italic">
          {label}
        </p>
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-black tracking-tighter italic">
            {(value || 0).toLocaleString()}
          </p>
          <span className="text-[10px] font-bold opacity-30">KZ</span>
        </div>
        {sub && (
          <p className="text-[9px] font-black uppercase tracking-widest mt-2 opacity-30 flex items-center gap-1">
            <CheckCircle2 size={10} className="text-emerald-500" />
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}
