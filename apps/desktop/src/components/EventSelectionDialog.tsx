import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
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
  loading: boolean;
  requireSelection: boolean;
  onClose: () => void;
  onSelectEvent: (eventId: string) => void;
};

function formatEventLabel(event: Event) {
  return event.startDate ? `${event.name} (${event.startDate})` : event.name;
}

export function EventSelectionDialog({
  open,
  events,
  selectedEventId,
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
            {events.map((event) => (
              <ListItemButton
                key={event.eventId}
                selected={event.eventId === selectedEventId}
                onClick={() => onSelectEvent(event.eventId)}
              >
                <ListItemText primary={formatEventLabel(event)} />
              </ListItemButton>
            ))}
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
}
