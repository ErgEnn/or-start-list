import { useEffect, useState } from "react";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import {
  Alert,
  Box,
  Button,
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
import {
  UNDECIDED_COURSE_ID,
  type CompetitionGroup,
  type Course,
  type DesktopCreateRegistrationResponse,
} from "@or/shared";
import { desktopClaimReservedCode } from "../lib/desktop";
import { t } from "../i18n";

type AddCompetitorButtonProps = {
  courses: Course[];
  competitionGroups: CompetitionGroup[];
  selectedEventId: string;
  onClaimed: (response: DesktopCreateRegistrationResponse) => void;
};

const birthYearOptions: number[] = [];
for (let y = new Date().getFullYear(); y >= 1900; y--) {
  birthYearOptions.push(y);
}

function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function AddCompetitorButton({
  courses,
  competitionGroups,
  selectedEventId,
  onClaimed,
}: AddCompetitorButtonProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [eolCode, setEolCode] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [courseId, setCourseId] = useState("");
  const [competitionGroupName, setCompetitionGroupName] = useState("");
  const [competitionGroupError, setCompetitionGroupError] = useState("");
  const [courseError, setCourseError] = useState("");

  const parsedBirthYear = /^\d{4}$/.test(birthYear.trim())
    ? Number.parseInt(birthYear.trim(), 10)
    : null;

  const selectedGroup = competitionGroups.find((g) => g.name === competitionGroupName);
  const selectedGroupPrice = selectedGroup?.priceCents ?? null;

  // Auto-select first course if only one
  useEffect(() => {
    if (courses.length === 1 && !courseId) {
      setCourseId(courses[0].courseId);
    }
  }, [courses, courseId]);

  function resetForm() {
    setEolCode("");
    setBirthYear("");
    setGender("");
    setCourseId("");
    setCompetitionGroupName("");
    setError("");
    setCompetitionGroupError("");
    setCourseError("");
  }

  function handleClose() {
    setOpen(false);
    resetForm();
  }

  async function handleSave() {
    let valid = true;
    if (!competitionGroupName) {
      setCompetitionGroupError(t("competition_group_required"));
      valid = false;
    } else {
      setCompetitionGroupError("");
    }
    if (!courseId) {
      setCourseError(t("course_required"));
      valid = false;
    } else {
      setCourseError("");
    }
    if (!valid) return;

    setSaving(true);
    setError("");

    try {
      const response = await desktopClaimReservedCode({
        eolCode: eolCode.trim(),
        eventId: selectedEventId,
        courseId,
        competitionGroupName: competitionGroupName || undefined,
        birthYear: parsedBirthYear ?? undefined,
        gender: gender || undefined,
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

  return (
    <>
      <Button aria-label={t("add_competitor")} variant="outlined" onClick={() => setOpen(true)}>
        <PersonAddIcon />
      </Button>
      <Dialog open={open} onClose={saving ? undefined : handleClose} fullWidth maxWidth="sm">
        <DialogTitle>Lisa uus võistleja</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error ? <Alert severity="error">{error}</Alert> : null}

            <TextField
              fullWidth
              required
              autoFocus
              label="EOL kood"
              value={eolCode}
              onChange={(e) => setEolCode(e.target.value)}
            />

            <Box sx={{ display: "flex", gap: 1 }}>
              <FormControl sx={{ flex: 1 }}>
                <InputLabel>Sünniaasta</InputLabel>
                <Select
                  value={birthYear}
                  label="Sünniaasta"
                  onChange={(e) => setBirthYear(e.target.value)}
                >
                  <MenuItem value="">—</MenuItem>
                  {birthYearOptions.map((year) => (
                    <MenuItem key={year} value={String(year)}>{year}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <Typography variant="body2" sx={{ mb: 0.5, color: "text.secondary" }}>
                  Sugu
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  value={gender}
                  onChange={(_, v: "male" | "female" | null) => {
                    if (v) setGender(v);
                  }}
                  sx={{ flex: 1 }}
                >
                  <ToggleButton value="male" sx={{ flex: 1 }}>
                    Mees
                  </ToggleButton>
                  <ToggleButton value="female" sx={{ flex: 1 }}>
                    Naine
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>
            </Box>

            <Divider />

            {/* Competition group */}
            <FormControl fullWidth required error={!!competitionGroupError}>
              <InputLabel>Võistlusgrupp</InputLabel>
              <Select
                value={competitionGroupName}
                label="Võistlusgrupp"
                onChange={(e) => {
                  setCompetitionGroupName(e.target.value);
                  if (competitionGroupError) setCompetitionGroupError("");
                }}
              >
                <MenuItem value="">—</MenuItem>
                {competitionGroups.map((group) => (
                  <MenuItem key={group.name} value={group.name}>
                    {group.name}
                  </MenuItem>
                ))}
              </Select>
              {competitionGroupError ? <Typography variant="caption" color="error">{competitionGroupError}</Typography> : null}
            </FormControl>

            {selectedGroupPrice != null && (
              <Typography>
                Hind: {formatPrice(selectedGroupPrice)}
              </Typography>
            )}

            {/* Course */}
            <Box>
              <Typography variant="body2" sx={{ mb: 0.5, color: courseError ? "error.main" : "text.secondary" }}>
                Rada *
              </Typography>
              <ToggleButtonGroup
                exclusive
                value={courseId}
                onChange={(_, value: string | null) => {
                  if (value !== null) {
                    setCourseId(value);
                    if (courseError) setCourseError("");
                  }
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
                <ToggleButton
                  value={UNDECIDED_COURSE_ID}
                  sx={{ flexGrow: 1, lineHeight: 1 }}
                >
                  ?
                </ToggleButton>
              </ToggleButtonGroup>
              {courseError ? <Typography variant="caption" color="error">{courseError}</Typography> : null}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={saving}>
            Loobu
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            Salvesta
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
