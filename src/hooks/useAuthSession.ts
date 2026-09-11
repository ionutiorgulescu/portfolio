import { useEffect, useState } from 'react';
import { backend, type AuthUser } from '../api/backend';

export const useAuthSession = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      try {
        const currentUser = await backend.getUser();
        if (!isMounted) {
          return;
        }
        setUser(currentUser);
      } catch (error) {
        console.error('Failed to get auth session:', error);
        if (!isMounted) {
          return;
        }
        setUser(null);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadUser();

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void loadUser();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    const unsubscribe = backend.onAuthChange((nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', onVisible);
      unsubscribe();
    };
  }, []);

  return { user, loading };
};
