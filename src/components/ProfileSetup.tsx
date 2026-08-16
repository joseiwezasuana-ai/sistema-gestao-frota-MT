import React, { useState, useEffect } from 'react';
import { User, Shield, ArrowRight, Loader2, Key, AlertCircle, ChevronRight, CheckCircle2, ShieldCheck, LogOut, Mail, Building, Plus, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs, orderBy } from '../lib/firebase';
import { db, auth, handleFirestoreError, OperationType, withTimeout, getActiveTenantId, setActiveTenantId } from '../lib/firebase';
import { signOut } from 'firebase/auth';

interface ProfileSetupProps {
  user: any;
  onComplete: (profile: any) => void;
}

export default function ProfileSetup({ user, onComplete }: ProfileSetupProps) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('operator');
  const [id, setId] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tenant related state
  const [tenantMode, setTenantMode] = useState<'join' | 'create'>('join');
  const [tempTenantId, setTempTenantId] = useState('psm'); // prefilled default
  const [newTenantId, setNewTenantId] = useState('');
  const [newTenantName, setNewTenantName] = useState('');
  const [verifiedTenantId, setVerifiedTenantId] = useState('');
  const [tenantsList, setTenantsList] = useState<{ id: string, name: string }[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(false);
  
  const isAdminEmail = user.email?.toLowerCase() === 'joseiwezasuana@gmail.com';
  const [isCodeValidated, setIsCodeValidated] = useState(isAdminEmail);
  const [collaborators, setCollaborators] = useState<{ id: string, name: string }[]>([]);
  const [collaboratorsLoading, setCollaboratorsLoading] = useState(false);
  const [validationRole, setValidationRole] = useState<string | null>(isAdminEmail ? 'admin' : null);

  const handleLogout = () => {
    window.dispatchEvent(new CustomEvent('jis-request-logout'));
  };

  // Fetch available tenants globally
  useEffect(() => {
    const fetchTenants = async () => {
      setTenantsLoading(true);
      try {
        const snap = await getDocs(collection(db, 'tenants'));
        const list = snap.docs.map(doc => ({ id: doc.id, name: doc.data().name || doc.id }));
        setTenantsList(list);
      } catch (err) {
        console.error("Error fetching tenants:", err);
      } finally {
        setTenantsLoading(false);
      }
    };
    fetchTenants();
  }, []);

  // Fetch registered collaborators under selected Tenant (Staff & Drivers)
  useEffect(() => {
    // Hidden until code is validated for everyone
    if (!isCodeValidated || !validationRole) {
      setCollaborators([]);
      return;
    }

    const fetchCollaborators = async () => {
      setCollaboratorsLoading(true);
      try {
        let results: { id: string, name: string }[] = [];

        if (validationRole === 'admin' || validationRole === 'gerente' || validationRole === 'operator' || validationRole === 'contabilista' || validationRole === 'mecanico') {
          const staffQuery = query(
            collection(db, 'administrative_staff'), 
            where('status', '==', 'Ativo')
          );
          const staffSnap = await withTimeout(getDocs(staffQuery));
          results = staffSnap.docs
            .filter(doc => doc.data().name)
            .map(doc => ({ id: doc.id, name: doc.data().name }));
        } else if (validationRole === 'driver') {
          const driversQuery = query(
            collection(db, 'drivers_master'), 
            where('status', '==', 'Ativo')
          );
          const driversSnap = await withTimeout(getDocs(driversQuery));
          results = driversSnap.docs
            .filter(doc => doc.data().name)
            .map(doc => ({ id: doc.id, name: doc.data().name }));
        }
        
        results.sort((a, b) => a.name.localeCompare(b.name));
        setCollaborators(results);
      } catch (err) {
        console.error("Error fetching collaborators:", err);
      } finally {
        setCollaboratorsLoading(false);
      }
    };

    fetchCollaborators();
  }, [isCodeValidated, validationRole]);


  const handleVerifyCode = async () => {
    if (!tempTenantId.trim()) {
      setError("Introduza o ID da Empresa (Tenant) que pretende aderir.");
      return;
    }
    if (!accessCode.trim() || !id.trim()) {
      setError("Insira o seu ID do Colaborador e o Código de Acesso.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const cleanTenantId = tempTenantId.trim().toLowerCase();

    try {
      // 1. Verify tenant exists
      const tenantSnap = await getDoc(doc(db, 'tenants', cleanTenantId));
      if (!tenantSnap.exists() && cleanTenantId !== 'psm') {
        throw new Error(`Empresa/Tenant "${cleanTenantId}" não existe. Verifique o ID.`);
      }

      // If default 'psm' doesn't exist yet, we will bootstrap it below
      if (!tenantSnap.exists() && cleanTenantId === 'psm') {
        // Bootstrap PSM Tenant
        await setDoc(doc(db, 'tenants', 'psm'), {
          id: 'psm',
          name: 'PSM COMERCIAL LUENA MOXICO',
          createdAt: new Date().toISOString()
        });
      }

      // 2. Temporarily set active tenant ID so collections are correctly scoped
      setActiveTenantId(cleanTenantId);

      // 3. Query the access code of that tenant!
      const q = query(
        collection(db, 'access_codes'), 
        where('code', '==', accessCode.trim().toUpperCase()),
        where('used', '==', false)
      );
      const querySnapshot = await withTimeout(getDocs(q));

      if (!querySnapshot || querySnapshot.empty || !Array.isArray(querySnapshot.docs) || querySnapshot.docs.length === 0) {
        throw new Error("Código de acesso inválido ou já utilizado nesta empresa.");
      }

      const codeDoc = querySnapshot.docs[0];
      const codeData = codeDoc.data();

      // Check case-insensitive assignedId matching (if set in database)
      if (codeData.assignedId && codeData.assignedId.trim()) {
        const expectedId = codeData.assignedId.trim().toUpperCase();
        const inputId = id.trim().toUpperCase();
        if (expectedId !== inputId) {
          throw new Error(`O ID do Colaborador (${inputId}) não corresponde ao ID autorizado para este Código (${expectedId}).`);
        }
      }
      
      setVerifiedTenantId(cleanTenantId);
      setValidationRole(codeData.role);
      setIsCodeValidated(true);
      setName(''); // Reset name selection after validation
    } catch (err: any) {
      setError(err.message);
      // Reset active tenant in case of error
      setActiveTenantId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenantId.trim() || !newTenantName.trim()) {
      setError("Por favor, preencha todos os campos da empresa.");
      return;
    }

    const cleanTenantId = newTenantId.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(cleanTenantId)) {
      setError("O ID da Empresa deve conter apenas letras minúsculas, números e traços (-) sem espaços.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Check if tenant already exists globally
      const tenantSnap = await getDoc(doc(db, 'tenants', cleanTenantId));
      if (tenantSnap.exists()) {
        throw new Error("Este ID de Empresa já está registado. Escolha outro ID.");
      }

      // 1. Create Tenant globally
      await setDoc(doc(db, 'tenants', cleanTenantId), {
        id: cleanTenantId,
        name: newTenantName,
        createdAt: new Date().toISOString(),
        createdBy: user.uid,
        ownerEmail: user.email
      });

      // 2. Set Active Tenant
      setActiveTenantId(cleanTenantId);

      // 3. Pre-create Tenant Settings
      await setDoc(doc(db, 'settings', 'global'), {
        companyName: newTenantName,
        appName: 'SUPER Taxi - ' + newTenantName.toUpperCase(),
        maintenanceAlerts: true,
        createdAt: new Date().toISOString()
      });

      // 4. Create master profile
      const newProfile = {
        uid: user.uid,
        email: user.email || '',
        name: user.displayName || user.email?.split('@')[0] || 'Gestor Admin',
        role: 'admin',
        tenantId: cleanTenantId,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', user.uid), newProfile);
      onComplete(newProfile);
    } catch (err: any) {
      setError(err.message);
      setActiveTenantId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const path = `users/${user.uid}`;
    try {
      let finalRole = role;
      let finalTenantId = isAdminEmail ? 'psm' : verifiedTenantId;

      if (isAdminEmail) {
        // Master admin bootstrapping PSM tenant
        const psmSnap = await getDoc(doc(db, 'tenants', 'psm'));
        if (!psmSnap.exists()) {
          await setDoc(doc(db, 'tenants', 'psm'), {
            id: 'psm',
            name: 'PSM COMERCIAL LUENA MOXICO',
            createdAt: new Date().toISOString()
          });
        }
        setActiveTenantId('psm');
      } else {
        // Standard user double-check access code under selected tenant
        const q = query(
          collection(db, 'access_codes'), 
          where('code', '==', accessCode.trim().toUpperCase()), 
          where('used', '==', false)
        );
        
        let codeSnap;
        try {
          codeSnap = await withTimeout(getDocs(q));
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, 'access_codes');
          return;
        }

        if (!codeSnap || codeSnap.empty || !Array.isArray(codeSnap.docs) || codeSnap.docs.length === 0) {
          setError('Código de acesso inválido ou já utilizado.');
          setIsSubmitting(false);
          return;
        }

        const codeDoc = codeSnap.docs[0];
        const codeData = codeDoc.data();
        const codeRef = codeDoc.ref;

        // Check case-insensitive assignedId matching (if set in database)
        if (codeData.assignedId && codeData.assignedId.trim()) {
          const expectedId = codeData.assignedId.trim().toUpperCase();
          const inputId = id.trim().toUpperCase();
          if (expectedId !== inputId) {
            setError(`O ID do Colaborador (${inputId}) não corresponde ao ID autorizado para este Código (${expectedId}).`);
            setIsSubmitting(false);
            return;
          }
        }
        
        // Mark code as used
        try {
          await withTimeout(updateDoc(codeRef, {
            used: true,
            usedBy: user.uid,
            usedAt: new Date().toISOString()
          }));
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `access_codes/${codeDoc.id}`);
          return;
        }

        // Use the role defined in the code
        finalRole = codeData.role;
      }

      const newProfile = {
        uid: user.uid,
        email: user.email || '',
        name: name.trim(),
        role: isAdminEmail ? 'admin' : finalRole,
        tenantId: finalTenantId,
        createdAt: new Date().toISOString()
      };

      try {
        await withTimeout(setDoc(doc(db, 'users', user.uid), newProfile));
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
        return;
      }
      onComplete(newProfile);
    } catch (err: any) {
      console.error('Error creating profile:', err);
      try {
        const parsed = JSON.parse(err.message);
        if (parsed.error.includes('permissions')) {
          setError('Erro de permissão: Sua conta não tem autorização para criar este perfil. Verifique seu ID/Código.');
        } else {
          setError(`Erro técnico: ${parsed.error}`);
        }
      } catch {
        setError('Erro ao criar perfil. Verifique sua ligação à internet.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-950 px-4 font-sans antialiased text-slate-900 dark:text-white">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.15)] border border-slate-200/50 dark:border-white/5 overflow-hidden">
        
        <div className="bg-[#0f172a] p-10 text-center text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none" 
               style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/10 blur-[100px] rounded-full -mr-32 -mt-32 animate-pulse" />
          
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-primary to-blue-700 shadow-2xl shadow-brand-primary/40 relative z-10 mb-6 border border-white/10 overflow-hidden">
            <Building size={36} className="text-white drop-shadow-lg relative z-10 animate-pulse" />
          </div>
          
          <h2 className="text-3xl font-black tracking-tighter uppercase italic relative z-10 leading-none">
            M. TENANT<span className="text-brand-primary ml-1">SYSTEM</span>
          </h2>
          
          <div className="mt-4 flex items-center justify-center gap-3 relative z-10 px-4">
             <div className="h-0.5 w-6 bg-brand-primary/30" />
             <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.4em] whitespace-nowrap">PLATAFORMA MULTI-EMPRESA</p>
             <div className="h-0.5 w-6 bg-brand-primary/30" />
          </div>

          <div className="absolute bottom-4 left-0 right-0 px-8 flex justify-between items-center relative z-10">
             <div className="font-mono text-[6px] text-slate-500 tracking-tighter uppercase text-left">
                <span>Multi_Tenancy_Core</span><br/>
                <span>Active Isolation Enabled</span>
             </div>
             <button 
               onClick={handleLogout}
               className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-full border border-white/10 transition-colors text-[9px] font-bold text-white uppercase tracking-wider"
             >
               <LogOut size={10} />
               Sair
             </button>
          </div>
        </div>

        <div className="px-8 pt-6 pb-2 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/50">
           <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                 <Mail size={14} />
              </div>
              <div className="flex flex-col text-left">
                 <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sessão Iniciada como</span>
                 <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate max-w-[240px]">{user.email}</span>
              </div>
           </div>
           {isAdminEmail && (
              <div className="mt-2 text-[9px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 rounded px-2 py-1 flex items-center gap-1.5 border border-emerald-150 dark:border-emerald-900/10">
                 <ShieldCheck size={10} />
                 ESTA É UMA CONTA DE ADMINISTRADOR MASTER (AUTO-PSM)
              </div>
           )}
        </div>

        {/* Mode Toggles */}
        {!isCodeValidated && !isAdminEmail && (
          <div className="px-8 py-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/50 text-center">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Aderir à Empresa (Colaborador)</span>
          </div>
        )}

        <div className="p-8 space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 p-3 rounded-lg flex items-center gap-2 text-red-600 dark:text-red-400 text-xs font-bold animate-in fade-in duration-300">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {tenantMode === 'create' && !isCodeValidated && !isAdminEmail && (
            <form onSubmit={handleCreateTenant} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nome da Empresa</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: PSM Comercial, Taxi Luena, Moxico Frotas"
                  value={newTenantName}
                  onChange={(e) => setNewTenantName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-brand-primary transition-all text-sm font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">ID do Tenant de Acesso (Link da Empresa)</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: psm, taxiluena, moxico-frotas"
                  value={newTenantId}
                  onChange={(e) => setNewTenantId(e.target.value.toLowerCase())}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-brand-primary transition-all text-sm font-mono font-bold"
                />
                <p className="text-[10px] text-slate-400 leading-normal">
                  Este será o ID exclusivo da sua organização no sistema. Insira apenas letras minúsculas, números e traço. Seus motoristas usarão este ID para se conectarem.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-4 bg-brand-primary hover:bg-brand-secondary text-white flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-all disabled:opacity-50 active:scale-95"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (
                  <>
                    CRIAR EMPRESA & REGISTAR MEU PERFIL
                    <Plus size={16} />
                  </>
                )}
              </button>
            </form>
          )}

          {tenantMode === 'join' && !isCodeValidated && !isAdminEmail && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Building size={12} />
                  ID da Empresa (Tenant ID)
                </label>
                <input 
                  required
                  type="text" 
                  value={tempTenantId}
                  onChange={(e) => setTempTenantId(e.target.value.toLowerCase())}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-brand-primary transition-all text-sm font-mono font-bold"
                  placeholder="Ex: psm"
                />
                <p className="text-[10px] text-slate-400">Insira o ID da empresa fornecido pela sua central (Ex: psm).</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  ID do Colaborador
                </label>
                <input 
                  required
                  type="text" 
                  value={id}
                  onChange={(e) => setId(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-brand-primary transition-all text-sm font-bold"
                  placeholder="EX: MOT-01, STAFF-02"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Key size={12} />
                  Código de Acesso
                </label>
                <input 
                  required
                  type="text" 
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-brand-primary transition-all font-mono text-center tracking-[0.5em] text-lg uppercase"
                  placeholder="XXXX-XXXX"
                />
              </div>

              <button
                type="button"
                onClick={handleVerifyCode}
                disabled={isSubmitting}
                className="w-full bg-slate-900 border border-slate-700 text-white flex items-center justify-center gap-2 py-3 rounded-lg font-bold hover:bg-slate-800 transition-all disabled:opacity-50 active:scale-95"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (
                  <>
                    VERIFICAR CREDENCIAIS E EMPRESA
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          )}

          {(isCodeValidated || isAdminEmail) && (
            <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="bg-green-50 dark:bg-emerald-950/20 border border-green-100 dark:border-emerald-900/30 p-4 rounded-xl flex flex-col gap-1 text-green-600 dark:text-emerald-400 text-[10px] font-black uppercase text-left">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-green-500" />
                  ID, Código de Acesso & Empresa Confirmados
                </div>
                <div className="pl-6 opacity-70 text-[9px] mt-1 space-y-0.5">
                  <p>Empresa: <span className="font-mono text-blue-500 font-black">{(verifiedTenantId || 'psm').toUpperCase()}</span></p>
                  <p>Nível de Acesso: {validationRole === 'driver' ? 'MOTORISTA FROTISTA' : 'STAFF / CENTRAL'}</p>
                </div>
              </div>
              
              <div className="space-y-1 text-left">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Confirmar Nome Registado</label>
                <div className="relative group">
                  <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-primary transition-colors pointer-events-none z-10" />
                  {isAdminEmail ? (
                    <input 
                      required
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Introduza o seu Nome Completo de Administrador"
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-brand-primary transition-all text-sm font-bold"
                    />
                  ) : (
                    <>
                      <select 
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-11 pr-10 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-brand-primary transition-all text-sm appearance-none font-bold"
                      >
                        <option value="">Selecione o seu nome...</option>
                        {collaboratorsLoading ? (
                          <option disabled>A carregar colaboradores...</option>
                        ) : collaborators.length === 0 ? (
                          <option disabled>Nenhum colaborador registado nesta Empresa</option>
                        ) : (
                          collaborators.map(c => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                          ))
                        )}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                        <ChevronRight size={14} className="rotate-90" />
                      </div>
                    </>
                  )}
                </div>
                {!isAdminEmail && <p className="text-[10px] text-slate-400 font-medium">O seu nome deve constar no registo oficial da empresa.</p>}
              </div>

              {isAdminEmail && (
                <div className="space-y-1 text-left">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sua Função</label>
                  <div className="p-4 rounded-xl border-2 border-brand-primary bg-blue-50/15 text-brand-primary flex items-center gap-3">
                    <Shield size={20} />
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-tight block">Administrador Master</span>
                      <span className="text-[9px] opacity-60">Acesso total ao sistema configurado automaticamente.</span>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-brand-primary text-white flex items-center justify-center gap-2 py-3 rounded-lg font-bold hover:bg-brand-secondary transition-all disabled:opacity-50 active:scale-95"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (
                  <>
                    FINALIZAR REGISTO NO TENANT
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
              
              {!isAdminEmail && (
                <button
                  type="button"
                  onClick={() => {
                    setIsCodeValidated(false);
                    setActiveTenantId(null);
                    setVerifiedTenantId('');
                  }}
                  className="w-full text-center flex items-center justify-center gap-1.5 text-slate-400 hover:text-slate-600 text-xs py-1"
                >
                  <ArrowLeft size={12} />
                  Voltar e Alterar Empresa
                </button>
              )}
            </form>
          )}
        </div>
        
      </div>
    </div>
  );
}
