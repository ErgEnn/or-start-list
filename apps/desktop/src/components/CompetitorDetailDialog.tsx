import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { UNDECIDED_COURSE_ID, PAYMENT_METHODS, type CompetitionGroup, type Course, type DesktopCompetitorRow, type MapPreferenceMember, type PaymentGroup, type PaymentMethodValue, type SelectedRegistrationInfo } from '@or/shared';
import { desktopUpdateCompetitorData } from '../lib/desktop';
import { t } from '../i18n';

type CompetitorDetailDialogProps = {
  competitor: DesktopCompetitorRow;
  allCompetitionGroups: CompetitionGroup[];
  courses: Course[];
  courseNameById: Map<string, string>;
  mapPreference: MapPreferenceMember | null;
  textScale: number;
  selectedCourseId: string | null;
  selectedRegistration: SelectedRegistrationInfo | null;
  submitting: boolean;
  onSelectCompetitionGroup: (competitorId: string, competitionGroupName: string) => Promise<void>;
  onSelectCourse: (competitorId: string, courseId: string | null, paidPriceCents?: number, paymentMethod?: string, competitionGroupName?: string) => Promise<void>;
  onUpdateRegistrationPayment: (competitorId: string, paidPriceCents: number, paymentMethod: string) => Promise<void>;
  paymentGroups: PaymentGroup[];
  onAddPaymentGroupMember: (paymentGroupId: string, competitorId: string) => Promise<void>;
  onClose: () => void;
  isEventToday: boolean;
};

function parseBirthYear(dob: string): number | null {
  const match = /^(\d{4})/.exec(dob);
  return match ? Number.parseInt(match[1], 10) : null;
}

