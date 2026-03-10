import { ToggleButton } from '@mui/material';
import type { PaymentGroup } from '@or/shared';
import { SpacedToggleButtonGroup } from './SpacedToggleButtonGroup';
import { t } from '../i18n';

function getFilterButtonStyles(colorHex: string | null, selected: boolean) {
  if (!colorHex) {
    return undefined;
  }

  const textColor = getContrastingTextColor(colorHex);

  return {
    borderColor: colorHex,
    color: selected ? textColor : colorHex,
    backgroundColor: selected ? colorHex : `${colorHex}14`,
    '&:hover': {
      backgroundColor: selected ? colorHex : `${colorHex}24`,
      borderColor: colorHex,
    },
    '&.Mui-selected': {
      color: textColor,
      backgroundColor: colorHex,
    },
    '&.Mui-selected:hover': {
      backgroundColor: colorHex,
    },
  };
}

function getContrastingTextColor(colorHex: string) {
  const normalized = colorHex.replace('#', '');
  if (normalized.length !== 6) {
    return '#111';
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  const brightness = (red * 299 + green * 587 + blue * 114) / 1000;
  return brightness > 160 ? '#111' : '#fff';
}

type FilterBarProps = {
  paymentGroups: PaymentGroup[];
  value: string;
  onChange: (value: string) => void;
};

export function FilterBar({ paymentGroups, value, onChange }: FilterBarProps) {
  return (
    <SpacedToggleButtonGroup
      fullWidth
      sx={{ gap: '2em' }}
      exclusive
      value={value}
      onChange={(_, nextValue: string | null) => {
        if (nextValue) {
          onChange(nextValue);
        }
      }}
    >
        <ToggleButton value="all">
            {t('all')}
        </ToggleButton>
        {paymentGroups.map((group) => (
          <ToggleButton
            key={group.paymentGroupId}
            value={group.paymentGroupId}
            sx={getFilterButtonStyles(group.colorHex, value === group.paymentGroupId)}
          >
              {group.name}
          </ToggleButton>
        ))}
    </SpacedToggleButtonGroup>
  );
}

