import { useState } from 'react';
import type { FormEvent } from 'react';
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
import { backend } from '../api/backend';

const getSignInErrorMessage = (error: unknown) => {
  const normalizedMessage = error instanceof Error ? error.message.toLowerCase() : '';

  if (normalizedMessage.includes('invalid login credentials') || normalizedMessage.includes('invalid credentials')) {
    return 'Incorrect email or password. Please try again.';
  }

  if (normalizedMessage.includes('rate limit') || normalizedMessage.includes('for security purposes')) {
    return 'Too many login attempts. Please wait and try again.';
  }

  if (normalizedMessage.includes('email not confirmed')) {
    return 'Please confirm your email address before signing in.';
  }

  return 'Sign in failed. Please try again.';
};

const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await backend.login(email.trim(), password);
    } catch (error) {
      setErrorMessage(getSignInErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Stack spacing={2}>
        <Typography variant="h5">Sign in</Typography>
        <Typography variant="body2" color="text.secondary">
          Enter your email and password to access your portfolio.
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
          autoComplete="current-password"
        />

        <Button type="submit" variant="contained" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </Stack>
    </Box>
  );
};

export default LoginForm;
