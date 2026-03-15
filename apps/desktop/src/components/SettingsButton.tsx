import { useEffect, useState } from "react";
import SettingsIcon from "@mui/icons-material/Settings";
import SyncIcon from "@mui/icons-material/Sync";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  DialogTitle,
  Slider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  DEFAULT_TEXT_SCALE,
  loadDeviceConfig,
  MAX_TEXT_SCALE,
  MIN_TEXT_SCALE,
  saveDeviceSettings,
  TEXT_SCALE_STEP,
  type DeviceConfig,
} from "../lib/device-config";
import { desktopForceSync } from "../lib/desktop";
import { t } from "../i18n";

type SettingsButtonProps = {
  onSaved?: (config: DeviceConfig) => void;
  onTextScalePreview?: (textScale: number) => void;
  onCancel?: () => void;
};

export function SettingsButton({ onSaved, onTextScalePreview, onCancel }: SettingsButtonProps) {
  const [open, setOpen] = useState(false);
  const [portalBaseUrl, setPortalBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [textScale, setTextScale] = useState(DEFAULT_TEXT_SCALE);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [portalBaseUrlLocked, setPortalBaseUrlLocked] = useState(false);
  const [apiKeyLocked, setApiKeyLocked] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    async function loadSettings() {
      setLoading(true);
      setError("");

      try {
        const config = await loadDeviceConfig();
        if (cancelled) {
          return;
        }

        setPortalBaseUrl(config.portalBaseUrl);
        setApiKey(config.apiKey);
        setTextScale(config.textScale);
        setPortalBaseUrlLocked(Boolean(config.portalBaseUrl));
        setApiKeyLocked(Boolean(config.apiKey));
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('failed_load_settings'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, [open]);

  async function handleSave() {
    setSaving(true);
    setError("");

    try {
      const savedConfig = await saveDeviceSettings({ portalBaseUrl, apiKey, textScale });
      setPortalBaseUrl(savedConfig.portalBaseUrl);
      setApiKey(savedConfig.apiKey);
      setTextScale(savedConfig.textScale);
      setPortalBaseUrlLocked(Boolean(savedConfig.portalBaseUrl));
      setApiKeyLocked(Boolean(savedConfig.apiKey));
      setOpen(false);
      onSaved?.(savedConfig);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('failed_save_settings'));
    } finally {
      setSaving(false);
    }
  }

  async function handleForceSync() {
    setSyncing(true);
    setSyncMessage("");
    try {
      await desktopForceSync();
      setSyncMessage(t("force_sync_success"));
    } catch {
      setSyncMessage(t("force_sync_failed"));
    } finally {
      setSyncing(false);
    }
  }

  function handleClose() {
    setOpen(false);
    setSyncMessage("");
    onCancel?.();
  }

  return (
    <>
      <Button aria-label={t('open_settings')} variant="outlined" onClick={() => setOpen(true)}>
        <SettingsIcon />
      </Button>
      <Dialog open={open} onClose={saving ? undefined : handleClose} fullWidth maxWidth="sm">
        <DialogTitle>{t('settings')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error ? <Alert severity="error">{error}</Alert> : null}
            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress size={28} />
              </Box>
            ) : (
              <>
                <TextField
                  autoFocus={!portalBaseUrlLocked}
                  fullWidth
                  label={t('portal_url')}
                  value={portalBaseUrl}
                  onChange={(event) => setPortalBaseUrl(event.target.value)}
                  placeholder="http://localhost:3000"
                  disabled={portalBaseUrlLocked}
                  helperText={portalBaseUrlLocked ? t('settings_locked_helper') : undefined}
                />
                <TextField
                  fullWidth
                  label={t('api_key')}
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  autoComplete="off"
                  disabled={apiKeyLocked}
                  helperText={apiKeyLocked ? t('settings_locked_helper') : undefined}
                />
                <Box>
                  <Typography gutterBottom>
                    {t('text_size')}: {textScale.toFixed(1)}x
                  </Typography>
                  <Slider
                    value={textScale}
                    min={MIN_TEXT_SCALE}
                    max={MAX_TEXT_SCALE}
                    step={TEXT_SCALE_STEP}
                    marks
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${value}x`}
                    onChange={(_event, value) => {
                      const nextValue = Array.isArray(value) ? value[0] : value;
                      setTextScale(nextValue);
                      onTextScalePreview?.(nextValue);
                    }}
                  />
                </Box>
                <Divider />
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Button
                    variant="outlined"
                    startIcon={syncing ? <CircularProgress size={16} /> : <SyncIcon />}
                    onClick={() => void handleForceSync()}
                    disabled={syncing}
                  >
                    {t("force_sync")}
                  </Button>
                  {syncMessage ? (
                    <Typography variant="body2" sx={{ color: syncMessage === t("force_sync_success") ? "success.main" : "error.main" }}>
                      {syncMessage}
                    </Typography>
                  ) : null}
                </Box>
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={saving}>
            {t('cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleSave()}
            disabled={
              loading ||
              saving ||
              (!portalBaseUrlLocked && !portalBaseUrl.trim()) ||
              (!apiKeyLocked && !apiKey.trim())
            }
          >
            {t('save')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
