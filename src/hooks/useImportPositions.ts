import { useMutation, useQueryClient } from '@tanstack/react-query';
import { backend } from '../api/backend';
import type { ImportRow } from '../utils/xlsxParser';

export const useImportPositions = (portfolioId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (rows: ImportRow[]) => backend.importPositions(rows, portfolioId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions', portfolioId] });
    },
    onError: (error) => {
      console.error('Failed to import positions:', error);
    },
  });
};
