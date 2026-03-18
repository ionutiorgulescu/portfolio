import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { NewPosition } from '../schemas/positionSchema';
import { supabase } from '../api/supabase';

const createPosition = async (positionData: NewPosition) => {
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
    throw new Error('You must be signed in to create a position.');
  }

  const { data, error } = await supabase
    .from('positions')
    .insert({
      ...positionData,
      user_id: user.id,
    });

  if (error) {
    console.error('Error inserting new position:', error);
    throw error;
  }
  return data;
};

export const useCreatePosition = (portfolioId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (positionData: NewPosition) => createPosition(positionData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions', portfolioId] });
    },
    onError: (error) => {
      console.error('Failed to create new position:', error);
    },
  });
};