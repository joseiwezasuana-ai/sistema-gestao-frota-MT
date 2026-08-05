import React, { useState, useEffect } from 'react';

export default function WaitingTimer({ timestamp, className }: { timestamp: any, className?: string }) {
  const [timeStr, setTimeStr] = useState("00:00 min");

  useEffect(() => {
    const calculate = () => {
      if (!timestamp) {
        setTimeStr("00:00 min");
        return;
      }
      try {
        let date: Date;
        if (typeof timestamp?.toDate === 'function') {
          date = timestamp.toDate();
        } else if (timestamp?.seconds) {
          date = new Date(timestamp.seconds * 1000);
        } else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
          date = new Date(timestamp);
        } else if (timestamp instanceof Date) {
          date = timestamp;
        } else {
          date = new Date();
        }

        const diffSeconds = Math.max(0, Math.floor((new Date().getTime() - date.getTime()) / 1000));
        const mins = Math.floor(diffSeconds / 60);
        const secs = diffSeconds % 60;
        
        const padM = String(mins).padStart(2, '0');
        const padS = String(secs).padStart(2, '0');
        setTimeStr(`${padM}:${padS} min`);
      } catch {
        setTimeStr("00:00 min");
      }
    };

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [timestamp]);

  return <span className={className}>{timeStr}</span>;
}

