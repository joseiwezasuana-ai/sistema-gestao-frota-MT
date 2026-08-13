import { useState, useEffect, useCallback } from 'react';
import { db } from './firebase';
import { collection, query, onSnapshot, limit, orderBy } from 'firebase/firestore';

export function useUnreadTeamChat(currentUserId?: string) {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [lastRead, setLastRead] = useState<number>(() => {
    if (!currentUserId || typeof localStorage === 'undefined') return Date.now();
    const stored = localStorage.getItem(`jis_chat_last_read_${currentUserId}`);
    return stored ? parseInt(stored, 10) : Date.now() - 86400000; // default 24h ago if never saved
  });

  const markAsRead = useCallback(() => {
    if (!currentUserId) return;
    const now = Date.now();
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`jis_chat_last_read_${currentUserId}`, now.toString());
      }
    } catch (e) {
      console.warn("Could not save chat read status in localStorage", e);
    }
    setLastRead(now);
    setUnreadCount(0);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('team-chat-read', { detail: { userId: currentUserId, time: now } }));
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;

    const handleReadEvent = (e: any) => {
      if (e.detail?.userId === currentUserId) {
        setLastRead(e.detail.time);
        setUnreadCount(0);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('team-chat-read', handleReadEvent);
    }

    // Listen to recent messages in team_messages
    const qMsgs = query(
      collection(db, 'team_messages'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(qMsgs, (snapshot) => {
      let count = 0;
      const storedLastRead = typeof localStorage !== 'undefined' 
        ? parseInt(localStorage.getItem(`jis_chat_last_read_${currentUserId}`) || `${lastRead}`, 10)
        : lastRead;

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if (!data) return;

        // Skip messages sent by current user
        if (data.senderId === currentUserId) return;

        // Check if message belongs to general channel or user DM
        const isGeneral = data.channel === 'general';
        const isDMForMe = data.recipientId === currentUserId || (data.channel && data.channel.startsWith('dm_') && data.channel.includes(currentUserId));

        if (isGeneral || isDMForMe) {
          const msgTime = data.timestamp?.seconds 
            ? data.timestamp.seconds * 1000 
            : new Date(data.createdAtIso || 0).getTime();

          if (msgTime > storedLastRead) {
            count++;
          }
        }
      });

      setUnreadCount(count);
    }, (err) => {
      console.warn('Error reading unread team messages count:', err);
    });

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('team-chat-read', handleReadEvent);
      }
      unsubscribe();
    };
  }, [currentUserId, lastRead]);

  return {
    unreadCount,
    hasUnread: unreadCount > 0,
    markAsRead
  };
}
