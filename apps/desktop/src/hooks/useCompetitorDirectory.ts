import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import type {
  CompetitionGroup,
  Course,
  DesktopRecentRegistration,
  DesktopSyncStatus,
  Event,
  PaymentGroup,
  PaymentMethod,
  SelectedRegistrationInfo,
} from "@or/shared";
import {
  desktopBootstrap,
  desktopClearRegistration,
  desktopCreateRegistration,
  desktopQueryCompetitors,
  desktopSetCompetitionGroup,
  desktopSelectEvent,
  desktopUpdateRegistrationPayment,
  onDesktopSyncStatus,
} from "../lib/desktop";
import type { DesktopCompetitorRow } from "@or/shared";
import { t } from "../i18n";

const ALL_FILTER_ID = "all";

type UseCompetitorDirectoryResult = {
  rows: DesktopCompetitorRow[];
  groupedCount: number;
  indexedCount: number;
  paymentGroups: PaymentGroup[];
  competitionGroups: CompetitionGroup[];
  selectedFilter: string;
  setSelectedFilter: (filterId: string) => void;
  searchInput: string;
  setSearchInput: (value: string) => void;
  loading: boolean;
  eventLoading: boolean;
  error: string;
  lastUpdatedAt: Date | null;
  syncStatus: DesktopSyncStatus;
  events: Event[];
  selectedEventId: string;
  setSelectedEventId: (eventId: string) => void;
  courses: Course[];
  recentRegistrations: DesktopRecentRegistration[];
  selectedCoursesByCompetitor: Record<string, string>;
  selectedRegistrationsByCompetitor: Record<string, SelectedRegistrationInfo>;
  submittingCompetitorIds: Set<string>;
  selectCompetitionGroupForCompetitor: (competitorId: string, competitionGroupName: string) => Promise<void>;
  selectCourseForCompetitor: (competitorId: string, courseId: string | null, paidPriceCents?: number, paymentMethod?: PaymentMethod) => Promise<void>;
  updateRegistrationPayment: (competitorId: string, paidPriceCents: number, paymentMethod: PaymentMethod) => Promise<void>;
};

const EMPTY_SYNC_STATUS: DesktopSyncStatus = {
  status: "idle",
  lastSuccessfulSyncAt: null,
  lastError: null,
  pendingRegistrations: 0,
};

