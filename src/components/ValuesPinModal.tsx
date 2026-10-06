import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  ButtonBase,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from '@mui/material';
import BackspaceOutlinedIcon from '@mui/icons-material/BackspaceOutlined';
import CloseIcon from '@mui/icons-material/Close';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { color } from '../theme/cssVars';

const TEXT = color.textStrong;
const MUTED = color.textSubtle;
const ACCENT = color.gain;
const ERROR = color.loss;
const PIN_LENGTH = 4;
const KEYPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'] as const;

type ValuesPinModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (pin: string) => boolean | string | void;
};

export function ValuesPinModal({ open, onClose, onSubmit }: ValuesPinModalProps) {
  const submittingRef = useRef(false);
  const pinRef = useRef('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const resetEntry = useCallback(() => {
    pinRef.current = '';
    setPin('');
    setError(null);
    submittingRef.current = false;
  }, []);

  useEffect(() => {
    if (!open) return;
    resetEntry();
  }, [open, resetEntry]);

  const submitPin = useCallback((value: string) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      const matched = onSubmit(value);
      if (matched === true) return;
      setError(typeof matched === 'string' ? matched : 'Incorrect PIN');
      pinRef.current = '';
      setPin('');
    } catch {
      setError('Could not check PIN. Try again.');
      pinRef.current = '';
      setPin('');
    } finally {
      submittingRef.current = false;
    }
  }, [onSubmit]);

  const appendDigit = useCallback((digit: string) => {
    if (submittingRef.current) return;
    if (pinRef.current.length >= PIN_LENGTH) return;

    const next = `${pinRef.current}${digit}`.slice(0, PIN_LENGTH);
    pinRef.current = next;
    setPin(next);
    setError(null);

    if (next.length === PIN_LENGTH) {
      submitPin(next);
    }
  }, [submitPin]);

  const removeDigit = useCallback(() => {
    if (submittingRef.current) return;
    const next = pinRef.current.slice(0, -1);
    pinRef.current = next;
    setPin(next);
    setError(null);
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key === 'Backspace') {
        event.preventDefault();
        removeDigit();
        return;
      }
      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        appendDigit(event.key);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, appendDigit, removeDigit, onClose]);

  const handleKeypadPress = (key: (typeof KEYPAD_KEYS)[number]) => {
    if (key === '') return;
    if (key === 'back') {
      removeDigit();
      return;
    }
    appendDigit(key);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      disableAutoFocus
      disableEnforceFocus
      disableRestoreFocus
      disableScrollLock
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
            mx: 2,
            mb: 'max(16px, env(safe-area-inset-bottom))',
          },
        },
      }}
    >
      <DialogTitle sx={{ pb: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LockOutlinedIcon sx={{ fontSize: 22, color: MUTED }} />
            <Typography variant="h6" fontWeight={700} sx={{ color: TEXT }}>
              Enter PIN
            </Typography>
          </Box>
          <IconButton size="small" onClick={onClose} aria-label="Close">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Typography sx={{ fontSize: 14, color: MUTED, mb: 2.5 }}>
          Enter your 4-digit PIN to show values.
        </Typography>

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            gap: 1.25,
            py: 0.5,
            ...(error
              ? {
                  animation: 'pinShake 0.35s ease',
                  '@keyframes pinShake': {
                    '0%, 100%': { transform: 'translateX(0)' },
                    '25%': { transform: 'translateX(-6px)' },
                    '75%': { transform: 'translateX(6px)' },
                  },
                }
              : null),
          }}
        >
          {Array.from({ length: PIN_LENGTH }, (_, index) => {
            const filled = index < pin.length;
            const active = index === pin.length;
            return (
              <Box
                key={index}
                aria-hidden
                sx={{
                  width: 52,
                  height: 60,
                  borderRadius: 2,
                  border: '1.5px solid',
                  borderColor: error ? ERROR : active ? ACCENT : color.border,
                  bgcolor: filled ? color.bgMuted : color.bgSurface,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {filled ? (
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      bgcolor: error ? ERROR : TEXT,
                    }}
                  />
                ) : null}
              </Box>
            );
          })}
        </Box>

        {error ? (
          <Typography
            sx={{
              mt: 1.5,
              mb: 1,
              fontSize: 13,
              fontWeight: 600,
              color: ERROR,
              textAlign: 'center',
            }}
          >
            {error}
          </Typography>
        ) : (
          <Box sx={{ height: 20, mt: 1.5, mb: 1 }} />
        )}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 1,
            maxWidth: 280,
            mx: 'auto',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            touchAction: 'manipulation',
          }}
        >
          {KEYPAD_KEYS.map((key, index) => {
            if (key === '') {
              return <Box key={`empty-${index}`} />;
            }

            const isBackspace = key === 'back';
            return (
              <ButtonBase
                key={key}
                type="button"
                aria-label={isBackspace ? 'Delete' : `Digit ${key}`}
                onClick={() => handleKeypadPress(key)}
                sx={{
                  height: 52,
                  borderRadius: 2,
                  fontSize: 22,
                  fontWeight: 600,
                  color: TEXT,
                  bgcolor: color.bgMuted,
                  WebkitTapHighlightColor: 'transparent',
                  touchAction: 'manipulation',
                  '&:active': {
                    bgcolor: color.chartBase,
                  },
                }}
              >
                {isBackspace ? (
                  <BackspaceOutlinedIcon sx={{ fontSize: 22, color: MUTED }} />
                ) : (
                  key
                )}
              </ButtonBase>
            );
          })}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: MUTED }}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}
