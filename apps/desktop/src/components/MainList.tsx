import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Paper } from '@mui/material';
import type { CompetitionGroup, Course, DesktopCompetitorRow, MapPreferenceMember, PaymentGroup, SelectedRegistrationInfo } from '@or/shared';
import { t } from '../i18n';
import { CompetitorDetailDialog } from './CompetitorDetailDialog';

type MainListProps = {
  rows: DesktopCompetitorRow[];
  paymentGroups: PaymentGroup[];
  mapPreferences: MapPreferenceMember[];
  competitionGroups: CompetitionGroup[];
  selectedFilter: string;
  showDobColumn: boolean;
  loading: boolean;
  scrollTarget: { competitorId: string; token: number } | null;
  highlightedCompetitorId: string | null;
  highlightedLetter: string | null;
  courses: Course[];
  textScale: number;
  selectedCoursesByCompetitor: Record<string, string>;
  selectedRegistrationsByCompetitor: Record<string, SelectedRegistrationInfo>;
  submittingCompetitorIds: Set<string>;
  onSelectCompetitionGroup: (competitorId: string, competitionGroupName: string) => Promise<void>;
  onSelectCourse: (competitorId: string, courseId: string | null, paidPriceCents?: number, paymentMethod?: "cash" | "prepaid" | "stebby" | "debt" | "other") => Promise<void>;
  onUpdateRegistrationPayment: (competitorId: string, paidPriceCents: number, paymentMethod: "cash" | "prepaid" | "stebby" | "debt" | "other") => Promise<void>;
  openCompetitorId: { competitorId: string; token: number } | null;
};

const cellPadding = '6px 16px';
const colCode: React.CSSProperties = { flex: '0 0 15%', padding: cellPadding };
const colName: React.CSSProperties = { flex: '1 1 0', padding: cellPadding };


