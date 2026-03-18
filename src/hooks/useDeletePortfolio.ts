import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../api/supabase';

const deletePortfolio = async (portfolioId: string) => {
  const { error } = await supabase
    .from('portfolios')
    .delete()
    .eq('id', portfolioId);

  if (error) throw error;
};

export const useDeletePortfolio = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePortfolio,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
    },
    onError: (error) => {
      console.error('Failed to delete portfolio:', error);
    },
  });
};