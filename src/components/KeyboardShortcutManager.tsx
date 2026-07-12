import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Keyboard, 
  X, 
  LayoutDashboard, 
  Truck, 
  Activity, 
  Wallet, 
  Wrench, 
  Calculator, 
  Users, 
  MessageCircle, 
  FileText, 
  Settings as SettingsIcon, 
  BookOpen, 
  MapPin, 
  History as HistoryIcon,
  UserPlus
} from 'lucide-react';
import { cn } from '../lib/utils';

interface KeyboardShortcutManagerProps {
  user: any;
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export interface ShortcutItem {
  key: string;
  label: string;
  tabId: string;
  desc: string;
  icon: any;
  roles?: string[];
}

export default function KeyboardShortcutManager({ user, activeTab, onTabChange }: KeyboardShortcutManagerProps) {
  const [showCheatSheet, setShowCheatSheet] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; icon: any; keyText: string } | null>(null);

  const shortcutList: ShortcutItem[] = [
    { key: 'D', label: 'Painel Geral', tabId: 'dashboard', desc: 'Aceder ao dashboard principal de operações centralizadas.', icon: LayoutDashboard },
    { key: 'F', label: 'Frota & Escalas 24h', tabId: 'fleet', desc: 'Gerir escalas activas de motoristas e veículos.', icon: Truck, roles: ['admin', 'operator', 'mecanico', 'contabilista'] },
    { key: 'M', label: 'Monitores de Campo', tabId: 'monitors', desc: 'Verificar status, pânicos e estatísticas em tempo real.', icon: Activity, roles: ['admin', 'operator', 'contabilista', 'mecanico'] },
    { key: 'V', label: 'Validação de Rendas', tabId: 'revenue', desc: 'Confirmar pagamentos e salários diários das viaturas.', icon: Wallet, roles: ['operator', 'contabilista', 'admin'] },
    { key: 'O', label: 'Gestão de Oficinas', tabId: 'maintenance', desc: 'Controlo de manutenções gerais e inventário de peças.', icon: Wrench, roles: ['admin', 'operator', 'mecanico', 'contabilista'] },
    { key: 'C', label: 'Hub Contabilidade', tabId: 'accounting', desc: 'Consultar folhas e balanços de contabilidade da JIS.', icon: Calculator, roles: ['admin', 'contabilista'] },
    { key: 'P', label: 'Gestão de Passageiros', tabId: 'passengers', desc: 'Acompanhar fluxos de passageiros e escalas de linhas.', icon: Users, roles: ['admin', 'operator'] },
    { key: 'G', label: 'Gateway Baileys', tabId: 'baileys_gateway', desc: 'Canal de integração WhatsApp e monitoramento de terminais.', icon: MessageCircle, roles: ['admin', 'operator'] },
    { key: 'A', label: 'Dossiê Comunicações', tabId: 'call_sms_dossier', desc: 'Lista de chamadas interceptadas e histórico de SMS.', icon: FileText, roles: ['admin', 'operator'] },
    { key: 'J', label: 'Portal de Recrutamento', tabId: 'recruitment', desc: 'Processos de admissão de candidatos e frotas.', icon: UserPlus, roles: ['admin', 'operator', 'mecanico'] },
    { key: 'T', label: 'Mapa em Tempo Real', tabId: 'map', desc: 'Localização GPS em tempo real dos carros activos.', icon: MapPin },
    { key: 'H', label: 'Histórico Completo', tabId: 'history', desc: 'Históricos de ocorrências do sistema.', icon: HistoryIcon },
    { key: 'S', label: 'Configurações', tabId: 'settings', desc: 'Definições do sistema de inteligência artificial e senhas.', icon: SettingsIcon, roles: ['admin'] },
  ];