export const MainList = memo(function MainList({
  rows,
  paymentGroups,
  mapPreferences,
  competitionGroups,
  selectedFilter,
  showDobColumn,
  loading,
  scrollTarget,
  highlightedCompetitorId,
  highlightedLetter,
  courses,
  textScale,
  selectedCoursesByCompetitor,
  selectedRegistrationsByCompetitor,
  submittingCompetitorIds,
  onSelectCompetitionGroup,
  onSelectCourse,
  onUpdateRegistrationPayment,
  openCompetitorId,
}: MainListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string | null>(null);

  const colorByCompetitorId = useMemo(() => {
    const next = new Map<string, string>();
    for (const group of paymentGroups) {
      if (!group.colorHex) continue;
      for (const competitorId of group.competitorIds) {
        if (!next.has(competitorId)) {
          next.set(competitorId, group.colorHex);
        }
      }
    }
    return next;
  }, [paymentGroups]);

  const courseNameById = useMemo(
    () => new Map(courses.map((course) => [course.courseId, course.name])),
    [courses],
  );

  const mapPreferenceByCompetitorId = useMemo(
    () => new Map(mapPreferences.map((pref) => [pref.competitorId, pref])),
    [mapPreferences],
  );

  useEffect(() => {
    if (!scrollTarget?.competitorId) return;
    const el = rowRefs.current.get(scrollTarget.competitorId);
    el?.scrollIntoView({ block: 'center' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTarget?.token]);

  useEffect(() => {
    if (openCompetitorId?.competitorId) {
      setSelectedCompetitorId(openCompetitorId.competitorId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCompetitorId?.token]);

  const selectedCompetitor = useMemo(
    () => rows.find((row) => row.competitorId === selectedCompetitorId) ?? null,
    [rows, selectedCompetitorId],
  );

  const setRowRef = useCallback((competitorId: string, el: HTMLDivElement | null) => {
    if (el) {
      rowRefs.current.set(competitorId, el);
    } else {
      rowRefs.current.delete(competitorId);
    }
  }, []);

  const fontSize = `${textScale}rem`;

  return (
    <>
      <Paper style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Header — outside scroll container */}
        <div style={{ display: 'flex', borderBottom: '2px solid #e0e0e0', fontSize, fontWeight: 500, flexShrink: 0 }}>
          <div style={colCode}>{t('eol_code')}</div>
          <div style={colName}>{t('first_name')}</div>
          <div style={colName}>{t('last_name')}</div>
          {showDobColumn ? <div style={colName}>{t('dob')}</div> : null}
        </div>

        {/* Scrollable body */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {loading && rows.length === 0 ? (
            <div style={{ padding: cellPadding, textAlign: 'center', fontSize }}>{t('loading_competitors')}</div>
          ) : null}

          {rows.map((item) => {
            const rowColor = selectedFilter === 'all' ? colorByCompetitorId.get(item.competitorId) ?? null : null;
            const hasSelectedCourse = Boolean(selectedCoursesByCompetitor[item.competitorId]);
            const isFocused = highlightedCompetitorId === item.competitorId;
            const isLetterHighlighted =
              highlightedLetter !== null &&
              item.lastName.trim().charAt(0).toLocaleUpperCase() === highlightedLetter;

            const bgColor = isFocused
              ? '#fff3e0'
              : rowColor
                ? lightenHex(rowColor, hasSelectedCourse ? 0.3 : 0.12)
                : undefined;
            const textColor = rowColor && !isFocused
              ? getContrastingTextColor(bgColor!)
              : hasSelectedCourse ? '#ddd' : undefined;

            return (
              <div
                key={item.competitorId}
                ref={(el) => setRowRef(item.competitorId, el)}
                className="competitor-row"
                onClick={() => setSelectedCompetitorId(item.competitorId)}
                style={{
                  display: 'flex',
                  cursor: 'pointer',
                  borderBottom: '1px solid #eee',
                  backgroundColor: bgColor,
                  color: textColor,
                  fontSize,
                }}
              >
                <div style={colCode}>{item.eolNumber}</div>
                <div style={colName}>{item.firstName}</div>
                <div style={colName}>
                  {isLetterHighlighted && item.lastName.length > 0 ? (
                    <><span style={{ backgroundColor: '#FFD600', borderRadius: 2 }}>{item.lastName.charAt(0)}</span>{item.lastName.slice(1)}</>
                  ) : (
                    item.lastName
                  )}
                </div>
                {showDobColumn ? <div style={colName}>{item.dob ?? '—'}</div> : null}
              </div>
            );
          })}

          {!loading && rows.length === 0 ? (
            <div style={{ padding: cellPadding, textAlign: 'center', fontSize }}>{t('no_competitors_found')}</div>
          ) : null}
        </div>
      </Paper>

      {selectedCompetitor ? (
        <CompetitorDetailDialog
          competitor={selectedCompetitor}
          allCompetitionGroups={competitionGroups}
          courses={courses}
          courseNameById={courseNameById}
          mapPreference={mapPreferenceByCompetitorId.get(selectedCompetitor.competitorId) ?? null}
          textScale={textScale}
          selectedCourseId={selectedCoursesByCompetitor[selectedCompetitor.competitorId] ?? null}
          selectedRegistration={selectedRegistrationsByCompetitor[selectedCompetitor.competitorId] ?? null}
          submitting={submittingCompetitorIds.has(selectedCompetitor.competitorId)}
          onSelectCompetitionGroup={onSelectCompetitionGroup}
          onSelectCourse={onSelectCourse}
          onUpdateRegistrationPayment={onUpdateRegistrationPayment}
          onClose={() => setSelectedCompetitorId(null)}
        />
      ) : null}
    </>
  );
});

function lightenHex(colorHex: string, amount: number) {
  const normalized = colorHex.replace('#', '');
  if (normalized.length !== 6) {
    return colorHex;
  }

  const channels = normalized.match(/.{2}/g);
  if (!channels) {
    return colorHex;
  }

  const next = channels.map((channel) => {
    const value = Number.parseInt(channel, 16);
    const lightened = Math.round(value + (255 - value) * amount);
    return Math.max(0, Math.min(255, lightened)).toString(16).padStart(2, '0');
  });

  return `#${next.join('')}`;
}

function getContrastingTextColor(colorHex: string) {
  const normalized = colorHex.replace('#', '');
  if (normalized.length !== 6) {
    return '#111';
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  const brightness = (red * 299 + green * 587 + blue * 114) / 1000;
  return brightness > 160 ? '#111' : '#fff';
}
