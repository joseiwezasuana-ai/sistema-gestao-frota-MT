const cache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 hours

async function safeFetchJson(url: string, bodyObj: any, fallbackText: string): Promise<string> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyObj)
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      console.warn(`[Gemini Proxy] Response from ${url} was not JSON (Content-Type: ${contentType}). Returning operational fallback.`);
      return fallbackText;
    }

    const result = await response.json();
    if (!response.ok || !result) {
      console.warn(`[Gemini Proxy] Response error from ${url}:`, result?.error);
      return result?.text || fallbackText;
    }

    return result.text || fallbackText;
  } catch (error: any) {
    console.warn(`[Gemini Proxy] Request failed for ${url}:`, error?.message);
    return fallbackText;
  }
}

export const geminiService = {
  async getFleetInsights(data: any) {
    const cacheKey = JSON.stringify(data);
    if (cache[cacheKey] && (Date.now() - cache[cacheKey].timestamp < CACHE_DURATION)) {
      console.log("[Gemini Proxy] Returning cached insights");
      return cache[cacheKey].data;
    }
    
    const fallback = `Frota TaxiControl opera com estabilidade em Luena. Registo de ${data?.activeVehicles || 0} de ${data?.totalVehicles || 0} veículos ativos. ${data?.speedViolations || 0} alertas de velocidade e ${data?.missedCalls || 0} chamadas perdidas. Monitorização contínua ativa no Moxico.`;

    const insights = await safeFetchJson('/api/gemini/insights', { data }, fallback);
    cache[cacheKey] = { data: insights, timestamp: Date.now() };
    return insights;
  },

  async getDriverPerformanceAudit(driver: any, stats: any) {
    const cacheKey = JSON.stringify({ audit: driver, stats });
    if (cache[cacheKey] && (Date.now() - cache[cacheKey].timestamp < CACHE_DURATION)) {
      console.log("[Gemini Proxy] Returning cached audit");
      return cache[cacheKey].data;
    }
    
    const fallback = `AUDITORIA OPERACIONAL LUENA\nMotorista: ${driver?.name || 'Motorista'} (Viatura ${driver?.prefix || 'N/A'})\n\n1. Comunicação: ${stats?.totalCalls || 0} chamadas e ${stats?.totalSms || 0} SMS registados.\n2. Segurança: Índice de condução estimado em ${stats?.speedScore || 100}/100.\n3. Recomendação: Manter atenção às condições do asfalto/solo e cumprir escala.`;

    const audit = await safeFetchJson('/api/gemini/audit', { driver, stats }, fallback);
    cache[cacheKey] = { data: audit, timestamp: Date.now() };
    return audit;
  },

  async getDriverCoachingInsights(driverData: any, context: any) {
    const cacheKey = JSON.stringify({ coaching: driverData, context });
    if (cache[cacheKey] && (Date.now() - cache[cacheKey].timestamp < CACHE_DURATION)) {
      console.log("[Gemini Proxy] Returning cached coaching");
      return cache[cacheKey].data;
    }
    
    const fallback = `Parceiro ${driverData?.name || 'Motorista'}, receita atual de ${context?.currentRevenue || 0} Kz (meta: ${context?.targetRevenue || 25000} Kz). Concentre a circulação em pontos de alta procura em Luena para otimizar os seus ganhos!`;

    const coaching = await safeFetchJson('/api/gemini/coaching', { driverData, context }, fallback);
    cache[cacheKey] = { data: coaching, timestamp: Date.now() };
    return coaching;
  },

  async getSafetyChecklist(vehicleData: any) {
    const cacheKey = JSON.stringify({ checklist: vehicleData });
    if (cache[cacheKey] && (Date.now() - cache[cacheKey].timestamp < CACHE_DURATION)) {
      console.log("[Gemini Proxy] Returning cached checklist");
      return cache[cacheKey].data;
    }
    
    const fallback = "1. Verificar óleos e filtros (poeira de Luena)\n2. Testar travões e pressão dos pneus\n3. Inspecionar luzes e piscas\n4. Confirmar rádio/GPS ativo";

    const checklist = await safeFetchJson('/api/gemini/checklist', { vehicleData }, fallback);
    cache[cacheKey] = { data: checklist, timestamp: Date.now() };
    return checklist;
  }
};

