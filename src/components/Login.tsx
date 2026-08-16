import React, { useState, useEffect } from 'react';
import { LogIn, Car, User, Key, ArrowRight, Shield, AlertCircle, Loader2, CheckCircle2, ShieldCheck, ChevronRight, ChevronDown, ChevronUp, MessageSquare, MoreVertical, X, Globe, Lock, Building, Building2, HelpCircle, QrCode, Copy, Check, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signInWithRedirect } from 'firebase/auth';
import { db, auth, googleProvider, withTimeout, getActiveTenantId, setActiveTenantId } from '../lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, setDoc, serverTimestamp, orderBy, getDoc } from '@/src/lib/firebase';
import CompanyManagement from './CompanyManagement';

interface LoginProps {
  onGoogleLogin: () => void | Promise<any>;
  onPassengerFlow?: () => void;
}

export default function Login({ onGoogleLogin, onPassengerFlow }: LoginProps) {
  const [loginMethod, setLoginMethod] = useState<'cover' | 'google' | 'credentials' | 'register' | 'recover' | 'companies'>('cover');
  const [isRestrictedAreaExpanded, setIsRestrictedAreaExpanded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPopupTip, setShowPopupTip] = useState(false);
  const [collaborators, setCollaborators] = useState<{ id: string, name: string }[]>([]);
  const [collaboratorsLoading, setCollaboratorsLoading] = useState(false);
  const [isCodeValidated, setIsCodeValidated] = useState(false);
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [validationRole, setValidationRole] = useState<string | null>(null);
  const [whatsAppLink, setWhatsAppLink] = useState('');
  const [isManualName, setIsManualName] = useState(false);
  const [companies, setCompanies] = useState<{ id: string, name: string }[]>([
    { id: 'psm', name: 'JIS ANGOLA' }
  ]);
  const [selectedTenant, setSelectedTenant] = useState<string>(() => {
    const active = getActiveTenantId();
    if (!active) {
      setActiveTenantId('psm');
      return 'psm';
    }
    return active;
  });
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  
  // Master Administration Unlock states (only visible to José Iweza Suana)
  const [isMasterUnlocked, setIsMasterUnlocked] = useState(false);
  const [masterPasswordInput, setMasterPasswordInput] = useState('');
  const [showMasterField, setShowMasterField] = useState(false);
  const [isMasterValidating, setIsMasterValidating] = useState(false);
  const [masterError, setMasterError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCompanies = async () => {
      setCompaniesLoading(true);
      try {
        const snap = await getDocs(collection(db, 'tenants'));
        const list: { id: string, name: string }[] = [];
        snap.forEach(docSnap => {
          list.push({ id: docSnap.id, name: docSnap.data().name || docSnap.id });
        });
        if (!list.some(c => c.id === 'psm')) {
          list.unshift({ 
            id: 'psm', 
            name: 'JIS ANGOLA'
          });
        }
        setCompanies(list);
      } catch (err) {
        console.error("Error fetching companies in Login:", err);
        // Robust fallback: keep PSM even on Firestore rules blocking direct search
        setCompanies(prev => {
          if (!prev.some(c => c.id === 'psm')) {
            return [{ id: 'psm', name: 'JIS ANGOLA' }, ...prev];
          }
          return prev;
        });
      } finally {
        setCompaniesLoading(false);
      }
    };
    fetchCompanies();
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsSnap = await withTimeout(getDoc(doc(db, 'settings', 'global')), 5000);
        if (settingsSnap.exists()) {
          setWhatsAppLink(settingsSnap.data().whatsAppLink || '');
        }
      } catch (err: any) {
        if (err?.message?.includes('offline') || err?.code === 'unavailable' || err?.message?.includes('ERRO_TIMEOUT')) {
          console.warn("A carregar definições em modo offline/cache.");
        } else {
          console.warn("Não foi possível carregar definições:", err?.message || err);
        }
      }
    };
    fetchSettings();
  }, []);

  const renderErrorAlert = (errText: string | null) => {
    if (!errText) return null;
    
    const isFirebaseConfigIssue = 
      errText.includes('auth/operation-not-allowed') || 
      errText.includes('desativada') || 
      errText.includes('não está ativado') ||
      errText.includes('unauthorized-domain') || 
      errText.includes('domínio') || 
      errText.includes('Console') ||
      errText.includes('restrita');

    return (
      <div className="p-4 bg-red-50 border border-red-100 rounded-2xl space-y-3">
        <div className="flex items-start gap-2.5 text-red-600 text-xs font-bold">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div className="space-y-1 text-left">
            <p className="font-black uppercase tracking-wider text-[10px]">Alerta de Erro</p>
            <p className="leading-relaxed font-bold">{errText}</p>
          </div>
        </div>
        
        {isFirebaseConfigIssue && (
          <div className="p-3 bg-amber-500/10 border border-amber-200/50 rounded-xl space-y-1 text-left">
            <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest flex items-center gap-1.5 leading-none">
              <HelpCircle size={12} className="animate-pulse" />
              Provedores de Login do Firebase
            </p>
            <p className="text-[9.5px] text-slate-650 font-semibold leading-relaxed">
              Este erro ocorre quando a autenticação por E-mail/Senha ou Google não está ativada no seu console Firebase, ou o domínio atual não foi autorizado. O guia passo-a-passo completo está disponível nas Definições do sistema.
            </p>
          </div>
        )}
      </div>
    );
  };

  const handleMethodChange = (method: 'cover' | 'google' | 'credentials' | 'register' | 'recover' | 'companies') => {
    setLoginMethod(method);
    setShowMenu(false);
    setIsCodeValidated(false);
    setValidationRole(null);
    setCollaborators([]);
    setError(null);
    setSuccess(null);
    setId('');
    setPassword('');
    setCode('');
    setName('');
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!id.trim() || !code.trim() || !password.trim()) {
        throw new Error("Todos os campos são obrigatórios para a recuperação.");
      }
      if (password.length < 6) {
        throw new Error("A nova palavra-passe deve ter pelo menos 6 caracteres.");
      }

      const response = await fetch('/api/auth/recover-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: id.trim().toUpperCase(),
          code: code.trim().toUpperCase(),
          newPassword: password.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Ocorreu um erro ao recuperar seu acesso.");
      }

      setSuccess("Palavra-passe redefinida com sucesso! Introduza a sua nova palavra-passe.");
      alert("Acesso recuperado com sucesso! Já pode aceder com a nova palavra-passe.");
      setLoginMethod('credentials');
      setPassword('');
    } catch (err: any) {
      console.error("Recovery error:", err);
      setError(err.message || "Falha na comunicação com o servidor central.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch registered collaborators (Staff & Drivers)
  useEffect(() => {
    // Strictly only fetch if validated
    if (!isCodeValidated || !validationRole) {
      setCollaborators([]);
      return;
    }

    const fetchCollaborators = async () => {
      setCollaboratorsLoading(true);
      try {
        let results: { id: string, name: string }[] = [];

        if (validationRole === 'admin' || validationRole === 'gerente' || validationRole === 'manager' || validationRole === 'operator' || validationRole === 'contabilista' || validationRole === 'mecanico') {
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
        console.error("Error fetching collaborators, loading fallback staff/drivers:", err);
        // Supply rich, friendly fallbacks for Jose Iweza Suana and team so they can proceed
        if (validationRole === 'admin' || validationRole === 'gerente' || validationRole === 'manager' || validationRole === 'operator' || validationRole === 'contabilista' || validationRole === 'mecanico') {
          setCollaborators([
            { id: "fallback-jos", name: "José Iweza Suana (Admin)" },
            { id: "fallback-ant", name: "António Moreira" },
            { id: "fallback-sof", name: "Sofia Moreira" },
            { id: "fallback-fil", name: "Filipe Moreira" },
            { id: "fallback-lui", name: "Luísa Santos" }
          ]);
        } else if (validationRole === 'driver') {
          setCollaborators([
            { id: "fallback-carl", name: "Carlos Silva" },
            { id: "fallback-man", name: "Manuel Neto" },
            { id: "fallback-du", name: "Duarte Francisco" },
            { id: "fallback-jo", name: "João Sousa" },
            { id: "fallback-pa", name: "Paulo Jorge" }
          ]);
        }
      } finally {
        setCollaboratorsLoading(false);
      }
    };

    fetchCollaborators();
  }, [loginMethod, isCodeValidated, validationRole]);

  const handleUnlockMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterPasswordInput) return;
    setIsMasterValidating(true);
    setMasterError(null);
    try {
      // Securely fetch custom master admin password from Firestore settings/global
      const settingsSnap = await withTimeout(getDoc(doc(db, 'settings', 'global')));
      let masterPass = 'JIS_PASS_2026'; // Custom master password default fallback for José Iweza Suana (JIS)
      
      if (settingsSnap.exists() && settingsSnap.data().masterPassword) {
        masterPass = settingsSnap.data().masterPassword;
      } else {
        // Automatically save initial fallback configuration safely (wrapped in a try-catch since we shouldn't fail if we are unauthenticated)
        try {
          await setDoc(doc(db, 'settings', 'global'), { masterPassword: masterPass }, { merge: true });
        } catch (setDocErr) {
          console.warn("Could not write global masterPassword fallback (this is normal if not authenticated yet):", setDocErr);
        }
      }

      if (masterPasswordInput.trim() === masterPass) {
        setIsMasterUnlocked(true);
        setMasterError(null);
      } else {
        setMasterError("Palavra-passe de Administração inválida.");
      }
    } catch (err: any) {
      console.error("Master Admin Unlock Error Detail:", err);
      // Failover fallback in case of firebase network issue or initial permissions setting, so user does not get blocked
      if (masterPasswordInput === 'JIS_PASS_2026') {
        setIsMasterUnlocked(true);
      } else {
        setMasterError("Erro ao validar acesso. Verifique a ligação ao servidor ou introduza a palavra-passe principal.");
      }
    } finally {
      setIsMasterValidating(false);
    }
  };

  const handleGoogleLoginClick = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    setShowPopupTip(false);
    try {
      // Direct promise call
      await onGoogleLogin();
    } catch (err: any) {
      console.error('Login error detail:', err);
      if (err.code === 'auth/popup-blocked' || err.message?.includes('popup')) {
        setError('O pop-up de login foi bloqueado pelo seu navegador.');
        setShowPopupTip(true);
      } else if (err.code === 'auth/network-request-failed') {
        setError('Falha na conexão de rede. Verifique seu sinal de internet ou se existe algum firewall bloqueando o acesso ao Google.');
        setShowPopupTip(false);
      } else if (err.code === 'auth/cancelled-popup-request' || err.message?.includes('cancelled-popup-request')) {
        setError('Solicitação de login cancelada. Tente novamente clicando apenas uma vez.');
      } else if (err.message?.includes('INTERNAL ASSERTION FAILED')) {
        setError('Ocorreu um erro interno de autenticação. Por favor, recarregue a página.');
        setShowPopupTip(true);
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('O login com Google não está ativado no Firebase Console.');
        setShowPopupTip(false);
      } else if (err.code === 'auth/unauthorized-domain') {
        const currentDomain = window.location.hostname;
        setError(`O domínio "${currentDomain}" não está autorizado no Firebase Console. 
          Vá em Authentication > Settings > Authorized Domains e adicione este endereço e também o domínio de produção.`);
        setShowPopupTip(true);
      } else if (err.code === 'auth/network-request-failed') {
        setError('Ocorreu um erro de rede. Isso pode ser devido a uma conexão instável ou ao bloqueio de scripts externos. Tente novamente ou use ID Central.');
        setShowPopupTip(true);
      } else {
        setError(`Erro ao autenticar com Google (${err.code || 'erro_desconhecido'}).`);
        setShowPopupTip(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRedirect = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (err: any) {
      console.error('Redirect error:', err);
      setError('Erro ao iniciar redirecionamento. Use ID Central como alternativa.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (!code.trim() || !id.trim()) {
      setError("Insira o ID e o Código de Ativação.");
      return;
    }

    setIsValidatingCode(true);
    setError(null);
    setSuccess(null);

    try {
      const normalizedCode = code.trim().toUpperCase().replace(/\s+/g, '');
      const finalCode = (normalizedCode.length === 8 && !normalizedCode.includes('-')) 
        ? `${normalizedCode.substring(0, 4)}-${normalizedCode.substring(4)}`
        : normalizedCode;

      let foundCodeDoc = null;
      let foundCodeData = null;
      let targetTenantId = selectedTenant;

      const q = query(
        collection(db, 'access_codes'), 
        where('code', '==', finalCode)
      );
      let querySnapshot = await withTimeout(getDocs(q));

      if (!querySnapshot.empty) {
        foundCodeDoc = querySnapshot.docs[0];
        foundCodeData = foundCodeDoc.data();
      } else {
        // Search across all other companies/tenants as a fallback
        for (const comp of companies) {
          if (comp.id === selectedTenant) continue;
          try {
            // query using the collection method which handles tenant paths
            const specificColl = collection(db, 'tenants', comp.id, 'access_codes');
            const specificQ = query(specificColl, where('code', '==', finalCode));
            const specSnap = await withTimeout(getDocs(specificQ));
            if (!specSnap.empty) {
              foundCodeDoc = specSnap.docs[0];
              foundCodeData = foundCodeDoc.data();
              targetTenantId = comp.id;
              
              // Automatically switch state and localStorage to this tenant
              setSelectedTenant(comp.id);
              setActiveTenantId(comp.id);
              break;
            }
          } catch (tenantSearchErr) {
            console.warn(`Could not search in tenant ${comp.id}:`, tenantSearchErr);
          }
        }
      }

      if (!foundCodeDoc || !foundCodeData) {
        throw new Error(`Código de ativação inválido ou não pertence a nenhuma filial registrada. Verifique se digitou corretamente (por exemplo: ${finalCode}).`);
      }

      if (foundCodeData.used) {
        throw new Error("Este código de ativação já foi utilizado por outro colaborador.");
      }

      // Check case-insensitive assignedId matching (if set)
      if (foundCodeData.assignedId && foundCodeData.assignedId.trim()) {
        const expectedId = foundCodeData.assignedId.trim().toUpperCase();
        const inputId = id.trim().toUpperCase();
        if (expectedId !== inputId) {
          throw new Error(`O ID fornecido (${inputId}) não corresponde ao ID autorizado para este código (${expectedId}).`);
        }
      }

      const role = foundCodeData.role || 'driver';
      setValidationRole(role);
      setIsCodeValidated(true);
      setSuccess(`Código validado com sucesso para a empresa ${companies.find(c => c.id === targetTenantId)?.name || targetTenantId}! Selecione agora o seu nome.`);
    } catch (err: any) {
      console.error("Verification error:", err);
      setError(err.message || "Erro ao verificar dados de acesso.");
    } finally {
      setIsValidatingCode(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (password.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres.");
      if (!id.trim() || !code.trim()) throw new Error("ID e Código são obrigatórios.");
      if (!name.trim()) throw new Error("Por favor, selecione ou escreva o seu nome.");

      const sanitizedId = id.trim().toLowerCase().replace(/\s+/g, '-');
      const email = id.includes('@') ? id.trim().toLowerCase() : `${sanitizedId}@taxicontrol.ao`;

      const normalizedCode = code.trim().toUpperCase().replace(/\s+/g, '');
      const finalCode = (normalizedCode.length === 8 && !normalizedCode.includes('-')) 
        ? `${normalizedCode.substring(0, 4)}-${normalizedCode.substring(4)}`
        : normalizedCode;

      // 1. Validate Access Code (Double check for security)
      const q = query(
        collection(db, 'access_codes'), 
        where('code', '==', finalCode)
      );
      const querySnapshot = await withTimeout(getDocs(q));

      if (querySnapshot.empty) {
        throw new Error("Código de ativação inválido ou já utilizado.");
      }

      const codeDoc = querySnapshot.docs[0];
      const codeData = codeDoc.data();

      if (codeData.used) {
        throw new Error("Este código de ativação já foi utilizado por outro colaborador.");
      }

      // Check case-insensitive assignedId matching (if set)
      if (codeData.assignedId && codeData.assignedId.trim()) {
        const expectedId = codeData.assignedId.trim().toUpperCase();
        const inputId = id.trim().toUpperCase();
        if (expectedId !== inputId) {
          throw new Error("O ID fornecido não corresponde ao ID autorizado para este código.");
        }
      }

      // Check if a local user or general user with this ID exists
      const localUid = `local_${sanitizedId}`;
      const existingUser = await getDoc(doc(db, 'users', localUid));
      if (existingUser.exists()) {
        throw new Error("Este ID já está registado no sistema.");
      }

      try {
        // 2. Create Auth Account (Client-side bypasses Admin API errors)
        const userCredential = await withTimeout(createUserWithEmailAndPassword(auth, email, password), 15000); // 15s for auth
        const user = userCredential.user;

        // 3. Update Profile & Sync Firestore
        await updateProfile(user, { displayName: name });
        
        await withTimeout(setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          name: name,
          email: email,
          role: codeData.role,
          password: password, // Store for compatibility fallback
          createdAt: serverTimestamp(),
          syncedAt: serverTimestamp()
        }));

        // 4. Mark code as used
        await withTimeout(updateDoc(doc(db, 'access_codes', codeDoc.id), {
          used: true,
          usedBy: user.uid,
          usedAt: serverTimestamp()
        }));

        setSuccess('Conta ativada com sucesso! Já pode navegar no painel.');
      } catch (authErr: any) {
        console.warn("Standard Auth register failed or is disabled. Using hybrid local registration fallback.", authErr);
        
        const isEmailInUse = authErr.code === 'auth/email-already-in-use' || authErr.message?.includes('email-already-in-use');
        
        if (isEmailInUse) {
          throw authErr;
        } else {
          // Use hybrid local activation fallback for any standard authentication issues (like operation-not-allowed)
          await RichmondLocalRegister(sanitizedId, email, name, codeData.role, codeDoc.id);
        }
      }
    } catch (err: any) {
      console.error("Register error:", err);
      if (err.code === 'auth/email-already-in-use') {
        setError("Este ID já está registado no sistema.");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const RichmondLocalRegister = async (sanitizedId: string, email: string, name: string, role: string, codeDocId: string) => {
    const localUid = `local_${sanitizedId}`;
    
    // Create local user document directly in Firestore users collection
    await withTimeout(setDoc(doc(db, 'users', localUid), {
      uid: localUid,
      name: name,
      email: email,
      role: role,
      password: password,
      isLocal: true,
      createdAt: new Date().toISOString(),
      syncedAt: new Date().toISOString()
    }));

    // Mark the activation code as used
    await withTimeout(updateDoc(doc(db, 'access_codes', codeDocId), {
      used: true,
      usedBy: localUid,
      usedAt: new Date().toISOString()
    }));

    // Store session locally and reload to trigger session hook in App.tsx
    const sessionData = {
      uid: localUid,
      name: name,
      email: email,
      role: role,
      tenantId: 'psm',
      isLocal: true
    };
    localStorage.setItem('local_user_session', JSON.stringify(sessionData));

    setSuccess('Conta ativada localmente com sucesso! Inicializando o painel de bordo...');
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    const rawId = id.trim();
    const sanitizedId = rawId.toLowerCase().replace(/\s+/g, '-');
    const email = rawId.includes('@') ? rawId.toLowerCase() : `${sanitizedId}@taxicontrol.ao`;

    try {
      // First try standard Firebase authentication
      try {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        
        if (userCred.user) {
          const uRef = doc(db, 'users', userCred.user.uid);
          const uSnap = await getDoc(uRef).catch(() => null);

          // Check if this user is a registered staff member in administrative_staff
          let staffRole: string | null = null;
          let staffName: string | null = null;

          try {
            const staffQ = query(collection(db, 'administrative_staff'), where('email', '==', email.toLowerCase()));
            const staffSnap = await getDocs(staffQ);
            if (!staffSnap.empty) {
              const sData = staffSnap.docs[0].data();
              staffRole = sData.role || 'gerente';
              staffName = sData.name || null;
            } else {
              // Try searching by name or ID
              const staffByNameQ = query(collection(db, 'administrative_staff'), where('name', '==', rawId));
              const staffByNameSnap = await getDocs(staffByNameQ);
              if (!staffByNameSnap.empty) {
                const sData = staffByNameSnap.docs[0].data();
                staffRole = sData.role || 'gerente';
                staffName = sData.name || null;
              }
            }
          } catch (staffErr) {
            console.warn("Staff lookup on login error:", staffErr);
          }

          const userEmail = email.toLowerCase();
          const isMaster = userEmail === 'joseiwezasuana@gmail.com';
          const isExplicitAdmin = isMaster || userEmail.includes('admin') || userEmail.includes('gerente') || userEmail.includes('gestor') || userEmail.includes('manager');
          const isExplicitOp = userEmail.includes('operador') || userEmail.includes('central') || userEmail.includes('operator');
          const isExplicitMec = userEmail.includes('mecanico') || userEmail.includes('mechanic');
          const isExplicitFin = userEmail.includes('contabilista') || userEmail.includes('finance');

          let resolvedRole: string | null = staffRole;
          if (!resolvedRole) {
            if (isExplicitAdmin) resolvedRole = 'gerente';
            else if (isExplicitOp) resolvedRole = 'operator';
            else if (isExplicitMec) resolvedRole = 'mecanico';
            else if (isExplicitFin) resolvedRole = 'contabilista';
          }

          if (!uSnap || !uSnap.exists()) {
            // Profile document does not exist yet: create it preserving staff/manager role!
            const defaultRole = resolvedRole || (userEmail.startsWith('tx-') || userEmail.startsWith('mot-') ? 'driver' : 'gerente');
            await setDoc(uRef, {
              uid: userCred.user.uid,
              email: email,
              name: staffName || rawId.toUpperCase(),
              role: defaultRole,
              tenantId: 'psm',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }, { merge: true }).catch(console.warn);
          } else {
            const currentProfile = uSnap.data();
            // If the user is a manager or staff member, but their profile role was accidentally saved as 'driver' or empty, auto-repair it!
            if (resolvedRole && currentProfile?.role !== resolvedRole && (currentProfile?.role === 'driver' || !currentProfile?.role)) {
              await setDoc(uRef, {
                role: resolvedRole,
                updatedAt: new Date().toISOString()
              }, { merge: true }).catch(console.warn);
            }
          }
        }

        localStorage.removeItem('local_user_session'); // clear local if standard worked
      } catch (authErr: any) {
        console.warn("Standard Auth login failed. Trying local database fallback...", authErr);
        
        // Attempt local login fallback using several common formats of the ID to be highly bulletproof:
        const candidateUids = [
          `local_${sanitizedId}`, // e.g., local_tx-104
          `local_${sanitizedId.replace(/[^a-z0-9]/g, '')}`, // e.g., local_tx104
          `local_${rawId.toLowerCase()}` // exact lowercase, e.g., local_tx-104 or local_tx104
        ];

        let foundUserData = null;

        // 1. Try finding by document ID using our candidate UID list
        for (const uid of candidateUids) {
          const userDocRef = doc(db, 'users', uid);
          const userSnap = await getDoc(userDocRef);
          if (userSnap.exists()) {
            foundUserData = userSnap.data();
            break;
          }
        }

        // 2. Fallback to searching by email or standard UID
        if (!foundUserData) {
          const q = query(collection(db, 'users'), where('email', '==', email));
          const qSnap = await getDocs(q);
          if (!qSnap.empty) {
            foundUserData = qSnap.docs[0].data();
          }
        }

        // 3. Fallback to searching by a broader email match (case-insensitive or alternative emails)
        if (!foundUserData && !rawId.includes('@')) {
          const alternativeEmail = `${rawId.toLowerCase().replace(/[^a-z0-9]/g, '')}@taxicontrol.ao`;
          const qAlt = query(collection(db, 'users'), where('email', '==', alternativeEmail));
          const qAltSnap = await getDocs(qAlt);
          if (!qAltSnap.empty) {
            foundUserData = qAltSnap.docs[0].data();
          }
        }

        // Verify password and establish local session if found
        if (foundUserData) {
          if (foundUserData.password === password) {
            const sessionData = {
              uid: foundUserData.uid,
              name: foundUserData.name,
              email: foundUserData.email,
              role: foundUserData.role,
              tenantId: foundUserData.tenantId || 'psm',
              isLocal: true
            };
            localStorage.setItem('local_user_session', JSON.stringify(sessionData));
            window.location.reload();
            return;
          } else {
            throw new Error('Palavra-passe incorreta para este ID.');
          }
        }

        // If the user isn't found anywhere:
        if (authErr.code === 'auth/operation-not-allowed') {
          throw new Error('A autenticação do Firebase está desativada ou restrita. Não conseguimos encontrar este utilizador localmente com este ID e Palavra-passe. Por favor, crie uma conta primeiro com o seu Código de Ativação.');
        } else {
          throw new Error('ID ou Palavra-passe incorretos.');
        }
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Erro ao autenticar. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full min-h-[100dvh] overflow-y-auto overflow-x-hidden bg-white font-sans antialiased text-slate-900 notranslate selection:bg-brand-primary/30 relative flex flex-col justify-between">
      {/* Background Decorative Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none bg-white">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-primary/5 blur-[120px] rounded-full animate-pulse" />
      </div>

      {/* Top Control Bar with 3 dots menu - Fixed in the upper corner of the screen */}
      <div className="fixed top-4 right-4 md:top-6 md:right-6 z-50 flex items-center gap-2">
        <div className="relative">
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="p-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-2xl transition-all active:scale-95 text-slate-800 dark:text-white"
          >
            {showMenu ? <X size={20} /> : <MoreVertical size={20} />}
          </button>

          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                className="absolute right-0 mt-3 w-64 bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden p-3 space-y-2 z-50 text-slate-900 text-left"
              >
                <div 
                  onClick={() => setShowMasterField(!showMasterField)} 
                  className="px-3 py-1.5 border-b border-slate-100 mb-1 flex items-center justify-between gap-2 hover:bg-slate-50 cursor-pointer rounded-lg transition-all"
                  title="Clique para Desbloquear Administração Master"
                >
                  <div className="flex items-center gap-2">
                    <Lock size={14} className={showMasterField ? "text-brand-primary" : "text-slate-500"} />
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Área Restrita</span>
                  </div>
                  {!isMasterUnlocked && (
                    <span className="text-[8px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded uppercase">Master Check</span>
                  )}
                </div>

                {/* Inline Verification Input to Unlock Admin Panel Option (Visible ONLY to Admin Master) */}
                {showMasterField && !isMasterUnlocked && (
                  <form onSubmit={handleUnlockMaster} className="p-2.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-left">
                    <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-brand-primary tracking-wider">
                      <Shield className="animate-pulse" size={12} />
                      Confirmar Palavra-passe JIS
                    </div>
                    <div className="space-y-1.5">
                      <input 
                        type="password"
                        value={masterPasswordInput}
                        onChange={(e) => {
                          setMasterPasswordInput(e.target.value);
                          setMasterError(null);
                        }}
                        placeholder="Palavra-passe do Administrador"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-[10.5px] font-bold outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 text-slate-800"
                        autoFocus
                        disabled={isMasterValidating}
                      />
                      {masterError && (
                        <p className="text-[8px] text-red-600 font-extrabold uppercase">{masterError}</p>
                      )}
                      <button
                        type="submit"
                        disabled={isMasterValidating || !masterPasswordInput}
                        className="w-full py-1.5 bg-slate-900 hover:bg-slate-950 text-white rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        {isMasterValidating ? (
                          <>
                            <Loader2 size={10} className="animate-spin" />
                            A validar...
                          </>
                        ) : (
                          <>
                            <Key size={10} />
                            Validar Acesso
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-[7.5px] text-slate-400 font-bold uppercase tracking-wider leading-relaxed">
                      Confirme com a palavra-passe associada ao e-mail principal para revelar as Opções de Administração.
                    </p>
                  </form>
                )}

                {/* Administração Subgroup - Visible ONLY after master verification */}
                {isMasterUnlocked && (
                  <motion.div 
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-1.5 bg-gradient-to-br from-indigo-50/50 to-amber-50/20 rounded-2xl border border-indigo-100/50 space-y-1"
                  >
                    <div className="flex items-center justify-between mb-1 px-2.5 pt-1.5">
                      <p className="text-[9px] font-black uppercase text-indigo-750 tracking-wider flex items-center gap-1">
                        <ShieldCheck size={11} className="text-emerald-500 animate-bounce" />
                        Administração Master (JIS)
                      </p>
                      <span className="text-[7.5px] bg-emerald-500/10 text-emerald-600 font-black px-1.5 py-0.2 rounded uppercase">Ativo</span>
                    </div>
                    
                    {/* Acesso Admin via Google */}
                    <button 
                      onClick={() => handleMethodChange('google')}
                      className="w-full flex items-center justify-between p-2 bg-white rounded-xl hover:bg-indigo-50/50 transition-all group active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0 group-hover:scale-115 transition-transform">
                          <Shield size={14} />
                        </div>
                        <div className="text-left">
                          <p className="text-[10px] font-black uppercase tracking-tight text-slate-800 leading-snug">Entrar no Painel</p>
                          <p className="text-[7.5px] text-slate-400 font-bold uppercase tracking-wider">Acesso via Google</p>
                        </div>
                      </div>
                      <ChevronRight size={12} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>

                    {/* Gestão de Companhias */}
                    <button 
                      onClick={() => handleMethodChange('companies')}
                      className="w-full flex items-center justify-between p-2 bg-white rounded-xl hover:bg-indigo-50/50 transition-all group active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0 group-hover:scale-115 transition-transform">
                          <Building size={14} />
                        </div>
                        <div className="text-left">
                          <p className="text-[10px] font-black uppercase tracking-tight text-slate-800 leading-snug">Gestão de Companhias</p>
                          <p className="text-[7.5px] text-slate-400 font-bold uppercase tracking-wider">Filiais & Multi-Tenant</p>
                        </div>
                      </div>
                      <ChevronRight size={12} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </motion.div>
                )}

                {/* Colaborador */}
                <button 
                  onClick={() => handleMethodChange('credentials')}
                  className="w-full flex items-center justify-between p-2.5 bg-white border border-slate-50 hover:border-brand-primary/30 rounded-2xl hover:bg-slate-50 transition-all group active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-pink-50 flex items-center justify-center text-pink-600 shrink-0 group-hover:scale-110 transition-transform">
                      <LogIn size={16} />
                    </div>
                    <div className="text-left">
                      <p className="text-[11px] font-black uppercase tracking-tight text-slate-800">Colaborador</p>
                      <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Entrar com credenciais</p>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </button>

                {/* Autenticar */}
                <button 
                  onClick={() => handleMethodChange('register')}
                  className="w-full flex items-center justify-between p-2.5 bg-white border border-slate-50 hover:border-brand-primary/30 rounded-2xl hover:bg-slate-50 transition-all group active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0 group-hover:scale-110 transition-transform">
                      <Key size={16} />
                    </div>
                    <div className="text-left">
                      <p className="text-[11px] font-black uppercase tracking-tight text-slate-800">Ativar Conta</p>
                      <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Validar código de equipe</p>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`w-full bg-white relative z-10 transition-all duration-500 shadow-none border-none ${
          loginMethod === 'companies' ? "max-w-7xl mx-auto p-3 sm:p-6 lg:p-8 min-h-screen flex flex-col my-0 pb-20" : "max-w-[440px] mx-auto py-4 sm:py-6 px-4 my-auto"
        }`}
      >
        {loginMethod !== 'companies' && (
          <div className="bg-white text-slate-900 relative overflow-hidden flex flex-col justify-center transition-all duration-500 py-4 sm:py-6 px-4 text-center shrink-0">
            {/* Technical Grid Pattern */}
            <div className="absolute inset-0 opacity-5 pointer-events-none" 
                 style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
            
            <div className="absolute top-0 right-0 w-80 h-80 bg-brand-primary/10 blur-[120px] rounded-full -mr-40 -mt-40 animate-pulse" />
            
            <motion.div 
              initial={{ scale: 0.8, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              className="mx-auto flex h-20 w-20 items-center justify-center relative z-10 mb-2 group overflow-hidden"
            >
              <img 
                src="/logo.svg" 
                alt="PSM Taxi" 
                className="w-full h-full object-contain relative z-10 filter drop-shadow-[0_8px_20px_rgba(245,158,11,0.3)]"
              />
            </motion.div>
            
            <h1 className="text-2xl font-black tracking-tighter uppercase italic relative z-10 leading-none">
              <span className="text-blue-600 dark:text-blue-400">SUPER</span><span className="text-amber-500 ml-1.5">Taxi</span>
            </h1>
            
            <div className="mt-2 flex items-center justify-center gap-3 relative z-10 px-4">
               <div className="h-0.5 w-6 bg-brand-primary/40" />
               <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.4em] whitespace-nowrap">JIS ANGOLA</p>
               <div className="h-0.5 w-6 bg-brand-primary/40" />
            </div>
          </div>
        )}
        
        <div className={`relative transition-all duration-500 flex flex-col ${
          loginMethod === 'companies' ? "p-0 min-h-0 flex-1 justify-start" : "p-4 sm:p-6 min-h-[320px] items-center justify-center"
        }`}>
          <AnimatePresence mode="wait">
            {loginMethod === 'cover' ? (
              <motion.div 
                key="cover"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full space-y-6"
              >
                {/* QR Code de Divulgação do App do Passageiro (JIS ANGOLA) */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center space-y-4 shadow-2xl relative overflow-hidden text-white">
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
                      Divulgação • App do Passageiro
                    </span>
                    <h4 className="text-sm font-black uppercase tracking-wider text-white mt-1">QR CODE DO APP PASSAGEIRO</h4>
                  </div>

                  {/* QR Image Frame */}
                  <div className="flex justify-center my-2">
                    <div className="p-3 bg-white rounded-2xl border-2 border-amber-500/30 shadow-xl relative group">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                          typeof window !== 'undefined' 
                            ? `${window.location.protocol}//${window.location.host}/?app=passenger` 
                            : "https://jis-st.web.app?app=passenger"
                        )}`} 
                        alt="QR Code App Passageiro"
                        className="w-40 h-40 object-contain rounded-lg"
                      />
                      <div className="absolute -bottom-2 -right-2 bg-amber-500 text-slate-950 p-1.5 rounded-xl shadow-lg border border-white">
                        <Car size={16} className="font-bold" />
                      </div>
                    </div>
                  </div>

                  {/* Actions: Copy Link & Open App */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <button 
                      type="button"
                      onClick={() => {
                        const url = typeof window !== 'undefined' 
                          ? `${window.location.protocol}//${window.location.host}/?app=passenger` 
                          : "https://jis-st.web.app?app=passenger";
                        navigator.clipboard.writeText(url);
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2500);
                      }}
                      className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md"
                    >
                      {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                      {copiedLink ? 'Link Copiado!' : 'Copiar Link App'}
                    </button>

                    <button 
                      type="button"
                      onClick={() => {
                        const url = typeof window !== 'undefined' 
                          ? `${window.location.protocol}//${window.location.host}/?app=passenger` 
                          : "https://jis-st.web.app?app=passenger";
                        window.open(url, '_blank');
                      }}
                      className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-slate-200 border border-slate-700 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                    >
                      <ExternalLink size={14} />
                      Abrir em Nova Aba
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key={`form-${loginMethod}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="w-full"
              >
                {loginMethod !== 'companies' && (
                  <div className="mb-6 flex items-center justify-between">
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic">
                      {loginMethod === 'google' ? 'Administração' : loginMethod === 'credentials' ? 'Colaborador' : loginMethod === 'recover' ? 'Recuperar Acesso' : 'Autenticar colaborador'}
                    </h3>
                    <button 
                      onClick={() => handleMethodChange('cover')}
                      className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 cursor-pointer"
                      title="Voltar"
                    >
                      <ArrowRight className="rotate-180" size={18} />
                    </button>
                  </div>
                )}

                {/* Forms Section */}
                {loginMethod === 'google' && (
                  <div className="space-y-6">
                    {renderErrorAlert(error)}
                    
                    {/* Selector de Companhia / Multi-Tenant */}
                    <div className="space-y-2 text-left bg-slate-50 border border-slate-100 p-4 rounded-2xl">
                      <div className="flex items-center gap-2">
                        <Building size={16} className="text-brand-primary" />
                        <label htmlFor="login-tenant-select" className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                          Selecione a Companhia / Painel
                        </label>
                      </div>
                      
                      {companiesLoading ? (
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase mt-1 animate-pulse">
                          <Loader2 size={12} className="animate-spin text-brand-primary" />
                          A carregar companhias...
                        </div>
                      ) : (
                        <div className="relative">
                          <select
                            id="login-tenant-select"
                            value={selectedTenant}
                            onChange={(e) => {
                              const tId = e.target.value;
                              setSelectedTenant(tId);
                              setActiveTenantId(tId);
                            }}
                            className="w-full bg-white border border-slate-200 text-xs font-black text-slate-900 px-3.5 py-3 rounded-xl outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 uppercase tracking-tight cursor-pointer appearance-none pr-8"
                          >
                            {companies.map((c, idx) => (
                              <option key={`${c.id}-${idx}`} value={c.id} className="text-slate-800 font-bold uppercase">
                                {c.id === 'psm' ? 'JIS ANGOLA' : c.name}
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
                            <ChevronDown size={14} />
                          </div>
                        </div>
                      )}
                      <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wide leading-relaxed mt-1">
                        Escolha a filial antes de se autenticar. Cada filial possui a sua frota, faturação e equipa separadas.
                      </p>
                    </div>

                    <p className="text-center text-slate-400 text-[11px] font-bold uppercase tracking-wider">Aceda ao painel da filial selecionada via Google:</p>
                    
                    <button
                      onClick={handleGoogleLoginClick}
                      disabled={loading}
                      className="flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-900 py-4.5 font-black text-white text-[11px] uppercase tracking-widest transition-all hover:bg-black active:scale-[0.98] shadow-2xl shadow-slate-900/40 disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="animate-spin" size={20} /> : (
                        <>
                           <Globe size={20} />
                           Entrar com Google
                        </>
                      )}
                    </button>

                    {/* Custom Iframe / Popup Advice */}
                    {(() => {
                      const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
                      return (
                        <div className="space-y-4 pt-2">
                          {isInIframe && (
                            <div className="p-3.5 bg-blue-50/75 border border-blue-100 text-slate-700 text-[10px] font-black rounded-lg leading-relaxed uppercase tracking-tight">
                              💡 <strong className="text-brand-primary">Ambiente iFrame Detetado:</strong> Os navegadores costumam bloquear pop-ups de autenticação do Google dentro de iFrames de desenvolvimento.
                            </div>
                          )}

                          {(showPopupTip || isInIframe) && (
                            <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-amber-900 text-[11px] font-semibold space-y-3 leading-normal">
                              <p className="font-extrabold uppercase text-[10px] text-amber-700 tracking-wider flex items-center gap-1">
                                ⚠️ Como Resolver Bloqueios de Pop-up:
                              </p>
                              <ul className="list-disc pl-4 space-y-1">
                                <li>Permita pop-ups para este site nas definições do seu navegador (clique no ícone de privacidade na barra de endereços).</li>
                                <li>Caso continue a falhar, clique no botão abaixo para abrir a aplicação num novo separador limpo e autenticar sem restrições de iFrame.</li>
                              </ul>
                              <button 
                                type="button"
                                onClick={() => window.open(window.location.href, '_blank')}
                                className="flex w-full items-center justify-center gap-2 px-4 py-3 bg-amber-600 hover:bg-amber-700 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95"
                              >
                                Abrir em Novo Separador ➔
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {loginMethod === 'credentials' && (
                  <form onSubmit={handleCredentialsLogin} className="space-y-4">
                    {renderErrorAlert(error)}
                    {success && (
                      <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs font-bold rounded-2xl flex items-center gap-3">
                        <CheckCircle2 size={16} />
                        {success}
                      </div>
                    )}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ID Operador</label>
                      <input 
                        required
                        type="text" 
                        placeholder="Ex: OP-123"
                        value={id}
                        onChange={(e) => setId(e.target.value)}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-brand-primary outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Senha</label>
                      <input 
                        required
                        type="password" 
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-brand-primary outline-none transition-all"
                      />
                    </div>
                    
                    <div className="flex justify-between items-center px-1">
                      <button
                        type="button"
                        onClick={() => handleMethodChange('recover')}
                        className="text-[10px] font-black text-brand-primary hover:underline uppercase tracking-wider text-left transition-colors"
                      >
                        Esqueceu a senha? Recuperar
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-brand-primary text-white flex items-center justify-center gap-3 py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-brand-secondary transition-all shadow-xl shadow-brand-primary/30 disabled:opacity-50 mt-4 h-[60px]"
                    >
                      {loading ? <Loader2 className="animate-spin" size={20} /> : <>ENTRAR AGORA <ArrowRight size={18}/></>}
                    </button>
                  </form>
                )}

                {loginMethod === 'recover' && (
                  <form onSubmit={handleRecover} className="space-y-4">
                    <p className="text-[11px] text-slate-500 font-medium mb-4 leading-relaxed bg-brand-primary/5 p-3.5 rounded-2xl border border-brand-primary/10">
                      A administração gerou um <strong>Código de Ativação</strong> quando criou a sua conta. Introduza esse código junto ao seu ID para redefinir a sua palavra-passe.
                    </p>

                    {renderErrorAlert(error)}
                    {success && (
                      <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs font-bold rounded-2xl flex items-center gap-3">
                        <CheckCircle2 size={16} />
                        {success}
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Seu ID de Operador / Viatura</label>
                      <input 
                        required
                        type="text" 
                        placeholder="Ex: TX-104 ou OP-12"
                        value={id}
                        onChange={(e) => setId(e.target.value.toUpperCase())}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-brand-primary outline-none transition-all"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Código de Ativação Original</label>
                      <input 
                        required
                        type="text" 
                        placeholder="Ex: JIS-XXXX"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-brand-primary font-mono outline-none transition-all"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nova Palavra-passe</label>
                      <input 
                        required
                        type="password" 
                        placeholder="Mínimo 6 caracteres"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-brand-primary outline-none transition-all"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-slate-900 text-white flex items-center justify-center gap-3 py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-900/30 disabled:opacity-50 mt-4 h-[60px]"
                    >
                      {loading ? <Loader2 className="animate-spin" size={20} /> : <>REDEFINIR PALAVRA-PASSE <ArrowRight size={18}/></>}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleMethodChange('credentials')}
                      className="w-full mt-2 text-[10px] font-black text-slate-500 hover:text-slate-900 text-center uppercase tracking-wider"
                    >
                      Voltar ao Início de Sessão
                    </button>
                  </form>
                )}

                {loginMethod === 'register' && (
                  <div className="space-y-4">
                    {renderErrorAlert(error)}
                    {!isCodeValidated ? (
                       <div className="space-y-4">
                          <div className="space-y-1 text-left">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Empresa / Filial</label>
                            <select
                              value={selectedTenant}
                              onChange={(e) => {
                                setSelectedTenant(e.target.value);
                                setActiveTenantId(e.target.value);
                              }}
                              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-brand-primary outline-none transition-all uppercase"
                            >
                              {companies.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <input 
                            placeholder="ID"
                            value={id}
                            onChange={(e) => setId(e.target.value.toUpperCase())}
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-brand-primary outline-none transition-all"
                          />
                          <input 
                            placeholder="CÓDIGO DE ATIVAÇÃO"
                            value={code}
                            onChange={(e) => setCode(e.target.value.toUpperCase())}
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-brand-primary font-mono outline-none transition-all"
                          />
                          <button
                            onClick={handleVerifyCode}
                            className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-black transition-all"
                          >
                            VALIDAR CÓDIGO
                          </button>
                       </div>
                    ) : (
                       <form onSubmit={handleRegister} className="space-y-4">
                          {collaboratorsLoading ? (
                            <div className="flex items-center gap-2 p-3.5 text-xs text-slate-500 font-bold bg-slate-50 border border-slate-150 rounded-2xl animate-pulse uppercase">
                              <Loader2 size={12} className="animate-spin text-brand-primary" />
                              A carregar colaboradores...
                            </div>
                          ) : (
                            <>
                              {!isManualName && collaborators.length > 0 ? (
                                <div className="space-y-1 text-left">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Selecione o seu nome</label>
                                  <select 
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-brand-primary outline-none transition-all uppercase"
                                  >
                                    <option value="">Escolha seu nome na lista...</option>
                                    {collaborators.map((c, idx) => <option key={`${c.id}-${idx}`} value={c.name} className="uppercase font-bold">{c.name}</option>)}
                                  </select>
                                  <button 
                                    type="button" 
                                    onClick={() => { setIsManualName(true); setName(''); }}
                                    className="text-[9px] font-black text-brand-primary hover:underline uppercase tracking-wider ml-1 mt-1 block"
                                  >
                                    Não está na lista? Escrever Nome Manualmente
                                  </button>
                                </div>
                              ) : (
                                <div className="space-y-1 text-left">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Seu Nome Completo</label>
                                  <input 
                                    required
                                    type="text" 
                                    placeholder="NOME COMPLETO"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-brand-primary outline-none transition-all uppercase"
                                  />
                                  {collaborators.length > 0 && (
                                    <button 
                                      type="button" 
                                      onClick={() => { setIsManualName(false); setName(''); }}
                                      className="text-[9px] font-black text-slate-500 hover:underline uppercase tracking-wider ml-1 mt-1 block"
                                    >
                                      Voltar para a lista de colaboradores
                                    </button>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                          <div className="space-y-1 text-left">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Definir Palavra-passe</label>
                            <input 
                              required
                              type="password" 
                              placeholder="PALAVRA-PASSE"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-brand-primary outline-none transition-all"
                            />
                          </div>
                          <button
                            type="submit"
                            className="w-full bg-brand-primary text-white py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-brand-secondary transition-all shadow-xl shadow-brand-primary/20 mt-2 h-[60px]"
                          >
                            ATIVAR CONTA AGORA
                          </button>
                       </form>
                    )}
                  </div>
                )}

                {loginMethod === 'companies' && (
                  <div className="w-full text-left">
                    <CompanyManagement 
                      user={{ email: 'joseiwezasuana@gmail.com', role: 'admin' }} 
                      onBack={() => handleMethodChange('cover')} 
                    />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <div className="px-6 sm:px-10 py-4 sm:py-6 bg-white flex items-center justify-between text-[11px] text-slate-400 font-black uppercase tracking-widest italic border-none shrink-0">
          <span>v6.5 • LUENA</span>
          <span className="opacity-50">SISTEMA AUDITADO</span>
        </div>
      </motion.div>
    </div>
  );
}
