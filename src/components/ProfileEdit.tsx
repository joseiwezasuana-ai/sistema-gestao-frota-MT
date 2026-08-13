import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, Loader2, Save, User, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { cn } from '../lib/utils';

interface ProfileEditProps {
  user: any;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedUser: any) => void;
}

export default function ProfileEdit({ user, isOpen, onClose, onUpdate }: ProfileEditProps) {
  const [photo, setPhoto] = useState<string | null>(user?.photoURL || user?.photoUrl || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setPhoto(user.photoURL || user.photoUrl || null);
    }
  }, [user]);

  const compressAndSetPhoto = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 320;
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
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.82);
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

  const handleSave = async () => {
    setIsSubmitting(true);
    setSuccessMsg(null);
    try {
      const uid = user?.uid || user?.id;

      // 1. Update in Firestore 'users' collection
      if (uid) {
        try {
          const userRef = doc(db, 'users', uid);
          await updateDoc(userRef, {
            photoURL: photo,
            photoUrl: photo,
            updatedAt: new Date().toISOString()
          });
        } catch (e) {
          console.warn("Primary user doc update notice:", e);
        }
      }

      // 2. Cross-sync in 'administrative_staff' and 'drivers' collections by email or name
      if (user?.email) {
        try {
          const staffQ = query(collection(db, 'administrative_staff'), where('email', '==', user.email));
          const staffSnap = await getDocs(staffQ);
          staffSnap.docs.forEach(async (docSnap) => {
            await updateDoc(doc(db, 'administrative_staff', docSnap.id), { photoURL: photo, photoUrl: photo });
          });

          const driverQ = query(collection(db, 'drivers'), where('email', '==', user.email));
          const driverSnap = await getDocs(driverQ);
          driverSnap.docs.forEach(async (docSnap) => {
            await updateDoc(doc(db, 'drivers', docSnap.id), { photoURL: photo, photoUrl: photo });
          });
        } catch (err) {
          console.warn("Cross-collection profile update notice:", err);
        }
      }

      // 3. Persist to local session storage
      const savedSession = localStorage.getItem('local_user_session');
      if (savedSession) {
        try {
          const parsed = JSON.parse(savedSession);
          parsed.photoURL = photo;
          parsed.photoUrl = photo;
          localStorage.setItem('local_user_session', JSON.stringify(parsed));
        } catch (e) {}
      }

      // 4. Also store user avatar fallback key
      if (uid) {
        try {
          localStorage.setItem(`jis_avatar_${uid}`, photo || '');
        } catch (e) {}
      }

      const updatedUser = { ...user, photoURL: photo, photoUrl: photo };
      onUpdate(updatedUser);
      setSuccessMsg("Foto de perfil sincronizada no sistema completo!");
      
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1200);
    } catch (error) {
      console.error("Error updating profile photo:", error);
      alert("Erro ao atualizar foto de perfil.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative z-10 bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md max-h-[90vh] overflow-y-auto my-auto"
          >
            <div className="px-8 py-6 bg-[#0f172a] text-white flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black uppercase italic tracking-tight">Editar Perfil</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Personalize a sua identidade visual</p>
              </div>
              <button onClick={onClose} className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-8 space-y-8 flex flex-col items-center">
              <div className="relative group">
                <div className="w-40 h-40 rounded-[2.5rem] overflow-hidden border-4 border-slate-100 shadow-2xl bg-slate-50 flex items-center justify-center relative">
                  {photo ? (
                    <img src={photo} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <User size={64} className="text-slate-200" />
                  )}
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-2 backdrop-blur-[2px]"
                  >
                    <Camera size={32} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Alterar Foto</span>
                  </button>
                </div>
                
                {/* Status Indicator */}
                <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-brand-primary rounded-2xl flex items-center justify-center border-4 border-white shadow-xl">
                   <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
                </div>
              </div>

              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                className="hidden" 
              />

              <div className="w-full space-y-6">
                {successMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-2 text-xs font-bold animate-in fade-in duration-300">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>{successMsg}</span>
                  </div>
                )}

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 italic">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Informação de Conta</p>
                  <p className="text-sm font-black text-slate-900 truncate">{user?.name}</p>
                  <p className="text-[10px] font-bold text-brand-primary uppercase mt-1 tracking-tighter opacity-70">{user?.email}</p>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={onClose}
                    className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all font-bold"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleSave}
                    disabled={isSubmitting}
                    className="flex-[2] py-4 bg-brand-primary text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-brand-secondary transition-all flex items-center justify-center gap-3 shadow-xl shadow-brand-primary/20 font-bold disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : (
                      <>
                        <Save size={18} /> Guardar Perfil
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-center">
              <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest italic">A imagem será armazenada de forma segura na central PSM</p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
