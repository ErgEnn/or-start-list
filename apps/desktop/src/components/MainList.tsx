import { forwardRef, memo, useEffect, useMemo, useRef } from 'react';
import {
  Paper,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import type { CompetitionGroup, Course, DesktopCompetitorRow, PaymentGroup } from '@or/shared';
import { t } from '../i18n';

type MainListProps = {
  rows: DesktopCompetitorRow[];
  paymentGroups: PaymentGroup[];
  selectedFilter: string;
  loading: boolean;
  scrollTarget: { competitorId: string; token: number } | null;
  highlightedCompetitorId: string | null;
  highlightedLetter: string | null;
  courses: Course[];
  textScale: number;
  selectedCoursesByCompetitor: Record<string, string>;
  submittingCompetitorIds: Set<string>;
  onSelectCompetitionGroup: (competitorId: string, competitionGroupName: string) => Promise<void>;
  onSelectCourse: (competitorId: string, courseId: string | null) => Promise<void>;
};

export const MainList = memo(function MainList({
  rows,
  paymentGroups,
  selectedFilter,
  loading,
  scrollTarget,
  highlightedCompetitorId,
  highlightedLetter,
  courses,
  textScale,
  selectedCoursesByCompetitor,
  submittingCompetitorIds,
  onSelectCompetitionGroup,
  onSelectCourse,
}: MainListProps) {
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
  const courseNameById = useMemo(
    () => new Map(courses.map((course) => [course.courseId, course.name])),
    [courses],
  );
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

  useEffect(() => {
    if (!scrollTarget?.competitorId) {
      return;
    }

    const row = rowRefs.current.get(scrollTarget.competitorId);
    row?.scrollIntoView({ block: 'center' });
  }, [rows, scrollTarget]);

  return (
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
            <TableCell>{t('si_code')}</TableCell>
            <TableCell>{t('class')}</TableCell>
            <TableCell>{t('price')}</TableCell>
            <TableCell>{t('course')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading && rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} align='center'>
                {t('loading_competitors')}
              </TableCell>
            </TableRow>
          ) : null}
          {rows.map((item) => {
            const isLetterHighlighted =
              highlightedLetter !== null &&
              item.lastName.trim().charAt(0).toLocaleUpperCase() === highlightedLetter;
            const isFocused = highlightedCompetitorId === item.competitorId;

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
                selectedCourseId={selectedCoursesByCompetitor[item.competitorId] ?? null}
                submitting={submittingCompetitorIds.has(item.competitorId)}
                isLetterHighlighted={isLetterHighlighted}
                isFocused={isFocused}
                rowColor={selectedFilter === 'all' ? colorByCompetitorId.get(item.competitorId) ?? null : null}
                courses={courses}
                courseNameById={courseNameById}
                textScale={textScale}
                onSelectCompetitionGroup={onSelectCompetitionGroup}
                onSelectCourse={onSelectCourse}
              />
            );
          })}
          {!loading && rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} align='center'>
                {t('no_competitors_found')}
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </TableContainer>
  );
});

type CompetitorTableRowProps = {
  item: DesktopCompetitorRow;
  selectedCourseId: string | null;
  submitting: boolean;
  isLetterHighlighted: boolean;
  isFocused: boolean;
  rowColor: string | null;
  courses: Course[];
  courseNameById: Map<string, string>;
  textScale: number;
  onSelectCompetitionGroup: (competitorId: string, competitionGroupName: string) => Promise<void>;
  onSelectCourse: (competitorId: string, courseId: string | null) => Promise<void>;
};

