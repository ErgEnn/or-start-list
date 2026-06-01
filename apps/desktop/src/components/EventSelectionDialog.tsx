import { memo } from 'react';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  Chip,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material';
import type { Event } from '@or/shared';
import { t } from '../i18n';

type EventSelectionDialogProps = {
  open: boolean;
  events: Event[];
  selectedEventId: string;
  today: string;
  loading: boolean;
  requireSelection: boolean;
  onClose: () => void;
  onSelectEvent: (eventId: string) => void;
};

function formatEventLabel(event: Event) {
  return event.startDate ? `${event.name} (${event.startDate})` : event.name;
}

export const EventSelectionDialog = memo(function EventSelectionDialog({
  open,
  events,
  selectedEventId,
  today,
  loading,
  requireSelection,
  onClose,
  onSelectEvent,
}: EventSelectionDialogProps) {
  const canClose = !requireSelection;

  return (
    <Dialog
      open={open}
      onClose={canClose ? onClose : undefined}
      fullWidth
      maxWidth='sm'
      disableEscapeKeyDown={!canClose}
    >
      <DialogTitle>{t('event_select')}</DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Typography color='text.secondary'>{t('loading_events')}</Typography>
        ) : events.length === 0 ? (
          <Typography color='text.secondary'>{t('event_none')}</Typography>
        ) : (
          <List disablePadding>
            {events.map((event) => {
              const isToday = event.startDate === today;
              const isPast = !!event.startDate && event.startDate < today;
              return (
                <ListItemButton
                  key={event.eventId}
                  selected={event.eventId === selectedEventId}
                  onClick={() => onSelectEvent(event.eventId)}
                >
                  <ListItemText
                    primary={formatEventLabel(event)}
                    primaryTypographyProps={{
                      sx: {
                        color: isPast ? 'text.disabled' : 'text.primary',
                        fontWeight: isToday ? 700 : 400,
                      },
                    }}
                  />
                  {isToday ? (
                    <Chip
                      label={t('event_today')}
                      color='primary'
                      size='small'
                      sx={{ ml: 1, fontWeight: 700 }}
                    />
                  ) : null}
                </ListItemButton>
              );
            })}
          </List>
        )}
      </DialogContent>
      {canClose ? (
        <DialogActions>
          <Button onClick={onClose}>{t('cancel')}</Button>
        </DialogActions>
      ) : null}
    </Dialog>
  );
});
