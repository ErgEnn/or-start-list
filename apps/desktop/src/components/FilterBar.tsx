import { Box, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { SpacedToggleButtonGroup } from './SpacedToggleButtonGroup';
import { t } from '../i18n';

export function FilterBar() {
  

  return (
    <SpacedToggleButtonGroup fullWidth sx={{gap: '2em'}} exclusive value={'all'}>
        <ToggleButton value="all">
            {t('all')}
        </ToggleButton>
        <ToggleButton value="spordikool">
            Spordikool
        </ToggleButton>
        <ToggleButton value="Stebby">
            Stebby
        </ToggleButton>
    </SpacedToggleButtonGroup>
  );
}

