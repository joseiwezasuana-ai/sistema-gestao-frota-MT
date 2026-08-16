import { db } from '../lib/firebase';
import { doc, setDoc, serverTimestamp, onSnapshot, collection } from 'firebase/firestore';

export interface UserPresence {
  uid: string;
  name: string;
  role: string;
  vehiclePrefix?: string;
  photoURL?: string;
  isOnline: boolean;
  lastSeen: any;
  lastSeenIso?: string;
  platform?: 'mobile' | 'desktop';
}

let heartbeatInterval: any = null;
let currentTrackingUid: string | null = null;

export const presenceService = {
  /**
   * Start sending presence heartbeat every 30s for the logged in user
   */
  startHeartbeat: (user: { uid?: string; id?: string; name?: string; role?: string; vehiclePrefix?: string; photoURL?: string; photoUrl?: string }) => {
    const uid = user?.uid || user?.id;
    if (!uid || uid === 'guest' || typeof window === 'undefined') return;

    if (currentTrackingUid === uid && heartbeatInterval) {
      return;
    }

    currentTrackingUid = uid;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    const updatePresence = async (isOnline = true) => {
      try {
        const nowIso = new Date().toISOString();
        const data: any = {
          uid,
          name: user.name || 'Colaborador',
          role: user.role || 'colaborador',
          vehiclePrefix: user.vehiclePrefix || '',
          photoURL: user.photoURL || user.photoUrl || (typeof localStorage !== 'undefined' ? localStorage.getItem(`jis_avatar_${uid}`) || '' : ''),
          isOnline,
          lastSeen: serverTimestamp(),
          lastSeenIso: nowIso,
          platform: isMobile ? 'mobile' : 'desktop'
        };

        // Write to user_presence
        await setDoc(doc(db, 'user_presence', uid), data, { merge: true });
        
        // Also update users/{uid} for easy cross-lookup
        try {
          await setDoc(doc(db, 'users', uid), {
            isOnline,
            lastSeen: serverTimestamp(),
            lastSeenIso: nowIso
          }, { merge: true });
        } catch (e) {}
      } catch (err) {
        console.warn('[Presence] Failed to update presence:', err);
      }
    };

    // Initial ping
    updatePresence(true);

    // Heartbeat every 30 seconds
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        updatePresence(true);
      }
    }, 30000);

    // Visibility change handler
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updatePresence(true);
      } else {
        // Tab backgrounded/hidden
        updatePresence(true);
      }
    };

    // Unload handler
    const handleBeforeUnload = () => {
      updatePresence(false);
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
  },

  /**
   * Explicitly set user to offline (e.g. on Logout)
   */
  setOffline: async (uid: string) => {
    if (!uid || uid === 'guest') return;
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    currentTrackingUid = null;

    try {
      const nowIso = new Date().toISOString();
      await setDoc(doc(db, 'user_presence', uid), {
        isOnline: false,
        lastSeen: serverTimestamp(),
        lastSeenIso: nowIso
      }, { merge: true });

      try {
        await setDoc(doc(db, 'users', uid), {
          isOnline: false,
          lastSeen: serverTimestamp(),
          lastSeenIso: nowIso
        }, { merge: true });
      } catch (e) {}
    } catch (err) {
      console.warn('[Presence] Error setting offline:', err);
    }
  },

  /**
   * Listen to all presence documents in real-time
   */
  subscribeToAllPresence: (callback: (presences: Map<string, UserPresence>) => void) => {
    return onSnapshot(collection(db, 'user_presence'), (snapshot) => {
      const map = new Map<string, UserPresence>();
      snapshot.docs.forEach((d) => {
        map.set(d.id, { uid: d.id, ...d.data() } as UserPresence);
      });
      callback(map);
    }, (error) => {
      console.warn('[Presence] Snapshot error:', error);
    });
  },

  /**
   * Helper to determine if a member is currently online
   * Online if:
   * 1. presence.isOnline is true AND lastSeen is within the last 3.5 minutes (210s)
   * 2. OR if it's a driver with active shift or status in active list in fleet
   */
  checkIsOnline: (
    memberId: string, 
    presenceMap: Map<string, UserPresence>,
    activeDriverIds: Set<string>
  ): { isOnline: boolean; lastSeenText: string; lastSeenIso?: string } => {
    // Check fleet shift status first
    if (activeDriverIds.has(memberId)) {
      return { isOnline: true, lastSeenText: 'Online no Turno' };
    }

    const presence = presenceMap.get(memberId);
    if (!presence) {
      return { isOnline: false, lastSeenText: 'Offline' };
    }

    let lastSeenTime = 0;
    if (presence.lastSeen?.seconds) {
      lastSeenTime = presence.lastSeen.seconds * 1000;
    } else if (presence.lastSeenIso) {
      lastSeenTime = new Date(presence.lastSeenIso).getTime();
    } else if (presence.lastSeen instanceof Date) {
      lastSeenTime = presence.lastSeen.getTime();
    }

    const now = Date.now();
    const diffMs = now - lastSeenTime;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    // If marked online and pinged within the last 3.5 minutes
    if (presence.isOnline && diffMinutes <= 3) {
      return { 
        isOnline: true, 
        lastSeenText: 'Online agora',
        lastSeenIso: presence.lastSeenIso 
      };
    }

    // Format offline relative time
    let relative = 'Offline';
    if (lastSeenTime > 0) {
      if (diffMinutes < 1) {
        relative = 'Visto há instantes';
      } else if (diffMinutes < 60) {
        relative = `Visto há ${diffMinutes} min`;
      } else {
        const dateObj = new Date(lastSeenTime);
        const hours = String(dateObj.getHours()).padStart(2, '0');
        const mins = String(dateObj.getMinutes()).padStart(2, '0');
        const isToday = new Date().toDateString() === dateObj.toDateString();
        relative = isToday ? `Visto hoje às ${hours}:${mins}` : `Visto às ${hours}:${mins}`;
      }
    }

    return { 
      isOnline: false, 
      lastSeenText: relative,
      lastSeenIso: presence.lastSeenIso 
    };
  }
};
