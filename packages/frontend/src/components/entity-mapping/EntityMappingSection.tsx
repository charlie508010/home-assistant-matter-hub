import type {
  EntityMappingConfig,
  EntityMappingResponse,
  MappingProfile,
  MappingProfileImportPreview,
} from "@home-assistant-matter-hub/common";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import EditIcon from "@mui/icons-material/Edit";
import SettingsIcon from "@mui/icons-material/Settings";
import UploadIcon from "@mui/icons-material/Upload";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteEntityMapping,
  fetchEntityMappings,
  updateEntityMapping,
} from "../../api/entity-mappings.js";
import {
  applyMappingProfileImport,
  exportMappingProfile,
  previewMappingProfileImport,
} from "../../api/mapping-profiles.js";
import { EntityMappingDialog } from "./EntityMappingDialog.js";

interface EntityMappingSectionProps {
  bridgeId: string;
}

export function EntityMappingSection({ bridgeId }: EntityMappingSectionProps) {
  const [mappings, setMappings] = useState<EntityMappingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<{
    entityId: string;
    domain: string;
    config?: EntityMappingConfig;
  } | null>(null);
  const [importPreview, setImportPreview] =
    useState<MappingProfileImportPreview | null>(null);
  const [importProfile, setImportProfile] = useState<MappingProfile | null>(
    null,
  );
  const [importSelected, setImportSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportSelected, setExportSelected] = useState<Set<string>>(new Set());
  const [exportProfileName, setExportProfileName] = useState("Bridge Mappings");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadMappings = useCallback(async () => {
    try {
      const data = await fetchEntityMappings(bridgeId);
      setMappings(data);
      setError(null);
    } catch {
      setError("Failed to load entity mappings");
    } finally {
      setLoading(false);
    }
  }, [bridgeId]);

  useEffect(() => {
    loadMappings();
  }, [loadMappings]);

  const handleAddMapping = useCallback(() => {
    setEditingEntity({ entityId: "", domain: "" });
    setDialogOpen(true);
  }, []);

  const handleEditMapping = useCallback(
    (entityId: string, config: EntityMappingConfig) => {
      const domain = entityId.split(".")[0] || "";
      setEditingEntity({ entityId, domain, config });
      setDialogOpen(true);
    },
    [],
  );

  const handleDeleteMapping = useCallback(
    async (entityId: string) => {
      try {
        await deleteEntityMapping(bridgeId, entityId);
        await loadMappings();
      } catch {
        setError("Failed to delete entity mapping");
      }
    },
    [bridgeId, loadMappings],
  );

  const handleSave = useCallback(
    async (config: Partial<EntityMappingConfig>) => {
      if (!config.entityId) return;
      try {
        await updateEntityMapping(bridgeId, config.entityId, config);
        setDialogOpen(false);
        setEditingEntity(null);
        await loadMappings();
      } catch {
        setError("Failed to save entity mapping");
      }
    },
    [bridgeId, loadMappings],
  );

  const handleClose = useCallback(() => {
    setDialogOpen(false);
    setEditingEntity(null);
  }, []);

  // mappings.mappings is an array of EntityMappingConfig, not an object
  const mappingsList = mappings?.mappings ?? [];

  const handleExportClick = useCallback(() => {
    const allIds = new Set(mappingsList.map((m) => m.entityId));
    setExportSelected(allIds);
    setExportProfileName("Bridge Mappings");
    setExportDialogOpen(true);
  }, [mappingsList]);

  const handleExportConfirm = useCallback(async () => {
    try {
      const entityIds = [...exportSelected];
      const profile = await exportMappingProfile(
        bridgeId,
        exportProfileName,
        entityIds,
      );
      const blob = new Blob([JSON.stringify(profile, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mapping-profile-${bridgeId.slice(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportDialogOpen(false);
    } catch {
      setError("Failed to export mapping profile");
    }
  }, [bridgeId, exportSelected, exportProfileName]);

  const handleExportCancel = useCallback(() => {
    setExportDialogOpen(false);
  }, []);

  const toggleExportEntity = useCallback((entityId: string) => {
    setExportSelected((prev) => {
      const next = new Set(prev);
      if (next.has(entityId)) {
        next.delete(entityId);
      } else {
        next.add(entityId);
      }
      return next;
    });
  }, []);

  const toggleExportAll = useCallback(() => {
    setExportSelected((prev) => {
      if (prev.size === mappingsList.length) {
        return new Set();
      }
      return new Set(mappingsList.map((m) => m.entityId));
    });
  }, [mappingsList]);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";

      try {
        const text = await file.text();
        const profile = JSON.parse(text) as MappingProfile;

        if (!profile.version || !profile.entries) {
          setError("Invalid mapping profile file");
          return;
        }

        const entityIds = (mappings?.mappings ?? []).map((m) => m.entityId);
        const preview = await previewMappingProfileImport(
          bridgeId,
          profile,
          entityIds,
        );

        setImportProfile(profile);
        setImportPreview(preview);
        setImportSelected(
          new Set(preview.matches.map((m) => m.matchedEntityId)),
        );
      } catch {
        setError("Failed to parse mapping profile file");
      }
    },
    [bridgeId, mappings],
  );

  const handleImportApply = useCallback(async () => {
    if (!importProfile) return;
    setImporting(true);
    try {
      const result = await applyMappingProfileImport(bridgeId, importProfile, [
        ...importSelected,
      ]);
      setImportPreview(null);
      setImportProfile(null);
      setImportSelected(new Set());
      setSuccessMsg(
        `Imported ${result.applied} mapping(s)${result.skipped > 0 ? `, ${result.skipped} skipped` : ""}${result.errors.length > 0 ? `, ${result.errors.length} error(s)` : ""}`,
      );
      await loadMappings();
    } catch {
      setError("Failed to apply mapping profile");
    } finally {
      setImporting(false);
    }
  }, [bridgeId, importProfile, importSelected, loadMappings]);

  const handleImportCancel = useCallback(() => {
    setImportPreview(null);
    setImportProfile(null);
    setImportSelected(new Set());
  }, []);

  const toggleImportEntity = useCallback((entityId: string) => {
    setImportSelected((prev) => {
      const next = new Set(prev);
      if (next.has(entityId)) {
        next.delete(entityId);
      } else {
        next.add(entityId);
      }
      return next;
    });
  }, []);

  return (
    <Card>
      <CardContent>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Typography variant="h6">
            <SettingsIcon sx={{ mr: 1, verticalAlign: "middle" }} />
            Entity Mappings
          </Typography>
          <Stack direction="row" spacing={1}>
            {mappingsList.length > 0 && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<DownloadIcon />}
                onClick={handleExportClick}
              >
                Export
              </Button>
            )}
            <Button
              variant="outlined"
              size="small"
              startIcon={<UploadIcon />}
              onClick={handleImportClick}
            >
              Import
            </Button>
            <Button variant="outlined" size="small" onClick={handleAddMapping}>
              Add Mapping
            </Button>
          </Stack>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: "none" }}
            onChange={handleFileSelected}
          />
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {successMsg && (
          <Alert
            severity="success"
            sx={{ mb: 2 }}
            icon={<CheckCircleIcon />}
            onClose={() => setSuccessMsg(null)}
          >
            {successMsg}
          </Alert>
        )}

        {loading && <Typography color="text.secondary">Loading...</Typography>}

        {!loading && mappingsList.length === 0 && (
          <Typography color="text.secondary">
            No custom entity mappings configured. Use mappings to override
            Matter device types, set custom names, or disable specific entities.
          </Typography>
        )}

        {!loading && mappingsList.length > 0 && (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Entity ID</TableCell>
                  <TableCell>Device Type</TableCell>
                  <TableCell>Custom Name</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {mappingsList.map((config) => (
                  <TableRow key={config.entityId}>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {config.entityId}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {config.matterDeviceType || (
                        <Typography color="text.secondary" variant="body2">
                          Auto
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {config.customName || (
                        <Typography color="text.secondary" variant="body2">
                          —
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {config.disabled ? (
                        <Chip label="Disabled" color="error" size="small" />
                      ) : (
                        <Chip label="Enabled" color="success" size="small" />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() =>
                          handleEditMapping(config.entityId, config)
                        }
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteMapping(config.entityId)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>

      {editingEntity && (
        <EntityMappingDialog
          open={dialogOpen}
          entityId={editingEntity.entityId}
          domain={editingEntity.domain}
          currentMapping={editingEntity.config}
          onSave={handleSave}
          onClose={handleClose}
        />
      )}

      <Dialog
        open={exportDialogOpen}
        onClose={handleExportCancel}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Export Mapping Profile</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Profile Name"
              size="small"
              fullWidth
              value={exportProfileName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setExportProfileName(e.target.value)
              }
            />
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={exportSelected.size === mappingsList.length}
                        indeterminate={
                          exportSelected.size > 0 &&
                          exportSelected.size < mappingsList.length
                        }
                        onChange={toggleExportAll}
                      />
                    </TableCell>
                    <TableCell>Entity ID</TableCell>
                    <TableCell>Device Type</TableCell>
                    <TableCell>Custom Name</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {mappingsList.map((config) => (
                    <TableRow key={config.entityId}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          size="small"
                          checked={exportSelected.has(config.entityId)}
                          onChange={() => toggleExportEntity(config.entityId)}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {config.entityId}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {config.matterDeviceType || (
                          <Typography color="text.secondary" variant="body2">
                            Auto
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {config.customName || (
                          <Typography color="text.secondary" variant="body2">
                            —
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleExportCancel}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleExportConfirm}
            disabled={exportSelected.size === 0}
            startIcon={<DownloadIcon />}
          >
            Export {exportSelected.size} Mapping(s)
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!importPreview}
        onClose={handleImportCancel}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Import Mapping Profile</DialogTitle>
        <DialogContent>
          {importPreview && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Profile: <strong>{importPreview.profileName}</strong> —{" "}
                {importPreview.totalEntries} entries,{" "}
                {importPreview.matches.length} matched
              </Typography>

              {importPreview.matches.length > 0 && (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox" />
                        <TableCell>Entity ID</TableCell>
                        <TableCell>Match</TableCell>
                        <TableCell>Device Type</TableCell>
                        <TableCell>Existing</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {importPreview.matches.map((match) => (
                        <TableRow key={match.matchedEntityId}>
                          <TableCell padding="checkbox">
                            <Checkbox
                              size="small"
                              checked={importSelected.has(
                                match.matchedEntityId,
                              )}
                              onChange={() =>
                                toggleImportEntity(match.matchedEntityId)
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontFamily="monospace">
                              {match.matchedEntityId}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={match.matchType}
                              size="small"
                              color={
                                match.matchType === "exact"
                                  ? "success"
                                  : "default"
                              }
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            {match.entry.matterDeviceType || "Auto"}
                          </TableCell>
                          <TableCell>
                            {match.existingMapping ? (
                              <Chip
                                label="Overwrite"
                                size="small"
                                color="warning"
                                variant="outlined"
                              />
                            ) : (
                              <Chip
                                label="New"
                                size="small"
                                color="info"
                                variant="outlined"
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {importPreview.unmatchedEntries.length > 0 && (
                <Alert severity="info">
                  {importPreview.unmatchedEntries.length} entries could not be
                  matched to entities on this bridge.
                </Alert>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleImportCancel}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleImportApply}
            disabled={importing || importSelected.size === 0}
          >
            {importing
              ? "Applying..."
              : `Apply ${importSelected.size} Mapping(s)`}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
