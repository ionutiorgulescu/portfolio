import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../api/supabase';

interface CreatePortfolioInput {
  name: string;
  description?: string;
}

const createPortfolio = async (input: CreatePortfolioInput) => {
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
    throw new Error('You must be signed in to create a portfolio.');
  }

  const { data, error } = await supabase
    .from('portfolios')
    .insert({ ...input, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const useCreatePortfolio = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPortfolio,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
    },
    onError: (error) => {
      console.error('Failed to create portfolio:', error);
    },
  });
};