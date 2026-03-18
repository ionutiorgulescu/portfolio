import { useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import NewPositionForm from '../components/NewPositionForm';
import PositionsTable from '../components/PositionsTable';
import { useCreatePosition } from '../hooks/useCreatePosition';
import { useImportPositions } from '../hooks/useImportPositions';
import { usePositions } from '../hooks/usePositions';
import { usePortfolioContext } from '../contexts/PortfolioContext';
import type { NewPosition } from '../schemas/positionSchema';
import { parseXlsxFile } from '../utils/xlsxParser';
import type { RowError } from '../utils/xlsxParser';

type ImportResult = {
  imported: number;
  errors: RowError[];
};

const Transactions = () => {
  const { selectedPortfolioId } = usePortfolioContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    data: positions = [],
    isLoading,
    isError,
    error,
    refetch,
  } = usePositions(selectedPortfolioId ?? '');

  const createPositionMutation = useCreatePosition(selectedPortfolioId ?? '');
  const importPositionsMutation = useImportPositions(selectedPortfolioId ?? '');

  const handleCreatePosition = async (data: NewPosition) => {
    await createPositionMutation.mutateAsync(data);
    setIsModalOpen(false);
  };

  const handleImportClick = () => {
    setImportResult(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';

    const buffer = await file.arrayBuffer();
    const { valid, errors } = parseXlsxFile(buffer);

    if (valid.length > 0) {
      try {
        await importPositionsMutation.mutateAsync(valid);
        setImportResult({ imported: valid.length, errors });
      } catch {
        setImportResult({
          imported: 0,
          errors: [{ row: 0, message: 'Failed to save positions to the database. Please try again.' }, ...errors],
        });
      }
    } else {
      setImportResult({ imported: 0, errors });
    }
  };

  if (!selectedPortfolioId) return null;

  const isImporting = importPositionsMutation.isPending;

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
        <Typography variant="h4">Transactions</Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            onClick={handleImportClick}
            disabled={isImporting}
            startIcon={isImporting ? <CircularProgress size={16} /> : undefined}
            sx={{ borderColor: 'text.primary', color: 'text.primary', whiteSpace: 'nowrap' }}
          >
            {isImporting ? 'Importing…' : 'Import'}
          </Button>
          <Button
            variant="contained"
            onClick={() => setIsModalOpen(true)}
            sx={{ bgcolor: 'text.primary', '&:hover': { bgcolor: 'grey.800' }, whiteSpace: 'nowrap' }}
          >
            Add Position
          </Button>
        </Stack>
      </Stack>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {importResult !== null && (
        <Alert
          severity={importResult.errors.length === 0 ? 'success' : importResult.imported > 0 ? 'warning' : 'error'}
          onClose={() => setImportResult(null)}
        >
          {importResult.imported > 0 && (
            <Typography variant="body2">
              {importResult.imported} position{importResult.imported !== 1 ? 's' : ''} imported successfully.
            </Typography>
          )}
          {importResult.errors.length > 0 && (
            <Box mt={importResult.imported > 0 ? 1 : 0}>
              <Typography variant="body2" fontWeight="medium">
                {importResult.errors.length} row{importResult.errors.length !== 1 ? 's' : ''} could not be imported:
              </Typography>
              <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                {importResult.errors.map((err) => (
                  <li key={`${err.row}-${err.message}`}>
                    <Typography variant="body2">
                      {err.row > 0 ? `Row ${err.row}: ` : ''}{err.message}
                    </Typography>
                  </li>
                ))}
              </ul>
            </Box>
          )}
        </Alert>
      )}

      {isLoading && (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress aria-label="Loading positions" />
        </Box>
      )}

      {isError && (
        <Alert
          severity="error"
          action={<Button color="inherit" size="small" onClick={() => refetch()}>Retry</Button>}
        >
          {error instanceof Error ? error.message : 'Unable to load positions.'}
        </Alert>
      )}

      {!isLoading && !isError && positions.length === 0 && (
        <Alert severity="info">No positions yet. Add your first position to get started.</Alert>
      )}

      {!isLoading && !isError && positions.length > 0 && (
        <PositionsTable positions={positions} />
      )}

      <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add New Position</DialogTitle>
        <DialogContent>
          <NewPositionForm
            onSubmit={handleCreatePosition}
            isSubmitting={createPositionMutation.isPending}
            portfolioId={selectedPortfolioId}
          />
        </DialogContent>
      </Dialog>
    </Stack>
  );
};

export default Transactions;