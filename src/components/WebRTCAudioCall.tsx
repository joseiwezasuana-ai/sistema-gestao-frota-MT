import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, PhoneCall, Volume2, VolumeX, AlertCircle, PhoneOff, Radio } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, doc, onSnapshot, setDoc, addDoc, getDocs, deleteDoc } from '../lib/firebase';

interface WebRTCAudioCallProps {
  callId: string;
  role: 'driver' | 'passenger';
  callStatus: string;
  partnerName: string;
  partnerPhone?: string;
  onHangup?: () => void;
}

const STUN_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

export function WebRTCAudioCall({ callId, role, callStatus, partnerName, partnerPhone, onHangup }: WebRTCAudioCallProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'failed' | 'no-permission'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [audioVolume, setAudioVolume] = useState<number>(0);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!callId) return;

    let isMounted = true;

    async function startWebRTCSession() {
      try {
        setConnectionStatus('connecting');
        setErrorMessage(null);

        // 1. Get local microphone stream
        let localStream: MediaStream;
        try {
          localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          localStreamRef.current = localStream;
        } catch (err: any) {
          console.warn("Permissão de microfone negada ou indisponível:", err);
          if (isMounted) {
            setConnectionStatus('no-permission');
            setErrorMessage("Sem acesso ao microfone. Verifique as permissões do navegador ou utilize a chamada GSM.");
          }
          return;
        }

        // Setup audio volume visualizer
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(localStream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 32;
          source.connect(analyser);
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateVolume = () => {
            if (analyserRef.current) {
              analyserRef.current.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
              }
              const avg = sum / dataArray.length;
              if (isMounted) {
                setAudioVolume(Math.min(100, Math.round((avg / 128) * 100)));
              }
            }
            animationFrameRef.current = requestAnimationFrame(updateVolume);
          };
          updateVolume();
        } catch (e) {
          console.error("Visualizador de áudio não suportado:", e);
        }

        // 2. Create RTCPeerConnection
        const pc = new RTCPeerConnection(STUN_SERVERS);
        peerConnectionRef.current = pc;

        // Add local audio tracks to peer connection
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

        // Listen for remote tracks
        pc.ontrack = (event) => {
          if (remoteAudioRef.current && event.streams[0]) {
            remoteAudioRef.current.srcObject = event.streams[0];
            remoteAudioRef.current.play().catch(console.error);
          }
        };

        pc.oniceconnectionstatechange = () => {
          if (!isMounted) return;
          if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
            setConnectionStatus('connected');
          } else if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
            setConnectionStatus('failed');
          }
        };

        // Firestore signaling paths
        const signalsColl = collection(db, 'calls', callId, 'webrtc_signals');
        const offerDocRef = doc(signalsColl, 'offer');
        const answerDocRef = doc(signalsColl, 'answer');
        const candidatesColl = collection(db, 'calls', callId, 'ice_candidates');

        // Handle ICE Candidates
        pc.onicecandidate = async (event) => {
          if (event.candidate) {
            try {
              await addDoc(candidatesColl, {
                candidate: event.candidate.toJSON(),
                sender: role,
                timestamp: Date.now()
              });
            } catch (err) {
              console.error("Erro ao enviar candidato ICE:", err);
            }
          }
        };

        // Listen for remote ICE candidates
        const unsubCandidates = onSnapshot(candidatesColl, (snapshot) => {
          snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
              const data = change.doc.data();
              if (data.sender !== role && data.candidate) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                } catch (e) {
                  console.error("Erro ao adicionar candidato ICE remoto:", e);
                }
              }
            }
          });
        });

        // Role-based Offer / Answer flow
        if (role === 'driver') {
          // Driver initiates offer
          const offer = await pc.createOffer({
            offerToReceiveAudio: true
          });
          await pc.setLocalDescription(offer);
          await setDoc(offerDocRef, {
            sdp: offer.sdp,
            type: offer.type,
            timestamp: Date.now()
          });

          // Listen for Answer from Passenger
          const unsubAnswer = onSnapshot(answerDocRef, async (snap) => {
            if (snap.exists() && pc.signalingState !== 'stable') {
              const answerData = snap.data();
              if (answerData && answerData.sdp) {
                await pc.setRemoteDescription(new RTCSessionDescription({
                  sdp: answerData.sdp,
                  type: answerData.type
                }));
                if (isMounted) setConnectionStatus('connected');
              }
            }
          });

          return () => {
            unsubAnswer();
            unsubCandidates();
          };
        } else {
          // Passenger listens for Offer from Driver
          const unsubOffer = onSnapshot(offerDocRef, async (snap) => {
            if (snap.exists() && !pc.currentRemoteDescription) {
              const offerData = snap.data();
              if (offerData && offerData.sdp) {
                await pc.setRemoteDescription(new RTCSessionDescription({
                  sdp: offerData.sdp,
                  type: offerData.type
                }));

                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                await setDoc(answerDocRef, {
                  sdp: answer.sdp,
                  type: answer.type,
                  timestamp: Date.now()
                });
                if (isMounted) setConnectionStatus('connected');
              }
            }
          });

          return () => {
            unsubOffer();
            unsubCandidates();
          };
        }
      } catch (err: any) {
        console.error("Erro ao iniciar sessão WebRTC:", err);
        if (isMounted) {
          setConnectionStatus('failed');
          setErrorMessage("Falha na ligação de áudio VoIP. Utilize a chamada móvel GSM de contingência.");
        }
      }
    }

    const cleanupPromise = startWebRTCSession();

    return () => {
      isMounted = false;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, [callId, role]);

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  return (
    <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-4 shadow-xl text-white space-y-3">
      {/* Hidden Remote Audio Element */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Header Info */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={`p-2.5 rounded-xl ${connectionStatus === 'connected' ? 'bg-emerald-500 text-slate-950 animate-pulse' : 'bg-slate-800 text-emerald-400'}`}>
              <Radio size={20} />
            </div>
            {connectionStatus === 'connected' && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-900 animate-ping" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                🎙️ Voz ao Vivo (WebRTC)
              </span>
              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${
                connectionStatus === 'connected' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                connectionStatus === 'connecting' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}>
                {connectionStatus === 'connected' ? 'CONECTADO' :
                 connectionStatus === 'connecting' ? 'A LIGAR...' :
                 connectionStatus === 'no-permission' ? 'SEM MICROFONE' : 'OFFLINE'}
              </span>
            </div>
            <p className="text-xs font-black text-slate-200 mt-0.5 uppercase tracking-tight">
              Canal Direto: {partnerName || 'Interlocutor'}
            </p>
          </div>
        </div>

        {partnerPhone && (
          <a
            href={`tel:${partnerPhone}`}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md cursor-pointer shrink-0"
            title="Ligar via Cartão SIM / Rede Móvel GSM"
          >
            <PhoneCall size={13} />
            Ligar GSM
          </a>
        )}
      </div>

      {/* Audio Waveform / Volume Indicator */}
      {connectionStatus === 'connected' && (
        <div className="space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-slate-400">
            <span>Sinal do Seu Microfone</span>
            <span className={isMuted ? 'text-rose-400' : 'text-emerald-400'}>
              {isMuted ? 'MICROFONE MUTADO' : `NÍVEL: ${audioVolume}%`}
            </span>
          </div>

          <div className="flex items-center justify-center gap-1 h-6">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((h, i) => {
              const active = !isMuted && audioVolume > (i * 5);
              return (
                <div
                  key={i}
                  className={`w-1 rounded-full transition-all duration-75 ${
                    isMuted ? 'bg-slate-700 h-1' :
                    active ? 'bg-emerald-400' : 'bg-slate-800'
                  }`}
                  style={{
                    height: isMuted ? '4px' : `${Math.max(4, Math.min(24, (audioVolume / 100) * 24 * (h / 10)))}px`
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Error or No Permission Fallback Warning */}
      {(connectionStatus === 'no-permission' || connectionStatus === 'failed') && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2.5">
          <AlertCircle size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-[10px] font-black text-amber-300 uppercase tracking-wider">
              {connectionStatus === 'no-permission' ? 'Acesso ao Microfone Necessário' : 'Falha na Ligação WebRTC'}
            </p>
            <p className="text-[9px] text-slate-300 font-medium leading-relaxed">
              {errorMessage || "Para ouvir e falar na aplicação, permita o acesso ao microfone no navegador ou utilize o botão 'Ligar GSM'."}
            </p>
          </div>
        </div>
      )}

      {/* Controls Bar */}
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={toggleMute}
          disabled={connectionStatus !== 'connected'}
          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all cursor-pointer ${
            isMuted
              ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-lg shadow-rose-600/30'
              : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/30'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isMuted ? <MicOff size={15} /> : <Mic size={15} />}
          {isMuted ? 'Desmutar Microfone' : 'Microfone Activo'}
        </button>

        {onHangup && (
          <button
            onClick={onHangup}
            className="px-4 py-2 bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-800 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <PhoneOff size={14} />
            Desligar Voz
          </button>
        )}
      </div>
    </div>
  );
}
