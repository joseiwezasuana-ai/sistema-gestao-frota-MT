import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Send, Users, User, MessageSquare, Shield, Car, Search, CheckCheck, Sparkles, ArrowLeft,
  Reply, Forward, Trash2, MoreVertical
} from 'lucide-react';
import { db } from '../lib/firebase';
import { 
  collection, query, where, onSnapshot, addDoc, serverTimestamp, getDocs, limit, deleteDoc, doc
} from 'firebase/firestore';

interface TeamCollaborativeChatProps {
  currentUser: {
    uid?: string;
    id?: string;
    name?: string;
    role?: string;
    vehiclePrefix?: string;
    phone?: string;
  };
  onClose: () => void;
  isOpen: boolean;
}

interface ChatMessage {
  id: string;
  channel: string;
  senderId: string;
  senderName: string;
  senderRole?: string;
  senderVehicle?: string;
  text: string;
  timestamp: any;
  createdAtIso?: string;
  recipientId?: string;
  replyToId?: string;
  replyToText?: string;
  replyToName?: string;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  vehiclePrefix?: string;
  phone?: string;
  online?: boolean;
}

export const TeamCollaborativeChat: React.FC<TeamCollaborativeChatProps> = ({
  currentUser,
  onClose,
  isOpen
}) => {
  const currentUserId = currentUser?.uid || currentUser?.id || 'guest';
  const currentUserName = currentUser?.name || 'Colaborador';
  const currentUserRole = currentUser?.role || 'motorista';

  const [activeTab, setActiveTab] = useState<'general' | 'direct'>('general');
  const [selectedRecipient, setSelectedRecipient] = useState<TeamMember | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchMember, setSearchMember] = useState('');
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [messageMenuOpen, setMessageMenuOpen] = useState<string | null>(null);
  const [forwardModalOpen, setForwardModalOpen] = useState<ChatMessage | null>(null);
  
  // Mobile view toggle: 'list' shows members/channels list, 'chat' shows the conversation
  const [mobileScreen, setMobileScreen] = useState<'list' | 'chat'>('list');

  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // Load team members strictly from active scheduled drivers (drivers), administrative_staff, and users
  useEffect(() => {
    if (!isOpen) return;
    setLoadingMembers(true);

    const loadMembers = async () => {
      try {
        const membersMap = new Map<string, TeamMember>();

        // 1. Fetch live active/online drivers ONLY via Firestore query filtering
        try {
          const activeStatuses = [
            'available', 'Available', 
            'ativo', 'Ativo', 
            'disponível', 'Disponível', 
            'disponivel', 'Disponivel', 
            'busy', 'Busy', 
            'ocupado', 'Ocupado', 
            'em serviço', 'Em Serviço', 
            'em servico', 'Em Servico', 
            'em curso', 'Em Curso'
          ];
          
          const driversQuery = query(
            collection(db, 'drivers'),
            where('status', 'in', activeStatuses)
          );
          
          const driversSnap = await getDocs(driversQuery);
          driversSnap.docs.forEach((docSnap) => {
            const d = docSnap.data();
            const dId = d.driverId || docSnap.id;

            if (dId && dId !== currentUserId) {
              membersMap.set(dId, {
                id: dId,
                name: d.name || 'Motorista',
                role: 'motorista',
                vehiclePrefix: d.vehiclePrefix || d.prefix || 'TAX-JIS',
                phone: d.phone || d.phoneNumber || '',
                online: true
              });
            }
          });
        } catch (e) {
          console.warn('Error fetching drivers with Firestore filter:', e);
          // Fallback to fetch all and filter in-memory if query fails
          try {
            const fallbackSnap = await getDocs(collection(db, 'drivers'));
            fallbackSnap.docs.forEach((docSnap) => {
              const d = docSnap.data();
              const dId = d.driverId || docSnap.id;
              const status = String(d.status || '').toLowerCase();
              const activeStatusesLower = ['available', 'ativo', 'disponível', 'disponivel', 'busy', 'ocupado', 'em serviço', 'em servico', 'em curso'];
              const isActive = d.isOnline === true || d.shiftActive === true || activeStatusesLower.includes(status);

              if (dId && dId !== currentUserId && isActive) {
                membersMap.set(dId, {
                  id: dId,
                  name: d.name || 'Motorista',
                  role: 'motorista',
                  vehiclePrefix: d.vehiclePrefix || d.prefix || 'TAX-JIS',
                  phone: d.phone || d.phoneNumber || '',
                  online: true
                });
              }
            });
          } catch (fallbackErr) {
            console.error('All driver fetch attempts failed:', fallbackErr);
          }
        }

        // 2. Fetch administrative staff (Gerente, Operador, Mecânico, Contabilista, Admin)
        try {
          const staffSnap = await getDocs(collection(db, 'administrative_staff'));
          staffSnap.docs.forEach((docSnap) => {
            const s = docSnap.data();
            const sId = docSnap.id;
            if (sId && sId !== currentUserId) {
              membersMap.set(sId, {
                id: sId,
                name: s.name || 'Operador',
                role: s.role || 'operador',
                phone: s.phone || '',
                online: true
              });
            }
          });
        } catch (e) {
          console.warn('Error fetching administrative_staff for chat:', e);
        }

        // 3. Fetch registered platform users
        try {
          const usersSnap = await getDocs(collection(db, 'users'));
          usersSnap.docs.forEach((docSnap) => {
            const u = docSnap.data();
            const uId = u.uid || docSnap.id;
            if (uId && uId !== currentUserId && !membersMap.has(uId)) {
              membersMap.set(uId, {
                id: uId,
                name: u.name || 'Colaborador',
                role: u.role || 'colaborador',
                phone: u.phone || '',
                online: true
              });
            }
          });
        } catch (e) {
          console.warn('Error fetching users for chat:', e);
        }

        setTeamMembers(Array.from(membersMap.values()));
      } catch (err) {
        console.warn('Error loading chat team members:', err);
      } finally {
        setLoadingMembers(false);
      }
    };

    loadMembers();
  }, [isOpen, currentUserId]);

  // Listen for messages depending on general channel vs direct chat
  useEffect(() => {
    if (!isOpen) return;

    let targetChannel = 'general';
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

    let targetChannel = 'general';
    let recipientId = undefined;

    if (activeTab === 'direct') {
      if (!selectedRecipient) return;
      const ids = [currentUserId, selectedRecipient.id].sort();
      targetChannel = `dm_${ids[0]}_${ids[1]}`;
      recipientId = selectedRecipient.id;
    }

    const msgPayload: any = {
      channel: targetChannel,
      senderId: currentUserId,
      senderName: currentUserName,
      senderRole: currentUserRole,
      senderVehicle: currentUser?.vehiclePrefix || '',
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

  if (!isOpen) return null;

  const filteredMembers = teamMembers.filter((m) =>
    m.name.toLowerCase().includes(searchMember.toLowerCase()) ||
    (m.vehiclePrefix && m.vehiclePrefix.toLowerCase().includes(searchMember.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity" 
        onClick={onClose} 
      />

      {/* Main Container */}
      <div className="relative w-full max-w-4xl h-[100dvh] sm:h-[88vh] bg-slate-900 text-white sm:rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col sm:flex-row z-10">
        
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
                  Chat de Colaboradores
                </h3>
                <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest mt-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  JIS Equipa Online
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
              Diretas (1-a-1)
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
                          <div className="w-9 h-9 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center font-black text-xs text-slate-300">
                            {member.role === 'motorista' ? <Car size={16} /> : <Shield size={16} />}
                          </div>
                          {member.online && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-950" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-black uppercase tracking-wider text-white">
                            {member.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[8.5px] font-extrabold uppercase text-indigo-400 bg-indigo-500/10 px-1.5 py-0.2 rounded">
                              {member.role === 'motorista' ? `Motorista ${member.vehiclePrefix || ''}` : member.role}
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
        <div className={`flex-1 flex flex-col bg-slate-900 min-h-0 ${mobileScreen === 'list' ? 'hidden sm:flex' : 'flex'}`}>
          
          {/* Header Bar */}
          <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
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

            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/80 hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
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
              const formattedTime = msg.timestamp?.seconds 
                ? new Date(msg.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <div 
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group relative`}
                >
                  {!isMe && (
                    <div className="flex items-center gap-1.5 mb-1 px-1">
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

                  <div className={`flex items-start gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'} w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                    {/* Message Bubble */}
                    <div
                      className={`relative max-w-[85%] sm:max-w-[70%] p-3.5 rounded-2xl text-xs leading-relaxed font-sans shadow-md ${
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
                      <div className={`flex items-center justify-end gap-1 mt-1 text-[8.5px] font-bold ${
                        isMe ? 'text-amber-200/90' : 'text-slate-400'
                      }`}>
                        <span>{formattedTime}</span>
                        {isMe && <CheckCheck size={11} className="text-emerald-300" />}
                      </div>
                    </div>

                    {/* Actions Menu Toggle */}
                    <div className="relative pt-2 shrink-0">
                      <button 
                        onClick={() => setMessageMenuOpen(messageMenuOpen === msg.id ? null : msg.id)}
                        className={`p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-full transition-colors ${messageMenuOpen === msg.id ? 'opacity-100' : 'opacity-0'} group-hover:opacity-100 focus:opacity-100`}
                      >
                        <MoreVertical size={14} />
                      </button>

                      {messageMenuOpen === msg.id && (
                        <div className={`absolute top-8 ${isMe ? 'right-0' : 'left-0'} z-[130] bg-slate-800 border border-slate-700 rounded-xl shadow-xl py-1 min-w-[140px]`}>
                          <button 
                            onClick={() => {
                              setReplyingTo(msg);
                              setMessageMenuOpen(null);
                            }}
                            className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2"
                          >
                            <Reply size={14} /> Responder
                          </button>
                          <button 
                            onClick={() => {
                              setForwardModalOpen(msg);
                              setMessageMenuOpen(null);
                            }}
                            className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2"
                          >
                            <Forward size={14} /> Reencaminhar
                          </button>
                          {isMe && (
                            <button 
                              onClick={() => handleDeleteMessage(msg.id)}
                              className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-slate-700 hover:text-red-300 flex items-center gap-2 border-t border-slate-700/50 mt-1"
                            >
                              <Trash2 size={14} /> Eliminar
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
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

              {/* Quick Tags */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[9px] uppercase font-black tracking-wider text-slate-400 no-scrollbar">
                <span className="text-slate-600 shrink-0">Atalhos:</span>
                {['🚨 SOS / Emergência', '⛽ Em Abastecimento', '🚗 Em Serviço', '🏁 Fim de Turno'].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setInputText((prev) => (prev ? `${prev} ${tag}` : tag))}
                    className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-full shrink-0 text-slate-300 transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>

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
    </div>
  );
};
