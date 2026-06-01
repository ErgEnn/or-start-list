import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { Box, Typography } from '@mui/material';
import type { Event } from '@or/shared';
import { t } from '../i18n';

type TitleBarProps = {
  selectedEvent: Event | null;
  isEventToday: boolean;
  onClick: () => void;
};

function formatEventLabel(event: Event) {
  return event.startDate ? `${event.name} (${event.startDate})` : event.name;
}

export function TitleBar({ selectedEvent, isEventToday, onClick }: TitleBarProps) {
  const pulse = selectedEvent !== null && !isEventToday;
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
        ...(pulse
          ? {
              '@keyframes titleBarPulse': {
                '0%, 49.999%': { backgroundColor: 'rgb(33, 33, 33)' },
                '50%, 100%': { backgroundColor: '#8b0000' },
              },
              animation: 'titleBarPulse 2s step-end infinite',
            }
          : {}),
      }}
    >
      <Typography variant='body1' fontWeight={700} color='primary.contrastText' textAlign='center' sx={{ display: 'flex', alignItems: 'center' }}>
        {selectedEvent ? formatEventLabel(selectedEvent) : t('event_select')}
        <ArrowDropDownIcon sx={{ color: 'primary.contrastText', ml: 0.25 }} />
      </Typography>
    </Box>
  );
}
