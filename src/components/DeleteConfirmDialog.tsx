import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  CircularProgress,
} from '@mui/material';

type DeleteConfirmDialogProps = {
  open: boolean;
  ticker: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

const DeleteConfirmDialog = ({
  open,
  ticker,
  isDeleting,
  onConfirm,
  onClose,
}: DeleteConfirmDialogProps) => (
  <Dialog open={open} onClose={!isDeleting ? onClose : undefined} maxWidth="xs" fullWidth>
    <DialogTitle>Delete Position</DialogTitle>
    <DialogContent>
      <DialogContentText>
        Are you sure you want to delete the <strong>{ticker}</strong> position? This action cannot be
        undone.
      </DialogContentText>
    </DialogContent>
    <DialogActions sx={{ px: 3, pb: 2 }}>
      <Button onClick={onClose} disabled={isDeleting}>
        Cancel
      </Button>
      <Button
        onClick={onConfirm}
        disabled={isDeleting}
        variant="contained"
        color="error"
        startIcon={isDeleting ? <CircularProgress size={16} color="inherit" /> : undefined}
      >
        {isDeleting ? 'Deleting…' : 'Delete'}
      </Button>
    </DialogActions>
  </Dialog>
);

export default DeleteConfirmDialog;
