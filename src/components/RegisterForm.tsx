import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Alert, Box, Button, Link, Stack, TextField, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { backend } from '../api/backend';
import { HttpError } from '../api/http';
import { holdDeployReload } from '../utils/reloadOnStaleChunk';

const PASSWORD_MIN_LENGTH = 8;
const RESEND_COOLDOWN_SECONDS = 60;

const getRegisterErrorMessage = (error: unknown) => {
  if (error instanceof HttpError) {
    if (error.status === 429) {
      return 'Too many attempts. Please wait a few minutes and try again.';
    }
    // The API returns user-facing messages for validation, taken emails and bad codes.
    if (error.status < 500 || error.status === 502) {
      return error.message;
    }
  }
  return 'Something went wrong. Please try again.';
};

const RegisterForm = () => {
  const [step, setStep] = useState<'details' | 'code'>('details');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  // Users leave the tab to read the code; an update reload would wipe the form.
  useEffect(() => holdDeployReload(), []);

  useEffect(() => {
    if (resendIn <= 0) {
      return;
    }
    const timeoutId = window.setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timeoutId);
  }, [resendIn]);

  const sendCode = async () => {
    await backend.startRegistration(email.trim());
    setResendIn(RESEND_COOLDOWN_SECONDS);
  };

  const handleDetailsSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    if (password.length < PASSWORD_MIN_LENGTH) {
      setErrorMessage(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await sendCode();
      setCode('');
      setStep('code');
    } catch (error) {
      setErrorMessage(getRegisterErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCodeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);
    setIsSubmitting(true);

    try {
      // On success the session switches to the signed-in app.
      await backend.completeRegistration(email.trim(), code, password);
    } catch (error) {
      setErrorMessage(getRegisterErrorMessage(error));
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    setErrorMessage(null);
    setInfoMessage(null);
    setIsSubmitting(true);

    try {
      await sendCode();
      setCode('');
      setInfoMessage('A new code is on its way.');
    } catch (error) {
      setErrorMessage(getRegisterErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangeEmail = () => {
    setErrorMessage(null);
    setInfoMessage(null);
    setCode('');
    setStep('details');
  };

  const signInLink = (
    <Typography variant="body2" color="text.secondary" textAlign="center">
      Already have an account?{' '}
      <Link component={RouterLink} to="/">
        Sign in
      </Link>
    </Typography>
  );

  if (step === 'code') {
    return (
      <Box component="form" onSubmit={handleCodeSubmit}>
        <Stack spacing={2}>
          <Typography variant="h5">Check your email</Typography>
          <Typography variant="body2" color="text.secondary">
            We sent a 6-digit code to <strong>{email.trim()}</strong>. It expires in 15 minutes.
          </Typography>

          {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
          {infoMessage && <Alert severity="success">{infoMessage}</Alert>}

          <TextField
            label="Verification code"
            required
            autoFocus
            value={code}
            // No native maxLength: it would cut a pasted "123 456" before the separators are stripped.
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            autoComplete="one-time-code"
            slotProps={{ htmlInput: { inputMode: 'numeric' } }}
          />

          <Button type="submit" variant="contained" disabled={isSubmitting || code.length !== 6}>
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </Button>

          <Stack direction="row" justifyContent="space-between">
            <Button variant="text" onClick={handleChangeEmail} disabled={isSubmitting}>
              Use a different email
            </Button>
            <Button variant="text" onClick={handleResend} disabled={isSubmitting || resendIn > 0}>
              {resendIn > 0 ? `Resend code (${resendIn}s)` : 'Resend code'}
            </Button>
          </Stack>
        </Stack>
      </Box>
    );
  }

  return (
    <Box component="form" onSubmit={handleDetailsSubmit}>
      <Stack spacing={2}>
        <Typography variant="h5">Create account</Typography>
        <Typography variant="body2" color="text.secondary">
          Enter your email and choose a password. We will email you a code to confirm it.
        </Typography>

        {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

        <TextField
          label="Email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
        />

        <TextField
          label="Password"
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          helperText={`At least ${PASSWORD_MIN_LENGTH} characters`}
        />

        <TextField
          label="Confirm password"
          type="password"
          required
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
        />

        <Button type="submit" variant="contained" disabled={isSubmitting}>
          {isSubmitting ? 'Sending code…' : 'Continue'}
        </Button>

        {signInLink}
      </Stack>
    </Box>
  );
};

export default RegisterForm;
