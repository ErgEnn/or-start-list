import { Box } from '@mui/material';
import { Row } from './Row';

export function StatusBar() {
  

  return (
    <Box sx={{
        width: '100%',
        height: '1em',
  }}>
        <Row gap='0.5em'>
            <Box sx={{ fontSize: '0.9em', color: 'text.secondary' }}>
                3 items
            </Box>
            <Box sx={{ fontSize: '0.9em', color: 'text.secondary' }}>
                Last updated: 5 minutes ago
            </Box>
        </Row>
    </Box>
  );
}

