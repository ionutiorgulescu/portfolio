import { useMutation, useQueryClient } from '@tanstack/react-query';
import { backend } from '../api/backend';

export const useDeletePosition = (portfolioId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => backend.deletePosition(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions', portfolioId] });
    },
    onError: (error) => {
      console.error('Failed to delete position:', error);
    },
  });
};
