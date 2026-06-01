import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import ExtensionIcon from "@mui/icons-material/Extension";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import PowerIcon from "@mui/icons-material/Power";
import PowerOffIcon from "@mui/icons-material/PowerOff";
import RefreshIcon from "@mui/icons-material/Refresh";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SettingsIcon from "@mui/icons-material/Settings";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import { useTheme } from "@mui/material/styles";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useCallback, useEffect, useRef, useState } from "react";

interface PluginDevice {
  id: string;
  name: string;
  deviceType: string;
}

interface CircuitBreakerInfo {
  failures: number;
  disabled: boolean;
  lastError?: string;
  disabledAt?: number;
}

interface PluginUiTable {
  id?: string;
  title?: string;
  show?: boolean;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  emptyText?: string;
  columns: Array<{
    key: string;
    label: string;
    width?: string;
    type?: "text" | "chip" | "boolean" | "status";
  }>;
  rows: Array<Record<string, unknown>>;
}

interface PluginUiStatus {
  status?: string;
  statusText?: string;
  statusColor?: "success" | "warning" | "error" | "info";
  matchedDevices?: number;
  totalDevices?: number;
  hideConfigButton?: boolean;
  externalPopup?: boolean;
  externalPopupUrl?: string;
  externalPopupButtonText?: string;
  externalPopupMode?: "open" | "saveThenOpen";
  deviceList?: Array<{
    name?: string;
    serial?: string;
    deviceType?: string;
    deviceTypeLabel?: string;
    peer?: string;
    ip?: string;
    mac?: string;
    online?: boolean;
    source?: string;
  }>;
  tables?: PluginUiTable[];
  actions?: Array<{
    id: string;
    label: string;
    variant?: "text" | "contained" | "outlined";
    color?: "primary" | "error" | "warning" | "success";
    disabled?: boolean;
    tooltip?: string;
    confirmText?: string;
    refreshAfterAction?: boolean;
    externalPopupUrl?: string;
    externalPopupMode?: "open" | "saveThenOpen";
  }>;
}

interface PluginInfo {
  name: string;
  version: string;
  source: string;
  enabled: boolean;
  config: Record<string, unknown>;
  uiStatus?: PluginUiStatus;
  circuitBreaker?: CircuitBreakerInfo;
  devices: PluginDevice[];
}

interface BridgePlugins {
  bridgeId: string;
  bridgeName: string;
  plugins: PluginInfo[];
}

interface PluginConfigSchema {
  title: string;
  description?: string;
  externalPopup?: boolean;
  externalPopupUrl?: string;
  externalPopupButtonText?: string;
  properties: Record<
    string,
    {
      type: "string" | "number" | "boolean" | "select" | "secret";
      title: string;
      description?: string;
      default?: unknown;
      required?: boolean;
      options?: Array<{ label: string; value: string }>;
    }
  >;
}

