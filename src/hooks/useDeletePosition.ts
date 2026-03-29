import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../api/supabase';

const deletePosition = async (id: string): Promise<void> => {
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
    throw new Error('You must be signed in to delete a position.');
  }

  const { error } = await supabase
    .from('positions')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id); // guard: only delete own rows

  if (error) {
    console.error('Error deleting position:', error);
    throw error;
  }
};

export const useDeletePosition = (portfolioId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deletePosition(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions', portfolioId] });
    },
    onError: (error) => {
      console.error('Failed to delete position:', error);
    },
  });
};