import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import RestoreIcon from "@mui/icons-material/Restore";
import SearchIcon from "@mui/icons-material/Search";
import TranslateIcon from "@mui/icons-material/Translate";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import InputLabel from "@mui/material/InputLabel";
import LinearProgress from "@mui/material/LinearProgress";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import en from "../../i18n/locales/en.json";

const STORAGE_KEY = "hamh-translation-overrides";

interface FlatEntry {
  key: string;
  section: string;
  enValue: string;
  currentValue: string;
  isOverridden: boolean;
}

function flattenObject(
  obj: Record<string, unknown>,
  prefix = "",
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      Object.assign(result, flattenObject(v as Record<string, unknown>, full));
    } else {
      result[full] = String(v ?? "");
    }
  }
  return result;
}

function unflattenObject(
  flat: Record<string, string>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split(".");
    let current = result;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in current)) {
        current[parts[i]] = {};
      }
      current = current[parts[i]] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]] = value;
  }
  return result;
}

function loadOverrides(lang: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const all = JSON.parse(raw) as Record<string, Record<string, string>>;
    return all[lang] ?? {};
  } catch {
    return {};
  }
}

function saveOverrides(lang: string, overrides: Record<string, string>) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw
      ? (JSON.parse(raw) as Record<string, Record<string, string>>)
      : {};
    if (Object.keys(overrides).length === 0) {
      delete all[lang];
    } else {
      all[lang] = overrides;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // ignore storage errors
  }
}

const LANGUAGES = [
  { code: "de", name: "Deutsch" },
  { code: "fr", name: "Français" },
  { code: "es", name: "Español" },
  { code: "it", name: "Italiano" },
  { code: "zh", name: "中文" },
  { code: "th", name: "ไทย" },
  { code: "sv", name: "Svenska" },
];

