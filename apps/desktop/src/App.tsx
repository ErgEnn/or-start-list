import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { SiReaderButton } from './components/SiReaderButton';
import { StatusBar } from './components/StatusBar';
import { InfoPagesDialog } from './components/InfoPagesDialog';
import { TitleBar } from './components/TitleBar';
import { EventSelectionDialog } from './components/EventSelectionDialog';
import { useCompetitorDirectory } from './hooks/useCompetitorDirectory';
import { DEFAULT_TEXT_SCALE, loadDeviceConfig, type DeviceConfig } from './lib/device-config';
import { getTodayLocalDate } from './lib/date';
import { useSiReaderStore } from './stores/siReaderStore';
import type { DesktopCreateRegistrationResponse } from '@or/shared';

function getJumpKey(lastName: string, length: 1 | 2): string | null {
  const trimmed = lastName.trim();
  if (trimmed.length < length) return null;
  return trimmed.slice(0, length).toLocaleUpperCase();
}

const ALL_FILTER_ID = 'all';
const RECENT_HIGHLIGHT_DURATION_MS = 2500;

export function App() {
  const [deviceConfigRevision, setDeviceConfigRevision] = useState(0);
  const [savedTextScale, setSavedTextScale] = useState(DEFAULT_TEXT_SCALE);
  const [textScale, setTextScale] = useState(DEFAULT_TEXT_SCALE);
  const [settingsConfigured, setSettingsConfigured] = useState(false);
  const [initialPromptDone, setInitialPromptDone] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const today = getTodayLocalDate();
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
    infoPages,
    mapPreferences,
    selectedCoursesByCompetitor,
    selectedRegistrationsByCompetitor,
    submittingCompetitorIds,
    selectCompetitionGroupForCompetitor,
    selectCourseForCompetitor,
    updateRegistrationPayment,
    addPaymentGroupMember,
  } = useCompetitorDirectory(deviceConfigRevision);
  const [infoPagesOpen, setInfoPagesOpen] = useState(false);
  const [selectedJumpPrefix, setSelectedJumpPrefix] = useState<string | null>(null);
  const [focusedCompetitor, setFocusedCompetitor] = useState<{ competitorId: string; token: number } | null>(null);
  const [openCompetitorId, setOpenCompetitorId] = useState<{ competitorId: string; token: number } | null>(null);
  const selectedEvent = useMemo(
    () => events.find((event) => event.eventId === selectedEventId) ?? null,
    [events, selectedEventId],
  );
  const isEventToday = selectedEvent !== null && selectedEvent.startDate === today;
  const showSearchDobColumn = searchInput.trim().length > 0;

  const { jumpTargets, subPrefixes } = useMemo(() => {
    const targets = new Map<string, string>();
    const sub = new Map<string, Set<string>>();

    for (const row of rows) {
      const first = getJumpKey(row.lastName, 1);
      if (!first) continue;
      if (!targets.has(first)) targets.set(first, row.competitorId);
      const two = getJumpKey(row.lastName, 2);
      if (two) {
        if (!targets.has(two)) targets.set(two, row.competitorId);
        if (!sub.has(first)) sub.set(first, new Set());
        sub.get(first)!.add(two);
      }
    }

    return { jumpTargets: targets, subPrefixes: sub };
  }, [rows]);

  useEffect(() => {
    let cancelled = false;

    void loadDeviceConfig()
      .then((config) => {
        if (!cancelled) {
          setSavedTextScale(config.textScale);
          setTextScale(config.textScale);
          setSettingsConfigured(Boolean(config.portalBaseUrl && config.apiKey));
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [deviceConfigRevision]);

  useEffect(() => {
    if (!initialPromptDone && settingsConfigured && !loading) {
      setEventDialogOpen(true);
      setInitialPromptDone(true);
    }
  }, [initialPromptDone, settingsConfigured, loading]);

  useEffect(() => {
    if (selectedJumpPrefix && !jumpTargets.has(selectedJumpPrefix)) {
      setSelectedJumpPrefix(null);
    }
  }, [jumpTargets, selectedJumpPrefix]);

  useEffect(() => {
    setSelectedJumpPrefix(null);
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

  const siConnected = useSiReaderStore((s) => s.connected);
  const siBufferedCard = useSiReaderStore((s) => s.bufferedCard);

  const [jumpScrollToken, setJumpScrollToken] = useState(0);
  const scrollTarget = useMemo(
    () =>
      focusedCompetitor ??
      (selectedJumpPrefix
        ? {
            competitorId: jumpTargets.get(selectedJumpPrefix) ?? '',
            token: jumpScrollToken,
          }
        : null),
    [focusedCompetitor, selectedJumpPrefix, jumpTargets, jumpScrollToken],
  );

  function handleRecentRegistrationClick(competitorId: string) {
    setSelectedFilter(ALL_FILTER_ID);
    setSelectedJumpPrefix(null);
    const token = Date.now();
    setFocusedCompetitor({ competitorId, token });
    setOpenCompetitorId({ competitorId, token });
  }

  function handleOpenCompetitorFromRegistrations(competitorId: string) {
    setSelectedFilter(ALL_FILTER_ID);
    setSelectedJumpPrefix(null);
    const token = Date.now();
    setFocusedCompetitor({ competitorId, token });
    setOpenCompetitorId({ competitorId, token });
  }

  function handleSettingsSaved(config: DeviceConfig) {
    setSavedTextScale(config.textScale);
    setTextScale(config.textScale);
    const nextConfigured = Boolean(config.portalBaseUrl && config.apiKey);
    if (nextConfigured && !settingsConfigured) {
      setEventDialogOpen(true);
      setInitialPromptDone(true);
    }
    setSettingsConfigured(nextConfigured);
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



  const handleCloseEventDialog = useCallback(() => {
    setEventDialogOpen(false);
  }, []);

  const handleSelectEvent = useCallback((eventId: string) => {
    setSelectedEventId(eventId);
    setEventDialogOpen(false);
  }, [setSelectedEventId]);

  const availableLetters = useMemo(() => {
    const set = new Set<string>();
    for (const key of jumpTargets.keys()) {
      if (key.length === 1) set.add(key);
    }
    return set;
  }, [jumpTargets]);

  const subPrefixesForSelected = useMemo(() => {
    if (!selectedJumpPrefix) return [];
    const first = selectedJumpPrefix.charAt(0);
    const set = subPrefixes.get(first);
    return set ? [...set].sort() : [];
  }, [selectedJumpPrefix, subPrefixes]);

  const handleJump = useCallback((prefix: string | null) => {
    setSelectedJumpPrefix(prefix);
    if (prefix) {
      setJumpScrollToken(Date.now());
    }
  }, []);

  return (
    <Box sx={{
      height: '100vh',
      width: '100vw',
      padding: '0 1vw 1vh',
      boxSizing: 'border-box',
      overflow: 'clip'
    }}>
    <Column>
      <TitleBar
        selectedEvent={selectedEvent}
        isEventToday={isEventToday}
        onClick={() => setEventDialogOpen(true)}
      />
      <EventSelectionDialog
        open={eventDialogOpen}
        events={events}
        selectedEventId={selectedEventId}
        today={today}
        loading={loading}
        requireSelection={!selectedEventId}
        onClose={handleCloseEventDialog}
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
        {siConnected ? (
          <SiReaderButton
            bufferedCard={siBufferedCard}
            onCardSelect={(card) => {
              setSearchInput(String(card));
              useSiReaderStore.getState().setBufferedCard(null);
            }}
          />
        ) : null}
      </Row>
      <FilterBar paymentGroups={paymentGroups} value={selectedFilter} onChange={setSelectedFilter} />
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0, gap: '1em' }}>
        <QuickJumpBar
          availableLetters={availableLetters}
          subPrefixesForSelected={subPrefixesForSelected}
          selectedPrefix={selectedJumpPrefix}
          onJump={handleJump}
        />
        <Box sx={{ flex: 1, minWidth: 0, minHeight: 0 }}>
          <MainList
            rows={rows}
            paymentGroups={paymentGroups}
            mapPreferences={mapPreferences}
            competitionGroups={competitionGroups}
            selectedFilter={selectedFilter}
            showDobColumn={showSearchDobColumn}
            loading={loading || eventLoading}
            scrollTarget={scrollTarget?.competitorId ? scrollTarget : null}
            highlightedCompetitorId={focusedCompetitor?.competitorId ?? null}
            highlightedPrefix={selectedJumpPrefix}
            courses={courses}
            textScale={textScale}
            selectedCoursesByCompetitor={selectedCoursesByCompetitor}
            selectedRegistrationsByCompetitor={selectedRegistrationsByCompetitor}
            submittingCompetitorIds={submittingCompetitorIds}
            onSelectCompetitionGroup={selectCompetitionGroupForCompetitor}
            onSelectCourse={selectCourseForCompetitor}
            onUpdateRegistrationPayment={updateRegistrationPayment}
            onAddPaymentGroupMember={addPaymentGroupMember}
            openCompetitorId={openCompetitorId}
            isEventToday={isEventToday}
          />
        </Box>
      </Box>
      <RecentsList
        registrations={recentRegistrations}
        loading={eventLoading}
        eventId={selectedEventId}
        onSelectRegistration={handleRecentRegistrationClick}
        onOpenCompetitor={handleOpenCompetitorFromRegistrations}
      />
      <StatusBar
        loading={loading || eventLoading}
        error={error}
        lastUpdatedAt={lastUpdatedAt}
        syncStatus={syncStatus}
        infoPageCount={infoPages.length}
        onInfoClick={() => setInfoPagesOpen(true)}
      />
      <InfoPagesDialog
        open={infoPagesOpen}
        infoPages={infoPages}
        onClose={() => setInfoPagesOpen(false)}
      />
    </Column>
    </Box>
  );
}
