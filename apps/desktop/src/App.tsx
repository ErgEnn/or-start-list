import { Box } from '@mui/material';
import { MainList } from './components/MainList';
import { Row } from './components/Row';
import { QuickJumpBar } from './components/QuickJumpBar';
import { SearchBar } from './components/SearchBar';
import { Column } from './components/Column';
import { FilterBar } from './components/FilterBar';
import { SettingsButton } from './components/SettingsButton';
import { RecentsList } from './components/RecentsList';
import { StatusBar } from './components/StatusBar';

export function App() {
  

  return (
    <Box sx={{
      height: '100vh',
      width: '100vw',
      padding: '1vh 1vw',
      boxSizing: 'border-box',
      overflow: 'clip'
    }}>
    <Column>
      <Row>
        <SettingsButton />
        <SearchBar />
      </Row>
      <FilterBar />
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0, gap: '1em' }}>
        <QuickJumpBar />
        <Box sx={{ flex: 1, minWidth: 0, minHeight: 0 }}>
          <MainList />
        </Box>
      </Box>
      <RecentsList />
      <StatusBar />
    </Column>
    </Box>
  );
}
