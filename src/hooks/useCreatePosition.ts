import { useMutation, useQueryClient } from '@tanstack/react-query';
import { backend, type CreatePositionInput } from '../api/backend';

export const useCreatePosition = (portfolioId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (positionData: CreatePositionInput) => backend.createPosition(positionData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions', portfolioId] });
    },
    onError: (error) => {
      console.error('Failed to create new position:', error);
    },
  });
};
