import { Box } from '@mui/material';
import type { DesktopSyncStatus } from '@or/shared';
import { t } from '../i18n';

type StatusBarProps = {
  totalCount: number;
  indexedCount: number;
  visibleCount: number;
  loading: boolean;
  error: string;
  lastUpdatedAt: Date | null;
  syncStatus: DesktopSyncStatus;
};

function formatLastUpdated(lastUpdatedAt: Date | null) {
  if (!lastUpdatedAt) {
    return t('never');
  }

  return lastUpdatedAt.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatSyncStatus(status: DesktopSyncStatus['status']) {
  switch (status) {
    case 'idle':
      return t('status_idle');
    case 'offline':
      return t('status_offline');
    case 'online':
      return t('status_online');
    case 'syncing':
      return t('status_syncing');
    default:
      return status;
  }
}

export function StatusBar({
  totalCount,
  indexedCount,
  visibleCount,
  loading,
  error,
  lastUpdatedAt,
  syncStatus,
}: StatusBarProps) {
  const statusError = error || syncStatus.lastError;

  return (
    <Box
      sx={{
        width: '100%',
        height: '1.75rem',
        minHeight: '1.75rem',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75em',
          width: '100%',
          minWidth: 0,
        }}
      >
        <Box sx={{ fontSize: '0.9em', color: 'text.secondary', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {t('shown_count', { count: visibleCount })} / {t('total_in_filters', { count: totalCount })} / {t('indexed_count', { count: indexedCount })}
        </Box>
        <Box sx={{ fontSize: '0.9em', color: 'text.secondary', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {loading ? t('loading_local_cache') : t('last_sync', { time: formatLastUpdated(lastUpdatedAt) })}
        </Box>
        <Box
          sx={{
            fontSize: '0.9em',
            color: syncStatus.status === 'offline' ? 'warning.main' : 'text.secondary',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {formatSyncStatus(syncStatus.status)} · {t('pending_count', { count: syncStatus.pendingRegistrations })}
        </Box>
        {statusError ? (
          <Box
            title={statusError}
            sx={{
              minWidth: 0,
              flex: 1,
              fontSize: '0.9em',
              color: 'error.main',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {statusError}
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
