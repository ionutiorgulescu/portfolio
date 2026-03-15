import { useState } from 'react';
import { useEffect } from 'react';
import type { FormEvent } from 'react';
import type { AuthError } from '@supabase/supabase-js';
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
import { supabase } from '../api/supabase';

const OTP_COOLDOWN_SECONDS = 30;

const getEmailRedirectTo = () => {
  const configuredAppUrl = import.meta.env.VITE_APP_URL?.trim();
  return configuredAppUrl || window.location.origin;
};

const getMagicLinkErrorMessage = (error: AuthError) => {
  const normalizedMessage = error.message.toLowerCase();

  if (normalizedMessage.includes('rate limit') || normalizedMessage.includes('for security purposes')) {
    return 'Too many login attempts. Please wait and try again.';
  }

  if (normalizedMessage.includes('invalid email')) {
    return 'Please enter a valid email address.';
  }

  if (normalizedMessage.includes('email provider is disabled')) {
    return 'Magic Link sign-in is currently unavailable. Please try again later.';
  }

  return 'We could not send your Magic Link. Please try again.';
};

const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!cooldownSeconds) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setCooldownSeconds((currentValue) => {
        if (currentValue <= 1) {
          window.clearInterval(intervalId);
          return 0;
        }

        return currentValue - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [cooldownSeconds]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim();

    if (cooldownSeconds > 0) {
      setErrorMessage(`Please wait ${cooldownSeconds}s before requesting another link.`);
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: getEmailRedirectTo(),
      },
    });

    if (error) {
      setErrorMessage(getMagicLinkErrorMessage(error));
    } else {
      setSuccessMessage(`Magic Link sent to ${normalizedEmail}. Check your inbox and click the link to sign in.`);
      setCooldownSeconds(OTP_COOLDOWN_SECONDS);
    }

    setIsSubmitting(false);
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Stack spacing={2}>
        <Typography variant="h5">Sign in with Magic Link</Typography>
        <Typography variant="body2" color="text.secondary">
          Enter your email and we will send you a secure sign-in link.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          New users are created automatically when they open their first Magic Link.
        </Typography>

        {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
        {successMessage && <Alert severity="success">{successMessage}</Alert>}

        <TextField
          label="Email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
        />

        <Button type="submit" variant="contained" disabled={isSubmitting || cooldownSeconds > 0}>
          {successMessage ? 'Resend Magic Link' : 'Send Magic Link'}
        </Button>

        {cooldownSeconds > 0 && (
          <Typography variant="caption" color="text.secondary">
            You can request a new link in {cooldownSeconds}s.
          </Typography>
        )}
      </Stack>
    </Box>
  );
};

export default LoginForm;
