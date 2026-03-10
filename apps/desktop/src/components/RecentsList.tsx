import { useEffect, useMemo, useRef } from 'react';
import { Box, ButtonBase, Paper, Typography } from '@mui/material';
import type { DesktopRecentRegistration } from '@or/shared';
import { t } from '../i18n';

type RecentsListProps = {
  registrations: DesktopRecentRegistration[];
  loading: boolean;
  onSelectRegistration: (competitorId: string) => void;
};

export function RecentsList({ registrations, loading, onSelectRegistration }: RecentsListProps) {
  const lastItemRef = useRef<HTMLButtonElement | null>(null);
  const visibleRegistrations = useMemo(() => registrations, [registrations]);

  useEffect(() => {
    lastItemRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [registrations]);

  return (
    <Paper
      variant='outlined'
      sx={{
        width: '100%',
        flexShrink: 0,
        maxHeight: '12rem',
        minHeight: '8rem',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant='subtitle2'>
          {t('recent_registrations', { count: visibleRegistrations.length })}
        </Typography>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 15rem', minHeight: 0, flex: 1 }}>
        <Box sx={{ overflowY: 'auto', minHeight: 0 }}>
          {loading && visibleRegistrations.length === 0 ? (
            <EmptyState label={t('loading_registrations')} />
          ) : null}
          {!loading && visibleRegistrations.length === 0 ? (
            <EmptyState label={t('no_registrations_for_selected_event')} />
          ) : null}
          {visibleRegistrations.map((registration, index) => {
            const isLast = index === 0;

            return (
              <ButtonBase
                key={registration.registrationId}
                ref={isLast ? lastItemRef : undefined}
                onClick={() => onSelectRegistration(registration.competitorId)}
                focusRipple
                sx={{
                  width: '100%',
                  px: 1.5,
                  py: 0.75,
                  borderBottom: index === visibleRegistrations.length - 1 ? 0 : 1,
                  borderColor: 'divider',
                  display: 'grid',
                  gridTemplateColumns: '5.5rem minmax(0, 1fr) 5rem',
                  gap: 1,
                  alignItems: 'start',
                  cursor: 'pointer',
                  textAlign: 'left',
                  justifyItems: 'stretch',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                }}
              >
                <Typography variant='caption' color='text.secondary' sx={{ pt: 0.25 }}>
                  {formatRegistrationTime(registration.createdAtDevice)}
                </Typography>
                <Box sx={{ minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
                  <Typography variant='body2' noWrap sx={{ minWidth: 0, flex: '0 1 auto' }}>
                    {registration.competitorName}
                  </Typography>
                  <Typography variant='caption' color='text.secondary' noWrap sx={{ flexShrink: 0 }}>
                    {registration.courseName}
                  </Typography>
                </Box>
                <Typography variant='body2' sx={{ textAlign: 'right' }}>
                  {formatPrice(registration.priceCents)}
                </Typography>
              </ButtonBase>
            );
          })}
        </Box>
        <Box sx={{ borderLeft: 1, borderColor: 'divider', px: 1.5, py: 1 }}>
          <Typography variant='caption' color='text.secondary'>
            {t('running_totals')}
          </Typography>
          <TotalsLine label={t('last_n', { count: 2 })} value={sumRecent(registrations, 2)} />
          <TotalsLine label={t('last_n', { count: 3 })} value={sumRecent(registrations, 3)} />
          <TotalsLine label={t('last_n', { count: 4 })} value={sumRecent(registrations, 4)} />
        </Box>
      </Box>
    </Paper>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <Box sx={{ px: 1.5, py: 1.5 }}>
      <Typography variant='body2' color='text.secondary'>
        {label}
      </Typography>
    </Box>
  );
}

function TotalsLine({ label, value }: { label: string; value: number }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.75 }}>
      <Typography variant='body2'>{label}</Typography>
      <Typography variant='body2'>{formatPrice(value)}</Typography>
    </Box>
  );
}

function sumRecent(registrations: DesktopRecentRegistration[], count: number) {
  return registrations
    .slice(0, count)
    .reduce((total, registration) => total + registration.priceCents, 0);
}

function formatRegistrationTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatPrice(priceCents: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'EUR',
  }).format(priceCents / 100);
}
