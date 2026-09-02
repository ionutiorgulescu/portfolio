import { useMutation, useQueryClient } from '@tanstack/react-query';
import { backend, type CreatePortfolioInput } from '../api/backend';

export const useCreatePortfolio = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePortfolioInput) => backend.createPortfolio(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
    },
    onError: (error) => {
      console.error('Failed to create portfolio:', error);
    },
  });
};
