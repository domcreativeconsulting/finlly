import { useOnlineStatus } from './useOnlineStatus.js';
import { toast } from 'react-toastify';

export function useRequireOnline() {
  const isOnline = useOnlineStatus();

  const requireOnline = (fn) =>
    (...args) => {
      if (!isOnline) {
        toast.warning('⚠️ Esta ação requer conexão com a internet.', {
          toastId: 'offline-write-blocked',
        });
        return;
      }
      return fn(...args);
    };

  return { isOnline, requireOnline };
}
