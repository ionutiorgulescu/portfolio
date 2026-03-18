import { useQuery } from '@tanstack/react-query';
import { supabase } from '../api/supabase';
import type { Position } from '../types/positions';
import { ALL_PORTFOLIOS_ID } from '../contexts/PortfolioContext';

const fetchPositions = async (portfolioId: string): Promise<Position[]> => {
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
    throw new Error('You must be signed in to view your positions.');
  }

  let query = supabase
    .from('positions')
    .select('*')
    .eq('user_id', user.id)
    .order('buy_date', { ascending: false })
    .order('created_at', { ascending: false });

  // Only filter by portfolio when not showing all
  if (portfolioId !== ALL_PORTFOLIOS_ID) {
    query = query.eq('portfolio_id', portfolioId);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data ?? []) as Position[];
};

export const usePositions = (portfolioId: string) => {
  return useQuery({
    queryKey: ['positions', portfolioId],
    queryFn: () => fetchPositions(portfolioId),
    enabled: !!portfolioId,
  });
};