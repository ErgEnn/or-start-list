import ClearIcon from '@mui/icons-material/Clear';
import { IconButton, InputAdornment, TextField } from '@mui/material';
import { t } from '../i18n';

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
};

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <TextField
      variant="outlined"
      placeholder={t('search')}
      fullWidth
      value={value}
      onChange={(event) => onChange(event.target.value)}
      slotProps={{
        input: {
          endAdornment: value ? (
            <InputAdornment position="end">
              <IconButton
                aria-label={t('clear_search')}
                edge="end"
                onClick={() => onChange('')}
              >
                <ClearIcon />
              </IconButton>
            </InputAdornment>
          ) : undefined,
        },
      }}
    />
  );
}

