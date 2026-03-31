import { forwardRef, memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import type { CompetitionGroup, Course, DesktopCompetitorRow, PaymentGroup, SelectedRegistrationInfo } from '@or/shared';
import { t } from '../i18n';
import { CompetitorDetailDialog } from './CompetitorDetailDialog';

type MainListProps = {
  rows: DesktopCompetitorRow[];
  paymentGroups: PaymentGroup[];
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
};

export const MainList = memo(function MainList({
  rows,
  paymentGroups,
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
}: MainListProps) {
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string | null>(null);
  const colorByCompetitorId = useMemo(() => {
    const next = new Map<string, string>();

    for (const group of paymentGroups) {
      if (!group.colorHex) {
        continue;
      }
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

  useEffect(() => {
    if (!scrollTarget?.competitorId) {
      return;
    }

    const row = rowRefs.current.get(scrollTarget.competitorId);
    row?.scrollIntoView({ block: 'center' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTarget?.token]);

  const selectedCompetitor = useMemo(
    () => rows.find((row) => row.competitorId === selectedCompetitorId) ?? null,
    [rows, selectedCompetitorId],
  );

  return (
    <>
      <TableContainer
        component={Paper}
        sx={{ height: '100%', minHeight: 0, overflowY: 'auto' }}
      >
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>{t('eol_code')}</TableCell>
              <TableCell>{t('first_name')}</TableCell>
              <TableCell>{t('last_name')}</TableCell>
              {showDobColumn ? <TableCell>{t('dob')}</TableCell> : null}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showDobColumn ? 4 : 3} align='center'>
                  {t('loading_competitors')}
                </TableCell>
              </TableRow>
            ) : null}
            {rows.map((item) => {
              const isLetterHighlighted =
                highlightedLetter !== null &&
                item.lastName.trim().charAt(0).toLocaleUpperCase() === highlightedLetter;
              const isFocused = highlightedCompetitorId === item.competitorId;
              const hasSelectedCourse = Boolean(selectedCoursesByCompetitor[item.competitorId]);

              return (
                <CompetitorTableRow
                  key={item.competitorId}
                  item={item}
                  ref={(element) => {
                    if (element) {
                      rowRefs.current.set(item.competitorId, element);
                      return;
                    }

                    rowRefs.current.delete(item.competitorId);
                  }}
                  hasSelectedCourse={hasSelectedCourse}
                  isLetterHighlighted={isLetterHighlighted}
                  isFocused={isFocused}
                  rowColor={selectedFilter === 'all' ? colorByCompetitorId.get(item.competitorId) ?? null : null}
                  showDobColumn={showDobColumn}
                  textScale={textScale}
                  onClick={() => setSelectedCompetitorId(item.competitorId)}
                />
              );
            })}
            {!loading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showDobColumn ? 4 : 3} align='center'>
                  {t('no_competitors_found')}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableContainer>

      {selectedCompetitor ? (
        <CompetitorDetailDialog
          competitor={selectedCompetitor}
          allCompetitionGroups={competitionGroups}
          courses={courses}
          courseNameById={courseNameById}
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

type CompetitorTableRowProps = {
  item: DesktopCompetitorRow;
  hasSelectedCourse: boolean;
  isLetterHighlighted: boolean;
  isFocused: boolean;
  rowColor: string | null;
  showDobColumn: boolean;
  textScale: number;
  onClick: () => void;
};

const CompetitorTableRow = memo(forwardRef<HTMLTableRowElement, CompetitorTableRowProps>(
  function CompetitorTableRow({
    item,
    hasSelectedCourse,
    isLetterHighlighted,
    isFocused,
    rowColor,
    showDobColumn,
    textScale,
    onClick,
  }, ref) {
    const rowBackgroundColor = isFocused
      ? 'warning.light'
      : rowColor
        ? lightenHex(rowColor, hasSelectedCourse ? 0.3 : 0.12)
        : 'inherit';
    const rowHoverColor = isFocused
      ? 'warning.light'
      : rowColor
        ? lightenHex(rowColor, hasSelectedCourse ? 0.36 : 0.2)
        : 'action.hover';

    return (
      <TableRow
        ref={ref}
        hover
        onClick={onClick}
        sx={{
          cursor: 'pointer',
          color: rowColor ? getContrastingTextColor(rowBackgroundColor) : hasSelectedCourse ? '#ddd' : 'text.primary',
          backgroundColor: rowBackgroundColor,
          outline: isLetterHighlighted ? '2px solid #FFD600' : 'none',
          outlineOffset: '-2px',
          '&:hover': {
            backgroundColor: rowHoverColor,
          },
          '& > *': {
            color: 'inherit',
            fontSize: `${textScale}rem`,
          },
          '& > .MuiTableCell-root': {
            color: 'inherit',
            fontSize: `${textScale}rem`,
          },
        }}
      >
        <TableCell>{item.eolNumber}</TableCell>
        <TableCell>{item.firstName}</TableCell>
        <TableCell>{item.lastName}</TableCell>
        {showDobColumn ? <TableCell>{item.dob ?? '—'}</TableCell> : null}
      </TableRow>
    );
  }),
  (previousProps, nextProps) =>
    previousProps.item === nextProps.item &&
    previousProps.hasSelectedCourse === nextProps.hasSelectedCourse &&
    previousProps.isLetterHighlighted === nextProps.isLetterHighlighted &&
    previousProps.isFocused === nextProps.isFocused &&
    previousProps.rowColor === nextProps.rowColor &&
    previousProps.showDobColumn === nextProps.showDobColumn &&
    previousProps.textScale === nextProps.textScale,
);

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