export function useCompetitorDirectory(deviceConfigRevision = 0): UseCompetitorDirectoryResult {
  const [rows, setRows] = useState<DesktopCompetitorRow[]>([]);
  const [groupedCount, setGroupedCount] = useState(0);
  const [indexedCount, setIndexedCount] = useState(0);
  const [paymentGroups, setPaymentGroups] = useState<PaymentGroup[]>([]);
  const [competitionGroups, setCompetitionGroups] = useState<CompetitionGroup[]>([]);
  const [selectedFilter, setSelectedFilter] = useState(ALL_FILTER_ID);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [eventLoading, setEventLoading] = useState(false);
  const [error, setError] = useState("");
  const [syncStatus, setSyncStatus] = useState<DesktopSyncStatus>(EMPTY_SYNC_STATUS);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventIdState] = useState("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [recentRegistrations, setRecentRegistrations] = useState<DesktopRecentRegistration[]>([]);
  const [selectedCoursesByCompetitor, setSelectedCoursesByCompetitor] = useState<Record<string, string>>({});
  const [selectedRegistrationsByCompetitor, setSelectedRegistrationsByCompetitor] = useState<Record<string, SelectedRegistrationInfo>>({});
  const [submittingCompetitorIds, setSubmittingCompetitorIds] = useState<Set<string>>(new Set());
  const [lastHydratedSyncAt, setLastHydratedSyncAt] = useState<string | null>(null);
  const latestFilterRef = useRef(selectedFilter);
  const latestSearchQueryRef = useRef(searchQuery);
  const latestSelectedEventIdRef = useRef(selectedEventId);
  const latestSubmittingCompetitorIdsRef = useRef(submittingCompetitorIds);
  const latestRowsRef = useRef(rows);
  const latestSelectedCoursesByCompetitorRef = useRef(selectedCoursesByCompetitor);
  const latestCourseSelectionRequestIdsRef = useRef(new Map<string, number>());
  const nextCourseSelectionRequestIdRef = useRef(0);

  const refreshQuery = useCallback(async (filterId: string, query: string) => {
    const result = await desktopQueryCompetitors({ filterId, query });
    startTransition(() => {
      setRows(result.rows);
      setGroupedCount(result.groupedCount);
      setIndexedCount(result.indexedCount);
    });
    return result;
  }, []);

  const applyEventState = useCallback((eventState: {
    selectedEventId: string;
    courses: Course[];
    recentRegistrations: DesktopRecentRegistration[];
    selectedCoursesByCompetitor: Record<string, string>;
    selectedRegistrationsByCompetitor: Record<string, SelectedRegistrationInfo>;
  }) => {
    startTransition(() => {
      setSelectedEventIdState(eventState.selectedEventId);
      setCourses(eventState.courses);
      setRecentRegistrations(eventState.recentRegistrations);
      setSelectedCoursesByCompetitor(eventState.selectedCoursesByCompetitor);
      setSelectedRegistrationsByCompetitor(eventState.selectedRegistrationsByCompetitor);
    });
  }, []);

  const scheduleRefreshQuery = useCallback((filterId: string, query: string) => {
    void refreshQuery(filterId, query).catch((cause) => {
      setError(cause instanceof Error ? cause.message : t('failed_query_competitors'));
    });
  }, [refreshQuery]);

  const setSelectedEventId = useCallback((eventId: string) => {
    setSelectedEventIdState(eventId);
  }, []);

  const selectCompetitionGroupForCompetitor = useCallback(async (competitorId: string, competitionGroupName: string) => {
    const currentEventId = latestSelectedEventIdRef.current;
    if (!currentEventId) {
      return;
    }

    setSubmittingCompetitorIds((current) => new Set(current).add(competitorId));
    setError("");

    try {
      await desktopSetCompetitionGroup({
        eventId: currentEventId,
        competitorId,
        competitionGroupName,
      });
      await refreshQuery(latestFilterRef.current, latestSearchQueryRef.current);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('failed_save_competition_group_selection'));
    } finally {
      setSubmittingCompetitorIds((current) => {
        const next = new Set(current);
        next.delete(competitorId);
        return next;
      });
    }
  }, [refreshQuery]);

  const selectCourseForCompetitor = useCallback(async (competitorId: string, courseId: string | null, paidPriceCents?: number, paymentMethod?: PaymentMethod) => {
    const currentEventId = latestSelectedEventIdRef.current;
    if (!currentEventId) {
      return;
    }

    const previousCourseId = latestSelectedCoursesByCompetitorRef.current[competitorId];
    if (previousCourseId === courseId) {
      return;
    }

    setSelectedCoursesByCompetitor((current) => {
      const next = { ...current };
      if (courseId) {
        next[competitorId] = courseId;
      } else {
        delete next[competitorId];
      }
      return next;
    });
    setSubmittingCompetitorIds((current) => new Set(current).add(competitorId));
    setError("");
    const requestId = nextCourseSelectionRequestIdRef.current + 1;
    nextCourseSelectionRequestIdRef.current = requestId;
    latestCourseSelectionRequestIdsRef.current.set(competitorId, requestId);

    try {
      const selectedCompetitionGroupName = latestRowsRef.current.find((row) => row.competitorId === competitorId)?.selectedCompetitionGroupName;
      const response = courseId
        ? await desktopCreateRegistration({
            eventId: currentEventId,
            competitorId,
            courseId,
            competitionGroupName: selectedCompetitionGroupName ?? "",
            paidPriceCents: paidPriceCents ?? 0,
            paymentMethod: paymentMethod ?? "cash",
          })
        : await desktopClearRegistration({
            eventId: currentEventId,
            competitorId,
          });

      if (latestCourseSelectionRequestIdsRef.current.get(competitorId) !== requestId) {
        return;
      }

      if (latestSelectedEventIdRef.current === response.selectedEventId) {
        startTransition(() => {
          setCourses(response.courses);
          setRecentRegistrations(response.recentRegistrations);
          setSelectedRegistrationsByCompetitor(response.selectedRegistrationsByCompetitor);
          setSelectedCoursesByCompetitor((current) => {
            const nextSelections = { ...response.selectedCoursesByCompetitor };
            for (const pendingCompetitorId of latestSubmittingCompetitorIdsRef.current) {
              const pendingCourseId = current[pendingCompetitorId];
              if (pendingCourseId) {
                nextSelections[pendingCompetitorId] = pendingCourseId;
              }
            }
            return nextSelections;
          });
        });
      }

      scheduleRefreshQuery(latestFilterRef.current, latestSearchQueryRef.current);
    } catch (cause) {
      if (latestCourseSelectionRequestIdsRef.current.get(competitorId) !== requestId) {
        return;
      }

      setSelectedCoursesByCompetitor((current) => {
        const next = { ...current };
        if (previousCourseId) {
          next[competitorId] = previousCourseId;
        } else {
          delete next[competitorId];
        }
        return next;
      });
      setError(cause instanceof Error ? cause.message : t('failed_save_course_selection'));
    } finally {
      if (latestCourseSelectionRequestIdsRef.current.get(competitorId) === requestId) {
        latestCourseSelectionRequestIdsRef.current.delete(competitorId);
      }
      setSubmittingCompetitorIds((current) => {
        const next = new Set(current);
        next.delete(competitorId);
        return next;
      });
    }
  }, [scheduleRefreshQuery]);

  const updateRegistrationPayment = useCallback(async (competitorId: string, paidPriceCents: number, paymentMethod: PaymentMethod) => {
    const currentEventId = latestSelectedEventIdRef.current;
    if (!currentEventId) {
      return;
    }

    setSubmittingCompetitorIds((current) => new Set(current).add(competitorId));
    setError("");

    try {
      const response = await desktopUpdateRegistrationPayment({
        eventId: currentEventId,
        competitorId,
        paidPriceCents,
        paymentMethod,
      });

      if (latestSelectedEventIdRef.current === response.selectedEventId) {
        startTransition(() => {
          setCourses(response.courses);
          setRecentRegistrations(response.recentRegistrations);
          setSelectedCoursesByCompetitor(response.selectedCoursesByCompetitor);
          setSelectedRegistrationsByCompetitor(response.selectedRegistrationsByCompetitor);
        });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('failed_save_course_selection'));
    } finally {
      setSubmittingCompetitorIds((current) => {
        const next = new Set(current);
        next.delete(competitorId);
        return next;
      });
    }
  }, []);

  useEffect(() => {
    latestFilterRef.current = selectedFilter;
  }, [selectedFilter]);

  useEffect(() => {
    latestSearchQueryRef.current = searchQuery;
  }, [searchQuery]);

  useEffect(() => {
    latestSelectedEventIdRef.current = selectedEventId;
  }, [selectedEventId]);

  useEffect(() => {
    latestSubmittingCompetitorIdsRef.current = submittingCompetitorIds;
  }, [submittingCompetitorIds]);

  useEffect(() => {
    latestRowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    latestSelectedCoursesByCompetitorRef.current = selectedCoursesByCompetitor;
  }, [selectedCoursesByCompetitor]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearchQuery(searchInput), 250);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    let unlisten: UnlistenFn | null = null;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const bootstrap = await desktopBootstrap();
        if (cancelled) {
          return;
        }

        setEvents(bootstrap.events);
        setPaymentGroups(bootstrap.paymentGroups);
        setCompetitionGroups(bootstrap.competitionGroups);
        setSyncStatus(bootstrap.syncStatus);
        applyEventState(bootstrap.eventState);
        await refreshQuery(latestFilterRef.current, latestSearchQueryRef.current);
        setLastHydratedSyncAt(bootstrap.syncStatus.lastSuccessfulSyncAt);
        unlisten = await onDesktopSyncStatus((status) => {
          setSyncStatus(status);
        });
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : t('failed_load_desktop_data'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      void unlisten?.();
    };
  }, [applyEventState, deviceConfigRevision, refreshQuery]);

  useEffect(() => {
    if (!syncStatus.lastSuccessfulSyncAt || syncStatus.lastSuccessfulSyncAt === lastHydratedSyncAt) {
      return;
    }

    let cancelled = false;
    void desktopBootstrap()
      .then(async (bootstrap) => {
        if (cancelled) {
          return;
        }

        setEvents(bootstrap.events);
        setPaymentGroups(bootstrap.paymentGroups);
        setCompetitionGroups(bootstrap.competitionGroups);
        applyEventState(bootstrap.eventState);
        await refreshQuery(latestFilterRef.current, latestSearchQueryRef.current);
        setLastHydratedSyncAt(bootstrap.syncStatus.lastSuccessfulSyncAt);
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : t('failed_refresh_local_data_after_sync'));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applyEventState, lastHydratedSyncAt, refreshQuery, syncStatus.lastSuccessfulSyncAt]);

  useEffect(() => {
    if (loading) {
      return;
    }

    let cancelled = false;
    setError("");

    void refreshQuery(selectedFilter, searchQuery)
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : t('failed_query_competitors'));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loading, refreshQuery, searchQuery, selectedFilter]);

  useEffect(() => {
    if (selectedFilter === ALL_FILTER_ID) {
      return;
    }

    const exists = paymentGroups.some((group) => group.paymentGroupId === selectedFilter);
    if (!exists) {
      setSelectedFilter(ALL_FILTER_ID);
    }
  }, [paymentGroups, selectedFilter]);

  useEffect(() => {
    if (!selectedEventId || loading) {
      return;
    }

    let cancelled = false;
    setEventLoading(true);
    setError("");

    void desktopSelectEvent(selectedEventId)
      .then((eventState) => {
        if (!cancelled) {
          applyEventState(eventState);
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : t('failed_load_event_data'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setEventLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applyEventState, loading, selectedEventId]);

  return {
    rows,
    groupedCount,
    indexedCount,
    paymentGroups,
    competitionGroups,
    selectedFilter,
    setSelectedFilter,
    searchInput,
    setSearchInput,
    loading,
    eventLoading,
    error,
    lastUpdatedAt: syncStatus.lastSuccessfulSyncAt ? new Date(syncStatus.lastSuccessfulSyncAt) : null,
    syncStatus,
    events,
    selectedEventId,
    setSelectedEventId,
    courses,
    recentRegistrations,
    selectedCoursesByCompetitor,
    selectedRegistrationsByCompetitor,
    submittingCompetitorIds,
    selectCompetitionGroupForCompetitor,
    selectCourseForCompetitor,
    updateRegistrationPayment,
  };
}

type UnlistenFn = () => void;
