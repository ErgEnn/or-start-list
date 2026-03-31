import { Button } from '@mui/material';
import { t } from '../i18n';

type SiReaderButtonProps = {
  bufferedCard: number | null;
  onCardSelect: (cardNumber: number) => void;
};

export function SiReaderButton({ bufferedCard, onCardSelect }: SiReaderButtonProps) {
  const hasCard = bufferedCard !== null;

  return (
    <Button
      variant="outlined"
      disabled={!hasCard}
      onClick={() => {
        if (bufferedCard !== null) {
          onCardSelect(bufferedCard);
        }
      }}
      sx={{
        minWidth: '56px',
        fontWeight: 'bold',
        whiteSpace: 'nowrap',
        ...(hasCard && {
          borderWidth: 2,
          borderColor: 'rgb(25, 118, 210)',
        }),
      }}
    >
      {t('si_reader')}
    </Button>
  );
}
