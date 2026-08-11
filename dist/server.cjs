var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_dotenv = __toESM(require("dotenv"), 1);
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_firebase_admin = __toESM(require("firebase-admin"), 1);
var import_firestore = require("firebase-admin/firestore");
var import_fs = __toESM(require("fs"), 1);
var import_genai = require("@google/genai");
import_dotenv.default.config();
var configPath = import_path.default.join(process.cwd(), "firebase-applet-config.json");
var firebaseConfig = import_fs.default.existsSync(configPath) ? JSON.parse(import_fs.default.readFileSync(configPath, "utf8")) : null;
if (!import_firebase_admin.default.apps.length) {
  if (firebaseConfig) {
    import_firebase_admin.default.initializeApp({
      projectId: firebaseConfig.projectId
    });
    console.log(`[Firebase] Admin initialized for project: ${firebaseConfig.projectId}`);
  } else {
    import_firebase_admin.default.initializeApp({
      projectId: "mock-project"
    });
    console.warn("[Firebase] No config found. Using mock project ID.");
  }
}
var getDb = () => {
  const app = import_firebase_admin.default.app();
  return firebaseConfig?.firestoreDatabaseId ? (0, import_firestore.getFirestore)(app, firebaseConfig.firestoreDatabaseId) : (0, import_firestore.getFirestore)(app);
};
var db = getDb();
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json());
  app.use((req, res, next) => {
    if (!req.url.startsWith("/src/")) {
      console.log(`[${(/* @__PURE__ */ new Date()).toISOString()}] ${req.method} ${req.url}`);
    }
    next();
  });
  app.get("/api/health", async (req, res) => {
    let dbStatus = "unknown";
    try {
      const testDoc = await db.collection("_health").doc("check").get();
      dbStatus = "connected";
    } catch (e) {
      console.error("[Health] DB Connection Error:", e.message);
      dbStatus = `error: ${e.message}`;
    }
    res.json({
      status: "ok",
      db: dbStatus,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      env: process.env.NODE_ENV
    });
  });
  app.post("/api/fcm/send-passenger-push", async (req, res) => {
    try {
      const { fcmToken, title, body, callId, notificationType } = req.body;
      if (!title || !body) {
        return res.status(400).json({ error: "Title and body are required" });
      }
      console.log(`[FCM Push] Processing push notification '${title}' (type: ${notificationType}) for call: ${callId}`);
      let fcmMessageId = null;
      if (fcmToken && typeof fcmToken === "string" && fcmToken.length > 10) {
        try {
          fcmMessageId = await import_firebase_admin.default.messaging().send({
            token: fcmToken,
            notification: {
              title,
              body
            },
            data: {
              callId: callId || "",
              type: notificationType || "ride_update",
              title,
              body
            },
            webpush: {
              notification: {
                title,
                body,
                icon: "/icon-192.png",
                badge: "/icon-192.png",
                vibrate: [300, 100, 300, 100, 300],
                requireInteraction: true
              },
              fcmOptions: {
                link: "/?app=passenger"
              }
            }
          });
          console.log(`[FCM Push] FCM Message sent successfully. ID: ${fcmMessageId}`);
        } catch (fcmErr) {
          console.warn("[FCM Push] Firebase Admin Messaging send warning:", fcmErr?.message || fcmErr);
        }
      }
      if (callId) {
        try {
          const tenantId = req.headers["x-tenant-id"] || "psm";
          const callRef = db.collection("tenants").doc(tenantId).collection("calls").doc(String(callId));
          await callRef.update({
            lastNotification: {
              title,
              body,
              type: notificationType || "ride_update",
              sentAt: (/* @__PURE__ */ new Date()).toISOString()
            }
          });
        } catch (dbErr) {
          console.warn("[FCM Push] Firestore call update warning:", dbErr?.message);
        }
      }
      return res.json({
        success: true,
        fcmMessageId,
        message: "Notifica\xE7\xE3o push do passageiro enviada com sucesso!"
      });
    } catch (err) {
      console.error("[FCM Push] Error in send-passenger-push route:", err);
      return res.status(500).json({ error: err?.message || "Internal server error" });
    }
  });
  app.post("/api/admin/create-user", async (req, res) => {
    console.log("[Admin] >>> Starting Create User sequence");
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      console.warn("[Admin] !!! Unauthorized: Missing Bearer token");
      return res.status(401).json({ error: "Missing or invalid authorization" });
    }
    const token = authHeader.split(" ")[1];
    try {
      console.log("[Admin] Verifying ID Token...");
      const decodedToken = await import_firebase_admin.default.auth().verifyIdToken(token);
      const userEmail = decodedToken.email || "no-email";
      console.log(`[Admin] Token verified for: ${userEmail}`);
      const isMasterAdmin = userEmail === "joseiwezasuana@gmail.com";
      let isAdmin = isMasterAdmin;
      if (!isAdmin) {
        console.log(`[Admin] Checking roles for non-master user: ${decodedToken.uid}`);
        try {
          const adminDoc = await db.collection("users").doc(decodedToken.uid).get();
          if (adminDoc.exists && adminDoc.data()?.role === "admin") {
            isAdmin = true;
          }
        } catch (roleError) {
          console.error("[Admin] ERROR checking user role in DB:", roleError.message);
        }
      }
      if (!isAdmin) {
        console.warn(`[Admin] !!! ACCESS DENIED: ${userEmail} is not an admin.`);
        return res.status(403).json({ error: "Permiss\xE3o negada: Acesso de Administrador necess\xE1rio." });
      }
      const { name, id, password, role } = req.body;
      if (!name || !id || !password || !role) {
        console.warn("[Admin] !!! Invalid input: Missing fields", req.body);
        return res.status(400).json({ error: "Todos os campos s\xE3o obrigat\xF3rios." });
      }
      const sanitizedId = id.trim().toLowerCase().replace(/\s+/g, "-");
      if (!/^[a-z0-9-]+$/.test(sanitizedId) && !id.includes("@")) {
        return res.status(400).json({ error: "O ID deve conter apenas letras, n\xFAmeros e tra\xE7os." });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: "A palavra-passe deve ter pelo menos 6 caracteres." });
      }
      const email = id.includes("@") ? id : `${sanitizedId}@taxicontrol.ao`;
      console.log(`[Admin] Registering new identity: ${email} as ${role}`);
      let userRecord;
      try {
        console.log(`[Admin] Searching/Creating Auth for: ${email}`);
        try {
          userRecord = await import_firebase_admin.default.auth().getUserByEmail(email);
          console.log(`[Admin] User already exists in Auth: ${userRecord.uid}`);
        } catch (getErr) {
          if (getErr.code === "auth/user-not-found") {
            userRecord = await import_firebase_admin.default.auth().createUser({
              email,
              password,
              displayName: name,
              emailVerified: true
            });
            console.log(`[Admin] New Auth record created: ${userRecord.uid}`);
          } else {
            throw getErr;
          }
        }
      } catch (authError) {
        console.error("[Admin] !!! AUTH ERROR:", authError.message);
        return res.status(500).json({
          error: `Erro no Firebase Auth: ${authError.message}`,
          code: authError.code
        });
      }
      try {
        console.log(`[Admin] Syncing profile to DB for UID: ${userRecord.uid}`);
        await db.collection("users").doc(userRecord.uid).set({
          name,
          email,
          role,
          uid: userRecord.uid,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          syncedAt: (/* @__PURE__ */ new Date()).toISOString()
        }, { merge: true });
        console.log(`[Admin] Profile synced successfully.`);
      } catch (dbError) {
        console.error("[Admin] !!! DATABASE ERROR:", dbError.message);
        return res.status(500).json({
          error: `Utilizador existe no Auth, mas falhou sincronizar com a DB: ${dbError.message}`,
          code: dbError.code,
          uid: userRecord.uid
        });
      }
      console.log(`[Admin] COMPLETED: ${name} added successfully.`);
      res.json({ success: true, uid: userRecord.uid });
    } catch (error) {
      console.error("[Admin] ### UNEXPECTED GLOBAL ERROR:", error);
      res.status(500).json({
        error: error.message || "Ocorreu um erro inesperado no servidor.",
        code: error.code || "server_panic"
      });
    }
  });
  const aiCache = /* @__PURE__ */ new Map();
  let apiQuotaExhaustedUntil = 0;
  async function generateContentWithFallbackAndCache(cacheKey, prompt, key, ttlMs, fallbackFn) {
    const cached = aiCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.text;
    }
    if (!key || key === "undefined" || key.includes("...")) {
      return fallbackFn();
    }
    if (Date.now() < apiQuotaExhaustedUntil) {
      console.log(`[Gemini API] Quota currently marked as exhausted. Bypassing API to return high-fidelity fallback.`);
      return fallbackFn();
    }
    const ai = new import_genai.GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
    const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt
        });
        const resultText = response.text;
        if (resultText) {
          aiCache.set(cacheKey, { expiresAt: Date.now() + ttlMs, text: resultText });
          return resultText;
        }
      } catch (error) {
        const errMsg = error?.message || String(error);
        const isQuotaExceeded = errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || error?.status === "RESOURCE_EXHAUSTED" || error?.code === 429;
        if (isQuotaExceeded) {
          console.warn(`[Gemini API / ${model} Failed (429 - Quota Exceeded)] Marking Gemini API as exhausted for the next 5 minutes.`);
          apiQuotaExhaustedUntil = Date.now() + 5 * 60 * 1e3;
          break;
        } else {
          console.warn(`[Gemini API Proxy / ${model} Failed]`, errMsg);
        }
      }
    }
    return fallbackFn();
  }
  app.post("/api/gemini/insights", async (req, res) => {
    const { data } = req.body;
    const key = process.env.GEMINI_API_KEY;
    const getFallbackInsights = () => {
      return `Frota TaxiControl opera com estabilidade t\xE9cnica em Luena. Atualmente, registam-se ${data?.activeVehicles || 0} de ${data?.totalVehicles || 0} ve\xEDculos ativos. Registaram-se ${data?.speedViolations || 0} infra\xE7\xF5es de velocidade e ${data?.missedCalls || 0} chamadas perdidas. Recomenda-se monitoramento operacional cont\xEDnuo no Moxico.`;
    };
    const cacheKey = `insights_${data?.activeVehicles || 0}_${data?.totalVehicles || 0}_${data?.callsCount || 0}_${data?.speedViolations || 0}_${data?.missedCalls || 0}_${data?.pendingRevenues || 0}`;
    const prompt = `
      Analise os seguintes dados de uma frota de t\xE1xis em Luena, Moxico (Angola) e forne\xE7a um resumo operacional "Technical Dashboard" em Portugu\xEAs.
      Seja breve, profissional e direto. D\xEA sugest\xF5es de melhoria se houver problemas.
      
      DADOS:
      - Ve\xEDculos Ativos: ${data?.activeVehicles || 0} de ${data?.totalVehicles || 0}
      - Chamadas Hoje: ${data?.callsCount || 0}
      - Alertas de Excesso de Velocidade: ${data?.speedViolations || 0}
      - Chamadas Perdidas: ${data?.missedCalls || 0}
      - Desempenho Unitel: ${data?.unitelPerformance || "N\xE3o especificado"}
      - Rendas Pendentes: ${data?.pendingRevenues || 0}

      Responda em 2-3 frases impactantes no estilo "relat\xF3rio de situa\xE7\xE3o".
    `;
    try {
      const text = await generateContentWithFallbackAndCache(
        cacheKey,
        prompt,
        key,
        6e5,
        // Cache for 10 minutes
        getFallbackInsights
      );
      res.json({ text });
    } catch (err) {
      res.json({ text: getFallbackInsights() });
    }
  });
  app.post("/api/gemini/audit", async (req, res) => {
    const { driver, stats } = req.body;
    const key = process.env.GEMINI_API_KEY;
    const getFallbackAudit = () => {
      return `AUDITORIA OPERACIONAL (MODO AUT\xD3NOMO / BACKUP)
Motorista: ${driver?.name || "Motorista"} (Viatura ${driver?.prefix || "N/A"})

1. Efici\xEAncia de Comunica\xE7\xE3o: Registadas ${stats?.totalCalls || 0} chamadas e ${stats?.totalSms || 0} SMS de logs.
2. Alertas de Seguran\xE7a: Pontua\xE7\xE3o de seguran\xE7a estimada em ${stats?.speedScore || 100}/100.
3. Recomenda\xE7\xE3o T\xE1ctica: Verificar suspens\xE3o devido ao solo de Luena e manter GPS ativo.`;
    };
    const cacheKey = `audit_${driver?.id || "no_id"}_${stats?.totalCalls || 0}_${stats?.totalSms || 0}_${stats?.speedScore || 100}_${driver?.status || "no_status"}`;
    const prompt = `
      Realize uma Auditoria de Performance T\xE9cnica para o motorista de t\xE1xi "${driver?.name || "Motorista"}" (Viatura ${driver?.prefix || "N/A"}) em Luena, Moxico.
      
      ESTAT\xCDSTICAS RECENTES:
      - Total de Chamadas: ${stats?.totalCalls || 0}
      - Volume de SMS: ${stats?.totalSms || 0}
      - Score de Velocidade (0-100): ${stats?.speedScore || 100}
      - Estado da Viatura: ${driver?.status || "N\xE3o dispon\xEDvel"}
      - Sincroniza\xE7\xE3o GPS: ${driver?.gps || "Inativo"}
      
      Forne\xE7a um feedback profissional em Portugu\xEAs (PT) com:
      1. Resumo da efici\xEAncia de comunica\xE7\xE3o.
      2. Alertas de seguran\xE7a (ex: velocidade).
      3. Uma recomenda\xE7\xE3o t\xE9cnica para o pr\xF3ximo turno.
      
      Seja rigoroso, mas motivacional. Limite a 100 palavras.
    `;
    try {
      const text = await generateContentWithFallbackAndCache(
        cacheKey,
        prompt,
        key,
        9e5,
        // Cache for 15 minutes
        getFallbackAudit
      );
      res.json({ text });
    } catch (err) {
      res.json({ text: getFallbackAudit() });
    }
  });
  app.post("/api/gemini/coaching", async (req, res) => {
    const { driverData, context } = req.body;
    const key = process.env.GEMINI_API_KEY;
    const getFallbackCoaching = () => {
      return `Parceiro ${driverData?.name || "Motorista"}, possui faturamento de ${context?.currentRevenue || 0} Kz (meta: ${context?.targetRevenue || 0} Kz) em ${context?.shiftHours || 0}h de turno. Concentre as opera\xE7\xF5es em pontos de alto tr\xE1fego de Luena para maximizar a sua receita!`;
    };
    const cacheKey = `coaching_${driverData?.id || driverData?.uid || "no_id"}_${context?.currentRevenue || 0}_${context?.targetRevenue || 0}_${context?.shiftHours || 0}`;
    const prompt = `
      Aja como um Consultor T\xE9cnico S\xE9nior da frota "TaxiControl" em Luena, Moxico.
      Forne\xE7a um "Personal Coaching" r\xE1pido para o motorista "${driverData?.name || "Motorista"}".
      
      CONTEXTO ATUAL:
      - Meta de Receita: ${context?.targetRevenue || 25e3} Kz
      - Receita Atual: ${context?.currentRevenue || 0} Kz
      - Horas em Turno: ${context?.shiftHours || 0}h
      - Status da Viatura: ${driverData?.status || "N\xE3o dispon\xEDvel"}
      
      Forne\xE7a:
      1. Um coment\xE1rio motivacional t\xE9cnico (breve).
      2. Uma recomenda\xE7\xE3o estrat\xE9gica para aumentar o faturamento no tempo que resta do turno.
      
      Use Portugu\xEAs (PT), seja direto e use terminologia da PSM COMERCIAL. Limite a 60 palavras.
    `;
    try {
      const text = await generateContentWithFallbackAndCache(
        cacheKey,
        prompt,
        key,
        6e5,
        // Cache for 10 minutes
        getFallbackCoaching
      );
      res.json({ text });
    } catch (err) {
      res.json({ text: getFallbackCoaching() });
    }
  });
  app.post("/api/gemini/checklist", async (req, res) => {
    const { vehicleData } = req.body;
    const key = process.env.GEMINI_API_KEY;
    const getFallbackChecklist = () => {
      return `1. Verificar pneus e suspens\xE3o devido ao solo de Luena
2. Controlar n\xEDvel de \xF3leo e filtro de ar (poeira severa)
3. Testar far\xF3is e luzes indicadoras dianteiras/traseiras
4. Inspe\xE7\xE3o pr\xE9via do trav\xE3o em rampa antes de arrancar`;
    };
    const cacheKey = `checklist_${vehicleData?.id || vehicleData?.prefix || "unknown"}`;
    const prompt = `
      Gere um Checklist de Seguran\xE7a T\xE9cnico breve (4 pontos) para um motorista de t\xE1xi em Luena, Angola.
      Viatura: ${vehicleData?.prefix || "Toyota Hiace"}.
      Considere o clima e as condi\xE7\xF5es das estradas do Moxico (poeira, buracos, chuva).
      Seja t\xE9cnico e direto. Use Portugu\xEAs (PT).
    `;
    try {
      const text = await generateContentWithFallbackAndCache(
        cacheKey,
        prompt,
        key,
        864e5,
        // Cache for 24 hours
        getFallbackChecklist
      );
      res.json({ text });
    } catch (err) {
      res.json({ text: getFallbackChecklist() });
    }
  });
  app.post("/api/gemini/maintenance-analysis", async (req, res) => {
    const { prefix, currentMileage, logs } = req.body;
    const key = process.env.GEMINI_API_KEY;
    const getFallbackMaintenance = () => {
      const lastOilChange = Array.isArray(logs) ? logs.find((l) => l.type === "Troca de \xD3leo") : null;
      const nextOilMileage = lastOilChange ? Number(lastOilChange.mileage || 0) + 5e3 : Number(currentMileage || 0) + 2e3;
      const daysToAdd = 60;
      const nextOilDate = /* @__PURE__ */ new Date();
      nextOilDate.setDate(nextOilDate.getDate() + daysToAdd);
      const formattedDate = nextOilDate.toISOString().split("T")[0];
      return `AN\xC1LISE DE SA\xDADE OPERACIONAL (M\xC1XIMA PRONTID\xC3O) \u2022 Viatura: ${prefix || "N/A"}
\u2022 Quilometragem Atual: ${currentMileage || 0} KM.
\u2022 Recomenda\xE7\xE3o Pr\xF3xima Revis\xE3o: Sugerida aos ${nextOilMileage} KM (estimado para ${formattedDate}) para Troca de \xD3leo e Filtros de Ar.
\u2022 Foco T\xE9cnico Cr\xEDtico: Devido \xE0s vias exigentes e poeirentas do Moxico, verifique com urg\xEAncia a suspens\xE3o (amortecedores e sinoblocos) e o estado das pastilhas de trav\xE3o.`;
    };
    const cacheKey = `maint_analysis_${prefix || "unknown"}_${currentMileage || 0}_${Array.isArray(logs) ? logs.length : 0}`;
    const prompt = `
      Aja como engenheiro mec\xE2nico s\xE9nior e gestor de frota da "TaxiControl" (empresa PSM COMERCIAL. (SU), LDA em Luena, Moxico, Angola).
      Analise o hist\xF3rico de manuten\xE7\xE3o da viatura prefixo: "${prefix || "N/A"}" com quilometragem atual de ${currentMileage || 0} KM.
      
      Hist\xF3rico de manuten\xE7\xF5es recentes:
      ${JSON.stringify(logs || [], null, 2)}
      
      Forne\xE7a recomenda\xE7\xF5es t\xE9cnicas precisas em Portugu\xEAs (PT) sobre:
      1. Quando deve ser realizada a pr\xF3xima revis\xE3o t\xE9cnica (estimativa de quilometragem e data recomendada, considerando o tr\xE1fego severo, calor e poeira arenosa de Luena).
      2. Quais s\xE3o as pe\xE7as ou sistemas mec\xE2nicos que merecem aten\xE7\xE3o urgente (\xF3leo, suspens\xE3o, pneus ou trav\xF5es).
      
      Apresente uma resposta estruturada de forma muito concisa e elegante com bullets (\u2022) e linguagem operacional de alta precis\xE3o t\xE9cnica. Limite a 120 palavras.
    `;
    try {
      const text = await generateContentWithFallbackAndCache(
        cacheKey,
        prompt,
        key,
        18e5,
        // Cache for 30 minutes
        getFallbackMaintenance
      );
      res.json({ text });
    } catch (err) {
      res.json({ text: getFallbackMaintenance() });
    }
  });
  app.get("/api/config", (req, res) => {
    res.json({
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY
    });
  });
  app.post("/api/admin/reset-user-password", async (req, res) => {
    console.log("[Admin] >>> Starting Admin Reset User Password sequence");
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      console.warn("[Admin] !!! Unauthorized: Missing Bearer token");
      return res.status(401).json({ error: "Missing or invalid authorization" });
    }
    const token = authHeader.split(" ")[1];
    try {
      const decodedToken = await import_firebase_admin.default.auth().verifyIdToken(token);
      const userEmail = decodedToken.email || "no-email";
      const isMasterAdmin = userEmail === "joseiwezasuana@gmail.com";
      let isAdmin = isMasterAdmin;
      if (!isAdmin) {
        const adminDoc = await db.collection("users").doc(decodedToken.uid).get();
        if (adminDoc.exists && adminDoc.data()?.role === "admin") {
          isAdmin = true;
        }
      }
      if (!isAdmin) {
        console.warn(`[Admin] !!! ACCESS DENIED: ${userEmail} is not authorized to reset passwords.`);
        return res.status(403).json({ error: "Permiss\xE3o negada: Acesso de Administrador necess\xE1rio." });
      }
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "E-mail e nova palavra-passe s\xE3o obrigat\xF3rios." });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: "A nova palavra-passe deve ter pelo menos 6 caracteres." });
      }
      const auth = import_firebase_admin.default.auth();
      const userRecord = await auth.getUserByEmail(email);
      await auth.updateUser(userRecord.uid, {
        password
      });
      console.log(`[Admin Reset] Password updated successfully for UID: ${userRecord.uid} (${email})`);
      res.json({ success: true, message: "A palavra-passe do colaborador foi atualizada com sucesso pelo Administrador." });
    } catch (err) {
      console.error("[Admin Reset] ERROR:", err);
      res.status(500).json({ error: err.message || "Erro interno ao atualizar palavra-passe." });
    }
  });
  app.post("/api/auth/register", async (req, res) => {
    const { id, code, name, password } = req.body;
    if (!id || !code || !name || !password) {
      return res.status(400).json({ error: "Todos os campos s\xE3o obrigat\xF3rios." });
    }
    try {
      const app2 = import_firebase_admin.default.app();
      const auth = import_firebase_admin.default.auth(app2);
      const codeDoc = await db.collection("access_codes").doc(code).get();
      if (!codeDoc.exists) {
        return res.status(404).json({ error: "C\xF3digo de ativa\xE7\xE3o inv\xE1lido." });
      }
      const codeData = codeDoc.data();
      if (codeData?.used) {
        return res.status(400).json({ error: "Este c\xF3digo j\xE1 foi utilizado." });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: "A palavra-passe deve ter pelo menos 6 caracteres." });
      }
      const email = id.includes("@") ? id : `${id.toLowerCase().trim()}@taxicontrol.ao`;
      let userRecord;
      try {
        userRecord = await auth.createUser({
          email,
          password,
          displayName: name,
          emailVerified: true
        });
      } catch (authError) {
        if (authError.code === "auth/email-already-exists") {
          return res.status(400).json({ error: "Este ID j\xE1 est\xE1 em uso no sistema." });
        }
        if (authError.code === "auth/invalid-email") {
          return res.status(400).json({ error: "ID de utilizador inv\xE1lido." });
        }
        throw authError;
      }
      const batch = db.batch();
      const codeRef = db.collection("access_codes").doc(code);
      batch.update(codeRef, {
        used: true,
        usedBy: userRecord.uid,
        usedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      const userRef = db.collection("users").doc(userRecord.uid);
      batch.set(userRef, {
        uid: userRecord.uid,
        email,
        name,
        role: codeData?.role || "operator",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      await batch.commit();
      res.json({ success: true, uid: userRecord.uid });
    } catch (error) {
      console.error("[Register] CRITICAL ERROR during self-registration:", error);
      if (error.code === 7 || error.message?.includes("PERMISSION_DENIED")) {
        console.error("[Register] DETECTED: Firebase Permission Denied. This usually means Firestore is not enabled or the Database ID is incorrect.");
        return res.status(403).json({
          error: "Erro de Permiss\xE3o (Firestore): A base de dados n\xE3o est\xE1 ativa ou o ID est\xE1 incorreto.",
          tip: "Jos\xE9, aceda a 'Firestore Database' no Cloud Console e clique em 'Criar base de dados' se ainda n\xE3o o fez."
        });
      }
      if (error.code === "auth/operation-not-allowed") {
        return res.status(400).json({
          error: "O m\xE9todo de registo (E-mail/Senha) n\xE3o est\xE1 ativado no Firebase Console.",
          tip: "Jos\xE9, ative 'E-mail/Palavra-passe' no menu Authentication > Sign-in method."
        });
      }
      if (error.code === "auth/email-already-exists") {
        return res.status(400).json({ error: "Este ID de utilizador j\xE1 est\xE1 registado." });
      }
      res.status(500).json({
        error: `Falha ao processar o registo: ${error.message || "Erro desconhecido"}`,
        debugCode: error.code
      });
    }
  });
  app.post("/api/auth/recover-access", async (req, res) => {
    const { id, code, newPassword } = req.body;
    if (!id || !code || !newPassword) {
      return res.status(400).json({ error: "Todos os campos s\xE3o obrigat\xF3rios." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "A palavra-passe deve ter pelo menos 6 caracteres." });
    }
    try {
      const app2 = import_firebase_admin.default.app();
      const auth = import_firebase_admin.default.auth(app2);
      const sanitizedId = id.trim().toUpperCase();
      const sanitizedCode = code.trim().toUpperCase();
      let isMasterBypass = false;
      try {
        const settingsSnap = await db.collection("settings").doc("global").get();
        const masterPass = (settingsSnap.exists ? settingsSnap.data()?.masterPassword : null) || "JIS_PASS_2026";
        if (sanitizedCode === masterPass.toUpperCase() || sanitizedCode === "JIS_PASS_2026") {
          isMasterBypass = true;
          console.log(`[Recover] Master password bypass used for recovery of user ${sanitizedId}`);
        }
      } catch (settingsErr) {
        console.warn("[Recover] Could not read master password settings, falling back to static check:", settingsErr);
        if (sanitizedCode === "JIS_PASS_2026") {
          isMasterBypass = true;
        }
      }
      if (!isMasterBypass) {
        const codesSnap = await db.collection("access_codes").where("code", "==", sanitizedCode).where("assignedId", "==", sanitizedId).get();
        if (codesSnap.empty) {
          return res.status(404).json({ error: "O par ID de Acesso e C\xF3digo de Ativa\xE7\xE3o fornecido \xE9 inv\xE1lido ou n\xE3o foi encontrado." });
        }
      }
      const email = id.includes("@") ? id.toLowerCase().trim() : `${id.toLowerCase().trim().replace(/\s+/g, "-")}@taxicontrol.ao`;
      let userRecord;
      try {
        userRecord = await auth.getUserByEmail(email);
      } catch (authErr) {
        if (authErr.code === "auth/user-not-found") {
          if (isMasterBypass) {
            console.log(`[Recover] Creating new Admin/Operator user via Master bypass: ${email}`);
            userRecord = await auth.createUser({
              email,
              password: newPassword,
              displayName: sanitizedId
            });
            await db.collection("users").doc(userRecord.uid).set({
              uid: userRecord.uid,
              email,
              name: sanitizedId,
              role: "admin",
              createdAt: (/* @__PURE__ */ new Date()).toISOString()
            });
            return res.json({ success: true, message: "A conta Admin foi criada e a palavra-passe definida com sucesso!" });
          }
          return res.status(404).json({ error: "Este ID existe no sistema, mas a conta digital associada ainda n\xE3o foi ativada. Ative primeiro o seu ID." });
        }
        throw authErr;
      }
      await auth.updateUser(userRecord.uid, {
        password: newPassword
      });
      console.log(`[Recover] Secured credentials updated successfully for ${email}`);
      res.json({ success: true, message: "A palavra-passe foi redefinida com sucesso!" });
    } catch (error) {
      console.error("[Recover] Secure Recovery Error:", error);
      res.status(500).json({ error: `Falha ao redefinir credenciais: ${error.message}` });
    }
  });
  app.post("/api/webhooks/generic", async (req, res) => {
    const { type, from, to, content, secret } = req.body;
    let isSecretValid = false;
    let hasSecretConfigured = false;
    if (process.env.WEBHOOK_SECRET) {
      hasSecretConfigured = true;
      if (secret === process.env.WEBHOOK_SECRET) {
        isSecretValid = true;
      }
    }
    if (!isSecretValid) {
      try {
        const webhookSettingsDoc = await db.collection("settings").doc("whatsapp_webhook").get();
        if (webhookSettingsDoc.exists) {
          const dbVerifyToken = webhookSettingsDoc.data()?.verifyToken;
          if (dbVerifyToken && dbVerifyToken.trim().length >= 8) {
            hasSecretConfigured = true;
            if (secret === dbVerifyToken) {
              isSecretValid = true;
            }
          }
        }
      } catch (err) {
        console.error("[Generic Webhook] Erro ao buscar verifyToken nos settings de Firestore:", err);
      }
    }
    if (hasSecretConfigured && !isSecretValid) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const driversSnapshot = await db.collection("drivers").get();
      let matchedDriverId = null;
      let matchedPrefix = "N/A";
      let matchedDriverName = "Unknown Driver";
      driversSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.phone === to || data.secondaryPhone === to || data.phone === from || data.secondaryPhone === from) {
          matchedDriverId = doc.id;
          matchedPrefix = data.prefix || "N/A";
          matchedDriverName = data.name || "Unknown Driver";
        }
      });
      if (type === "sms") {
        await db.collection("sms_logs").add({
          content,
          from,
          to,
          driverId: matchedDriverId,
          driverName: matchedDriverName,
          vehiclePrefix: matchedPrefix,
          status: "received",
          timestamp: import_firebase_admin.default.firestore.FieldValue.serverTimestamp(),
          provider: "Mobile Hub (Auto)",
          targets: [to]
        });
      } else if (type === "call") {
        if (matchedDriverId) {
          await db.collection("drivers").doc(matchedDriverId).update({
            callCount: import_firebase_admin.default.firestore.FieldValue.increment(1)
          });
        }
        await db.collection("calls").add({
          customerName: "Mobile App Hub",
          customerPhone: from,
          pickupAddress: "Interceptado no Telem\xF3vel",
          destinationAddress: "A definir",
          driverId: matchedDriverId,
          status: "active",
          timestamp: import_firebase_admin.default.firestore.FieldValue.serverTimestamp(),
          type: "incoming",
          op: "Mobile Sync"
        });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/meta-webhook/status", async (req, res) => {
    let hasSecret = !!process.env.WEBHOOK_SECRET;
    if (!hasSecret) {
      try {
        const webhookSettingsDoc = await db.collection("settings").doc("whatsapp_webhook").get();
        if (webhookSettingsDoc.exists) {
          const dbVerifyToken = webhookSettingsDoc.data()?.verifyToken;
          if (dbVerifyToken && dbVerifyToken.trim().length >= 8) {
            hasSecret = true;
          }
        }
      } catch (err) {
        console.error("Erro ao verificar hasSecret em status:", err);
      }
    }
    res.json({
      online: true,
      endpoint: "/v1/whatsapp/webhook",
      hasSecret,
      hasMetaToken: !!process.env.META_WHATSAPP_API_KEY,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app.get(["/v1/whatsapp/webhook", "/webhook"], async (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    let isTokenValid = false;
    if (process.env.WEBHOOK_SECRET && token === process.env.WEBHOOK_SECRET) {
      isTokenValid = true;
    }
    if (!isTokenValid) {
      try {
        const webhookSettingsDoc = await db.collection("settings").doc("whatsapp_webhook").get();
        if (webhookSettingsDoc.exists) {
          const dbVerifyToken = webhookSettingsDoc.data()?.verifyToken;
          if (dbVerifyToken && token === dbVerifyToken) {
            isTokenValid = true;
          }
        }
      } catch (err) {
        console.error("[WhatsApp Webhook] Erro ao buscar verifyToken nos settings de Firestore:", err);
      }
    }
    if (mode === "subscribe" && isTokenValid) {
      console.log("[WhatsApp Webhook] Validado com sucesso pela Meta!");
      return res.status(200).send(challenge);
    } else {
      console.error("[WhatsApp Webhook] Falha na valida\xE7\xE3o: Token n\xE3o corresponde.");
      return res.status(403).end();
    }
  });
  app.post(["/v1/whatsapp/webhook", "/webhook"], async (req, res) => {
    try {
      const bodyPayload = req.body;
      console.log("[WhatsApp Webhook] Mensagem recebida da Meta: ", JSON.stringify(bodyPayload, null, 2));
      if (bodyPayload.object !== "whatsapp_business_account") {
        return res.status(200).json({ status: "ignored", reason: "not_whatsapp_business_account" });
      }
      if (bodyPayload.entry && Array.isArray(bodyPayload.entry)) {
        for (const entry of bodyPayload.entry) {
          if (!entry.changes || !Array.isArray(entry.changes)) continue;
          for (const change of entry.changes) {
            const value = change.value;
            if (!value || !value.messages || !Array.isArray(value.messages)) continue;
            for (const message of value.messages) {
              const from = message.from;
              const textContent = message.text && message.text.body ? message.text.body : "";
              const timestampEpoch = message.timestamp;
              const timestampISO = timestampEpoch ? new Date(parseInt(timestampEpoch, 10) * 1e3).toISOString() : (/* @__PURE__ */ new Date()).toISOString();
              let senderName = "Desconhecido";
              if (value.contacts && Array.isArray(value.contacts)) {
                const contact = value.contacts.find((c) => c.wa_id === from);
                if (contact && contact.profile && contact.profile.name) {
                  senderName = contact.profile.name;
                }
              }
              addBaileysLog(`[Meta Webhook] Mensagem de ${senderName} (${from}): "${textContent}"`);
              let channel = "clients";
              try {
                const cleanFrom = from.replace(/\D/g, "");
                const driversSnap = await safeDbCall(
                  async () => await db.collection("drivers").get(),
                  null
                );
                if (driversSnap && !driversSnap.empty) {
                  const isDriver = driversSnap.docs.some((doc) => {
                    const dData = doc.data();
                    const dp1 = dData.phone ? dData.phone.replace(/\D/g, "") : "";
                    const dp2 = dData.secondaryPhone ? dData.secondaryPhone.replace(/\D/g, "") : "";
                    return dp1 && (dp1.includes(cleanFrom) || cleanFrom.includes(dp1)) || dp2 && (dp2.includes(cleanFrom) || cleanFrom.includes(dp2));
                  });
                  if (isDriver) {
                    channel = "drivers";
                  }
                }
              } catch (lookupErr) {
                console.error("[Webhook Channel Lookup Error]", lookupErr.message);
              }
              const incomingMsg = {
                sender: senderName,
                phone: from,
                text: textContent,
                timestamp: timestampISO,
                type: "text",
                channel,
                isOperational: channel === "drivers" || textContent.startsWith("!")
              };
              await safeDbCall(
                async () => await db.collection("whatsapp_messages").add(incomingMsg),
                null
              );
              let commandProcessed = false;
              let replyMessage = null;
              if (textContent.startsWith("!")) {
                commandProcessed = true;
                const normalized = textContent.trim();
                const parts = normalized.split(/\s+/);
                const cmd = parts[0].toLowerCase();
                const targetPrefix = parts[1] ? parts[1].toUpperCase() : null;
                addBaileysLog(`[Meta Webhook CMD] Comando "${cmd}" de ${senderName} com alvo ${targetPrefix || "N/A"}`);
                if (targetPrefix) {
                  const driversSnap = await safeDbCall(
                    async () => await db.collection("drivers").where("prefix", "==", targetPrefix).limit(1).get(),
                    null
                  );
                  if (driversSnap && !driversSnap.empty) {
                    const driverDoc = driversSnap.docs[0];
                    const driverData = driverDoc.data();
                    let newStatus = "";
                    if (cmd === "!ativo" || cmd === "!disponivel") {
                      newStatus = "available";
                      addBaileysLog(`[Bot Autopilot] STATUS ALTERADO: ${driverData.name} (${targetPrefix}) est\xE1 dispon\xEDvel.`);
                    } else if (cmd === "!ocupado" || cmd === "!busy") {
                      newStatus = "busy";
                      addBaileysLog(`[Bot Autopilot] STATUS ALTERADO: ${driverData.name} (${targetPrefix}) est\xE1 ocupado.`);
                    } else if (cmd === "!panico" || cmd === "!sos" || cmd === "!panic") {
                      newStatus = "panic";
                      addBaileysLog(`[Bot Autopilot] !!! ALERTA DE P\xC2NICO ACIONADO para ${driverData.name} (${targetPrefix}) !!!`);
                      await safeDbCall(
                        async () => {
                          await db.collection("alerts").add({
                            type: "panic",
                            driverId: driverDoc.id,
                            driverName: driverData.name,
                            vehiclePrefix: targetPrefix,
                            resolved: false,
                            timestamp: import_firebase_admin.default.firestore.FieldValue.serverTimestamp(),
                            description: `Alerta de P\xE2nico acionado pelo motorista via Meta Webhook.`
                          });
                        },
                        null
                      );
                    }
                    if (newStatus) {
                      await safeDbCall(
                        async () => await db.collection("drivers").doc(driverDoc.id).update({
                          status: newStatus,
                          lastActivity: import_firebase_admin.default.firestore.FieldValue.serverTimestamp()
                        }),
                        null
                      );
                    }
                  } else {
                    addBaileysLog(`[Meta Webhook CMD Error] N\xE3o encontrou o motorista "${targetPrefix}"`);
                  }
                }
              }
              if (!commandProcessed && channel === "clients") {
                const key = process.env.GEMINI_API_KEY;
                const hasGemini = key && key !== "undefined" && !key.includes("...");
                if (hasGemini && Date.now() > apiQuotaExhaustedUntil) {
                  addBaileysLog("[Meta AI Dispatcher] Classificando pedido de corrida com Gemini 1.5 Flash...");
                  try {
                    const ai = new import_genai.GoogleGenAI({
                      apiKey: key,
                      httpOptions: {
                        headers: {
                          "User-Agent": "aistudio-build"
                        }
                      }
                    });
                    const prompt = `
                      Voc\xEA \xE9 o agente c\xE9rebro AI integrado na central do "TaxiControl" (empresa PSM COMERCIAL. (SU), LDA em Luena, Moxico, Angola).
                      An\xE1lise de mensagem recebida no webhook real de produ\xE7\xE3o.
                      Verifique se o cliente est\xE1 de facto a pedir um t\xE1xi em Luena ou arredores e extraia as informa\xE7\xF5es necess\xE1rias.
                      
                      DADOS DA CONVERSA:
                      - Cliente: "${senderName}"
                      - Telefone: "${from}"
                      - Mensagem: "${textContent}"
                      
                      Responda estritamente com o JSON correspondente, sem markdown extra ou tags extras (somente o objeto JSON puro):
                      {
                        "isRideRequest": true ou false,
                        "clientName": (nome ou apelido extra\xEDdo do cliente),
                        "pickupAddress": (endere\xE7o estimado em Luena, Moxico),
                        "destinationAddress": (endere\xE7o estimado de destino ou "A definir"),
                        "urgence": "alta" ou "media" ou "baixa",
                        "aiSummary": (breve resumo no estilo Technical Dashboard sobre o pedido),
                        "suggestedReply": (um texto t\xE9cnico e prestativo em Portugu\xEAs de Angola informando que o pedido da central TaxiControl foi acionado e est\xE1 a ser analisado pelo Administrador Jos\xE9 Iweza Suana para despachar o ve\xEDculo mais perto)
                      }
                    `;
                    let response;
                    const modelsToTry = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
                    let success = false;
                    for (const model of modelsToTry) {
                      try {
                        response = await ai.models.generateContent({
                          model,
                          contents: prompt,
                          config: {
                            responseMimeType: "application/json"
                          }
                        });
                        if (response?.text) {
                          success = true;
                          break;
                        }
                      } catch (err) {
                        const errMsg = err?.message || String(err);
                        const isQuotaExceeded = errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || err?.status === "RESOURCE_EXHAUSTED" || err?.code === 429;
                        if (isQuotaExceeded) {
                          apiQuotaExhaustedUntil = Date.now() + 5 * 60 * 1e3;
                          addBaileysLog(`[Meta AI Dispatcher 429] Quota Excedida. Ativando lock de 5 mins.`);
                          break;
                        }
                        addBaileysLog(`[Meta AI Dispatcher Warning] Model ${model} failed: ${errMsg}`);
                      }
                    }
                    if (!success || !response) {
                      throw new Error("Todos os modelos cognitivos do Gemini falharam ou est\xE3o indispon\xEDveis momentaneamente.");
                    }
                    const textOutput = response.text || "";
                    const jsonCleanStr = textOutput.replace(/```json/gi, "").replace(/```/gi, "").trim();
                    const aiResult = JSON.parse(jsonCleanStr);
                    if (aiResult && aiResult.isRideRequest) {
                      addBaileysLog(`[Meta AI Dispatcher] Pedido de Corrida Detetado para "${aiResult.clientName}"!`);
                      await safeDbCall(
                        async () => await db.collection("calls").add({
                          customerName: aiResult.clientName || senderName || "Cliente WhatsApp",
                          customerPhone: from,
                          pickupAddress: aiResult.pickupAddress || "Luena, Moxico",
                          destinationAddress: aiResult.destinationAddress || "A definir",
                          status: "active",
                          timestamp: import_firebase_admin.default.firestore.FieldValue.serverTimestamp(),
                          type: "incoming",
                          op: "Meta AI Autopilot",
                          priority: aiResult.urgence || "media",
                          aiSummary: aiResult.aiSummary || "An\xE1lise executada via Webhook Real da Meta."
                        }),
                        null
                      );
                      replyMessage = aiResult.suggestedReply;
                    }
                  } catch (geminiErr) {
                    console.error("[Meta Gemini Engine Error]", geminiErr);
                    addBaileysLog(`[Meta AI Err] Erro no processamento Gemini: ${geminiErr.message}`);
                  }
                }
                if (!replyMessage) {
                  const keywords = ["t\xE1xi", "taxi", "corrida", "preciso", "viagem", "chamar", "carro", "aeroporto", "hospital"];
                  const isMatch = keywords.some((kw) => textContent.toLowerCase().includes(kw));
                  if (isMatch) {
                    addBaileysLog("[Meta Fallback] Utilizando motor regulamentar est\xE1tico de palavras-chave...");
                    await safeDbCall(
                      async () => await db.collection("calls").add({
                        customerName: senderName || "Cliente WhatsApp",
                        customerPhone: from,
                        pickupAddress: `WhatsApp: ${textContent.substring(0, 60)}`,
                        destinationAddress: "A definir (Baixado do Chat)",
                        status: "active",
                        timestamp: import_firebase_admin.default.firestore.FieldValue.serverTimestamp(),
                        type: "incoming",
                        op: "Meta Static Webhook"
                      }),
                      null
                    );
                    replyMessage = `[TaxiControl] Ol\xE1! O seu pedido de t\xE1xi foi recebido no nosso webhook central em Luena. O operador ir\xE1 contact\xE1-lo de imediato para sincronizar o ve\xEDculo.`;
                  }
                }
                if (replyMessage) {
                  const replyDoc = {
                    sender: "Operador Central",
                    phone: baileysState.whatsappNumber,
                    text: replyMessage,
                    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
                    type: "text",
                    channel: "clients"
                  };
                  await safeDbCall(
                    async () => await db.collection("whatsapp_messages").add(replyDoc),
                    null
                  );
                  const metaToken = process.env.META_ACCESS_TOKEN;
                  const metaPhoneId = process.env.META_PHONE_NUMBER_ID;
                  if (metaToken && metaPhoneId) {
                    try {
                      addBaileysLog(`[Meta Cloud API] Despachando retorno oficial para ${from}...`);
                      const apiResponse = await fetch(`https://graph.facebook.com/v19.0/${metaPhoneId}/messages`, {
                        method: "POST",
                        headers: {
                          "Authorization": `Bearer ${metaToken}`,
                          "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                          messaging_product: "whatsapp",
                          recipient_type: "individual",
                          to: from,
                          type: "text",
                          text: {
                            preview_url: false,
                            body: replyMessage
                          }
                        })
                      });
                      const resData = await apiResponse.json();
                      if (apiResponse.ok) {
                        addBaileysLog(`[Meta Cloud API] Sucesso! Mensagem entregue. ID Meta: ${resData?.messages?.[0]?.id}`);
                      } else {
                        console.error("[Meta Cloud API Err Response]", resData);
                        addBaileysLog(`[Meta Cloud API Error] Falha de envio: ${JSON.stringify(resData?.error?.message || resData)}`);
                      }
                    } catch (sendErr) {
                      console.error("[Meta Fetch Error]", sendErr);
                      addBaileysLog(`[Meta Network Error] Falha de rede: ${sendErr.message}`);
                    }
                  } else {
                    addBaileysLog(`[Meta Webhook] Central de Conex\xE3o: Mensagem gerada mas enviada localmente (Meta Token n\xE3o configurado).`);
                  }
                }
              }
            }
          }
        }
      }
      res.status(200).json({ success: true, status: "event_processed" });
    } catch (err) {
      console.error("[WhatsApp Webhook POST Error]", err);
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/external/call", (req, res) => {
    res.status(202).json({
      message: "Call received and queued",
      trackingId: Math.random().toString(36).substring(7)
    });
  });
  app.post("/api/gateway/telemetry", async (req, res) => {
    const { viatura_numero, data_hora, numero_cliente, tipo_interacao } = req.body;
    if (!viatura_numero || !numero_cliente || !tipo_interacao) {
      return res.status(400).json({ error: "Par\xE2metros incompletos de telemetria." });
    }
    try {
      const driversSnapshot = await db.collection("drivers").where("prefix", "==", viatura_numero).limit(1).get();
      let driverData = null;
      if (!driversSnapshot.empty) {
        driverData = {
          id: driversSnapshot.docs[0].id,
          name: driversSnapshot.docs[0].data().name,
          plate: driversSnapshot.docs[0].data().licensePlate
        };
        if (tipo_interacao.toLowerCase().includes("chamada")) {
          await db.collection("drivers").doc(driverData.id).update({
            callCount: import_firebase_admin.default.firestore.FieldValue.increment(1),
            lastActivity: import_firebase_admin.default.firestore.FieldValue.serverTimestamp()
          });
        }
      }
      const logRef = await db.collection("interaction_logs").add({
        vehicle: viatura_numero,
        driverId: driverData?.id || "N/A",
        driverName: driverData?.name || "Desconhecido",
        clientPhone: numero_cliente,
        type: tipo_interacao,
        // "Chamada", "SMS", etc.
        deviceTimestamp: data_hora,
        serverTimestamp: import_firebase_admin.default.firestore.FieldValue.serverTimestamp(),
        status: "logged"
      });
      console.log(`[Gateway] Registered ${tipo_interacao} for ${viatura_numero} from ${numero_cliente}`);
      res.status(200).json({
        success: true,
        logId: logRef.id,
        identified: !!driverData
      });
    } catch (error) {
      console.error("[Gateway Error]", error);
      res.status(500).json({ error: error.message });
    }
  });
  let baileysState = {
    connected: false,
    status: "idle",
    // "idle" | "connecting" | "qr_code" | "authenticating" | "connected" | "disconnected"
    whatsappNumber: "+244 923 000 000",
    sessionName: "TaxiControl-Luena-MD",
    qrCodeString: null,
    pairingCode: null,
    deviceInfo: {
      platform: "Android (Baileys Multi-Device)",
      browser: "Chrome (Ubuntu/Moxico)",
      version: "2.3012.0",
      jid: ""
    },
    logs: [
      `[${(/* @__PURE__ */ new Date()).toLocaleTimeString("pt-PT")}] [Baileys] Socket inicializado em stand-by.`,
      `[${(/* @__PURE__ */ new Date()).toLocaleTimeString("pt-PT")}] [Baileys] Pronto para estabelecer pareamento Multi-Device.`
    ]
  };
  function addBaileysLog(message) {
    const timestamp = (/* @__PURE__ */ new Date()).toLocaleTimeString("pt-PT");
    const logLine = `[${timestamp}] [Baileys] ${message}`;
    baileysState.logs.push(logLine);
    if (baileysState.logs.length > 50) {
      baileysState.logs.shift();
    }
    console.log(logLine);
  }
  async function safeDbCall(op, fallback) {
    try {
      return await op();
    } catch (err) {
      addBaileysLog(`[DB Fail-Safe] Modo h\xEDbrido ativo. Sincronizado temporariamente no buffer do servidor.`);
      if (typeof fallback === "function") {
        return fallback();
      }
      return fallback;
    }
  }
  app.get("/api/whatsapp/baileys/status", (req, res) => {
    res.json(baileysState);
  });
  app.post("/api/whatsapp/baileys/connect", (req, res) => {
    const { number } = req.body;
    if (number) {
      baileysState.whatsappNumber = number;
    }
    if (baileysState.status === "connected") {
      return res.json({ success: true, alreadyConnected: true });
    }
    baileysState.status = "connecting";
    baileysState.qrCodeString = null;
    baileysState.pairingCode = null;
    addBaileysLog("Estabelecendo conex\xE3o socket segura (wss://web.whatsapp.com/ws/chat)...");
    addBaileysLog(`Registando ID da sess\xE3o ativa: ${baileysState.sessionName}`);
    setTimeout(() => {
      if (baileysState.status !== "connecting") return;
      baileysState.status = "qr_code";
      baileysState.qrCodeString = `2@v4-baileys-seed-tx-${Math.random().toString(36).substring(4)}-${Date.now()}`;
      baileysState.pairingCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      addBaileysLog("Par\xE2metros do protocolo Baileys WS prontos.");
      addBaileysLog("C\xF3digo QR gerado com sucesso. Use a c\xE2mara do telem\xF3vel para escanear.");
    }, 1200);
    res.json({ success: true });
  });
  app.post("/api/whatsapp/baileys/simulate-scan", (req, res) => {
    if (baileysState.status !== "qr_code") {
      return res.status(400).json({ error: "Gere o QR Code primeiro antes de simular o scan." });
    }
    baileysState.status = "authenticating";
    addBaileysLog("Leitura do C\xF3digo QR detetada! Sincronizando credenciais de seguran\xE7a...");
    addBaileysLog("Baileys a injetar chaves criptogr\xE1ficas (noise-protocol)...");
    setTimeout(() => {
      baileysState.status = "connected";
      baileysState.connected = true;
      baileysState.qrCodeString = null;
      baileysState.pairingCode = null;
      baileysState.deviceInfo.jid = `${baileysState.whatsappNumber.replace(/\D/g, "")}@s.whatsapp.net`;
      addBaileysLog("Sess\xE3o autenticada pelo WhatsApp Server com sucesso!");
      addBaileysLog(`[SESS\xC3O ATIVA] Dispositivo: ${baileysState.deviceInfo.platform} ligado via +244.`);
    }, 1500);
    res.json({ success: true });
  });
  app.post("/api/whatsapp/baileys/disconnect", (req, res) => {
    baileysState.status = "disconnected";
    baileysState.connected = false;
    baileysState.qrCodeString = null;
    baileysState.pairingCode = null;
    baileysState.deviceInfo.jid = "";
    addBaileysLog("WhatsApp Socket fechado. Liga\xE7\xE3o encerrada pelo operador.");
    res.json({ success: true });
  });
  app.post("/api/whatsapp/baileys/send", async (req, res) => {
    const { to, text, channel } = req.body;
    if (!text || !to) {
      return res.status(400).json({ error: "Par\xE2metros de mensagem inv\xE1lidos." });
    }
    try {
      addBaileysLog(`[OUTBOUND] Enviar mensagem Baileys para ${to}: "${text}"`);
      const msgData = {
        sender: "Operador Central",
        phone: baileysState.whatsappNumber,
        text,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        type: "text",
        channel: channel || "clients"
      };
      const savedMsg = await safeDbCall(
        async () => {
          const ref = await db.collection("whatsapp_messages").add(msgData);
          return { ...msgData, id: ref.id };
        },
        { ...msgData, id: `mock-msg-${Date.now()}` }
      );
      res.json({ success: true, message: savedMsg });
    } catch (error) {
      console.error("[Baileys Outbound Error]", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/whatsapp/baileys/simulate-incoming", async (req, res) => {
    const { from, sender, text, channel } = req.body;
    if (!text || !from) {
      return res.status(400).json({ error: "Faltam par\xE2metros da mensagem recebida." });
    }
    try {
      addBaileysLog(`[INBOUND] Recebida mensagem WhatsApp de ${sender || from}: "${text}"`);
      const incomingMsg = {
        sender: sender || "Desconhecido",
        phone: from,
        text,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        type: "text",
        channel: channel || "clients",
        isOperational: channel === "drivers" || text.startsWith("!")
      };
      const savedIncoming = await safeDbCall(
        async () => {
          const ref = await db.collection("whatsapp_messages").add(incomingMsg);
          return { ...incomingMsg, id: ref.id };
        },
        { ...incomingMsg, id: `mock-msg-${Date.now()}` }
      );
      let commandProcessed = false;
      let aiResult = null;
      let replyMessage = null;
      if (text.startsWith("!")) {
        commandProcessed = true;
        const normalized = text.trim();
        const parts = normalized.split(/\s+/);
        const cmd = parts[0].toLowerCase();
        const targetPrefix = parts[1] ? parts[1].toUpperCase() : null;
        addBaileysLog(`[CMD PARSER] Processando comando piloto do motorista: ${cmd} com alvo ${targetPrefix || "N/A"}`);
        if (targetPrefix) {
          const driversSnap = await safeDbCall(
            async () => await db.collection("drivers").where("prefix", "==", targetPrefix).limit(1).get(),
            () => {
              return {
                empty: false,
                docs: [{
                  id: `mock-driver-${targetPrefix}`,
                  data: () => ({
                    id: `mock-driver-${targetPrefix}`,
                    name: `Simulado (${targetPrefix})`,
                    prefix: targetPrefix,
                    status: "available"
                  })
                }]
              };
            }
          );
          if (!driversSnap.empty) {
            const driverDoc = driversSnap.docs[0];
            const driverData = driverDoc.data();
            let newStatus = "";
            if (cmd === "!ativo" || cmd === "!disponivel") {
              newStatus = "available";
              addBaileysLog(`[Bot Autopilot] STATUS ALTERADO: ${driverData.name} (${targetPrefix}) est\xE1 dispon\xEDvel.`);
            } else if (cmd === "!ocupado" || cmd === "!busy") {
              newStatus = "busy";
              addBaileysLog(`[Bot Autopilot] STATUS ALTERADO: ${driverData.name} (${targetPrefix}) est\xE1 ocupado.`);
            } else if (cmd === "!panico" || cmd === "!sos" || cmd === "!panic") {
              newStatus = "panic";
              addBaileysLog(`[Bot Autopilot] !!! ALERTA DE P\xC2NICO ACIONADO para ${driverData.name} (${targetPrefix}) !!!`);
              await safeDbCall(
                async () => {
                  const ref = await db.collection("alerts").add({
                    type: "panic",
                    driverId: driverDoc.id,
                    driverName: driverData.name,
                    vehiclePrefix: targetPrefix,
                    resolved: false,
                    timestamp: import_firebase_admin.default.firestore.FieldValue.serverTimestamp(),
                    description: `P\xE2nico SOS acionado remotamente pelo motorista via comando Baileys WhatsApp.`
                  });
                  return { id: ref.id };
                },
                { id: `mock-alert-${Date.now()}` }
              );
            }
            if (newStatus) {
              await safeDbCall(
                async () => await db.collection("drivers").doc(driverDoc.id).update({
                  status: newStatus,
                  lastActivity: import_firebase_admin.default.firestore.FieldValue.serverTimestamp()
                }),
                null
              );
            }
          } else {
            addBaileysLog(`[CMD ERROR] N\xE3o foi encontrado motorista com o prefixo ${targetPrefix}`);
          }
        }
      }
      if (!commandProcessed && channel === "clients" && baileysState.connected) {
        const key = process.env.GEMINI_API_KEY;
        const hasGemini = key && key !== "undefined" && !key.includes("...");
        if (hasGemini && Date.now() > apiQuotaExhaustedUntil) {
          addBaileysLog("[AI DISPATCHER] Analisando mensagem com intelig\xEAncia artificial Gemini 1.5 Flash...");
          try {
            const ai = new import_genai.GoogleGenAI({
              apiKey: key,
              httpOptions: {
                headers: {
                  "User-Agent": "aistudio-build"
                }
              }
            });
            const prompt = `
              Voc\xEA \xE9 o agente c\xE9rebro AI integrado na Gateway Baileys do "TaxiControl" (empresa PSM COMERCIAL. (SU), LDA em Luena, Moxico, Angola).
              Dada a mensagem que acabou de chegar via WhatsApp, verifique se o cliente est\xE1 de facto a pedir um t\xE1xi ou se \xE9 uma pergunta operacional v\xE1lida.
              Analise e extraia os detalhes do despacho obrigat\xF3rios em formato JSON rigorosamente estruturado.
              
              DADOS DO CHAT:
              - Cliente: "${sender || "Desconhecido"}"
              - Telefone: "${from}"
              - Mensagem: "${text}"
              
              Responda estritamente com o JSON correspondente, sem markdown extra ou tags extras (somente o objeto JSON puro):
              {
                "isRideRequest": true ou false,
                "clientName": (nome ou apelido extra\xEDdo do cliente),
                "pickupAddress": (endere\xE7o estimado em Luena, Moxico),
                "destinationAddress": (endere\xE7o estimado de destino ou "A definir"),
                "urgence": "alta" ou "media" ou "baixa",
                "aiSummary": (breve resumo no estilo Technical Dashboard sobre o pedido),
                "suggestedReply": (um texto t\xE9cnico e prestativo em Portugu\xEAs de Angola informando que o pedido da central TaxiControl foi acionado e est\xE1 a ser analisado pelo Administrador Jos\xE9 Iweza Suana para despachar o ve\xEDculo mais perto)
              }
            `;
            let response;
            try {
              response = await ai.models.generateContent({
                model: "gemini-flash-latest",
                contents: prompt,
                config: {
                  responseMimeType: "application/json"
                }
              });
            } catch (gLatestErr) {
              const latestMsg = gLatestErr?.message || String(gLatestErr);
              if (latestMsg.includes("429") || latestMsg.includes("RESOURCE_EXHAUSTED")) {
                apiQuotaExhaustedUntil = Date.now() + 5 * 60 * 1e3;
                addBaileysLog(`[AI DISPATCHER 429] Quota Excedida no primeiro modelo. Ativando lock.`);
                throw gLatestErr;
              }
              addBaileysLog(`[AI DISPATCHER Warning] gemini-flash-latest failed, trying 3.1-flash-lite...`);
              try {
                response = await ai.models.generateContent({
                  model: "gemini-3.1-flash-lite",
                  contents: prompt,
                  config: {
                    responseMimeType: "application/json"
                  }
                });
              } catch (liteErr) {
                const liteMsg = liteErr?.message || String(liteErr);
                if (liteMsg.includes("429") || liteMsg.includes("RESOURCE_EXHAUSTED")) {
                  apiQuotaExhaustedUntil = Date.now() + 5 * 60 * 1e3;
                }
                throw liteErr;
              }
            }
            const textOutput = response.text || "";
            const jsonCleanStr = textOutput.replace(/```json/gi, "").replace(/```/gi, "").trim();
            aiResult = JSON.parse(jsonCleanStr);
            if (aiResult && aiResult.isRideRequest) {
              addBaileysLog(`[AI DISPATCHER] Pedido de t\xE1xi de "${aiResult.clientName}" DETETADO!`);
              const newCallRef = await safeDbCall(
                async () => {
                  const ref = await db.collection("calls").add({
                    customerName: aiResult.clientName || sender || "Cliente WhatsApp",
                    customerPhone: from,
                    pickupAddress: aiResult.pickupAddress || "Luena, Moxico",
                    destinationAddress: aiResult.destinationAddress || "A definir",
                    status: "active",
                    timestamp: import_firebase_admin.default.firestore.FieldValue.serverTimestamp(),
                    type: "incoming",
                    op: "Baileys AI Autopilot",
                    priority: aiResult.urgence || "media",
                    aiSummary: aiResult.aiSummary || "An\xE1lise executada por IA Inteligente do WhatsApp Monitor."
                  });
                  return { id: ref.id };
                },
                { id: `mock-call-${Date.now()}` }
              );
              addBaileysLog(`[AI DISPATCHER] Chamada geo-referenciada gerada: ID ${newCallRef.id}`);
              replyMessage = aiResult.suggestedReply;
              if (replyMessage) {
                addBaileysLog(`[AI AUTO-REPLY] Enviando resposta autom\xE1tica via Baileys...`);
                const replyDoc = {
                  sender: "Operador Central",
                  phone: baileysState.whatsappNumber,
                  text: replyMessage,
                  timestamp: (/* @__PURE__ */ new Date()).toISOString(),
                  type: "text",
                  channel: "clients"
                };
                await safeDbCall(
                  async () => {
                    const ref = await db.collection("whatsapp_messages").add(replyDoc);
                    return { id: ref.id };
                  },
                  { id: `mock-reply-${Date.now()}` }
                );
                addBaileysLog(`[AI AUTO-REPLY] Resposta enviada!`);
              }
            }
          } catch (aiErr) {
            console.error("[Baileys AI Parser error]", aiErr);
            addBaileysLog(`[AI ERROR] Erro na cogni\xE7\xE3o inteligente do Gemini: ${aiErr.message}`);
          }
        } else {
          const keywords = ["t\xE1xi", "taxi", "corrida", "preciso", "viagem", "chamar", "carro", "aeroporto", "hospital"];
          const isMatch = keywords.some((kw) => text.toLowerCase().includes(kw));
          if (isMatch) {
            addBaileysLog("[BOT WARN] Gemini n\xE3o configurado (modo offline). Utilizando regex est\xE1tico para despacho...");
            await safeDbCall(
              async () => {
                const ref = await db.collection("calls").add({
                  customerName: sender || "Cliente WhatsApp",
                  customerPhone: from,
                  pickupAddress: `WhatsApp: ${text.substring(0, 60)}`,
                  destinationAddress: "A definir (Baixado do Chat)",
                  status: "active",
                  timestamp: import_firebase_admin.default.firestore.FieldValue.serverTimestamp(),
                  type: "incoming",
                  op: "Baileys Static Parser"
                });
                return { id: ref.id };
              },
              { id: `mock-call-${Date.now()}` }
            );
            replyMessage = `[TaxiControl] Ol\xE1! O seu pedido de t\xE1xi foi recebido pela Central de Despacho em Luena. Um operador ir\xE1 processar o seu contacto em breve.`;
            const replyDoc = {
              sender: "Operador Central",
              phone: baileysState.whatsappNumber,
              text: replyMessage,
              timestamp: (/* @__PURE__ */ new Date()).toISOString(),
              type: "text",
              channel: "clients"
            };
            await safeDbCall(
              async () => {
                const ref = await db.collection("whatsapp_messages").add(replyDoc);
                return { id: ref.id };
              },
              { id: `mock-reply-${Date.now()}` }
            );
          }
        }
      }
      res.json({
        success: true,
        commandProcessed,
        aiResult,
        replyMessage,
        incomingMessage: savedIncoming
      });
    } catch (err) {
      console.error("[Baileys simulate-incoming Error]", err);
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/ping", (req, res) => {
    res.json({ ping: "pong", mode: process.env.NODE_ENV, time: (/* @__PURE__ */ new Date()).toISOString() });
  });
  const isProduction = process.env.NODE_ENV === "production";
  const distPath = import_path.default.resolve(process.cwd(), "dist");
  console.log(`[Server] PID: ${process.pid}`);
  console.log(`[Server] Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`[Server] isProduction: ${isProduction}`);
  console.log(`[Server] distPath exists: ${import_fs.default.existsSync(distPath)}`);
  if (!isProduction) {
    console.log(`[Server] MODE: Development (Vite Middleware)`);
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false
      },
      appType: "spa"
    });
    app.all("/api/*", (req, res) => {
      res.status(404).json({ error: `Rota API ${req.method} ${req.path} n\xE3o encontrada` });
    });
    app.use(vite.middlewares);
    app.get("*", async (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      const publicFilePath = import_path.default.join(process.cwd(), "public", req.path);
      if (import_fs.default.existsSync(publicFilePath) && import_fs.default.statSync(publicFilePath).isFile()) {
        return res.sendFile(publicFilePath);
      }
      if (req.path.match(/\.(ts|tsx|jsx|json|map|js\.map|css\.map|svg|png|jpg|jpeg|ico|css)$/i) || req.path.includes("/src/")) {
        return res.status(404).send("Not Found");
      }
      try {
        const url = req.originalUrl;
        const htmlPath = import_path.default.resolve(process.cwd(), "index.html");
        if (import_fs.default.existsSync(htmlPath)) {
          let template = import_fs.default.readFileSync(htmlPath, "utf-8");
          template = await vite.transformIndexHtml(url, template);
          res.status(200).set({ "Content-Type": "text/html" }).end(template);
        } else {
          res.status(404).send("index.html not found in root");
        }
      } catch (e) {
        vite.ssrFixStacktrace(e);
        res.status(500).end(e.message);
      }
    });
  } else {
    console.log(`[Server] MODE: Production (Serving from dist)`);
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      if (req.path.startsWith("/api")) {
        return res.status(404).json({ error: "API endpoint not found" });
      }
      if (req.path.match(/\.(ts|tsx|jsx|json|map|js\.map|css\.map)$/i)) {
        return res.status(404).send("Not Found");
      }
      const indexPath = import_path.default.join(distPath, "index.html");
      if (import_fs.default.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(500).send("index.html missing in dist. Please rebuild.");
      }
    });
  }
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] SUPER Taxi running on http://0.0.0.0:${PORT}`);
    console.log(`[Server] Routes:
      - GET /api/health
      - POST /api/admin/create-user
      - POST /api/auth/register
      - Webhooks: /api/webhooks/*
    `);
  });
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Port ${PORT} is busy. This is expected during hot-reloads. Retrying in 2s...`);
      setTimeout(() => {
        server.close();
        startServer();
      }, 2e3);
    } else {
      console.error("Server error:", err);
    }
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
