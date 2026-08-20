import admin from "firebase-admin";
import fs from "fs";
import path from "path";

export interface BackupArtifact {
  filename: string;
  storagePath: string;
  format: "json" | "csv";
  sizeBytes: number;
  sizeFormatted: string;
  downloadUrl?: string;
  recordCount?: number;
}

export interface BackupExecutionResult {
  id: string;
  timestamp: string;
  weekNumber: string;
  triggerType: "scheduled" | "manual";
  triggeredBy: string;
  status: "success" | "partial" | "failed";
  storageBucket: string;
  artifacts: BackupArtifact[];
  totalRecords: number;
  totalSizeBytes: number;
  totalSizeFormatted: string;
  categories: {
    fleet: number;
    financial: number;
    operations: number;
    systemLogs: number;
  };
  errorMessage?: string;
}

// Utility to convert array of Firestore documents to CSV string
function convertToCSV(data: any[]): string {
  if (!data || data.length === 0) return "";
  
  // Extract all unique primitive keys
  const keysSet = new Set<string>();
  data.forEach((item) => {
    if (item && typeof item === "object") {
      Object.keys(item).forEach((key) => {
        const val = item[key];
        if (val === null || val === undefined || typeof val !== "object") {
          keysSet.add(key);
        }
      });
    }
  });

  const headers = Array.from(keysSet);
  const rows = data.map((item) => {
    return headers
      .map((header) => {
        const val = item[header];
        if (val === undefined || val === null) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      })
      .join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

function getWeekNumber(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 KB";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Executes a full fleet, operational, and system logs backup to Firebase Storage.
 */
export async function executeWeeklyStorageBackup(
  db: FirebaseFirestore.Firestore,
  options: {
    triggerType: "scheduled" | "manual";
    triggeredBy?: string;
  }
): Promise<BackupExecutionResult> {
  const now = new Date();
  const timestamp = now.toISOString();
  const weekNumber = getWeekNumber(now);
  const dateSlug = timestamp.slice(0, 10);
  const timeSlug = timestamp.slice(11, 19).replace(/:/g, "-");
  const backupId = `backup_${dateSlug}_${timeSlug}`;

  console.log(`[Firebase Storage Backup] Starting weekly backup (Type: ${options.triggerType}, Week: ${weekNumber})...`);

  // Target collections to back up
  const collectionsConfig = [
    // Fleet
    { name: "master_vehicles", category: "fleet", label: "Viaturas Master" },
    { name: "drivers", category: "fleet", label: "Viaturas Ativas / Cockpit" },
    { name: "drivers_master", category: "fleet", label: "Diretório de Motoristas" },
    { name: "driver_scales", category: "fleet", label: "Escalas de Trabalho" },
    { name: "maintenance_logs", category: "fleet", label: "Manutenção de Frota" },
    { name: "accident_logs", category: "fleet", label: "Sinistros e Acidentes" },
    // Financial
    { name: "revenue_logs", category: "financial", label: "Rendas e Faturação" },
    { name: "salary_sheets", category: "financial", label: "Folhas de Salário" },
    { name: "internal_contracts", category: "financial", label: "Contratos de Rota" },
    { name: "contract_attendance", category: "financial", label: "Presenças em Contrato" },
    { name: "rac_contracts", category: "financial", label: "Contratos Rent-A-Car" },
    // Operations & Telemetry
    { name: "calls", category: "operations", label: "Chamadas e Corridas" },
    { name: "shifts", category: "operations", label: "Turnos e Rendas Diárias" },
    { name: "interaction_logs", category: "operations", label: "Telemetria e Gateway" },
    { name: "gps_history", category: "operations", label: "Histórico de GPS" },
    { name: "panic_alerts", category: "operations", label: "Alertas SOS" },
    { name: "messages", category: "operations", label: "Mensagens e Notificações" },
    { name: "sms_logs", category: "operations", label: "Logs de SMS" },
    // System
    { name: "users", category: "systemLogs", label: "Utilizadores e Colaboradores" },
    { name: "administrative_staff", category: "systemLogs", label: "Equipa Administrativa" },
    { name: "access_codes", category: "systemLogs", label: "Códigos de Ativação" },
    { name: "settings", category: "systemLogs", label: "Definições do Sistema" },
    { name: "psm_phones", category: "systemLogs", label: "Terminais Oficiais" },
    { name: "warehouse_inventory", category: "systemLogs", label: "Inventário do Armazém" },
    { name: "warehouse_logs", category: "systemLogs", label: "Movimentos de Armazém" },
  ];

  const collectionsData: Record<string, any[]> = {};
  const categories = {
    fleet: 0,
    financial: 0,
    operations: 0,
    systemLogs: 0,
  };
  let totalRecords = 0;

  // 1. Fetch data across all collections
  for (const item of collectionsConfig) {
    try {
      const snap = await db.collection(item.name).get();
      const docs = snap.docs.map((d) => ({ _id: d.id, ...d.data() }));
      collectionsData[item.name] = docs;
      totalRecords += docs.length;
      categories[item.category as keyof typeof categories] += docs.length;
    } catch (err: any) {
      console.warn(`[Storage Backup] Warning reading collection ${item.name}:`, err.message);
      collectionsData[item.name] = [];
    }
  }

  // 2. Prepare artifacts to save
  const artifacts: BackupArtifact[] = [];
  const localBackupDir = path.join(process.cwd(), ".data", "backups", weekNumber);
  if (!fs.existsSync(localBackupDir)) {
    fs.mkdirSync(localBackupDir, { recursive: true });
  }

  // Artifact A: Comprehensive JSON Full Snapshot
  const fullJsonPayload = {
    metadata: {
      systemName: "SUPER Taxi Control - JIS ANGOLA",
      version: "6.0.0",
      backupType: "Weekly Redundancy Snapshot",
      timestamp,
      weekNumber,
      triggeredBy: options.triggeredBy || "Sistema Automático",
      triggerType: options.triggerType,
      totalCollections: Object.keys(collectionsData).length,
      totalRecords,
      categoryCounts: categories,
    },
    collections: collectionsData,
  };

  const jsonFilename = `snapshot_completo_${weekNumber}_${timeSlug}.json`;
  const jsonContent = JSON.stringify(fullJsonPayload, null, 2);
  const jsonLocalPath = path.join(localBackupDir, jsonFilename);
  fs.writeFileSync(jsonLocalPath, jsonContent, "utf8");

  const jsonBuffer = Buffer.from(jsonContent, "utf8");
  artifacts.push({
    filename: jsonFilename,
    storagePath: `backups/weekly/${now.getFullYear()}/${weekNumber}/${jsonFilename}`,
    format: "json",
    sizeBytes: jsonBuffer.byteLength,
    sizeFormatted: formatBytes(jsonBuffer.byteLength),
    recordCount: totalRecords,
  });

  // Artifact B: CSV Reports for Operational & Financial entities
  const csvFilesToGenerate = [
    {
      name: `relatorio_faturacao_e_rendas_${weekNumber}.csv`,
      data: collectionsData["revenue_logs"] || collectionsData["shifts"] || [],
      label: "Faturação e Rendas",
    },
    {
      name: `relatorio_viaturas_e_frota_${weekNumber}.csv`,
      data: collectionsData["master_vehicles"] || collectionsData["drivers"] || [],
      label: "Frota e Viaturas",
    },
    {
      name: `relatorio_motoristas_registados_${weekNumber}.csv`,
      data: collectionsData["drivers_master"] || [],
      label: "Motoristas",
    },
    {
      name: `relatorio_viagens_e_chamadas_${weekNumber}.csv`,
      data: collectionsData["calls"] || [],
      label: "Chamadas e Corridas",
    },
    {
      name: `relatorio_manutencoes_frota_${weekNumber}.csv`,
      data: collectionsData["maintenance_logs"] || [],
      label: "Manutenções",
    },
    {
      name: `relatorio_sinistros_e_acidentes_${weekNumber}.csv`,
      data: collectionsData["accident_logs"] || [],
      label: "Sinistros",
    },
    {
      name: `relatorio_folha_salarial_${weekNumber}.csv`,
      data: collectionsData["salary_sheets"] || [],
      label: "Folhas Salariais",
    },
  ];

  for (const csvItem of csvFilesToGenerate) {
    const csvContent = convertToCSV(csvItem.data);
    const csvFilename = csvItem.name;
    const csvLocalPath = path.join(localBackupDir, csvFilename);
    fs.writeFileSync(csvLocalPath, csvContent, "utf8");

    const csvBuffer = Buffer.from(csvContent, "utf8");
    artifacts.push({
      filename: csvFilename,
      storagePath: `backups/weekly/${now.getFullYear()}/${weekNumber}/${csvFilename}`,
      format: "csv",
      sizeBytes: csvBuffer.byteLength,
      sizeFormatted: formatBytes(csvBuffer.byteLength),
      recordCount: csvItem.data.length,
    });
  }

  // 3. Upload to Firebase Storage Bucket
  let storageBucketName = "joseiwezasuana-org.firebasestorage.app";
  let uploadSuccessCount = 0;

  try {
    const bucket = admin.storage().bucket(storageBucketName);
    console.log(`[Storage Backup] Uploading ${artifacts.length} artifacts to bucket: ${storageBucketName}`);

    for (const artifact of artifacts) {
      const localFilePath = path.join(localBackupDir, artifact.filename);
      const fileBuffer = fs.readFileSync(localFilePath);
      
      const file = bucket.file(artifact.storagePath);
      await file.save(fileBuffer, {
        metadata: {
          contentType: artifact.format === "json" ? "application/json" : "text/csv; charset=utf-8",
          metadata: {
            backupWeek: weekNumber,
            system: "SUPER Taxi Control",
            uploadedAt: timestamp,
          },
        },
      });

      // Try making public or get signed URL for convenient download
      try {
        const [signedUrl] = await file.getSignedUrl({
          action: "read",
          expires: Date.now() + 1000 * 60 * 60 * 24 * 30, // 30 days valid
        });
        artifact.downloadUrl = signedUrl;
      } catch (signErr) {
        // Direct storage gs path reference
        artifact.downloadUrl = `https://storage.googleapis.com/${storageBucketName}/${artifact.storagePath}`;
      }

      uploadSuccessCount++;
    }
  } catch (storageErr: any) {
    console.warn(`[Storage Backup] Notice on Firebase Cloud Storage upload: ${storageErr.message}. Local redundancy preserved.`);
  }

  const totalSizeBytes = artifacts.reduce((acc, a) => acc + a.sizeBytes, 0);

  const result: BackupExecutionResult = {
    id: backupId,
    timestamp,
    weekNumber,
    triggerType: options.triggerType,
    triggeredBy: options.triggeredBy || "Sistema Automático",
    status: uploadSuccessCount > 0 ? "success" : "partial",
    storageBucket: storageBucketName,
    artifacts,
    totalRecords,
    totalSizeBytes,
    totalSizeFormatted: formatBytes(totalSizeBytes),
    categories,
  };

  // 4. Record the Backup Manifest locally and in Firestore for audit & historical tracking
  try {
    const rootBackupDir = path.join(process.cwd(), ".data", "backups");
    if (!fs.existsSync(rootBackupDir)) {
      fs.mkdirSync(rootBackupDir, { recursive: true });
    }
    const manifestsPath = path.join(rootBackupDir, "manifests.json");
    let manifests: any[] = [];
    if (fs.existsSync(manifestsPath)) {
      try {
        manifests = JSON.parse(fs.readFileSync(manifestsPath, "utf8"));
      } catch {}
    }
    manifests.unshift(result);
    fs.writeFileSync(manifestsPath, JSON.stringify(manifests.slice(0, 50), null, 2), "utf8");
  } catch (fsErr: any) {
    console.warn("[Storage Backup] Notice writing local manifest:", fsErr.message);
  }

  try {
    await db.collection("system_backups").doc(backupId).set({
      ...result,
      createdAt: new Date().toISOString(),
    });

    // Update settings metadata
    await db.collection("settings").doc("backup_schedule").set({
      lastBackupAt: timestamp,
      lastBackupWeek: weekNumber,
      lastBackupStatus: result.status,
      lastTotalRecords: totalRecords,
      lastTotalSize: result.totalSizeFormatted,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    console.log(`[Storage Backup] Weekly backup manifest recorded in Firestore: ${backupId}`);
  } catch (dbErr: any) {
    console.warn("[Storage Backup] Notice recording manifest in Cloud Firestore (local manifest retained):", dbErr.message);
  }

  return result;
}

/**
 * Initializes the weekly background automated timer.
 * Checks every hour if a weekly export is due (7 days since last run or new week).
 */
export function initWeeklyBackupScheduler(db: FirebaseFirestore.Firestore) {
  console.log("[Weekly Backup Scheduler] Initializing automated background timer...");

  const checkAndRunBackup = async () => {
    try {
      const scheduleRef = db.collection("settings").doc("backup_schedule");
      const scheduleDoc = await scheduleRef.get();
      
      // If doc doesn't exist, we treat it as due
      if (!scheduleDoc.exists) {
        console.log("[Weekly Backup Scheduler] No previous schedule found, performing initial backup...");
        await executeWeeklyStorageBackup(db, {
          triggerType: "scheduled",
          triggeredBy: "Agendador Semanal Automático",
        });
        return;
      }

      const data = scheduleDoc.data();
      const lastBackupAt = data?.lastBackupAt ? new Date(data.lastBackupAt).getTime() : 0;
      const now = Date.now();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

      const isDue = now - lastBackupAt >= sevenDaysMs;

      if (isDue) {
        console.log(`[Weekly Backup Scheduler] Weekly backup is due (Last run: ${data?.lastBackupAt || 'never'}). Starting automated run...`);
        await executeWeeklyStorageBackup(db, {
          triggerType: "scheduled",
          triggeredBy: "Agendador Semanal Automático",
        });
      }
    } catch (err: any) {
      // Use warn instead of error to reduce noise, specifically for permission/unavailable errors
      console.warn("[Weekly Backup Scheduler] Notice in periodic check (backup may still proceed or be blocked by policy):", err.message);
    }
  };

  // Run initial check after 30 seconds of server startup
  setTimeout(checkAndRunBackup, 30 * 1000);

  // Check every 3 hours for scheduled execution
  setInterval(checkAndRunBackup, 3 * 60 * 60 * 1000);
}
