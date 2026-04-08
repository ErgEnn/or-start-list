import { useEffect, useMemo, useState } from "react";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import type {
  CompetitionGroup,
  Course,
  DesktopCreateRegistrationResponse,
  MapPreferenceMember,
  ReservedCode,
} from "@or/shared";
import { desktopGetReservedCodes, desktopClaimReservedCode } from "../lib/desktop";
import { t } from "../i18n";
import { type ModalLang, modalT } from "./addCompetitorTranslations";

const ESTONIAN_COUNTIES = [
  "Harju maakond",
  "Hiiu maakond",
  "Ida-Viru maakond",
  "Jõgeva maakond",
  "Järva maakond",
  "Lääne maakond",
  "Lääne-Viru maakond",
  "Põlva maakond",
  "Pärnu maakond",
  "Rapla maakond",
  "Saare maakond",
  "Tartu maakond",
  "Valga maakond",
  "Viljandi maakond",
  "Võru maakond",
];

type AddCompetitorButtonProps = {
  courses: Course[];
  competitionGroups: CompetitionGroup[];
  mapPreferences: MapPreferenceMember[];
  selectedEventId: string;
  onClaimed: (response: DesktopCreateRegistrationResponse) => void;
};

function parseBirthYear(dob: string): number | null {
  const match = /^(\d{4})/.exec(dob);
  return match ? Number.parseInt(match[1], 10) : null;
}

