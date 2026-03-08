import { ToggleButton } from '@mui/material';
import { SpacedToggleButtonGroup } from './SpacedToggleButtonGroup';

export function QuickJumpBar() {
  const letters = 'ABCDEFGHIJKLMNOPQRSŠZŽTUVWÕÄÖÜXY'.split('');

  return (
    <SpacedToggleButtonGroup
      fullWidth
      exclusive
      orientation='vertical'
      sx={{
        gap: '0.25em',
        width: 'clamp(2.75rem, 4vw, 4rem)',
        height: '100%',
        flexShrink: 0,
      }}
    >
      {letters.map(letter => (
        <ToggleButton
          key={letter}
          value={letter}
          sx={{
            flex: 1,
            minHeight: 0,
            padding: 0,
            fontWeight: 'bold',
          }}
        >
          {letter}
        </ToggleButton>
      ))}
    </SpacedToggleButtonGroup>
  );
}