  const checkHasRoleAccess = (item: ShortcutItem) => {
    if (!item.roles) return true;
    const isMasterAdmin = user?.email?.toLowerCase() === 'joseiwezasuana@gmail.com';
    if (isMasterAdmin || user?.role === 'admin' || user?.role === 'gerente') return true;
    return item.roles.includes(user?.role);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // We look for Alt + Key (ignoring case)
      if (e.altKey) {
        const pressedKey = e.key.toUpperCase();
        
        // Help key (Alt + K)
        if (pressedKey === 'K') {
          e.preventDefault();
          setShowCheatSheet(prev => !prev);
          return;
        }

        const match = shortcutList.find(item => item.key === pressedKey);
        if (match) {
          e.preventDefault();
          
          if (checkHasRoleAccess(match)) {
            onTabChange(match.tabId);
            
            // Show custom toast feedback
            setToastMessage({
              text: `Navegando para: ${match.label}`,
              icon: match.icon,
              keyText: `Alt + ${match.key}`
            });
          } else {
            setToastMessage({
              text: `Acesso Negado: ${match.label}`,
              icon: X,
              keyText: `Alt + ${match.key}`
            });
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [user, onTabChange]);

  // Handle toast automatic dismissal
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const activeShortcuts = shortcutList.filter(item => checkHasRoleAccess(item));

  return (
    <>
      {/* Mini helper floating trigger in the bottom-right corner of viewport */}
      <div className="fixed bottom-6 right-6 z-[45] flex items-center gap-3">
        <button
          onClick={() => setShowCheatSheet(true)}
          className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-900 border border-slate-800 text-white rounded-xl hover:bg-black transition-all shadow-xl active:scale-95 text-xs font-black uppercase tracking-wider"
          title="Atalhos Globais de Teclado (Alt+K)"
          id="btn-shortcuts-helper"
        >
          <Keyboard size={14} className="text-brand-primary" />
          <span className="text-[10px] text-slate-400 font-mono select-none">ALT + K</span>
        </button>
      </div>

      {/* Floating Animated Toast Feedback */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className={cn(
              "fixed bottom-20 right-6 z-50 p-4 rounded-xl shadow-2xl border flex items-center gap-3 min-w-[280px]",
              toastMessage.text.startsWith("Acesso Negado") 
                ? "bg-rose-950/95 border-rose-800 text-rose-200"
                : "bg-slate-900/95 border-brand-primary/30 text-white"
            )}
          >
            <div className={cn(
              "p-2 rounded-lg shrink-0",
              toastMessage.text.startsWith("Acesso Negado") ? "bg-rose-500/20" : "bg-brand-primary/20"
            )}>
              <toastMessage.icon size={16} className={toastMessage.text.startsWith("Acesso Negado") ? "text-rose-400" : "text-brand-primary"} />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Atalho Activado</p>
              <p className="text-[11px] font-black tracking-tight">{toastMessage.text}</p>
            </div>
            <span className="text-[10px] px-2 py-1 bg-white/10 rounded-md font-mono text-white/80 font-black tracking-wider shadow-sm border border-white/5 shrink-0">
              {toastMessage.keyText}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shortcuts Cheat Sheet Modal Overlay */}
      <AnimatePresence>
        {showCheatSheet && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] text-slate-800 dark:text-white"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                    <Keyboard size={20} />
                  </div>
                  <div>
                    <h3 className="text-md font-black tracking-tighter uppercase italic leading-none">Gestor de Atalhos Globais</h3>
                    <p className="text-[9px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest mt-1.5">Produtividades Rápidas para Operadores JIS & Central</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCheatSheet(false)}
                  className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all"
                  id="btn-close-shortcuts-helper"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[50vh] custom-scrollbar">
                <p className="text-[11px] text-slate-500 leading-relaxed font-semibold italic">
                  Utilize as seguintes combinações de teclas <strong className="text-brand-primary font-bold">ALT + Tecla</strong> no seu teclado físico de computador para navegar instantaneamente entre os módulos autorizados da central sem utilizar o rato.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {shortcutList.map((item) => {
                    const hasAccess = checkHasRoleAccess(item);
                    return (
                      <div 
                        key={item.key}
                        onClick={() => {
                          if (hasAccess) {
                            onTabChange(item.tabId);
                            setShowCheatSheet(false);
                          }
                        }}
                        className={cn(
                          "p-4 rounded-2xl border flex items-start gap-3 transition-all",
                          hasAccess 
                            ? "border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:border-brand-primary/40 dark:hover:border-brand-primary/30 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/50"
                            : "opacity-40 border-slate-100 dark:border-slate-900 bg-slate-50/30 dark:bg-slate-950/20 cursor-not-allowed select-none"
                        )}
                        title={hasAccess ? `Navegar para ${item.label}` : 'Módulo não disponível para o seu perfil'}
                      >
                        <div className={cn(
                          "p-2 rounded-xl shrink-0 text-white shadow-md",
                          hasAccess ? "bg-slate-900 dark:bg-black" : "bg-slate-300 dark:bg-slate-800"
                        )}>
                          <item.icon size={16} className={hasAccess ? "text-brand-primary" : "text-slate-450"} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="text-[11px] font-black truncate uppercase tracking-wide leading-none">{item.label}</h4>
                            <span className="text-[9px] px-2 py-0.5 bg-brand-primary text-white font-mono rounded-md font-black tracking-wider shadow-sm">
                              {item.key}
                            </span>
                          </div>
                          <p className="text-[9px] text-slate-400 dark:text-slate-500 leading-snug mt-1.5 font-medium line-clamp-2">
                            {item.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between text-[10px]">
                <span className="text-slate-400 uppercase font-black tracking-widest opacity-65">JIS LUENA • GESTÃO DE ATALHOS</span>
                <span className="text-slate-500 font-mono tracking-wider">Pressione <kbd className="bg-slate-200 dark:bg-slate-850 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-800 text-[9px] font-bold">ALT</kbd> + <kbd className="bg-slate-200 dark:bg-slate-850 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-800 text-[9px] font-bold">K</kbd> para fechar</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
