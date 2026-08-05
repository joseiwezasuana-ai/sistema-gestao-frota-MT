import React, { useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  ArrowDownCircle, 
  Wallet, 
  User, 
  Car, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  X, 
  Download, 
  Printer, 
  PieChart, 
  DollarSign, 
  ArrowUpRight,
  Filter,
  CreditCard,
  Banknote,
  ArrowRightLeft,
  Fuel,
  Wrench
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DriverRevenueAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  driverId: string | null;
  drivers: any[];
  revenues: any[];
}

export function DriverRevenueAnalysisModal({
  isOpen,
  onClose,
  driverId: initialDriverId,
  drivers,
  revenues
}: DriverRevenueAnalysisModalProps) {
  const [selectedDriverId, setSelectedDriverId] = useState<string>(initialDriverId || 'all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'month' | 'today'>('month');

  React.useEffect(() => {
    const handleAccountingReset = () => {
      setSelectedDriverId('all');
      setTimeFilter('month');
    };
    window.addEventListener('accounting_hub_reset', handleAccountingReset);
    return () => window.removeEventListener('accounting_hub_reset', handleAccountingReset);
  }, []);

  if (!isOpen) return null;

  // Filter logs based on selected driver & time filter
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const todayStr = now.toISOString().split('T')[0];

  const targetDriver = drivers.find(d => d.id === selectedDriverId);

  const filteredLogs = revenues.filter(log => {
    if (log.status === 'archived') return false;
    // Driver filter
    if (selectedDriverId !== 'all') {
      const matchId = log.driverId === selectedDriverId;
      const matchName = targetDriver && log.driverName?.toLowerCase() === targetDriver.name?.toLowerCase();
      const matchPrefix = targetDriver && log.prefix === targetDriver.prefix;
      if (!matchId && !matchName && !matchPrefix) return false;
    }

    // Time filter
    if (timeFilter === 'today') {
      return log.date === todayStr;
    } else if (timeFilter === 'month') {
      return log.date && log.date.startsWith(currentMonthStr);
    }
    return true;
  });

  // Calculate Aggregates
  let totalGross = 0;
  let totalTpa = 0;
  let totalCash = 0;
  let totalTransfer = 0;
  let totalApp = 0;
  let totalExpenses = 0;
  let totalFinalized = 0;

  filteredLogs.forEach(log => {
    totalGross += (log.amount || 0);
    const bd = log.breakdown || {};
    totalTpa += (bd.tpa || 0);
    totalCash += (bd.cash || 0);
    totalTransfer += (bd.transfer || 0);
    totalApp += (bd.appRides || 0);
    totalExpenses += (bd.expenses || 0);

    if (log.status === 'finalized' || log.status === 'approved_by_accountant') {
      totalFinalized += (log.amount || 0);
    }
  });

  const jisShare = totalGross * 0.9;
  const driverShare = totalGross * 0.1;
  const netRevenue = totalGross - totalExpenses;
  const marginPercent = totalGross > 0 ? ((netRevenue / totalGross) * 100).toFixed(1) : '100';

  // Export PDF Report
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();
      const driverNameText = targetDriver ? `${targetDriver.name} (${targetDriver.prefix || 'N/A'})` : 'Todos os Motoristas (Panorama Geral)';

      // Header
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 210, 35, 'F');
      
      doc.setTextColor(245, 158, 11); // Amber 500
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('JIS ANGOLA • SUPER TAXI', 14, 15);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.text(`RELATÓRIO DE ANÁLISE DE RECEITAS E CUSTOS`, 14, 25);

      doc.setFontSize(9);
      doc.setTextColor(203, 213, 225);
      doc.text(`Data de Emissão: ${new Date().toLocaleString('pt-PT')}`, 140, 25);

      // Meta Info
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Motorista / Alvo: ${driverNameText}`, 14, 45);
      doc.text(`Período de Análise: ${timeFilter === 'today' ? 'Hoje' : timeFilter === 'month' ? 'Mês Atual' : 'Histórico Completo'}`, 14, 52);

      // Financial Summary Box
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, 58, 182, 32, 3, 3, 'FD');

      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text('FATURAÇÃO BRUTA', 20, 66);
      doc.text('COTA JIS (90%)', 70, 66);
      doc.text('DESPESAS / CUSTOS', 120, 66);
      doc.text('LUCRO LÍQUIDO', 160, 66);

      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(`${totalGross.toLocaleString()} Kz`, 20, 75);
      doc.setTextColor(225, 29, 72); // Rose
      doc.text(`${jisShare.toLocaleString()} Kz`, 70, 75);
      doc.setTextColor(220, 38, 38);
      doc.text(`-${totalExpenses.toLocaleString()} Kz`, 120, 75);
      doc.setTextColor(16, 185, 129); // Emerald
      doc.text(`${netRevenue.toLocaleString()} Kz`, 160, 75);

      // Breakdown Info Line
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(`Detalhamento Meios: TPA: ${totalTpa.toLocaleString()} Kz | Dinheiro: ${totalCash.toLocaleString()} Kz | Transf: ${totalTransfer.toLocaleString()} Kz | App: ${totalApp.toLocaleString()} Kz`, 20, 84);

      // Table of Logs
      const tableRows = filteredLogs.map(log => [
        log.date || 'N/A',
        log.driverName || log.prefix || 'Motorista',
        log.prefix || 'N/A',
        `${(log.amount || 0).toLocaleString()} Kz`,
        `${(log.breakdown?.tpa || 0).toLocaleString()} Kz`,
        `${(log.breakdown?.cash || 0).toLocaleString()} Kz`,
        `${(log.breakdown?.expenses || 0).toLocaleString()} Kz`,
        log.status === 'finalized' ? 'Auditado/Final' : log.status === 'approved_by_accountant' ? 'Contabilidade' : 'Pendente'
      ]);

      autoTable(doc, {
        startY: 96,
        head: [['Data', 'Motorista', 'Viatura', 'Valor Bruto', 'TPA', 'Numerário', 'Despesas', 'Estado']],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 2.5 },
      });

      // Signature section
      const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 20 : 200;
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('________________________________________', 20, finalY);
      doc.text('Responsável pela Tesouraria / Operador JIS', 20, finalY + 5);

      doc.text('________________________________________', 130, finalY);
      doc.text('Assinatura do Motorista', 130, finalY + 5);

      doc.save(`Analise_Receitas_Custos_${targetDriver?.prefix || 'Frota'}_${todayStr}.pdf`);
    } catch (err: any) {
      alert('Erro ao gerar relatório em PDF: ' + err.message);
    }
  };

  return (
    <AnimatePresence>
      <motion.div 
        key="driver-revenue-modal"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      >
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
        />

        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-slate-900 border border-slate-800 text-white rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-6 bg-slate-950 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-emerald-500 p-0.5 shadow-lg shadow-amber-500/20 flex items-center justify-center shrink-0">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                  <BarChart3 className="text-amber-400" size={24} />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black uppercase tracking-wider text-white">
                    Análise de Receitas & Custos do Motorista
                  </h3>
                  <span className="px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
                    Auditoria Tesouraria
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Análise detalhada de faturação, split de comissões (90/10), custos operacionais e margem de rentabilidade.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportPDF}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-md cursor-pointer"
              >
                <Download size={14} />
                Exportar PDF
              </button>
              <button 
                onClick={onClose}
                className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="p-4 bg-slate-900/90 border-b border-slate-800/80 flex flex-col md:flex-row items-center justify-between gap-4 shrink-0">
            {/* Driver Selector */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              <User size={16} className="text-amber-400 shrink-0" />
              <label className="text-xs font-bold text-slate-400 uppercase shrink-0">Seleção de Motorista:</label>
              <select
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-black text-amber-400 focus:outline-none focus:border-amber-500 w-full md:w-64"
              >
                <option value="all">FROTA COMPLETA (Panorama Geral)</option>
                {drivers.map(drv => (
                  <option key={drv.id} value={drv.id}>
                    {drv.prefix ? `[${drv.prefix}] ` : ''}{drv.name || 'Sem nome'}
                  </option>
                ))}
              </select>
            </div>

            {/* Time Filter */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs w-full md:w-auto">
              <button
                onClick={() => setTimeFilter('month')}
                className={`px-3 py-1.5 rounded-lg font-extrabold uppercase transition-all ${timeFilter === 'month' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}
              >
                Mês Atual
              </button>
              <button
                onClick={() => setTimeFilter('today')}
                className={`px-3 py-1.5 rounded-lg font-extrabold uppercase transition-all ${timeFilter === 'today' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}
              >
                Hoje
              </button>
              <button
                onClick={() => setTimeFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-extrabold uppercase transition-all ${timeFilter === 'all' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}
              >
                Histórico Geral
              </button>
            </div>
          </div>

          {/* Modal Body Scrollable */}
          <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">

            {/* Target Profile Card */}
            {targetDriver && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center font-black">
                    <Car size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-amber-400 uppercase tracking-widest">{targetDriver.prefix || 'N/A'}</p>
                    <p className="text-base font-bold text-white">{targetDriver.name}</p>
                  </div>
                </div>
                <div className="text-xs text-slate-400 space-y-1">
                  <p><span className="text-slate-500">Telefone:</span> <span className="text-slate-200 font-mono">{targetDriver.phone || 'N/A'}</span></p>
                  <p><span className="text-slate-500">Estado Frota:</span> <span className="text-emerald-400 font-bold uppercase">{targetDriver.status || 'Ativo'}</span></p>
                </div>
                <div className="text-xs text-right">
                  <p className="text-slate-500">Meta Diária Padrão</p>
                  <p className="text-base font-black text-amber-400 font-mono">25.000 Kz/dia</p>
                </div>
              </div>
            )}

            {/* Key Financial KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Gross Revenue */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/30">
                <div className="flex items-center justify-between text-slate-400 text-[10px] font-black uppercase tracking-widest">
                  <span>Faturação Bruta</span>
                  <Wallet size={16} className="text-amber-400" />
                </div>
                <p className="text-2xl font-black text-amber-400 mt-2 font-mono">{totalGross.toLocaleString()} Kz</p>
                <p className="text-[10px] text-slate-500 mt-1">{filteredLogs.length} declarações no período</p>
              </div>

              {/* JIS Share (90%) */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-blue-500/30">
                <div className="flex items-center justify-between text-slate-400 text-[10px] font-black uppercase tracking-widest">
                  <span>Cota Empresa (90%)</span>
                  <ShieldCheck size={16} className="text-blue-400" />
                </div>
                <p className="text-2xl font-black text-blue-400 mt-2 font-mono">{jisShare.toLocaleString()} Kz</p>
                <p className="text-[10px] text-slate-500 mt-1">Repasse direto tesouraria JIS</p>
              </div>

              {/* Driver Share (10%) */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/30">
                <div className="flex items-center justify-between text-slate-400 text-[10px] font-black uppercase tracking-widest">
                  <span>Comissão Motorista (10%)</span>
                  <User size={16} className="text-emerald-400" />
                </div>
                <p className="text-2xl font-black text-emerald-400 mt-2 font-mono">{driverShare.toLocaleString()} Kz</p>
                <p className="text-[10px] text-slate-500 mt-1">Remuneração estimada do motorista</p>
              </div>

              {/* Total Expenses */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-rose-500/30">
                <div className="flex items-center justify-between text-slate-400 text-[10px] font-black uppercase tracking-widest">
                  <span>Custos / Despesas</span>
                  <ArrowDownCircle size={16} className="text-rose-400" />
                </div>
                <p className="text-2xl font-black text-rose-400 mt-2 font-mono">-{totalExpenses.toLocaleString()} Kz</p>
                <p className="text-[10px] text-slate-500 mt-1">Margem Líquida: <span className="text-white font-bold">{marginPercent}%</span></p>
              </div>
            </div>

            {/* Income Sources Breakdown Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Payment Methods Breakdown */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <PieChart size={16} className="text-amber-400" />
                  Origem dos Pagamentos e Meios de Entrada
                </h4>

                <div className="space-y-3">
                  {/* TPA / Multicaixa */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <CreditCard size={14} className="text-blue-400" /> Multicaixa / TPA:
                      </span>
                      <span className="font-mono font-bold text-white">{totalTpa.toLocaleString()} Kz</span>
                    </div>
                    <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-blue-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${totalGross > 0 ? (totalTpa / totalGross) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Cash / Numerário */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Banknote size={14} className="text-emerald-400" /> Numerário (Dinheiro Vivo):
                      </span>
                      <span className="font-mono font-bold text-white">{totalCash.toLocaleString()} Kz</span>
                    </div>
                    <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${totalGross > 0 ? (totalCash / totalGross) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Bank Transfer */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <ArrowRightLeft size={14} className="text-purple-400" /> Transferência Bancária:
                      </span>
                      <span className="font-mono font-bold text-white">{totalTransfer.toLocaleString()} Kz</span>
                    </div>
                    <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-purple-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${totalGross > 0 ? (totalTransfer / totalGross) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  {/* App Rides */}
                  {totalApp > 0 && (
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <Car size={14} className="text-amber-400" /> Corridas de Aplicação (SUPER Taxi):
                        </span>
                        <span className="font-mono font-bold text-white">{totalApp.toLocaleString()} Kz</span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-amber-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${totalGross > 0 ? (totalApp / totalGross) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Performance Indicator Card */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <TrendingUp size={16} className="text-emerald-400" />
                    Indicador de Produtividade & Auditabilidade
                  </h4>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    A receita auditada e aprovada pela contabilidade representa o valor limpo e reconciliado no cofre bancário da JIS ANGOLA.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <p className="text-[10px] text-slate-400 font-black uppercase">Finalizado no Cofre</p>
                    <p className="text-lg font-black text-emerald-400 font-mono mt-1">{totalFinalized.toLocaleString()} Kz</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <p className="text-[10px] text-slate-400 font-black uppercase">Lucro Líquido Real</p>
                    <p className="text-lg font-black text-amber-400 font-mono mt-1">{netRevenue.toLocaleString()} Kz</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Declarations Table */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Calendar size={16} className="text-amber-400" />
                Histórico de Declarações Financeiras Auditadas ({filteredLogs.length})
              </h4>

              {filteredLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-500 bg-slate-950 rounded-2xl border border-slate-800">
                  <p className="text-xs font-bold uppercase tracking-wider">Nenhuma declaração financeira encontrada para este filtro.</p>
                </div>
              ) : (
                <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-black uppercase tracking-wider text-[10px]">
                          <th className="py-3 px-4">Data</th>
                          <th className="py-3 px-4">Motorista / Viatura</th>
                          <th className="py-3 px-4">Valor Bruto</th>
                          <th className="py-3 px-4">TPA / Multicaixa</th>
                          <th className="py-3 px-4">Numerário</th>
                          <th className="py-3 px-4">Despesas</th>
                          <th className="py-3 px-4 text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {filteredLogs.map(log => (
                          <tr key={log.id} className="hover:bg-slate-900/40">
                            <td className="py-3 px-4 font-mono text-slate-300">{log.date || 'N/A'}</td>
                            <td className="py-3 px-4">
                              <p className="font-bold text-white">{log.driverName}</p>
                              <p className="text-[10px] text-amber-400 font-mono">{log.prefix}</p>
                            </td>
                            <td className="py-3 px-4 font-mono font-black text-amber-400">
                              {(log.amount || 0).toLocaleString()} Kz
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-300">
                              {(log.breakdown?.tpa || 0).toLocaleString()} Kz
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-300">
                              {(log.breakdown?.cash || 0).toLocaleString()} Kz
                            </td>
                            <td className="py-3 px-4 font-mono text-rose-400">
                              {(log.breakdown?.expenses || 0) > 0 ? `-${log.breakdown.expenses.toLocaleString()} Kz` : '0 Kz'}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                                log.status === 'finalized' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                                log.status === 'approved_by_accountant' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                                'bg-amber-500/20 text-amber-400 border-amber-500/30'
                              }`}>
                                {log.status === 'finalized' ? 'Finalizado' : log.status === 'approved_by_accountant' ? 'Contabilidade' : 'Pendente'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
