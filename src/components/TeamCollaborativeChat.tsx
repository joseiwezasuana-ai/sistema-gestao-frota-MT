import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { cn } from '../lib/utils';
import { 
  X, Send, Users, User, MessageSquare, Shield, Car, Search, CheckCheck, Sparkles, ArrowLeft,
  Reply, Forward, Trash2, MoreVertical, Image as ImageIcon, Camera, Palette, Sliders, Volume2, VolumeX, Bell
} from 'lucide-react';
import { db, getActiveTenantId } from '../lib/firebase';
import { 
  collection, query, where, onSnapshot, addDoc, serverTimestamp, getDocs, limit, deleteDoc, doc, updateDoc
} from 'firebase/firestore';
import { presenceService, UserPresence } from '../services/presenceService';
import { resolveDriverName, isIdLike } from '../utils/driverResolver';

interface TeamCollaborativeChatProps {
  currentUser: {
    uid?: string;
    id?: string;
    name?: string;
    role?: string;
    vehiclePrefix?: string;
    phone?: string;
    photoURL?: string;
    photoUrl?: string;
    companyName?: string;
    tenantName?: string;
  };
  onClose: () => void;
  isOpen: boolean;
  isEmbedded?: boolean;
}

interface ChatMessage {
  id: string;
  channel: string;
  senderId: string;
  senderName: string;
  senderRole?: string;
  senderVehicle?: string;
  senderPhotoURL?: string;
  text: string;
  timestamp: any;
  createdAtIso?: string;
  recipientId?: string;
  replyToId?: string;
  replyToText?: string;
  replyToName?: string;
  reactions?: Record<string, string[]>;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  vehiclePrefix?: string;
  phone?: string;
  photoURL?: string;
  online: boolean;
  lastSeenText?: string;
  lastSeenIso?: string;
}

interface MessageRowItemProps {
  msg: ChatMessage;
  isMe: boolean;
  senderPhoto?: string;
  formattedTime: string;
  currentUserId: string;
  messageMenuOpen: string | null;
  setMessageMenuOpen: (id: string | null) => void;
  setReplyingTo: (msg: ChatMessage) => void;
  setForwardModalOpen: (msg: ChatMessage) => void;
  handleDeleteMessage: (msgId: string) => void;
  handleToggleReaction: (msg: ChatMessage, emoji: string) => void;
}

