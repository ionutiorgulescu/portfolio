import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  isCompositionFilter,
  rememberCompositionFilter,
  type CompositionFilter,
} from '../components/FilterControl';
import { TickerChart } from '../components/TickerDetails/TickerChart';
import { TickerFundamentals } from '../components/TickerDetails/TickerFundamentals';
import { useRegisterPullToRefresh } from '../contexts/PullToRefreshContext';
import { useStockLogos } from '../hooks/useStockLogos';
import { useTickerFundamentals } from '../hooks/useTickerFundamentals';

type LocationState = {
  name?: string;
  currency?: string;
  compositionFilter?: CompositionFilter;
};

const primaryTextSx = {
  color: '#393a36',
  fontFamily: '"Open Sans", sans-serif',
};

const mutedTextSx = {
  color: '#9a9a96',
  fontFamily: '"Open Sans", sans-serif',
};

/** Light/white logos that disappear on the white avatar — invert to make them visible. */
const INVERT_LOGO_TICKERS = new Set(['V', 'UBER', 'AMZN', 'UNH', 'ABBV', 'ABR']);

function TickerLogo({ ticker, logoUrl }: { ticker: string; logoUrl?: string | null }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [ticker, logoUrl]);

  const invertLogo = INVERT_LOGO_TICKERS.has(ticker.toUpperCase());
  const showImage = Boolean(logoUrl) && !failed;

  return (
    <Box
      sx={{
        position: 'relative',
        width: 44,
        height: 44,
        borderRadius: '50%',
        bgcolor: '#f4f4f2',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {(!showImage || !loaded) && (
        <Typography
          sx={{
            ...mutedTextSx,
            fontSize: 11,
            lineHeight: '14px',
            fontWeight: 700,
            letterSpacing: 0.2,
          }}
        >
          {ticker.slice(0, 4)}
        </Typography>
      )}
      {showImage ? (
        <Box
          component="img"
          key={logoUrl}
          src={logoUrl ?? undefined}
          alt={`${ticker} logo`}
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false);
            setFailed(true);
          }}
          sx={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            p: '6px',
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.15s ease',
            ...(invertLogo ? { filter: 'invert(1)' } : null),
          }}
        />
      ) : null}
    </Box>
  );
}

const TickerDetailsPage = () => {
  const { symbol = '' } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const state = (location.state ?? {}) as LocationState;
  const ticker = symbol.trim().toUpperCase();

  const { data, isLoading, error } = useTickerFundamentals(ticker);
  const { logosByTicker } = useStockLogos(ticker ? [ticker] : []);
  const pageRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    let node: HTMLElement | null = pageRef.current?.parentElement ?? null;
    while (node) {
      const overflowY = getComputedStyle(node).overflowY;
      if (overflowY === 'auto' || overflowY === 'scroll') {
        node.scrollTop = 0;
        return;
      }
      node = node.parentElement;
    }
    window.scrollTo(0, 0);
  }, []);

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['ticker-fundamentals', ticker] }),
      queryClient.invalidateQueries({ queryKey: ['stock-history', ticker] }),
      queryClient.invalidateQueries({ queryKey: ['stock-intraday', ticker] }),
    ]);
  }, [queryClient, ticker]);

  useRegisterPullToRefresh(handleRefresh);

  const handleBack = () => {
    if (isCompositionFilter(state.compositionFilter)) {
      rememberCompositionFilter(state.compositionFilter);
    }
    if (location.key !== 'default') {
      navigate(-1);
      return;
    }
    navigate('/dashboard', {
      state: isCompositionFilter(state.compositionFilter)
        ? { compositionFilter: state.compositionFilter }
        : undefined,
    });
  };

  const name = data?.name || state.name || ticker;
  const currency = data?.currency || state.currency || 'USD';
  const logoUrl = logosByTicker.get(ticker);

  return (
    <Box
      ref={pageRef}
      sx={{
        bgcolor: 'white',
        borderRadius: '16px',
        p: { xs: 2.5, sm: 3 },
        boxShadow: '0 2px 4px rgba(0,0,0,0.10)',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          columnGap: 1.5,
          mb: 2.5,
        }}
      >
        <IconButton
          aria-label="Back"
          onClick={handleBack}
          sx={{
            ml: -1,
            color: '#393a36',
            flexShrink: 0,
          }}
        >
          <ChevronLeftIcon />
        </IconButton>
        <TickerLogo ticker={ticker} logoUrl={logoUrl} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          {isLoading && !data && !state.name ? (
            <>
              <Skeleton width={160} height={24} />
              <Skeleton width={64} height={18} />
            </>
          ) : (
            <>
              <Typography
                sx={{
                  ...primaryTextSx,
                  fontSize: 18,
                  lineHeight: '22px',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {name}
              </Typography>
              <Typography
                sx={{
                  ...mutedTextSx,
                  fontSize: 14,
                  lineHeight: '18px',
                  fontWeight: 500,
                  mt: 0.25,
                }}
              >
                {ticker}
              </Typography>
            </>
          )}
        </Box>
      </Box>

      <Box sx={{ mb: 4 }}>
        <TickerChart
          ticker={ticker}
          currency={currency}
          livePrice={data?.price ?? null}
          previousClose={data?.previousClose ?? null}
          quoteChangePercent={data?.changePercent ?? null}
          marketState={data?.marketState}
          preMarketPrice={data?.preMarketPrice}
          postMarketPrice={data?.postMarketPrice}
          extendedMarketPrice={data?.extendedMarketPrice}
          preMarketChangePercent={data?.preMarketChangePercent}
          postMarketChangePercent={data?.postMarketChangePercent}
          extendedMarketChangePercent={data?.extendedMarketChangePercent}
        />
      </Box>

      <TickerFundamentals
        data={data}
        isLoading={isLoading}
        error={error}
        currency={currency}
      />
    </Box>
  );
};

export default TickerDetailsPage;
