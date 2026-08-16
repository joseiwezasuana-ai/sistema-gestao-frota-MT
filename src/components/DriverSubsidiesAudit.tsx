import React, { useState, useMemo } from "react";
import {
  Gift,
  Plus,
  Search,
  Printer,
  Download,
  Trash2,
  FileText,
  User,
  DollarSign,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Filter,
  Award,
  Utensils,
  Bus,
  Home,
  Briefcase,
  Send,
  X,
  ShieldCheck,
  TrendingUp,
  Coins
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface SubsidyAuditLog {
  id: string;
  driverId: string;
  driverName: string;
  category:
    | "alimentacao"
    | "transporte"
    | "ferias"
    | "reforco"
    | "renda1"
    | "renda2"
    | "renda3"
    | "desempenho"
    | "ajudas_custo"
    | "outros";
  categoryLabel: string;
  amount: number;
  date: string;
  timestamp: string;
  motive: string;
  registeredBy: string;
}

interface DriverSubsidiesAuditProps {
  drivers: any[];
  user?: any;
  subsidyAuditLogs: SubsidyAuditLog[];
  onAddSubsidyLog: (log: Omit<SubsidyAuditLog, "id" | "timestamp">) => void;
  onDeleteSubsidyLog: (logId: string) => void;
  onResetSubsidyLogs?: () => void;
  currentMonth: string;
}

export default function DriverSubsidiesAudit({
  drivers,
  user,
  subsidyAuditLogs,
  onAddSubsidyLog,
  onDeleteSubsidyLog,
  onResetSubsidyLogs,
  currentMonth,
}: DriverSubsidiesAuditProps) {
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");
  const [category, setCategory] =
    useState<SubsidyAuditLog["category"]>("alimentacao");
  const [amount, setAmount] = useState<number | "">("");
  const [date, setDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [motive, setMotive] = useState<string>("");
  const [registeredBy, setRegisteredBy] = useState<string>(
    user?.name || user?.email || "JIS Operações / Audit"
  );

  // Filtros da tabela
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedLogForDetail, setSelectedLogForDetail] =
    useState<SubsidyAuditLog | null>(null);

  const getCategoryLabel = (cat: SubsidyAuditLog["category"]) => {
    switch (cat) {
      case "alimentacao":
        return "Subsídio de Alimentação";
      case "transporte":
        return "Subsídio de Transporte";
      case "ferias":
        return "Subsídio de Férias / Natal";
      case "reforco":
        return "Subsídio de Reforço / Incentivo";
      case "renda1":
        return "Subsídio de Renda 1 / Habitação";
      case "renda2":
        return "Subsídio de Renda 2";
      case "renda3":
        return "Subsídio de Renda 3";
      case "desempenho":
        return "Prémio de Desempenho / Meta";
      case "ajudas_custo":
        return "Ajudas de Custo / Deslocação";
      case "outros":
        return "Outros Subsídios Especiais";
      default:
        return "Subsídio / Bónus";
    }
  };

  const getCategoryBadgeClass = (cat: SubsidyAuditLog["category"]) => {
    switch (cat) {
      case "alimentacao":
        return "bg-emerald-500/10 text-emerald-700 border-emerald-500/30";
      case "transporte":
        return "bg-cyan-500/10 text-cyan-700 border-cyan-500/30";
      case "ferias":
        return "bg-purple-500/10 text-purple-700 border-purple-500/30";
      case "reforco":
        return "bg-blue-500/10 text-blue-700 border-blue-500/30";
      case "renda1":
      case "renda2":
      case "renda3":
        return "bg-amber-500/10 text-amber-700 border-amber-500/30";
      case "desempenho":
        return "bg-indigo-500/10 text-indigo-700 border-indigo-500/30";
      case "ajudas_custo":
        return "bg-teal-500/10 text-teal-700 border-teal-500/30";
      default:
        return "bg-slate-500/10 text-slate-700 border-slate-500/30";
    }
  };

  const getCategoryIcon = (cat: SubsidyAuditLog["category"]) => {
    switch (cat) {
      case "alimentacao":
        return <Utensils size={14} />;
      case "transporte":
        return <Bus size={14} />;
      case "ferias":
        return <Gift size={14} />;
      case "reforco":
        return <TrendingUp size={14} />;
      case "renda1":
      case "renda2":
      case "renda3":
        return <Home size={14} />;
      case "desempenho":
        return <Award size={14} />;
      case "ajudas_custo":
        return <Briefcase size={14} />;
      default:
        return <Coins size={14} />;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDriverId) {
      alert("Por favor, selecione um motorista.");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      alert("Por favor, introduza um valor válido superior a zero.");
      return;
    }
    if (!motive.trim()) {
      alert("Por favor, introduza a justificação / motivo para o subsídio.");
      return;
    }

    const driverObj = drivers.find(
      (d) => (d.id || d.driverId || d.driverName || d.name) === selectedDriverId
    );

    const driverName = driverObj
      ? driverObj.name || driverObj.driverName || "Motorista"
      : selectedDriverId;

    onAddSubsidyLog({
      driverId: selectedDriverId,
      driverName,
      category,
      categoryLabel: getCategoryLabel(category),
      amount: Number(amount),
      date,
      motive: motive.trim(),
      registeredBy: registeredBy || "JIS Operações",
    });

    // Reset form
    setAmount("");
    setMotive("");
    setShowFormModal(false);
  };

  // Filtragem da Lista de Auditoria
  const filteredLogs = useMemo(() => {
    return subsidyAuditLogs.filter((log) => {
      const matchSearch =
        !searchTerm.trim() ||
        log.driverName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.motive.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.registeredBy.toLowerCase().includes(searchTerm.toLowerCase());

      const matchCat =
        filterCategory === "all" || log.category === filterCategory;

      return matchSearch && matchCat;
    });
  }, [subsidyAuditLogs, searchTerm, filterCategory]);

  // Cálculos de Totais
  const totalAuditAmount = useMemo(() => {
    return subsidyAuditLogs.reduce((acc, curr) => acc + curr.amount, 0);
  }, [subsidyAuditLogs]);

  const totalAlimentacaoTransporte = useMemo(() => {
    return subsidyAuditLogs
      .filter((l) => l.category === "alimentacao" || l.category === "transporte")
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [subsidyAuditLogs]);

  const totalPremiosFerias = useMemo(() => {
    return subsidyAuditLogs
      .filter(
        (l) =>
          l.category === "desempenho" ||
          l.category === "ferias" ||
          l.category === "reforco"
      )
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [subsidyAuditLogs]);

  // Exportação em PDF do Relatório Geral de Subsídios
  const handleExportFullPDF = () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const docCode = `AUD-SUB-PSM-${Math.floor(100000 + Math.random() * 900000)}`;
      const issueDate = `${new Date().toLocaleDateString(
        "pt-PT"
      )} ${new Date().toLocaleTimeString("pt-PT")}`;

      // Timbre Oficial PSM
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 210, 42, "F");

      doc.setFillColor(16, 185, 129); // emerald-500 accent
      doc.rect(0, 41, 210, 1.5, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.text("PSM COMERCIAL (SU), LDA • SUPER TÁXI", 14, 14);

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(52, 211, 153);
      doc.text(
        "DEPARTAMENTO DE RECURSOS HUMANOS & CONTABILIDADE CENTRAL",
        14,
        20
      );

      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(203, 213, 225);
      doc.text(
        "Filial Principal: Luena, Província do Moxico • República de Angola | NIF: 5417089201",
        14,
        26
      );
      doc.text(
        `Cód Ref: ${docCode} | Período: ${currentMonth} | Emissão: ${issueDate}`,
        14,
        31
      );
      doc.text("Sistema Oficial JIS ANGOLA • TAXICONTROL HUB", 14, 36);

      // Carimbo Digital de Verificação no Timbre
      doc.setDrawColor(16, 185, 129);
      doc.setFillColor(30, 41, 59);
      doc.roundedRect(150, 7, 48, 28, 3, 3, "FD");
      doc.setTextColor(52, 211, 153);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text("TIMBRE OFICIAL", 154, 14);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.text("PSM LUENA MOXICO", 154, 19);
      doc.text("MAPA DE SUBSÍDIOS", 154, 24);
      doc.text("AUDITORIA CONCESSÕES", 154, 29);

      // Título
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(
        "RELATÓRIO AUDITADO DE SUBSÍDIOS E BÓNUS CONCEDIDOS",
        pageWidth / 2,
        52,
        { align: "center" }
      );

      // Resumo
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(
        `Total de Registos: ${filteredLogs.length} | Total Acumulado Concedido: ${totalAuditAmount.toLocaleString()} Kz`,
        14,
        60
      );

      // Tabela de Logs
      const tableData = filteredLogs.map((log) => [
        log.id,
        log.driverName,
        log.categoryLabel,
        `${log.amount.toLocaleString()} Kz`,
        log.date,
        log.motive,
        log.registeredBy,
      ]);

      autoTable(doc, {
        startY: 66,
        head: [
          [
            "CÓD AUDIT",
            "MOTORISTA",
            "CATEGORIA SUBSÍDIO",
            "VALOR (KZ)",
            "DATA",
            "MOTIVO / JUSTIFICAÇÃO",
            "REGISTADO POR",
          ],
        ],
        body: tableData,
        theme: "striped",
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 7.5,
        },
        styles: { fontSize: 7, cellPadding: 2.5 },
        columnStyles: {
          0: { cellWidth: 22, fontStyle: "bold" },
          1: { cellWidth: 35, fontStyle: "bold" },
          2: { cellWidth: 32 },
          3: { cellWidth: 22, halign: "right", fontStyle: "bold" },
          4: { cellWidth: 20 },
          5: { cellWidth: 40 },
          6: { cellWidth: 20 },
        },
      });

      const finalY = (doc as any).lastAutoTable.finalY + 12;
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(16, 185, 129);
      doc.text(
        `TOTAL DE SUBSÍDIOS E BÓNUS CONCEDIDOS: ${totalAuditAmount.toLocaleString()} Kz`,
        pageWidth - 14,
        finalY,
        { align: "right" }
      );

      // Signatures
      const sigY = finalY + 25;
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);

      doc.text("__________________________________________", 20, sigY);
      doc.text("Direção de RH & Finanças", 28, sigY + 5);

      doc.text("__________________________________________", 120, sigY);
      doc.text("Auditoria Operacional PSM", 128, sigY + 5);

      doc.save(`RELATORIO_SUBSIDIOS_AUDITADOS_${currentMonth}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Erro ao gerar relatório PDF de subsídios.");
    }
  };

  // Exportação PDF de Comprovativo Único
  const handleExportSingleLogPDF = (log: SubsidyAuditLog) => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const issueDate = `${new Date().toLocaleDateString(
        "pt-PT"
      )} ${new Date().toLocaleTimeString("pt-PT")}`;

      // Timbre Oficial PSM
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 210, 42, "F");

      doc.setFillColor(16, 185, 129); // emerald-500 accent
      doc.rect(0, 41, 210, 1.5, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.text("PSM COMERCIAL (SU), LDA • SUPER TÁXI", 14, 14);

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(52, 211, 153);
      doc.text(
        "DEPARTAMENTO DE RECURSOS HUMANOS & CONTABILIDADE CENTRAL",
        14,
        20
      );

      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(203, 213, 225);
      doc.text(
        "Filial Principal: Luena, Província do Moxico • República de Angola | NIF: 5417089201",
        14,
        26
      );
      doc.text(
        `Cód Ref: ${log.id} | Data do Lançamento: ${log.date} | Emissão: ${issueDate}`,
        14,
        31
      );
      doc.text("Sistema Oficial JIS ANGOLA • TAXICONTROL HUB", 14, 36);

      // Carimbo Digital
      doc.setDrawColor(16, 185, 129);
      doc.setFillColor(30, 41, 59);
      doc.roundedRect(150, 7, 48, 28, 3, 3, "FD");
      doc.setTextColor(52, 211, 153);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text("TIMBRE OFICIAL", 154, 14);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.text("PSM LUENA MOXICO", 154, 19);
      doc.text("GUIA DE SUBSÍDIO", 154, 24);
      doc.text("CONCESSÃO APROVADA", 154, 29);

      // Título
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(
        "COMPROVATIVO INDIVIDUAL DE SUBSÍDIO / BÓNUS CONCEDIDO",
        pageWidth / 2,
        54,
        { align: "center" }
      );

      // Caixa de Detalhes
      autoTable(doc, {
        startY: 62,
        head: [["PARÂMETRO DE AUDITORIA", "ESPECIFICAÇÃO OFICIAL"]],
        body: [
          ["CÓDIGO DE AUDITORIA", log.id],
          ["MOTORISTA BENEFICIÁRIO", log.driverName.toUpperCase()],
          ["CATEGORIA DO SUBSÍDIO", log.categoryLabel.toUpperCase()],
          ["VALOR CONCEDIDO", `${log.amount.toLocaleString()} Kz`],
          ["DATA DE LANÇAMENTO", log.date],
          ["MOTIVO / JUSTIFICAÇÃO", log.motive],
          ["REGISTADO POR / AUDITOR", log.registeredBy],
          ["ESTADO DO CRÉDITO", "APROVADO & INTEGRADO NA FOLHA"],
        ],
        theme: "striped",
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8.5,
        },
        styles: { fontSize: 8.5, cellPadding: 3.5 },
        columnStyles: {
          0: { cellWidth: 65, fontStyle: "bold" },
          1: { cellWidth: 115 },
        },
      });

      const finalY = (doc as any).lastAutoTable.finalY + 25;

      // Signatures
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);

      doc.text("__________________________________________", 20, finalY);
      doc.text("O Colaborador / Beneficiário", 28, finalY + 5);

      doc.text("__________________________________________", 120, finalY);
      doc.text("Pela Direção de RH & Finanças", 128, finalY + 5);

      doc.save(`COMPROVATIVO_SUBSIDIO_${log.id}_${log.driverName.replace(/\s+/g, "_")}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Erro ao gerar comprovativo PDF do subsídio.");
    }
  };

  const handleSendWhatsAppSingleLog = (log: SubsidyAuditLog) => {
    const driver = drivers.find(
      (d) =>
        (d.id || d.driverId || d.driverName || d.name) === log.driverId ||
        d.driverName === log.driverName ||
        d.name === log.driverName
    );
    let phone = driver?.phone || driver?.telefone;

    if (!phone) {
      const manualPhone = prompt(
        `Número de telefone não encontrado para ${log.driverName}. Digite o número WhatsApp (ex: 923...):`
      );
      if (!manualPhone) return;
      phone = manualPhone;
    }

    let cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone.startsWith("244")) {
      cleanPhone = "244" + cleanPhone;
    }

    const message =
      `*NOTIFICAÇÃO DE CONCESSÃO DE SUBSÍDIO / BÓNUS - PSM COMERCIAL (SU), LDA*\n\n` +
      `Olá *${log.driverName}*,\n` +
      `Temos o prazer de informar que foi creditado um subsídio/bónus no seu registo de vencimentos.\n\n` +
      `*DETALHES DA CONCESSÃO:*\n` +
      `• Cód. Audit: *${log.id}*\n` +
      `• Categoria: *${log.categoryLabel}*\n` +
      `• Valor Creditado: *${log.amount.toLocaleString()} Kz*\n` +
      `• Data do Lançamento: ${log.date}\n` +
      `• Justificação: "${log.motive}"\n` +
      `• Processado por: ${log.registeredBy}\n\n` +
      `_PSM COMERCIAL (SU), LDA • Luena, Província do Moxico_`;

    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
      message
    )}`;
    window.open(whatsappUrl, "_blank");
  };

  const handleResetAllSubsidies = () => {
    if (
      confirm(
        "ATENÇÃO: Deseja ZERAR TODOS OS SUBSÍDIOS auditados? Esta ação irá apagar permanentemente todo o histórico de subsídios e bónus concedidos."
      )
    ) {
      onResetSubsidyLogs?.();
      setSelectedLogForDetail(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="p-8 bg-slate-900 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-black shadow-inner">
              <Gift size={32} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-[0.25em] text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                  Gestão de Incentivos & Remunerações
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tight mt-1">
                Auditoria de Subsídios & Bónus
              </h2>
              <p className="text-xs text-slate-400 font-medium max-w-xl mt-1">
                Registo oficial, controlo e auditoria de subsídios de alimentação,
                transporte, férias, habitação e prémios de desempenho para
                motoristas da frota PSM COMERCIAL (SU), LDA.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowFormModal(true)}
              className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Plus size={16} />
              Lançar Subsídio
            </button>
            <button
              onClick={handleExportFullPDF}
              className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Download size={16} />
              Exportar Relatório PDF
            </button>
            {subsidyAuditLogs.length > 0 && (
              <button
                onClick={handleResetAllSubsidies}
                className="px-4 py-3 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/30 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                title="Limpar e Zerar Todo o Histórico de Subsídios Auditados"
              >
                <Trash2 size={16} />
                Zerar Subsídios
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-6 bg-white border border-slate-200 rounded-[2rem] shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-black">
            <Coins size={22} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Total Concedido (Kz)
            </span>
            <span className="text-xl font-black italic text-slate-900 tracking-tight">
              {totalAuditAmount.toLocaleString()} Kz
            </span>
          </div>
        </div>

        <div className="p-6 bg-white border border-slate-200 rounded-[2rem] shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center font-black">
            <Utensils size={22} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Alimentação & Transporte
            </span>
            <span className="text-xl font-black italic text-slate-900 tracking-tight">
              {totalAlimentacaoTransporte.toLocaleString()} Kz
            </span>
          </div>
        </div>

        <div className="p-6 bg-white border border-slate-200 rounded-[2rem] shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-black">
            <Award size={22} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Prémios & Incentivos
            </span>
            <span className="text-xl font-black italic text-slate-900 tracking-tight">
              {totalPremiosFerias.toLocaleString()} Kz
            </span>
          </div>
        </div>

        <div className="p-6 bg-white border border-slate-200 rounded-[2rem] shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center font-black">
            <FileText size={22} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Registos de Subsídio
            </span>
            <span className="text-xl font-black italic text-slate-900 tracking-tight">
              {subsidyAuditLogs.length} Registos
            </span>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="p-6 bg-white border border-slate-200 rounded-[2rem] shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar motorista, motivo ou responsável..."
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <Filter size={16} className="text-slate-400" />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="all">Todas as Categorias</option>
            <option value="alimentacao">Subsídio de Alimentação</option>
            <option value="transporte">Subsídio de Transporte</option>
            <option value="ferias">Subsídio de Férias / Natal</option>
            <option value="reforco">Subsídio de Reforço / Incentivo</option>
            <option value="renda1">Subsídio de Renda 1 / Habitação</option>
            <option value="renda2">Subsídio de Renda 2</option>
            <option value="renda3">Subsídio de Renda 3</option>
            <option value="desempenho">Prémio de Desempenho / Meta</option>
            <option value="ajudas_custo">Ajudas de Custo / Deslocação</option>
            <option value="outros">Outros Subsídios Especiais</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-black">
              <Gift size={16} />
            </div>
            <h3 className="text-base font-black uppercase italic tracking-tight text-slate-900">
              Histórico de Subsídios & Bónus Auditados
            </h3>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
            {filteredLogs.length} Resultados
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[9px] font-black uppercase tracking-widest text-slate-500">
                <th className="px-6 py-4">Cód. Audit</th>
                <th className="px-6 py-4">Motorista</th>
                <th className="px-6 py-4">Categoria Subsídio</th>
                <th className="px-6 py-4 text-right">Valor (Kz)</th>
                <th className="px-6 py-4">Data</th>
                <th className="px-6 py-4">Motivo / Justificação</th>
                <th className="px-6 py-4">Registado Por</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-12 text-center text-slate-400 font-medium"
                  >
                    Nenhum subsídio registado ou encontrado nos filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="px-6 py-4 font-mono font-bold text-slate-900">
                      {log.id}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 font-black flex items-center justify-center text-[10px]">
                        {log.driverName?.charAt(0) || 'M'}
                      </div>
                      {log.driverName || 'Motorista'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${getCategoryBadgeClass(
                          log.category
                        )}`}
                      >
                        {getCategoryIcon(log.category)}
                        {log.categoryLabel}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-emerald-600">
                      +{log.amount.toLocaleString()} Kz
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-medium">
                      {log.date}
                    </td>
                    <td className="px-6 py-4 text-slate-700 font-medium max-w-xs truncate">
                      {log.motive}
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-medium">
                      {log.registeredBy}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setSelectedLogForDetail(log)}
                          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
                          title="Ver Detalhes e Timbre"
                        >
                          <FileText size={14} />
                        </button>
                        <button
                          onClick={() => handleExportSingleLogPDF(log)}
                          className="p-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-600 hover:text-white rounded-xl transition-colors cursor-pointer"
                          title="Emitir PDF Timbrado"
                        >
                          <Download size={14} />
                        </button>
                        <button
                          onClick={() => handleSendWhatsAppSingleLog(log)}
                          className="p-2 bg-emerald-50 hover:bg-emerald-600 text-emerald-600 hover:text-white rounded-xl transition-colors cursor-pointer"
                          title="Enviar via WhatsApp"
                        >
                          <Send size={14} />
                        </button>
                        <button
                          onClick={() => onDeleteSubsidyLog(log.id)}
                          className="p-2 bg-rose-50 hover:bg-rose-500 text-rose-500 hover:text-white rounded-xl transition-colors cursor-pointer"
                          title="Eliminar Registo"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Lançamento de Subsídio */}
      <AnimatePresence>
        {showFormModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFormModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden relative z-10 p-8 space-y-6"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-black">
                    <Gift size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase text-slate-900 italic tracking-tight">
                      Lançar Subsídio / Bónus
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Novo Registo de Crédito
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowFormModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                    Motorista Beneficiário
                  </label>
                  <select
                    value={selectedDriverId}
                    onChange={(e) => setSelectedDriverId(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="">-- Selecione o Motorista --</option>
                    {drivers.map((drv) => {
                      const id =
                        drv.id || drv.driverId || drv.driverName || drv.name;
                      const name = drv.name || drv.driverName || "Motorista";
                      const prefix = drv.prefix ? `[${drv.prefix}] ` : "";
                      return (
                        <option key={id} value={id}>
                          {prefix}
                          {name}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                      Categoria do Subsídio
                    </label>
                    <select
                      value={category}
                      onChange={(e) =>
                        setCategory(e.target.value as SubsidyAuditLog["category"])
                      }
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option value="alimentacao">Subsídio de Alimentação</option>
                      <option value="transporte">Subsídio de Transporte</option>
                      <option value="ferias">Subsídio de Férias / Natal</option>
                      <option value="reforco">Subsídio de Reforço / Incentivo</option>
                      <option value="renda1">Subsídio de Renda 1 / Habitação</option>
                      <option value="renda2">Subsídio de Renda 2</option>
                      <option value="renda3">Subsídio de Renda 3</option>
                      <option value="desempenho">Prémio de Desempenho / Meta</option>
                      <option value="ajudas_custo">Ajudas de Custo / Deslocação</option>
                      <option value="outros">Outros Subsídios Especiais</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                      Valor do Subsídio (Kz)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={amount}
                      onChange={(e) =>
                        setAmount(
                          e.target.value === "" ? "" : Number(e.target.value)
                        )
                      }
                      placeholder="Ex: 15000"
                      required
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                      Data do Lançamento
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                      Responsável / Registado Por
                    </label>
                    <input
                      type="text"
                      value={registeredBy}
                      onChange={(e) => setRegisteredBy(e.target.value)}
                      required
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                    Motivo / Justificação
                  </label>
                  <textarea
                    value={motive}
                    onChange={(e) => setMotive(e.target.value)}
                    placeholder="Descreva a razão do subsídio ou bónus atribuído..."
                    rows={3}
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-600/20 cursor-pointer"
                >
                  Confirmar & Lançar Subsídio
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Detalhes e Timbre do Subsídio */}
      <AnimatePresence>
        {selectedLogForDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedLogForDetail(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden relative z-10 p-8 space-y-6"
            >
              {/* Timbre Oficial Header */}
              <div className="bg-slate-900 text-white p-5 rounded-2xl relative overflow-hidden border-b-2 border-emerald-500 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-emerald-500/20 border border-emerald-500/40 rounded-xl flex items-center justify-center text-emerald-400 font-black">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <span className="text-[8px] font-black uppercase tracking-[0.25em] text-emerald-400 block">
                        TIMBRE OFICIAL • RH & FINANÇAS
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
                    onClick={() => setSelectedLogForDetail(null)}
                    className="w-7 h-7 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Cód. Auditoria
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-900">
                    {selectedLogForDetail.id}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Motorista
                  </span>
                  <span className="text-xs font-bold text-slate-900">
                    {selectedLogForDetail.driverName}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Categoria
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${getCategoryBadgeClass(
                      selectedLogForDetail.category
                    )}`}
                  >
                    {selectedLogForDetail.categoryLabel}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Valor Atribuído
                  </span>
                  <span className="text-sm font-mono font-black text-emerald-600">
                    +{selectedLogForDetail.amount.toLocaleString()} Kz
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Data Lançamento
                  </span>
                  <span className="text-xs font-bold text-slate-700">
                    {selectedLogForDetail.date}
                  </span>
                </div>

                <div className="border-b border-slate-100 pb-3">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                    Motivo / Justificação
                  </span>
                  <p className="text-xs font-medium text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    "{selectedLogForDetail.motive}"
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Registado Por
                  </span>
                  <span className="text-xs font-bold text-slate-700">
                    {selectedLogForDetail.registeredBy}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => handleExportSingleLogPDF(selectedLogForDetail)}
                    className="py-3 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
                  >
                    <FileText size={14} />
                    Emitir PDF Timbrado
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="py-3 bg-slate-900 text-amber-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2 border border-slate-800 cursor-pointer"
                  >
                    <Printer size={14} />
                    Imprimir Comprovativo
                  </button>
                </div>
                <button
                  onClick={() =>
                    handleSendWhatsAppSingleLog(selectedLogForDetail)
                  }
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  <Send size={14} />
                  Enviar via WhatsApp ao Motorista
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
