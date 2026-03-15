import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../api/supabase';
import type { ImportRow } from '../utils/xlsxParser';

const importPositions = async (rows: ImportRow[]) => {
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
    throw new Error('You must be signed in to import positions.');
  }

  const payload = rows.map((row) => ({ ...row, user_id: user.id }));

  const { error } = await supabase.from('positions').insert(payload);

  if (error) {
    console.error('Error importing positions:', error);
    throw error;
  }
};

export const useImportPositions = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (rows: ImportRow[]) => importPositions(rows),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
    },
    onError: (error) => {
      console.error('Failed to import positions:', error);
    },
  });
};