export function TranslationEditor() {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language?.split("-")[0] ?? "en";

  const [editLang, setEditLang] = useState(() =>
    currentLang === "en" ? "de" : currentLang,
  );
  const [search, setSearch] = useState("");
  const [overrides, setOverrides] = useState<Record<string, string>>(() =>
    loadOverrides(editLang),
  );
  const [copied, setCopied] = useState(false);
  const [filterMode, setFilterMode] = useState<"all" | "missing" | "edited">(
    "all",
  );

  const enFlat = useMemo(
    () => flattenObject(en as Record<string, unknown>),
    [],
  );

  const currentTranslations = useMemo(() => {
    const bundle = i18n.getResourceBundle(editLang, "translation") as
      | Record<string, unknown>
      | undefined;
    return bundle ? flattenObject(bundle) : {};
  }, [editLang, i18n]);

  const entries: FlatEntry[] = useMemo(() => {
    const keys = Object.keys(enFlat);
    return keys.map((key) => ({
      key,
      section: key.split(".")[0],
      enValue: enFlat[key],
      currentValue: overrides[key] ?? currentTranslations[key] ?? "",
      isOverridden: key in overrides,
    }));
  }, [enFlat, currentTranslations, overrides]);

  const filteredEntries = useMemo(() => {
    let filtered = entries;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.key.toLowerCase().includes(q) ||
          e.enValue.toLowerCase().includes(q) ||
          e.currentValue.toLowerCase().includes(q),
      );
    }
    if (filterMode === "missing") {
      filtered = filtered.filter((e) => !e.currentValue);
    } else if (filterMode === "edited") {
      filtered = filtered.filter((e) => e.isOverridden);
    }
    return filtered;
  }, [entries, search, filterMode]);

  const sections = useMemo(
    () => [...new Set(filteredEntries.map((e) => e.section))],
    [filteredEntries],
  );

  const totalKeys = Object.keys(enFlat).length;
  const translatedKeys = entries.filter((e) => e.currentValue).length;
  const overriddenKeys = Object.keys(overrides).length;
  const progress = totalKeys > 0 ? (translatedKeys / totalKeys) * 100 : 0;

  useEffect(() => {
    setOverrides(loadOverrides(editLang));
  }, [editLang]);

  const applyOverrides = useCallback(
    (newOverrides: Record<string, string>) => {
      setOverrides(newOverrides);
      saveOverrides(editLang, newOverrides);

      const base = i18n.getResourceBundle(editLang, "translation") as
        | Record<string, unknown>
        | undefined;
      const baseFlat = base ? flattenObject(base) : {};

      const clean: Record<string, string> = {};
      for (const [k, v] of Object.entries(newOverrides)) {
        if (v && v !== baseFlat[k]) {
          clean[k] = v;
        }
      }

      if (Object.keys(clean).length > 0) {
        const nested = unflattenObject({ ...baseFlat, ...clean });
        i18n.addResourceBundle(editLang, "translation", nested, true, true);
      }
    },
    [editLang, i18n],
  );

  const handleChange = useCallback(
    (key: string, value: string) => {
      const next = { ...overrides, [key]: value };
      if (!value) {
        delete next[key];
      }
      applyOverrides(next);
    },
    [overrides, applyOverrides],
  );

  const handleResetKey = useCallback(
    (key: string) => {
      const next = { ...overrides };
      delete next[key];
      applyOverrides(next);
    },
    [overrides, applyOverrides],
  );

  const handleResetAll = useCallback(() => {
    applyOverrides({});
  }, [applyOverrides]);

  const handleExport = useCallback(() => {
    const merged: Record<string, string> = {};
    for (const key of Object.keys(enFlat)) {
      merged[key] = overrides[key] ?? currentTranslations[key] ?? "";
    }
    const nested = unflattenObject(merged);
    const json = JSON.stringify(nested, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${editLang}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [enFlat, currentTranslations, overrides, editLang]);

  const handleCopyJson = useCallback(() => {
    const merged: Record<string, string> = {};
    for (const key of Object.keys(enFlat)) {
      merged[key] = overrides[key] ?? currentTranslations[key] ?? "";
    }
    const nested = unflattenObject(merged);
    navigator.clipboard.writeText(JSON.stringify(nested, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [enFlat, currentTranslations, overrides]);

  return (
    <Box sx={{ p: 2 }}>
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        mb={2}
        flexWrap="wrap"
        gap={1}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <TranslateIcon />
          <Typography variant="h5">{t("translationEditor.title")}</Typography>
        </Box>
        <Box display="flex" alignItems="center" gap={1}>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>{t("translationEditor.editLanguage")}</InputLabel>
            <Select
              value={editLang}
              label={t("translationEditor.editLanguage")}
              onChange={(_e: { target: { value: string } }) =>
                setEditLang(_e.target.value)
              }
            >
              {LANGUAGES.map((l) => (
                <MenuItem key={l.code} value={l.code}>
                  {l.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        {t("translationEditor.info")}
      </Alert>

      <Box display="flex" alignItems="center" gap={2} mb={2} flexWrap="wrap">
        <Box sx={{ flexGrow: 1, minWidth: 200 }}>
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            mb={0.5}
          >
            <Typography variant="body2" color="text.secondary">
              {t("translationEditor.progress", {
                translated: translatedKeys,
                total: totalKeys,
              })}
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {Math.round(progress)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>
        {overriddenKeys > 0 && (
          <Chip
            label={t("translationEditor.localEdits", {
              count: overriddenKeys,
            })}
            color="primary"
            size="small"
          />
        )}
      </Box>

      <Box display="flex" gap={1} mb={2} flexWrap="wrap">
        <TextField
          size="small"
          placeholder={t("translationEditor.searchPlaceholder")}
          value={search}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setSearch(e.target.value)
          }
          sx={{ flexGrow: 1, minWidth: 200 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <Select
            value={filterMode}
            onChange={(_e: { target: { value: string } }) =>
              setFilterMode(_e.target.value as "all" | "missing" | "edited")
            }
          >
            <MenuItem value="all">{t("translationEditor.filterAll")}</MenuItem>
            <MenuItem value="missing">
              {t("translationEditor.filterMissing")}
            </MenuItem>
            <MenuItem value="edited">
              {t("translationEditor.filterEdited")}
            </MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Box display="flex" gap={1} mb={3}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<DownloadIcon />}
          onClick={handleExport}
        >
          {t("translationEditor.exportJson")}
        </Button>
        <Tooltip title={copied ? t("translationEditor.copied") : ""}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<ContentCopyIcon />}
            onClick={handleCopyJson}
          >
            {t("translationEditor.copyJson")}
          </Button>
        </Tooltip>
        {overriddenKeys > 0 && (
          <Button
            variant="outlined"
            size="small"
            color="warning"
            startIcon={<RestoreIcon />}
            onClick={handleResetAll}
          >
            {t("translationEditor.resetAll")}
          </Button>
        )}
      </Box>

      {sections.map((section) => (
        <Box key={section} sx={{ mb: 3 }}>
          <Typography
            variant="subtitle1"
            fontWeight={600}
            sx={{ mb: 1, textTransform: "capitalize" }}
          >
            {section}
          </Typography>
          <Divider sx={{ mb: 1.5 }} />
          {filteredEntries
            .filter((e) => e.section === section)
            .map((entry) => (
              <Box
                key={entry.key}
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "1fr 1fr auto" },
                  gap: 1,
                  mb: 1.5,
                  alignItems: "start",
                }}
              >
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontFamily: "monospace" }}
                  >
                    {entry.key}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.25 }}>
                    {entry.enValue}
                  </Typography>
                </Box>
                <TextField
                  size="small"
                  fullWidth
                  multiline={entry.enValue.length > 60}
                  minRows={1}
                  maxRows={4}
                  value={entry.currentValue}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    handleChange(entry.key, e.target.value)
                  }
                  placeholder={entry.enValue}
                  sx={{
                    "& .MuiOutlinedInput-root": entry.isOverridden
                      ? {
                          borderColor: "primary.main",
                          "& fieldset": {
                            borderColor: "primary.main",
                            borderWidth: 2,
                          },
                        }
                      : {},
                  }}
                />
                {entry.isOverridden && (
                  <Tooltip title={t("translationEditor.resetKey")}>
                    <IconButton
                      size="small"
                      onClick={() => handleResetKey(entry.key)}
                    >
                      <RestoreIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            ))}
        </Box>
      ))}

      {filteredEntries.length === 0 && (
        <Typography color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
          {t("translationEditor.noResults")}
        </Typography>
      )}
    </Box>
  );
}
