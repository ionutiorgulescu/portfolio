import { useMutation, useQueryClient } from '@tanstack/react-query';
import { backend, type UpdatePositionInput } from '../api/backend';

export const useUpdatePosition = (portfolioId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdatePositionInput) => backend.updatePosition(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions', portfolioId] });
    },
    onError: (error) => {
      console.error('Failed to update position:', error);
    },
  });
};
