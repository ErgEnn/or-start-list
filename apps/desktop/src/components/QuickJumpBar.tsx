import { ToggleButton } from '@mui/material';
import { SpacedToggleButtonGroup } from './SpacedToggleButtonGroup';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSŠZŽTUVWÕÄÖÜXY'.split('');

type QuickJumpBarProps = {
  availableLetters: Set<string>;
  selectedLetter: string | null;
  onJump: (letter: string | null) => void;
};

export function QuickJumpBar({ availableLetters, selectedLetter, onJump }: QuickJumpBarProps) {

  return (
    <SpacedToggleButtonGroup
      fullWidth
      exclusive
      orientation='vertical'
      value={selectedLetter}
      onChange={(_event, nextLetter: string | null) => {
        onJump(nextLetter);
      }}
      sx={{
        gap: '0.25em',
        width: 'clamp(2.75rem, 4vw, 4rem)',
        height: '100%',
        flexShrink: 0,
      }}
    >
      {LETTERS.filter((letter) => availableLetters.has(letter)).map((letter) => (
        <ToggleButton
          key={letter}
          value={letter}
          sx={{
            flex: 1,
            minHeight: 0,
            padding: 0,
            fontWeight: 'bold',
            fontSize: '1.25em',
          }}
        >
          {letter}
        </ToggleButton>
      ))}
    </SpacedToggleButtonGroup>
  );
}
