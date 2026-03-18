import { useQuery } from '@tanstack/react-query';
import { supabase } from '../api/supabase';
import type { Portfolio } from '../types/positions';

const fetchPortfolios = async (): Promise<Portfolio[]> => {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    if (userError.message === 'Auth session missing!') {
      throw new Error('Your session has expired. Please sign in again.');
    }
    throw userError;
  }

  if (!user) {
    throw new Error('You must be signed in to view your portfolios.');
  }

  const { data, error } = await supabase
    .from('portfolios')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data ?? []) as Portfolio[];
};

export const usePortfolios = () => {
  return useQuery({
    queryKey: ['portfolios'],
    queryFn: fetchPortfolios,
  });
};