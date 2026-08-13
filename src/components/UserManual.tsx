import React from 'react';
import { 
  BookOpen, 
  Truck, 
  Calendar, 
  Zap, 
  ShieldAlert, 
  Wallet, 
  Smartphone,
  CheckCircle2,
  Printer,
  ChevronRight,
  Info,
  Trophy,
  PhoneCall,
  Users,
  FileText,
  Lock
} from 'lucide-react';

export default function UserManual() {
  const sections = [
    {
      title: '1. Gestão de Frota & Escalas 24h',
      icon: <Truck size={20} />,
      content: 'Nesta sessão, você gere todas as viaturas da PSM COMERCIAL. Pode registar novos veículos, ver o estado atual (Disponível, Em Manutenção, Ocupado) e aceder ao Planeamento de Turnos.',
      details: [
        'Prefixos organizados numericamente (TX-01, TX-02, TX-10, etc).',
        'Filtros rápidos por estado de viatura e localização.',
        'Atalhos diretos para manutenção, histórico e ficha do veículo.'
      ]
    },
    {
      title: '2. Escalamento de Turnos (Calendário Diário & 24h)',
      icon: <Calendar size={20} />,
      content: 'Localizado dentro da aba de Frota, o calendário permite organizar a operação diária e semanal com máxima agilidade.',
      details: [
        'Regimes de Turno: Turno Diurno, Turno Nocturno e regime contínuo de 24 Horas.',
        'Duplicação Rápida (1 Clique): Clone a escala de um motorista para o dia seguinte instantaneamente.',
        'Estados de Turno: Ativo, Folga ou Suspenso (destacado em vermelho no mapa).'
      ]
    },
    {
      title: '3. Classificação de Produção dos Motoristas (Ranking)',
      icon: <Trophy size={20} />,
      content: 'Módulo dedicado na Gestão Financeira para apuramento hierárquico da produtividade da frota em tempo real.',
      details: [
        'Pódio de Destaques: Evidência visual do 1º Lugar (Ouro 🥇), 2º Lugar (Prata 🥈) e 3º Lugar (Bronze 🥉).',
        'Tabela Hierárquica Completa: Listagem ordenada do 1º ao último colocado com registos, faturação bruta, despesas, descontos e salário de 10%.',
        'Filtros & Exportação PDF: Alterne entre "Mês Atual" ou "Consolidado Total" e exporte relatórios oficiais ou clique em "Ver Recibo" para emissão imediata.'
      ]
    },
    {
      title: '4. Monitorização em Tempo Real & Segurança',
      icon: <Zap size={20} />,
      content: 'O coração operacional em Luena, Moxico. Monitorize a localização via GPS e alertas críticos.',
      details: [
        'Alertas de Velocidade: Notificação sonora e visual quando a viatura ultrapassar os 80 km/h.',
        'Protocolo Pânico (SOS): Alerta prioritário em tempo real para situações de perigo ou roubo.',
        'Histórico de Telemetria: Controlo de quilometragem e chamadas não atendidas.'
      ]
    },
    {
      title: '5. Gestão Financeira, Rendas & Folha de Salários',
      icon: <Wallet size={20} />,
      content: 'Verificação, conciliação e validação de depósitos diários de rendas dos motoristas.',
      details: [
        'Lançamento de rendas diárias com comprovativo TPA, Cash ou Transferência.',
        'Mapa de Faturamento & Balanço de Análise com liquidez e margens operacionais.',
        'Emissão de Recibos de Pagamento e Folha de Salários com descontos regulamentares.'
      ]
    },
    {
      title: '6. Dossiê de Chamadas & Gateway Baileys (WhatsApp GSM)',
      icon: <PhoneCall size={20} />,
      content: 'Central unificada para registo e sincronização de chamadas telefónicas e mensagens de apoio ao cliente.',
      details: [
        'Registo automático e manual de chamadas GSM com identificação do motorista.',
        'Sincronização de Logs: Conexão direta com a aplicação Android/Gateway da central.',
        'Relatórios de Chamadas Perdidas e atendimento prioritário.'
      ]
    },
    {
      title: '7. Portal do Passageiro Integrado & Termos Legais',
      icon: <Users size={20} />,
      content: 'Canal direto para clientes solicitarem táxis em Luena e consultarem políticas operacionais.',
      details: [
        'Cálculo de Distância GPS Haversine em tempo real e estimativa de tarifa.',
        'Central de Apoio & Reclamações integrada com registo direto.',
        'Termos de Serviço e Políticas de Privacidade acessíveis no rodapé do portal.'
      ]
    },
    {
      title: '8. Auditoria com IA Gemini 1.5 Flash',
      icon: <Smartphone size={20} />,
      content: 'Inteligência Artificial configurada para auditorias operacionais e alertas automáticos de frota.',
      details: [
        'Análise de padrões de consumo e estimativa de receitas diárias.',
        'Relatórios de discrepância de faturação e eficiência de turno.',
        'Recomendações estratégicas para o operador de frota.'
      ]
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 print:p-0">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-8 sm:p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden text-white">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 blur-3xl -mr-32 -mt-32 rounded-full pointer-events-none" />
        
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-500 rounded-2xl flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20 shrink-0">
                <BookOpen size={32} />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter italic leading-none text-white">
                  SUPER TÁXI
                </h1>
                <p className="text-amber-400 font-bold text-[11px] uppercase tracking-[0.3em] mt-2">
                  MANUAL DE UTILIZADOR E GUIA DE OPERAÇÕES • JIS ANGOLA 2026
                </p>
              </div>
            </div>

            <button 
              onClick={() => window.print()}
              className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-amber-500/10 transition-all cursor-pointer self-start sm:self-center"
            >
              <Printer size={16} />
              Exportar Manual (PDF)
            </button>
          </div>
          
          <p className="text-slate-300 text-sm leading-relaxed max-w-3xl font-medium">
            Bem-vindo ao Guia Oficial de Operações da <strong className="text-white">PSM COMERCIAL (SU), LDA • SUPER TÁXI (LUENA-MOXICO)</strong>. Este manual detalha todos os procedimentos operacionais, gestão financeira, ranking de produção, monitorização de frota e segurança.
          </p>

          <div className="mt-6 flex items-center gap-2 px-4 py-3 bg-white/5 border border-white/10 rounded-xl">
            <Info size={14} className="text-amber-400 shrink-0" />
            <p className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">
              Dica: Para imprimir ou guardar em PDF, utilize o botão acima ou prima Ctrl+P.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Tips / Destaques Operacionais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-emerald-500/10 p-6 rounded-3xl border border-emerald-500/20">
          <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400 mb-4 shadow-sm">
            <Trophy size={22} />
          </div>
          <h4 className="font-black text-emerald-400 text-[11px] uppercase tracking-widest mb-2">Classificação de Produção</h4>
          <p className="text-xs text-slate-300 leading-relaxed font-medium">
            Aceda ao menu **Contabilidade &gt; Classificação de Produção** para consultar a tabela ordenada do 1º ao último colocado, apurar descontos e emitir recibos.
          </p>
        </div>
        
        <div className="bg-amber-500/10 p-6 rounded-3xl border border-amber-500/20">
          <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-400 mb-4 shadow-sm">
            <ShieldAlert size={22} />
          </div>
          <h4 className="font-black text-amber-400 text-[11px] uppercase tracking-widest mb-2">Segurança & SOS</h4>
          <p className="text-xs text-slate-300 leading-relaxed font-medium">
            Velocidades superiores a 80km/h e acionamentos de pânico geram alertas sonoros e visuais no painel do operador em tempo real.
          </p>
        </div>

        <div className="bg-blue-500/10 p-6 rounded-3xl border border-blue-500/20">
          <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-400 mb-4 shadow-sm">
            <Calendar size={22} />
          </div>
          <h4 className="font-black text-blue-400 text-[11px] uppercase tracking-widest mb-2">Duplicação de Turnos</h4>
          <p className="text-xs text-slate-300 leading-relaxed font-medium">
            No Calendário de Escalas, clique no ícone de cópia rápida para duplicar o turno de 24h ou diurno para o dia seguinte sem retrabalho.
          </p>
        </div>
      </div>

      {/* Main Sections */}
      <div className="space-y-4">
        {sections.map((section, idx) => (
          <div 
            key={idx}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-8 rounded-[2rem] shadow-sm hover:shadow-md transition-shadow print-break-inside-avoid"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-slate-100 dark:bg-white/5 rounded-xl text-amber-500">
                {section.icon}
              </div>
              <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tighter text-lg italic">
                {section.title}
              </h3>
            </div>
            
            <p className="text-slate-600 dark:text-slate-300 text-[13px] font-medium leading-relaxed mb-6">
              {section.content}
            </p>

            <ul className="space-y-3">
              {section.details.map((detail, dIdx) => (
                <li key={dIdx} className="flex items-start gap-3 text-xs text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider">
                  <ChevronRight size={14} className="text-amber-500 shrink-0 mt-0.5" />
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Footer Support */}
      <div className="text-center py-10 border-t border-slate-200 dark:border-white/10">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">
          SUPER TÁXI • TAXICONTROL • JIS ANGOLA • OPERAÇÃO 2026
        </p>
      </div>
    </div>
  );
}
