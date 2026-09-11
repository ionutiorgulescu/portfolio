import type { NewPosition } from '../schemas/positionSchema';
import type { Portfolio, Position } from '../types/positions';
import type { ImportRow } from '../utils/xlsxParser';
import { HttpError, http } from './http';
import { supabase } from './supabase';

export type AuthUser = {
  id: string;
  email: string;
};

export type CreatePortfolioInput = {
  name: string;
  description?: string;
};

export type UpdatePortfolioInput = {
  id: string;
  name: string;
  description?: string;
};

export type CreatePositionInput = NewPosition;

export type UpdatePositionInput = {
  id: string;
  data: Partial<NewPosition>;
};

export type AuthBackend = {
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  getUser: () => Promise<AuthUser | null>;
  onAuthChange: (callback: (user: AuthUser | null) => void) => () => void;
};

export type PortfolioBackend = {
  listPortfolios: () => Promise<Portfolio[]>;
  createPortfolio: (input: CreatePortfolioInput) => Promise<Portfolio>;
  updatePortfolio: (input: UpdatePortfolioInput) => Promise<Portfolio>;
  deletePortfolio: (id: string) => Promise<void>;
};

export type PositionBackend = {
  listPositions: (portfolioId?: string) => Promise<Position[]>;
  createPosition: (input: CreatePositionInput) => Promise<Position>;
  updatePosition: (input: UpdatePositionInput) => Promise<Position>;
  deletePosition: (id: string) => Promise<void>;
  importPositions: (rows: ImportRow[], portfolioId: string) => Promise<void>;
};

export type Backend = AuthBackend & PortfolioBackend & PositionBackend;

const toAuthUser = (user: { id: string; email?: string | null }): AuthUser => ({
  id: user.id,
  email: user.email ?? '',
});

const requireSupabaseUser = async (unsignedInMessage: string) => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    if (error.message === 'Auth session missing!') {
      throw new Error('Your session has expired. Please sign in again.');
    }
    throw error;
  }

  if (!user) {
    throw new Error(unsignedInMessage);
  }

  return user;
};

