import { useQuery } from '@tanstack/react-query';
import { backend } from '../api/backend';

export const useRegistrationEnabled = () => {
  const { data } = useQuery({
    queryKey: ['auth', 'registration-enabled'],
    queryFn: backend.isRegistrationEnabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return data ?? false;
};
