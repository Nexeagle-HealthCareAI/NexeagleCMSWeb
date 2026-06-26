import React, { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { toast } from 'sonner';

const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes

const InactivityTracker: React.FC = () => {
  const logout = useAuthStore(state => state.logout);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        logout();
        toast.error('Session expired due to inactivity (15 minutes).');
      }, INACTIVITY_TIMEOUT);
    };

    // Initial setup
    resetTimer();

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    const handleActivity = () => resetTimer();

    events.forEach(e => window.addEventListener(e, handleActivity));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach(e => window.removeEventListener(e, handleActivity));
    };
  }, [isAuthenticated, logout]);

  return null;
};

export default InactivityTracker;
