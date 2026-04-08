import { useCallback, useState } from 'react';
import { Box, Dialog, DialogContent, DialogTitle, IconButton, Tab, Tabs } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { invoke } from '@tauri-apps/api/core';
import type { InfoPage } from '@or/shared';
import { t } from '../i18n';

type InfoPagesDialogProps = {
  open: boolean;
  infoPages: InfoPage[];
  onClose: () => void;
};

export function InfoPagesDialog({ open, infoPages, onClose }: InfoPagesDialogProps) {
  const [activeTab, setActiveTab] = useState(0);

  const handleContentClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const anchor = (e.target as HTMLElement).closest('a');
    if (anchor?.href) {
      e.preventDefault();
      void invoke('open_external_url', { url: anchor.href });
    }
  }, []);

  return (
    <Dialog open={open} onClose={onClose} fullScreen>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 0 }}>
        {t('info_pages')}
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      {infoPages.length > 0 ? (
        <>
          <Tabs
            value={activeTab}
            onChange={(_, v: number) => setActiveTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
          >
            {infoPages.map((page, i) => (
              <Tab key={page.id} label={page.title} value={i} />
            ))}
          </Tabs>
          <DialogContent>
            {infoPages[activeTab] ? (
              <Box
                onClick={handleContentClick}
                sx={{
                  '--tt-color-highlight-yellow': '#fef9c3',
                  '--tt-color-highlight-green': '#dcfce7',
                  '--tt-color-highlight-blue': '#e0f2fe',
                  '--tt-color-highlight-purple': '#f3e8ff',
                  '--tt-color-highlight-red': '#ffe4e6',
                  '--tt-color-highlight-gray': '#f8f8f7',
                  '--tt-color-highlight-brown': '#f4eeee',
                  '--tt-color-highlight-orange': '#fbecdd',
                  '--tt-color-highlight-pink': '#fcf1f6',
                  '--tt-color-text-gray': 'hsl(45, 2%, 46%)',
                  '--tt-color-text-brown': 'hsl(19, 31%, 47%)',
                  '--tt-color-text-orange': 'hsl(30, 89%, 45%)',
                  '--tt-color-text-yellow': 'hsl(38, 62%, 49%)',
                  '--tt-color-text-green': 'hsl(148, 32%, 39%)',
                  '--tt-color-text-blue': 'hsl(202, 54%, 43%)',
                  '--tt-color-text-purple': 'hsl(274, 32%, 54%)',
                  '--tt-color-text-pink': 'hsl(328, 49%, 53%)',
                  '--tt-color-text-red': 'hsl(2, 62%, 55%)',
                  '& h1': { fontSize: '1.8rem', mt: 2, mb: 1 },
                  '& h2': { fontSize: '1.4rem', mt: 2, mb: 1 },
                  '& h3': { fontSize: '1.2rem', mt: 1.5, mb: 0.5 },
                  '& p': { mb: 1 },
                  '& ul, & ol': { pl: 3, mb: 1 },
                  '& li > p': { mb: 0 },
                  '& a': { color: 'primary.main' },
                  '& mark': { borderRadius: '0.25em', px: '0.25em', boxDecorationBreak: 'clone' },
                  '& blockquote': { borderLeft: '3px solid', borderColor: 'divider', pl: 2, color: 'text.secondary' },
                }}
                dangerouslySetInnerHTML={{ __html: infoPages[activeTab].content }}
              />
            ) : null}
          </DialogContent>
        </>
      ) : null}
    </Dialog>
  );
}
