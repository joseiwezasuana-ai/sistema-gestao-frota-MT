import React, { useState, useEffect } from 'react';
import { 
  Building, 
  Building2,
  Plus, 
  Trash2, 
  Phone, 
  MapPin, 
  AlertCircle, 
  Check, 
  Loader2, 
  Info,
  ShieldAlert,
  Globe,
  CornerDownRight,
  Edit,
  X,
  ArrowLeft,
  Image as ImageIcon,
  MessageSquare
} from 'lucide-react';
import { collection, setDoc, onSnapshot, query, deleteDoc, doc, getDocs } from '@/src/lib/firebase';
import { db, handleFirestoreError, OperationType, auth, getActiveTenantId, setActiveTenantId } from '../lib/firebase';

interface CompanyManagementProps {
  user: any;
  onBack?: () => void;
}

export default function CompanyManagement({ user, onBack }: CompanyManagementProps) {
  const [registeredTenants, setRegisteredTenants] = useState<any[]>([]);
  const [newTenantName, setNewTenantName] = useState('');
  const [newTenantSlug, setNewTenantSlug] = useState('');
  const [newTenantPhone, setNewTenantPhone] = useState('');
  const [newTenantAddress, setNewTenantAddress] = useState('');
  const [newTenantCountry, setNewTenantCountry] = useState('Angola');
  const [newTenantProvince, setNewTenantProvince] = useState('Moxico');
  const [newTenantLogoUrl, setNewTenantLogoUrl] = useState('');
  const [newTenantWhatsappLink, setNewTenantWhatsappLink] = useState('');
  const [newTenantWhatsappGroupLink, setNewTenantWhatsappGroupLink] = useState('');
  const [newTenantWhatsappGroupDrivers, setNewTenantWhatsappGroupDrivers] = useState('');
  const [newTenantWhatsappGroupCustomers, setNewTenantWhatsappGroupCustomers] = useState('');
  
  // Edit states
  const [isEditing, setIsEditing] = useState(false);
  const [editingTenantId, setEditingTenantId] = useState<string | null>(null);

  const [isCreatingTenant, setIsCreatingTenant] = useState(false);
  const [tenantError, setTenantError] = useState<string | null>(null);
  const [tenantSuccess, setTenantSuccess] = useState<string | null>(null);
  const [activeTenant, setActiveTenant] = useState('');

  useEffect(() => {
    setActiveTenant(getActiveTenantId());

    const qTenants = query(collection(db, 'tenants'));
    const unsubTenants = onSnapshot(qTenants, (snapshot) => {
      setRegisteredTenants(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("Error reading tenants in CompanyManagement:", error));

    return () => unsubTenants();
  }, []);

  const handleTenantNameChange = (val: string) => {
    setNewTenantName(val);
    if (!isEditing) {
      const slug = val
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove accent marks
        .replace(/[^a-z0-9]+/g, "-") // replace symbols with dashes
        .replace(/(^-|-$)+/g, ""); // strip leading/trailing dashes
      setNewTenantSlug(slug);
    }
  };

  const handleStartEdit = (tenant: any) => {
    setIsEditing(true);
    setEditingTenantId(tenant.id);
    setNewTenantName(tenant.name);
    setNewTenantSlug(tenant.id);
    setNewTenantPhone(tenant.phone ? tenant.phone.replace("+244", "") : "");
    setNewTenantAddress(tenant.address || "");
    setNewTenantCountry(tenant.country || "Angola");
    setNewTenantProvince(tenant.province || "Moxico");
    setNewTenantLogoUrl(tenant.logoUrl || "");
    setNewTenantWhatsappLink(tenant.whatsappLink || "");
    setNewTenantWhatsappGroupLink(tenant.whatsappGroupLink || "");
    setNewTenantWhatsappGroupDrivers(tenant.whatsappGroupDrivers || "");
    setNewTenantWhatsappGroupCustomers(tenant.whatsappGroupCustomers || "");
    setTenantError(null);
    setTenantSuccess(null);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingTenantId(null);
    setNewTenantName('');
    setNewTenantSlug('');
    setNewTenantPhone('');
    setNewTenantAddress('');
    setNewTenantCountry('Angola');
    setNewTenantProvince('Moxico');
    setNewTenantLogoUrl('');
    setNewTenantWhatsappLink('');
    setNewTenantWhatsappGroupLink('');
    setNewTenantWhatsappGroupDrivers('');
    setNewTenantWhatsappGroupCustomers('');
    setTenantError(null);
    setTenantSuccess(null);
  };

  const handleSaveTenant = async (e: React.FormEvent) => {
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
      const formattedPhone = newTenantPhone.startsWith("+244")
        ? newTenantPhone
        : "+244" + newTenantPhone.replace(/\D/g, '');

      const tData = {
        id: slug,
        name: newTenantName.trim(),
        phone: formattedPhone,
        address: newTenantAddress.trim(),
        country: newTenantCountry.trim(),
        province: newTenantProvince.trim(),
        logoUrl: newTenantLogoUrl.trim() || '',
        whatsappLink: newTenantWhatsappLink.trim() || '',
        whatsappGroupLink: newTenantWhatsappGroupCustomers.trim() || newTenantWhatsappGroupLink.trim() || '',
        whatsappGroupDrivers: newTenantWhatsappGroupDrivers.trim() || '',
        whatsappGroupCustomers: newTenantWhatsappGroupCustomers.trim() || '',
        updatedAt: new Date().toISOString(),
        updatedBy: auth.currentUser?.email || 'admin'
      };

      if (isEditing && editingTenantId) {
        // If they modified the slug ID
        if (slug !== editingTenantId) {
          if (editingTenantId === 'psm') {
            setTenantError("A sede principal 'psm' não pode mudar de identificador.");
            setIsCreatingTenant(false);
            return;
          }

          const tenantSnap = await getDocs(query(collection(db, 'tenants')));
          const keyInUse = tenantSnap.docs.some(doc => doc.id === slug);
          if (keyInUse) {
            setTenantError(`O identificador "${slug}" já está em uso.`);
            setIsCreatingTenant(false);
            return;
          }

          // Migrate: write new document with new slug ID
          await setDoc(doc(db, 'tenants', slug), {
            ...tData,
            createdAt: new Date().toISOString()
          });

          // Delete the old slug document
          await deleteDoc(doc(db, 'tenants', editingTenantId));

          // Switch active tenant in localStorage if they edited the currently active one
          if (getActiveTenantId() === editingTenantId) {
            setActiveTenantId(slug);
            setActiveTenant(slug);
          }
        } else {
          // Normal edit
          await setDoc(doc(db, 'tenants', slug), tData, { merge: true });
        }

        setTenantSuccess(`A companhia "${newTenantName}" foi atualizada com sucesso!`);
      } else {
        // Create new company
        const tenantSnap = await getDocs(query(collection(db, 'tenants')));
        const exists = tenantSnap.docs.some(doc => doc.id === slug);
        if (exists) {
          setTenantError(`O identificador "${slug}" já está em uso por outra companhia.`);
          setIsCreatingTenant(false);
          return;
        }

        // Step 1: Create tenant document
        await setDoc(doc(db, 'tenants', slug), {
          ...tData,
          createdAt: new Date().toISOString(),
          createdBy: auth.currentUser?.email || 'admin'
        });

        // Step 2: Bootstrap global tenant settings
        await setDoc(doc(db, 'tenants', slug, 'settings', 'global'), {
          companyName: newTenantName.trim(),
          appName: 'SUPER Taxi - ' + newTenantName.trim().toUpperCase(),
          maintenanceAlerts: true,
          createdAt: new Date().toISOString()
        });

        setTenantSuccess(`A companhia "${newTenantName}" foi registada com sucesso!`);
      }

      // Reset form on success
      setNewTenantName('');
      setNewTenantSlug('');
      setNewTenantPhone('');
      setNewTenantAddress('');
      setNewTenantCountry('Angola');
      setNewTenantProvince('Moxico');
      setNewTenantLogoUrl('');
      setNewTenantWhatsappLink('');
      setNewTenantWhatsappGroupLink('');
      setNewTenantWhatsappGroupDrivers('');
      setNewTenantWhatsappGroupCustomers('');
      setIsEditing(false);
      setEditingTenantId(null);
    } catch (err: any) {
      console.error(err);
      setTenantError("Erro ao guardar companhia: " + err.message);
    } finally {
      setIsCreatingTenant(false);
    }
  };

  const deleteTenant = async (id: string, name: string) => {
    if (id === 'psm') {
      alert("A companhia principal 'psm' é obrigatória e não pode ser eliminada.");
      return;
    }
    if (window.confirm(`ATENÇÃO CRÍTICA: Deseja apagar permanentemente a companhia "${name}"? Todas as frotas, motoristas e rendas associadas a este tenant serão desligadas permanentemente. Esta ação não pode ser desfeita.`)) {
      try {
        await deleteDoc(doc(db, 'tenants', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `tenants/${id}`);
      }
    }
  };

  const handleSwitchTenant = (tenantId: string) => {
    setActiveTenantId(tenantId);
    setActiveTenant(tenantId);
    window.location.reload();
  };

  const isMasterAdmin = user?.email?.toLowerCase() === 'joseiwezasuana@gmail.com';
  const psmBranch = registeredTenants.find(t => t.id === 'psm');
  const otherBranches = registeredTenants.filter(t => t.id !== 'psm');

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto pb-12">
      {/* Upper informational bar */}
      <div className="bg-[#0f172a] rounded-2xl p-5 sm:p-6 text-white relative overflow-hidden shadow-xl border border-slate-800">
        <div className="absolute right-0 top-0 h-48 w-48 bg-brand-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="text-left flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-brand-primary/15 border border-brand-primary/30 flex items-center justify-center text-brand-primary shrink-0 shadow-inner">
              <Building2 size={24} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="text-[9px] bg-brand-primary text-slate-950 font-black uppercase px-2.5 py-0.5 rounded-md tracking-wider">
                  Módulo Multi-Tenant Autónomo
                </span>
                <span className="text-[9px] bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30 px-2 py-0.5 rounded-md uppercase tracking-wider">
                  Pillar 6 Database Isolation
                </span>
                <span className="text-[9px] bg-white/10 text-slate-300 font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                  JIS ANGOLA
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-black uppercase tracking-tight text-white">
                Gestão de Companhias & Filiais
              </h1>
              <p className="text-xs text-slate-400 font-medium mt-0.5 max-w-2xl leading-relaxed">
                Olá, <strong className="text-brand-primary font-bold">José Iweza Suana (JIS)</strong>. Crie, personalize e administre entidades estanques e autónomas para as frotas de Táxi de Luena-Moxico.
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 self-start lg:self-center shrink-0">
            {isMasterAdmin && (
              <div className="flex items-center gap-3 px-3.5 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl shadow-sm">
                <Building size={16} className="text-brand-primary shrink-0" />
                <div className="flex flex-col text-left">
                  <span className="text-[8.5px] font-black uppercase text-slate-400 tracking-wider">Entidade Ativa</span>
                  <select 
                    value={activeTenant}
                    onChange={(e) => handleSwitchTenant(e.target.value)}
                    className="bg-transparent text-xs font-bold uppercase text-white outline-none ring-0 border-none cursor-pointer mt-0.5 pr-4"
                  >
                    {registeredTenants.map(t => (
                      <option key={t.id} value={t.id} className="bg-slate-900 text-white font-bold uppercase">{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {onBack && (
              <button 
                type="button"
                onClick={onBack}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all font-black text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer active:scale-95 border border-white/15 shadow-sm"
              >
                <ArrowLeft size={15} className="text-brand-primary" />
                <span>Voltar ao Início</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left items-start">
        {/* Registration & Edit form */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 flex flex-col h-fit shadow-sm border border-slate-100 dark:border-slate-800 lg:sticky lg:top-4 max-h-[calc(100vh-2rem)] overflow-y-auto custom-scrollbar">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                {isEditing ? <Edit size={18} className="text-blue-500" /> : <Plus size={18} className="text-brand-primary" />}
                <h2 className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-widest">
                  {isEditing ? 'Editar Companhia' : 'Registar Nova Companhia'}
                </h2>
              </div>
              {isEditing && (
                <button 
                  onClick={handleCancelEdit}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-md hover:bg-slate-105"
                  title="Anular Edição"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {tenantError && (
              <div className="mb-4 bg-red-50 text-red-600 text-[11px] font-bold py-2.5 px-3 rounded-lg border border-red-100 flex items-center gap-1.5">
                <AlertCircle size={14} className="shrink-0" />
                {tenantError}
              </div>
            )}

            {tenantSuccess && (
              <div className="mb-4 bg-emerald-50 text-emerald-600 text-[11px] font-bold py-2.5 px-3 rounded-lg border border-emerald-100 flex items-center gap-1.5 animate-bounce">
                <Check size={14} className="text-emerald-500 shrink-0" />
                {tenantSuccess}
              </div>
            )}

            <form onSubmit={handleSaveTenant} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Nome da Companhia</label>
                <input
                  type="text"
                  required
                  value={newTenantName}
                  onChange={(e) => handleTenantNameChange(e.target.value)}
                  placeholder="Ex: PSM Comercial Filial Luena"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:bg-white focus:border-brand-primary transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:focus:bg-slate-900/50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Identificador Único (Slug / Link)</label>
                <input
                  type="text"
                  required
                  value={newTenantSlug}
                  onChange={(e) => setNewTenantSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="ex-slug-companhia"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold outline-none focus:bg-white focus:border-brand-primary transition-all text-blue-600 dark:bg-slate-800 dark:border-slate-700 dark:focus:bg-slate-900/50"
                />
                <p className="text-[9px] text-slate-400 leading-tight">Este identificador define a estanquicidade da base de dados e os links desta filial.</p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Logotipo Personalizado (URL)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTenantLogoUrl}
                    onChange={(e) => setNewTenantLogoUrl(e.target.value)}
                    placeholder="https://exemplo.com/logo.png"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono outline-none focus:bg-white focus:border-brand-primary transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:focus:bg-slate-900/50"
                  />
                  {newTenantLogoUrl && (
                    <div className="w-9 h-9 border rounded-lg bg-teal-50 flex items-center justify-center shrink-0 p-1">
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
                <p className="text-[9px] text-slate-400 leading-tight">Introduza o link de uma imagem .png ou .svg para substituir o logotipo do sistema para esta filial.</p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Telefone de Contacto (PT)</label>
                <div className="relative flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 focus-within:border-brand-primary bg-slate-50 dark:bg-slate-800">
                  <span className="bg-slate-100 dark:bg-slate-700 px-3 flex items-center text-xs font-black text-slate-500 dark:text-slate-300 border-r border-slate-200 dark:border-slate-600">+244</span>
                  <input
                    type="text"
                    required
                    value={newTenantPhone}
                    onChange={(e) => setNewTenantPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="999 999 999"
                    className="w-full px-3 py-2 text-xs font-bold outline-none bg-transparent dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Link do WhatsApp da Filial (Contacto Direto)</label>
                <div className="relative flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 focus-within:border-brand-primary bg-slate-50 dark:bg-slate-800">
                  <span className="bg-slate-100 dark:bg-slate-700 px-3 flex items-center text-xs font-black text-slate-500 dark:text-slate-300 border-r border-slate-200 dark:border-slate-600">URL</span>
                  <input
                    type="url"
                    value={newTenantWhatsappLink}
                    onChange={(e) => setNewTenantWhatsappLink(e.target.value)}
                    placeholder="https://wa.me/244923456789"
                    className="w-full px-3 py-2 text-xs font-bold outline-none bg-transparent dark:text-white"
                  />
                </div>
                <p className="text-[9px] text-slate-400 leading-tight">Link direto do WhatsApp de apoio ao cliente (ex: https://wa.me/244923456789) para os passageiros contactarem.</p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Grupo de WhatsApp (Motoristas - Frota)</label>
                <div className="relative flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 focus-within:border-brand-primary bg-slate-50 dark:bg-slate-800">
                  <span className="bg-slate-100 dark:bg-slate-700 px-3 flex items-center text-xs font-black text-slate-500 dark:text-slate-300 border-r border-slate-200 dark:border-slate-600">FROTA</span>
                  <input
                    type="url"
                    value={newTenantWhatsappGroupDrivers}
                    onChange={(e) => setNewTenantWhatsappGroupDrivers(e.target.value)}
                    placeholder="https://chat.whatsapp.com/..."
                    className="w-full px-3 py-2 text-xs font-bold outline-none bg-transparent dark:text-white"
                  />
                </div>
                <p className="text-[9px] text-slate-400 leading-tight">Link de convite do grupo de WhatsApp para os Motoristas (Frota) desta filial.</p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Grupo de WhatsApp (Clientes - Pedidos)</label>
                <div className="relative flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 focus-within:border-brand-primary bg-slate-50 dark:bg-slate-800">
                  <span className="bg-slate-100 dark:bg-slate-700 px-3 flex items-center text-xs font-black text-slate-500 dark:text-slate-300 border-r border-slate-200 dark:border-slate-600">PEDIDOS</span>
                  <input
                    type="url"
                    value={newTenantWhatsappGroupCustomers}
                    onChange={(e) => setNewTenantWhatsappGroupCustomers(e.target.value)}
                    placeholder="https://chat.whatsapp.com/..."
                    className="w-full px-3 py-2 text-xs font-bold outline-none bg-transparent dark:text-white"
                  />
                </div>
                <p className="text-[9px] text-slate-400 leading-tight">Link de convite do grupo de WhatsApp para os Clientes (Pedidos) desta filial.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">País</label>
                  <input
                    type="text"
                    required
                    value={newTenantCountry}
                    onChange={(e) => setNewTenantCountry(e.target.value)}
                    placeholder="Ex: Angola"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:bg-white focus:border-brand-primary transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:focus:bg-slate-900/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Província / Estado</label>
                  <select
                    required
                    value={newTenantProvince}
                    onChange={(e) => setNewTenantProvince(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:bg-white focus:border-brand-primary transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:focus:bg-slate-900/50"
                  >
                    <option value="Bengo">Bengo</option>
                    <option value="Benguela">Benguela</option>
                    <option value="Bié">Bié</option>
                    <option value="Cabinda">Cabinda</option>
                    <option value="Cuanza Norte">Cuanza Norte</option>
                    <option value="Cuanza Sul">Cuanza Sul</option>
                    <option value="Cubango">Cubango</option>
                    <option value="Cunene">Cunene</option>
                    <option value="Huambo">Huambo</option>
                    <option value="Huíla">Huíla</option>
                    <option value="Icolo e Bengo">Icolo e Bengo</option>
                    <option value="Luanda">Luanda</option>
                    <option value="Lunda Norte">Lunda Norte</option>
                    <option value="Lunda Sul">Lunda Sul</option>
                    <option value="Malanje">Malanje</option>
                    <option value="Moxico">Moxico (Luena)</option>
                    <option value="Moxico-Leste">Moxico-Leste (Cazombo)</option>
                    <option value="Namibe">Namibe</option>
                    <option value="Quando Cubango">Quando Cubango</option>
                    <option value="Uíge">Uíge</option>
                    <option value="Zaire">Zaire</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Endereço / Sede</label>
                <textarea
                  required
                  rows={3}
                  value={newTenantAddress}
                  onChange={(e) => setNewTenantAddress(e.target.value)}
                  placeholder="Rua direita do Luena, Bairro do Alto Luso"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:bg-white focus:border-brand-primary transition-all resize-none dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:focus:bg-slate-900/50"
                />
              </div>

              <div className="flex gap-2">
                {isEditing && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="w-1/3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-black uppercase py-3 rounded-lg flex items-center justify-center transition-all"
                  >
                    Anular
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isCreatingTenant || !newTenantName.trim()}
                  className={`flex-1 text-white text-xs font-black uppercase py-3 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 active:scale-[0.98] ${isEditing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-brand-primary hover:bg-brand-secondary'}`}
                >
                  {isCreatingTenant ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <>
                      {isEditing ? <Check size={14} /> : <Plus size={14} />}
                      {isEditing ? 'Guardar Alterações' : 'Registar Companhia'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* List of companies */}
        <div className="lg:col-span-2 flex flex-col justify-between avatar-list">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 min-h-[450px]">
            <div className="flex items-center justify-between mb-6 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Building size={18} className="text-indigo-600" />
                <h2 className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-widest">Filiais e Companhias Registadas</h2>
              </div>
              <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded font-black uppercase tracking-wider">
                {registeredTenants.length} corporações
              </span>
            </div>

            <div className="space-y-6">
              {/* 1. SEPARATED FILIAL SEDE PRINCIPAL (PSM) */}
              {psmBranch ? (
                <div className="p-4 bg-indigo-50/20 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl">
                  <div className="flex items-center gap-1.5 mb-3 px-1">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </span>
                    <p className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">
                      Filial Sede Principal (PSM Comercial)
                    </p>
                  </div>
                  
                  <div 
                    className={`p-5 bg-slate-50 dark:bg-slate-850 rounded-2xl transition-all relative flex flex-col justify-between text-left ${psmBranch.id === activeTenant ? 'ring-2 ring-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/25' : ''}`}
                  >
                    <div>
                      {/* Brand Label Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center p-1 border border-slate-200 dark:border-slate-700 shrink-0">
                            {psmBranch.logoUrl ? (
                              <img 
                                src={psmBranch.logoUrl} 
                                alt={psmBranch.name} 
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = '/logo.svg';
                                }}
                              />
                            ) : (
                              <Building size={18} className="text-slate-400 dark:text-slate-500" />
                            )}
                          </div>
                          <div className="overflow-hidden">
                            <h3 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-tight leading-snug truncate" title={psmBranch.name}>{psmBranch.name}</h3>
                            <span className="text-[9px] text-indigo-500 font-bold block uppercase tracking-wider mt-0.5">Filial Base / Principal</span>
                          </div>
                        </div>
                        <span className="font-mono text-[9px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded uppercase self-start">
                          {psmBranch.id}
                        </span>
                      </div>

                      {/* Details Area */}
                      <div className="mt-4 space-y-2 text-slate-500 dark:text-slate-400 font-medium text-xs">
                        <div className="flex items-center gap-2">
                          <Phone size={12} className="text-slate-400 shrink-0" />
                          <span className="font-bold">{psmBranch.phone || 'N/A'}</span>
                        </div>
                        {psmBranch.whatsappLink && (
                          <div className="flex items-center gap-2">
                            <MessageSquare size={12} className="text-emerald-500 shrink-0" />
                            <a 
                              href={psmBranch.whatsappLink} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline truncate text-[11px]"
                            >
                              WhatsApp Contacto Direto
                            </a>
                          </div>
                        )}
                        {psmBranch.whatsappGroupDrivers && (
                          <div className="flex items-center gap-2">
                            <MessageSquare size={12} className="text-blue-500 shrink-0" />
                            <a 
                              href={psmBranch.whatsappGroupDrivers} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-blue-600 dark:text-blue-400 font-bold hover:underline truncate text-[11px]"
                            >
                              Grupo Motoristas (Frota)
                            </a>
                          </div>
                        )}
                        {(psmBranch.whatsappGroupCustomers || psmBranch.whatsappGroupLink) && (
                          <div className="flex items-center gap-2">
                            <MessageSquare size={12} className="text-emerald-500 shrink-0" />
                            <a 
                              href={psmBranch.whatsappGroupCustomers || psmBranch.whatsappGroupLink} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline truncate text-[11px]"
                            >
                              Grupo Clientes (Pedidos)
                            </a>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Globe size={12} className="text-indigo-400 shrink-0" />
                          <span className="font-bold text-[11px] text-slate-600 dark:text-slate-300">
                            {psmBranch.province || 'Moxico'}, {psmBranch.country || 'Angola'}
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <MapPin size={12} className="text-slate-400 shrink-0 mt-0.5" />
                          <span className="text-[11px] leading-tight text-slate-600 dark:text-slate-300 line-clamp-2">{psmBranch.address || 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Footer / Actions */}
                    <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Globe size={11} className="text-slate-400 shrink-0" />
                        <span className="text-[9px] text-slate-400 font-mono truncate max-w-[120px]">
                          Criado por: {psmBranch.createdBy?.split('@')[0] || 'admin'}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1.5 shrink-0">
                        {psmBranch.id !== activeTenant && (
                          <button 
                            onClick={() => handleSwitchTenant(psmBranch.id)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-md tracking-wider transition-all"
                          >
                            Ativar
                          </button>
                        )}

                        <button
                          onClick={() => handleStartEdit(psmBranch)}
                          className="text-[10px] text-blue-650 dark:text-blue-400 font-bold uppercase transition-colors px-1.5 py-1 flex items-center gap-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/10"
                        >
                          <Edit size={11} />
                          Editar
                        </button>

                        <span className="text-[9px] text-indigo-700 dark:text-indigo-400 bg-indigo-100/50 dark:bg-indigo-900/30 px-2 py-0.5 rounded font-black uppercase tracking-wider shrink-0">
                          Filial Sede
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-yellow-50 text-yellow-800 text-xs font-semibold rounded-xl border border-yellow-105">
                  Aviso: A filial padrão 'psm' não foi detetada no sistema. Crie-a utilizando o formulário de registo.
                </div>
              )}

              {/* 2. OTHER INDEPENDENT BRANCHES SECTION */}
              <div className="pt-2">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2.5 px-1">
                  Outras Filiais / Empresas Operacionais Autónomas ({otherBranches.length})
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {otherBranches.length === 0 ? (
                    <div className="col-span-2 py-8 text-center text-slate-400 text-xs font-medium bg-slate-50 dark:bg-slate-850/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                      Nenhuma outra filial autónoma registada. Use o painel à esquerda para registar filiais adicionais.
                    </div>
                  ) : (
                    otherBranches.map((t) => (
                      <div 
                        key={t.id} 
                        className={`p-5 bg-slate-50 dark:bg-slate-850 rounded-2xl transition-all relative flex flex-col justify-between text-left ${t.id === activeTenant ? 'ring-2 ring-brand-primary bg-brand-primary/5 dark:bg-brand-primary/10' : ''}`}
                      >
                        <div>
                          {/* Brand Label Header */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center p-1 border border-slate-200 dark:border-slate-700 shrink-0">
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
                                  <Building size={18} className="text-slate-400 dark:text-slate-500" />
                                )}
                              </div>
                              <div className="overflow-hidden">
                                <h3 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-tight leading-snug truncate" title={t.name}>{t.name}</h3>
                                <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider mt-0.5">Filial Autónoma</span>
                              </div>
                            </div>
                            <span className="font-mono text-[9px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded uppercase self-start">
                              {t.id}
                            </span>
                          </div>

                          {/* Details Area */}
                          <div className="mt-4 space-y-2 text-slate-500 dark:text-slate-400 font-medium text-xs">
                            <div className="flex items-center gap-2">
                              <Phone size={12} className="text-slate-400 shrink-0" />
                              <span className="font-bold">{t.phone || 'N/A'}</span>
                            </div>
                            {t.whatsappLink && (
                              <div className="flex items-center gap-2">
                                <MessageSquare size={12} className="text-emerald-500 shrink-0" />
                                <a 
                                  href={t.whatsappLink} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline truncate text-[11px]"
                                >
                                  WhatsApp Contacto Direto
                                </a>
                              </div>
                            )}
                            {t.whatsappGroupDrivers && (
                              <div className="flex items-center gap-2">
                                <MessageSquare size={12} className="text-blue-500 shrink-0" />
                                <a 
                                  href={t.whatsappGroupDrivers} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-blue-600 dark:text-blue-400 font-bold hover:underline truncate text-[11px]"
                                >
                                  Grupo Motoristas (Frota)
                                </a>
                              </div>
                            )}
                            {(t.whatsappGroupCustomers || t.whatsappGroupLink) && (
                              <div className="flex items-center gap-2">
                                <MessageSquare size={12} className="text-emerald-500 shrink-0" />
                                <a 
                                  href={t.whatsappGroupCustomers || t.whatsappGroupLink} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline truncate text-[11px]"
                                >
                                  Grupo Clientes (Pedidos)
                                </a>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <Globe size={12} className="text-blue-400 shrink-0" />
                              <span className="font-bold text-[11px] text-slate-600 dark:text-slate-300">
                                {t.province || 'Moxico'}, {t.country || 'Angola'}
                              </span>
                            </div>
                            <div className="flex items-start gap-2">
                              <MapPin size={12} className="text-slate-400 shrink-0 mt-0.5" />
                              <span className="text-[11px] leading-tight text-slate-600 dark:text-slate-300 line-clamp-2">{t.address || 'N/A'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Footer / Actions */}
                        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <Globe size={11} className="text-slate-400 shrink-0" />
                            <span className="text-[9px] text-slate-400 font-mono truncate max-w-[100px]">
                              Criado por: {t.createdBy?.split('@')[0] || 'admin'}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1.5 shrink-0">
                            {t.id !== activeTenant && (
                              <button 
                                onClick={() => handleSwitchTenant(t.id)}
                                className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-slate-200 text-[10px] font-black uppercase px-2 py-1 rounded-md tracking-wider transition-all"
                              >
                                Ativar
                              </button>
                            )}

                            <button
                              onClick={() => handleStartEdit(t)}
                              className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase transition-colors px-1.5 py-1 flex items-center gap-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/10"
                            >
                              <Edit size={11} />
                              Editar
                            </button>

                            <button 
                              onClick={() => deleteTenant(t.id, t.name)}
                              className="text-[10px] text-red-500 hover:text-red-700 font-bold uppercase transition-colors px-1.5 py-1 flex items-center gap-0.5 rounded hover:bg-red-50 dark:hover:bg-red-950/20"
                            >
                              <Trash2 size={11} />
                              Apagar
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/20 flex items-start gap-3 text-indigo-900 dark:text-indigo-200 text-[12px] leading-normal font-medium text-left">
            <ShieldAlert size={16} className="text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold uppercase text-[10px] tracking-wider text-indigo-700 dark:text-indigo-400 mb-1">Nota de Segurança e Isolamento</p>
              <p>
                Cada corporação listada opera em isolamento total de dados no Firestore. O gestor Master <strong className="font-black">José Iweza Suana (JIS)</strong> tem visibilidade global e controlo total. Para alternar entre as filiais e operar sobre as frotas de cada uma, selecione a filial pretendida no menu superior ou clique em "Ativar" acima.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
