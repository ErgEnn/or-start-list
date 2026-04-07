import { useEffect, useState } from 'react';
import {
  Alert,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Box,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import type { AllRegistrationRow } from '@or/shared';
import { desktopGetAllRegistrations } from '../lib/desktop';
import { t } from '../i18n';

type AllRegistrationsDialogProps = {
  open: boolean;
  eventId: string;
  onClose: () => void;
  onSelectCompetitor: (competitorId: string) => void;
};

export function AllRegistrationsDialog({ open, eventId, onClose, onSelectCompetitor }: AllRegistrationsDialogProps) {
  const [rows, setRows] = useState<AllRegistrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !eventId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    desktopGetAllRegistrations(eventId)
      .then((data) => {
        if (!cancelled) {
          setRows(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(t('failed_load_all_registrations'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, eventId]);

  return (
    <Dialog fullScreen open={open} onClose={onClose}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5 }}>
        <Typography variant="h6">{t('registered_competitors')}</Typography>
        <IconButton edge="end" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>
        ) : (
          <TableContainer sx={{ maxHeight: '100%' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('reg_time')}</TableCell>
                  <TableCell>{t('eol_code')}</TableCell>
                  <TableCell>{t('first_name')}</TableCell>
                  <TableCell>{t('last_name')}</TableCell>
                  <TableCell>{t('course')}</TableCell>
                  <TableCell align="right">{t('paid_price')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.registrationId}
                    hover
                    onClick={() => { onClose(); onSelectCompetitor(row.competitorId); }}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>{formatRegistrationTime(row.createdAtDevice)}</TableCell>
                    <TableCell>{row.eolNumber}</TableCell>
                    <TableCell>{row.firstName}</TableCell>
                    <TableCell>{row.lastName}</TableCell>
                    <TableCell>{row.courseName}</TableCell>
                    <TableCell align="right">{formatPrice(row.paidPriceCents)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
    </Dialog>
  );
}

function formatRegistrationTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
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
