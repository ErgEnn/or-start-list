import { useEffect, useState } from "react";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SettingsIcon from "@mui/icons-material/Settings";
import SyncIcon from "@mui/icons-material/Sync";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
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
import UsbIcon from "@mui/icons-material/Usb";
import { desktopForceSync, siConnect } from "../lib/desktop";
import { useSiReaderStore } from "../stores/siReaderStore";
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
  const [siConnecting, setSiConnecting] = useState(false);
  const [siMessage, setSiMessage] = useState("");
  const siConnected = useSiReaderStore((s) => s.connected);

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

  async function handleSiConnect() {
    setSiConnecting(true);
    setSiMessage("");
    try {
      await siConnect();
      useSiReaderStore.getState().setConnected(true);
      setSiMessage("OK");
    } catch (e: unknown) {
      console.error("SI connect error:", e);
      const msg = e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);
      setSiMessage(msg || t("si_connect_failed"));
    } finally {
      setSiConnecting(false);
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
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Button
                    variant="outlined"
                    startIcon={siConnecting ? <CircularProgress size={16} /> : <UsbIcon />}
                    onClick={() => void handleSiConnect()}
                    disabled={siConnecting || siConnected}
                  >
                    {t("si_connect")}
                  </Button>
                  {siMessage ? (
                    <Typography variant="body2" sx={{ color: siConnected || siMessage === "OK" ? "success.main" : "error.main" }}>
                      {siConnected ? t("si_connected") : siMessage}
                    </Typography>
                  ) : null}
                </Box>
                <Accordion defaultExpanded={false} disableGutters sx={{ boxShadow: 'none', '&::before': { display: 'none' } }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 0 }}>
                    <Typography>{t('system_settings')}</Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ px: 0 }}>
                    <Stack spacing={2}>
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
                        type="password"
                        label={t('api_key')}
                        value={apiKey}
                        onChange={(event) => setApiKey(event.target.value)}
                        autoComplete="off"
                        disabled={apiKeyLocked}
                        helperText={apiKeyLocked ? t('settings_locked_helper') : undefined}
                      />
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
                      <Typography variant="caption" sx={{ color: "text.disabled" }}>
                        Build: #{__BUILD_NUMBER__}
                      </Typography>
                    </Stack>
                  </AccordionDetails>
                </Accordion>
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
