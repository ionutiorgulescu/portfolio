import { useQuery } from '@tanstack/react-query';
import { supabase } from '../api/supabase';
import type { Position } from '../types/positions';

const fetchPositions = async (): Promise<Position[]> => {
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

  const { data, error } = await supabase
    .from('positions')
    .select('*')
    .eq('user_id', user.id)
    .order('buy_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as Position[];
};

export const usePositions = () => {
  return useQuery({
    queryKey: ['positions'],
    queryFn: fetchPositions,
  });
};
