import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, Loader2, Save, User, CheckCircle2, Phone, ShieldCheck, Mail, Building2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, updateDoc, collection, query, where, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { cn } from '../lib/utils';

interface ProfileEditProps {
  user: any;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedUser: any) => void;
}

export default function ProfileEdit({ user, isOpen, onClose, onUpdate }: ProfileEditProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setName(user.name || user.displayName || '');
      setPhone((user.phone || '').replace('+244', '').trim());
      setPhoto(user.photoURL || user.photoUrl || null);
      setSuccessMsg(null);
      setErrorMsg(null);
    }
  }, [user, isOpen]);

  const compressAndSetPhoto = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 360;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
          setPhoto(compressedBase64);
        } else {
          setPhoto(event.target?.result as string);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      compressAndSetPhoto(file);
    }
  };

  const handleRemovePhoto = () => {
    setPhoto(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getRoleBadge = (roleStr: string) => {
    const r = (roleStr || '').toLowerCase().trim();
    if (r === 'admin' || user?.email?.toLowerCase() === 'joseiwezasuana@gmail.com') {
      return { label: 'ADMINISTRADOR MASTER', bg: 'bg-rose-500/10 text-rose-500 border-rose-500/20' };
    }
    if (r === 'gerente' || r === 'manager' || r === 'gestor') {
      return { label: 'GERENTE GERAL / OPERACIONAL', bg: 'bg-amber-500/10 text-amber-500 border-amber-500/20' };
    }
    if (r === 'operator' || r === 'operador') {
      return { label: 'OPERADOR DE CENTRAL', bg: 'bg-blue-500/10 text-blue-500 border-blue-500/20' };
    }
    if (r === 'contabilista' || r === 'finance') {
      return { label: 'CONTABILIDADE & FINANÇAS', bg: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' };
    }
    if (r === 'mecanico' || r === 'mechanic') {
      return { label: 'CHEFIA DE OFICINA / MECÂNICO', bg: 'bg-purple-500/10 text-purple-500 border-purple-500/20' };
    }
    return { label: (roleStr || 'COLABORADOR').toUpperCase(), bg: 'bg-brand-primary/10 text-brand-primary border-brand-primary/20' };
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setErrorMsg("O nome completo não pode estar em branco.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const formattedPhone = phone.trim() ? (phone.startsWith('+244') ? phone.trim() : `+244 ${phone.trim().replace(/^244/, '').trim()}`) : '';

    try {
      const uid = user?.uid || user?.id;

      // 1. Update in Firestore 'users' collection
      if (uid) {
        try {
          const userRef = doc(db, 'users', uid);
          await setDoc(userRef, {
            name: name.trim(),
            phone: formattedPhone,
            photoURL: photo,
            photoUrl: photo,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (e) {
          console.warn("Primary user doc update notice:", e);
        }
      }

      // 2. Cross-sync in 'administrative_staff' and 'drivers' collections by email or name
      if (user?.email) {
        try {
          const staffQ = query(collection(db, 'administrative_staff'), where('email', '==', user.email.toLowerCase()));
          const staffSnap = await getDocs(staffQ);
          for (const docSnap of staffSnap.docs) {
            await updateDoc(doc(db, 'administrative_staff', docSnap.id), {
              name: name.trim(),
              phone: formattedPhone,
              photoURL: photo,
              photoUrl: photo,
              updatedAt: new Date().toISOString()
            }).catch(console.warn);
          }
        } catch (err) {
          console.warn("Cross-collection profile update notice:", err);
        }
      }

      // 3. Persist to local session storage
      const savedSession = localStorage.getItem('local_user_session');
      if (savedSession) {
        try {
          const parsed = JSON.parse(savedSession);
          parsed.name = name.trim();
          parsed.phone = formattedPhone;
          parsed.photoURL = photo;
          parsed.photoUrl = photo;
          localStorage.setItem('local_user_session', JSON.stringify(parsed));
        } catch (e) {}
      }

      // 4. Update user avatar fallback key
      if (uid) {
        try {
          localStorage.setItem(`jis_avatar_${uid}`, photo || '');
        } catch (e) {}
      }

      const updatedUser = { 
        ...user, 
        name: name.trim(),
        phone: formattedPhone,
        photoURL: photo, 
        photoUrl: photo 
      };
      
      onUpdate(updatedUser);
      setSuccessMsg("Perfil atualizado e sincronizado com sucesso!");
      
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1100);
    } catch (error: any) {
      console.error("Error updating profile:", error);
      setErrorMsg("Erro ao guardar as alterações de perfil.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const roleInfo = getRoleBadge(user?.role);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-md"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            className="relative z-10 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg max-h-[92vh] overflow-y-auto my-auto text-slate-900 dark:text-white"
          >
            {/* Header */}
            <div className="px-8 py-6 bg-[#0f172a] text-white flex items-center justify-between border-b border-white/5">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="text-amber-400" size={20} />
                  <h3 className="text-lg font-black uppercase italic tracking-tight">Perfil de Gestão</h3>
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Configuração de Identidade & Contactos</p>
              </div>
              <button 
                onClick={onClose} 
                className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors text-slate-300 hover:text-white cursor-pointer"
              >
                <X size={22} />
              </button>
            </div>

            <div className="p-8 space-y-6 flex flex-col items-center">
              {/* Photo Upload & Preview Section */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative group">
                  <div className="w-32 h-32 rounded-[2rem] overflow-hidden border-4 border-slate-100 dark:border-slate-800 shadow-2xl bg-slate-50 dark:bg-slate-800/80 flex items-center justify-center relative">
                    {photo ? (
                      <img src={photo} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <User size={56} className="text-slate-300 dark:text-slate-600" />
                    )}
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-1.5 backdrop-blur-[2px] cursor-pointer"
                    >
                      <Camera size={26} />
                      <span className="text-[9px] font-black uppercase tracking-widest">Alterar Foto</span>
                    </button>
                  </div>
                  
                  {/* Status Indicator */}
                  <div className="absolute -bottom-1.5 -right-1.5 w-8 h-8 bg-emerald-500 rounded-xl flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-lg" title="Perfil Ativo">
                     <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Camera size={13} />
                    Carregar Foto
                  </button>

                  {photo && (
                    <button 
                      type="button"
                      onClick={handleRemovePhoto}
                      className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                      title="Remover foto"
                    >
                      <Trash2 size={13} />
                      Remover
                    </button>
                  )}
                </div>

                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>

              {/* Account Metadata Badges */}
              <div className="w-full flex flex-wrap items-center justify-center gap-2">
                <span className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border", roleInfo.bg)}>
                  {roleInfo.label}
                </span>
                {user?.tenantId && (
                  <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                    <Building2 size={12} />
                    FILIAL: {user.tenantId.toUpperCase()}
                  </span>
                )}
              </div>

              {/* Alerts */}
              {errorMsg && (
                <div className="w-full p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 rounded-2xl flex items-center gap-2.5 text-xs font-bold animate-in fade-in">
                  <X size={16} className="text-rose-500 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="w-full p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded-2xl flex items-center gap-2.5 text-xs font-bold animate-in fade-in">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Form Fields */}
              <div className="w-full space-y-4">
                {/* Nome Completo */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <User size={13} className="text-brand-primary" />
                    Nome Completo do Gerente / Responsável
                  </label>
                  <input 
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: José Iweza Suana"
                    className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary uppercase tracking-wide transition-all"
                  />
                </div>

                {/* Telefone Operacional */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Phone size={13} className="text-brand-primary" />
                    Telefone Operacional (+244)
                  </label>
                  <div className="flex rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-800/80 focus-within:ring-2 focus-within:ring-brand-primary/50 focus-within:border-brand-primary transition-all">
                    <span className="px-3.5 py-3.5 bg-slate-200/70 dark:bg-slate-700/70 text-slate-700 dark:text-slate-300 font-mono font-black text-xs flex items-center border-r border-slate-200 dark:border-slate-700">
                      +244
                    </span>
                    <input 
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/[^0-9\s]/g, ''))}
                      placeholder="923 456 789"
                      className="w-full px-4 py-3.5 bg-transparent text-sm font-bold font-mono text-slate-900 dark:text-white focus:outline-none tracking-wider"
                    />
                  </div>
                </div>

                {/* E-mail de Acesso (Read-only) */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-0.5">
                      <Mail size={11} /> E-mail Autenticado
                    </p>
                    <p className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 truncate">
                      {user?.email || 'Sem e-mail registado'}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[8px] font-black rounded uppercase shrink-0 font-mono">
                    VERIFICADO
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="w-full flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  onClick={handleSave}
                  disabled={isSubmitting}
                  className="flex-[2] py-4 bg-brand-primary text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-brand-secondary transition-all flex items-center justify-center gap-2 shadow-xl shadow-brand-primary/25 font-bold disabled:opacity-50 cursor-pointer active:scale-98"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="animate-spin" size={16} /> A sincronizar...
                    </>
                  ) : (
                    <>
                      <Save size={16} /> Guardar Alterações
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="px-8 py-3.5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center">
              <p className="text-[8px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest italic">
                JIS ANGOLA • Sincronização central em tempo real
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