const MessageRowItem: React.FC<MessageRowItemProps> = ({
  msg,
  isMe,
  senderPhoto,
  formattedTime,
  currentUserId,
  messageMenuOpen,
  setMessageMenuOpen,
  setReplyingTo,
  setForwardModalOpen,
  handleDeleteMessage,
  handleToggleReaction,
}) => {
  const longPressTimerRef = useRef<any>(null);

  const startLongPress = () => {
    longPressTimerRef.current = setTimeout(() => {
      setMessageMenuOpen(msg.id);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 450);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const x = useMotionValue(0);
  const replyOpacity = useTransform(x, [15, 60], [0, 1]);
  const forwardOpacity = useTransform(x, [-60, -15], [1, 0]);

  const handleDragEnd = (_: any, info: any) => {
    cancelLongPress();
    const offsetX = info.offset.x;
    if (offsetX > 55) {
      setReplyingTo(msg);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(30);
      }
    } else if (offsetX < -55) {
      setMessageMenuOpen(msg.id);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(30);
      }
    }
  };

  return (
    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group relative my-1.5`}>
      {!isMe && (
        <div className="flex items-center gap-1.5 mb-1 px-1">
          {senderPhoto ? (
            <img 
              src={senderPhoto} 
              alt={msg.senderName} 
              className="w-5 h-5 rounded-full object-cover border border-indigo-400/40 shrink-0 shadow-sm" 
              referrerPolicy="no-referrer" 
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-[8px] font-black text-indigo-200 shrink-0">
              {msg.senderName ? msg.senderName.charAt(0).toUpperCase() : 'C'}
            </div>
          )}
          <span className="text-[9.5px] font-black uppercase text-indigo-300">
            {msg.senderName}
          </span>
          {msg.senderVehicle && (
            <span className="text-[8px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded font-extrabold uppercase">
              {msg.senderVehicle}
            </span>
          )}
          {msg.senderRole && msg.senderRole !== 'motorista' && (
            <span className="text-[8px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-black uppercase">
              {msg.senderRole}
            </span>
          )}
        </div>
      )}

      <div className={`relative flex items-center gap-2 w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
        {/* Gesture feedback indicators behind bubble */}
        <div className="absolute inset-y-0 left-0 right-0 pointer-events-none flex items-center justify-between px-2 z-0">
          <motion.div 
            style={{ opacity: replyOpacity }}
            className="flex items-center gap-1.5 text-emerald-400 font-black text-[10px] bg-slate-950/90 px-2.5 py-1 rounded-full border border-emerald-500/40 shadow-lg"
          >
            <Reply size={13} />
            <span>Responder</span>
          </motion.div>

          <motion.div 
            style={{ opacity: forwardOpacity }}
            className="flex items-center gap-1.5 text-amber-400 font-black text-[10px] bg-slate-950/90 px-2.5 py-1 rounded-full border border-amber-500/40 shadow-lg"
          >
            <span>Ações</span>
            <Forward size={13} />
          </motion.div>
        </div>

        {/* Action Menu button for own messages (left of bubble) */}
        {isMe && (
          <button 
            onClick={() => setMessageMenuOpen(messageMenuOpen === msg.id ? null : msg.id)}
            className={`p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-full transition-colors shrink-0 z-10 ${messageMenuOpen === msg.id ? 'opacity-100' : 'opacity-0'} group-hover:opacity-100 focus:opacity-100`}
            title="Opções da mensagem"
          >
            <MoreVertical size={14} />
          </button>
        )}

        {/* Draggable & Long-Pressable Message Bubble */}
        <motion.div
          style={{ x }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.35}
          onDragEnd={handleDragEnd}
          onTouchStart={startLongPress}
          onTouchEnd={cancelLongPress}
          onTouchMove={cancelLongPress}
          onMouseDown={startLongPress}
          onMouseUp={cancelLongPress}
          onMouseLeave={cancelLongPress}
          className={`relative z-10 max-w-[85%] sm:max-w-[70%] p-3.5 rounded-2xl text-xs leading-relaxed font-sans shadow-md select-none touch-pan-y cursor-grab active:cursor-grabbing ${
            isMe
              ? 'bg-brand-primary text-white rounded-br-none border border-brand-primary/50'
              : 'bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700/80'
          }`}
        >
          {msg.replyToId && (
            <div className={`mb-2 p-2 rounded text-[10px] border-l-2 ${isMe ? 'bg-black/20 border-white/50 text-white/80' : 'bg-slate-900/50 border-slate-500 text-slate-400'}`}>
              <p className="font-bold mb-0.5">{msg.replyToName}</p>
              <p className="truncate line-clamp-2">{msg.replyToText}</p>
            </div>
          )}
          <p className="whitespace-pre-wrap font-medium">{msg.text}</p>

          {/* Reaction pills below text inside message bubble */}
          {msg.reactions && Object.keys(msg.reactions).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5 pt-1.5 border-t border-white/10">
              {Object.entries(msg.reactions).map(([emoji, users]) => {
                if (!users || users.length === 0) return null;
                const hasReacted = users.includes(currentUserId);
                return (
                  <button
                    key={emoji}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleReaction(msg, emoji);
                    }}
                    className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border transition-all active:scale-95 ${
                      hasReacted
                        ? 'bg-indigo-600/50 border-indigo-300 text-white shadow-sm'
                        : 'bg-slate-900/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                    }`}
                    title={`${users.length} reação(ões)`}
                  >
                    <span>{emoji}</span>
                    <span className="text-[9px] font-black">{users.length}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className={`flex items-center justify-end gap-1 mt-1 text-[8.5px] font-bold ${
            isMe ? 'text-amber-200/90' : 'text-slate-400'
          }`}>
            <span>{formattedTime}</span>
            {isMe && <CheckCheck size={11} className="text-emerald-300" />}
          </div>
        </motion.div>

        {/* Action Menu button for other's messages (right of bubble) */}
        {!isMe && (
          <button 
            onClick={() => setMessageMenuOpen(messageMenuOpen === msg.id ? null : msg.id)}
            className={`p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-full transition-colors shrink-0 z-10 ${messageMenuOpen === msg.id ? 'opacity-100' : 'opacity-0'} group-hover:opacity-100 focus:opacity-100`}
            title="Opções da mensagem"
          >
            <MoreVertical size={14} />
          </button>
        )}

        {/* Action Menu Modal Popover */}
        {messageMenuOpen === msg.id && (
          <>
            {/* Full screen backdrop overlay to close menu on click/tap outside */}
            <div 
              className="fixed inset-0 z-[125] cursor-default bg-transparent"
              onClick={(e) => {
                e.stopPropagation();
                setMessageMenuOpen(null);
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                setMessageMenuOpen(null);
              }}
            />

            <div className={`absolute top-full mt-1 ${isMe ? 'right-1 sm:right-2' : 'left-1 sm:left-2'} z-[130] bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-2 min-w-[220px] max-w-[90vw] animate-in fade-in zoom-in-95 duration-100`}>
              {/* Emoji Reactions Bar */}
              <div className="flex items-center justify-around gap-1 pb-2 mb-1.5 border-b border-slate-700/80 px-1">
                {['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥'].map((emoji) => {
                  const userList = msg.reactions?.[emoji] || [];
                  const hasReacted = userList.includes(currentUserId);
                  return (
                    <button
                      key={emoji}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleReaction(msg, emoji);
                        setMessageMenuOpen(null);
                      }}
                      className={`p-1.5 rounded-xl text-sm transition-transform active:scale-125 ${
                        hasReacted ? 'bg-indigo-600/50 ring-1 ring-indigo-400 scale-110' : 'hover:bg-slate-700'
                      }`}
                      title={`Reagir com ${emoji}`}
                    >
                      {emoji}
                    </button>
                  );
                })}
              </div>

              <button 
                onClick={() => {
                  setReplyingTo(msg);
                  setMessageMenuOpen(null);
                }}
                className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2 font-medium rounded-lg"
              >
                <Reply size={14} className="text-emerald-400" /> Responder
              </button>
              <button 
                onClick={() => {
                  setForwardModalOpen(msg);
                  setMessageMenuOpen(null);
                }}
                className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2 font-medium rounded-lg"
              >
                <Forward size={14} className="text-amber-400" /> Reencaminhar
              </button>
              {isMe && (
                <button 
                  onClick={() => handleDeleteMessage(msg.id)}
                  className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-slate-700 hover:text-red-300 flex items-center gap-2 border-t border-slate-700/50 mt-1 font-medium rounded-lg"
                >
                  <Trash2 size={14} /> Eliminar
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const CHAT_WALLPAPER_PRESETS = [
  {
    id: 'default',
    name: 'Obsidiana Padrão',
    description: 'Fundo escuro clássico de alta visibilidade',
    url: '',
  },
  {
    id: 'luena_night',
    name: 'Luena Nocturna',
    description: 'Luzes da cidade de Luena e frota em movimento',
    url: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=1200&auto=format&fit=crop&q=80',
  },
  {
    id: 'cyber_grid',
    name: 'Cyber Grid Neon',
    description: 'Estilo tecnológico de comando e controlo',
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&auto=format&fit=crop&q=80',
  },
  {
    id: 'muxima_sunset',
    name: 'Pôr do Sol Muxima',
    description: 'Tons quentes de âmbar e dourado',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&auto=format&fit=crop&q=80',
  },
  {
    id: 'emerald_matrix',
    name: 'Matriz Esmeralda',
    description: 'Ambiente verde militar e operação segura',
    url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&auto=format&fit=crop&q=80',
  },
  {
    id: 'leather_black',
    name: 'Textura Executiva',
    description: 'Acabamento premium de couro escuro',
    url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=1200&auto=format&fit=crop&q=80',
  }
];

export const TeamCollaborativeChat: React.FC<TeamCollaborativeChatProps> = ({
  currentUser,
  onClose,
  isOpen,
  isEmbedded = false
}) => {
  const currentUserId = currentUser?.uid || currentUser?.id || 'guest';
  const currentUserName = currentUser?.name || 'Colaborador';
  const currentUserRole = currentUser?.role || 'motorista';

  // Auto mark messages as read when chat is open or embedded
  useEffect(() => {
    if ((isOpen || isEmbedded) && currentUserId && currentUserId !== 'guest') {
      const now = Date.now();
      try {
        localStorage.setItem(`jis_chat_last_read_${currentUserId}`, now.toString());
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('team-chat-read', { detail: { userId: currentUserId, time: now } }));
        }
      } catch (e) {
        console.warn("Error marking chat read:", e);
      }
    }
  }, [isOpen, isEmbedded, currentUserId]);

  const [activeTab, setActiveTab] = useState<'general' | 'direct'>('general');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [selectedRecipient, setSelectedRecipient] = useState<TeamMember | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchMember, setSearchMember] = useState('');
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [messageMenuOpen, setMessageMenuOpen] = useState<string | null>(null);
  const [forwardModalOpen, setForwardModalOpen] = useState<ChatMessage | null>(null);

  // Dynamic Company Name
  const [companyName, setCompanyName] = useState<string>(() => {
    return currentUser?.companyName || currentUser?.tenantName || (typeof localStorage !== 'undefined' ? localStorage.getItem('jis_company_name') : '') || 'SUPER TAXI';
  });

  useEffect(() => {
    if (currentUser?.companyName) {
      setCompanyName(currentUser.companyName);
      return;
    }
    if (currentUser?.tenantName) {
      setCompanyName(currentUser.tenantName);
      return;
    }
    const tenantId = getActiveTenantId() || 'psm';
    if (tenantId) {
      const unsub = onSnapshot(doc(db, 'tenants', tenantId), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const name = data?.name || data?.companyName || data?.title;
          if (name) {
            setCompanyName(name);
            try { localStorage.setItem('jis_company_name', name); } catch(e){}
          }
        }
      }, (err) => {
        console.warn("Notice loading tenant for chat header:", err);
      });
      return () => unsub();
    }
  }, [currentUser?.companyName, currentUser?.tenantName]);

  // Background Wallpaper Customization
  const [chatWallpaper, setChatWallpaper] = useState<string>(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(`jis_chat_wallpaper_${currentUserId}`) || 'default';
    }
    return 'default';
  });
  const [wallpaperOpacity, setWallpaperOpacity] = useState<number>(() => {
    if (typeof localStorage !== 'undefined') {
      const val = localStorage.getItem(`jis_chat_wallpaper_opacity_${currentUserId}`);
      return val ? parseFloat(val) : 0.45;
    }
    return 0.45;
  });
  const [isWallpaperModalOpen, setIsWallpaperModalOpen] = useState(false);
  const wallpaperFileInputRef = useRef<HTMLInputElement>(null);
  const profileFileInputRef = useRef<HTMLInputElement>(null);
  const [isUpdatingProfilePhoto, setIsUpdatingProfilePhoto] = useState(false);
  
  // Mobile view toggle: 'list' shows members/channels list, 'chat' shows the conversation
  const [mobileScreen, setMobileScreen] = useState<'list' | 'chat'>('list');

  // SOUND, NUDGE, AND BACKGROUND NOTIFICATIONS ENGINE
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(`jis_chat_sound_enabled_${currentUserId}`) !== 'false';
    }
    return true;
  });
  const [receivedNudge, setReceivedNudge] = useState<{ senderId: string; senderName: string; text: string } | null>(null);
  const [activeNotification, setActiveNotification] = useState<{ id: string; senderName: string; text: string; channel: string; senderId: string } | null>(null);
  const [nudgeCooldown, setNudgeCooldown] = useState(false);
  const startupTimeRef = useRef(new Date().toISOString());

  // Web Audio API Synthesizer Sound Generator
  const playNotificationSound = (type: 'message' | 'nudge' = 'message') => {
    if (!soundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      if (type === 'message') {
        // Crisp gentle ping
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5 Note
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5 Note
        
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } else {
        // Intense wake-up buzzer sequence (Despertar)
        for (let i = 0; i < 3; i++) {
          const time = ctx.currentTime + i * 0.22;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(880, time);
          osc.frequency.setValueAtTime(1100, time + 0.08);
          
          gain.gain.setValueAtTime(0.35, time);
          gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(time);
          osc.stop(time + 0.2);
        }
      }
    } catch (err) {
      console.warn('AudioContext sound blocked or failed:', err);
    }
  };

  // Send Nudge / Alarm Wakeup Message
  const handleSendNudge = async () => {
    if (!selectedRecipient) return;
    if (nudgeCooldown) {
      alert("Aguarde um momento antes de enviar outra chamada de atenção!");
      return;
    }

    const ids = [currentUserId, selectedRecipient.id].sort();
    const targetChannel = `dm_${ids[0]}_${ids[1]}`;

    const msgPayload = {
      channel: targetChannel,
      senderId: currentUserId,
      senderName: currentUserName,
      senderRole: currentUserRole,
      senderVehicle: currentUser?.vehiclePrefix || '',
      senderPhotoURL: currentUser?.photoURL || currentUser?.photoUrl || (typeof localStorage !== 'undefined' ? localStorage.getItem(`jis_avatar_${currentUserId}`) || '' : ''),
      recipientId: selectedRecipient.id,
      text: "🚨 ATENÇÃO: Por favor, responda de imediato! (Chamada de Atenção)",
      timestamp: serverTimestamp(),
      createdAtIso: new Date().toISOString(),
      type: 'nudge',
      isNudge: true
    };

    setNudgeCooldown(true);
    setTimeout(() => setNudgeCooldown(false), 12000); // 12 seconds cooldown

    try {
      await addDoc(collection(db, 'team_messages'), msgPayload);
      playNotificationSound('message'); // Play locally as well
    } catch (err) {
      console.error("Error sending nudge:", err);
      alert("Erro ao enviar chamada de atenção.");
    }
  };

  // Background Messages listener for real-time sound + toast alerts
  useEffect(() => {
    const qBackground = query(
      collection(db, 'team_messages'),
      limit(5)
    );

    let isFirstEvent = true;

    const unsub = onSnapshot(qBackground, (snapshot) => {
      if (isFirstEvent) {
        isFirstEvent = false;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const msg = { id: change.doc.id, ...change.doc.data() } as ChatMessage & { isNudge?: boolean; type?: string };
          
          const msgTime = msg.createdAtIso ? new Date(msg.createdAtIso).getTime() : Date.now();
          const startupTime = new Date(startupTimeRef.current).getTime();
          
          if (msgTime < startupTime - 8000) {
            // Filter old records
            return;
          }

          if (msg.senderId === currentUserId) {
            return;
          }

          const isDMForMe = msg.channel.startsWith('dm_') && msg.channel.includes(currentUserId);
          const isGeneral = msg.channel === 'general';

          if (isGeneral || isDMForMe) {
            const isNudge = msg.isNudge === true || msg.type === 'nudge';
            
            // Wake up sound + vibration
            playNotificationSound(isNudge ? 'nudge' : 'message');

            if (isNudge) {
              if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate([300, 100, 300, 100, 400]);
              }
              setReceivedNudge({
                senderId: msg.senderId,
                senderName: msg.senderName,
                text: msg.text
              });
            } else {
              const isChatClosed = !isOpen;
              const isDifferentConversation = isOpen && activeTab === 'direct' && selectedRecipient?.id !== msg.senderId && msg.channel !== 'general';
              
              if (isChatClosed || isDifferentConversation) {
                setActiveNotification({
                  id: msg.id,
                  senderName: msg.senderName,
                  text: msg.text,
                  channel: msg.channel,
                  senderId: msg.senderId
                });
                
                setTimeout(() => {
                  setActiveNotification(prev => prev?.id === msg.id ? null : prev);
                }, 6000);
              }
            }
          }
        }
      });
    }, (err) => console.warn('Background messages listener error:', err));

    return () => unsub();
  }, [currentUserId, isOpen, activeTab, selectedRecipient, soundEnabled]);

  // Handle custom window events to open/focus specific channels
  useEffect(() => {
    const handleOpenReq = (e: any) => {
      if (e.detail?.tab) {
        setActiveTab(e.detail.tab);
      }
      if (e.detail?.recipient) {
        const matchingMember = teamMembers.find(m => m.id === e.detail.recipient);
        if (matchingMember) {
          setSelectedRecipient(matchingMember);
        }
      }
      setMobileScreen('chat');
    };
    window.addEventListener('focus-team-chat-channel', handleOpenReq);
    return () => window.removeEventListener('focus-team-chat-channel', handleOpenReq);
  }, [teamMembers]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Custom Wallpaper upload handler
  const handleUploadWallpaper = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          let width = img.width;
          let height = img.height;
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.85);
            setChatWallpaper(compressed);
            localStorage.setItem(`jis_chat_wallpaper_${currentUserId}`, compressed);
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  // Direct Profile Photo upload handler from Chat
  const handleUploadProfilePhotoFromChat = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUpdatingProfilePhoto(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
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

          try {
            if (currentUser) {
              currentUser.photoURL = compressedBase64;
              currentUser.photoUrl = compressedBase64;
            }

            if (currentUserId && currentUserId !== 'guest') {
              await updateDoc(doc(db, 'users', currentUserId), {
                photoURL: compressedBase64,
                photoUrl: compressedBase64,
                updatedAt: new Date().toISOString()
              });
            }

            const savedSession = localStorage.getItem('local_user_session');
            if (savedSession) {
              try {
                const parsed = JSON.parse(savedSession);
                parsed.photoURL = compressedBase64;
                parsed.photoUrl = compressedBase64;
                localStorage.setItem('local_user_session', JSON.stringify(parsed));
              } catch (err) {}
            }

            if (currentUserId) {
              localStorage.setItem(`jis_avatar_${currentUserId}`, compressedBase64);
            }

            alert("Foto de perfil atualizada no sistema completo!");
          } catch (err) {
            console.error("Error updating profile photo from chat:", err);
            alert("Erro ao guardar foto de perfil.");
          } finally {
            setIsUpdatingProfilePhoto(false);
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Reset to list view when chat is opened
  useEffect(() => {
    if (isOpen) {
      setMobileScreen('list');
    }
  }, [isOpen]);

  // Real-time Presence, Drivers, Staff, and Users directory synchronization
  useEffect(() => {
    if (!isOpen && !isEmbedded) return;
    setLoadingMembers(true);

    let masterDocs: any[] = [];
    let vehiclesDocs: any[] = [];
    let staffDocs: any[] = [];
    let usersDocs: any[] = [];
    let presenceMap = new Map<string, UserPresence>();

    const activeStatusesLower = ['available', 'ativo', 'disponível', 'disponivel', 'busy', 'ocupado', 'em serviço', 'em servico', 'em curso'];

    const normalizeTenant = (t?: string) => {
      if (!t) return 'psm';
      const clean = String(t).trim().toLowerCase();
      if (clean === 'psmoreira' || clean === 'psm_angola' || clean === 'super_taxi_psm') return 'psm';
      return clean;
    };
    const activeTenantClean = normalizeTenant(getActiveTenantId());

    const isSameTenant = (itemTenant?: string) => {
      if (!itemTenant) return true; // legacy or default record
      const clean = normalizeTenant(itemTenant);
      return clean === activeTenantClean || clean === 'all' || activeTenantClean === 'all';
    };

    const recomputeMembers = () => {
      const membersMap = new Map<string, TeamMember>();
      const activeDriverIds = new Set<string>();

      // Active fleet drivers (from drivers collection)
      vehiclesDocs.forEach((d) => {
        if (!isSameTenant(d.tenantId || d.companyId || d.tenant)) return;
        const dId = d.driverId || d.id;
        const status = String(d.status || '').toLowerCase();
        const isFleetActive = d.isOnline === true || d.shiftActive === true || activeStatusesLower.includes(status);
        if (isFleetActive && dId) {
          activeDriverIds.add(dId);
        }

        if (dId && dId !== currentUserId) {
          const rawName = d.name || d.driverName || dId;
          const resolvedName = resolveDriverName(rawName, masterDocs, vehiclesDocs, usersDocs);
          const { isOnline, lastSeenText, lastSeenIso } = presenceService.checkIsOnline(dId, presenceMap, activeDriverIds);
          const effectiveOnline = isOnline || isFleetActive;

          membersMap.set(dId, {
            id: dId,
            name: resolvedName,
            role: 'motorista',
            vehiclePrefix: d.vehiclePrefix || d.prefix || 'TAX-JIS',
            phone: d.phone || d.phoneNumber || '',
            photoURL: d.photoURL || d.photoUrl || d.photo || (typeof localStorage !== 'undefined' ? localStorage.getItem(`jis_avatar_${dId}`) || '' : ''),
            online: effectiveOnline,
            lastSeenText: effectiveOnline ? 'Online no Turno' : (lastSeenText || 'Offline'),
            lastSeenIso
          });
        }
      });

      // Master Drivers directory (ensures all registered drivers are listed with their clean human name)
      masterDocs.forEach((m) => {
        if (!isSameTenant(m.tenantId || m.companyId || m.tenant)) return;
        const mId = m.id || m.uid || m.driverId;
        if (mId && mId !== currentUserId) {
          const { isOnline, lastSeenText, lastSeenIso } = presenceService.checkIsOnline(mId, presenceMap, activeDriverIds);
          const existing = membersMap.get(mId);
          const resolvedName = resolveDriverName(m.name || mId, masterDocs, vehiclesDocs, usersDocs);
          
          if (!existing) {
            membersMap.set(mId, {
              id: mId,
              name: resolvedName,
              role: 'motorista',
              vehiclePrefix: m.prefix || m.vehiclePrefix || '',
              phone: m.phone || '',
              photoURL: m.photoURL || m.photoUrl || m.photo || (typeof localStorage !== 'undefined' ? localStorage.getItem(`jis_avatar_${mId}`) || '' : ''),
              online: isOnline,
              lastSeenText: isOnline ? 'Online' : (lastSeenText || 'Offline'),
              lastSeenIso
            });
          } else if (isIdLike(existing.name) && !isIdLike(resolvedName)) {
            existing.name = resolvedName;
          }
        }
      });

      // Administrative Staff (Gerente, Operador, Mecânico, Contabilista, Admin)
      staffDocs.forEach((s) => {
        if (!isSameTenant(s.tenantId || s.companyId || s.tenant)) return;
        const sId = s.id || s.uid;
        if (sId && sId !== currentUserId) {
          const { isOnline, lastSeenText, lastSeenIso } = presenceService.checkIsOnline(sId, presenceMap, activeDriverIds);
          membersMap.set(sId, {
            id: sId,
            name: s.name || 'Colaborador',
            role: s.role || 'operador',
            phone: s.phone || '',
            photoURL: s.photoURL || s.photoUrl || s.photo || (typeof localStorage !== 'undefined' ? localStorage.getItem(`jis_avatar_${sId}`) || '' : ''),
            online: isOnline,
            lastSeenText: isOnline ? 'Online' : (lastSeenText || 'Offline'),
            lastSeenIso
          });
        }
      });

      // Platform Registered Users
      usersDocs.forEach((u) => {
        if (!isSameTenant(u.tenantId || u.companyId || u.tenant)) return;
        const uId = u.uid || u.id;
        if (uId && uId !== currentUserId && !membersMap.has(uId)) {
          const resolvedName = (u.role === 'driver' || isIdLike(u.name))
            ? resolveDriverName(u.name || u.email?.split('@')[0] || uId, masterDocs, vehiclesDocs, usersDocs)
            : (u.name || u.email?.split('@')[0] || 'Colaborador');
          const { isOnline, lastSeenText, lastSeenIso } = presenceService.checkIsOnline(uId, presenceMap, activeDriverIds);
          
          membersMap.set(uId, {
            id: uId,
            name: resolvedName,
            role: u.role || 'colaborador',
            phone: u.phone || '',
            photoURL: u.photoURL || u.photoUrl || u.photo || (typeof localStorage !== 'undefined' ? localStorage.getItem(`jis_avatar_${uId}`) || '' : ''),
            online: isOnline,
            lastSeenText: isOnline ? 'Online' : (lastSeenText || 'Offline'),
            lastSeenIso
          });
        }
      });

      const list = Array.from(membersMap.values());
      // Sort: Online members first (alphabetical), then Offline members (alphabetical)
      list.sort((a, b) => {
        if (a.online && !b.online) return -1;
        if (!a.online && b.online) return 1;
        return a.name.localeCompare(b.name);
      });

      setTeamMembers(list);
      setLoadingMembers(false);

      // Keep active direct chat recipient live state synchronized
      setSelectedRecipient((prev) => {
        if (!prev) return null;
        const fresh = list.find((m) => m.id === prev.id);
        return fresh || prev;
      });
    };

    const unsubPresence = onSnapshot(collection(db, 'user_presence'), (snap) => {
      presenceMap = new Map();
      snap.docs.forEach((d) => {
        presenceMap.set(d.id, { uid: d.id, ...d.data() } as UserPresence);
      });
      recomputeMembers();
    }, (e) => console.warn('[Chat] Presence sync error:', e));

    const unsubDrivers = onSnapshot(collection(db, 'drivers'), (snap) => {
      vehiclesDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      recomputeMembers();
    }, (e) => console.warn('[Chat] Drivers sync error:', e));

    const unsubMaster = onSnapshot(collection(db, 'drivers_master'), (snap) => {
      masterDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      recomputeMembers();
    }, (e) => console.warn('[Chat] Master drivers sync error:', e));

    const unsubStaff = onSnapshot(collection(db, 'administrative_staff'), (snap) => {
      staffDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      recomputeMembers();
    }, (e) => console.warn('[Chat] Staff sync error:', e));

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      usersDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      recomputeMembers();
    }, (e) => console.warn('[Chat] Users sync error:', e));

    return () => {
      unsubPresence();
      unsubDrivers();
      unsubMaster();
      unsubStaff();
      unsubUsers();
    };
  }, [isOpen, isEmbedded, currentUserId]);

  // Listen for messages depending on general channel vs direct chat (scoped by tenant)
  useEffect(() => {
    if (!isOpen && !isEmbedded) return;

    const normalizeTenant = (t?: string) => {
      if (!t) return 'psm';
      const clean = String(t).trim().toLowerCase();
      if (clean === 'psmoreira' || clean === 'psm_angola' || clean === 'super_taxi_psm') return 'psm';
      return clean;
    };
    const activeTenantClean = normalizeTenant(getActiveTenantId());

    let targetChannel = activeTenantClean === 'psm' ? 'general' : `general_${activeTenantClean}`;
    if (activeTab === 'direct' && selectedRecipient) {
      // Sort IDs to get deterministic channel key
      const ids = [currentUserId, selectedRecipient.id].sort();
      targetChannel = `dm_${ids[0]}_${ids[1]}`;
    }

    const qMsgs = query(
      collection(db, 'team_messages'),
      where('channel', '==', targetChannel),
      limit(100)
    );

    const unsub = onSnapshot(qMsgs, (snapshot) => {
      const docs = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as ChatMessage[];

      docs.sort((a, b) => {
        const timeA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : new Date(a.createdAtIso || 0).getTime();
        const timeB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : new Date(b.createdAtIso || 0).getTime();
        return timeA - timeB;
      });

      setMessages(docs);
    }, (err) => console.warn('Chat messages sync error:', err));

    return () => unsub();
  }, [isOpen, activeTab, selectedRecipient, currentUserId]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanText = inputText.trim();
    if (!cleanText) return;

    const normalizeTenant = (t?: string) => {
      if (!t) return 'psm';
      const clean = String(t).trim().toLowerCase();
      if (clean === 'psmoreira' || clean === 'psm_angola' || clean === 'super_taxi_psm') return 'psm';
      return clean;
    };
    const activeTenantClean = normalizeTenant(getActiveTenantId());

    let targetChannel = activeTenantClean === 'psm' ? 'general' : `general_${activeTenantClean}`;
    let recipientId = undefined;

    if (activeTab === 'direct') {
      if (!selectedRecipient) return;
      const ids = [currentUserId, selectedRecipient.id].sort();
      targetChannel = `dm_${ids[0]}_${ids[1]}`;
      recipientId = selectedRecipient.id;
    }

    const msgPayload: any = {
      channel: targetChannel,
      tenantId: activeTenantClean,
      senderId: currentUserId,
      senderName: currentUserName,
      senderRole: currentUserRole,
      senderVehicle: currentUser?.vehiclePrefix || '',
      senderPhotoURL: currentUser?.photoURL || currentUser?.photoUrl || (typeof localStorage !== 'undefined' ? localStorage.getItem(`jis_avatar_${currentUserId}`) || '' : ''),
      recipientId: recipientId || null,
      text: cleanText,
      timestamp: serverTimestamp(),
      createdAtIso: new Date().toISOString()
    };

    if (replyingTo) {
      msgPayload.replyToId = replyingTo.id;
      msgPayload.replyToText = replyingTo.text;
      msgPayload.replyToName = replyingTo.senderName;
    }

    setInputText('');
    setReplyingTo(null);

    try {
      await addDoc(collection(db, 'team_messages'), msgPayload);
    } catch (err) {
      console.warn('Error sending with serverTimestamp, retrying with Date timestamp:', err);
      try {
        await addDoc(collection(db, 'team_messages'), {
          ...msgPayload,
          timestamp: new Date()
        });
      } catch (e2) {
        console.error('Failed to send message:', e2);
        alert('Erro ao enviar mensagem.');
      }
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    try {
      await deleteDoc(doc(db, 'team_messages', msgId));
      setMessageMenuOpen(null);
    } catch (err) {
      console.error('Error deleting message:', err);
      alert('Erro ao eliminar mensagem.');
    }
  };

  const handleToggleReaction = async (msg: ChatMessage, emoji: string) => {
    const currentReactions = msg.reactions || {};
    const userList = currentReactions[emoji] || [];
    const hasReacted = userList.includes(currentUserId);

    let updatedList: string[];
    if (hasReacted) {
      updatedList = userList.filter((id) => id !== currentUserId);
    } else {
      updatedList = [...userList, currentUserId];
    }

    const newReactions = { ...currentReactions };
    if (updatedList.length > 0) {
      newReactions[emoji] = updatedList;
    } else {
      delete newReactions[emoji];
    }

    // Optimistic local state update
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, reactions: newReactions } : m))
    );

    try {
      await updateDoc(doc(db, 'team_messages', msg.id), {
        reactions: newReactions
      });
    } catch (err) {
      console.warn('Error updating message reaction in Firestore:', err);
    }
  };

  const handleForwardMessage = async (recipient: TeamMember | 'general', textToForward: string) => {
    let targetChannel = 'general';
    let recipientId = null;

    if (recipient !== 'general') {
      const ids = [currentUserId, recipient.id].sort();
      targetChannel = `dm_${ids[0]}_${ids[1]}`;
      recipientId = recipient.id;
    }

    const msgPayload = {
      channel: targetChannel,
      senderId: currentUserId,
      senderName: currentUserName,
      senderRole: currentUserRole,
      senderVehicle: currentUser?.vehiclePrefix || '',
      recipientId: recipientId,
      text: textToForward,
      timestamp: serverTimestamp(),
      createdAtIso: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'team_messages'), msgPayload);
      setForwardModalOpen(null);
      alert('Mensagem reencaminhada com sucesso.');
    } catch (err) {
      console.error('Error forwarding message:', err);
      alert('Erro ao reencaminhar mensagem.');
    }
  };

  const filteredMembers = teamMembers.filter((m) =>
    m.name.toLowerCase().includes(searchMember.toLowerCase()) ||
    (m.vehiclePrefix && m.vehiclePrefix.toLowerCase().includes(searchMember.toLowerCase()))
  );

  return (
    <>
      {/* Background Notification Toast Banner */}
      <AnimatePresence>
        {activeNotification && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.95 }}
            className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 z-[9999] bg-slate-950 border border-brand-primary/40 rounded-2xl p-4 shadow-2xl max-w-md w-full flex items-center justify-between gap-4 border-l-4 border-l-brand-primary"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-brand-primary/20 flex items-center justify-center text-brand-primary shrink-0 font-bold">
                💬
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-black uppercase tracking-wider text-white truncate">
                  {activeNotification.senderName}
                </h4>
                <p className="text-[11px] text-slate-300 truncate mt-0.5 font-medium">
                  {activeNotification.text}
                </p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => {
                  setActiveNotification(null);
                  window.dispatchEvent(new CustomEvent('toggle-team-chat', { detail: { open: true } }));
                  if (activeNotification.channel === 'general') {
                    setActiveTab('general');
                    setSelectedRecipient(null);
                  } else {
                    window.dispatchEvent(new CustomEvent('focus-team-chat-channel', { detail: { tab: 'direct', recipient: activeNotification.senderId } }));
                  }
                  setMobileScreen('chat');
                }}
                className="px-3 py-1.5 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-xl font-black text-[9px] uppercase tracking-wider transition-all cursor-pointer"
              >
                Ver
              </button>
              <button
                onClick={() => setActiveNotification(null)}
                className="p-1.5 text-slate-500 hover:text-slate-300 rounded-lg hover:bg-slate-900 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Received Nudge Overlay (Despertar Alert) */}
      <AnimatePresence>
        {receivedNudge && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-red-950/90 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ 
                opacity: 1, 
                scale: [1, 1.05, 0.95, 1.02, 1],
                x: [0, -10, 10, -5, 5, 0]
              }}
              transition={{ duration: 0.5 }}
              className="bg-slate-900 border-4 border-red-500 rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-[0_0_50px_rgba(239,68,68,0.5)] text-center space-y-6 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-red-500/5 animate-pulse pointer-events-none" />

              <div className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center mx-auto text-red-500 animate-bounce">
                <Bell size={40} className="animate-pulse" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-black text-red-500 uppercase tracking-wider">
                  🚨 Chamada de Atenção!
                </h3>
                <p className="text-sm font-black text-white uppercase tracking-wide">
                  {receivedNudge.senderName} está a chamar por si!
                </p>
                <p className="text-xs text-slate-400 font-medium">
                  Por favor, abra o chat para responder de imediato à central ou colega.
                </p>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl max-w-sm mx-auto text-left italic text-red-200 text-xs">
                "{receivedNudge.text}"
              </div>

              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => {
                    setReceivedNudge(null);
                    window.dispatchEvent(new CustomEvent('toggle-team-chat', { detail: { open: true } }));
                    window.dispatchEvent(new CustomEvent('focus-team-chat-channel', { detail: { tab: 'direct', recipient: receivedNudge.senderId } }));
                  }}
                  className="w-full py-4 bg-red-500 hover:bg-red-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg transition-all active:scale-95 text-center flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MessageSquare size={16} /> Abrir Chat e Responder
                </button>
                <button
                  onClick={() => setReceivedNudge(null)}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all cursor-pointer"
                >
                  Ignorar Alerta
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {(isOpen || isEmbedded) && (
        <div className={cn(
          isEmbedded 
            ? "relative w-full h-[750px] max-h-[85vh] rounded-3xl" 
            : "fixed inset-0 z-[120] flex items-center justify-center p-0 sm:p-4"
        )}>
          {!isEmbedded && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity" onClick={onClose} />
          )}
          <div className={cn(
            "relative w-full bg-slate-900 text-white border border-slate-800 shadow-2xl overflow-hidden flex flex-col sm:flex-row z-10",
            isEmbedded ? "h-full rounded-3xl" : "max-w-4xl h-[100dvh] sm:h-[88vh] sm:rounded-3xl"
          )}>
            {/* SIDEBAR: Channels & Members List */}
        <div className={`w-full sm:w-80 bg-slate-950 border-b sm:border-b-0 sm:border-r border-slate-800 flex flex-col shrink-0 ${mobileScreen === 'chat' ? 'hidden sm:flex' : 'flex'}`}>
          
          {/* Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-brand-primary/20 border border-brand-primary/40 flex items-center justify-center text-brand-primary">
                <MessageSquare size={18} />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-white leading-none">
                  Chat Interno
                </h3>
                <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest mt-1 flex items-center gap-1 truncate max-w-[200px]" title={`${companyName} • Equipa Online`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="truncate">{companyName} • Equipa Online</span>
                </p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="sm:hidden p-2 text-slate-400 hover:text-white rounded-xl bg-slate-900"
            >
              <X size={18} />
            </button>
          </div>

          {/* Tab Selector */}
          <div className="p-2 bg-slate-900/60 flex gap-1 border-b border-slate-800">
            <button
              onClick={() => {
                setActiveTab('general');
                setSelectedRecipient(null);
                setMobileScreen('chat');
              }}
              className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'general'
                  ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Users size={13} />
              Canal Geral
            </button>
            <button
              onClick={() => setActiveTab('direct')}
              className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'direct'
                  ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <User size={13} />
              PRIVADAs (No off)
            </button>
          </div>

          {/* Member Search in Direct Mode */}
          {activeTab === 'direct' && (
            <div className="p-2 border-b border-slate-800">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Procurar colega..."
                  value={searchMember}
                  onChange={(e) => setSearchMember(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-primary"
                />
              </div>
            </div>
          )}

          {/* Members List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
            {activeTab === 'general' ? (
              <div 
                onClick={() => {
                  setSelectedRecipient(null);
                  setMobileScreen('chat');
                }}
                className="p-4 bg-brand-primary/10 border-l-4 border-brand-primary cursor-pointer hover:bg-brand-primary/20 transition-all flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-2xl bg-brand-primary flex items-center justify-center text-white font-black shadow-md">
                  👥
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wide text-white">
                    Canal Geral da Frota
                  </h4>
                  <p className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                    Todos os Motoristas & Operadores
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-2">
                {loadingMembers && (
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center py-6">
                    A carregar lista de colegas...
                  </p>
                )}
                {!loadingMembers && filteredMembers.length === 0 && (
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center py-6">
                    Nenhum colaborador encontrado.
                  </p>
                )}
                {filteredMembers.map((member) => {
                  const isSelected = selectedRecipient?.id === member.id;
                  return (
                    <button
                      key={member.id}
                      onClick={() => {
                        setSelectedRecipient(member);
                        setMobileScreen('chat');
                      }}
                      className={`w-full p-3 text-left flex items-center justify-between transition-all ${
                        isSelected 
                          ? 'bg-slate-800/90 border-l-4 border-brand-primary' 
                          : 'hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          {member.photoURL ? (
                            <img 
                              src={member.photoURL} 
                              alt={member.name} 
                              className="w-9 h-9 rounded-2xl object-cover border border-slate-700 shadow-sm" 
                              referrerPolicy="no-referrer" 
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center font-black text-xs text-slate-300">
                              {member.role === 'motorista' ? <Car size={16} /> : <Shield size={16} />}
                            </div>
                          )}
                          {member.online && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-950" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-black uppercase tracking-wider text-white">
                            {member.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[8.5px] font-extrabold uppercase text-indigo-400 bg-indigo-500/10 px-1.5 py-0.2 rounded font-sans">
                              {member.role === 'motorista' ? `Motorista ${member.vehiclePrefix || ''}` : member.role}
                            </span>
                            <span className={cn(
                              "text-[8.5px] font-black uppercase px-1.5 py-0.2 rounded font-sans",
                              member.online 
                                ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20" 
                                : "text-slate-500 bg-slate-500/10 border border-slate-700/20"
                            )}>
                              {member.online ? "ONLINE" : "OFFLINE"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* CHAT AREA: Message Window */}
        <div className={`flex-1 flex flex-col bg-slate-900 min-h-0 relative ${mobileScreen === 'list' ? 'hidden sm:flex' : 'flex'}`}>
          
          {/* Header Bar */}
          <div className="p-3.5 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between shrink-0 z-20">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setMobileScreen('list')}
                className="sm:hidden p-2 text-slate-300 hover:text-white rounded-xl bg-slate-800 flex items-center gap-1 active:scale-95 transition-all"
                title="Voltar à lista de colegas"
              >
                <ArrowLeft size={16} />
                <span className="text-[10px] font-black uppercase tracking-wider">Lista</span>
              </button>

              {activeTab === 'general' ? (
                <div>
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                    <Users size={16} className="text-brand-primary" />
                    Canal Geral da Frota
                  </h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                    Comunicação interna em direto
                  </p>
                </div>
              ) : selectedRecipient ? (
                <div>
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                    <User size={16} className="text-brand-primary" />
                    {selectedRecipient.name}
                  </h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                    Conversa Privada • {selectedRecipient.role} {selectedRecipient.vehiclePrefix || ''}
                  </p>
                </div>
              ) : (
                <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                  Selecione um colaborador para conversar.
                </p>
              )}
            </div>

             <div className="flex items-center gap-2">
               {/* "Despertar" (🚨 Acordar) Button */}
               {activeTab === 'direct' && selectedRecipient && (
                 <button
                   onClick={handleSendNudge}
                   disabled={nudgeCooldown}
                   className={`px-2.5 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all text-[10px] font-black uppercase tracking-wider cursor-pointer active:scale-95 shadow-sm ${
                     nudgeCooldown
                       ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
                       : 'bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-400 border-rose-500/30'
                   }`}
                   title={nudgeCooldown ? "Aguarde para enviar de novo..." : "Enviar chamada de atenção vibrante e sonora"}
                 >
                   <Bell size={14} className={nudgeCooldown ? "" : "animate-bounce"} />
                   <span>Despertar</span>
                 </button>
               )}

               {/* Sound Notifications Toggle Button */}
               <button
                 onClick={() => {
                   const newVal = !soundEnabled;
                   setSoundEnabled(newVal);
                   localStorage.setItem(`jis_chat_sound_enabled_${currentUserId}`, newVal ? 'true' : 'false');
                 }}
                 className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/80 hover:bg-slate-800 transition-colors flex items-center justify-center border border-slate-700/40"
                 title={soundEnabled ? "Desativar som de notificações" : "Ativar som de notificações"}
               >
                 {soundEnabled ? (
                   <Volume2 size={16} className="text-emerald-400" />
                 ) : (
                   <VolumeX size={16} className="text-rose-400" />
                 )}
               </button>

               {/* Change Wallpaper Button */}
               <button
                 onClick={() => setIsWallpaperModalOpen(true)}
                 className="px-2.5 py-1.5 bg-slate-800/90 hover:bg-slate-800 text-slate-200 rounded-xl border border-slate-700/60 flex items-center gap-1.5 transition-all text-[10px] font-black uppercase tracking-wider cursor-pointer active:scale-95 shadow-sm"
                 title="Alterar Fundo do Chat"
               >
                 <ImageIcon size={14} className="text-brand-primary" />
                 <span className="hidden sm:inline">Fundo</span>
               </button>

              {/* Current User Profile Photo Badge */}
              <div className="relative group">
                <button
                  onClick={() => profileFileInputRef.current?.click()}
                  className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center relative hover:ring-2 hover:ring-brand-primary transition-all cursor-pointer shadow-sm"
                  title="Carregar / Alterar Foto de Perfil"
                >
                  {currentUser?.photoURL || (typeof localStorage !== 'undefined' && localStorage.getItem(`jis_avatar_${currentUserId}`)) ? (
                    <img
                      src={currentUser?.photoURL || localStorage.getItem(`jis_avatar_${currentUserId}`) || ''}
                      alt={currentUserName}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <User size={16} className="text-slate-400" />
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                    <Camera size={13} />
                  </div>
                </button>
                <input
                  type="file"
                  ref={profileFileInputRef}
                  onChange={handleUploadProfilePhotoFromChat}
                  accept="image/*"
                  className="hidden"
                />
              </div>

              <button 
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/80 hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div 
            className="flex-1 overflow-y-auto p-4 space-y-3.5 relative"
            style={{
              backgroundImage: chatWallpaper && chatWallpaper !== 'default' ? `url(${chatWallpaper})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat'
            }}
          >
            {/* Dark overlay for contrast */}
            {chatWallpaper && chatWallpaper !== 'default' && (
              <div 
                className="absolute inset-0 bg-slate-950 pointer-events-none z-0 transition-opacity"
                style={{ opacity: wallpaperOpacity }}
              />
            )}

            <div className="relative z-10 space-y-3.5">
              {activeTab === 'direct' && !selectedRecipient && (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
                  <User size={40} className="text-slate-700" />
                  <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Nenhuma conversa individual selecionada
                  </p>
                  <p className="text-[10px] text-slate-500 max-w-xs">
                    Escolha um colega na lista lateral para conversar diretamente de forma segura e privada.
                  </p>
                </div>
              )}

              {messages.length === 0 && (activeTab === 'general' || selectedRecipient) && (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
                  <Sparkles size={32} className="text-brand-primary/50 animate-bounce" />
                  <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Sem mensagens anteriores
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Seja o primeiro a enviar uma mensagem neste canal!
                  </p>
                </div>
              )}

              {messages.map((msg) => {
                const isMe = msg.senderId === currentUserId;
                const senderMember = teamMembers.find(m => m.id === msg.senderId);
                const senderPhoto = msg.senderPhotoURL || senderMember?.photoURL || (isMe ? (currentUser?.photoURL || (typeof localStorage !== 'undefined' ? localStorage.getItem(`jis_avatar_${currentUserId}`) || '' : '')) : '');
                const formattedTime = msg.timestamp?.seconds 
                  ? new Date(msg.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                return (
                  <MessageRowItem
                    key={msg.id}
                    msg={msg}
                    isMe={isMe}
                    senderPhoto={senderPhoto}
                    formattedTime={formattedTime}
                    currentUserId={currentUserId}
                    messageMenuOpen={messageMenuOpen}
                    setMessageMenuOpen={setMessageMenuOpen}
                    setReplyingTo={setReplyingTo}
                    setForwardModalOpen={setForwardModalOpen}
                    handleDeleteMessage={handleDeleteMessage}
                    handleToggleReaction={handleToggleReaction}
                  />
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </div>



          {/* Input Controls */}
          {(activeTab === 'general' || selectedRecipient) && (
            <div className="p-3 bg-slate-950 border-t border-slate-800 space-y-2 shrink-0">
              
              {replyingTo && (
                <div className="flex items-start justify-between bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Reply size={14} className="text-brand-primary shrink-0" />
                    <div className="overflow-hidden">
                      <p className="text-[10px] font-bold text-brand-primary">A responder a {replyingTo.senderName}</p>
                      <p className="text-[10px] text-slate-400 truncate line-clamp-1">{replyingTo.text}</p>
                    </div>
                  </div>
                  <button onClick={() => setReplyingTo(null)} className="p-1 text-slate-500 hover:text-slate-300 shrink-0">
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  placeholder={
                    activeTab === 'general' 
                      ? "Escrever mensagem no Canal Geral..." 
                      : `Mensagem para ${selectedRecipient?.name}...`
                  }
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-primary transition-all font-medium"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="px-5 bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-40 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-brand-primary/20 transition-all active:scale-95"
                >
                  <Send size={15} />
                  <span className="hidden sm:inline">Enviar</span>
                </button>
              </form>
            </div>
          )}

        </div>
      </div>
      
      {/* Modal Reencaminhar Mensagem */}
      {forwardModalOpen && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                <Forward size={16} className="text-brand-primary" />
                Reencaminhar
              </h3>
              <button 
                onClick={() => setForwardModalOpen(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800/80 hover:bg-slate-800 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="p-4 bg-slate-900/50">
              <p className="text-xs text-slate-400 mb-2 font-bold uppercase tracking-wider">Mensagem:</p>
              <div className="p-3 bg-slate-800 rounded-xl text-xs text-slate-300 border border-slate-700 italic">
                "{forwardModalOpen.text}"
              </div>
            </div>

            <div className="p-4 flex-1 overflow-y-auto max-h-[40vh]">
              <p className="text-xs text-slate-400 mb-2 font-bold uppercase tracking-wider">Selecionar Destino:</p>
              <div className="space-y-1">
                <button
                  onClick={() => handleForwardMessage('general', forwardModalOpen.text)}
                  className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700"
                >
                  <div className="w-8 h-8 rounded-lg bg-brand-primary/20 flex items-center justify-center text-brand-primary shrink-0">
                    <Users size={14} />
                  </div>
                  <span className="text-xs font-bold text-white">Canal Geral da Frota</span>
                </button>
                
                {filteredMembers.map(member => (
                  <button
                    key={member.id}
                    onClick={() => handleForwardMessage(member, forwardModalOpen.text)}
                    className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700 text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                      <User size={14} />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold text-slate-200 truncate">{member.name}</p>
                      <p className="text-[9px] text-slate-500 uppercase tracking-wider">{member.role}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Personalização Fundo do Chat */}
      <AnimatePresence>
        {isWallpaperModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 w-full max-w-lg shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto my-auto relative"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-brand-primary/20 border border-brand-primary/30 flex items-center justify-center text-brand-primary shadow-lg">
                    <ImageIcon size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase text-white tracking-wider">Fundo do Chat</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Escolha um tema ou carregue uma foto personalizada</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsWallpaperModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Upload Custom Wallpaper */}
              <div className="p-4 bg-slate-950 border border-slate-800/80 rounded-2xl flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase text-white tracking-wide">Carregar Imagem do Dispositivo</p>
                  <p className="text-[10px] text-slate-400 font-medium">Use qualquer foto da galeria como plano de fundo</p>
                </div>
                <button
                  onClick={() => wallpaperFileInputRef.current?.click()}
                  className="px-4 py-2.5 bg-brand-primary hover:bg-brand-primary/90 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-lg flex items-center gap-2 shrink-0 cursor-pointer active:scale-95"
                >
                  <Camera size={14} /> Carregar Foto
                </button>
                <input
                  type="file"
                  ref={wallpaperFileInputRef}
                  onChange={handleUploadWallpaper}
                  accept="image/*"
                  className="hidden"
                />
              </div>

              {/* Preset Wallpapers */}
              <div className="space-y-2.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Temas e Papéis de Parede</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-52 overflow-y-auto p-1 no-scrollbar">
                  {CHAT_WALLPAPER_PRESETS.map((preset) => {
                    const isSelected = chatWallpaper === preset.url || (preset.id === 'default' && chatWallpaper === 'default');
                    return (
                      <button
                        key={preset.id}
                        onClick={() => {
                          setChatWallpaper(preset.url || 'default');
                          localStorage.setItem(`jis_chat_wallpaper_${currentUserId}`, preset.url || 'default');
                        }}
                        className={`relative rounded-2xl h-24 p-3 flex flex-col justify-end text-left border transition-all overflow-hidden group cursor-pointer ${
                          isSelected 
                            ? "border-brand-primary ring-2 ring-brand-primary/40 shadow-xl" 
                            : "border-slate-800 hover:border-slate-700 bg-slate-950"
                        }`}
                        style={{
                          backgroundImage: preset.url ? `url(${preset.url})` : 'none',
                          backgroundSize: 'cover',
                          backgroundPosition: 'center'
                        }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
                        <div className="relative z-10">
                          <p className="text-[10px] font-black text-white uppercase tracking-tight truncate">{preset.name}</p>
                          <p className="text-[8px] text-slate-300 font-medium truncate mt-0.5">{preset.description}</p>
                        </div>
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-5 h-5 bg-brand-primary rounded-full flex items-center justify-center text-white shadow-md">
                            <CheckCheck size={12} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Darkness / Contrast Slider */}
              {chatWallpaper !== 'default' && (
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider">
                    <span className="text-slate-300 flex items-center gap-1.5"><Palette size={14} className="text-brand-primary" /> Tom Escuro do Fundo</span>
                    <span className="text-brand-primary">{Math.round(wallpaperOpacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="0.85"
                    step="0.05"
                    value={wallpaperOpacity}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setWallpaperOpacity(val);
                      localStorage.setItem(`jis_chat_wallpaper_opacity_${currentUserId}`, val.toString());
                    }}
                    className="w-full accent-brand-primary bg-slate-800 h-2 rounded-lg cursor-pointer"
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setChatWallpaper('default');
                    localStorage.setItem(`jis_chat_wallpaper_${currentUserId}`, 'default');
                  }}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all"
                >
                  Restaurar Padrão
                </button>
                <button
                  onClick={() => setIsWallpaperModalOpen(false)}
                  className="flex-1 py-3 bg-brand-primary hover:bg-brand-primary/90 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-brand-primary/20"
                >
                  Concluído
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
        </div>
      )}
    </>
  );
};
