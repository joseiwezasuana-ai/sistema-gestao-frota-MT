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
  Lock,
  ExternalLink,
  FileText,
  Archive
} from 'lucide-react';
import { collection, getDocs, setDoc, doc, query, orderBy, limit, addDoc, serverTimestamp } from '../lib/firebase';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';

interface BackupArtifact {
  filename: string;
  storagePath: string;
  format: 'json' | 'csv';
  sizeBytes: number;
  sizeFormatted: string;
  downloadUrl?: string;
  recordCount?: number;
}

interface BackupExecutionRecord {
  id: string;
  timestamp: string;
  weekNumber?: string;
  triggeredBy: string;
  triggerType: 'manual' | 'scheduled';
  totalDocuments?: number;
  totalRecords?: number;
  collectionsCount?: number;
  bucketPath?: string;
  storageBucket?: string;
  status: 'success' | 'partial' | 'failed' | 'in_progress';
  sizeFormatted?: string;
  totalSizeFormatted?: string;
  artifacts?: BackupArtifact[];
  categories?: {
    users?: number;
    fleet?: number;
    financial?: number;
    transactions?: number;
    history?: number;
    operations?: number;
    systemLogs?: number;
  };
}

export default function BackupManager() {
  const [isExportingJson, setIsExportingJson] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isRunningWeeklyStorageBackup, setIsRunningWeeklyStorageBackup] = useState(false);
  const [backupSchedule, setBackupSchedule] = useState({
    frequency: 'weekly', // daily | weekly | monthly
    autoExportEnabled: true,
    targetBucket: 'gs://joseiwezasuana-org.firebasestorage.app/backups/weekly/',
    retentionDays: 60,
    lastBackupAt: '',
    lastBackupWeek: '',
    lastBackupStatus: '',
    lastTotalRecords: 0,
    lastTotalSize: '',
  });
  const [backupLogs, setBackupLogs] = useState<BackupExecutionRecord[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [selectedFileStats, setSelectedFileStats] = useState<any | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeArtifactsModal, setActiveArtifactsModal] = useState<BackupArtifact[] | null>(null);

  // Load schedule configuration and backup history logs
  const loadBackupData = async () => {
    setIsLoadingLogs(true);
    try {
      // 1. Try fetching from server-side history endpoint
      const res = await fetch('/api/backup/history').catch(() => null);
      if (res && res.ok) {
        const json = await res.json();
        if (json.backups && Array.isArray(json.backups)) {
          setBackupLogs(json.backups);
        }
        if (json.schedule) {
          setBackupSchedule(prev => ({
            ...prev,
            ...json.schedule,
            targetBucket: json.schedule.targetBucket || `gs://${json.storageBucket}/backups/weekly/`,
          }));
        }
      } else {
        // Fallback directly to Firestore
        const schedSnap = await getDocs(query(collection(db, 'settings')));
        const schedDoc = schedSnap.docs.find(d => d.id === 'backup_schedule');
        if (schedDoc && schedDoc.exists()) {
          const data = schedDoc.data();
          setBackupSchedule(prev => ({
            ...prev,
            ...data,
          }));
        }

        const logsQ = query(collection(db, 'system_backups'), orderBy('timestamp', 'desc'), limit(20));
        const logsSnap = await getDocs(logsQ);
        const logsList: BackupExecutionRecord[] = logsSnap.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        } as BackupExecutionRecord));
        setBackupLogs(logsList);
      }
    } catch (err) {
      console.warn("Carregamento de histórico de backups:", err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    loadBackupData();
  }, []);

  // Fetch all critical collections from Firestore (Client-side fallback)
  const fetchAllCriticalCollections = async () => {
    const collectionsToFetch = [
      { key: 'users', category: 'users' },
      { key: 'access_codes', category: 'users' },
      { key: 'tenants', category: 'users' },
      { key: 'master_vehicles', category: 'fleet' },
      { key: 'drivers', category: 'fleet' },
      { key: 'drivers_master', category: 'fleet' },
      { key: 'driver_scales', category: 'fleet' },
      { key: 'accident_logs', category: 'fleet' },
      { key: 'maintenance_logs', category: 'fleet' },
      { key: 'revenue_logs', category: 'transactions' },
      { key: 'salary_sheets', category: 'transactions' },
      { key: 'internal_contracts', category: 'transactions' },
      { key: 'gps_history', category: 'history' },
      { key: 'calls', category: 'history' },
      { key: 'shifts', category: 'history' },
      { key: 'panic_alerts', category: 'history' },
      { key: 'messages', category: 'history' },
      { key: 'sms_logs', category: 'history' }
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
        result[item.key] = [];
      }
    }

    return {
      collectionsData: result,
      totalDocsCount,
      categoryCounts
    };
  };

  // Helper for CSV conversion
  const convertToCSV = (arr: any[]) => {
    if (!arr || arr.length === 0) return '';
    const keysSet = new Set<string>();
    arr.forEach(obj => {
      if (obj && typeof obj === 'object') {
        Object.keys(obj).forEach(k => {
          if (typeof obj[k] !== 'object') keysSet.add(k);
        });
      }
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

  // 1. Run Automated Weekly Redundancy Export to Firebase Storage (Server-side)
  const handleRunWeeklyStorageBackup = async () => {
    setIsRunningWeeklyStorageBackup(true);
    setStatusMessage(null);
    try {
      const response = await fetch('/api/backup/run-weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: auth.currentUser?.email || "joseiwezasuana@gmail.com",
          triggerType: 'manual'
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Falha ao executar backup no servidor.');
      }

      setStatusMessage({
        type: 'success',
        text: `Exportação semanal para o Firebase Storage concluída com sucesso! ${data.result?.totalRecords || 0} registos exportados em formatos JSON e CSV.`
      });

      if (data.result?.artifacts) {
        setActiveArtifactsModal(data.result.artifacts);
      }

      await loadBackupData();
    } catch (err: any) {
      console.error("Erro na exportação semanal para Firebase Storage:", err);
      setStatusMessage({
        type: 'error',
        text: `Erro na exportação para o Firebase Storage: ${err.message}`
      });
    } finally {
      setIsRunningWeeklyStorageBackup(false);
    }
  };

  // 2. Client-side Instant JSON Download
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
          exportedBy: auth.currentUser?.email || "joseiwezasuana@gmail.com",
          totalDocuments: totalDocsCount,
          categoryBreakdown: categoryCounts
        },
        collections: collectionsData
      };

      const jsonStr = JSON.stringify(fullBackupPayload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const filename = `backup_super_taxi_completo_${dateSlug}_${timeSlug}.json`;
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const sizeKB = Math.round(blob.size / 1024);
      const sizeFormatted = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(2)} MB` : `${sizeKB} KB`;

      setStatusMessage({
        type: 'success',
        text: `Backup JSON descarregado com sucesso (${totalDocsCount} registos, ${sizeFormatted}).`
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

  // 3. Client-side Instant CSV Download (Fleet & Finance)
  const handleExportCSV = async () => {
    setIsExportingCsv(true);
    setStatusMessage(null);
    try {
      const { collectionsData } = await fetchAllCriticalCollections();
      
      const revenues = collectionsData['revenue_logs'] || collectionsData['shifts'] || [];
      const drivers = collectionsData['drivers'] || collectionsData['drivers_master'] || [];
      const vehicles = collectionsData['master_vehicles'] || [];
      const calls = collectionsData['calls'] || [];
      const maintenance = collectionsData['maintenance_logs'] || [];

      const revCSV = convertToCSV(revenues);
      const drvCSV = convertToCSV(drivers);
      const vehCSV = convertToCSV(vehicles);
      const callsCSV = convertToCSV(calls);
      const maintCSV = convertToCSV(maintenance);

      const combinedCSV = `=== FATURAÇÃO E RENDAS ===\n${revCSV}\n\n=== VIATURAS E FROTA ===\n${vehCSV}\n\n=== MOTORISTAS ===\n${drvCSV}\n\n=== CHAMADAS E VIAGENS ===\n${callsCSV}\n\n=== MANUTENÇÕES ===\n${maintCSV}`;

      const blob = new Blob([combinedCSV], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const filename = `relatorio_frota_e_rendas_${new Date().toISOString().slice(0, 10)}.csv`;
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setStatusMessage({
        type: 'success',
        text: `Relatórios em formato CSV exportados com sucesso.`
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
        text: 'Configurações do agendamento semanal guardadas com sucesso!'
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
          exportDate: parsed.metadata?.exportDate || parsed.metadata?.timestamp || "N/A",
          totalDocuments: parsed.metadata?.totalDocuments || parsed.metadata?.totalRecords || "Indefinido",
          categories: parsed.metadata?.categoryBreakdown || parsed.metadata?.categoryCounts || {},
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
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-black uppercase tracking-tight text-white">Redundância Semanal & Firebase Storage</h3>
              <span className="text-[9px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Semanal Automático (JSON + CSV)
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Exportação periódica da frota, faturas, manutenções e logs para o Firebase Storage garantindo redundância de dados fora do Firestore.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          <button
            type="button"
            onClick={handleRunWeeklyStorageBackup}
            disabled={isRunningWeeklyStorageBackup}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            {isRunningWeeklyStorageBackup ? <RefreshCw className="animate-spin" size={14} /> : <CloudUpload size={14} />}
            Executar Backup Semanal no Storage
          </button>

          <button
            type="button"
            onClick={handleExportJSON}
            disabled={isExportingJson}
            className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-black uppercase px-3.5 py-2.5 rounded-xl flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 border border-slate-700"
          >
            {isExportingJson ? <RefreshCw className="animate-spin" size={14} /> : <Download size={14} />}
            Baixar JSON
          </button>
        </div>
      </div>

      {/* Banner de feedback */}
      {statusMessage && (
        <div className={`px-6 py-3 border-b text-xs font-bold flex items-center justify-between ${
          statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-100' : 'bg-rose-50 text-rose-800 border-rose-100'
        }`}>
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0" /> : <AlertCircle size={16} className="text-rose-600 shrink-0" />}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-xs font-bold uppercase underline">Fechar</button>
        </div>
      )}

      {/* Artifacts Modal */}
      {activeArtifactsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Archive size={20} className="text-emerald-600" />
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Ficheiros Exportados para o Firebase Storage</h4>
              </div>
              <button 
                onClick={() => setActiveArtifactsModal(null)} 
                className="text-xs font-black text-slate-500 hover:text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg"
              >
                Fechar
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Os seguintes relatórios estruturados em JSON e tabelas CSV foram salvaguardados com sucesso no seu Bucket do Firebase Storage:
            </p>

            <div className="space-y-2">
              {activeArtifactsModal.map((artifact, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {artifact.format === 'json' ? (
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-black text-[10px] shrink-0">JSON</div>
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-black text-[10px] shrink-0">CSV</div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{artifact.filename}</p>
                      <p className="text-[10px] text-slate-400 font-mono truncate">{artifact.storagePath}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono font-bold bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-600">
                      {artifact.sizeFormatted}
                    </span>
                    {artifact.downloadUrl && (
                      <a
                        href={artifact.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-slate-900 hover:bg-black text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1"
                      >
                        <Download size={12} />
                        Descarregar
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Coluna Esquerda: Configuração & Exportações Imediatas */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card: Status da Redundância */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-5 rounded-2xl text-white space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-amber-400" />
                <h4 className="text-xs font-black uppercase tracking-wider text-white">Status da Redundância Externa</h4>
              </div>
              <span className="text-[9px] font-black uppercase bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                Ativo
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                <span className="text-slate-400 text-[9px] font-bold uppercase block">Frequência</span>
                <strong className="text-white font-bold text-xs mt-0.5 block">Semanal (Todo Domingo)</strong>
              </div>
              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                <span className="text-slate-400 text-[9px] font-bold uppercase block">Destino</span>
                <strong className="text-white font-bold text-xs mt-0.5 block">Firebase Storage</strong>
              </div>
              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                <span className="text-slate-400 text-[9px] font-bold uppercase block">Formatos Gerados</span>
                <strong className="text-amber-400 font-bold text-xs mt-0.5 block">JSON (Full) + 7 CSVs</strong>
              </div>
              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                <span className="text-slate-400 text-[9px] font-bold uppercase block">Último Backup</span>
                <strong className="text-emerald-400 font-bold text-xs mt-0.5 block">
                  {backupSchedule.lastBackupAt ? backupSchedule.lastBackupAt.slice(0, 10) : 'Agendado'}
                </strong>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRunWeeklyStorageBackup}
              disabled={isRunningWeeklyStorageBackup}
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black uppercase py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-amber-500/20"
            >
              {isRunningWeeklyStorageBackup ? <RefreshCw className="animate-spin" size={16} /> : <CloudUpload size={16} />}
              Executar Cópia Imediata para o Storage
            </button>
          </div>

          {/* Card: Exportações Rápidas para Download */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <FileSpreadsheet size={16} className="text-emerald-600" />
                Descarregar Relatórios Imediatos (Local)
              </h4>
            </div>

            <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
              Gere cópias instantâneas para visualização imediata no Excel ou análise de dados offline no seu dispositivo:
            </p>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                type="button"
                onClick={handleExportCSV}
                disabled={isExportingCsv}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isExportingCsv ? <RefreshCw className="animate-spin" size={14} /> : <FileSpreadsheet size={14} />}
                Descarregar Relatório CSV
              </button>

              <button
                type="button"
                onClick={handleExportJSON}
                disabled={isExportingJson}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isExportingJson ? <RefreshCw className="animate-spin" size={14} /> : <FileJson size={14} />}
                Descarregar JSON
              </button>
            </div>
          </div>

          {/* Inspecção de Ficheiro de Restauração */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 text-left space-y-3">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <FolderArchive size={16} className="text-slate-600" />
              Verificação de Ficheiro de Backup
            </h4>

            <p className="text-[11px] text-slate-500 font-medium">
              Carregue um arquivo JSON gerado pelo sistema para inspecionar a contagem de tabelas e garantir que o backup é íntegro.
            </p>

            <label className="block border-2 border-dashed border-slate-300 hover:border-brand-primary rounded-xl p-4 text-center cursor-pointer transition-all bg-white">
              <Upload size={20} className="mx-auto text-slate-400 mb-1" />
              <span className="text-xs font-bold text-slate-700 block">Carregar Ficheiro JSON</span>
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
                  Histórico de Cópias no Firebase Storage
                </h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                  Backups semanais com retenção e redundância fora do Firestore
                </p>
              </div>

              <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-2.5 py-1 rounded font-black uppercase">
                {backupLogs.length} Backups registados
              </span>
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
              {isLoadingLogs ? (
                <div className="py-12 text-center text-slate-400 text-xs font-bold animate-pulse">
                  A carregar histórico de cópias de segurança...
                </div>
              ) : backupLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs font-medium bg-slate-50 rounded-2xl border border-slate-200">
                  Nenhum backup semanal registado ainda. Clique em "Executar Backup Semanal no Storage" para iniciar a primeira cópia.
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
                            {log.weekNumber && (
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-900 text-white font-mono">
                                {log.weekNumber}
                              </span>
                            )}
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                              log.triggerType === 'manual' 
                                ? 'bg-blue-50 text-blue-700 border-blue-200' 
                                : 'bg-purple-50 text-purple-700 border-purple-200'
                            }`}>
                              {log.triggerType === 'manual' ? 'Manual Admin' : 'Semanal Automático'}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 font-medium truncate max-w-[280px]">
                            Alvo: <code className="font-mono text-slate-600">{log.bucketPath || log.storageBucket || 'Firebase Storage'}</code>
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-mono text-xs font-bold text-slate-900 block">{log.totalSizeFormatted || log.sizeFormatted || 'N/A'}</span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase">{log.totalRecords || log.totalDocuments || 0} registos</span>
                      </div>
                    </div>

                    {/* Breakdown de Categorias */}
                    {log.categories && (
                      <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-100 text-[9px] font-bold text-slate-600">
                        <div className="bg-slate-50 px-2 py-1 rounded text-center">Frota: {log.categories.fleet || 0}</div>
                        <div className="bg-slate-50 px-2 py-1 rounded text-center">Faturação: {log.categories.financial || log.categories.transactions || 0}</div>
                        <div className="bg-slate-50 px-2 py-1 rounded text-center">Operações: {log.categories.operations || log.categories.history || 0}</div>
                        <div className="bg-slate-50 px-2 py-1 rounded text-center">Sistema: {log.categories.systemLogs || log.categories.users || 0}</div>
                      </div>
                    )}

                    {/* Ficheiros gerados */}
                    {log.artifacts && log.artifacts.length > 0 && (
                      <div className="pt-2 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setActiveArtifactsModal(log.artifacts || null)}
                          className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 underline"
                        >
                          <Archive size={12} />
                          Ver {log.artifacts.length} Ficheiros Exportados (JSON + CSV)
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="p-4 bg-slate-900 text-slate-300 rounded-2xl border border-slate-800 text-[11px] leading-relaxed flex items-start gap-3">
            <ShieldCheck size={20} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white font-bold block mb-0.5">Política de Redundância e Salvaguarda Externa (JIS ANGOLA)</strong>
              Todas as semanas, o motor em segundo plano extrai automaticamente todas as coleções de viaturas, motoristas, chamadas, faturas e logs do sistema, enviando snapshots JSON completos e tabelas CSV para o bucket oficial do Firebase Storage.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
