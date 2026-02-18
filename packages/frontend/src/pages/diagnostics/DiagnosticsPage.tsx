import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ClearAllIcon from "@mui/icons-material/ClearAll";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import MemoryIcon from "@mui/icons-material/Memory";
import SpeedIcon from "@mui/icons-material/Speed";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useDiagnostics } from "../../hooks/useDiagnostics.ts";

const eventTypeColors: Record<string, string> = {
  state_update: "#4caf50",
  command_received: "#2196f3",
  entity_error: "#f44336",
  session_opened: "#ff9800",
  session_closed: "#9e9e9e",
  subscription_changed: "#9c27b0",
  bridge_started: "#00bcd4",
  bridge_stopped: "#795548",
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function DiagnosticsPage() {
  const { events, snapshot, connected, clearEvents } = useDiagnostics();

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography variant="h5" fontWeight={600}>
            Live Diagnostics
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              icon={
                <FiberManualRecordIcon
                  sx={{
                    fontSize: 12,
                    color: connected ? "#4caf50" : "#f44336",
                  }}
                />
              }
              label={connected ? "Connected" : "Disconnected"}
              size="small"
              variant="outlined"
            />
            {snapshot?.system && (
              <>
                <Chip
                  icon={<AccessTimeIcon sx={{ fontSize: 16 }} />}
                  label={formatUptime(snapshot.system.uptime)}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  icon={<MemoryIcon sx={{ fontSize: 16 }} />}
                  label={`${snapshot.system.memoryMB} MB`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  icon={<SpeedIcon sx={{ fontSize: 16 }} />}
                  label={`${snapshot.system.eventCount} events`}
                  size="small"
                  variant="outlined"
                />
              </>
            )}
          </Stack>
        </Box>

        {/* Bridge Overview */}
        {snapshot?.bridges && snapshot.bridges.length > 0 && (
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
              Bridges
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Devices</TableCell>
                    <TableCell align="right">Sessions</TableCell>
                    <TableCell>Feature Flags</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {snapshot.bridges.map((bridge) => (
                    <TableRow key={bridge.bridgeId}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {bridge.bridgeName}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ fontFamily: "monospace" }}
                        >
                          {bridge.bridgeId.substring(0, 8)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={bridge.status}
                          size="small"
                          color={
                            bridge.status === "running"
                              ? "success"
                              : bridge.status === "failed"
                                ? "error"
                                : "default"
                          }
                        />
                      </TableCell>
                      <TableCell align="right">{bridge.entityCount}</TableCell>
                      <TableCell align="right">{bridge.sessionCount}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap">
                          {Object.entries(bridge.featureFlags)
                            .filter(([, v]) => v)
                            .map(([k]) => (
                              <Chip
                                key={k}
                                label={k}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: "0.7rem", height: 20 }}
                              />
                            ))}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        {/* Live Event Log */}
        <Paper sx={{ p: 2 }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 1,
            }}
          >
            <Typography variant="subtitle1" fontWeight={600}>
              Live Event Log ({events.length})
            </Typography>
            <Tooltip title="Clear events">
              <IconButton size="small" onClick={clearEvents}>
                <ClearAllIcon />
              </IconButton>
            </Tooltip>
          </Box>

          <Box
            sx={{
              maxHeight: 500,
              overflow: "auto",
              bgcolor: "background.default",
              borderRadius: 1,
              p: 1,
              fontFamily: "monospace",
              fontSize: "0.8rem",
            }}
          >
            {events.length === 0 ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ textAlign: "center", py: 4 }}
              >
                Waiting for events... Events will appear here in real-time.
              </Typography>
            ) : (
              events.map((event) => (
                <Box
                  key={event.id}
                  sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 1,
                    py: 0.3,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    "&:last-child": { borderBottom: "none" },
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                      whiteSpace: "nowrap",
                      fontFamily: "monospace",
                      minWidth: 90,
                    }}
                  >
                    {formatTime(event.timestamp)}
                  </Typography>
                  <Chip
                    label={event.type}
                    size="small"
                    sx={{
                      bgcolor: eventTypeColors[event.type] ?? "#757575",
                      color: "#fff",
                      fontSize: "0.65rem",
                      height: 18,
                      minWidth: 110,
                    }}
                  />
                  {event.bridgeName && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: "primary.main",
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                      }}
                    >
                      [{event.bridgeName}]
                    </Typography>
                  )}
                  {event.entityId && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: "warning.main",
                        fontFamily: "monospace",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {event.entityId}
                    </Typography>
                  )}
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.primary",
                      flex: 1,
                      wordBreak: "break-word",
                    }}
                  >
                    {event.message}
                  </Typography>
                </Box>
              ))
            )}
            <div />
          </Box>
        </Paper>
      </Stack>
    </Container>
  );
}
