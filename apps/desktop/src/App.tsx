import { useEffect, useMemo, useState } from 'react';
import { Box } from '@mui/material';
import { MainList } from './components/MainList';
import { Row } from './components/Row';
import { QuickJumpBar } from './components/QuickJumpBar';
import { SearchBar } from './components/SearchBar';
import { Column } from './components/Column';
import { FilterBar } from './components/FilterBar';
import { SettingsButton } from './components/SettingsButton';
import { AddCompetitorButton } from './components/AddCompetitorButton';
import { RecentsList } from './components/RecentsList';
import { StatusBar } from './components/StatusBar';
import { TitleBar } from './components/TitleBar';
import { EventSelectionDialog } from './components/EventSelectionDialog';
import { useCompetitorDirectory } from './hooks/useCompetitorDirectory';
import { DEFAULT_TEXT_SCALE, loadDeviceConfig, type DeviceConfig } from './lib/device-config';
import type { DesktopCreateRegistrationResponse } from '@or/shared';

function getJumpLetter(lastName: string) {
  return lastName.trim().charAt(0).toLocaleUpperCase();
}

const ALL_FILTER_ID = 'all';
const RECENT_HIGHLIGHT_DURATION_MS = 2500;

export function App() {
  const [deviceConfigRevision, setDeviceConfigRevision] = useState(0);
  const [savedTextScale, setSavedTextScale] = useState(DEFAULT_TEXT_SCALE);
  const [textScale, setTextScale] = useState(DEFAULT_TEXT_SCALE);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [initialEventPromptHandled, setInitialEventPromptHandled] = useState(false);
  const {
    rows,
    groupedCount,
    indexedCount,
    recentRegistrations,
    paymentGroups,
    selectedFilter,
    setSelectedFilter,
    searchInput,
    setSearchInput,
    loading,
    eventLoading,
    error,
    lastUpdatedAt,
    syncStatus,
    events,
    selectedEventId,
    setSelectedEventId,
    courses,
    competitionGroups,
    selectedCoursesByCompetitor,
    submittingCompetitorIds,
    selectCompetitionGroupForCompetitor,
    selectCourseForCompetitor,
  } = useCompetitorDirectory(deviceConfigRevision);
  const [selectedJumpLetter, setSelectedJumpLetter] = useState<string | null>(null);
  const [focusedCompetitor, setFocusedCompetitor] = useState<{ competitorId: string; token: number } | null>(null);
  const selectedEvent = useMemo(
    () => events.find((event) => event.eventId === selectedEventId) ?? null,
    [events, selectedEventId],
  );
  const showSearchDobColumn = searchInput.trim().length > 0;

  const jumpTargets = useMemo(() => {
    const targets = new Map<string, string>();

    for (const row of rows) {
      const letter = getJumpLetter(row.lastName);
      if (letter && !targets.has(letter)) {
        targets.set(letter, row.competitorId);
      }
    }

    return targets;
  }, [rows]);

  useEffect(() => {
    let cancelled = false;

    void loadDeviceConfig()
      .then((config) => {
        if (!cancelled) {
          setSavedTextScale(config.textScale);
          setTextScale(config.textScale);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [deviceConfigRevision]);

  useEffect(() => {
    if (selectedJumpLetter && !jumpTargets.has(selectedJumpLetter)) {
      setSelectedJumpLetter(null);
    }
  }, [jumpTargets, selectedJumpLetter]);

  useEffect(() => {
    setSelectedJumpLetter(null);
  }, [selectedFilter]);

  useEffect(() => {
    if (!focusedCompetitor) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setFocusedCompetitor((current) =>
        current?.token === focusedCompetitor.token ? null : current,
      );
    }, RECENT_HIGHLIGHT_DURATION_MS);

    return () => window.clearTimeout(timeout);
  }, [focusedCompetitor]);

  useEffect(() => {
    if (loading || initialEventPromptHandled) {
      return;
    }

    if (events.length > 0) {
      setEventDialogOpen(true);
    }
    setInitialEventPromptHandled(true);
  }, [initialEventPromptHandled, loading, events.length]);

  const [jumpScrollToken, setJumpScrollToken] = useState(0);
  const scrollTarget =
    focusedCompetitor ??
    (selectedJumpLetter
      ? {
          competitorId: jumpTargets.get(selectedJumpLetter) ?? '',
          token: jumpScrollToken,
        }
      : null);

  function handleRecentRegistrationClick(competitorId: string) {
    setSelectedFilter(ALL_FILTER_ID);
    setSelectedJumpLetter(null);
    setFocusedCompetitor({
      competitorId,
      token: Date.now(),
    });
  }

  function handleSettingsSaved(config: DeviceConfig) {
    setSavedTextScale(config.textScale);
    setTextScale(config.textScale);
    setDeviceConfigRevision((current) => current + 1);
  }

  function handleTextScalePreview(nextTextScale: number) {
    setTextScale(nextTextScale);
  }

  function handleSettingsCancel() {
    setTextScale(savedTextScale);
  }

  function handleCompetitorClaimed(_response: DesktopCreateRegistrationResponse) {
    setDeviceConfigRevision((current) => current + 1);
  }

  function handleSelectEvent(eventId: string) {
    setSelectedEventId(eventId);
    setEventDialogOpen(false);
  }

  return (
    <Box sx={{
      height: '100vh',
      width: '100vw',
      padding: '0 1vw 1vh',
      boxSizing: 'border-box',
      overflow: 'clip'
    }}>
    <Column>
      <TitleBar selectedEvent={selectedEvent} onClick={() => setEventDialogOpen(true)} />
      <EventSelectionDialog
        open={eventDialogOpen}
        events={events}
        selectedEventId={selectedEventId}
        loading={loading}
        requireSelection={!selectedEventId}
        onClose={() => setEventDialogOpen(false)}
        onSelectEvent={handleSelectEvent}
      />
      <Row>
        <SettingsButton
          onSaved={handleSettingsSaved}
          onTextScalePreview={handleTextScalePreview}
          onCancel={handleSettingsCancel}
        />
        <AddCompetitorButton
          courses={courses}
          competitionGroups={competitionGroups}
          selectedEventId={selectedEventId}
          onClaimed={handleCompetitorClaimed}
        />
        <SearchBar value={searchInput} onChange={setSearchInput} />
      </Row>
      <FilterBar paymentGroups={paymentGroups} value={selectedFilter} onChange={setSelectedFilter} />
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0, gap: '1em' }}>
        <QuickJumpBar
          availableLetters={new Set(jumpTargets.keys())}
          selectedLetter={selectedJumpLetter}
          onJump={(letter) => {
            setSelectedJumpLetter(letter);
            setJumpScrollToken(Date.now());
          }}
        />
        <Box sx={{ flex: 1, minWidth: 0, minHeight: 0 }}>
          <MainList
            rows={rows}
            paymentGroups={paymentGroups}
            competitionGroups={competitionGroups}
            selectedFilter={selectedFilter}
            showDobColumn={showSearchDobColumn}
            loading={loading || eventLoading}
            scrollTarget={scrollTarget?.competitorId ? scrollTarget : null}
            highlightedCompetitorId={focusedCompetitor?.competitorId ?? null}
            highlightedLetter={selectedJumpLetter}
            courses={courses}
            textScale={textScale}
            selectedCoursesByCompetitor={selectedCoursesByCompetitor}
            submittingCompetitorIds={submittingCompetitorIds}
            onSelectCompetitionGroup={selectCompetitionGroupForCompetitor}
            onSelectCourse={selectCourseForCompetitor}
          />
        </Box>
      </Box>
      <RecentsList
        registrations={recentRegistrations}
        loading={eventLoading}
        onSelectRegistration={handleRecentRegistrationClick}
      />
      <StatusBar
        loading={loading || eventLoading}
        error={error}
        lastUpdatedAt={lastUpdatedAt}
        syncStatus={syncStatus}
      />
    </Column>
    </Box>
  );
}