function sortGroups(groups: CompetitionGroup[]): CompetitionGroup[] {
  return [...groups].sort((a, b) => {
    const minA = a.minYear ?? -Infinity;
    const minB = b.minYear ?? -Infinity;
    if (minA !== minB) return minB - minA;
    const maxA = a.maxYear ?? Infinity;
    const maxB = b.maxYear ?? Infinity;
    return maxA - maxB;
  });
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
  mapPreference,
  textScale,
  selectedCourseId,
  selectedRegistration,
  submitting,
  onSelectCompetitionGroup,
  onSelectCourse,
  onUpdateRegistrationPayment,
  paymentGroups,
  onAddPaymentGroupMember,
  onClose,
  isEventToday,
}: CompetitorDetailDialogProps) {
  const genderMissing = !competitor.gender;
  const dobMissing = !competitor.dob;

  const [localGender, setLocalGender] = useState<string>(competitor.gender ?? '');
  const [localDob, setLocalDob] = useState<string>(competitor.dob ?? '');
  const [localCompetitionGroup, setLocalCompetitionGroup] = useState(competitor.selectedCompetitionGroupName);
  const [genderError, setGenderError] = useState('');
  const [dobError, setDobError] = useState('');
  const [competitionGroupError, setCompetitionGroupError] = useState('');
  const [courseError, setCourseError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [confirmWrongDateOpen, setConfirmWrongDateOpen] = useState(false);

  const mapPreferredCourseId = useMemo(() => {
    if (!mapPreference) return null;
    const match = courses.find((c) => c.name.toLowerCase() === mapPreference.courseName.toLowerCase());
    return match?.courseId ?? null;
  }, [mapPreference, courses]);

  const [localCourseId, setLocalCourseId] = useState(
    selectedCourseId ?? mapPreferredCourseId,
  );
  const existingPaymentGroupId = useMemo(() => {
    for (const group of paymentGroups) {
      if (group.competitorIds.includes(competitor.competitorId)) {
        return group.paymentGroupId;
      }
    }
    return null;
  }, [paymentGroups, competitor.competitorId]);

  const paymentGroupOverridesTo0 = useMemo(() => {
    if (!existingPaymentGroupId) return false;
    const group = paymentGroups.find((g) => g.paymentGroupId === existingPaymentGroupId);
    if (!group) return false;
    const member = group.competitors.find((m) => m.competitorId === competitor.competitorId);
    if (member?.priceOverrideCents === 0) return true;
    if (group.globalPriceOverride != null && Math.round(group.globalPriceOverride * 100) === 0) return true;
    return false;
  }, [existingPaymentGroupId, paymentGroups, competitor.competitorId]);

  const rawPaymentMethod = selectedRegistration?.paymentMethod ?? (paymentGroupOverridesTo0 ? 'other' : 'cash');
  const initialPaymentMethod = (rawPaymentMethod.startsWith('other(') ? 'other' : rawPaymentMethod) as PaymentMethodValue;
  const initialPaidPriceCents = selectedRegistration?.paidPriceCents ?? (competitor.priceCents ?? 0);
  const initialIsCustomPrice = selectedRegistration != null && selectedRegistration.paidPriceCents !== (competitor.priceCents ?? 0);

  const [localPaymentMethod, setLocalPaymentMethod] = useState<PaymentMethodValue>(initialPaymentMethod);
  const [localPaidPriceInput, setLocalPaidPriceInput] = useState(initialIsCustomPrice ? (initialPaidPriceCents / 100).toFixed(2) : '');
  const [useCustomPrice, setUseCustomPrice] = useState(initialIsCustomPrice);
  const [localPaymentGroupId, setLocalPaymentGroupId] = useState('');

  const eligibleGroups = useMemo(
    () => sortGroups(getEligibleGroups(localGender || null, localDob || null, allCompetitionGroups)),
    [localGender, localDob, allCompetitionGroups],
  );

  // Auto-select first eligible competition group whenever eligibility changes
  useEffect(() => {
    if (eligibleGroups.length > 0) {
      setLocalCompetitionGroup(eligibleGroups[0].name);
    }
  }, [eligibleGroups]);

  const selectedGroupPriceCents = useMemo(() => {
    if (!localCompetitionGroup) return null;
    const group = allCompetitionGroups.find((g) => g.name === localCompetitionGroup);
    return group?.priceCents ?? null;
  }, [localCompetitionGroup, allCompetitionGroups]);

  const competitionGroupChanged = localCompetitionGroup !== competitor.selectedCompetitionGroupName;
  const courseChanged = localCourseId !== selectedCourseId;
  const paymentMethodChanged = localPaymentMethod !== initialPaymentMethod;
  const paymentGroupPriceOverride = useMemo(() => {
    const groupId = localPaymentGroupId || existingPaymentGroupId;
    if (!groupId) return null;
    const group = paymentGroups.find((g) => g.paymentGroupId === groupId);
    return group?.globalPriceOverride != null ? Math.round(group.globalPriceOverride * 100) : null;
  }, [localPaymentGroupId, existingPaymentGroupId, paymentGroups]);

  const groupPriceCents = selectedGroupPriceCents ?? competitor.priceCents ?? 0;
  const basePriceCents = paymentGroupPriceOverride != null
    ? Math.min(paymentGroupPriceOverride, groupPriceCents)
    : groupPriceCents;
  const effectivePaidPriceCents = useCustomPrice
    ? Math.round((Number.parseFloat(localPaidPriceInput) || 0) * 100)
    : basePriceCents;
  const priceChanged = effectivePaidPriceCents !== initialPaidPriceCents;
  const paymentGroupChanged = localPaymentGroupId !== '';
  const hasChanges = competitionGroupChanged || courseChanged || paymentMethodChanged || priceChanged || paymentGroupChanged;

  const scaledFontSize = `${textScale}rem`;

  function isValidDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  }

  function validate(): boolean {
    let valid = true;
    if (!localCompetitionGroup) {
      setCompetitionGroupError(t('competition_group_required'));
      valid = false;
    } else {
      setCompetitionGroupError('');
    }
    if (localCourseId === null) {
      setCourseError(t('course_required'));
      valid = false;
    } else {
      setCourseError('');
    }
    return valid;
  }

  async function performSave() {
    setSaveError('');

    try {
      // Update competitor data (gender/dob) if they were missing and now filled in
      const genderUpdate = genderMissing && localGender ? localGender as 'male' | 'female' : undefined;
      const dobUpdate = dobMissing && localDob.trim() ? localDob.trim() : undefined;
      if (genderUpdate || dobUpdate) {
        await desktopUpdateCompetitorData({
          competitorId: competitor.competitorId,
          gender: genderUpdate,
          dob: dobUpdate,
        });
      }

      if (competitionGroupChanged && localCompetitionGroup) {
        await onSelectCompetitionGroup(competitor.competitorId, localCompetitionGroup);
      }
      const resolvedPaymentMethod = (() => {
        if (localPaymentMethod !== 'other') return localPaymentMethod;
        const groupId = localPaymentGroupId || existingPaymentGroupId;
        if (!groupId) return 'other';
        const groupName = paymentGroups.find((g) => g.paymentGroupId === groupId)?.name;
        return groupName ? `other(${groupName})` : 'other';
      })();

      if (courseChanged) {
        await onSelectCourse(competitor.competitorId, localCourseId, effectivePaidPriceCents, resolvedPaymentMethod, localCompetitionGroup ?? undefined);
      } else if (paymentMethodChanged || priceChanged) {
        await onUpdateRegistrationPayment(competitor.competitorId, effectivePaidPriceCents, resolvedPaymentMethod);
      }
      if (localPaymentGroupId) {
        await onAddPaymentGroupMember(localPaymentGroupId, competitor.competitorId);
      }
      onClose();
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : t('failed_save'));
    }
  }

  function handleSave() {
    if (!validate()) return;
    if (!isEventToday) {
      setConfirmWrongDateOpen(true);
      return;
    }
    void performSave();
  }

  async function handleConfirmWrongDate() {
    setConfirmWrongDateOpen(false);
    await performSave();
  }

  async function handleRemoveRegistration() {
    await onSelectCourse(competitor.competitorId, null);
    onClose();
  }

  return (
    <Dialog open onClose={submitting ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('competitor_data')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {saveError ? <Alert severity="error">{saveError}</Alert> : null}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <DetailRow label={t('first_name')} value={competitor.firstName} fontSize={scaledFontSize} />
            <DetailRow label={t('last_name')} value={competitor.lastName} fontSize={scaledFontSize} />

            {genderMissing ? (
              <Tooltip title={genderError} open={!!genderError} arrow placement="top">
                <FormControl fullWidth size="small" error={!!genderError}>
                  <InputLabel sx={{ fontSize: scaledFontSize }}>{t('gender')}</InputLabel>
                  <Select
                    value={localGender}
                    label={t('gender')}
                    sx={{ fontSize: scaledFontSize }}
                    onChange={(event) => {
                      setLocalGender(event.target.value);
                      if (genderError) setGenderError('');
                    }}
                  >
                    <MenuItem value="male">{t('male')}</MenuItem>
                    <MenuItem value="female">{t('female')}</MenuItem>
                  </Select>
                  {genderError ? <FormHelperText>{genderError}</FormHelperText> : null}
                </FormControl>
              </Tooltip>
            ) : (
              <DetailRow
                label={t('gender')}
                value={competitor.gender === 'male' ? t('male') : t('female')}
                fontSize={scaledFontSize}
              />
            )}

            {dobMissing ? (
              <Tooltip title={dobError} open={!!dobError} arrow placement="top">
                <TextField
                  fullWidth
                  size="small"
                  label={t('dob')}
                  value={localDob}
                  onChange={(event) => {
                    setLocalDob(event.target.value);
                    if (dobError) setDobError('');
                  }}
                  placeholder="YYYY-MM-DD"
                  error={!!dobError}
                  helperText={dobError}
                  sx={{ '& input': { fontSize: scaledFontSize } }}
                  slotProps={{ inputLabel: { sx: { fontSize: scaledFontSize } } }}
                />
              </Tooltip>
            ) : (
              <DetailRow label={t('dob')} value={competitor.dob ?? '—'} fontSize={scaledFontSize} />
            )}

            <DetailRow label={t('eol_code')} value={competitor.eolNumber} fontSize={scaledFontSize} />
            <DetailRow label={t('si_code')} value={competitor.siCard ?? '—'} fontSize={scaledFontSize} />

            <DetailRow label={t('club')} value={competitor.club ?? '—'} fontSize={scaledFontSize} />
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: `calc(${scaledFontSize} * 0.75)` }}>
                {t('other')}
              </Typography>
              {mapPreference?.waterproofMap ? (
                <Box sx={{ mt: 0.5 }}><Chip label={t('waterproof_map')} color="info" sx={{ fontSize: scaledFontSize, height: 'auto', '& .MuiChip-label': { py: 0.5 } }} /></Box>
              ) : (
                <Typography variant="body1" sx={{ fontSize: scaledFontSize }}>—</Typography>
              )}
            </Box>
          </Box>

          <Box>
            <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 'bold', fontSize: scaledFontSize, color: competitionGroupError ? 'error.main' : undefined }}>
              {t('competition_group')} *
            </Typography>
            <Select
              value={localCompetitionGroup ?? ''}
              disabled={localCourseId !== null || submitting || eligibleGroups.length === 0}
              displayEmpty
              fullWidth
              size="small"
              error={!!competitionGroupError}
              sx={{ fontSize: scaledFontSize }}
              onChange={(event) => {
                const nextValue = String(event.target.value);
                if (nextValue) {
                  setLocalCompetitionGroup(nextValue);
                  if (competitionGroupError) setCompetitionGroupError('');
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
            {competitionGroupError ? <Typography variant="caption" color="error">{competitionGroupError}</Typography> : null}
          </Box>

          <Box>
            <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 'bold', fontSize: scaledFontSize, color: courseError ? 'error.main' : undefined }}>
              {t('course')} *
            </Typography>
            <ToggleButtonGroup
              exclusive
              value={localCourseId}
              disabled={submitting || localCompetitionGroup === null || mapPreferredCourseId !== null}
              sx={{ flexWrap: 'wrap', width: '100%' }}
              onChange={(_, nextValue: string | null) => {
                setLocalCourseId(nextValue);
                if (courseError) setCourseError('');
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
              <ToggleButton
                value={UNDECIDED_COURSE_ID}
                sx={{
                  fontSize: scaledFontSize,
                  lineHeight: 1,
                  flexGrow: 1,
                }}
              >
                ?
              </ToggleButton>
            </ToggleButtonGroup>
            {courseError ? <Typography variant="caption" color="error">{courseError}</Typography> : null}
          </Box>

          {basePriceCents > 0 ? (
            <DetailRow label={t('price')} value={formatPrice(basePriceCents)} fontSize={scaledFontSize} />
          ) : null}

          <Box>
            <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 'bold', fontSize: scaledFontSize }}>
              {t('payment_method')}
            </Typography>
            <ToggleButtonGroup
              exclusive
              value={localPaymentMethod}
              disabled={submitting}
              sx={{ flexWrap: 'wrap', width: '100%', '& .MuiToggleButtonGroup-grouped': { border: '1px solid', borderColor: 'divider', borderRadius: '4px !important' } }}
              onChange={(_, value: PaymentMethodValue | null) => {
                if (value) {
                  setLocalPaymentMethod(value);
                  if (value !== 'other') {
                    setLocalPaymentGroupId('');
                  }
                }
              }}
            >
              {(['cash', 'debt', 'transfer', 'other'] as const).map((method) => (
                <ToggleButton
                  key={method}
                  value={method}
                  sx={{ fontSize: scaledFontSize, lineHeight: 1, flexGrow: 1 }}
                >
                  {t(`payment_${method}` as const)}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          {localPaymentMethod === 'other' && paymentGroups.length > 0 ? (
            <Box>
              <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 'bold', fontSize: scaledFontSize }}>
                {t('payment_group')}
              </Typography>
              {existingPaymentGroupId ? (
                <Typography sx={{ fontSize: scaledFontSize }}>
                  {paymentGroups.find((g) => g.paymentGroupId === existingPaymentGroupId)?.name ?? '—'}
                </Typography>
              ) : (
                <Select
                  value={localPaymentGroupId}
                  displayEmpty
                  fullWidth
                  size="small"
                  disabled={submitting}
                  sx={{ fontSize: scaledFontSize }}
                  onChange={(event) => setLocalPaymentGroupId(event.target.value)}
                >
                  <MenuItem value="">—</MenuItem>
                  {paymentGroups.map((group) => (
                    <MenuItem key={group.paymentGroupId} value={group.paymentGroupId}>
                      {group.name}
                    </MenuItem>
                  ))}
                </Select>
              )}
            </Box>
          ) : null}

          <Box>
            <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 'bold', fontSize: scaledFontSize }}>
              {t('paid_price')}
            </Typography>
            <ToggleButtonGroup
              exclusive
              value={useCustomPrice ? 'custom' : 'default'}
              disabled={submitting}
              sx={{ width: '100%', mb: useCustomPrice ? 1 : 0 }}
              onChange={(_, value: string | null) => {
                if (value === 'custom') {
                  setUseCustomPrice(true);
                  setLocalPaidPriceInput((basePriceCents / 100).toFixed(2));
                } else if (value === 'default') {
                  setUseCustomPrice(false);
                }
              }}
            >
              <ToggleButton value="default" sx={{ fontSize: scaledFontSize, lineHeight: 1, flexGrow: 1 }}>
                {formatPrice(basePriceCents)}
              </ToggleButton>
              <ToggleButton value="custom" sx={{ fontSize: scaledFontSize, lineHeight: 1, flexGrow: 1 }}>
                {t('payment_other')}
              </ToggleButton>
            </ToggleButtonGroup>
            {useCustomPrice ? (
              <TextField
                fullWidth
                size="small"
                type="number"
                value={localPaidPriceInput}
                onChange={(event) => setLocalPaidPriceInput(event.target.value)}
                disabled={submitting}
                slotProps={{
                  htmlInput: { step: '0.01', min: '0' },
                  input: { sx: { fontSize: scaledFontSize } },
                  inputLabel: { sx: { fontSize: scaledFontSize } },
                }}
              />
            ) : null}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        {selectedCourseId !== null ? (
          <Button
            color="error"
            onClick={() => void handleRemoveRegistration()}
            disabled={submitting}
          >
            {t('remove_registration')}
          </Button>
        ) : <Box />}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose} disabled={submitting}>
            {t('cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={submitting}
          >
            {t('save')}
          </Button>
        </Box>
      </DialogActions>
      <Dialog
        open={confirmWrongDateOpen}
        onClose={() => setConfirmWrongDateOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t('wrong_date_warning_title')}</DialogTitle>
        <DialogContent>
          <Typography>{t('wrong_date_warning_body')}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmWrongDateOpen(false)}>{t('cancel')}</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={() => void handleConfirmWrongDate()}
          >
            {t('continue')}
          </Button>
        </DialogActions>
      </Dialog>
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
