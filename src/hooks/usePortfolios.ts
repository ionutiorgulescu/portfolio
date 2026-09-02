import { useQuery } from '@tanstack/react-query';
import { backend } from '../api/backend';

export const usePortfolios = () => {
  return useQuery({
    queryKey: ['portfolios'],
    queryFn: () => backend.listPortfolios(),
  });
};
