import { useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  TextField,
  Typography,
  DialogActions,
} from '@mui/material';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { color } from '../theme/cssVars';
import { useCreatePortfolio } from '../hooks/useCreatePortfolio';
import { useDeletePortfolio } from '../hooks/useDeletePortfolio';
import { useUpdatePortfolio } from '../hooks/useUpdatePortfolio';
import { ALL_PORTFOLIOS_ID, usePortfolioContext } from '../contexts/PortfolioContext';

type PortfolioManagerModalProps = {
  open: boolean;
  onClose: () => void;
};

export function PortfolioManagerModal({ open, onClose }: PortfolioManagerModalProps) {
  const { portfolios, selectedPortfolioId, setSelectedPortfolioId } = usePortfolioContext();
  const createMutation = useCreatePortfolio();
  const deleteMutation = useDeletePortfolio();
  const updateMutation = useUpdatePortfolio();

  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createMutation.mutateAsync({ name: newName.trim() });
    setNewName('');
  };

  const handleStartEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setEditingName(currentName);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingName.trim()) return;
    await updateMutation.mutateAsync({ id: editingId, name: editingName.trim() });
    setEditingId(null);
    setEditingName('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;
    // If deleting the selected portfolio, switch to another
    if (deletingId === selectedPortfolioId) {
      const next = portfolios.find(p => p.id !== deletingId);
      if (next) setSelectedPortfolioId(next.id);
    }
    await deleteMutation.mutateAsync(deletingId);
    setDeletingId(null);
  };

  return (
    <>
      {/* Main modal */}
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6" fontWeight={700}>Manage Portfolios</Typography>
            <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          <FormControl fullWidth size="small" sx={{ mb: 3 }}>
            <InputLabel id="default-portfolio-label">Default portfolio</InputLabel>
            <Select
              labelId="default-portfolio-label"
              label="Default portfolio"
              value={selectedPortfolioId ?? ''}
              onChange={(e) => setSelectedPortfolioId(e.target.value)}
            >
              <MenuItem value={ALL_PORTFOLIOS_ID}>All Portfolios</MenuItem>
              {portfolios.map((portfolio) => (
                <MenuItem key={portfolio.id} value={portfolio.id}>
                  {portfolio.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Existing portfolios */}
          <List disablePadding>
            {portfolios.map((portfolio) => (
              <ListItem
                key={portfolio.id}
                disablePadding
                sx={{
                  py: 1,
                  px: 0,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  '&:last-child': { borderBottom: 'none' },
                  gap: 1,
                }}
              >
                {editingId === portfolio.id ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                    <TextField
                      size="small"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit();
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                      autoFocus
                      fullWidth
                    />
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={handleSaveEdit}
                      disabled={updateMutation.isPending}
                    >
                      {updateMutation.isPending ? <CircularProgress size={16} /> : <CheckIcon fontSize="small" />}
                    </IconButton>
                    <IconButton size="small" onClick={handleCancelEdit}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ) : (
                  <>
                    <ListItemText
                      primary={portfolio.name}
                      secondary={portfolio.description}
                      primaryTypographyProps={{ fontWeight: portfolio.id === selectedPortfolioId ? 700 : 400 }}
                    />
                    <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                      <IconButton
                        size="small"
                        onClick={() => handleStartEdit(portfolio.id, portfolio.name)}
                        aria-label={`Edit ${portfolio.name}`}
                        sx={{ color: color.textSubtle }}
                      >
                        <EditNoteOutlinedIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => setDeletingId(portfolio.id)}
                        disabled={portfolios.length === 1}
                        aria-label={`Delete ${portfolio.name}`}
                        sx={{ color: color.danger }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </>
                )}
              </ListItem>
            ))}
          </List>

          {/* Create new portfolio */}
          <Box sx={{ mt: 3 }}>
            <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
              New Portfolio
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                size="small"
                placeholder="Portfolio name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
                fullWidth
              />
              <Button
                variant="contained"
                onClick={handleCreate}
                disabled={!newName.trim() || createMutation.isPending}
                sx={{ bgcolor: 'text.primary', '&:hover': { bgcolor: color.buttonHover }, whiteSpace: 'nowrap' }}
              >
                {createMutation.isPending ? <CircularProgress size={16} /> : 'Create'}
              </Button>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deletingId} onClose={() => setDeletingId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Portfolio</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete{' '}
            <strong>{portfolios.find(p => p.id === deletingId)?.name}</strong>?
            This will permanently delete all positions in this portfolio.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeletingId(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDeleteConfirm}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? <CircularProgress size={16} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}