import { useQuery } from '@tanstack/react-query';
import { backend } from '../api/backend';
import { ALL_PORTFOLIOS_ID } from '../contexts/PortfolioContext';

export const usePositions = (portfolioId: string) => {
  return useQuery({
    queryKey: ['positions', portfolioId],
    queryFn: () =>
      backend.listPositions(portfolioId === ALL_PORTFOLIOS_ID ? undefined : portfolioId),
    enabled: !!portfolioId,
  });
};
