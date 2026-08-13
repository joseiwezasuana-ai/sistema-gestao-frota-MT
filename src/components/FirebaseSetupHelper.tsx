import React, { useState } from 'react';
import { 
  KeyRound, 
  Mail, 
  Globe, 
  HelpCircle, 
  CheckCircle2, 
  ExternalLink, 
  Copy, 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  Lock, 
  ShieldCheck, 
  Info,
  Smartphone,
  CheckSquare,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FirebaseSetupHelperProps {
  isOpen?: boolean;
  onClose?: () => void;
  isEmbedded?: boolean;
}

export default function FirebaseSetupHelper({ isOpen = true, onClose, isEmbedded = false }: FirebaseSetupHelperProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [copiedDomain, setCopiedDomain] = useState<string | null>(null);

  const currentDevDomain = "ais-dev-2hxxqzehmg6kvmur3bxyou-214885335133.europe-west3.run.app";
  const currentProdDomain = "ais-pre-2hxxqzehmg6kvmur3bxyou-214885335133.europe-west3.run.app";

  const handleCopy = (text: string, type: 'dev' | 'prod' | 'console') => {
    navigator.clipboard.writeText(text);
    setCopiedDomain(type);
    setTimeout(() => setCopiedDomain(null), 2500);
  };

  const steps = [
    {
      title: "1. Entrar no Console",
      subtitle: "Aceder ao Painel Administrativo",
      icon: <ExternalLink size={20} className="text-brand-primary" />,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-slate-650 leading-relaxed">
            Para que os seus colaboradores (como motoristas, secretários e operadores) se consigam autenticar, é necessário que as opções de Login estejam ativadas na sua conta do Firebase.
          </p>
          <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Link Oficial do Firebase</p>
              <p className="text-xs font-bold text-slate-800 break-all">https://console.firebase.google.com/</p>
            </div>
            <a 
              href="https://console.firebase.google.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-brand-primary text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-brand-secondary transition-all flex items-center gap-1.5 whitespace-nowrap"
            >
              Abrir Console <ExternalLink size={12} />
            </a>
          </div>
          <div className="p-4 bg-amber-50/50 border border-amber-200/60 rounded-2xl flex items-start gap-3">
            <Info size={18} className="text-amber-600 shrink-0 mt-0.5 animate-pulse" />
            <div className="text-xs text-amber-800 space-y-1">
              <p className="font-extrabold uppercase tracking-wide text-[9.5px]">Nota de Autenticação</p>
              <p className="leading-relaxed">
                Inicie sessão com o seu e-mail de administrador (<strong className="font-bold">joseiwezasuana@gmail.com</strong>) para ter acesso completo às configurações do projeto.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "2. Ativar E-mail & Senha",
      subtitle: "Configurar Login por E-mail",
      icon: <Mail size={20} className="text-emerald-500" />,
      content: (
        <div className="space-y-3.5">
          <p className="text-sm text-slate-650 leading-relaxed">
            O provedor de <strong>E-mail/Palavra-passe</strong> é indispensável para que colaboradores ativem as contas criadas com os Códigos de Ativação.
          </p>
          <ol className="space-y-2.5 text-xs text-slate-700">
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-black text-[10px] text-slate-500 shrink-0 mt-0.5">1</span>
              <span>No menu lateral esquerdo do console, expanda a secção <strong>Build</strong> e selecione <strong>Authentication</strong>.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-black text-[10px] text-slate-500 shrink-0 mt-0.5">2</span>
              <span>Clique no separador superior chamado <strong>Sign-in method</strong> (Método de login).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-black text-[10px] text-slate-500 shrink-0 mt-0.5">3</span>
              <span>Clique no botão azul <strong>Add new provider</strong> (Adicionar novo provedor).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-black text-[10px] text-slate-500 shrink-0 mt-0.5">4</span>
              <span>Escolha a opção <strong>Email/Password</strong> (E-mail/Senha).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center font-black text-[10px] shrink-0 mt-0.5">5</span>
              <span>Ative o primeiro seletor (<strong>Enable / Ativado</strong>) e clique em <strong>Save</strong> (Salvar).</span>
            </li>
          </ol>
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-150 flex items-center gap-2.5">
            <CheckSquare size={16} className="text-emerald-500" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Apenas o primeiro seletor precisa de estar ativo.</span>
          </div>
        </div>
      )
    },
    {
      title: "3. Ativar Login Google",
      subtitle: "Configurar Login Rápido",
      icon: <KeyRound size={20} className="text-indigo-500" />,
      content: (
        <div className="space-y-3.5">
          <p className="text-sm text-slate-650 leading-relaxed">
            Permite o login com um único clique utilizando a Conta Google. Útil para o Administrador e Gerentes de Frota.
          </p>
          <ol className="space-y-2.5 text-xs text-slate-700">
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-black text-[10px] text-slate-500 shrink-0 mt-0.5">1</span>
              <span>No mesmo separador <strong>Sign-in method</strong>, clique novamente em <strong>Add new provider</strong>.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-black text-[10px] text-slate-500 shrink-0 mt-0.5">2</span>
              <span>Escolha a opção <strong>Google</strong>.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-black text-[10px] text-slate-500 shrink-0 mt-0.5">3</span>
              <span>Ative o interruptor superior de <strong>Enable</strong>.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center font-black text-[10px] shrink-0 mt-0.5">4</span>
              <span>No campo <strong>E-mail de suporte do projeto</strong>, selecione o seu e-mail (<strong>joseiwezasuana@gmail.com</strong>).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center font-black text-[10px] shrink-0 mt-0.5">5</span>
              <span>Clique em <strong>Save / Salvar</strong> no fundo da janela.</span>
            </li>
          </ol>
        </div>
      )
    },
    {
      title: "4. Autorizar Domínios",
      subtitle: "Liberar Acesso do App",
      icon: <Globe size={20} className="text-brand-primary" />,
      content: (
        <div className="space-y-3.5">
          <p className="text-sm text-slate-650 leading-relaxed">
            Se o domínio não estiver listado como <strong>Authorized Domains</strong>, o Firebase bloqueia a autenticação por motivos de segurança. Adicione os seguintes domínios:
          </p>
          
          <div className="space-y-2">
            <div className="p-3 bg-slate-50 border border-slate-150 rounded-2xl flex items-center justify-between gap-2">
              <div className="overflow-hidden">
                <span className="text-[8px] font-black uppercase text-brand-primary tracking-wider block">Domínio de Desenvolvimento</span>
                <span className="text-xs font-mono font-bold text-slate-700 truncate block">{currentDevDomain}</span>
              </div>
              <button 
                onClick={() => handleCopy(currentDevDomain, 'dev')}
                className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all text-slate-600 flex items-center gap-1 shrink-0"
              >
                {copiedDomain === 'dev' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                <span className="text-[10px] font-bold hidden sm:inline">{copiedDomain === 'dev' ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-150 rounded-2xl flex items-center justify-between gap-2">
              <div className="overflow-hidden">
                <span className="text-[8px] font-black uppercase text-emerald-600 tracking-wider block">Domínio de Produção</span>
                <span className="text-xs font-mono font-bold text-slate-700 truncate block">{currentProdDomain}</span>
              </div>
              <button 
                onClick={() => handleCopy(currentProdDomain, 'prod')}
                className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all text-slate-600 flex items-center gap-1 shrink-0"
              >
                {copiedDomain === 'prod' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                <span className="text-[10px] font-bold hidden sm:inline">{copiedDomain === 'prod' ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
          </div>

          <div className="pt-2">
            <p className="text-xs font-black uppercase text-slate-400 tracking-wider mb-2">Como Adicionar no Firebase:</p>
            <ol className="space-y-2 text-xs text-slate-700">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-black text-[10px] text-slate-500 shrink-0 mt-0.5">1</span>
                <span>Aceda ao separador superior chamado <strong>Settings</strong> (Configurações) no módulo Authentication.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-black text-[10px] text-slate-500 shrink-0 mt-0.5">2</span>
                <span>No submenu lateral esquerdo de Settings, selecione <strong>Authorized domains</strong> (Domínios autorizados).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-black text-[10px] text-slate-500 shrink-0 mt-0.5">3</span>
                <span>Clique no botão <strong>Add domain</strong> (Adicionar domínio).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center font-black text-[10px] shrink-0 mt-0.5">4</span>
                <span>Cole o domínio copiado acima (sem "https://" nem barras adicionais) e clique em <strong>Add / Adicionar</strong>.</span>
              </li>
            </ol>
          </div>
        </div>
      )
    },
    {
      title: "5. Resolvido!",
      subtitle: "Testar a Autenticação",
      icon: <CheckCircle2 size={20} className="text-emerald-500" />,
      content: (
        <div className="space-y-4 text-center py-4">
          <div className="w-16 h-16 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center mx-auto text-emerald-600 animate-bounce">
            <ShieldCheck size={32} />
          </div>
          <div className="space-y-2">
            <h4 className="text-base font-black uppercase tracking-wider text-slate-800">Tudo Pronto para Avançar!</h4>
            <p className="text-sm text-slate-600 max-w-sm mx-auto leading-relaxed">
              Após ativar os provedores e autorizar os domínios, o erro <code className="px-1.5 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 rounded text-xs font-mono font-bold">auth/operation-not-allowed</code> será completamente resolvido!
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl text-left border border-slate-150 space-y-1.5 max-w-md mx-auto">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Sparkles size={12} className="text-amber-500 animate-spin" />
              Recurso Alternativo Ativo
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">
              Como precaução extra para que os seus colaboradores nunca fiquem sem trabalhar, a nossa plataforma <strong className="text-brand-primary">SUPER Taxi</strong> já tem integrado um <strong className="font-bold">Modo Híbrido Local</strong> de registo. Se a rede ou a consola falhar, eles podem ativar e logar com os mesmos dados de forma automatizada!
            </p>
          </div>
        </div>
      )
    }
  ];

  if (!isEmbedded && !isOpen) return null;

  const contentMarkup = (
    <div className={`w-full ${isEmbedded ? 'border border-slate-200 rounded-[2rem] shadow-sm' : 'max-w-xl rounded-[2.5rem] shadow-[0_30px_100px_-10px_rgba(0,0,0,0.8)] border border-slate-100'} bg-white overflow-hidden flex flex-col`}>
      {/* Header section */}
      <div className="px-6 sm:px-8 pt-8 pb-4 border-b border-slate-100 bg-slate-50 shrink-0 text-left">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[9px] bg-brand-primary/10 text-brand-primary font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 w-fit">
              <Lock size={10} /> Configuração de Segurança Firebase
            </span>
            <h3 className="text-sm sm:text-base font-black text-slate-800 tracking-tight uppercase">Guia de Ativação do Colaborador</h3>
            <p className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-wider">Como resolver o erro auth/operation-not-allowed e autorizar domínios</p>
          </div>
          {!isEmbedded && onClose && (
            <button 
              onClick={onClose}
              className="p-3 bg-slate-200/50 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-2xl transition-all cursor-pointer"
            >
              <Check size={18} />
            </button>
          )}
        </div>

        {/* Stepper progress indicator */}
        <div className="flex items-center gap-2 mt-6 overflow-x-auto pb-1">
          {steps.map((step, idx) => (
            <button
              key={idx}
              onClick={() => setActiveStep(idx)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
                activeStep === idx 
                  ? "bg-brand-primary text-white shadow-md shadow-brand-primary/20" 
                  : idx < activeStep 
                    ? "bg-emerald-50 text-emerald-600 border border-emerald-100" 
                    : "bg-slate-100 text-slate-400 hover:bg-slate-200/60"
              }`}
            >
              {idx < activeStep ? <Check size={10} /> : <span>{idx + 1}</span>}
              <span className="hidden sm:inline">{step.title.split('. ')[1]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Dynamic content container */}
      <div className="p-6 sm:p-8 overflow-y-auto flex-1 bg-white text-left">
        <div className="flex items-start gap-4 mb-5 pb-4 border-b border-slate-100">
          <div className="w-12 h-12 bg-slate-50 border border-slate-150 rounded-2xl flex items-center justify-center shrink-0">
            {steps[activeStep].icon}
          </div>
          <div>
            <p className="text-[9px] font-black text-brand-primary uppercase tracking-widest">{steps[activeStep].title}</p>
            <h4 className="text-base font-black text-slate-800 uppercase tracking-tight leading-snug">{steps[activeStep].subtitle}</h4>
          </div>
        </div>

        {steps[activeStep].content}
      </div>

      {/* Footer actions */}
      <div className="px-6 sm:px-8 py-5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
        <button
          onClick={() => setActiveStep(prev => Math.max(0, prev - 1))}
          disabled={activeStep === 0}
          className="px-4 py-3 bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 transition-all flex items-center gap-1 cursor-pointer"
        >
          <ChevronLeft size={14} /> Anterior
        </button>

        {activeStep < steps.length - 1 ? (
          <button
            onClick={() => setActiveStep(prev => prev + 1)}
            className="px-5 py-3 bg-slate-900 hover:bg-slate-950 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1 cursor-pointer shadow-lg shadow-slate-900/15"
          >
            Seguinte <ChevronRight size={14} />
          </button>
        ) : (
          !isEmbedded && onClose ? (
            <button
              onClick={onClose}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-600/15"
            >
              <CheckCircle2 size={14} /> Fechar Guia
            </button>
          ) : (
            <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-lg font-black uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck size={12} /> Configurado
            </span>
          )
        )}
      </div>
    </div>
  );

  if (isEmbedded) {
    return contentMarkup;
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 notranslate">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-xl flex flex-col max-h-[90vh]"
      >
        {contentMarkup}
      </motion.div>
    </div>
  );
}
