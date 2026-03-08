import { Box } from '@mui/material';

export function Row({children, gap, color}: {children: React.ReactNode, gap?: string, color?: string}) {
  

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'row',
      gap: gap || '1em',
      backgroundColor: color || 'transparent'
  }}>
        {children}
    </Box>
  );
}

