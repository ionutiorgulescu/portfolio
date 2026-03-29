import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../api/supabase';
import type { NewPosition } from '../schemas/positionSchema';

type UpdatePositionPayload = {
  id: string;
  data: Partial<NewPosition>;
};

const updatePosition = async ({ id, data }: UpdatePositionPayload): Promise<void> => {
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
    throw new Error('You must be signed in to update a position.');
  }

  const { error } = await supabase
    .from('positions')
    .update(data)
    .eq('id', id)
    .eq('user_id', user.id); // guard: only update own rows

  if (error) {
    console.error('Error updating position:', error);
    throw error;
  }
};

export const useUpdatePosition = (portfolioId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdatePositionPayload) => updatePosition(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions', portfolioId] });
    },
    onError: (error) => {
      console.error('Failed to update position:', error);
    },
  });
};