const CompetitorTableRow = memo(forwardRef<HTMLTableRowElement, CompetitorTableRowProps>(
  function CompetitorTableRow({
    item,
    selectedCourseId,
    submitting,
    isLetterHighlighted,
    isFocused,
    rowColor,
    courses,
    courseNameById,
    textScale,
    onSelectCompetitionGroup,
    onSelectCourse,
  }, ref) {
    const isHighlighted = isFocused || isLetterHighlighted;
    const hasSelectedCourse = Boolean(selectedCourseId);
    const rowBackgroundColor = isFocused
      ? 'warning.light'
      : isHighlighted
        ? 'action.selected'
        : rowColor
          ? lightenHex(rowColor, hasSelectedCourse ? 0.3 : 0.12)
          : 'inherit';
    const rowHoverColor = isFocused
      ? 'warning.light'
      : isHighlighted
        ? 'action.selected'
        : rowColor
          ? lightenHex(rowColor, hasSelectedCourse ? 0.36 : 0.2)
          : 'action.hover';

    return (
      <TableRow
        ref={ref}
        hover
        sx={{
          color: rowColor ? getContrastingTextColor(rowBackgroundColor) : hasSelectedCourse ? '#ddd' : 'text.primary',
          backgroundColor: rowBackgroundColor,
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
        <TableCell>{item.siCard ?? ''}</TableCell>
        <TableCell>
          <CompetitionGroupSelector
            competitorId={item.competitorId}
            competitionGroups={item.availableCompetitionGroups}
            selectedCompetitionGroupName={item.selectedCompetitionGroupName}
            disabled={hasSelectedCourse}
            loading={submitting}
            textScale={textScale}
            onSelectCompetitionGroup={onSelectCompetitionGroup}
          />
        </TableCell>
        <TableCell>{item.priceCents === null ? '' : formatPrice(item.priceCents)}</TableCell>
        <TableCell>
          <CourseSelector
            competitorId={item.competitorId}
            courses={courses}
            courseNameById={courseNameById}
            textScale={textScale}
            selectedCourseId={selectedCourseId}
            loading={submitting || item.selectedCompetitionGroupName === null}
            onSelectCourse={onSelectCourse}
          />
        </TableCell>
      </TableRow>
    );
  }),
  (previousProps, nextProps) =>
    previousProps.item === nextProps.item &&
    previousProps.selectedCourseId === nextProps.selectedCourseId &&
    previousProps.submitting === nextProps.submitting &&
    previousProps.isLetterHighlighted === nextProps.isLetterHighlighted &&
    previousProps.isFocused === nextProps.isFocused &&
    previousProps.rowColor === nextProps.rowColor &&
    previousProps.courses === nextProps.courses &&
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

function CompetitionGroupSelector({
  competitorId,
  competitionGroups,
  selectedCompetitionGroupName,
  disabled,
  loading,
  textScale,
  onSelectCompetitionGroup,
}: {
  competitorId: string;
  competitionGroups: CompetitionGroup[];
  selectedCompetitionGroupName: string | null;
  disabled: boolean;
  loading: boolean;
  textScale: number;
  onSelectCompetitionGroup: (competitorId: string, competitionGroupName: string) => Promise<void>;
}) {
  return (
    <Select
      value={selectedCompetitionGroupName ?? ''}
      disabled={disabled || loading || competitionGroups.length === 0}
      displayEmpty
      fullWidth
      size='small'
      sx={{ fontSize: `${Math.max(0.9, textScale * 0.8)}rem` }}
      onChange={(event) => {
        const nextValue = String(event.target.value);
        if (!nextValue) {
          return;
        }
        void onSelectCompetitionGroup(competitorId, nextValue);
      }}
    >
      {competitionGroups.length === 0 ? (
        <MenuItem value=''>{t('no_competition_groups')}</MenuItem>
      ) : null}
      {competitionGroups.map((group) => (
        <MenuItem key={group.name} value={group.name}>
          {group.name}
        </MenuItem>
      ))}
    </Select>
  );
}

function CourseSelector({
  competitorId,
  courses,
  courseNameById,
  textScale,
  selectedCourseId,
  loading,
  onSelectCourse,
}: {
  competitorId: string;
  courses: Course[];
  courseNameById: Map<string, string>;
  textScale: number;
  selectedCourseId: string | null;
  loading: boolean;
  onSelectCourse: (competitorId: string, courseId: string | null) => Promise<void>;
}) {
  return (
      <ToggleButtonGroup
        exclusive
        value={selectedCourseId}
        disabled={courses.length === 0 || loading}
        sx={{ flexWrap: 'wrap', width: '100%' }}
        onChange={(_, nextValue: string | null) => {
          void onSelectCourse(competitorId, nextValue);
        }}
      >
        {courses.map((course) => (
          <ToggleButton key={course.courseId} value={course.courseId} sx={{
            fontSize: `${Math.max(0.9, textScale * 0.8)}rem`,
            lineHeight: 1,
            flexGrow: 1,
            }}>
            {courseNameById.get(course.courseId) ?? course.name}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
  );
}

function formatPrice(priceCents: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'EUR',
  }).format(priceCents / 100);
}