function getEligibleGroups(
  gender: string,
  dob: string,
  competitionGroups: CompetitionGroup[],
): CompetitionGroup[] {
  const birthYear = parseBirthYear(dob);

  return competitionGroups.filter((group) => {
    // Gender filter: skip groups whose gender doesn't match
    if (gender && group.gender && group.gender !== gender) {
      return false;
    }
    // Birth year filter: skip groups whose year range doesn't match
    if (birthYear != null) {
      if (group.minYear != null && birthYear < group.minYear) return false;
      if (group.maxYear != null && birthYear > group.maxYear) return false;
    }
    return true;
  });
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function AddCompetitorButton({
  courses,
  competitionGroups,
  mapPreferences: _mapPreferences,
  selectedEventId,
  onClaimed,
}: AddCompetitorButtonProps) {
  const [open, setOpen] = useState(false);
  const [reservedCodes, setReservedCodes] = useState<ReservedCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [selectedCode, setSelectedCode] = useState("");
  const [manualEol, setManualEol] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("");
  const [dob, setDob] = useState("");
  const [dobError, setDobError] = useState("");
  const [club, setClub] = useState("");
  const [siCard, setSiCard] = useState("");
  const [county, setCounty] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [language, setLanguage] = useState<ModalLang>("et");
  const [courseId, setCourseId] = useState("");
  const [competitionGroupName, setCompetitionGroupName] = useState("");

  const usingManualEol = manualEol.trim().length > 0;
  const effectiveCode = usingManualEol ? manualEol.trim() : selectedCode;

  // Show all groups, but compute eligible ones for auto-selection
  const eligibleGroups = useMemo(
    () => getEligibleGroups(gender, dob, competitionGroups),
    [gender, dob, competitionGroups],
  );

  const selectedGroupPrice = useMemo(() => {
    const group = competitionGroups.find((g) => g.name === competitionGroupName);
    return group?.priceCents ?? null;
  }, [competitionGroupName, competitionGroups]);

  // Auto-select first eligible group when eligibility changes
  useEffect(() => {
    if (eligibleGroups.length > 0 && !eligibleGroups.some((g) => g.name === competitionGroupName)) {
      setCompetitionGroupName(eligibleGroups[0].name);
    }
  }, [eligibleGroups, competitionGroupName]);

  // Auto-select first course if only one
  useEffect(() => {
    if (courses.length === 1 && !courseId) {
      setCourseId(courses[0].courseId);
    }
  }, [courses, courseId]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function loadCodes() {
      setLoading(true);
      setError("");
      try {
        const codes = await desktopGetReservedCodes();
        if (!cancelled) {
          setReservedCodes(codes);
          if (codes.length > 0) {
            setSelectedCode(codes[0].code);
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t("failed_load_reserved_codes"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadCodes();

    return () => {
      cancelled = true;
    };
  }, [open]);

  function resetForm() {
    setSelectedCode("");
    setManualEol("");
    setFirstName("");
    setLastName("");
    setGender("");
    setDob("");
    setDobError("");
    setClub("");
    setSiCard("");
    setCounty(null);
    setEmail("");
    setCourseId("");
    setCompetitionGroupName("");
    setError("");
    // language is intentionally NOT reset — persists across opens
  }

  function handleClose() {
    setOpen(false);
    resetForm();
  }

  function handleDobBlur() {
    if (!dob.trim()) {
      setDobError("");
      return;
    }
    if (!isValidDate(dob.trim())) {
      setDobError(modalT(language, "invalid_date"));
    } else {
      setDobError("");
    }
  }

  async function handleSave() {
    setSaving(true);
    setError("");

    try {
      const response = await desktopClaimReservedCode({
        code: effectiveCode,
        eventId: selectedEventId,
        courseId,
        competitionGroupName: competitionGroupName || undefined,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        gender: gender as "male" | "female",
        dob,
        club: club.trim() || undefined,
        siCard: siCard.trim() || undefined,
        county: county || undefined,
        email: email.trim() || undefined,
        isManualEol: usingManualEol || undefined,
      });
      setOpen(false);
      resetForm();
      onClaimed(response);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t("failed_claim_reserved_code"));
    } finally {
      setSaving(false);
    }
  }

  const canSave =
    effectiveCode &&
    firstName.trim() &&
    lastName.trim() &&
    gender &&
    dob &&
    !dobError &&
    courseId &&
    !saving &&
    !loading;

  const mt = (key: string) => modalT(language, key);
  const et = (key: string) => modalT("et", key);

  return (
    <>
      <Button aria-label={t("add_competitor")} variant="outlined" onClick={() => setOpen(true)}>
        <PersonAddIcon />
      </Button>
      <Dialog open={open} onClose={saving ? undefined : handleClose} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {mt("add_new_competitor")}
          <ToggleButtonGroup
            exclusive
            size="small"
            value={language}
            onChange={(_, v: ModalLang | null) => {
              if (v) setLanguage(v);
            }}
          >
            <ToggleButton value="et" sx={{ px: 1, py: 0.25, fontSize: "0.75rem" }}>
              ET
            </ToggleButton>
            <ToggleButton value="en" sx={{ px: 1, py: 0.25, fontSize: "0.75rem" }}>
              EN
            </ToggleButton>
            <ToggleButton value="fi" sx={{ px: 1, py: 0.25, fontSize: "0.75rem" }}>
              FI
            </ToggleButton>
            <ToggleButton value="lv" sx={{ px: 1, py: 0.25, fontSize: "0.75rem" }}>
              LV
            </ToggleButton>
            <ToggleButton value="ru" sx={{ px: 1, py: 0.25, fontSize: "0.75rem" }}>
              RU
            </ToggleButton>
          </ToggleButtonGroup>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error ? <Alert severity="error">{error}</Alert> : null}
            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress size={28} />
              </Box>
            ) : (
              <>
                <Typography variant="subtitle2">{mt("competitor_data")}</Typography>

                {/* Reserved code dropdown OR manual EOL text input */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <FormControl sx={{ flex: 1 }} disabled={usingManualEol}>
                    <InputLabel>{mt("reserved_code")}</InputLabel>
                    <Select
                      value={usingManualEol ? "" : selectedCode}
                      label={mt("reserved_code")}
                      onChange={(e) => setSelectedCode(e.target.value)}
                    >
                      {reservedCodes.map((rc) => (
                        <MenuItem key={rc.code} value={rc.code}>
                          {rc.code}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {mt("or")}
                  </Typography>
                  <TextField
                    sx={{ flex: 1 }}
                    label={mt("manual_eol")}
                    value={manualEol}
                    onChange={(e) => setManualEol(e.target.value)}
                  />
                </Box>

                {/* First name + last name on same row */}
                <Box sx={{ display: "flex", gap: 1 }}>
                  <TextField
                    sx={{ flex: 1 }}
                    required
                    label={mt("first_name")}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                  <TextField
                    sx={{ flex: 1 }}
                    required
                    label={mt("last_name")}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </Box>

                <Box sx={{ display: "flex", gap: 1 }}>
                  <TextField
                    sx={{ flex: 1 }}
                    required
                    label={mt("dob")}
                    value={dob}
                    onChange={(e) => {
                      setDob(e.target.value);
                      if (dobError) setDobError("");
                    }}
                    onBlur={handleDobBlur}
                    placeholder={mt("dob_placeholder")}
                    error={!!dobError}
                    helperText={dobError}
                  />
                  <FormControl sx={{ flex: 1 }} required>
                    <InputLabel>{mt("gender")}</InputLabel>
                    <Select
                      value={gender}
                      label={mt("gender")}
                      onChange={(e) => setGender(e.target.value)}
                    >
                      <MenuItem value="male">{mt("male")}</MenuItem>
                      <MenuItem value="female">{mt("female")}</MenuItem>
                    </Select>
                  </FormControl>
                </Box>

                <TextField
                  fullWidth
                  label={mt("si_code")}
                  value={siCard}
                  onChange={(e) => setSiCard(e.target.value)}
                />
                <TextField
                  fullWidth
                  label={mt("school_workplace")}
                  value={club}
                  onChange={(e) => setClub(e.target.value)}
                />
                <Autocomplete
                  value={county}
                  onChange={(_, value) => setCounty(value)}
                  options={[...ESTONIAN_COUNTIES, mt("non_resident")]}
                  renderInput={(params) => (
                    <TextField {...params} label={mt("county")} />
                  )}
                />
                <TextField
                  fullWidth
                  label={mt("email")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                />

                <Divider />
                <Typography variant="subtitle2">{et("registration")}</Typography>

                {/* Competition group — optional, shows all groups */}
                <FormControl fullWidth>
                  <InputLabel>{et("competition_group")}</InputLabel>
                  <Select
                    value={competitionGroupName}
                    label={et("competition_group")}
                    onChange={(e) => setCompetitionGroupName(e.target.value)}
                  >
                    <MenuItem value="">—</MenuItem>
                    {competitionGroups.map((group) => (
                      <MenuItem key={group.name} value={group.name}>
                        {group.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {selectedGroupPrice != null && (
                  <Typography>
                    {et("price")}: {formatPrice(selectedGroupPrice)}
                  </Typography>
                )}

                {/* Course as ToggleButtonGroup */}
                <Box>
                  <Typography variant="body2" sx={{ mb: 0.5, color: "text.secondary" }}>
                    {et("course")} *
                  </Typography>
                  <ToggleButtonGroup
                    exclusive
                    value={courseId}
                    onChange={(_, value: string | null) => {
                      if (value !== null) setCourseId(value);
                    }}
                    sx={{ flexWrap: "wrap", width: "100%" }}
                  >
                    {courses.map((course) => (
                      <ToggleButton
                        key={course.courseId}
                        value={course.courseId}
                        sx={{ flexGrow: 1, lineHeight: 1 }}
                      >
                        {course.name}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </Box>
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={saving}>
            {et("cancel")}
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleSave()}
            disabled={!canSave}
          >
            {et("save")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
