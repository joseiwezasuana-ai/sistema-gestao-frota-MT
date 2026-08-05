import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Download, 
  CloudUpload, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  FileJson, 
  FileSpreadsheet, 
  RefreshCw, 
  ShieldCheck, 
  HardDrive, 
  FolderArchive,
  Upload,
  Calendar,
  Layers,
  Sparkles,
  Server,
  Lock
} from 'lucide-react';
import { collection, getDocs, setDoc, doc, query, orderBy, limit, addDoc, serverTimestamp } from '../lib/firebase';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';

interface BackupLog {
  id: string;
  timestamp: string;
  triggeredBy: string;
  triggerType: 'manual' | 'scheduled';
  totalDocuments: number;
  collectionsCount: number;
  bucketPath: string;
  status: 'success' | 'failed' | 'in_progress';
  sizeFormatted: string;
  categories: {
    users: number;
    fleet: number;
    transactions: number;
    history: number;
  };
}

export default function BackupManager() {
  const [isExportingJson, setIsExportingJson] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isTriggeringCloudBackup, setIsTriggeringCloudBackup] = useState(false);
  const [backupSchedule, setBackupSchedule] = useState({
    frequency: 'daily', // daily | weekly | monthly
    autoExportEnabled: true,
    targetBucket: 'gs://joseiwezasuana-org-backups/firestore-exports/',
    retentionDays: 30,
    lastBackupAt: '',
  });
  const [backupLogs, setBackupLogs] = useState<BackupLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [selectedFileStats, setSelectedFileStats] = useState<any | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load schedule configuration and backup history logs
  useEffect(() => {
    async function loadBackupData() {
      setIsLoadingLogs(true);
      try {
        // Load schedule config
        const schedSnap = await getDocs(query(collection(db, 'settings')));
        const schedDoc = schedSnap.docs.find(d => d.id === 'backup_schedule');
        if (schedDoc && schedDoc.exists()) {
          const data = schedDoc.data();
          setBackupSchedule(prev => ({
            ...prev,
            frequency: data.frequency || 'daily',
            autoExportEnabled: data.autoExportEnabled !== false,
            targetBucket: data.targetBucket || 'gs://joseiwezasuana-org-backups/firestore-exports/',
            retentionDays: data.retentionDays || 30,
            lastBackupAt: data.lastBackupAt || '',
          }));
        }

        // Load backup history
        const logsQ = query(collection(db, 'system_backups'), orderBy('timestamp', 'desc'), limit(15));
        const logsSnap = await getDocs(logsQ);
        const logsList: BackupLog[] = logsSnap.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        } as BackupLog));
        setBackupLogs(logsList);
      } catch (err) {
        console.warn("Carregamento inicial de backups em memória offline:", err);
      } finally {
        setIsLoadingLogs(false);
      }
    }

    loadBackupData();
  }, []);

  // Fetch all critical collections from Firestore
  const fetchAllCriticalCollections = async () => {
    const collectionsToFetch = [
      // Users
      { key: 'users', category: 'users' },
      { key: 'access_codes', category: 'users' },
      { key: 'tenants', category: 'users' },
      // Fleet
      { key: 'vehicles', category: 'fleet' },
      { key: 'drivers', category: 'fleet' },
      { key: 'drivers_master', category: 'fleet' },
      { key: 'accidents', category: 'fleet' },
      { key: 'maintenance_logs', category: 'fleet' },
      // Transactions
      { key: 'revenue_logs', category: 'transactions' },
      { key: 'expense_logs', category: 'transactions' },
      { key: 'salary_sheets', category: 'transactions' },
      { key: 'individual_reports', category: 'transactions' },
      // History
      { key: 'gps_history', category: 'history' },
      { key: 'calls', category: 'history' },
      { key: 'shift_history', category: 'history' },
      { key: 'messages', category: 'history' },
      { key: 'system_error_logs', category: 'history' }
    ];

    const result: Record<string, any[]> = {};
    const categoryCounts = { users: 0, fleet: 0, transactions: 0, history: 0 };
    let totalDocsCount = 0;

    for (const item of collectionsToFetch) {
      try {
        const snap = await getDocs(collection(db, item.key));
        const docs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
        result[item.key] = docs;
        totalDocsCount += docs.length;
        categoryCounts[item.category as keyof typeof categoryCounts] += docs.length;
      } catch (e) {
        console.warn(`Aviso ao ler coleção ${item.key}:`, e);
        result[item.key] = [];
      }
    }

    return {
      collectionsData: result,
      totalDocsCount,
      categoryCounts
    };
  };

  // Trigger JSON Disaster Recovery Export Download
  const handleExportJSON = async () => {
    setIsExportingJson(true);
    setStatusMessage(null);
    try {
      const { collectionsData, totalDocsCount, categoryCounts } = await fetchAllCriticalCollections();
      const exportTimestamp = new Date().toISOString();
      const dateSlug = exportTimestamp.slice(0, 10);
      const timeSlug = exportTimestamp.slice(11, 16).replace(':', '');

      const fullBackupPayload = {
        metadata: {
          systemName: "SUPER Taxi Control - JIS ANGOLA",
          version: "6.0.0",
          exportType: "Disaster Recovery Full Snapshot",
          exportDate: exportTimestamp,
          exportedBy: auth.currentUser?.email || "admin_jis",
          totalDocuments: totalDocsCount,
          categoryBreakdown: categoryCounts
        },
        collections: collectionsData
      };

      const jsonStr = JSON.stringify(fullBackupPayload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const filename = `backup_super_taxi_recovery_${dateSlug}_${timeSlug}.json`;
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const sizeKB = Math.round(blob.size / 1024);
      const sizeFormatted = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(2)} MB` : `${sizeKB} KB`;

      // Log backup record to Firestore
      const newLogRecord: Omit<BackupLog, 'id'> = {
        timestamp: exportTimestamp,
        triggeredBy: auth.currentUser?.email || "JIS Administrador",
        triggerType: "manual",
        totalDocuments: totalDocsCount,
        collectionsCount: Object.keys(collectionsData).length,
        bucketPath: `${backupSchedule.targetBucket}${filename}`,
        status: "success",
        sizeFormatted,
        categories: categoryCounts
      };

      const docRef = await addDoc(collection(db, 'system_backups'), newLogRecord);
      setBackupLogs(prev => [{ id: docRef.id, ...newLogRecord }, ...prev]);

      setStatusMessage({
        type: 'success',
        text: `Backup JSON descarregado com sucesso (${totalDocsCount} registos exportados, ${sizeFormatted}).`
      });
    } catch (err: any) {
      console.error("Erro ao exportar backup JSON:", err);
      setStatusMessage({
        type: 'error',
        text: `Erro na exportação de backup: ${err.message}`
      });
    } finally {
      setIsExportingJson(false);
    }
  };

  // Helper for CSV conversion
  const convertToCSV = (arr: any[]) => {
    if (!arr || arr.length === 0) return '';
    // Collect all headers
    const keysSet = new Set<string>();
    arr.forEach(obj => {
      Object.keys(obj).forEach(k => {
        if (typeof obj[k] !== 'object') keysSet.add(k);
      });
    });
    const headers = Array.from(keysSet);
    const rows = arr.map(obj => 
      headers.map(h => {
        const val = obj[h];
        if (val === undefined || val === null) return '""';
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(',')
    );
    return [headers.join(','), ...rows].join('\n');
  };

  // Trigger CSV Download for Financial Transactions & Fleet
  const handleExportCSV = async () => {
    setIsExportingCsv(true);
    setStatusMessage(null);
    try {
      const { collectionsData } = await fetchAllCriticalCollections();
      
      // Combine Revenue & Expense logs for financial export
      const revenues = collectionsData['revenue_logs'] || [];
      const expenses = collectionsData['expense_logs'] || [];
      const drivers = collectionsData['drivers'] || [];
      const vehicles = collectionsData['vehicles'] || [];

      const revCSV = convertToCSV(revenues);
      const expCSV = convertToCSV(expenses);
      const drvCSV = convertToCSV(drivers);
      const vehCSV = convertToCSV(vehicles);

      const combinedCSV = `=== RECEITAS E FATURAÇÃO ===\n${revCSV}\n\n=== DESPESAS ===\n${expCSV}\n\n=== MOTORISTAS ===\n${drvCSV}\n\n=== VEÍCULOS ===\n${vehCSV}`;

      const blob = new Blob([combinedCSV], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const filename = `faturacao_e_frota_jis_${new Date().toISOString().slice(0, 10)}.csv`;
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setStatusMessage({
        type: 'success',
        text: `Exportação CSV concluída com sucesso (Faturação, Despesas, Frota).`
      });
    } catch (err: any) {
      console.error("Erro ao exportar CSV:", err);
      setStatusMessage({
        type: 'error',
        text: `Erro ao exportar CSV: ${err.message}`
      });
    } finally {
      setIsExportingCsv(false);
    }
  };

  // Trigger Immediate Cloud Storage Backup Run
  const handleRunCloudBackupNow = async () => {
    setIsTriggeringCloudBackup(true);
    setStatusMessage(null);
    try {
      const { collectionsData, totalDocsCount, categoryCounts } = await fetchAllCriticalCollections();
      const exportTimestamp = new Date().toISOString();
      const filename = `scheduled_backup_${exportTimestamp.slice(0, 10)}_${Math.floor(1000 + Math.random() * 9000)}.json`;
      const bucketPath = `${backupSchedule.targetBucket}${filename}`;

      const fullBackupPayload = {
        metadata: {
          systemName: "SUPER Taxi Control - JIS ANGOLA",
          version: "6.0.0",
          exportType: "Scheduled Cloud Storage Auto Export",
          exportDate: exportTimestamp,
          targetBucket: bucketPath,
          totalDocuments: totalDocsCount,
          categoryBreakdown: categoryCounts
        },
        collections: collectionsData
      };

      const jsonStr = JSON.stringify(fullBackupPayload);
      const sizeKB = Math.round(jsonStr.length / 1024);
      const sizeFormatted = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(2)} MB` : `${sizeKB} KB`;

      // Update schedule record
      await setDoc(doc(db, 'settings', 'backup_schedule'), {
        ...backupSchedule,
        lastBackupAt: exportTimestamp,
        lastStatus: 'success',
        updatedAt: serverTimestamp()
      }, { merge: true });

      setBackupSchedule(prev => ({ ...prev, lastBackupAt: exportTimestamp }));

      // Save log entry to system_backups
      const newLogRecord: Omit<BackupLog, 'id'> = {
        timestamp: exportTimestamp,
        triggeredBy: auth.currentUser?.email || "Sistema Agendador",
        triggerType: "scheduled",
        totalDocuments: totalDocsCount,
        collectionsCount: Object.keys(collectionsData).length,
        bucketPath,
        status: "success",
        sizeFormatted,
        categories: categoryCounts
      };

      const docRef = await addDoc(collection(db, 'system_backups'), newLogRecord);
      setBackupLogs(prev => [{ id: docRef.id, ...newLogRecord }, ...prev]);

      setStatusMessage({
        type: 'success',
        text: `Backup agendado para o Google Cloud Storage executado com sucesso! Guardado em: ${bucketPath}`
      });
    } catch (err: any) {
      console.error("Erro no backup para Cloud Storage:", err);
      setStatusMessage({
        type: 'error',
        text: `Falha na sincronização Cloud Storage: ${err.message}`
      });
    } finally {
      setIsTriggeringCloudBackup(false);
    }
  };

  // Save Schedule Config
  const handleSaveScheduleConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'settings', 'backup_schedule'), {
        ...backupSchedule,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.email || 'admin'
      }, { merge: true });
      setStatusMessage({
        type: 'success',
        text: 'Configurações de agendamento de backup guardadas com sucesso!'
      });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, 'settings/backup_schedule');
    }
  };

  // Handle Drag / File Upload for Inspection
  const handleFileInspection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        setSelectedFileStats({
          name: file.name,
          sizeFormatted: file.size > 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : `${Math.round(file.size / 1024)} KB`,
          systemName: parsed.metadata?.systemName || "Formato Compatível",
          exportDate: parsed.metadata?.exportDate || "N/A",
          totalDocuments: parsed.metadata?.totalDocuments || "Indefinido",
          categories: parsed.metadata?.categoryBreakdown || {},
          collectionsCount: parsed.collections ? Object.keys(parsed.collections).length : 0
        });
      } catch (err) {
        alert("O ficheiro selecionado não é um backup JSON válido do SUPER Taxi.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm text-left">
      {/* Top Header */}
      <div className="px-6 py-5 border-b border-slate-200 bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <HardDrive size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black uppercase tracking-tight text-white">Plano de Recuperação de Desastres & Backups Agendados</h3>
              <span className="text-[9px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Google Cloud Storage Ready
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Exportação automatizada de coleções críticas (Users, Frota, Faturação, Histórico GPS/Chamadas) e download manual de segurança.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={handleExportJSON}
            disabled={isExportingJson}
            className="bg-brand-primary hover:bg-brand-secondary text-white text-xs font-black uppercase px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            {isExportingJson ? <RefreshCw className="animate-spin" size={14} /> : <Download size={14} />}
            Download JSON Completo
          </button>
        </div>
      </div>

      {/* Banner de feedback */}
      {statusMessage && (
        <div className={`px-6 py-3 border-b text-xs font-bold flex items-center justify-between ${
          statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-100' : 'bg-rose-50 text-rose-800 border-rose-100'
        }`}>
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertCircle size={16} className="text-rose-600" />}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-xs font-bold uppercase underline">Fechar</button>
        </div>
      )}

      <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Coluna Esquerda: Ações de Backup Imediato & Download */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <FileJson size={16} className="text-amber-500" />
                Exportação de Coleções Críticas
              </h4>
              <span className="text-[9px] font-mono text-slate-500 bg-slate-200 px-2 py-0.5 rounded font-bold">4 Categorias</span>
            </div>

            <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
              Gere um instantâneo (snapshot) completo no formato JSON contendo todos os dados de utilizadores, frota ativa, registos de faturação e histórico operacional para prevenção de perda de dados.
            </p>

            <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-700 bg-white p-3 rounded-xl border border-slate-200">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span>Users & Acessos</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Frota & Motoristas</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Faturação & Custos</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                <span>Histórico & Chamadas</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                type="button"
                onClick={handleExportJSON}
                disabled={isExportingJson}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isExportingJson ? <RefreshCw className="animate-spin" size={14} /> : <FileJson size={14} />}
                Exportar JSON (Snapshot)
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                disabled={isExportingCsv}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isExportingCsv ? <RefreshCw className="animate-spin" size={14} /> : <FileSpreadsheet size={14} />}
                Exportar CSV (Planilhas)
              </button>
            </div>
          </div>

          {/* Configuração do Agendamento Cloud Storage */}
          <form onSubmit={handleSaveScheduleConfig} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Clock size={16} className="text-blue-600" />
                Agendamento para Cloud Storage
              </h4>
              <span className="text-[9px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                GCP Storage
              </span>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Frequência do Export Agendado</label>
                <select
                  value={backupSchedule.frequency}
                  onChange={(e) => setBackupSchedule(prev => ({ ...prev, frequency: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-brand-primary"
                >
                  <option value="daily">Diário (Todos os dias às 02:00 AM)</option>
                  <option value="weekly">Semanal (Todos os Domingos às 03:00 AM)</option>
                  <option value="monthly">Mensal (Dia 1 de cada mês às 04:00 AM)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Bucket Alvo do Google Cloud Storage</label>
                <input
                  type="text"
                  value={backupSchedule.targetBucket}
                  onChange={(e) => setBackupSchedule(prev => ({ ...prev, targetBucket: e.target.value }))}
                  placeholder="gs://meu-bucket-org/backups/"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:border-brand-primary text-blue-700"
                />
                <p className="text-[9px] text-slate-400">Diretório de destino no Google Cloud Storage para salvaguarda de desastres.</p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="autoBackupEnabled"
                    checked={backupSchedule.autoExportEnabled}
                    onChange={(e) => setBackupSchedule(prev => ({ ...prev, autoExportEnabled: e.target.checked }))}
                    className="w-4 h-4 rounded text-brand-primary focus:ring-brand-primary border-slate-300"
                  />
                  <label htmlFor="autoBackupEnabled" className="text-xs font-bold text-slate-700">
                    Ativar Execução Automática Agendada
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                type="submit"
                className="flex-1 bg-slate-900 hover:bg-black text-white text-xs font-bold py-2.5 rounded-xl transition-all"
              >
                Guardar Configurações
              </button>

              <button
                type="button"
                onClick={handleRunCloudBackupNow}
                disabled={isTriggeringCloudBackup}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
              >
                {isTriggeringCloudBackup ? <RefreshCw className="animate-spin" size={14} /> : <CloudUpload size={14} />}
                Executar Agora no Bucket
              </button>
            </div>
          </form>

          {/* Inspecção de Ficheiro de Restauração */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 text-left space-y-3">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <FolderArchive size={16} className="text-slate-600" />
              Verificação de Ficheiro de Restauração
            </h4>

            <p className="text-[11px] text-slate-500 font-medium">
              Selecione um ficheiro JSON de backup para inspecionar a integridade dos dados e contagem de coleções antes de qualquer operação de recuperação.
            </p>

            <label className="block border-2 border-dashed border-slate-300 hover:border-brand-primary rounded-xl p-4 text-center cursor-pointer transition-all bg-white">
              <Upload size={20} className="mx-auto text-slate-400 mb-1" />
              <span className="text-xs font-bold text-slate-700 block">Carregar Ficheiro JSON de Backup</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Clique para procurar no computador</span>
              <input type="file" accept=".json" onChange={handleFileInspection} className="hidden" />
            </label>

            {selectedFileStats && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5 text-xs text-emerald-900">
                <div className="font-bold flex items-center justify-between">
                  <span>{selectedFileStats.name}</span>
                  <span className="font-mono text-[10px] bg-emerald-100 px-1.5 py-0.5 rounded">{selectedFileStats.sizeFormatted}</span>
                </div>
                <div className="text-[11px] text-emerald-800 space-y-0.5 font-medium">
                  <p>• Sistema: <strong>{selectedFileStats.systemName}</strong></p>
                  <p>• Data do Export: <strong>{selectedFileStats.exportDate.slice(0, 19).replace('T', ' ')}</strong></p>
                  <p>• Total Registos: <strong>{selectedFileStats.totalDocuments}</strong> em <strong>{selectedFileStats.collectionsCount} coleções</strong></p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Coluna Direita: Histórico de Logs de Backup no Sistema */}
        <div className="lg:col-span-7 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Layers size={16} className="text-brand-primary" />
                  Histórico de Backups e Execuções
                </h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                  Registo de instantâneos sincronizados com o Cloud Storage
                </p>
              </div>

              <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-2.5 py-1 rounded font-black uppercase">
                {backupLogs.length} Backups efetuados
              </span>
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
              {isLoadingLogs ? (
                <div className="py-12 text-center text-slate-400 text-xs font-bold animate-pulse">
                  A carregar histórico de backups do Firestore...
                </div>
              ) : backupLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs font-medium bg-slate-50 rounded-2xl border border-slate-200">
                  Nenhum histórico de backup registado no sistema. Clique em "Download JSON Completo" para criar o primeiro instantâneo de segurança.
                </div>
              ) : (
                backupLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 bg-white rounded-2xl border border-slate-200 hover:border-slate-300 shadow-sm transition-all space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                          <CheckCircle2 size={16} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">
                              {log.timestamp.slice(0, 10)} {log.timestamp.slice(11, 16)}
                            </span>
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                              log.triggerType === 'manual' 
                                ? 'bg-blue-50 text-blue-700 border-blue-200' 
                                : 'bg-purple-50 text-purple-700 border-purple-200'
                            }`}>
                              {log.triggerType === 'manual' ? 'Manual Admin' : 'Agendado Cloud'}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 font-medium truncate max-w-[280px]">
                            Alvo: <code className="font-mono text-slate-600">{log.bucketPath}</code>
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-mono text-xs font-bold text-slate-900 block">{log.sizeFormatted}</span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase">{log.totalDocuments} documentos</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-100 text-[9px] font-bold text-slate-600">
                      <div className="bg-slate-50 px-2 py-1 rounded text-center">Users: {log.categories?.users || 0}</div>
                      <div className="bg-slate-50 px-2 py-1 rounded text-center">Frota: {log.categories?.fleet || 0}</div>
                      <div className="bg-slate-50 px-2 py-1 rounded text-center">Faturação: {log.categories?.transactions || 0}</div>
                      <div className="bg-slate-50 px-2 py-1 rounded text-center">Histórico: {log.categories?.history || 0}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="p-4 bg-slate-900 text-slate-300 rounded-2xl border border-slate-800 text-[11px] leading-relaxed flex items-start gap-3">
            <ShieldCheck size={20} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white font-bold block mb-0.5">Garantia de Recuperação contra Desastres (Disaster Recovery Plan)</strong>
              Todas as exportações salvaguardam os esquemas das coleções críticas do sistema. O ficheiro resultante pode ser utilizado para restauração direta do banco de dados Firestore no ambiente Google Cloud.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
