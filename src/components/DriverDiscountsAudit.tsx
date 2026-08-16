import React, { useState, useMemo } from "react";
import {
  ShieldAlert,
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
  Wrench,
  Ban,
  Receipt,
  AlertTriangle,
  Send,
  X,
  ShieldCheck
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface DiscountAuditLog {
  id: string;
  driverId: string;
  driverName: string;
  category: "manutencao" | "multas" | "adiantamentos" | "danos" | "faltas" | "outros";
  categoryLabel: string;
  amount: number;
  date: string;
  timestamp: string;
  motive: string;
  registeredBy: string;
}

interface DriverDiscountsAuditProps {
  drivers: any[];
  user?: any;
  discountAuditLogs: DiscountAuditLog[];
  onAddDiscountLog: (log: Omit<DiscountAuditLog, "id" | "timestamp">) => void;
  onDeleteDiscountLog: (logId: string) => void;
  onResetDiscountLogs?: () => void;
  currentMonth: string;
}

export default function DriverDiscountsAudit({
  drivers,
  user,
  discountAuditLogs,
  onAddDiscountLog,
  onDeleteDiscountLog,
  onResetDiscountLogs,
  currentMonth
}: DriverDiscountsAuditProps) {
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");
  const [category, setCategory] = useState<DiscountAuditLog["category"]>("manutencao");
  const [amount, setAmount] = useState<number | "">("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [motive, setMotive] = useState<string>("");
  const [registeredBy, setRegisteredBy] = useState<string>(user?.name || user?.email || "JIS Operações / Audit");

  // Filtros da tabela
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedLogForDetail, setSelectedLogForDetail] = useState<DiscountAuditLog | null>(null);

  const getCategoryLabel = (cat: DiscountAuditLog["category"]) => {
    switch (cat) {
      case "manutencao":
        return "Manutenção / Reparação";
      case "multas":
        return "Multa de Trânsito";
      case "adiantamentos":
        return "Adiantamento / Vále";
      case "danos":
        return "Danos em Viatura";
      case "faltas":
        return "Faltas / Incumprimento";
      case "outros":
        return "Outros Descontos";
      default:
        return "Desconto Operacional";
    }
  };

  const getCategoryBadgeClass = (cat: DiscountAuditLog["category"]) => {
    switch (cat) {
      case "manutencao":
        return "bg-amber-500/10 text-amber-700 border-amber-500/30";
      case "multas":
        return "bg-rose-500/10 text-rose-700 border-rose-500/30";
      case "adiantamentos":
        return "bg-blue-500/10 text-blue-700 border-blue-500/30";
      case "danos":
        return "bg-purple-500/10 text-purple-700 border-purple-500/30";
      case "faltas":
        return "bg-orange-500/10 text-orange-700 border-orange-500/30";
      default:
        return "bg-slate-500/10 text-slate-700 border-slate-500/30";
    }
  };

  const getCategoryIcon = (cat: DiscountAuditLog["category"]) => {
    switch (cat) {
      case "manutencao":
        return <Wrench size={14} />;
      case "multas":
        return <Ban size={14} />;
      case "adiantamentos":
        return <Receipt size={14} />;
      case "danos":
        return <AlertTriangle size={14} />;
      case "faltas":
        return <AlertCircle size={14} />;
      default:
        return <DollarSign size={14} />;
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
      alert("Por favor, introduza a justificação / motivo para auditoria.");
      return;
    }

    const driverObj = drivers.find(
      (d) => (d.id || d.driverId || d.driverName || d.name) === selectedDriverId
    );

    const driverName = driverObj
      ? driverObj.name || driverObj.driverName || "Motorista"
      : selectedDriverId;

    onAddDiscountLog({
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
    return discountAuditLogs.filter((log) => {
      const matchSearch =
        !searchTerm.trim() ||
        log.driverName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.motive.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.registeredBy.toLowerCase().includes(searchTerm.toLowerCase());

      const matchCat = filterCategory === "all" || log.category === filterCategory;

      return matchSearch && matchCat;
    });
  }, [discountAuditLogs, searchTerm, filterCategory]);

  // Cálculos de Totais
  const totalAuditAmount = useMemo(() => {
    return discountAuditLogs.reduce((acc, curr) => acc + curr.amount, 0);
  }, [discountAuditLogs]);

  const totalManutencao = useMemo(() => {
    return discountAuditLogs
      .filter((l) => l.category === "manutencao")
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [discountAuditLogs]);

  const totalMultas = useMemo(() => {
    return discountAuditLogs
      .filter((l) => l.category === "multas")
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [discountAuditLogs]);

  const totalAdiantamentos = useMemo(() => {
    return discountAuditLogs
      .filter((l) => l.category === "adiantamentos")
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [discountAuditLogs]);

  // Função para Gerar PDF Completo de Auditoria de Descontos com Timbre Oficial
  const handleExportAuditPDF = () => {
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const docCode = `AUD-REL-PSM-${Math.floor(100000 + Math.random() * 900000)}`;
      const issueDate = `${new Date().toLocaleDateString("pt-PT")} ${new Date().toLocaleTimeString("pt-PT")}`;

      // Timbre Oficial PSM - Faixa Superior Slate-900 com Detalhes a Ouro/Amber
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 210, 42, "F");

      // Borda decorativa Dourada/Amber
      doc.setFillColor(245, 158, 11); // amber-500
      doc.rect(0, 41, 210, 1.5, "F");

      // Texto do Timbre
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.text("PSM COMERCIAL (SU), LDA • SUPER TÁXI", 14, 14);

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(251, 191, 36); // amber-400
      doc.text("DEPARTAMENTO DE AUDITORIA FINANCEIRA & CONTROLO OPERACIONAL DE FROTA", 14, 20);

      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(203, 213, 225); // slate-300
      doc.text("Endereço: Luena, Província do Moxico • República de Angola | NIF: 5417089201", 14, 26);
      doc.text(`Doc Ref: ${docCode} | Emissão: ${issueDate} | Gestor Audit: ${user?.name || "JIS Operações / Audit"}`, 14, 31);
      doc.text("Sistema Oficial JIS ANGOLA • SUPER TÁXI CONTROL", 14, 36);

      // Selo de Certificação Digital no canto superior direito do Timbre
      doc.setDrawColor(245, 158, 11);
      doc.setFillColor(30, 41, 59);
      doc.roundedRect(155, 8, 42, 26, 3, 3, "FD");
      doc.setTextColor(251, 191, 36);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text("AUDITORIA OFICIAL", 158, 15);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.text("PSM LUENA-MOXICO", 158, 20);
      doc.text("STATUS: APROVADO", 158, 25);
      doc.text("FROTA VERIFICADA", 158, 30);

      // Título do Relatório
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("RELATÓRIO DE AUDITORIA FORMAL DE DESCONTOS E DEDUÇÕES DE MOTORISTAS", 14, 52);

      // 1. Resumo Geral
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(225, 29, 72); // rose-600
      doc.text("1. SÍNTESE EXECUTIVA DE DEDUÇÕES E AUDITORIA", 14, 60);

      const tableSummary = [
        ["Total Registos Registados em Auditoria:", `${discountAuditLogs.length} Lançamentos Auditados`],
        ["Total Global de Descontos a Abater em Folha:", `${totalAuditAmount.toLocaleString()} Kz`],
        ["Manutenção / Reparações Imputadas:", `${totalManutencao.toLocaleString()} Kz`],
        ["Multas de Trânsito / Infrações:", `${totalMultas.toLocaleString()} Kz`],
        ["Adiantamentos e Válens Concedidos:", `${totalAdiantamentos.toLocaleString()} Kz`],
        ["Outros Danos / Incumprimentos:", `${(totalAuditAmount - totalManutencao - totalMultas - totalAdiantamentos).toLocaleString()} Kz`],
      ];

      autoTable(doc, {
        startY: 63,
        head: [["Indicador de Auditoria", "Valor Acumulado (Kz)"]],
        body: tableSummary,
        theme: "striped",
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
        styles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 120 },
          1: { cellWidth: 60, halign: "right", fontStyle: "bold" },
        },
      });

      const finalY = (doc as any).lastAutoTable.finalY + 8;

      // 2. Tabela Detalhada
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("2. MAPA DETALHADO DE REGISTOS INDIVIDUAIS DE DEDUÇÃO", 14, finalY);

      const tableData = filteredLogs.map((log) => [
        log.id,
        log.date,
        log.driverName,
        log.categoryLabel,
        `${log.amount.toLocaleString()} Kz`,
        log.motive,
        log.registeredBy,
      ]);

      autoTable(doc, {
        startY: finalY + 4,
        head: [["Cód. Audit", "Data", "Motorista", "Categoria", "Valor (Kz)", "Justificação / Motivo", "Auditado Por"]],
        body: tableData,
        theme: "grid",
        headStyles: { fillColor: [225, 29, 72], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5 },
        styles: { fontSize: 7.5, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 20, fontStyle: "bold" },
          1: { cellWidth: 18 },
          2: { cellWidth: 32, fontStyle: "bold" },
          3: { cellWidth: 30 },
          4: { cellWidth: 24, halign: "right", fontStyle: "bold" },
          5: { cellWidth: 40 },
          6: { cellWidth: 18, fontSize: 6.5 },
        },
      });

      // Seção de Validação e Assinaturas com Carimbo da Empresa
      const pageHeight = doc.internal.pageSize.getHeight();
      const footerY = pageHeight - 32;

      // Box de Nota Legal e Ação
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, footerY - 18, 182, 14, 2, 2, "FD");
      doc.setFontSize(7);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(71, 85, 105);
      doc.text("Declaração Formal de Ação: Os descontos constantes neste relatório foram devidamente auditados e fundamentados em conformidade", 17, footerY - 12);
      doc.text("com o regulamento de frota da PSM COMERCIAL (SU), LDA, ficando autorizados para abate no salário líquido mensal dos respetivos motoristas.", 17, footerY - 8);

      // Assinaturas Oficiais
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);

      doc.text("__________________________________________", 20, footerY + 8);
      doc.text("Departamento de Auditoria & Finanças", 25, footerY + 13);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text("PSM COMERCIAL • Luena, Moxico", 28, footerY + 17);

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("__________________________________________", 120, footerY + 8);
      doc.text("Direção Geral - JIS ANGOLA", 132, footerY + 13);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text("Aprovação & Validação Final", 135, footerY + 17);

      doc.save(`Auditoria_Descontos_TIMBRADO_PSM_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error("Erro ao gerar PDF de auditoria:", err);
      alert("Erro ao exportar PDF de auditoria timbrado.");
    }
  };

  // Função para Gerar Ficha Individual de Auditoria e Desconto com Timbre Oficial
  const handleExportSingleLogPDF = (log: DiscountAuditLog) => {
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const issueDate = `${new Date().toLocaleDateString("pt-PT")} ${new Date().toLocaleTimeString("pt-PT")}`;

      // Timbre Oficial PSM - Faixa Superior Slate-900 com Detalhes Amber
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 210, 45, "F");

      doc.setFillColor(245, 158, 11); // amber-500
      doc.rect(0, 44, 210, 1.5, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("PSM COMERCIAL (SU), LDA • SUPER TÁXI", 14, 15);

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(251, 191, 36);
      doc.text("DEPARTAMENTO DE AUDITORIA FINANCEIRA & CONTROLO DE FROTA", 14, 22);

      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(203, 213, 225);
      doc.text("Filial Principal: Luena, Província do Moxico • República de Angola | NIF: 5417089201", 14, 28);
      doc.text(`Código Único de Auditoria: ${log.id} | Data do Lançamento: ${log.date}`, 14, 34);
      doc.text(`Auditado Por: ${log.registeredBy} | Emitido em: ${issueDate}`, 14, 39);

      // Carimbo Digital de Verificação no Timbre
      doc.setDrawColor(225, 29, 72); // rose-600
      doc.setFillColor(30, 41, 59);
      doc.roundedRect(150, 8, 48, 30, 3, 3, "FD");
      doc.setTextColor(244, 63, 94);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.text("DEDUÇÃO AUDITADA", 154, 16);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.text(`VALOR: ${log.amount.toLocaleString()} KZ`, 154, 22);
      doc.text("AÇÃO: ABATE EM FOLHA", 154, 27);
      doc.text("PSM LUENA MOXICO", 154, 32);

      // Título do Certificado
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("GUIA DE AUDITORIA E NOTIFICAÇÃO DE DEDUÇÃO FINANCEIRA", 14, 58);

      // Caixa de Dados do Motorista e Dedução
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, 64, 182, 58, 4, 4, "FD");

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text("1. IDENTIFICAÇÃO E DADOS DA DEDUÇÃO", 20, 72);

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);

      doc.text("Motorista Notificado:", 20, 80);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(log.driverName.toUpperCase(), 60, 80);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text("Categoria do Desconto:", 20, 87);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(225, 29, 72);
      doc.text(log.categoryLabel.toUpperCase(), 60, 87);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text("Montante a Descontar:", 20, 94);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(225, 29, 72);
      doc.text(`${log.amount.toLocaleString()} Kz (Kwanzas)`, 60, 94);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text("Data da Incidência:", 20, 101);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(log.date, 60, 101);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text("Operador / Auditor Responsável:", 20, 108);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(log.registeredBy, 65, 108);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text("Empresa / Filial:", 20, 115);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("PSM COMERCIAL (SU), LDA • LUENA, MOXICO", 65, 115);

      // Fundamentação / Justificação de Auditoria
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("2. JUSTIFICAÇÃO DETALHADA / PARECER DA AUDITORIA", 14, 130);

      doc.setFillColor(254, 242, 242); // rose-50
      doc.setDrawColor(254, 205, 211);
      doc.roundedRect(14, 134, 182, 35, 3, 3, "FD");

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(159, 18, 57); // rose-900

      const splitMotive = doc.splitTextToSize(`"${log.motive}"`, 174);
      doc.text(splitMotive, 18, 142);

      // Termos de Notificação e Abate em Folha
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("3. AÇÃO OPERACIONAL E EFETIVAÇÃO DE AUDITORIA", 14, 178);

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);
      doc.text("Este documento formaliza a aprovação da dedução financeira no mapa de vencimento do colaborador acima discriminado.", 14, 185);
      doc.text("O valor deduzido será abatido na liquidação mensal da folha de pagamento (comissões/salário produção) sob a chancela da", 14, 190);
      doc.text("Direção Geral da PSM COMERCIAL (SU), LDA, em conformidade com o Regulamento de Frota SUPER TÁXI.", 14, 195);

      // Quadro de Assinaturas Formais
      const sigY = 225;

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);

      // Assinatura Motorista
      doc.text("__________________________________________", 18, sigY);
      doc.text("Assinatura do Motorista Notificado", 22, sigY + 5);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text(`Tomei Conhecimento em ____/____/2026`, 22, sigY + 9);

      // Assinatura Auditor
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("__________________________________________", 118, sigY);
      doc.text("Pela Direção de Auditoria & Finanças", 122, sigY + 5);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text("PSM COMERCIAL (SU), LDA • JIS ANGOLA", 122, sigY + 9);

      doc.save(`Ficha_Auditoria_Desconto_${log.id}_${log.driverName.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error("Erro ao gerar PDF individual de desconto:", err);
      alert("Erro ao exportar PDF timbrado do registo.");
    }
  };

  const handleSendWhatsAppSingleLog = (log: DiscountAuditLog) => {
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
      `*NOTIFICAÇÃO DE DEDUÇÃO E AUDITORIA DE DESCONTO - PSM COMERCIAL (SU), LDA*\n\n` +
      `Olá *${log.driverName}*,\n` +
      `Informamos que foi registado um desconto auditado no seu registo de produção.\n\n` +
      `*DETALHES DA AUDITORIA:*\n` +
      `• Cód. Audit: *${log.id}*\n` +
      `• Categoria: *${log.categoryLabel}*\n` +
      `• Valor Dedução: *${log.amount.toLocaleString()} Kz*\n` +
      `• Data do Lançamento: ${log.date}\n` +
      `• Motivo / Justificação: "${log.motive}"\n` +
      `• Auditado por: ${log.registeredBy}\n\n` +
      `_PSM COMERCIAL (SU), LDA • Luena, Província do Moxico_`;

    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
      message
    )}`;
    window.open(whatsappUrl, "_blank");
  };

  const handleResetAllDiscounts = () => {
    if (
      confirm(
        "ATENÇÃO: Deseja ZERAR TODOS OS DESCONTOS auditados? Esta ação irá apagar permanentemente todo o histórico de deduções registadas e repor o saldo acumulado."
      )
    ) {
      onResetDiscountLogs?.();
      setSelectedLogForDetail(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden text-white">
        <div className="absolute top-0 right-0 w-80 h-80 bg-rose-500/10 blur-3xl -mr-32 -mt-32 rounded-full pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-rose-500 to-rose-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-rose-500/20 shrink-0">
              <ShieldAlert size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-rose-500/20 text-rose-400 rounded-full text-[9px] font-black uppercase tracking-widest border border-rose-500/30">
                  Sistema de Auditoria Interna
                </span>
                <span className="text-slate-400 text-xs">• Luena, Moxico</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight italic mt-1">
                Registo & Auditoria de Descontos
              </h2>
              <p className="text-slate-400 text-xs font-medium">
                Controlo oficial de deduções (manutenção, multas, válens e danos) com rasto de auditoria.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowFormModal(true)}
              className="px-5 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-rose-600/20 flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Plus size={16} />
              Registar Desconto
            </button>
            <button
              onClick={handleExportAuditPDF}
              className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Download size={16} />
              Exportar Relatório PDF
            </button>
            {discountAuditLogs.length > 0 && (
              <button
                onClick={handleResetAllDiscounts}
                className="px-4 py-3 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/30 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                title="Limpar e Zerar Todo o Histórico de Descontos Auditados"
              >
                <Trash2 size={16} />
                Zerar Descontos
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Total Descontos Auditados
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center font-black">
              <DollarSign size={16} />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-rose-600">
            {totalAuditAmount.toLocaleString()} Kz
          </p>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
            {discountAuditLogs.length} registos efetuados
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Manutenção & Avarias
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-black">
              <Wrench size={16} />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-slate-900 dark:text-white">
            {totalManutencao.toLocaleString()} Kz
          </p>
          <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider mt-1">
            Reparações imputadas
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Multas de Trânsito
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center font-black">
              <Ban size={16} />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-slate-900 dark:text-white">
            {totalMultas.toLocaleString()} Kz
          </p>
          <p className="text-[10px] text-rose-600 font-bold uppercase tracking-wider mt-1">
            Infrações de trânsito
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Adiantamentos & Válens
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-black">
              <Receipt size={16} />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-slate-900 dark:text-white">
            {totalAdiantamentos.toLocaleString()} Kz
          </p>
          <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider mt-1">
            Valores adiantados
          </p>
        </div>
      </div>

      {/* Main Content Area: Table & Filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-8 shadow-sm space-y-6">
        {/* Table Filters Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white italic">
              Histórico de Descontos Auditados
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              Listagem de deduções imputadas aos motoristas para efeito de cálculo líquido e folha.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Pesquisar por motorista, motivo..."
                className="pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 w-64"
              />
            </div>

            {/* Category Filter */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
            >
              <option value="all">Todas as Categorias</option>
              <option value="manutencao">Manutenção / Reparação</option>
              <option value="multas">Multas de Trânsito</option>
              <option value="adiantamentos">Adiantamentos / Válens</option>
              <option value="danos">Danos em Viatura</option>
              <option value="faltas">Faltas / Incumprimento</option>
              <option value="outros">Outros Descontos</option>
            </select>
          </div>
        </div>

        {/* Audit Logs Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-[9.5px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800">
                <th className="px-6 py-4">Data</th>
                <th className="px-6 py-4">Motorista</th>
                <th className="px-6 py-4">Categoria</th>
                <th className="px-6 py-4 text-right">Valor Desconto</th>
                <th className="px-6 py-4">Motivo / Justificação</th>
                <th className="px-6 py-4">Auditado Por</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400 italic text-xs uppercase font-bold">
                    Nenhum registo de desconto encontrado na auditoria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors text-xs font-medium"
                  >
                    <td className="px-6 py-4 font-mono font-bold text-slate-600 dark:text-slate-300">
                      {log.date}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-black text-xs shrink-0">
                          {log.driverName?.charAt(0) || 'M'}
                        </div>
                        <span className="font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                          {log.driverName || 'Motorista'}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border ${getCategoryBadgeClass(
                          log.category
                        )}`}
                      >
                        {getCategoryIcon(log.category)}
                        {log.categoryLabel}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right font-mono font-black text-rose-600 text-sm">
                      {log.amount.toLocaleString()} Kz
                    </td>

                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300 max-w-xs truncate" title={log.motive}>
                      {log.motive}
                    </td>

                    <td className="px-6 py-4 text-slate-400 font-bold text-[11px] uppercase tracking-wider">
                      {log.registeredBy}
                    </td>

                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setSelectedLogForDetail(log)}
                          className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl transition-all cursor-pointer"
                          title="Ver Ficha Detalhada de Auditoria"
                        >
                          <FileText size={14} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Eliminar registo de desconto de ${log.amount.toLocaleString()} Kz para ${log.driverName}?`)) {
                              onDeleteDiscountLog(log.id);
                            }
                          }}
                          className="p-2 bg-rose-500/10 hover:bg-rose-500 text-rose-600 hover:text-white rounded-xl transition-all cursor-pointer"
                          title="Anular / Eliminar Registo"
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

      {/* Modal para Adicionar Registo de Desconto */}
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
              className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden relative z-10 p-8 space-y-6"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center font-black">
                    <ShieldAlert size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase text-slate-900 dark:text-white italic tracking-tight">
                      Registar Desconto para Auditoria
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      PSM COMERCIAL • SUPER TÁXI
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowFormModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Selecionar Motorista */}
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                    Motorista *
                  </label>
                  <select
                    value={selectedDriverId}
                    onChange={(e) => setSelectedDriverId(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
                  >
                    <option value="">-- Selecione o Motorista --</option>
                    {drivers.map((d) => {
                      const idVal = d.id || d.driverId || d.driverName || d.name;
                      const nameVal = d.name || d.driverName || "Motorista";
                      return (
                        <option key={idVal} value={idVal}>
                          {nameVal}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Selecionar Categoria & Valor */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                      Categoria do Desconto *
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as any)}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
                    >
                      <option value="manutencao">Manutenção / Reparação</option>
                      <option value="multas">Multas de Trânsito</option>
                      <option value="adiantamentos">Adiantamentos / Válens</option>
                      <option value="danos">Danos em Viatura</option>
                      <option value="faltas">Faltas / Incumprimento</option>
                      <option value="outros">Outros Descontos</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                      Valor do Desconto (Kz) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="Ex: 5000"
                      required
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>

                {/* Data & Registado por */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                      Data do Registo *
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                      Auditado / Registado Por
                    </label>
                    <input
                      type="text"
                      value={registeredBy}
                      onChange={(e) => setRegisteredBy(e.target.value)}
                      placeholder="Nome do Auditor"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>

                {/* Motivo / Justificação de Auditoria */}
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                    Justificação / Motivo Detalhado para Auditoria *
                  </label>
                  <textarea
                    rows={3}
                    value={motive}
                    onChange={(e) => setMotive(e.target.value)}
                    placeholder="Descreva minuciosamente o motivo da dedução (ex: Reparação de pneu furado por uso negligente na rota X, multa de velocidade no troço Luena-Moxico, etc)."
                    required
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                  />
                </div>

                <div className="pt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowFormModal(false)}
                    className="w-1/2 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-lg shadow-rose-600/20"
                  >
                    Gravar Desconto
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Ficha Detalhada do Log */}
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
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden relative z-10 p-8 space-y-6"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-black">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase text-slate-900 dark:text-white italic tracking-tight">
                      Ficha de Auditoria Timbrada
                    </h3>
                    <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">
                      PSM COMERCIAL (SU), LDA • ID: {selectedLogForDetail.id}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedLogForDetail(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Timbre Visual Box em Modal */}
              <div className="p-3 bg-slate-900 text-white rounded-2xl border border-slate-800 text-[10px] space-y-1">
                <div className="flex justify-between font-black uppercase tracking-wider text-amber-400">
                  <span>PSM COMERCIAL (SU), LDA</span>
                  <span>SUPER TÁXI</span>
                </div>
                <div className="text-[9px] text-slate-300">
                  Luena, Província do Moxico • NIF: 5417089201
                </div>
                <div className="text-[8px] text-slate-400 font-mono">
                  Ação: Notificação Formal de Dedução & Abate de Vencimento
                </div>
              </div>

              <div className="space-y-4 text-xs font-medium">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400 uppercase text-[9px] font-bold">Motorista:</span>
                    <span className="font-black text-slate-900 dark:text-white uppercase">
                      {selectedLogForDetail.driverName}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-400 uppercase text-[9px] font-bold">Categoria:</span>
                    <span className="font-bold text-rose-600">
                      {selectedLogForDetail.categoryLabel}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-400 uppercase text-[9px] font-bold">Valor Dedução:</span>
                    <span className="font-black font-mono text-sm text-rose-600">
                      {selectedLogForDetail.amount.toLocaleString()} Kz
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-400 uppercase text-[9px] font-bold">Data do Registo:</span>
                    <span className="font-mono">{selectedLogForDetail.date}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-400 uppercase text-[9px] font-bold">Auditado por:</span>
                    <span className="font-bold">{selectedLogForDetail.registeredBy}</span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 uppercase text-[9px] font-bold block mb-1">
                    Justificação / Motivo de Auditoria:
                  </span>
                  <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl text-slate-700 dark:text-slate-300 italic leading-relaxed">
                    "{selectedLogForDetail.motive}"
                  </div>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => handleExportSingleLogPDF(selectedLogForDetail)}
                    className="py-3 bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20 cursor-pointer"
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
                  onClick={() => handleSendWhatsAppSingleLog(selectedLogForDetail)}
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
