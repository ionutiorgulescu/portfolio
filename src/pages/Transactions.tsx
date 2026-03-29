import { useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import PositionsTable from '../components/PositionsTable';
import PositionFormModal from '../components/PositionFormModal';
import DeleteConfirmDialog from '../components/DeleteConfirmDialog';
import { useCreatePosition } from '../hooks/useCreatePosition';
import { useUpdatePosition } from '../hooks/useUpdatePosition';
import { useDeletePosition } from '../hooks/useDeletePosition';
import { useImportPositions } from '../hooks/useImportPositions';
import { usePositions } from '../hooks/usePositions';
import { usePortfolioContext } from '../contexts/PortfolioContext';
import type { NewPosition } from '../schemas/positionSchema';
import type { Position } from '../types/positions';
import { parseXlsxFile } from '../utils/xlsxParser';
import type { RowError } from '../utils/xlsxParser';

type ImportResult = {
  imported: number;
  errors: RowError[];
};

const Transactions = () => {
  const { selectedPortfolioId } = usePortfolioContext();

  // ── Modal / dialog state ────────────────────────────────────────────────────
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | undefined>(undefined);
  const [deletingPosition, setDeletingPosition] = useState<Position | undefined>(undefined);

  // ── Import state ────────────────────────────────────────────────────────────
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Queries & mutations ─────────────────────────────────────────────────────
  const {
    data: positions = [],
    isLoading,
    isError,
    error,
    refetch,
  } = usePositions(selectedPortfolioId ?? '');

  const createPositionMutation = useCreatePosition(selectedPortfolioId ?? '');
  const updatePositionMutation = useUpdatePosition(selectedPortfolioId ?? '');
  const deletePositionMutation = useDeletePosition(selectedPortfolioId ?? '');
  const importPositionsMutation = useImportPositions(selectedPortfolioId ?? '');

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleOpenCreate = () => {
    setEditingPosition(undefined);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (position: Position) => {
    setEditingPosition(position);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingPosition(undefined);
  };

  const handleFormSubmit = async (data: NewPosition) => {
    if (editingPosition) {
      await updatePositionMutation.mutateAsync({ id: editingPosition.id, data });
    } else {
      await createPositionMutation.mutateAsync(data);
    }
    handleCloseForm();
  };

  const handleOpenDelete = (position: Position) => {
    setDeletingPosition(position);
  };

  const handleCloseDelete = () => {
    setDeletingPosition(undefined);
  };

  const handleConfirmDelete = async () => {
    if (!deletingPosition) return;
    await deletePositionMutation.mutateAsync(deletingPosition.id);
    handleCloseDelete();
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
          errors: [
            { row: 0, message: 'Failed to save positions to the database. Please try again.' },
            ...errors,
          ],
        });
      }
    } else {
      setImportResult({ imported: 0, errors });
    }
  };

  if (!selectedPortfolioId) return null;

  const isImporting = importPositionsMutation.isPending;
  const isSubmittingForm =
    createPositionMutation.isPending || updatePositionMutation.isPending;

  return (
    <Stack spacing={3}>
      {/* Header */}
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
            onClick={handleOpenCreate}
            sx={{ bgcolor: 'text.primary', '&:hover': { bgcolor: 'grey.800' }, whiteSpace: 'nowrap' }}
          >
            Add Position
          </Button>
        </Stack>
      </Stack>

      {/* Hidden file input for xlsx import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Import result feedback */}
      {importResult !== null && (
        <Alert
          severity={
            importResult.errors.length === 0
              ? 'success'
              : importResult.imported > 0
                ? 'warning'
                : 'error'
          }
          onClose={() => setImportResult(null)}
        >
          {importResult.imported > 0 && (
            <Typography variant="body2">
              {importResult.imported} position{importResult.imported !== 1 ? 's' : ''} imported
              successfully.
            </Typography>
          )}
          {importResult.errors.length > 0 && (
            <Box mt={importResult.imported > 0 ? 1 : 0}>
              <Typography variant="body2" fontWeight="medium">
                {importResult.errors.length} row{importResult.errors.length !== 1 ? 's' : ''} could
                not be imported:
              </Typography>
              <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                {importResult.errors.map((err) => (
                  <li key={`${err.row}-${err.message}`}>
                    <Typography variant="body2">
                      {err.row > 0 ? `Row ${err.row}: ` : ''}
                      {err.message}
                    </Typography>
                  </li>
                ))}
              </ul>
            </Box>
          )}
        </Alert>
      )}

      {/* Loading / error / empty states */}
      {isLoading && (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress aria-label="Loading positions" />
        </Box>
      )}

      {isError && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              Retry
            </Button>
          }
        >
          {error instanceof Error ? error.message : 'Unable to load positions.'}
        </Alert>
      )}

      {!isLoading && !isError && positions.length === 0 && (
        <Alert severity="info">No positions yet. Add your first position to get started.</Alert>
      )}

      {!isLoading && !isError && positions.length > 0 && (
        <PositionsTable
          positions={positions}
          onEdit={handleOpenEdit}
          onDelete={handleOpenDelete}
        />
      )}

      {/* Create / Edit modal */}
      <PositionFormModal
        open={isFormOpen}
        portfolioId={selectedPortfolioId}
        position={editingPosition}
        isSubmitting={isSubmittingForm}
        onSubmit={handleFormSubmit}
        onClose={handleCloseForm}
      />

      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog
        open={Boolean(deletingPosition)}
        ticker={deletingPosition?.ticker_symbol ?? ''}
        isDeleting={deletePositionMutation.isPending}
        onConfirm={handleConfirmDelete}
        onClose={handleCloseDelete}
      />
    </Stack>
  );
};

export default Transactions;