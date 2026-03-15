import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import type { CompetitionGroup, Course, DesktopCompetitorRow } from '@or/shared';
import { t } from '../i18n';

type CompetitorDetailDialogProps = {
  competitor: DesktopCompetitorRow;
  allCompetitionGroups: CompetitionGroup[];
  courses: Course[];
  courseNameById: Map<string, string>;
  textScale: number;
  selectedCourseId: string | null;
  submitting: boolean;
  onSelectCompetitionGroup: (competitorId: string, competitionGroupName: string) => Promise<void>;
  onSelectCourse: (competitorId: string, courseId: string | null) => Promise<void>;
  onClose: () => void;
};

function parseBirthYear(dob: string): number | null {
  const match = /^(\d{4})/.exec(dob);
  return match ? Number.parseInt(match[1], 10) : null;
}

function getEligibleGroups(
  gender: string | null,
  dob: string | null,
  competitionGroups: CompetitionGroup[],
): CompetitionGroup[] {
  const birthYear = dob ? parseBirthYear(dob) : null;

  return competitionGroups.filter((group) => {
    if (gender && group.gender && group.gender !== gender) {
      return false;
    }
    if (birthYear != null) {
      if (group.minYear != null && birthYear < group.minYear) return false;
      if (group.maxYear != null && birthYear > group.maxYear) return false;
    }
    return true;
  });
}

export function CompetitorDetailDialog({
  competitor,
  allCompetitionGroups,
  courses,
  courseNameById,
  textScale,
  selectedCourseId,
  submitting,
  onSelectCompetitionGroup,
  onSelectCourse,
  onClose,
}: CompetitorDetailDialogProps) {
  const genderMissing = !competitor.gender;
  const dobMissing = !competitor.dob;

  const [localGender, setLocalGender] = useState<string>(competitor.gender ?? '');
  const [localDob, setLocalDob] = useState<string>(competitor.dob ?? '');
  const [localCompetitionGroup, setLocalCompetitionGroup] = useState(competitor.selectedCompetitionGroupName);
  const [localCourseId, setLocalCourseId] = useState(selectedCourseId);

  const eligibleGroups = useMemo(
    () => getEligibleGroups(localGender || null, localDob || null, allCompetitionGroups),
    [localGender, localDob, allCompetitionGroups],
  );

  const competitionGroupChanged = localCompetitionGroup !== competitor.selectedCompetitionGroupName;
  const courseChanged = localCourseId !== selectedCourseId;
  const hasChanges = competitionGroupChanged || courseChanged;

  const scaledFontSize = `${textScale}rem`;

  async function handleSave() {
    if (competitionGroupChanged && localCompetitionGroup) {
      await onSelectCompetitionGroup(competitor.competitorId, localCompetitionGroup);
    }
    if (courseChanged) {
      await onSelectCourse(competitor.competitorId, localCourseId);
    }
    onClose();
  }

  return (
    <Dialog open onClose={submitting ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('competitor_data')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <DetailRow label={t('first_name')} value={competitor.firstName} fontSize={scaledFontSize} />
          <DetailRow label={t('last_name')} value={competitor.lastName} fontSize={scaledFontSize} />
          <DetailRow label={t('eol_code')} value={competitor.eolNumber} fontSize={scaledFontSize} />
          <DetailRow label={t('si_code')} value={competitor.siCard ?? '—'} fontSize={scaledFontSize} />

          {genderMissing ? (
            <FormControl fullWidth size="small">
              <InputLabel sx={{ fontSize: scaledFontSize }}>{t('gender')}</InputLabel>
              <Select
                value={localGender}
                label={t('gender')}
                sx={{ fontSize: scaledFontSize }}
                onChange={(event) => setLocalGender(event.target.value)}
              >
                <MenuItem value="male">{t('male')}</MenuItem>
                <MenuItem value="female">{t('female')}</MenuItem>
              </Select>
            </FormControl>
          ) : (
            <DetailRow
              label={t('gender')}
              value={competitor.gender === 'male' ? t('male') : t('female')}
              fontSize={scaledFontSize}
            />
          )}

          {dobMissing ? (
            <TextField
              fullWidth
              size="small"
              label={t('dob')}
              value={localDob}
              onChange={(event) => setLocalDob(event.target.value)}
              placeholder="YYYY-MM-DD"
              sx={{ '& input': { fontSize: scaledFontSize } }}
              slotProps={{ inputLabel: { sx: { fontSize: scaledFontSize } } }}
            />
          ) : (
            <DetailRow label={t('dob')} value={competitor.dob ?? '—'} fontSize={scaledFontSize} />
          )}

          <DetailRow label={t('club')} value={competitor.club ?? '—'} fontSize={scaledFontSize} />

          <Box>
            <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 'bold', fontSize: scaledFontSize }}>
              {t('competition_group')}
            </Typography>
            <Select
              value={localCompetitionGroup ?? ''}
              disabled={localCourseId !== null || submitting || eligibleGroups.length === 0}
              displayEmpty
              fullWidth
              size="small"
              sx={{ fontSize: scaledFontSize }}
              onChange={(event) => {
                const nextValue = String(event.target.value);
                if (nextValue) {
                  setLocalCompetitionGroup(nextValue);
                }
              }}
            >
              {eligibleGroups.length === 0 ? (
                <MenuItem value="">{t('no_competition_groups')}</MenuItem>
              ) : null}
              {eligibleGroups.map((group) => (
                <MenuItem key={group.name} value={group.name}>
                  {group.name}
                </MenuItem>
              ))}
            </Select>
          </Box>

          <Box>
            <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 'bold', fontSize: scaledFontSize }}>
              {t('course')}
            </Typography>
            <ToggleButtonGroup
              exclusive
              value={localCourseId}
              disabled={courses.length === 0 || submitting || localCompetitionGroup === null}
              sx={{ flexWrap: 'wrap', width: '100%' }}
              onChange={(_, nextValue: string | null) => {
                setLocalCourseId(nextValue);
              }}
            >
              {courses.map((course) => (
                <ToggleButton
                  key={course.courseId}
                  value={course.courseId}
                  sx={{
                    fontSize: scaledFontSize,
                    lineHeight: 1,
                    flexGrow: 1,
                  }}
                >
                  {courseNameById.get(course.courseId) ?? course.name}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          {competitor.priceCents !== null ? (
            <DetailRow label={t('price')} value={formatPrice(competitor.priceCents)} fontSize={scaledFontSize} />
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          {t('cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSave()}
          disabled={!hasChanges || submitting}
        >
          {t('save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function DetailRow({ label, value, fontSize }: { label: string; value: string; fontSize: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: `calc(${fontSize} * 0.75)` }}>
        {label}
      </Typography>
      <Typography variant="body1" sx={{ fontSize }}>{value}</Typography>
    </Box>
  );
}

function formatPrice(priceCents: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'EUR',
  }).format(priceCents / 100);
}