interface InstalledPlugin {
  packageName: string;
  version: string;
  config: Record<string, unknown>;
  uiStatus?: PluginUiStatus;
  autoLoad: boolean;
  installedAt: number;
  path: string;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function pluginTablesFromStatus(status?: PluginUiStatus): PluginUiTable[] {
  const configuredTables = (status?.tables ?? []).filter(
    (table) => table.show !== false && table.columns.length > 0,
  );

  if (configuredTables.length > 0) {
    return configuredTables;
  }

  if (!status?.deviceList?.length) {
    return [];
  }

  return [
    {
      id: "deviceList",
      columns: [
        { key: "name", label: "Name", width: "minmax(150px, 1.2fr)" },
        { key: "serial", label: "Serial", width: "minmax(170px, 1.15fr)" },
        {
          key: "deviceTypeLabel",
          label: "Type",
          width: "minmax(130px, 0.9fr)",
        },
        { key: "peer", label: "Peer", width: "minmax(250px, 1.45fr)" },
        { key: "ip", label: "IP", width: "minmax(130px, 0.8fr)" },
        {
          key: "online",
          label: "Status",
          width: "minmax(100px, 0.7fr)",
          type: "status" as const,
        },
      ],
      rows: status.deviceList.map(
        (device): Record<string, unknown> => ({
          ...device,
          deviceTypeLabel: device.deviceTypeLabel ?? device.deviceType ?? "-",
          peer: device.peer ?? "not matched",
        }),
      ),
    },
  ];
}

function renderPluginTableCell(
  value: unknown,
  type?: "text" | "chip" | "boolean" | "status",
) {
  if (type === "status") {
    const online = value !== false && value !== "offline" && value !== "false";
    return (
      <Chip
        label={online ? "online" : "offline"}
        size="small"
        color={online ? "success" : "error"}
        variant="outlined"
      />
    );
  }

  if (type === "boolean") {
    return (
      <Chip
        label={value ? "yes" : "no"}
        size="small"
        color={value ? "success" : "default"}
        variant="outlined"
      />
    );
  }

  if (type === "chip") {
    return (
      <Chip label={String(value ?? "-")} size="small" variant="outlined" />
    );
  }

  const text =
    value === undefined || value === null || value === "" ? "-" : String(value);
  return (
    <Typography
      variant="body2"
      sx={{
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
      title={text}
    >
      {text}
    </Typography>
  );
}

export const PluginsPage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [bridgePlugins, setBridgePlugins] = useState<BridgePlugins[]>([]);
  const [configOpen, setConfigOpen] = useState(false);
  const [configBridgeId, setConfigBridgeId] = useState("");
  const [configPluginName, setConfigPluginName] = useState("");
  const [configSchema, setConfigSchema] = useState<PluginConfigSchema | null>(
    null,
  );
  const [configValues, setConfigValues] = useState<Record<string, unknown>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [installed, setInstalled] = useState<InstalledPlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [installOpen, setInstallOpen] = useState(false);
  const [installTab, setInstallTab] = useState(0);
  const [packageName, setPackageName] = useState("");
  const [localPath, setLocalPath] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [installing, setInstalling] = useState(false);
  const [restartPromptOpen, setRestartPromptOpen] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [collapsedTables, setCollapsedTables] = useState<
    Record<string, boolean>
  >({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const [plugins, inst] = await Promise.all([
        fetchJson<BridgePlugins[]>("api/plugins"),
        fetchJson<InstalledPlugin[]>("api/plugins/installed"),
      ]);
      setBridgePlugins(plugins);
      setInstalled(inst);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleInstall = async () => {
    if (!packageName.trim()) return;
    setInstalling(true);
    try {
      await fetchJson("api/plugins/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageName: packageName.trim() }),
      });
      setPackageName("");
      setInstallOpen(false);
      await refresh();
      setRestartPromptOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setInstalling(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setInstalling(true);
    try {
      const buf = await selectedFile.arrayBuffer();
      const res = await fetch("api/plugins/upload", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: buf,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ??
            `${res.status} ${res.statusText}`,
        );
      }
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setInstallOpen(false);
      await refresh();
      setRestartPromptOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setInstalling(false);
    }
  };

  const handleLocalInstall = async () => {
    if (!localPath.trim()) return;
    setInstalling(true);
    try {
      await fetchJson("api/plugins/install-local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: localPath.trim() }),
      });
      setLocalPath("");
      setInstallOpen(false);
      await refresh();
      setRestartPromptOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setInstalling(false);
    }
  };

  const handleRestartApplication = async () => {
    setRestarting(true);
    setRestartPromptOpen(false);
    try {
      await fetchJson("api/backup/restart", { method: "POST" });
      setError(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleUninstall = async (pkg: string) => {
    try {
      await fetchJson("api/plugins/uninstall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageName: pkg }),
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleConfigurePlugin = useCallback(
    async (bridgeId: string, plugin: PluginInfo) => {
      try {
        const response = await fetchJson<{ schema: PluginConfigSchema | null }>(
          `api/plugins/${bridgeId}/${plugin.name}/config-schema`,
        );

        const schema = response.schema;
        if (!schema) {
          throw new Error("Plugin has no config schema");
        }

        const values: Record<string, unknown> = {};

        for (const [key, prop] of Object.entries(schema.properties ?? {})) {
          values[key] = plugin.config?.[key] ?? prop.default ?? "";
        }

        setConfigBridgeId(bridgeId);
        setConfigPluginName(plugin.name);
        setConfigSchema(schema);
        setConfigValues(values);
        setConfigOpen(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [],
  );

  const handleSavePluginConfig = useCallback(async () => {
    try {
      await fetchJson(
        `api/plugins/${configBridgeId}/${configPluginName}/config`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config: configValues }),
        },
      );

      setConfigOpen(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [configBridgeId, configPluginName, configValues, refresh]);

  const handlePluginUiAction = async (
    bridgeId: string,
    pluginName: string,
    action: NonNullable<PluginUiStatus["actions"]>[number],
  ) => {
    try {
      if (action.confirmText && !window.confirm(action.confirmText)) {
        return;
      }

      await fetchJson(
        `api/plugins/${bridgeId}/${pluginName}/action/${action.id}`,
        { method: "POST" },
      );

      if (action.externalPopupUrl) {
        await new Promise((resolve) => setTimeout(resolve, 700));

        const popup = window.open(
          action.externalPopupUrl,
          "plugin-external-popup",
          "popup,width=900,height=900",
        );

        const timer = window.setInterval(async () => {
          if (!popup || popup.closed) {
            window.clearInterval(timer);
            await refresh();
          }
        }, 1000);
      }

      if (action.refreshAfterAction !== false) {
        await refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handlePluginAction = async (
    bridgeId: string,
    pluginName: string,
    action: "enable" | "disable" | "reset",
  ) => {
    try {
      await fetchJson(`api/plugins/${bridgeId}/${pluginName}/${action}`, {
        method: "POST",
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const renderPluginActions = (
    bridge: BridgePlugins,
    plugin: PluginInfo,
    mobile = false,
  ) => (
    <Stack
      direction="row"
      spacing={0.75}
      useFlexGap
      sx={{
        alignItems: "center",
        flexWrap: "wrap",
        justifyContent: "flex-start",
        width: mobile ? "100%" : "auto",
        maxWidth: "100%",
      }}
    >
      {plugin.uiStatus?.actions?.map((action) => (
        <Tooltip key={action.id} title={action.tooltip ?? ""}>
          <span style={{ flex: mobile ? "1 1 150px" : undefined }}>
            <Button
              size="small"
              variant={action.variant ?? "outlined"}
              color={action.color ?? "primary"}
              disabled={action.disabled}
              onClick={() =>
                handlePluginUiAction(bridge.bridgeId, plugin.name, action)
              }
              sx={{ width: mobile ? "100%" : "auto" }}
            >
              {action.label}
            </Button>
          </span>
        </Tooltip>
      ))}
      {plugin.circuitBreaker?.disabled && (
        <Tooltip title="Reset circuit breaker">
          {mobile ? (
            <Button
              size="small"
              variant="outlined"
              color="warning"
              startIcon={<RestartAltIcon />}
              onClick={() =>
                handlePluginAction(bridge.bridgeId, plugin.name, "reset")
              }
              sx={{ flex: { xs: "1 1 150px", sm: "0 0 auto" } }}
            >
              Reset
            </Button>
          ) : (
            <IconButton
              size="small"
              onClick={() =>
                handlePluginAction(bridge.bridgeId, plugin.name, "reset")
              }
            >
              <RestartAltIcon />
            </IconButton>
          )}
        </Tooltip>
      )}
    </Stack>
  );

  const renderPluginStatusChips = (plugin: PluginInfo) => (
    <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
      {plugin.source === "builtin" && <Chip label="built-in" size="small" />}
      {plugin.circuitBreaker?.disabled && (
        <Chip label="circuit breaker open" size="small" color="error" />
      )}
    </Stack>
  );

  const renderPluginControls = (bridge: BridgePlugins, plugin: PluginInfo) => (
    <Stack
      direction="row"
      spacing={0.75}
      useFlexGap
      sx={{
        alignItems: "center",
        flexWrap: "wrap",
        justifyContent: "flex-end",
      }}
    >
      {plugin.uiStatus?.statusText && (
        <Chip
          label={plugin.uiStatus.statusText}
          size="small"
          color={plugin.uiStatus.statusColor ?? "info"}
          sx={{ mr: 0.5 }}
        />
      )}
      <Tooltip title={plugin.enabled ? "Disable" : "Enable"}>
        <Button
          size="small"
          variant="outlined"
          color={plugin.enabled ? "warning" : "success"}
          startIcon={plugin.enabled ? <PowerOffIcon /> : <PowerIcon />}
          onClick={() =>
            handlePluginAction(
              bridge.bridgeId,
              plugin.name,
              plugin.enabled ? "disable" : "enable",
            )
          }
        >
          {plugin.enabled ? "Disable" : "Enable"}
        </Button>
      </Tooltip>
      {!plugin.uiStatus?.hideConfigButton && (
        <Tooltip title="Configure">
          <IconButton
            size="small"
            onClick={() => handleConfigurePlugin(bridge.bridgeId, plugin)}
          >
            <SettingsIcon />
          </IconButton>
        </Tooltip>
      )}
    </Stack>
  );

  const renderPluginTableToggles = (
    bridge: BridgePlugins,
    plugin: PluginInfo,
  ) =>
    pluginTablesFromStatus(plugin.uiStatus)
      .filter((table) => table.collapsible)
      .map((table) => {
        const tableKey = `${bridge.bridgeId}:${plugin.name}:${table.id ?? table.title ?? "table"}`;
        const collapsed =
          collapsedTables[tableKey] ?? Boolean(table.defaultCollapsed);

        return (
          <Button
            key={tableKey}
            size="small"
            variant="outlined"
            onClick={() =>
              setCollapsedTables((old) => ({
                ...old,
                [tableKey]: !collapsed,
              }))
            }
          >
            {collapsed ? "Show" : "Hide"}
          </Button>
        );
      });

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  const totalPlugins = bridgePlugins.reduce(
    (sum, b) => sum + b.plugins.length,
    0,
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3, p: 2 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Typography
          variant="h5"
          sx={{ display: "flex", alignItems: "center", gap: 1 }}
        >
          <ExtensionIcon /> Plugins
        </Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh">
            <IconButton onClick={refresh}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setInstallOpen(true)}
            size="small"
          >
            Install Plugin
          </Button>
        </Stack>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(undefined)}>
          {error}
        </Alert>
      )}

      {totalPlugins === 0 && installed.length === 0 && (
        <Alert severity="info">
          No plugins installed. Click &quot;Install Plugin&quot; to add an npm
          plugin package, or plugins will appear here when registered by the
          bridge.
        </Alert>
      )}

      {installed.length > 0 && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Installed Packages
            </Typography>
            <List dense>
              {installed.map((pkg) => (
                <ListItem
                  key={pkg.packageName}
                  secondaryAction={
                    <Tooltip title="Uninstall">
                      <IconButton
                        edge="end"
                        onClick={() => handleUninstall(pkg.packageName)}
                        color="error"
                        size="small"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  }
                >
                  <ListItemIcon>
                    <ExtensionIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={pkg.packageName}
                    secondary={`v${pkg.version}, installed ${new Date(pkg.installedAt).toLocaleDateString()}`}
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {bridgePlugins.map((bridge) => (
        <Card key={bridge.bridgeId} variant="outlined">
          <CardContent>
            {bridge.plugins.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No active plugins on this bridge.
              </Typography>
            ) : (
              <List dense>
                {bridge.plugins.map((plugin) => (
                  <Box key={plugin.name}>
                    <ListItem
                      sx={{
                        alignItems: "flex-start",
                        px: { xs: 0, md: 2 },
                        pr: { xs: 0, md: 26 },
                      }}
                      secondaryAction={
                        isMobile
                          ? undefined
                          : renderPluginControls(bridge, plugin)
                      }
                    >
                      <ListItemIcon>
                        <ExtensionIcon
                          color={plugin.enabled ? "primary" : "disabled"}
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Stack
                            direction="row"
                            spacing={0.75}
                            useFlexGap
                            sx={{
                              alignItems: "center",
                              flexWrap: "wrap",
                              minWidth: 0,
                            }}
                          >
                            <Typography
                              component="span"
                              variant="body1"
                              fontWeight={600}
                              sx={{
                                minWidth: 0,
                                maxWidth: "100%",
                                wordBreak: "break-word",
                                overflowWrap: "break-word",
                              }}
                            >
                              {plugin.name}
                            </Typography>
                            <Chip
                              label={`v${plugin.version}`}
                              size="small"
                              variant="outlined"
                            />
                          </Stack>
                        }
                        secondary={
                          plugin.devices.length > 0
                            ? `${plugin.devices.length} device(s)`
                            : plugin.uiStatus?.deviceList?.length
                              ? ""
                              : "No devices registered"
                        }
                      />
                    </ListItem>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: { xs: "flex-start", md: "flex-end" },
                        flexWrap: "wrap",
                        gap: 0.75,
                        pl: 7,
                        pr: { xs: 0, md: 2 },
                        pb: 1,
                      }}
                    >
                      {renderPluginStatusChips(plugin)}
                      {isMobile
                        ? renderPluginActions(bridge, plugin, true)
                        : renderPluginActions(bridge, plugin)}
                      {renderPluginTableToggles(bridge, plugin)}
                    </Box>
                    {pluginTablesFromStatus(plugin.uiStatus).map((table) => {
                      const gridTemplateColumns = table.columns
                        .map((column) => column.width ?? "minmax(120px, 1fr)")
                        .join(" ");
                      const tableKey = `${bridge.bridgeId}:${plugin.name}:${table.id ?? table.title ?? "table"}`;
                      const collapsed =
                        collapsedTables[tableKey] ??
                        Boolean(table.defaultCollapsed);
                      const rows = table.rows ?? [];

                      return (
                        <Box
                          key={table.id ?? table.title ?? "table"}
                          sx={{
                            pl: { xs: 0, md: 6 },
                            pr: { xs: 0, md: 2 },
                            pb: 1,
                          }}
                        >
                          {table.title && (
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                px: 1,
                                py: 0.75,
                              }}
                            >
                              <Typography variant="subtitle2">
                                {table.title}
                              </Typography>
                            </Box>
                          )}

                          <Collapse
                            in={!collapsed}
                            timeout="auto"
                            unmountOnExit
                          >
                            <Box
                              sx={{
                                display: { xs: "none", md: "grid" },
                                gridTemplateColumns,
                                gap: 1,
                                py: 0.75,
                                px: 1,
                                color: "text.secondary",
                                fontSize: 12,
                                borderBottom: "1px solid",
                                borderColor: "divider",
                              }}
                            >
                              {table.columns.map((column) => (
                                <Box key={column.key}>{column.label}</Box>
                              ))}
                            </Box>

                            {rows.length === 0 ? (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ px: 1, py: 1 }}
                              >
                                {table.emptyText ?? "No rows"}
                              </Typography>
                            ) : (
                              <>
                                <Box
                                  sx={{ display: { xs: "none", md: "block" } }}
                                >
                                  {rows.map((row, rowIndex) => (
                                    <Box
                                      key={`${table.id ?? "table"}-${rowIndex}`}
                                      sx={{
                                        display: "grid",
                                        gridTemplateColumns,
                                        gap: 1,
                                        py: 0.75,
                                        px: 1,
                                        alignItems: "center",
                                        borderBottom: "1px solid",
                                        borderColor: "divider",
                                      }}
                                    >
                                      {table.columns.map((column) => (
                                        <Box
                                          key={column.key}
                                          sx={{ minWidth: 0 }}
                                        >
                                          {renderPluginTableCell(
                                            row[column.key],
                                            column.type,
                                          )}
                                        </Box>
                                      ))}
                                    </Box>
                                  ))}
                                </Box>

                                <Stack
                                  spacing={1}
                                  sx={{ display: { xs: "flex", md: "none" } }}
                                >
                                  {rows.map((row, rowIndex) => {
                                    const titleColumn = table.columns[0];
                                    const statusColumn =
                                      table.columns.find(
                                        (column) => column.type === "status",
                                      ) ??
                                      table.columns.find(
                                        (column) => column.key === "online",
                                      );
                                    const detailColumns = table.columns.filter(
                                      (column) =>
                                        column.key !== titleColumn?.key &&
                                        column.key !== statusColumn?.key,
                                    );

                                    return (
                                      <Box
                                        key={`${table.id ?? "table"}-mobile-${rowIndex}`}
                                        sx={{
                                          border: "1px solid",
                                          borderColor: "divider",
                                          borderRadius: 1,
                                          p: 1,
                                          minWidth: 0,
                                        }}
                                      >
                                        <Box
                                          sx={{
                                            display: "flex",
                                            alignItems: "flex-start",
                                            justifyContent: "space-between",
                                            gap: 1,
                                            minWidth: 0,
                                          }}
                                        >
                                          <Box sx={{ minWidth: 0 }}>
                                            <Typography
                                              variant="body2"
                                              fontWeight={700}
                                              sx={{
                                                wordBreak: "break-word",
                                                overflowWrap: "break-word",
                                              }}
                                            >
                                              {String(
                                                row[
                                                  titleColumn?.key ?? "name"
                                                ] ?? "Unknown",
                                              )}
                                            </Typography>
                                          </Box>
                                          {statusColumn && (
                                            <Box sx={{ flexShrink: 0 }}>
                                              {renderPluginTableCell(
                                                row[statusColumn.key],
                                                statusColumn.type,
                                              )}
                                            </Box>
                                          )}
                                        </Box>

                                        <Stack spacing={0.25} sx={{ mt: 0.75 }}>
                                          {detailColumns.map((column) => (
                                            <Box
                                              key={column.key}
                                              sx={{
                                                display: "grid",
                                                gridTemplateColumns:
                                                  "72px minmax(0, 1fr)",
                                                gap: 1,
                                                minWidth: 0,
                                              }}
                                            >
                                              <Typography
                                                variant="caption"
                                                color="text.secondary"
                                              >
                                                {column.label}
                                              </Typography>
                                              <Box sx={{ minWidth: 0 }}>
                                                {renderPluginTableCell(
                                                  row[column.key],
                                                  column.type,
                                                )}
                                              </Box>
                                            </Box>
                                          ))}
                                        </Stack>
                                      </Box>
                                    );
                                  })}
                                </Stack>
                              </>
                            )}
                          </Collapse>
                        </Box>
                      );
                    })}
                    {plugin.circuitBreaker?.disabled &&
                      plugin.circuitBreaker.lastError && (
                        <Alert severity="error" sx={{ mx: 2, mb: 1 }}>
                          {plugin.circuitBreaker.lastError}
                        </Alert>
                      )}
                    {plugin.devices.length > 0 && (
                      <List dense sx={{ pl: 6 }}>
                        {plugin.devices.map((device) => (
                          <ListItem key={device.id}>
                            <ListItemText
                              primary={device.name}
                              secondary={`${device.deviceType}, ${device.id}`}
                            />
                          </ListItem>
                        ))}
                      </List>
                    )}
                    <Divider />
                  </Box>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      ))}

      <Dialog
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{configSchema?.title ?? "Plugin Config"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {configSchema &&
              Object.entries(configSchema?.properties ?? {}).map(
                ([key, prop]) => {
                  const value = configValues[key];

                  if (prop.type === "boolean") {
                    return (
                      <FormControlLabel
                        key={key}
                        control={
                          <Switch
                            checked={Boolean(value)}
                            onChange={(e) =>
                              setConfigValues((old) => ({
                                ...old,
                                [key]: e.target.checked,
                              }))
                            }
                          />
                        }
                        label={prop.title}
                      />
                    );
                  }

                  if (prop.type === "select") {
                    return (
                      <TextField
                        key={key}
                        select
                        fullWidth
                        label={prop.title}
                        helperText={prop.description}
                        value={String(value ?? "")}
                        onChange={(e) =>
                          setConfigValues((old) => ({
                            ...old,
                            [key]: e.target.value,
                          }))
                        }
                      >
                        {(prop.options ?? []).map((opt) => (
                          <MenuItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    );
                  }

                  return (
                    <TextField
                      key={key}
                      fullWidth
                      type={
                        prop.type === "number"
                          ? "number"
                          : prop.type === "secret" && !showSecrets[key]
                            ? "password"
                            : "text"
                      }
                      label={prop.title}
                      helperText={prop.description}
                      required={prop.required}
                      InputProps={
                        prop.type === "secret"
                          ? {
                              endAdornment: (
                                <InputAdornment position="end">
                                  <IconButton
                                    size="small"
                                    onClick={() =>
                                      setShowSecrets((old) => ({
                                        ...old,
                                        [key]: !old[key],
                                      }))
                                    }
                                  >
                                    {showSecrets[key] ? (
                                      <VisibilityOffIcon />
                                    ) : (
                                      <VisibilityIcon />
                                    )}
                                  </IconButton>
                                </InputAdornment>
                              ),
                            }
                          : undefined
                      }
                      value={String(value ?? "")}
                      onChange={(e) =>
                        setConfigValues((old) => ({
                          ...old,
                          [key]:
                            prop.type === "number"
                              ? Number(e.target.value)
                              : e.target.value,
                        }))
                      }
                    />
                  );
                },
              )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfigOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSavePluginConfig}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={installOpen}
        onClose={() => setInstallOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Install Plugin</DialogTitle>
        <DialogContent>
          <Tabs
            value={installTab}
            onChange={(_e, v: number) => setInstallTab(v)}
            sx={{ mb: 2 }}
          >
            <Tab label="npm" />
            <Tab label="Upload .tgz" />
            <Tab label="Local Path" />
          </Tabs>

          {installTab === 0 && (
            <>
              <TextField
                autoFocus
                margin="dense"
                label="npm package name"
                placeholder="e.g. hamh-plugin-example"
                fullWidth
                value={packageName}
                onChange={(e) => setPackageName(e.target.value)}
                disabled={installing}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleInstall();
                }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                The plugin will be installed via npm. After installation,
                restart the bridge to load the plugin.
              </Typography>
            </>
          )}

          {installTab === 1 && (
            <>
              <Button
                variant="outlined"
                component="label"
                startIcon={<UploadFileIcon />}
                fullWidth
                sx={{ mt: 1 }}
                disabled={installing}
              >
                {selectedFile ? selectedFile.name : "Choose .tgz file"}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".tgz,application/gzip"
                  hidden
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                />
              </Button>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Upload a packaged plugin (.tgz). Restart the bridge after
                installation.
              </Typography>
            </>
          )}

          {installTab === 2 && (
            <>
              <TextField
                autoFocus
                margin="dense"
                label="Absolute path to plugin folder"
                placeholder="/path/to/your/plugin"
                fullWidth
                value={localPath}
                onChange={(e) => setLocalPath(e.target.value)}
                disabled={installing}
                InputProps={{
                  startAdornment: <FolderOpenIcon sx={{ mr: 1 }} />,
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleLocalInstall();
                }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Link a local plugin directory (creates a symlink). Useful for
                development. Restart the bridge after linking.
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInstallOpen(false)} disabled={installing}>
            Cancel
          </Button>
          {installTab === 0 && (
            <Button
              onClick={handleInstall}
              variant="contained"
              disabled={installing || !packageName.trim()}
            >
              {installing ? <CircularProgress size={20} /> : "Install"}
            </Button>
          )}
          {installTab === 1 && (
            <Button
              onClick={handleUpload}
              variant="contained"
              disabled={installing || !selectedFile}
            >
              {installing ? <CircularProgress size={20} /> : "Upload"}
            </Button>
          )}
          {installTab === 2 && (
            <Button
              onClick={handleLocalInstall}
              variant="contained"
              disabled={installing || !localPath.trim()}
            >
              {installing ? <CircularProgress size={20} /> : "Link"}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog
        open={restartPromptOpen}
        onClose={() => setRestartPromptOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <RestartAltIcon />
          Neustart erforderlich
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Das Plugin wurde installiert. HAMH jetzt neu starten, damit das
            Plugin geladen wird?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setRestartPromptOpen(false)}
            disabled={restarting}
          >
            Später
          </Button>
          <Button
            variant="contained"
            onClick={handleRestartApplication}
            disabled={restarting}
            startIcon={
              restarting ? <CircularProgress size={18} /> : <RestartAltIcon />
            }
          >
            Jetzt neu starten
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
