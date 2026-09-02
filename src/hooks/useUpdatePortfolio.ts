import { useMutation, useQueryClient } from '@tanstack/react-query';
import { backend, type UpdatePortfolioInput } from '../api/backend';

export const useUpdatePortfolio = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdatePortfolioInput) => backend.updatePortfolio(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
    },
    onError: (error) => {
      console.error('Failed to update portfolio:', error);
    },
  });
};
