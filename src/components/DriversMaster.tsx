import React, { useState, useEffect } from 'react';
import { 
  UserPlus, 
  Search, 
  MoreHorizontal, 
  Trash2, 
  Edit3,
  FileText,
  Briefcase,
  Award,
  Calendar,
  X,
  Plus,
  Loader2,
  ShieldCheck,
  Phone,
  MessageSquare,
  AlertTriangle,
  TrendingUp,
  Bot,
  Printer,
  Download,
  LayoutDashboard,
  Coins,
  Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy, limit, getDocs, where, writeBatch, updateDoc } from '../lib/firebase';
import { db, handleFirestoreError, OperationType, getActiveTenantId } from '../lib/firebase';
import { cn } from '../lib/utils';
import { geminiService } from '../services/geminiService';

export default function DriversMaster({ embedded = false }: { embedded?: boolean }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingDriver, setEditingDriver] = useState<any>(null);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const [newDriver, setNewDriver] = useState({
    name: '',
    licenseNumber: '',
    experienceYears: '',
    phone: '',
    status: 'Ativo',
  });

  // Detailed unified reports states
  const [selectedDriverForReport, setSelectedDriverForReport] = useState<any>(null);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [reportTab, setReportTab] = useState<'summary' | 'revenues' | 'calls' | 'sms_alerts' | 'accidents' | 'ai_audit'>('summary');
  const [driverRevenueLogs, setDriverRevenueLogs] = useState<any[]>([]);
  const [driverCalls, setDriverCalls] = useState<any[]>([]);
  const [driverSmsLogs, setDriverSmsLogs] = useState<any[]>([]);
  const [driverPanicAlerts, setDriverPanicAlerts] = useState<any[]>([]);
  const [driverAccidents, setDriverAccidents] = useState<any[]>([]);
  const [aiInsight, setAiInsight] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  const [activeTenantData, setActiveTenantData] = useState<{
    id: string;
    name: string;
    phone: string;
    address: string;
    logoUrl?: string;
  } | null>(null);

  // Global accidents & vehicles
  const [allAccidents, setAllAccidents] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [activeMainTab, setActiveMainTab] = useState<'drivers' | 'accidents'>('drivers');
  const [isAccidentModalOpen, setIsAccidentModalOpen] = useState(false);
  const [isSavingAccident, setIsSavingAccident] = useState(false);
  const [newAccident, setNewAccident] = useState({
    driverName: '',
    driverId: '',
    vehicleId: '',
    vehicleLabel: '', // Will hold prefix and plate (e.g. "TX-01 (LD-12-34-AB)")
    date: new Date().toISOString().split('T')[0],
    severity: 'Leve',
    description: ''
  });

  const getDriverClassification = (rewards: any[], calls: any[], accidents: any[]) => {
    const totalRev = rewards.reduce((acc, log) => {
      const isBonus = log.usedBonus === true || log.paidWithBonus === true || log.paymentMethod === 'bonus' || log.isBonus === true;
      return acc + (isBonus ? 0 : (Number(log.amount) || Number(log.value) || 0));
    }, 0);
    const completedCallsCount = calls.filter(c => c.status === 'completed' || c.status === 'concluída').length;
    const totalCallsCount = calls.length;
    const compRate = totalCallsCount > 0 ? (completedCallsCount / totalCallsCount) * 100 : 0;
    
    const severeCount = accidents.filter(a => a.severity === 'Grave').length;
    const totalAcconents = accidents.length;

    if (severeCount > 0 || totalAcconents >= 2) {
      return {
        label: 'RUIM',
        color: 'text-red-600 bg-red-50 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/30',
        textColor: 'text-red-600 dark:text-red-400',
        badge: 'bg-red-500 text-white',
        desc: 'Classificação Ruim: Registou acidentes graves ou histórico recorrente de sinistros (>1), indicando risco elevado para a frota.',
        reason: 'Índice de Acidentes Elevado / Grave'
      };
    } else if (totalAcconents === 1) {
      if (totalRev >= 100000 && compRate >= 75) {
        return {
          label: 'NORMAL',
          color: 'text-amber-655 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/30',
          textColor: 'text-amber-600 dark:text-amber-400',
          badge: 'bg-amber-500 text-slate-900',
          desc: 'Classificação Normal: Enquadrado devido a um único sinistro leve ou médio registado, apesar do bom faturamento e atendimento.',
          reason: 'Faturamento Bom com 1 Sinistro'
        };
      } else {
        return {
          label: 'RUIM',
          color: 'text-red-600 bg-red-50 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/30',
          textColor: 'text-red-600 dark:text-red-400',
          badge: 'bg-red-500 text-white',
          desc: 'Classificação Ruim: Possui um acidente registado conjugado com baixos rendimentos monetários ou baixo volume de chamadas.',
          reason: 'Desempenho Fraco + 1 Sinistro'
        };
      }
    } else { // 0 accidents
      if (totalRev === 0 && totalCallsCount === 0) {
        return {
          label: 'NORMAL',
          color: 'text-slate-500 bg-slate-50 border-slate-200 dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-800/30',
          textColor: 'text-slate-600 dark:text-slate-400',
          badge: 'bg-slate-500 text-white',
          desc: 'Classificação Normal: Colaborador sem histórico operacional recente ou recém-admitido na frota (0 sinistros).',
          reason: 'Inativo / Recém-admitido'
        };
      } else if (totalRev >= 35000 && compRate >= 70) {
        return {
          label: 'BOM',
          color: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/30',
          textColor: 'text-emerald-600 dark:text-emerald-400',
          badge: 'bg-emerald-500 text-white',
          desc: 'Classificação Excelente/Bom: Rendimento financeiro consistente, bom índice de atendimento e ausência total de acidentes.',
          reason: 'Faturamento Excelente + Zero Sinistros'
        };
      } else {
        return {
          label: 'NORMAL',
          color: 'text-amber-655 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/30',
          textColor: 'text-amber-600 dark:text-amber-400',
          badge: 'bg-amber-500 text-slate-900',
          desc: 'Classificação Normal: Histórico impecável de zero sinistros, com entregas de faturamento e chamadas moderadas.',
          reason: 'Operação Regular + Zero Sinistros'
        };
      }
    }
  };

  const handleOpenReport = async (driver: any) => {
    setSelectedDriverForReport(driver);
    setIsReportLoading(true);
    setReportTab('summary');
    setAiInsight('');
    setDriverRevenueLogs([]);
    setDriverCalls([]);
    setDriverSmsLogs([]);
    setDriverPanicAlerts([]);
    setDriverAccidents([]);

    try {
      // 1. Fetch Revenue Logs
      const revQ = query(collection(db, 'revenue_logs'), where('driverName', '==', driver.name));
      const revSnap = await getDocs(revQ);
      const revList = revSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((log: any) => log.status !== 'archived');
      setDriverRevenueLogs(revList);

      // 2. Fetch Calls (match by driverName, driverId, or driverPhone)
      const callsQ = query(collection(db, 'calls'));
      const callsSnap = await getDocs(callsQ);
      const cleanName = (str: string) => (str || '').toLowerCase().trim();
      const targetName = cleanName(driver.name);
      const targetPhone = (driver.phone || '').replace(/\D/g, '');

      const callsList = callsSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .filter((c: any) => {
          const matchId = (driver.id && c.driverId === driver.id) || (driver.uid && c.driverId === driver.uid);
          const matchName = c.driverName && cleanName(c.driverName) === targetName;
          const matchPhone = targetPhone && c.driverPhone && c.driverPhone.replace(/\D/g, '') === targetPhone;
          return matchId || matchName || matchPhone;
        });
      setDriverCalls(callsList);

      // 3. Fetch Panic Alerts (SOS)
      const panicQ = query(collection(db, 'panic_alerts'), where('driverName', '==', driver.name));
      const panicSnap = await getDocs(panicQ);
      const panicList = panicSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDriverPanicAlerts(panicList);

      // 4. Fetch SMS Logs (filter in memory for target phone)
      const smsQ = query(collection(db, 'sms_logs'));
      const smsSnap = await getDocs(smsQ);
      const cleanDriverPhone = driver.phone.replace(/\D/g, '');
      const smsList = smsSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((sms: any) => {
          const targets = sms.targets || [];
          const cleanTargets = targets.map((t: string) => t.replace(/\D/g, ''));
          return cleanTargets.some((t: string) => t.includes(cleanDriverPhone)) || 
                 sms.content?.toLowerCase().includes(driver.name.toLowerCase());
        });
      setDriverSmsLogs(smsList);

      // 5. Fetch Accidents
      const accQ = query(collection(db, 'accident_logs'), where('driverName', '==', driver.name));
      const accSnap = await getDocs(accQ);
      const accList = accSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDriverAccidents(accList);

    } catch (err) {
      console.error("Erro ao carregar relatórios do motorista:", err);
    } finally {
      setIsReportLoading(false);
    }
  };

  const handleGenerateAiAudit = async () => {
    if (!selectedDriverForReport) return;
    setIsAiLoading(true);
    setAiInsight('');
    
    // Calculate simple stats
    const totalRevenue = driverRevenueLogs.reduce((acc, log) => {
      const isBonus = log.usedBonus === true || log.paidWithBonus === true || log.paymentMethod === 'bonus' || log.isBonus === true;
      return acc + (isBonus ? 0 : (Number(log.amount) || Number(log.value) || 0));
    }, 0);
    const completedCalls = driverCalls.filter(c => c.status === 'completed' || c.status === 'concluída').length;
    const totalCalls = driverCalls.length;
    const stats = {
      totalRevenue,
      totalCalls,
      completedCalls,
      conversionRate: totalCalls > 0 ? Math.round((completedCalls / totalCalls) * 100) : 0,
      smsSent: driverSmsLogs.length,
      panicCount: driverPanicAlerts.length,
      accidentCount: driverAccidents.length,
      classification: getDriverClassification(driverRevenueLogs, driverCalls, driverAccidents).label,
      unidLogs: driverRevenueLogs.length + driverCalls.length + driverSmsLogs.length + driverAccidents.length
    };

    try {
      const insight = await geminiService.getDriverPerformanceAudit(selectedDriverForReport, stats);
      setAiInsight(insight);
    } catch (err: any) {
      setAiInsight(`Não foi possível contactar o Gemini 1.5 Flash. Erro: ${err.message}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handlePrintReport = () => {
    if (!selectedDriverForReport) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("O seu navegador bloqueou a janela de impressão. Por favor, permita pop-ups para este site ou utilize o botão 'Descarregar PDF'.");
      return;
    }
    
    const totalRev = driverRevenueLogs.reduce((acc, log) => {
      const isBonus = log.usedBonus === true || log.paidWithBonus === true || log.paymentMethod === 'bonus' || log.isBonus === true;
      return acc + (isBonus ? 0 : (Number(log.amount) || Number(log.value) || 0));
    }, 0).toLocaleString('pt-PT', { style: 'currency', currency: 'AOA' });
    const callsCount = driverCalls.length;
    const sosCount = driverPanicAlerts.length;
    const accCount = driverAccidents.length;
    const classification = getDriverClassification(driverRevenueLogs, driverCalls, driverAccidents);
    
    let revenuesRows = driverRevenueLogs.map(log => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-family: monospace;">${log.date || ''}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${log.prefix || ''}</td>
        <td style="padding: 8px; border: 1px solid #ddd; font-family: monospace; text-align: right;">${(Number(log.amount) || Number(log.value) || 0).toLocaleString('pt-PT', { style: 'currency', currency: 'AOA' })}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${log.status || ''}</td>
      </tr>
    `).join('');

    let accidentsRows = driverAccidents.map(acc => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-family: monospace;">${acc.date || ''}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${acc.vehicleLabel || ''}</td>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; color: #dc2626;">${acc.severity || 'Média'}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${acc.description || ''}</td>
      </tr>
    `).join('');

    let aiAuditHtml = aiInsight ? `
      <div style="margin-top: 30px; padding: 20px; border-left: 4px solid #b91c1c; background: #fef2f2; border-radius: 8px;">
        <h3 style="margin-top: 0; color: #991b1b; text-transform: uppercase; font-size: 14px; letter-spacing: 1px;">Auditoria de Desempenho IA (Gemini 1.5 Flash)</h3>
        <p style="white-space: pre-wrap; font-size: 11px; line-height: 1.6; color: #374151;">${aiInsight}</p>
      </div>
    ` : '';

    printWindow.document.write(`
      <html>
        <head>
          <title>Relatório - ${selectedDriverForReport.name}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; margin: 40px; }
            .header { text-align: center; border-bottom: 3px double #333; padding-bottom: 20px; margin-bottom: 30px; }
            .header h1 { margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 1px; }
            .header p { margin: 5px 0 0 0; font-size: 11px; font-weight: bold; color: #666; letter-spacing: 0.1em; }
            .details-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
            .details-card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; }
            .details-card h3 { margin-top: 0; font-size: 12px; text-transform: uppercase; color: #64748b; margin-bottom: 10px; }
            .details-card p { margin: 4px 0; font-size: 13px; font-weight: bold; }
            .stats-grid { display: grid; grid-template-cols: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
            .stat-box { border: 1px solid #e2e8f0; padding: 15px; text-align: center; border-radius: 8px; }
            .stat-box span { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; }
            .stat-box h4 { margin: 10px 0 0 0; font-size: 18px; font-weight: 900; }
            h2 { font-size: 14px; text-transform: uppercase; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-top: 30px; color: #1e293b; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
            th { background: #f1f5f9; padding: 8px; border: 1px solid #ddd; text-align: left; text-transform: uppercase; font-size: 10px; }
            .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${activeTenantData?.name.toUpperCase() || "JIS ANGOLA"}</h1>
            <p>RELATÓRIO CONSOLIDADO DE PERFORMANCE OPERACIONAL</p>
          </div>
          
          <div class="details-grid">
            <div class="details-card">
              <h3>Informações do Colaborador</h3>
              <p>Nome: <span style="font-weight: 500;">${selectedDriverForReport.name}</span></p>
              <p>Contacto: <span style="font-weight: 500;">${selectedDriverForReport.phone}</span></p>
              <p>Nº Carta: <span style="font-weight: 500;">${selectedDriverForReport.licenseNumber || 'N/D'}</span></p>
              <p>Experiência: <span style="font-weight: 500;">${selectedDriverForReport.experienceYears} Anos</span></p>
            </div>
            <div class="details-card">
              <h3>Auditoria de Classificação</h3>
              <p>Estado Operacional: <span style="color: #10b981; font-weight: 900;">${selectedDriverForReport.status}</span></p>
              <p>Desempenho Geral: <span style="color: #2563eb; font-weight: 900;">${classification.label}</span></p>
              <p>Descrição: <span style="font-weight: 500; font-size: 11px;">${classification.desc}</span></p>
            </div>
          </div>

          <div class="stats-grid">
            <div class="stat-box">
              <span>Faturamento Total</span>
              <h4>${totalRev}</h4>
            </div>
            <div class="stat-box">
              <span>Chamadas / Serviços</span>
              <h4>${callsCount}</h4>
            </div>
            <div class="stat-box">
              <span>Alertas S.O.S</span>
              <h4 style="color: ${sosCount > 0 ? '#dc2626' : '#333'}">${sosCount}</h4>
            </div>
            <div class="stat-box">
              <span>Sinistros (Acidentes)</span>
              <h4 style="color: ${accCount > 0 ? '#dc2626' : '#333'}">${accCount}</h4>
            </div>
          </div>

          ${aiAuditHtml}

          <h2>Historial de Rendas e Faturamento</h2>
          ${revenuesRows ? `
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Prefixo Viatura</th>
                  <th style="text-align: right;">Montante Declarado</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                ${revenuesRows}
              </tbody>
            </table>
          ` : '<p style="font-size: 11px; color: #666;">Nenhum registo de renda encontrado.</p>'}

          ${accidentsRows ? `
            <h2>Registo de Sinistros e Colisões</h2>
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Viatura</th>
                  <th>Gravidade</th>
                  <th>Descrição</th>
                </tr>
              </thead>
              <tbody>
                ${accidentsRows}
              </tbody>
            </table>
          ` : ''}

          <div class="footer">
            <p>Este relatório foi gerado automaticamente pelo Sistema de Gestão de Frota TaxiControl em ${new Date().toLocaleString('pt-PT')}.</p>
            <p>${activeTenantData?.name || "JIS ANGOLA"} - Todos os direitos reservados.</p>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleGeneratePDF = () => {
    if (!selectedDriverForReport) return;
    
    const doc = new jsPDF();
    const driver = selectedDriverForReport;
    
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42); 
    doc.text(activeTenantData?.name.toUpperCase() || "JIS ANGOLA", 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); 
    doc.text("SISTEMA DE GESTÃO DE FROTA TAXICONTROL • RELATÓRIO DO MOTORISTA", 14, 25);
    doc.setDrawColor(226, 232, 240); 
    doc.line(14, 28, 196, 28);
    
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text("Informacoes do Colaborador", 14, 36);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Nome: ${driver.name}`, 14, 43);
    doc.text(`Contacto: ${driver.phone}`, 14, 49);
    doc.text(`No Carta de Conducao: ${driver.licenseNumber || 'Indefinida'}`, 14, 55);
    doc.text(`Anos de Experiencia: ${driver.experienceYears || '0'} Anos`, 14, 61);
    
    const classification = getDriverClassification(driverRevenueLogs, driverCalls, driverAccidents);
    doc.setFont("helvetica", "bold");
    doc.text("Auditoria e Classificacao", 110, 36);
    doc.setFont("helvetica", "normal");
    doc.text(`Estado Operacional: ${driver.status}`, 110, 43);
    doc.text(`Classificacao Operacional: ${classification.label}`, 110, 49);
    doc.text(`Comportamento: ${classification.reason}`, 110, 55);

    doc.setFillColor(248, 250, 252); 
    doc.rect(14, 68, 182, 22, "F");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("RENDIMENTO TOTAL", 20, 74);
    doc.text("CHAMADAS", 70, 74);
    doc.text("ALERTA S.O.S", 120, 74);
    doc.text("SINISTROS", 160, 74);
    
    const totalRev = driverRevenueLogs.reduce((acc, log) => {
      const isBonus = log.usedBonus === true || log.paidWithBonus === true || log.paymentMethod === 'bonus' || log.isBonus === true;
      return acc + (isBonus ? 0 : (Number(log.amount) || Number(log.value) || 0));
    }, 0).toLocaleString('pt-PT', { style: 'currency', currency: 'AOA' });
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text(totalRev, 20, 83);
    doc.text(String(driverCalls.length), 70, 83);
    
    if (driverPanicAlerts.length > 0) {
      doc.setTextColor(220, 38, 38); 
    }
    doc.text(String(driverPanicAlerts.length), 120, 83);
    doc.setTextColor(15, 23, 42);
    
    if (driverAccidents.length > 0) {
      doc.setTextColor(220, 38, 38); 
    }
    doc.text(String(driverAccidents.length), 160, 83);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "normal");

    let currentY = 98;

    if (aiInsight) {
      doc.setFillColor(254, 242, 242); 
      doc.rect(14, currentY, 182, 38, "F");
      doc.setDrawColor(220, 38, 38); 
      doc.line(14, currentY, 14, currentY + 38);
      
      doc.setFontSize(9);
      doc.setTextColor(153, 27, 27); 
      doc.setFont("helvetica", "bold");
      doc.text("AUDITORIA DE DESEMPENHO INTELIGENTE (GEMINI AI 1.5 FLASH)", 18, currentY + 6);
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(55, 65, 81); 
      doc.setFontSize(8);
      const splitLines = doc.splitTextToSize(aiInsight, 172);
      doc.text(splitLines.slice(0, 7), 18, currentY + 13);
      currentY += 44;
    }

    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text("Historial Recente de Rendas Declaradas", 14, currentY);
    
    const revenueData = driverRevenueLogs.slice(0, 10).map(log => [
      log.date || '',
      log.prefix || '',
      (Number(log.amount) || Number(log.value) || 0).toLocaleString('pt-PT', { style: 'currency', currency: 'AOA' }),
      log.status || ''
    ]);

    autoTable(doc, {
      startY: currentY + 4,
      head: [['Data', 'Viatura (Prefixo)', 'Montante Declarado', 'Estado']],
      body: revenueData.length > 0 ? revenueData : [['-', '-', 'Sem registos', '-']],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [15, 23, 42] },
    });

    doc.save(`relatorio_${driver.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.pdf`);
  };

  useEffect(() => {
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

    const q = query(collection(db, 'drivers_master'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setDrivers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'drivers_master'));
    return () => {
      unsubTenant();
      unsub();
    };
  }, []);

  // Listen to global accidents & vehicles
  useEffect(() => {
    const qAcc = query(collection(db, 'accident_logs'), orderBy('date', 'desc'), limit(50));
    const unsubAcc = onSnapshot(qAcc, (snapshot) => {
      setAllAccidents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("Erro ao carregar acidentes:", error));

    const qVeh = query(collection(db, 'master_vehicles'), orderBy('prefix', 'asc'));
    const unsubVeh = onSnapshot(qVeh, (snapshot) => {
      setVehicles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("Erro ao carregar veículos:", error));

    return () => {
      unsubAcc();
      unsubVeh();
    };
  }, []);

  const handleSaveAccident = async (event?: React.FormEvent, customDriver?: any) => {
    if (event) event.preventDefault();
    
    const dName = customDriver ? customDriver.name : newAccident.driverName;
    const dId = customDriver ? (customDriver.id || '') : newAccident.driverId;
    
    if (!dName) {
      alert("Por favor, selecione ou introduza o nome do motorista.");
      return;
    }
    if (!newAccident.vehicleId) {
      alert("Por favor, selecione a viatura envolvida.");
      return;
    }

    setIsSavingAccident(true);
    try {
      const selectedVehicle = vehicles.find(v => v.id === newAccident.vehicleId);
      const vehicleLabel = selectedVehicle 
        ? `${selectedVehicle.prefix} (${selectedVehicle.plate})` 
        : newAccident.vehicleLabel || 'Viatura Desconhecida';

      const accidentDoc = {
        driverName: dName,
        driverId: dId,
        vehicleId: newAccident.vehicleId,
        vehicleLabel,
        date: newAccident.date,
        severity: newAccident.severity,
        description: newAccident.description || 'Sem descrição registada.',
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'accident_logs'), accidentDoc);
      
      // If we are currently viewing a driver's detailed report, refresh their specific list
      if (customDriver || selectedDriverForReport) {
        const targetName = customDriver ? customDriver.name : selectedDriverForReport.name;
        const accQ = query(collection(db, 'accident_logs'), where('driverName', '==', targetName));
        const accSnap = await getDocs(accQ);
        setDriverAccidents(accSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }

      alert("Sinistro registado com sucesso no sistema da Frota.");
      
      // Reset form
      setNewAccident({
        driverName: '',
        driverId: '',
        vehicleId: '',
        vehicleLabel: '',
        date: new Date().toISOString().split('T')[0],
        severity: 'Leve',
        description: ''
      });
      setIsAccidentModalOpen(false);
    } catch (err) {
      console.error("Erro ao guardar acidente:", err);
      alert("Erro ao guardar acidente. Por favor, tente novamente.");
    } finally {
      setIsSavingAccident(false);
    }
  };

  const handleDeleteAccident = async (id: string, origin: 'global' | 'driver' = 'global') => {
    if (!confirm("Tem a certeza que deseja eliminar o registo deste sinistro? Esta operação é irreversível.")) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'accident_logs', id));
      alert("Registo de sinistro removido com sucesso.");
      
      if (origin === 'driver' && selectedDriverForReport) {
        setDriverAccidents(prev => prev.filter(a => a.id !== id));
      }
    } catch (err) {
      console.error("Erro ao eliminar acidente:", err);
      alert("Erro ao eliminar o sinistro.");
    }
  };

  const validatePhoneNumber = (phone: string) => {
    // Basic validation: starts with +244 and has 9 digits after (Angola standard)
    const regex = /^\+244\d{9}$/;
    return regex.test(phone.replace(/\s/g, ''));
  };

  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setPhoneError(null);
    if (!validatePhoneNumber(newDriver.phone)) {
      setPhoneError('Formato inválido. Use +244 seguido de 9 dígitos (Ex: +244920000000)');
      return;
    }

      setIsSubmitting(true);
      const path = 'drivers_master';
      try {
        if (editingDriver) {
          await updateDoc(doc(db, path, editingDriver.id), {
            ...newDriver,
            updatedAt: new Date().toISOString(),
          });
        } else {
          await addDoc(collection(db, path), {
            ...newDriver,
            createdAt: new Date().toISOString(),
          });
        }
        setIsModalOpen(false);
        setEditingDriver(null);
        setNewDriver({
          name: '',
          licenseNumber: '',
          experienceYears: '',
          phone: '',
          status: 'Ativo',
        });
      } catch (error) {
        handleFirestoreError(error, editingDriver ? OperationType.UPDATE : OperationType.CREATE, path);
      } finally {
        setIsSubmitting(false);
      }
    };

  const handleDelete = async (id: string) => {
    const driver = drivers.find(d => d.id === id);
    if (!driver) return;

    if (window.confirm(`ELIMINAR PERMANENTEMENTE ${driver.name}? Esta ação irá remover o perfil e todos os registros operacionais (Extratos, Rendimentos e Folhas de Pagamento).`)) {
      setIsSubmitting(true);
      try {
        // 1. Delete operational records (things most roles can do)
        const batch = writeBatch(db);
        batch.delete(doc(db, 'drivers_master', id));

        // Search and plan deletion from 'access_codes' (Invitations)
        const codeQ = query(collection(db, 'access_codes'), where('targetName', '==', driver.name));
        const codeSnap = await getDocs(codeQ);
        codeSnap.docs.forEach(d => batch.delete(d.ref));

        // Search and plan deletion from 'drivers' (Live Status/Monitor)
        const liveQ = query(collection(db, 'drivers'), where('name', '==', driver.name));
        const liveSnap = await getDocs(liveQ);
        liveSnap.docs.forEach(d => batch.delete(d.ref));

        // Delete Revenue Logs
        const revQ = query(collection(db, 'revenue_logs'), where('driverName', '==', driver.name));
        const revSnap = await getDocs(revQ);
        revSnap.docs.forEach(d => batch.delete(d.ref));

        // Delete Individual Reports
        const repQ = query(collection(db, 'individual_reports'), where('driverName', '==', driver.name));
        const repSnap = await getDocs(repQ);
        repSnap.docs.forEach(d => batch.delete(d.ref));

        // Update Salary Sheets (Remove from staff list)
        const sheetSnap = await getDocs(collection(db, 'salary_sheets'));
        sheetSnap.docs.forEach(d => {
          const sheetData = d.data();
          if (sheetData.staff && Array.isArray(sheetData.staff)) {
            const updatedStaff = sheetData.staff.filter((s: any) => s.name !== driver.name);
            if (updatedStaff.length !== sheetData.staff.length) {
              batch.update(d.ref, { staff: updatedStaff });
            }
          }
        });

        await batch.commit();

        // 2. Try to delete from 'users' (Admin only)
        try {
          const userQ = query(collection(db, 'users'), where('name', '==', driver.name));
          const userSnap = await getDocs(userQ);
          if (!userSnap.empty) {
            const userBatch = writeBatch(db);
            userSnap.docs.forEach(d => userBatch.delete(d.ref));
            await userBatch.commit();
          }
        } catch (itemErr) {
          console.warn("User profile could not be deleted (Insufficient permissions), but operational data was removed.");
        }

        alert(`Colaborador ${driver.name} e todos os seus registros foram removidos com sucesso.`);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `drivers_master/${id}`);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleEdit = (driver: any) => {
    setEditingDriver(driver);
    setNewDriver({
      name: driver.name,
      licenseNumber: driver.licenseNumber,
      experienceYears: driver.experienceYears,
      phone: driver.phone,
      status: driver.status,
    });
    setIsModalOpen(true);
  };

  const filtered = drivers.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.licenseNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={cn("space-y-10 max-w-[1400px] mx-auto pb-20", embedded && "space-y-6 pb-0")}>
      {!embedded && (
        <div className="flex flex-col md:flex-row md:items-center justify-between bg-white px-10 py-10 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-96 h-96 bg-brand-primary/5 rounded-full -mr-48 -mt-48 blur-[80px] opacity-50 group-hover:bg-brand-primary/10 transition-colors duration-700" />
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-2">
              <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Master de Motoristas</h2>
              <div className="px-3 py-1 bg-brand-primary/10 text-brand-primary rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-brand-primary/20">PSM FLEET STAFF</div>
            </div>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.3em] flex items-center gap-2">
              <Briefcase size={14} className="text-brand-primary" />
              Base de Dados Central de Operadores Operacionais • LUENA MOXICO
            </p>
          </div>
          
          <button 
            onClick={() => {
              setEditingDriver(null);
              setNewDriver({
                name: '',
                licenseNumber: '',
                experienceYears: '',
                phone: '',
                status: 'Ativo',
              });
              setIsModalOpen(true);
            }}
            className="relative z-10 flex items-center gap-3 px-10 py-4 bg-slate-900 text-white rounded-[1.25rem] text-[11px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-2xl shadow-black/20 active:scale-95 group/btn"
          >
            <div className="p-1 bg-white/10 rounded-lg group-hover/btn:bg-brand-primary group-hover/btn:text-white transition-colors">
              <Plus size={18} />
            </div>
            Novo Motorista
          </button>
        </div>
      )}

      {/* Main Tab Switcher */}
      {!embedded && (
        <div className="flex bg-slate-100 p-1 rounded-2xl max-w-md shadow-inner">
          <button
            onClick={() => setActiveMainTab('drivers')}
            className={cn(
              "flex-1 py-3 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all",
              activeMainTab === 'drivers' ? "bg-slate-900 text-white shadow-md font-black" : "text-slate-500 hover:text-slate-850 font-bold"
            )}
          >
            ★ Motoristas ({drivers.length})
          </button>
          <button
            onClick={() => setActiveMainTab('accidents')}
            className={cn(
              "flex-1 py-3 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5",
              activeMainTab === 'accidents' ? "bg-red-605 text-white bg-red-600 shadow-md font-black" : "text-slate-500 hover:text-slate-850 font-bold"
            )}
          >
            <AlertTriangle size={13} className={allAccidents.length > 0 ? "text-amber-400" : ""} /> Ocorrências ({allAccidents.length})
          </button>
        </div>
      )}

      {activeMainTab === 'accidents' && !embedded ? (
        <div className="space-y-6">
          {/* Global statistics and action header */}
          <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-red-500/5 rounded-full -mr-40 -mt-40 blur-3xl pointer-events-none" />
            
            <div className="space-y-1 relative z-10">
              <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tight">Registo de Acidentes e Sinistros</h3>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                Auditoria de segurança rodoviária, colisões de veículos e integridade física de passageiros.
              </p>
            </div>

            <button
              onClick={() => {
                setNewAccident({
                  driverName: '',
                  driverId: '',
                  vehicleId: '',
                  vehicleLabel: '',
                  date: new Date().toISOString().split('T')[0],
                  severity: 'Leve',
                  description: ''
                });
                setIsAccidentModalOpen(true);
              }}
              className="flex items-center gap-2 px-8 py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-[1.25rem] text-[11px] font-black uppercase tracking-wider shadow-lg shadow-red-500/10 active:scale-95 transition-all text-center self-start"
            >
              <Plus size={16} /> Registar Acidente
            </button>
          </div>

          <div className="bg-white rounded-[2rem] border border-slate-200 flex flex-col overflow-hidden shadow-sm">
            <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/55 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <span className="text-[10px] uppercase font-black text-slate-500 tracking-widest flex items-center gap-2 font-mono">
                <AlertTriangle size={15} className="text-red-500 animate-pulse" /> Relatório Consolidado de Ocorrências
              </span>
              <div className="px-3.5 py-1.5 bg-red-50 border border-red-150 text-red-700 rounded-xl text-[10px] font-black tracking-widest uppercase font-mono">
                {allAccidents.length} Ocorrências Regulamentares Ativas
              </div>
            </div>

            <div className="overflow-x-auto font-sans">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-tight">
                    <th className="px-6 py-4 text-left border-b border-slate-200">DATA</th>
                    <th className="px-6 py-4 text-left border-b border-slate-200">MOTORISTA ENVOLVIDO</th>
                    <th className="px-6 py-4 text-left border-b border-slate-200">VIATURA</th>
                    <th className="px-6 py-4 text-left border-b border-slate-200">GRAVIDADE</th>
                    <th className="px-6 py-4 text-left border-b border-slate-200">REGISTO DE FACTOS (DESCRIÇÃO)</th>
                    <th className="px-6 py-4 text-right border-b border-slate-200">AÇÕES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allAccidents.map((acc) => (
                    <tr key={acc.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-slate-500">{acc.date}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-black">
                            {acc.driverName?.charAt(0) || 'M'}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 uppercase block">{acc.driverName}</span>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Condutor JIS Master</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-700 font-mono">{acc.vehicleLabel}</td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-widest shadow-xs",
                          acc.severity === 'Grave'
                            ? 'bg-red-100 text-red-700 border border-red-200 shadow-sm font-black'
                            : acc.severity === 'Médio'
                              ? 'bg-amber-100 text-amber-700 border border-amber-200 font-bold'
                              : 'bg-slate-100 text-slate-750 border border-slate-200'
                        )}>
                          {acc.severity}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-650 font-medium max-w-sm truncate" title={acc.description}>
                        {acc.description}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDeleteAccident(acc.id, 'global')}
                          className="text-slate-400 hover:text-red-650 p-1.5 hover:bg-slate-100 rounded-md transition-colors"
                          title="Eliminar sinistro"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {allAccidents.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-20 text-center">
                        <div className="flex flex-col items-center justify-center gap-3 opacity-40">
                          <ShieldCheck size={48} className="text-emerald-500" />
                          <span className="text-[12px] uppercase font-black tracking-widest">Sem Ocorrências Registadas</span>
                          <p className="text-[11px] font-bold text-slate-500 normal-case max-w-md">
                            Excelente! Nenhuma colisão ou sinistro foi reportado recentemente nas viaturas da frota TaxiControl.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <>
          {embedded && (
            <div className="flex items-center justify-between bg-slate-900 rounded-2xl p-6 text-white relative overflow-hidden shadow-lg shadow-black/20">
              <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/20 blur-3xl rounded-full" />
              <div className="relative z-10 flex items-center justify-between w-full">
                <div>
                  <h2 className="text-lg font-black uppercase italic tracking-tight">Banco de Motoristas</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Controlo de pessoal operacional auditado</p>
                </div>
                <button 
                  onClick={() => {
                    setEditingDriver(null);
                    setNewDriver({
                      name: '',
                      licenseNumber: '',
                      experienceYears: '',
                      phone: '',
                      status: 'Ativo',
                    });
                    setIsModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 bg-brand-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-secondary transition-all shadow-lg"
                >
                  <Plus size={16} /> Novo Motorista
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-[2rem] border border-slate-200 flex flex-col overflow-hidden shadow-sm">
            <div className="px-8 py-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between bg-slate-50/50 gap-4">
              <div className="flex items-center gap-4">
                <div className="px-4 py-1.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest italic shadow-xl shadow-black/10">
                  Auditados: {drivers.length} Operadores
                </div>
              </div>
              <div className="relative w-full md:w-80 group/search">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/search:text-brand-primary transition-colors" size={16} />
                <input 
                  type="text" 
                  placeholder="FILTRAR POR NOME OU CARTA..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-6 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-brand-primary transition-all shadow-inner"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-tight">
                <th className="px-6 py-3 text-left border-b border-slate-200">MOTORISTA</th>
                <th className="px-6 py-3 text-left border-b border-slate-200">LICENÇA / CARTA</th>
                <th className="px-6 py-3 text-left border-b border-slate-200">SINISTROS (ACIDENTES)</th>
                <th className="px-6 py-3 text-left border-b border-slate-200">TEL. PESSOAL</th>
                <th className="px-6 py-3 text-left border-b border-slate-200">STATUS</th>
                <th className="px-6 py-3 text-right border-b border-slate-200">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((driver) => (
                <tr key={driver.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold">
                        {driver.name?.charAt(0) || 'M'}
                      </div>
                      <span className="font-bold text-slate-900">{driver.name || 'Motorista'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-600 font-bold uppercase">{driver.licenseNumber}</td>
                  <td className="px-6 py-4">
                    {(() => {
                      const driverAccCount = allAccidents.filter(a => a.driverName === driver.name).length;
                      return driverAccCount > 0 ? (
                        <span className={cn(
                          "px-2.5 py-1 rounded-xl text-[10.5px] font-black tracking-wider flex items-center gap-1.5 w-fit animate-pulse",
                          driverAccCount >= 2 ? "bg-red-100 text-red-700 border border-red-200" : "bg-amber-100 text-amber-700 border border-amber-200"
                        )}>
                          <AlertTriangle size={11} /> {driverAccCount} {driverAccCount === 1 ? 'Acidente' : 'Acidentes'}
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-xl text-[10.5px] font-black bg-slate-150 text-slate-600 border border-slate-200/60 flex items-center gap-1 w-fit">
                          ★ Zero Sinistros
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4 text-slate-600 font-semibold">{driver.phone}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 bg-green-100 text-[#166534] rounded text-[10px] font-bold uppercase tracking-widest">
                      {driver.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3 text-slate-400">
                      <button 
                        onClick={() => handleOpenReport(driver)}
                        title="Ver Relatório Detalhado"
                        className="hover:text-indigo-600 hover:bg-slate-100 p-1.5 rounded-md transition-colors"
                      >
                        <FileText size={16} className="text-indigo-500 hover:text-indigo-700" />
                      </button>
                      <button 
                        onClick={() => handleEdit(driver)}
                        className="hover:text-brand-primary hover:bg-slate-100 p-1.5 rounded-md transition-colors"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(driver.id)}
                        className="hover:text-red-500 hover:bg-slate-100 p-1.5 rounded-md transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2 opacity-30">
                      <Briefcase size={40} />
                      <p className="text-sm font-bold uppercase tracking-tighter">Nenhum motorista encontrado</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )}

      <AnimatePresence>
        {isAccidentModalOpen && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAccidentModalOpen(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden z-10 font-sans"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-red-600 text-white">
                <div>
                  <h3 className="font-extrabold uppercase italic text-sm tracking-widest flex items-center gap-2">
                    <AlertTriangle size={16} /> REGISTAR NOVO SINISTRO
                  </h3>
                  <p className="text-[9px] text-red-100 font-bold uppercase tracking-widest mt-0.5">Lançamento Consolidado no Sistema</p>
                </div>
                <button onClick={() => setIsAccidentModalOpen(false)} className="text-white hover:text-red-200 transition-colors">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={(e) => handleSaveAccident(e, selectedDriverForReport)} className="p-6 space-y-4 text-left">
                {/* Driver select - if selectedDriverForReport is null, show dropdown, otherwise display their name! */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Motorista Envolvido</label>
                  {selectedDriverForReport ? (
                    <div className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 uppercase">
                      {selectedDriverForReport.name}
                    </div>
                  ) : (
                    <select
                      value={newAccident.driverName}
                      onChange={(e) => {
                        const targetDriver = drivers.find(d => d.name === e.target.value);
                        setNewAccident(prev => ({
                          ...prev,
                          driverName: e.target.value,
                          driverId: targetDriver ? (targetDriver.id || '') : ''
                        }));
                      }}
                      required
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 uppercase outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <option value="">-- Selecione o Motorista --</option>
                      {drivers.map(d => (
                        <option key={d.id} value={d.name}>{d.name} ({d.licenseNumber})</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Vehicle select */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Viatura Envolvida</label>
                  <select
                    value={newAccident.vehicleId}
                    onChange={(e) => setNewAccident(prev => ({ ...prev, vehicleId: e.target.value }))}
                    required
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 uppercase outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="">-- Selecione a Viatura --</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.prefix} ({v.plate})</option>
                    ))}
                  </select>
                </div>

                {/* Date & Severity inline */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Data do Sinistro</label>
                    <input
                      type="date"
                      value={newAccident.date}
                      onChange={(e) => setNewAccident(prev => ({ ...prev, date: e.target.value }))}
                      required
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-red-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Gravidade</label>
                    <select
                      value={newAccident.severity}
                      onChange={(e) => setNewAccident(prev => ({ ...prev, severity: e.target.value }))}
                      required
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-705 outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <option value="Leve">LEVE</option>
                      <option value="Médio">MÉDIO</option>
                      <option value="Grave">GRAVE</option>
                    </select>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Descrição detalhada dos factos</label>
                  <textarea
                    value={newAccident.description}
                    onChange={(e) => setNewAccident(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Descreva as circunstâncias do incidente operacional, danos materiais ou ferimentos..."
                    required
                    rows={3}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:ring-2 focus:ring-red-500 resize-none font-medium leading-relaxed font-sans"
                  />
                </div>

                <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAccidentModalOpen(false)}
                    className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-550 text-[10px] font-black uppercase tracking-widest rounded-xl transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingAccident}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition shadow-lg shadow-red-500/10 flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {isSavingAccident && <Loader2 size={12} className="animate-spin" />}
                    Registar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900">{editingDriver ? 'Editar Cadastro Master' : 'Novo Cadastro Master'}</h3>
                  <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">{editingDriver ? 'Atualizar dados do colaborador auditado' : 'Adicionar motorista à base de dados permanente'}</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAddDriver} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Nome Completo</label>
                  <input 
                    required
                    type="text" 
                    value={newDriver.name}
                    onChange={(e) => setNewDriver({...newDriver, name: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:bg-white focus:border-brand-primary transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase">Número da Carta</label>
                    <input 
                      required
                      type="text" 
                      value={newDriver.licenseNumber}
                      onChange={(e) => setNewDriver({...newDriver, licenseNumber: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:bg-white focus:border-brand-primary transition-all font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase">Anos de Experiência</label>
                    <input 
                      required
                      type="number" 
                      value={newDriver.experienceYears}
                      onChange={(e) => setNewDriver({...newDriver, experienceYears: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:bg-white focus:border-brand-primary transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Telefone Pessoal</label>
                  <div className="flex gap-0">
                    <div className="bg-slate-100 border border-r-0 border-slate-200 px-3 py-2 rounded-l-lg text-sm font-bold text-slate-500 flex items-center">
                      +244
                    </div>
                    <input 
                      required
                      type="tel" 
                      placeholder="9XXXXXXXX"
                      maxLength={9}
                      value={newDriver.phone.startsWith('+244') ? newDriver.phone.slice(4) : newDriver.phone}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, ''); // Only digits
                        setNewDriver({...newDriver, phone: val ? `+244${val}` : ''});
                        if (phoneError) setPhoneError(null);
                      }}
                      className={`flex-1 px-4 py-2 bg-slate-50 border rounded-r-lg text-sm outline-none transition-all ${
                        phoneError ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:bg-white focus:border-brand-primary'
                      }`}
                    />
                  </div>
                  {phoneError && (
                    <p className="text-[10px] text-red-500 font-bold uppercase tracking-tight mt-1">{phoneError}</p>
                  )}
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-lg text-[13px] font-bold hover:bg-slate-200 transition-all font-bold uppercase tracking-widest"
                  >
                    VOLTAR
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 bg-brand-primary text-white rounded-lg text-[13px] font-bold hover:shadow-lg hover:bg-brand-secondary transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
                  >
                    {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                    {editingDriver ? 'ATUALIZAR' : 'REGISTAR'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {selectedDriverForReport && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDriverForReport(null)}
              className="absolute inset-0 bg-slate-950/75 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative bg-white rounded-[2rem] shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden z-10 my-8 flex flex-col max-h-[85vh]"
            >
              {/* Header bar */}
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white relative shrink-0">
                <div className="absolute top-0 right-0 py-8 px-12 opacity-5 pointer-events-none">
                  <FileText size={160} />
                </div>
                
                <div className="flex items-center gap-5 relative z-10">
                  <div className="w-12 h-12 bg-white/10 rounded-[1.25rem] flex items-center justify-center text-[#fbbf24] text-xl font-black italic border border-white/10 shrink-0">
                    {selectedDriverForReport.name?.charAt(0) || 'M'}
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-black tracking-tight uppercase italic">{selectedDriverForReport.name}</h3>
                      <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {selectedDriverForReport.status}
                      </span>
                    </div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
                      <Phone size={11} className="text-brand-primary" /> {selectedDriverForReport.phone} • Carta: {selectedDriverForReport.licenseNumber || 'Indefinida'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 relative z-10">
                  <button 
                    onClick={handlePrintReport}
                    className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5 cursor-pointer"
                    title="Imprimir Relatório"
                  >
                    <Printer size={18} className="text-slate-300" />
                  </button>
                  <button 
                    onClick={handleGeneratePDF}
                    className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5 cursor-pointer"
                    title="Descarregar PDF"
                  >
                    <Download size={18} className="text-slate-300" />
                  </button>
                  <button 
                    onClick={() => setSelectedDriverForReport(null)}
                    className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5 cursor-pointer"
                  >
                    <X size={18} className="text-slate-300" />
                  </button>
                </div>
              </div>

              {/* Subtabs selectors */}
              <div className="border-b border-slate-100 flex items-center justify-between px-8 bg-slate-50 overflow-x-auto gap-2 shrink-0">
                <div className="flex gap-1 py-3 shrink-0">
                  <button 
                    onClick={() => setReportTab('summary')}
                    className={cn(
                      "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2",
                      reportTab === 'summary' ? "bg-slate-900 text-white shadow-md font-black" : "text-slate-500 hover:text-slate-950 font-bold"
                    )}
                  >
                    <LayoutDashboard size={12} /> Resumo Geral
                  </button>
                  <button 
                    onClick={() => setReportTab('revenues')}
                    className={cn(
                      "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2",
                      reportTab === 'revenues' ? "bg-slate-900 text-white shadow-md font-black" : "text-slate-500 hover:text-slate-950 font-bold"
                    )}
                  >
                    <Coins size={12} /> Rendas ({driverRevenueLogs.length})
                  </button>
                  <button 
                    onClick={() => setReportTab('calls')}
                    className={cn(
                      "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2",
                      reportTab === 'calls' ? "bg-slate-900 text-white shadow-md font-black" : "text-slate-500 hover:text-slate-950 font-bold"
                    )}
                  >
                    <Phone size={12} /> Chamadas ({driverCalls.length})
                  </button>
                  <button 
                    onClick={() => setReportTab('sms_alerts')}
                    className={cn(
                      "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2",
                      reportTab === 'sms_alerts' ? "bg-slate-900 text-white shadow-md font-black" : "text-slate-500 hover:text-slate-950 font-bold"
                    )}
                  >
                    <MessageSquare size={12} /> SMS & Alertas ({driverSmsLogs.length})
                  </button>
                  <button 
                    onClick={() => setReportTab('accidents')}
                    className={cn(
                      "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2",
                      reportTab === 'accidents' ? "bg-slate-900 text-white shadow-md font-black" : "text-slate-500 hover:text-slate-950 font-bold"
                    )}
                  >
                    <AlertTriangle size={12} className={driverAccidents.length > 0 ? "text-amber-500" : ""} /> Condução / Acidentes ({driverAccidents.length})
                  </button>
                  <button 
                    onClick={() => {
                      setReportTab('ai_audit');
                      if (!aiInsight) handleGenerateAiAudit();
                    }}
                    className={cn(
                      "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2",
                      reportTab === 'ai_audit' ? "bg-brand-primary text-white shadow-md font-black" : "text-slate-500 hover:text-brand-primary font-bold"
                    )}
                  >
                    <Bot size={12} /> Auditoria IA (Gemini)
                  </button>
                </div>
                
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest hidden md:block">
                  {activeTenantData?.name || "JIS ANGOLA"}
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-8 overflow-y-auto flex-1 bg-slate-50/55 min-h-[350px]">
                {isReportLoading ? (
                  <div className="py-20 text-center">
                    <Loader2 className="animate-spin text-brand-primary mx-auto mb-4" size={32} />
                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest animate-pulse">Cruzando dados operacionais e de faturamento...</p>
                  </div>
                ) : (
                  <>
                    {/* SUMMARY VIEW */}
                    {reportTab === 'summary' && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                          <div className="bg-white p-5 border border-slate-200 rounded-[1.25rem] flex flex-col justify-between shadow-sm">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Rendimento Total</span>
                            <h4 className="text-xl font-black text-slate-900 tracking-tight font-mono mt-2">
                              {driverRevenueLogs.reduce((acc, log) => {
                                const isBonus = log.usedBonus === true || log.paidWithBonus === true || log.paymentMethod === 'bonus' || log.isBonus === true;
                                return acc + (isBonus ? 0 : (Number(log.amount) || Number(log.value) || 0));
                              }, 0).toLocaleString('pt-PT', { style: 'currency', currency: 'AOA' })}
                            </h4>
                            <p className="text-[9px] text-emerald-600 font-bold uppercase mt-1">Registos em Faturamento</p>
                          </div>

                          <div className="bg-white p-5 border border-slate-200 rounded-[1.25rem] flex flex-col justify-between shadow-sm">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Serviços / Chamadas</span>
                            <h4 className="text-xl font-black text-slate-900 tracking-tight font-mono mt-2">
                              {driverCalls.length}
                            </h4>
                            <p className="text-[9px] text-indigo-600 font-bold uppercase mt-1">
                              {driverCalls.filter(c => c.status === 'completed' || c.status === 'concluída').length} Concluídos
                            </p>
                          </div>

                          <div className="bg-white p-5 border border-slate-200 rounded-[1.25rem] flex flex-col justify-between shadow-sm">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Avaliação Média</span>
                            {(() => {
                              const ratedCalls = driverCalls.filter((c: any) => {
                                const val = c.rating ?? c.passengerRating ?? c.stars ?? c.evaluation;
                                return val !== undefined && val !== null && !isNaN(Number(val)) && Number(val) > 0;
                              });
                              const avg = ratedCalls.length > 0
                                ? (ratedCalls.reduce((sum: number, c: any) => sum + Number(c.rating ?? c.passengerRating ?? c.stars ?? c.evaluation), 0) / ratedCalls.length).toFixed(1)
                                : (selectedDriverForReport?.rating || selectedDriverForReport?.stars ? Number(selectedDriverForReport.rating || selectedDriverForReport.stars).toFixed(1) : null);
                              return (
                                <>
                                  <h4 className="text-xl font-black text-amber-500 tracking-tight font-mono mt-2 flex items-center gap-1">
                                    <Star size={16} fill="currentColor" /> {avg ? `${avg} ★` : "Novo"}
                                  </h4>
                                  <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">
                                    {ratedCalls.length > 0 ? `${ratedCalls.length} Avaliação(ões)` : "Sem avaliações"}
                                  </p>
                                </>
                              );
                            })()}
                          </div>

                          <div className="bg-white p-5 border border-slate-200 rounded-[1.25rem] flex flex-col justify-between shadow-sm">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Mensagens / SMS</span>
                            <h4 className="text-xl font-black text-slate-900 tracking-tight font-mono mt-2">
                              {driverSmsLogs.length}
                            </h4>
                            <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Alertas Despachados</p>
                          </div>

                          <div className="bg-white p-5 border border-slate-200 rounded-[1.25rem] flex flex-col justify-between shadow-sm">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Alertas SOS / Pânico</span>
                            <h4 className={`text-xl font-black tracking-tight font-mono mt-2 ${driverPanicAlerts.length > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                              {driverPanicAlerts.length}
                            </h4>
                            <p className={`text-[9px] font-bold uppercase mt-1 ${driverPanicAlerts.length > 0 ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}>
                              {driverPanicAlerts.length > 0 ? "ATENÇÃO • SOS ATIVO" : "Nenhum registado"}
                            </p>
                          </div>
                        </div>

                        {/* JIS Driver Classification Card */}
                        {(() => {
                          const classification = getDriverClassification(driverRevenueLogs, driverCalls, driverAccidents);
                          return (
                            <div className={cn("p-6 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm", classification.color)}>
                              <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                  <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Classificação Master (TaxiControl)</span>
                                  <span className={cn("px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest text-[9px] shadow-sm", classification.badge)}>
                                    {classification.label}
                                  </span>
                                </div>
                                <h3 className="text-lg font-black italic tracking-tight">{classification.reason}</h3>
                                <p className="text-[12px] leading-relaxed max-w-2xl opacity-90">{classification.desc}</p>
                              </div>
                              <div className="bg-white/40 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-white/10 text-center shrink-0 min-w-[130px]">
                                <span className="text-[9px] font-black uppercase tracking-widest block opacity-70 text-slate-500">Total Sinistros</span>
                                <span className={cn("text-3xl font-black font-mono mt-1 block", driverAccidents.length > 0 ? "text-red-650 animate-pulse animate-duration-1000" : "text-emerald-500")}>
                                  {driverAccidents.length}
                                </span>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Quick Performance Card */}
                        <div className="bg-white p-6 border border-slate-200 rounded-2xl">
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-2">
                            <TrendingUp size={14} className="text-brand-primary" /> Eficiência Operacional
                          </h4>
                          <div className="flex flex-col md:flex-row items-center gap-6">
                            <div className="flex flex-col items-center gap-1.5 shrink-0">
                              <span className="text-3xl font-black text-slate-900 italic">
                                {driverCalls.length > 0 
                                  ? Math.round((driverCalls.filter(c => c.status === 'completed' || c.status === 'concluída').length / driverCalls.length) * 100) 
                                  : 0}%
                              </span>
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Taxa de Conclusão</span>
                            </div>
                            
                            <div className="flex-1 w-full space-y-2">
                              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-brand-primary" 
                                  style={{ 
                                    width: `${driverCalls.length > 0 
                                      ? Math.round((driverCalls.filter(c => c.status === 'completed' || c.status === 'concluída').length / driverCalls.length) * 100) 
                                      : 0}%` 
                                  }} 
                                />
                              </div>
                              <p className="text-[10px] text-slate-550 font-semibold leading-relaxed">
                                Esta taxa mede a percentagem de corridas solicitadas e concluídas com sucesso por {selectedDriverForReport.name}. 
                                Um rácio superior a 80% indica excelente responsividade operacional.
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Personal Card & Details */}
                        <div className="bg-slate-900 text-slate-100 p-6 rounded-2xl space-y-4">
                          <h4 className="text-xs font-black uppercase tracking-widest text-[#fbbf24]">INFORMAÇÃO MASTER OPERACIONAL</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-[12px]">
                            <div>
                              <span className="text-slate-400 uppercase font-black tracking-widest text-[9px] block">Nome de Operador</span>
                              <span className="font-bold text-white uppercase mt-1 block">{selectedDriverForReport.name}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 uppercase font-black tracking-widest text-[9px] block">Carta de Condução</span>
                              <span className="font-mono font-bold text-white mt-1 block uppercase">{selectedDriverForReport.licenseNumber || "N/D"}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 uppercase font-black tracking-widest text-[9px] block">Anos de Experiência</span>
                              <span className="font-bold text-white mt-1 block">{selectedDriverForReport.experienceYears} Anos Registados</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* DETAILED REVENUES/RENDAS VIEW */}
                    {reportTab === 'revenues' && (
                      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/55 flex items-center justify-between">
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">EXTRATO DE ENTRADAS & RENDAS</h4>
                          <span className="px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 text-[9px] font-black rounded-lg uppercase tracking-wider font-mono">
                            Total: {driverRevenueLogs.length} Lançamentos
                          </span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-[12px]">
                            <thead>
                              <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-tight">
                                <th className="px-6 py-3">DATA / HORA</th>
                                <th className="px-6 py-3">DESCRIÇÃO</th>
                                <th className="px-6 py-3">SITUAÇÃO</th>
                                <th className="px-6 py-3 text-right">VALOR</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {driverRevenueLogs.map(log => (
                                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="px-6 py-4 font-mono text-slate-500">
                                    {log.timestamp?.toDate 
                                      ? log.timestamp.toDate().toLocaleString('pt-PT') 
                                      : log.timestamp 
                                        ? new Date(log.timestamp).toLocaleString('pt-PT') 
                                        : 'Sem data'}
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="font-bold text-slate-800">{log.description || log.notes || "Entrega de Renda Regular"}</div>
                                    <span className="text-[9px] text-slate-400 font-mono block uppercase">ID Transação: {log.id}</span>
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className={cn(
                                      "px-2 px-2.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest",
                                      (log.status === 'validated' || log.status === 'pago' || log.status === 'concluido' || log.status === 'ativo')
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                        : 'bg-amber-50 text-amber-700 border border-amber-100'
                                    )}>
                                      {log.status === 'validated' ? 'Validado' : log.status || 'Pendente'}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-right font-bold text-slate-900 font-mono">
                                    {(Number(log.amount) || Number(log.value) || 0).toLocaleString('pt-PT', { style: 'currency', currency: 'AOA' })}
                                  </td>
                                </tr>
                              ))}
                              {driverRevenueLogs.length === 0 && (
                                <tr>
                                  <td colSpan={4} className="py-12 text-center text-slate-450 uppercase font-bold text-[10px] tracking-widest">
                                    Nenhum lançamento de renda registado na base de dados para este motorista.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* DETAILED CALLS VIEW */}
                    {reportTab === 'calls' && (
                      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/55 flex items-center justify-between">
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">REGISTO DETALHADO DE CHAMADAS</h4>
                          <span className="px-3 py-1 bg-indigo-50 text-indigo-600 border border-indigo-100 text-[9px] font-black rounded-lg uppercase tracking-wider font-mono">
                            Total: {driverCalls.length} Chamadas
                          </span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-[12px]">
                            <thead>
                              <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-tight">
                                <th className="px-6 py-3">DATA / HORA</th>
                                <th className="px-6 py-3">CLIENTE</th>
                                <th className="px-6 py-3">PERCURSO / ENDEREÇO</th>
                                <th className="px-6 py-3">ESTADO</th>
                                <th className="px-6 py-3 text-right">VALOR CORRIDA</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {driverCalls.map(call => (
                                <tr key={call.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="px-6 py-4 font-mono text-slate-500">
                                    {call.timestamp?.toDate 
                                      ? call.timestamp.toDate().toLocaleString('pt-PT') 
                                      : call.timestamp 
                                        ? new Date(call.timestamp).toLocaleString('pt-PT') 
                                        : 'Sem data'}
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="font-bold text-slate-800">{call.customerName || "Cliente Particular"}</div>
                                    <span className="text-[10px] font-mono font-bold text-slate-400">{call.customerPhone}</span>
                                  </td>
                                  <td className="px-6 py-4 text-slate-600 font-medium">
                                    {call.pickupAddress || "Solicitação de Corrida Direta"}
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className={cn(
                                      "px-2.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                                      (call.status === 'completed' || call.status === 'concluída')
                                        ? 'bg-emerald-55 text-emerald-700 border border-emerald-150'
                                        : call.status === 'cancelled'
                                          ? 'bg-rose-50 text-rose-600 border border-rose-100'
                                          : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                                    )}>
                                      {call.status}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-right font-bold text-slate-900 font-mono">
                                    {(Number(call.price) || 0).toLocaleString('pt-PT', { style: 'currency', currency: 'AOA' })}
                                  </td>
                                </tr>
                              ))}
                              {driverCalls.length === 0 && (
                                <tr>
                                  <td colSpan={5} className="py-12 text-center text-slate-450 uppercase font-bold text-[10px] tracking-widest">
                                    Nenhum log de chamada registado para este motorista.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* DETAILED SMS VIEW */}
                    {reportTab === 'sms_alerts' && (
                      <div className="space-y-4">
                        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/55 flex items-center justify-between">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">MENSAGENS SMS DE COORDENAÇÃO DESPACHADAS</h4>
                            <span className="px-3 py-1 bg-amber-50 text-amber-600 border border-amber-100 text-[9px] font-black rounded-lg uppercase tracking-wider font-mono">
                              Total: {driverSmsLogs.length} Alertas
                            </span>
                          </div>
                          
                          <div className="p-6 divide-y divide-slate-150 space-y-4">
                            {driverSmsLogs.map(sms => (
                              <div key={sms.id} className="pt-4 first:pt-0 space-y-1.5 text-left">
                                <div className="flex items-center justify-between text-[11px] text-slate-400">
                                  <span className="font-mono">
                                    {sms.timestamp?.toDate 
                                      ? sms.timestamp.toDate().toLocaleString('pt-PT') 
                                      : sms.timestamp 
                                        ? new Date(sms.timestamp).toLocaleString('pt-PT') 
                                        : 'Sem data'}
                                  </span>
                                  <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded uppercase font-black tracking-widest text-[8px]">
                                    {sms.operator || 'SMS Geral'}
                                  </span>
                                </div>
                                <p className="text-slate-850 text-[13px] bg-slate-50 p-4 rounded-xl border border-slate-150 italic font-medium">
                                  "{sms.content}"
                                </p>
                                <div className="text-[9px] text-slate-450 font-bold uppercase tracking-wider">
                                  Destinatários: {Array.isArray(sms.targets) ? sms.targets.join(', ') : sms.targets || 'Terminal'}
                                </div>
                              </div>
                            ))}
                            {driverSmsLogs.length === 0 && (
                              <div className="py-12 text-center text-slate-400 uppercase font-bold text-[10px] tracking-widest">
                                Nenhum sms ou alerta de rede registado para este motorista.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ACCIDENTS / SINISTROS VIEW */}
                    {reportTab === 'accidents' && (
                      <div className="space-y-6 text-left">
                        {/* Summary rating & action card */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                          <div>
                            <div className="flex items-center gap-2 mb-1.5">
                              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 font-sans flex items-center gap-1.5">
                                <AlertTriangle size={14} className="text-amber-500 animate-pulse" /> Índice de Sinistralidade & Condução
                              </h4>
                            </div>
                            <p className="text-[11px] font-bold text-slate-400 leading-relaxed uppercase tracking-wider">
                              Histórico de acidentes registados com viaturas da frota para {selectedDriverForReport.name}.
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setNewAccident({
                                driverName: selectedDriverForReport.name,
                                driverId: selectedDriverForReport.id || '',
                                vehicleId: '',
                                vehicleLabel: '',
                                date: new Date().toISOString().split('T')[0],
                                severity: 'Leve',
                                description: ''
                              });
                              setIsAccidentModalOpen(true);
                            }}
                            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-500/10 active:scale-95 transition-all text-center"
                          >
                            <AlertTriangle size={14} /> Registar Novo Sinistro
                          </button>
                        </div>

                        {/* Accident logs table */}
                        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/55 flex items-center justify-between">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">REGISTO DE SINISTROS</h4>
                            <span className={cn(
                              "px-3 py-1 text-[9px] font-black rounded-lg uppercase tracking-wider font-mono border",
                              driverAccidents.length > 0
                                ? "bg-red-50 text-red-600 border-red-155 animate-pulse"
                                : "bg-emerald-50 text-emerald-600 border-emerald-150"
                            )}>
                              {driverAccidents.length} {driverAccidents.length === 1 ? "Acidente" : "Acidentes"}
                            </span>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-[12px]">
                              <thead>
                                <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-tight">
                                  <th className="px-6 py-3">DATA</th>
                                  <th className="px-6 py-3">VIATURA ENVOLVIDA</th>
                                  <th className="px-6 py-3">GRAVIDADE</th>
                                  <th className="px-6 py-3">DESCRIÇÃO DOS FACTOS</th>
                                  <th className="px-6 py-3 text-right">AÇÃO</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-sans">
                                {driverAccidents.map(acc => (
                                  <tr key={acc.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 font-mono text-slate-500 font-semibold">
                                      {acc.date}
                                    </td>
                                    <td className="px-6 py-4 font-bold text-slate-900">
                                      {acc.vehicleLabel}
                                    </td>
                                    <td className="px-6 py-4">
                                      <span className={cn(
                                        "px-2.5 py-1 rounded text-[8.5px] font-black uppercase tracking-widest",
                                        acc.severity === 'Grave'
                                          ? 'bg-red-100 text-red-700 border border-red-200 shadow-sm font-black'
                                          : acc.severity === 'Médio'
                                            ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                                      )}>
                                        {acc.severity}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 font-medium max-w-xs truncate" title={acc.description}>
                                      {acc.description}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                      <button
                                        onClick={() => handleDeleteAccident(acc.id, 'driver')}
                                        className="text-slate-400 hover:text-red-650 p-1.5 hover:bg-slate-100 rounded-md transition-colors"
                                        title="Eliminar sinistro"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                                {driverAccidents.length === 0 && (
                                  <tr>
                                    <td colSpan={5} className="py-12 text-center text-emerald-600 font-bold bg-emerald-50/20 px-8">
                                      <div className="flex flex-col items-center gap-2">
                                        <ShieldCheck size={28} className="text-emerald-500" />
                                        <span className="uppercase text-[10.5px] tracking-widest font-black">Zero Sinistros Registados</span>
                                        <p className="text-[10px] text-slate-450 normal-case font-medium max-w-md">
                                          Excelente! O comportamento rodoviário de {selectedDriverForReport.name} atende a todos os critérios de brio profissional e segurança da frota.
                                        </p>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* GEMINI AI AUDIT VIEW */}
                    {reportTab === 'ai_audit' && (
                      <div className="space-y-6 text-left">
                        <div className="bg-slate-900 text-white rounded-2xl p-6 relative overflow-hidden shadow-xl border border-white/5">
                          <div className="absolute top-0 right-0 w-80 h-80 bg-brand-primary/10 rounded-full blur-3xl pointer-events-none" />
                          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="space-y-2">
                              <h4 className="text-[#fbbf24] text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                                <Bot size={14} className="text-brand-primary animate-pulse" /> Auditoria Geral de Desempenho
                              </h4>
                              <h3 className="text-lg font-black italic tracking-tight uppercase">Auditoria Gemini 1.5 Flash • JIS</h3>
                              <p className="text-[11px] text-slate-400 max-w-xl font-medium">
                                O assistente inteligente cruza faturamentos validados, taxas de conversão de corridas e o histórico de mensagens operacionais instantaneamente.
                              </p>
                            </div>
                            <button 
                              onClick={handleGenerateAiAudit}
                              disabled={isAiLoading}
                              className="px-6 py-3 bg-brand-primary text-white text-[10px] font-black uppercase tracking-wider rounded-xl hover:bg-brand-secondary transition-all hover:shadow-lg hover:shadow-brand-primary/20 shrink-0 select-none flex items-center gap-2 active:scale-95"
                            >
                              {isAiLoading ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
                              Gerar Nova Auditoria IA
                            </button>
                          </div>
                        </div>

                        <div className="bg-white p-6 border border-slate-200 rounded-[1.5rem] shadow-sm">
                          {isAiLoading ? (
                            <div className="py-12 text-center">
                              <Loader2 className="animate-spin text-brand-primary mx-auto mb-4" size={28} />
                              <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest animate-pulse">
                                Gemini 1.5 Flash está a cruzar logs de renda e chamadas comerciais...
                              </p>
                            </div>
                          ) : aiInsight ? (
                            <div className="text-slate-850 space-y-4 leading-relaxed text-[13px] font-medium font-sans">
                              <div className="bg-slate-50 border-l-4 border-brand-primary p-4 rounded-r-xl italic font-sans text-slate-600 text-xs mb-4">
                                "Auditado em: LUENA, MOXICO por Técnico Supervisor de Frotas JIS."
                              </div>
                              <p className="whitespace-pre-line text-slate-700">
                                {aiInsight}
                              </p>
                            </div>
                          ) : (
                            <div className="py-12 text-center text-slate-400 font-black text-[10px] tracking-widest uppercase">
                              Clique no botão "Gerar Nova Auditoria IA" para solicitar uma avaliação inteligente.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer bar */}
              <div className="px-8 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">
                <span>Relatório Consolidado de Desempenho • LUENA</span>
                <button 
                  onClick={() => setSelectedDriverForReport(null)}
                  className="px-6 py-2 bg-slate-900 hover:bg-black text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all"
                >
                  Fechar Pasta
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
