import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../api/supabase';

type UpdatePortfolioInput = {
  id: string;
  name: string;
  description?: string;
};

const updatePortfolio = async ({ id, name, description }: UpdatePortfolioInput) => {
  const { data, error } = await supabase
    .from('portfolios')
    .update({ name, description, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const useUpdatePortfolio = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updatePortfolio,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
    },
    onError: (error) => {
      console.error('Failed to update portfolio:', error);
    },
  });
};