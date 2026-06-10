import { ToggleButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { SpacedToggleButtonGroup } from './SpacedToggleButtonGroup';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSŠZŽTUVWÕÄÖÜXY'.split('');

type QuickJumpBarProps = {
  availableLetters: Set<string>;
  subPrefixesForSelected: string[];
  selectedPrefix: string | null;
  onJump: (prefix: string | null) => void;
};

const buttonSx = {
  flex: 1,
  minHeight: 0,
  padding: 0,
  fontWeight: 'bold',
  fontSize: '1.25em',
  textTransform: 'none',
} as const;

const closeButtonSx = {
  flex: '0 0 auto',
  height: '2.25rem',
  minHeight: 0,
  padding: 0,
  marginBottom: '0.25em',
  border: '2px solid',
  borderColor: 'error.main',
  color: 'error.main',
  borderRadius: '50%',
  '&:hover': {
    backgroundColor: 'error.main',
    color: 'common.white',
  },
} as const;

const groupSx = {
  gap: '0.25em',
  width: 'clamp(2.75rem, 4vw, 4rem)',
  height: '100%',
  flexShrink: 0,
} as const;

export function QuickJumpBar({ availableLetters, subPrefixesForSelected, selectedPrefix, onJump }: QuickJumpBarProps) {
  if (selectedPrefix === null) {
    return (
      <SpacedToggleButtonGroup
        fullWidth
        exclusive
        orientation='vertical'
        value={null}
        onChange={(_event, nextLetter: string | null) => {
          onJump(nextLetter);
        }}
        sx={groupSx}
      >
        {LETTERS.filter((letter) => availableLetters.has(letter)).map((letter) => (
          <ToggleButton key={letter} value={letter} sx={buttonSx}>
            {letter}
          </ToggleButton>
        ))}
      </SpacedToggleButtonGroup>
    );
  }

  const activeSub = selectedPrefix.length === 2 ? selectedPrefix : null;

  return (
    <SpacedToggleButtonGroup
      fullWidth
      exclusive
      orientation='vertical'
      value={activeSub}
      onChange={(_event, next: string | null) => {
        if (next === null && selectedPrefix.length === 2) {
          onJump(selectedPrefix.charAt(0));
        } else {
          onJump(next);
        }
      }}
      sx={groupSx}
    >
      <ToggleButton
        key='__close'
        value='__close'
        aria-label='Close'
        onClick={(event) => {
          event.preventDefault();
          onJump(null);
        }}
        sx={closeButtonSx}
      >
        <CloseIcon fontSize='small' />
      </ToggleButton>
      {subPrefixesForSelected.map((prefix) => (
        <ToggleButton key={prefix} value={prefix} sx={buttonSx}>
          {prefix.charAt(0) + prefix.slice(1).toLocaleLowerCase()}
        </ToggleButton>
      ))}
    </SpacedToggleButtonGroup>
  );
}