export const supabaseBackend: Backend = {
  login: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw error;
    }
    if (!data.user) {
      throw new Error('Sign in failed. Please try again.');
    }
    return toAuthUser(data.user);
  },

  logout: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
  },

  getUser: async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      if (error.message === 'Auth session missing!') {
        return null;
      }
      throw error;
    }

    return user ? toAuthUser(user) : null;
  },

  onAuthChange: (callback) => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session?.user ? toAuthUser(session.user) : null);
    });

    return () => {
      subscription.unsubscribe();
    };
  },

  listPortfolios: async () => {
    const user = await requireSupabaseUser('You must be signed in to view your portfolios.');

    const { data, error } = await supabase
      .from('portfolios')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return (data ?? []) as Portfolio[];
  },

  createPortfolio: async (input) => {
    const user = await requireSupabaseUser('You must be signed in to create a portfolio.');

    const { data, error } = await supabase
      .from('portfolios')
      .insert({ ...input, user_id: user.id })
      .select()
      .single();

    if (error) throw error;
    return data as Portfolio;
  },

  updatePortfolio: async ({ id, name, description }) => {
    const { data, error } = await supabase
      .from('portfolios')
      .update({ name, description, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Portfolio;
  },

  deletePortfolio: async (id) => {
    const { error } = await supabase.from('portfolios').delete().eq('id', id);

    if (error) throw error;
  },

  listPositions: async (portfolioId) => {
    const user = await requireSupabaseUser('You must be signed in to view your positions.');

    let query = supabase
      .from('positions')
      .select('*')
      .eq('user_id', user.id)
      .order('buy_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (portfolioId) {
      query = query.eq('portfolio_id', portfolioId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data ?? []) as Position[];
  },

  createPosition: async (input) => {
    const user = await requireSupabaseUser('You must be signed in to create a position.');

    const { data, error } = await supabase
      .from('positions')
      .insert({
        ...input,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return data as Position;
  },

  updatePosition: async ({ id, data }) => {
    const user = await requireSupabaseUser('You must be signed in to update a position.');

    const { data: position, error } = await supabase
      .from('positions')
      .update(data)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return position as Position;
  },

  deletePosition: async (id) => {
    const user = await requireSupabaseUser('You must be signed in to delete a position.');

    const { error } = await supabase.from('positions').delete().eq('id', id).eq('user_id', user.id);

    if (error) throw error;
  },

  importPositions: async (rows, portfolioId) => {
    const user = await requireSupabaseUser('You must be signed in to import positions.');

    const payload = rows.map((row) => ({
      ...row,
      user_id: user.id,
      portfolio_id: portfolioId,
    }));

    const { error } = await supabase.from('positions').insert(payload);

    if (error) throw error;
  },
};

const HONO_AUTH_POLL_MS = 30_000;
const honoListeners = new Set<(user: AuthUser | null) => void>();
let inFlightGetUser: Promise<AuthUser | null> | null = null;

const notifyHonoListeners = (user: AuthUser | null) => {
  for (const listener of honoListeners) {
    listener(user);
  }
};

export const honoBackend: Backend = {
  login: async (email, password) => {
    const { user } = await http<{ user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    notifyHonoListeners(user);
    return user;
  },

  logout: async () => {
    await http('/auth/logout', { method: 'POST' });
    notifyHonoListeners(null);
  },

  getUser: async () => {
    if (!inFlightGetUser) {
      inFlightGetUser = (async () => {
        try {
          const { user } = await http<{ user: AuthUser }>('/auth/me');
          return user;
        } catch (error) {
          if (error instanceof HttpError && error.status === 401) {
            return null;
          }
          throw error;
        } finally {
          inFlightGetUser = null;
        }
      })();
    }

    return inFlightGetUser;
  },

  onAuthChange: (callback) => {
    honoListeners.add(callback);
    const intervalId = window.setInterval(() => {
      void honoBackend
        .getUser()
        .then(callback)
        .catch((error: unknown) => {
          if (error instanceof HttpError && error.status === 401) {
            callback(null);
          }
        });
    }, HONO_AUTH_POLL_MS);

    return () => {
      honoListeners.delete(callback);
      window.clearInterval(intervalId);
    };
  },

  listPortfolios: async () => {
    const { portfolios } = await http<{ portfolios: Portfolio[] }>('/portfolios');
    return portfolios;
  },

  createPortfolio: async (input) => {
    const { portfolio } = await http<{ portfolio: Portfolio }>('/portfolios', {
      method: 'POST',
      body: input,
    });
    return portfolio;
  },

  updatePortfolio: async ({ id, name, description }) => {
    const { portfolio } = await http<{ portfolio: Portfolio }>(`/portfolios/${id}`, {
      method: 'PATCH',
      body: { name, description },
    });
    return portfolio;
  },

  deletePortfolio: async (id) => {
    await http(`/portfolios/${id}`, { method: 'DELETE' });
  },

  listPositions: async (portfolioId) => {
    const query = portfolioId ? `?portfolioId=${encodeURIComponent(portfolioId)}` : '';
    const { positions } = await http<{ positions: Position[] }>(`/positions${query}`);
    return positions;
  },

  createPosition: async (input) => {
    const { position } = await http<{ position: Position }>('/positions', {
      method: 'POST',
      body: input,
    });
    return position;
  },

  updatePosition: async ({ id, data }) => {
    const { position } = await http<{ position: Position }>(`/positions/${id}`, {
      method: 'PATCH',
      body: data,
    });
    return position;
  },

  deletePosition: async (id) => {
    await http(`/positions/${id}`, { method: 'DELETE' });
  },

  importPositions: async (rows, portfolioId) => {
    await http('/positions/import', {
      method: 'POST',
      body: {
        positions: rows.map((row) => ({
          ...row,
          portfolio_id: portfolioId,
        })),
      },
    });
  },
};

export const backend: Backend =
  import.meta.env.VITE_BACKEND === 'hono' ? honoBackend : supabaseBackend;
