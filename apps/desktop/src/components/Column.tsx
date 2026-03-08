import { Box } from '@mui/material';

export function Column({children, gap, color}: {children: React.ReactNode, gap?: string, color?: string}) {
  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      gap: gap || '1em',
      backgroundColor: color || 'transparent',
      height: '100%',
      minHeight: 0,
    }}>
        {children}
    </Box>
  );
}

