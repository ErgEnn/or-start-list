import { Box, Typography } from '@mui/material';
import type { Event } from '@or/shared';
import { t } from '../i18n';

type TitleBarProps = {
  selectedEvent: Event | null;
  onClick: () => void;
};

function formatEventLabel(event: Event) {
  return event.startDate ? `${event.name} (${event.startDate})` : event.name;
}

export function TitleBar({ selectedEvent, onClick }: TitleBarProps) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '3rem',
        px: 0,
        borderRadius: 0,
        backgroundColor: 'grey.900',
        cursor: 'pointer',
        userSelect: 'none',
        marginX: '-1vw',
      }}
    >
      <Typography variant='body1' fontWeight={700} color='primary.contrastText' textAlign='center'>
        {selectedEvent ? formatEventLabel(selectedEvent) : t('event_select')}
      </Typography>
    </Box>
  );
}
