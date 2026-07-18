import React, { useState, useEffect } from 'react';
import { 
  Key, 
  Plus, 
  Copy, 
  Check, 
  Trash2, 
  UserPlus,
  Loader2,
  Database,
  Bell,
  Zap,
  Info,
  Share2, 
  Smartphone, 
  AlertCircle, 
  AlertTriangle,
  UserCheck,
  Building,
  Phone,
  MapPin,
  MessageSquare,
  Image as ImageIcon,
  Globe,
  Terminal,
  BookOpen,
  Lock,
  Sun,
  Moon
} from 'lucide-react';
import { collection, addDoc, setDoc, onSnapshot, query, orderBy, deleteDoc, doc, Timestamp, serverTimestamp, getDocs, writeBatch } from '@/src/lib/firebase';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { formatSafe } from '../lib/dateUtils';
import ThresholdSettings from './ThresholdSettings';
import WhatsAppWebhookConfig from './WhatsAppWebhookConfig';
import FirebaseSetupHelper from './FirebaseSetupHelper';
import { useTheme } from '../context/ThemeContext';

export default function Settings() {
  const { theme, toggleTheme } = useTheme();
  const [codes, setCodes] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [whatsAppLink, setWhatsAppLink] = useState('');
  const [appName, setAppName] = useState('TaxiControl');
  const [currency, setCurrency] = useState('AOA');
  const [masterPassword, setMasterPassword] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [newRole, setNewRole] = useState<'operator' | 'driver' | 'mecanico' | 'contabilista'>('operator');
  const [assignedId, setAssignedId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // States for corporate multi-tenant registration
  const [registeredTenants, setRegisteredTenants] = useState<any[]>([]);
  const [newTenantName, setNewTenantName] = useState('');
  const [newTenantSlug, setNewTenantSlug] = useState('');
  const [newTenantPhone, setNewTenantPhone] = useState('');
  const [newTenantAddress, setNewTenantAddress] = useState('');
  const [newTenantLogoUrl, setNewTenantLogoUrl] = useState('');
  const [newTenantWhatsappLink, setNewTenantWhatsappLink] = useState('');
  const [newTenantWhatsappGroupLink, setNewTenantWhatsappGroupLink] = useState('');
  const [newTenantWhatsappGroupDrivers, setNewTenantWhatsappGroupDrivers] = useState('');
  const [newTenantWhatsappGroupCustomers, setNewTenantWhatsappGroupCustomers] = useState('');
  const [isCreatingTenant, setIsCreatingTenant] = useState(false);
  const [tenantError, setTenantError] = useState<string | null>(null);
  const [tenantSuccess, setTenantSuccess] = useState<string | null>(null);

  const handleTenantNameChange = (val: string) => {
    setNewTenantName(val);
    const slug = val
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove accent marks
      .replace(/[^a-z0-9]+/g, "-") // replace symbols with dashes
      .replace(/(^-|-$)+/g, ""); // strip leading or trailing dashes
    setNewTenantSlug(slug);
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setTenantError(null);
    setTenantSuccess(null);
    setIsCreatingTenant(true);

    const slug = newTenantSlug.trim().toLowerCase();
    if (!slug) {
      setTenantError("O identificador único (slug) não pode estar vazio.");
      setIsCreatingTenant(false);
      return;
    }

    if (!/^[a-z0-9-]+$/.test(slug)) {
      setTenantError("O slug deve conter apenas letras minúsculas, números e traços.");
      setIsCreatingTenant(false);
      return;
    }

    try {
      const tenantSnap = await getDocs(query(collection(db, 'tenants')));
      const exists = tenantSnap.docs.some(doc => doc.id === slug);
      if (exists) {
        setTenantError(`O identificador "${slug}" já está em uso por outra companhia.`);
        setIsCreatingTenant(false);
        return;
      }

      const formattedPhone = "+244" + newTenantPhone.replace(/\D/g, '');

      await setDoc(doc(db, 'tenants', slug), {
        id: slug,
        name: newTenantName.trim(),
        phone: formattedPhone,
        address: newTenantAddress.trim(),
        logoUrl: newTenantLogoUrl.trim() || '',
        whatsappLink: newTenantWhatsappLink.trim() || '',
        whatsappGroupLink: newTenantWhatsappGroupCustomers.trim() || newTenantWhatsappGroupLink.trim() || '',
        whatsappGroupDrivers: newTenantWhatsappGroupDrivers.trim() || '',
        whatsappGroupCustomers: newTenantWhatsappGroupCustomers.trim() || '',
        createdAt: new Date().toISOString(),
        createdBy: auth.currentUser?.email || 'admin'
      });

      // Boostrap initial settings for this new tenant
      await setDoc(doc(db, 'tenants', slug, 'settings', 'global'), {
        companyName: newTenantName.trim(),
        appName: 'SUPER Taxi - ' + newTenantName.trim().toUpperCase(),
        maintenanceAlerts: true,
        createdAt: new Date().toISOString()
      });

      setTenantSuccess(`A companhia "${newTenantName}" foi registada com sucesso!`);
      setNewTenantName('');
      setNewTenantSlug('');
      setNewTenantPhone('');
      setNewTenantAddress('');
      setNewTenantLogoUrl('');
      setNewTenantWhatsappLink('');
      setNewTenantWhatsappGroupLink('');
      setNewTenantWhatsappGroupDrivers('');
      setNewTenantWhatsappGroupCustomers('');
    } catch (err: any) {
      console.error(err);
      setTenantError("Erro ao registar companhia: " + err.message);
    } finally {
      setIsCreatingTenant(false);
    }
  };

  const deleteTenant = async (id: string, name: string) => {
    if (id === 'psm') {
      alert("A companhia principal 'psm' é obrigatória e não pode ser eliminada.");
      return;
    }
    if (window.confirm(`ATENÇÃO: Deseja apagar permanentemente a companhia "${name}"? Todas as operações associadas a este tenant serão desligadas. Esta ação é irreversível.`)) {
      try {
        await deleteDoc(doc(db, 'tenants', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `tenants/${id}`);
      }
    }
  };

  useEffect(() => {
    const qCodes = query(collection(db, 'access_codes'), orderBy('createdAt', 'desc'));
    const unsubCodes = onSnapshot(qCodes, (snapshot) => {
      setCodes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'access_codes'));

    const qUsers = query(collection(db, 'users'), orderBy('name', 'asc'));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'users'));

    const qTenants = query(collection(db, 'tenants'));
    const unsubTenants = onSnapshot(qTenants, (snapshot) => {
      setRegisteredTenants(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("Error reading tenants:", error));

    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setWhatsAppLink(data.whatsAppLink || '');
        setAppName(data.appName || 'TaxiControl');
        setCurrency(data.currency || 'AOA');
        setMasterPassword(data.masterPassword || 'JIS_PASS_2026');
      }
    });

    return () => {
      unsubCodes();
      unsubUsers();
      unsubTenants();
      unsubSettings();
    };
  }, []);

  const saveGlobalSettings = async () => {
    setIsSavingSettings(true);
    try {
      await setDoc(doc(db, 'settings', 'global'), {
        whatsAppLink: whatsAppLink.trim(),
        appName: appName.trim(),
        currency: currency.trim(),
        masterPassword: masterPassword.trim(),
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.email
      }, { merge: true });
      alert("Configurações guardadas com sucesso!");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings/global');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const generateCode = async () => {
    setIsGenerating(true);
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        if (i === 4) code += '-';
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    try {
      await setDoc(doc(db, 'access_codes', code), {
        code,
        role: newRole,
        assignedId: assignedId.trim() || null,
        used: false,
        createdAt: new Date().toISOString(),
      });
      setAssignedId('');
    } catch (error) {
       handleFirestoreError(error, OperationType.CREATE, 'access_codes');
    } finally {
       setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const deleteCode = async (id: string) => {
    if (window.confirm("Anular este código de acesso?")) {
      try {
        await deleteDoc(doc(db, 'access_codes', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `access_codes/${id}`);
      }
    }
  };

  const deleteUser = async (id: string, name: string) => {
    if (window.confirm(`ATENÇÃO: Deseja remover permanentemente o utilizador "${name}" da equipa? Esta ação não pode ser desfeita.`)) {
      try {
        await deleteDoc(doc(db, 'users', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${id}`);
      }
    }
  };

  const [isClearingGPS, setIsClearingGPS] = useState(false);

  const clearGPSHistory = async () => {
    if (!window.confirm("ATENÇÃO: Esta ação irá apagar TODO o histórico de GPS acumulado. Esta ação é irreversível e afetará a visualização de rotas passadas. Deseja continuar?")) {
      return;
    }

    const secondConfirm = window.prompt("Para confirmar, digite 'APAGAR HISTORICO':");
    if (secondConfirm !== 'APAGAR HISTORICO') return;

    setIsClearingGPS(true);
    try {
      const q = query(collection(db, 'gps_history'));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        alert("O histórico já está vazio.");
        setIsClearingGPS(false);
        return;
      }
      for (let i = 0; i < snapshot.docs.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = snapshot.docs.slice(i, i + 500);
        chunk.forEach(docSnap => batch.delete(docSnap.ref));
        await batch.commit();
      }
      alert(`Sucesso! Histórico eliminado.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'gps_history');
    } finally {
      setIsClearingGPS(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-12">
      <div className="flex items-center justify-between bg-white px-6 py-4 rounded-lg border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Configurações do Sistema</h2>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-widest">Gestão de acessos e segurança</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden h-fit">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
              <Key size={16} className="text-brand-primary" />
              <h3 className="font-bold text-[13px] text-slate-900 uppercase tracking-wider">Gerador de Acessos</h3>
            </div>
            <div className="p-6 space-y-5">
              <div className="space-y-2">
                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Atribuir Função</label>
                 <div className="grid grid-cols-2 gap-2">
                   {['operator', 'driver', 'mecanico', 'contabilista'].map(role => (
                     <button 
                      key={role}
                      onClick={() => setNewRole(role as any)}
                      className={`py-2 text-[11px] font-bold rounded border-2 transition-all ${
                        newRole === role ? 'border-brand-primary bg-blue-50 text-brand-primary' : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                      }`}
                     >
                       {role.toUpperCase()}
                     </button>
                   ))}
                 </div>
               </div>
               <div className="space-y-2">
                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID Personalizado (Opcional)</label>
                 <input 
                   type="text" 
                   value={assignedId}
                   onChange={(e) => setAssignedId(e.target.value.toUpperCase())}
                   className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:bg-white focus:border-brand-primary outline-none"
                 />
               </div>
               <button 
                onClick={generateCode}
                disabled={isGenerating}
                className="w-full bg-slate-900 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50"
               >
                 {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <> <Plus size={18} /> GERAR CÓDIGO</>}
               </button>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-blue-100 overflow-hidden h-fit shadow-sm">
            <div className="px-5 py-4 border-b border-blue-50 bg-blue-50/50 flex items-center gap-2">
              <Database size={16} className="text-blue-600" />
              <h3 className="font-bold text-[13px] text-blue-900 uppercase tracking-wider">Parâmetros Globais</h3>
            </div>
            <div className="p-6 space-y-4">
               <ThresholdSettings />
               <div className="space-y-4 pt-4 border-t border-slate-100">
                 <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome da Aplicação</label>
                   <input type="text" value={appName} onChange={(e) => setAppName(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold focus:bg-white focus:border-blue-500 outline-none" />
                 </div>
                 <div className="space-y-2">
                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Moeda</label>
                     <input type="text" value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold focus:bg-white" />
                   </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Link WhatsApp</label>
                   <input type="text" value={whatsAppLink} onChange={(e) => setWhatsAppLink(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold focus:bg-white focus:border-blue-500 outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Palavra-passe Admin (Área Restrita)</label>
                    <input type="password" value={masterPassword} onChange={(e) => setMasterPassword(e.target.value)} placeholder="Defina a palavra-passe" className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold focus:bg-white focus:border-blue-500 outline-none" />
                  </div>
                </div>
               <button 
                onClick={saveGlobalSettings}
                disabled={isSavingSettings}
                className="w-full bg-slate-900 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-black transition-all"
               >
                 {isSavingSettings ? <Loader2 className="animate-spin" size={18} /> : <><Check size={18} /> GUARDAR</>}
               </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-white/5 overflow-hidden h-fit shadow-sm">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-2">
              <Sun size={16} className="text-brand-primary" />
              <h3 className="font-bold text-[13px] text-slate-900 dark:text-white uppercase tracking-wider">Aparência do Sistema</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Modo Escuro (Dark Mode)</h4>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Ativar ou desativar o tema escuro na interface</p>
                </div>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    theme === 'dark' ? 'bg-brand-primary' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-slate-950 shadow ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                      theme === 'dark' ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  >
                    {theme === 'dark' ? (
                      <Moon size={10} className="text-brand-primary" />
                    ) : (
                      <Sun size={10} className="text-amber-500" />
                    )}
                  </span>
                </button>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-100 dark:border-white/5 flex items-start gap-2.5 text-slate-600 dark:text-slate-400 text-[11px] leading-normal font-medium">
                <Info size={14} className="text-slate-400 dark:text-slate-500 shrink-0 mt-0.5" />
                <p>
                  A preferência de tema é guardada no <code className="bg-slate-200/50 dark:bg-slate-800 px-1 rounded font-bold font-mono">localStorage</code> para que o sistema se lembre da sua escolha ao iniciar.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="lg:col-span-2 bg-white rounded-lg border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-[13px] text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <UserPlus size={16} className="text-slate-400" />
                Convites Pendentes
              </h3>
            </div>
            <div className="overflow-x-auto h-[250px] custom-scrollbar">
              <table className="w-full text-[13px]">
                <tbody className="divide-y divide-slate-100">
                  {codes.filter(c => !c.used).map((item, idx) => (
                    <tr key={`${item.id}-${idx}`} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4">
                        <span className="font-mono font-bold text-slate-900 text-[14px] bg-slate-100 px-2 py-1 rounded tracking-wider">{item.code}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                         <button onClick={() => deleteCode(item.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-4 border-t border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-[13px] text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <UserCheck size={16} className="text-brand-primary" />
                Equipa
              </h3>
            </div>
            <div className="overflow-x-auto h-[250px] custom-scrollbar">
               <table className="w-full text-[13px]">
                  <tbody className="divide-y divide-slate-100">
                    {users.map((u, idx) => (
                      <tr key={`${u.id}-${idx}`} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4">{u.name}</td>
                        <td className="px-6 py-4">{u.role}</td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => deleteUser(u.id, u.name)} className="text-slate-300 hover:text-red-500 transition-colors p-2"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
               </table>
            </div>
        </section>
      </div>

      {/* WhatsApp Cloud API Webhook Integration section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-3">
          <WhatsAppWebhookConfig />
        </div>
      </div>

      {/* SECTOR MULTI-TENANCY / GESTÃO DE COMPANHIAS CORNER */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building size={18} className="text-brand-primary" />
            <div className="text-left">
              <h3 className="font-bold text-[13px] text-slate-900 uppercase tracking-wider">Gestão de Companhias (Multi-Tenant)</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Registo e Monitorização de Filiais Autónomas</p>
            </div>
          </div>
          <span className="font-mono text-[10px] bg-slate-150 text-slate-705 px-2.5 py-1 rounded font-black uppercase tracking-wider">
            {registeredTenants.length} corporações registadas
          </span>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
          {/* Registo de Companhia Form */}
          <div className="lg:col-span-1 bg-slate-50/55 p-5 rounded-xl border border-slate-150 relative">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-1.5">
              <Plus size={14} className="text-brand-primary" />
              Registar Nova Companhia
            </h4>

            {tenantError && (
              <div className="mb-4 bg-red-50 text-red-600 text-[11px] font-bold py-2 px-3 rounded border border-red-100 flex items-center gap-1.5">
                <AlertCircle size={12} />
                {tenantError}
              </div>
            )}

            {tenantSuccess && (
              <div className="mb-4 bg-emerald-50 text-emerald-600 text-[11px] font-bold py-2 px-3 rounded border border-emerald-100 flex items-center gap-1.5">
                <Check size={12} className="text-emerald-500" />
                {tenantSuccess}
              </div>
            )}

            <form onSubmit={handleCreateTenant} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Nome da Companhia</label>
                <input
                  type="text"
                  required
                  value={newTenantName}
                  onChange={(e) => handleTenantNameChange(e.target.value)}
                  placeholder="Ex: Taxi Luena Lda"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Identificador Único (Slug / Link)</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={newTenantSlug}
                    onChange={(e) => setNewTenantSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="ex-slug-companhia"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 transition-all text-blue-600"
                  />
                </div>
                <p className="text-[9px] text-slate-400 leading-tight">Será usado no login dos colaboradores desta filial.</p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Logotipo Personalizado (URL)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTenantLogoUrl}
                    onChange={(e) => setNewTenantLogoUrl(e.target.value)}
                    placeholder="https://exemplo.com/logo.png"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 transition-all"
                  />
                  {newTenantLogoUrl && (
                    <div className="w-9 h-9 border rounded-lg bg-slate-50 flex items-center justify-center shrink-0 p-1">
                      <img 
                        src={newTenantLogoUrl} 
                        alt="Logo preview" 
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/logo.svg';
                        }}
                      />
                    </div>
                  )}
                </div>
                <p className="text-[9px] text-slate-400 leading-tight">Link de imagem .png ou .svg para personalizar o logotipo da filial.</p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Telefone de Contacto</label>
                <div className="relative flex rounded-lg overflow-hidden border border-slate-200 focus-within:border-brand-primary">
                  <span className="bg-slate-100 px-2.5 flex items-center text-xs font-black text-slate-500 border-r border-slate-200">+244</span>
                  <input
                    type="text"
                    required
                    value={newTenantPhone}
                    onChange={(e) => setNewTenantPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="999 999 999"
                    className="w-full px-3 py-2 bg-white text-xs font-bold outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Link do WhatsApp da Filial (Contacto Direto)</label>
                <div className="relative flex rounded-lg overflow-hidden border border-slate-200 focus-within:border-brand-primary">
                  <span className="bg-slate-100 px-3 flex items-center text-xs font-black text-slate-500 border-r border-slate-200">URL</span>
                  <input
                    type="url"
                    value={newTenantWhatsappLink}
                    onChange={(e) => setNewTenantWhatsappLink(e.target.value)}
                    placeholder="https://wa.me/244923456789"
                    className="w-full px-3 py-2 bg-white text-xs font-bold outline-none"
                  />
                </div>
                <p className="text-[9px] text-slate-400 leading-tight">Link direto de WhatsApp para contacto direto dos passageiros.</p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Grupo de WhatsApp (Motoristas - Frota)</label>
                <div className="relative flex rounded-lg overflow-hidden border border-slate-200 focus-within:border-brand-primary">
                  <span className="bg-slate-100 px-3 flex items-center text-xs font-black text-slate-500 border-r border-slate-200">FROTA</span>
                  <input
                    type="url"
                    value={newTenantWhatsappGroupDrivers}
                    onChange={(e) => setNewTenantWhatsappGroupDrivers(e.target.value)}
                    placeholder="https://chat.whatsapp.com/..."
                    className="w-full px-3 py-2 bg-white text-xs font-bold outline-none"
                  />
                </div>
                <p className="text-[9px] text-slate-400 leading-tight">Link de convite do grupo de WhatsApp exclusivo para motoristas e frota.</p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Grupo de WhatsApp (Clientes - Pedidos)</label>
                <div className="relative flex rounded-lg overflow-hidden border border-slate-200 focus-within:border-brand-primary">
                  <span className="bg-slate-100 px-3 flex items-center text-xs font-black text-slate-500 border-r border-slate-200">PEDIDOS</span>
                  <input
                    type="url"
                    value={newTenantWhatsappGroupCustomers}
                    onChange={(e) => setNewTenantWhatsappGroupCustomers(e.target.value)}
                    placeholder="https://chat.whatsapp.com/..."
                    className="w-full px-3 py-2 bg-white text-xs font-bold outline-none"
                  />
                </div>
                <p className="text-[9px] text-slate-400 leading-tight">Link de convite do grupo de WhatsApp para clientes e pedidos.</p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Endereço / Sede</label>
                <textarea
                  required
                  rows={2}
                  value={newTenantAddress}
                  onChange={(e) => setNewTenantAddress(e.target.value)}
                  placeholder="Rua direita do Luena, Bairro Central"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 transition-all resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isCreatingTenant || !newTenantName.trim()}
                className="w-full bg-brand-primary hover:bg-brand-secondary text-white text-xs font-black uppercase py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 active:scale-[0.98]"
              >
                {isCreatingTenant ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <>
                    <Plus size={14} />
                    Registar Companhia
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Companhias Ativas Lista */}
          <div className="lg:col-span-2 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                <Building size={14} className="text-indigo-600" />
                Companhias Ativas Autónomas
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[380px] overflow-y-auto custom-scrollbar pr-2.5">
                {registeredTenants.length === 0 ? (
                  <div className="col-span-2 py-8 text-center text-slate-400 text-xs font-medium">
                    Nenhuma corporação autónoma registada no sistema.
                  </div>
                ) : (
                  registeredTenants.map((t, idx) => (
                    <div 
                      key={`${t.id}-${idx}`} 
                      className="p-4 bg-white border border-slate-200 rounded-xl hover:shadow-md hover:border-slate-300 transition-all relative flex flex-col justify-between text-left"
                    >
                      <div>
                        {/* Header card with name and slug */}
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center p-0.5 border border-slate-100 shrink-0">
                              {t.logoUrl ? (
                                <img 
                                  src={t.logoUrl} 
                                  alt={t.name} 
                                  className="w-full h-full object-contain"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = '/logo.svg';
                                  }}
                                />
                              ) : (
                                <Building size={14} className="text-slate-400" />
                              )}
                            </div>
                            <div className="overflow-hidden">
                              <h5 className="font-bold text-[13px] text-slate-900 uppercase tracking-tight truncate" title={t.name}>{t.name}</h5>
                              <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider block">Filial</span>
                            </div>
                          </div>
                          <span className="font-mono text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase shrink-0">
                            {t.id}
                          </span>
                        </div>

                        {/* Contacts and details */}
                        <div className="mt-3 space-y-1.5 text-slate-500 font-medium text-xs">
                          <div className="flex items-center gap-1.5">
                            <Phone size={11} className="text-slate-400" />
                            <span className="font-bold">{t.phone || 'N/A'}</span>
                          </div>
                          {t.whatsappLink && (
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <MessageSquare size={11} className="text-emerald-500 shrink-0" />
                              <a 
                                href={t.whatsappLink} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-emerald-600 font-bold hover:underline truncate"
                              >
                                WhatsApp Contacto Direto
                              </a>
                            </div>
                          )}
                          {t.whatsappGroupDrivers && (
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <MessageSquare size={11} className="text-blue-500 shrink-0" />
                              <a 
                                href={t.whatsappGroupDrivers} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-blue-600 font-bold hover:underline truncate"
                              >
                                Grupo Motoristas (Frota)
                              </a>
                            </div>
                          )}
                          {(t.whatsappGroupCustomers || t.whatsappGroupLink) && (
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <MessageSquare size={11} className="text-emerald-500 shrink-0" />
                              <a 
                                href={t.whatsappGroupCustomers || t.whatsappGroupLink} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-emerald-600 font-bold hover:underline truncate"
                              >
                                Grupo Clientes (Pedidos)
                              </a>
                            </div>
                          )}
                          <div className="flex items-start gap-1.5">
                            <MapPin size={11} className="text-slate-400 shrink-0 mt-0.5" />
                            <span className="line-clamp-2 text-[11px] leading-tight text-slate-600">{t.address || 'N/A'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Footer card with meta and actions */}
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[9px] text-slate-400 font-mono">
                          Criado por: {t.createdBy?.split('@')[0] || 'admin'}
                        </span>
                        {t.id !== 'psm' ? (
                          <button 
                            onClick={() => deleteTenant(t.id, t.name)}
                            className="text-[10px] text-red-500 hover:text-red-700 font-bold uppercase transition-colors px-1 py-0.5 flex items-center gap-1"
                          >
                            <Trash2 size={12} />
                            Desativar
                          </button>
                        ) : (
                          <span className="text-[9px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-black uppercase">
                            Sede Master
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-blue-50/40 rounded-lg border border-blue-50/80 flex items-start gap-2.5 text-blue-800 text-[11px] leading-normal font-medium">
              <Info size={14} className="text-blue-600 shrink-0 mt-0.5" />
              <p>
                Cada corporação listada acima opera em isolamento completo de dados (Pillar 6 Database Isolation). Nenhum motorista, staff ou relatório de uma filial poderá visualizar ou inteferir nos registos das restantes. O administrador master <strong>José Iweza Suana (JIS)</strong> tem visibilidade global e capacidade de transitar entre as filiais usando o seletor superior de filiais.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* MANUAL DE DEPLOY & CONFIGURAÇÃO SENSORIADA (JIS) */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-brand-primary" />
            <div className="text-left">
              <h3 className="font-bold text-[13px] text-slate-900 uppercase tracking-wider">Manual de Deploy & Sincronização Firebase</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Sincronização de Contas do Colaborador, Domínios e Publicação em Produção</p>
            </div>
          </div>
          <span className="font-mono text-[9px] bg-amber-500/10 text-amber-700 px-2.5 py-1 rounded font-black uppercase tracking-wider animate-pulse flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
            Ambiente de Sincronização Ativa (JIS)
          </span>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
          {/* Col 1: Embedded FirebaseSetupHelper */}
          <div className="lg:col-span-2 flex flex-col">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Lock size={14} className="text-brand-primary" />
              Guia Interativo de Segurança e Domínios Autorizados
            </h4>
            <div className="flex-1">
              <FirebaseSetupHelper isEmbedded={true} />
            </div>
          </div>

          {/* Col 2: Deploy Manual Card */}
          <div className="lg:col-span-1 bg-slate-50/50 p-5 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <Terminal size={14} className="text-slate-700" />
                Manual do Programador & Deploy
              </h4>
              
              <div className="space-y-4 text-xs text-slate-700">
                <p className="leading-relaxed">
                  Para colocar o sistema no ar em <strong className="text-blue-600">sistema-auditado.web.app</strong> ou qualquer domínio público autónomo, execute estes comandos no seu terminal local:
                </p>

                <div className="space-y-3 font-mono text-[11px] bg-slate-950 text-slate-300 p-4 rounded-xl shadow-inner border border-white/5 text-left">
                  <div>
                    <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1"># 1. Puxar atualizações do GitHub</p>
                    <code className="text-emerald-400 font-bold">git pull origin main</code>
                  </div>
                  <div>
                    <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1"># 2. Instalar dependências</p>
                    <code className="text-emerald-400 font-bold">npm install</code>
                  </div>
                  <div>
                    <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1"># 3. Compilar aplicação</p>
                    <code className="text-emerald-400 font-bold">npm run build</code>
                  </div>
                  <div>
                    <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1"># 4. Enviar ao ar (Firebase)</p>
                    <code className="text-amber-400 font-bold">firebase deploy</code>
                  </div>
                </div>

                <div className="p-3 bg-amber-500/10 border border-amber-200/40 rounded-xl space-y-1 text-left">
                  <p className="text-[9px] font-black text-amber-700 uppercase tracking-widest flex items-center gap-1 leading-none">
                    <Info size={11} className="shrink-0 animate-pulse" />
                    Chaves de Produção
                  </p>
                  <p className="text-[10px] text-slate-650 leading-relaxed font-medium">
                    Antes de executar <code className="bg-slate-200/50 px-1 rounded font-bold">npm run build</code>, defina <code className="bg-slate-200/50 px-1 rounded font-bold">GEMINI_API_KEY</code> e <code className="bg-slate-200/50 px-1 rounded font-bold">VITE_GOOGLE_MAPS_API_KEY</code> nas variáveis de ambiente do seu computador ou na consola de alojamento para carregar as rotas de satélite e auditoria da IA.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 text-[10px] text-slate-400 font-bold uppercase tracking-wider space-y-1.5 text-left">
              <div className="flex items-center justify-between">
                <span>Hosting Ativo:</span>
                <span className="font-mono text-slate-600 font-black lowercase">sistema-auditado.web.app</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Base de Dados:</span>
                <span className="font-mono text-slate-600 font-black uppercase">joseiwezasuana-org</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
