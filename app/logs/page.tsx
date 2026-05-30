'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Stack,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Drawer,
  CircularProgress,
  Divider,
  Alert,
  Button,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import TimelineIcon from '@mui/icons-material/Timeline';
import SpeedIcon from '@mui/icons-material/Speed';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import DashboardLayout from '@/components/DashboardLayout';

interface CorrectionLog {
  id: string;
  createdAt: string;
  className: string;
  examTitle: string;
  studentName: string;
  modelUsed: string;
  durationMs: number | null;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  actionType: 'ERSTELLT' | 'ERSETZT' | 'NEUSTART';
  errorMessage: string | null;
}

export default function LogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<CorrectionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [actionFilter, setActionFilter] = useState('ALL');

  // Details Drawer state
  const [selectedLog, setSelectedLog] = useState<CorrectionLog | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleResetFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setActionFilter('ALL');
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/logs');
      if (!res.ok) {
        throw new Error('Protokolle konnten nicht geladen werden.');
      }
      const data = await res.json();
      setLogs(data.logs);
    } catch (err) {
      console.error('Error fetching logs:', err);
      setError(err instanceof Error ? err.message : 'Verbindungsfehler.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchLogs();
    });
  }, []);

  const handleOpenDrawer = (log: CorrectionLog) => {
    setSelectedLog(log);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedLog(null);
  };

  // Filter calculations
  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.className.toLowerCase().includes(search.toLowerCase()) ||
      log.examTitle.toLowerCase().includes(search.toLowerCase()) ||
      log.studentName.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || log.status === statusFilter;

    const matchesAction = actionFilter === 'ALL' || log.actionType === actionFilter;

    return matchesSearch && matchesStatus && matchesAction;
  });

  // Stats Calculations
  const completedLogs = logs.filter((l) => l.status === 'COMPLETED');
  const failedLogs = logs.filter((l) => l.status === 'FAILED');

  const averageDuration =
    completedLogs.length > 0
      ? completedLogs.reduce((sum, l) => sum + (l.durationMs || 0), 0) / completedLogs.length / 1000
      : 0;

  const successRate =
    completedLogs.length + failedLogs.length > 0
      ? (completedLogs.length / (completedLogs.length + failedLogs.length)) * 100
      : 0;

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <Chip
            label="Erfolgreich"
            size="small"
            icon={<CheckCircleOutlinedIcon style={{ color: '#16a34a' }} />}
            sx={{
              backgroundColor: '#dcfce7',
              color: '#15803d',
              fontWeight: 700,
              fontSize: '0.75rem',
              '& .MuiChip-icon': { marginLeft: '4px' },
            }}
          />
        );
      case 'FAILED':
        return (
          <Chip
            label="Fehlgeschlagen"
            size="small"
            icon={<ErrorOutlinedIcon style={{ color: '#dc2626' }} />}
            sx={{
              backgroundColor: '#fee2e2',
              color: '#b91c1c',
              fontWeight: 700,
              fontSize: '0.75rem',
              '& .MuiChip-icon': { marginLeft: '4px' },
            }}
          />
        );
      case 'CANCELLED':
        return (
          <Chip
            label="Abgebrochen"
            size="small"
            icon={<CancelOutlinedIcon style={{ color: '#4b5563' }} />}
            sx={{
              backgroundColor: '#f3f4f6',
              color: '#374151',
              fontWeight: 700,
              fontSize: '0.75rem',
              '& .MuiChip-icon': { marginLeft: '4px' },
            }}
          />
        );
      case 'PROCESSING':
        return (
          <Chip
            label="Analysiert..."
            size="small"
            icon={<CircularProgress size={12} thickness={5} style={{ color: '#0284c7' }} />}
            sx={{
              backgroundColor: '#e0f2fe',
              color: '#0369a1',
              fontWeight: 700,
              fontSize: '0.75rem',
              '& .MuiChip-icon': { marginLeft: '6px', marginRight: '-2px' },
            }}
          />
        );
      default:
        return (
          <Chip
            label="Wartend"
            size="small"
            icon={<HourglassEmptyIcon style={{ color: '#d97706' }} />}
            sx={{
              backgroundColor: '#fef3c7',
              color: '#92400e',
              fontWeight: 700,
              fontSize: '0.75rem',
              '& .MuiChip-icon': { marginLeft: '4px' },
            }}
          />
        );
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'ERSETZT':
        return 'Korrektur überschrieben';
      case 'NEUSTART':
        return 'Fehlgeschlagene ersetzt';
      default:
        return 'Neue Korrektur';
    }
  };

  return (
    <DashboardLayout>
      <Box sx={{ width: '100%' }}>
        {/* Page Header */}
        <Stack
          direction="row"
          sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 4 }}
        >
          <Box sx={{ textAlign: 'left' }}>
            <Typography
              variant="h4"
              sx={{ fontWeight: 900, color: '#0f172a', letterSpacing: '-0.03em' }}
            >
              Korrektur-Protokoll
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              Lückenlose Audit-Protokolle aller KI-Korrekturprozesse deines Lehrer-Kontos.
            </Typography>
          </Box>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: '8px' }}>
            {error}
          </Alert>
        )}

        {/* Highlight Stats summary */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card
              elevation={0}
              sx={{
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.015)',
              }}
            >
              <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                <Stack direction="row" spacing={2.5} sx={{ alignItems: 'center' }}>
                  <Box
                    sx={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '12px',
                      backgroundColor: '#f0fdf4',
                      color: '#15803d',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <CheckCircleIcon sx={{ fontSize: '1.6rem' }} />
                  </Box>
                  <Box sx={{ textAlign: 'left' }}>
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.secondary', fontWeight: 600, display: 'block' }}
                    >
                      Erfolgsquote
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 850, color: '#15803d', mt: 0.2 }}>
                      {loading ? '...' : `${successRate.toFixed(0)}%`}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <Card
              elevation={0}
              sx={{
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.015)',
              }}
            >
              <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                <Stack direction="row" spacing={2.5} sx={{ alignItems: 'center' }}>
                  <Box
                    sx={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '12px',
                      backgroundColor: '#f0f9ff',
                      color: '#0369a1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <SpeedIcon sx={{ fontSize: '1.6rem' }} />
                  </Box>
                  <Box sx={{ textAlign: 'left' }}>
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.secondary', fontWeight: 600, display: 'block' }}
                    >
                      Korrekturzeit (Ø)
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 850, color: '#0369a1', mt: 0.2 }}>
                      {loading ? '...' : `${averageDuration.toFixed(1)}s`}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <Card
              elevation={0}
              sx={{
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.015)',
              }}
            >
              <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                <Stack direction="row" spacing={2.5} sx={{ alignItems: 'center' }}>
                  <Box
                    sx={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '12px',
                      backgroundColor: '#f8fafc',
                      color: '#475569',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ReceiptLongIcon sx={{ fontSize: '1.6rem' }} />
                  </Box>
                  <Box sx={{ textAlign: 'left' }}>
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.secondary', fontWeight: 600, display: 'block' }}
                    >
                      Prozesse total
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 850, color: '#0f172a', mt: 0.2 }}>
                      {loading ? '...' : logs.length}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filter and Search Section */}
        <Card
          elevation={0}
          sx={{
            borderRadius: '16px',
            border: '1px solid #cbd5e1',
            backgroundColor: '#ffffff',
            padding: '16px 20px',
            mb: 3.5,
          }}
        >
          <Grid container spacing={2} sx={{ alignItems: 'center' }}>
            <Grid size={{ xs: 12, md: 5 }}>
              <TextField
                placeholder="Nach Schüler/in, Prüfung oder Klasse filtern..."
                size="small"
                fullWidth
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />,
                  },
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '8px',
                  },
                }}
              />
            </Grid>

            <Grid size={{ xs: 6, md: 3.5 }}>
              <FormControl size="small" fullWidth>
                <InputLabel id="status-filter-label">Status</InputLabel>
                <Select
                  labelId="status-filter-label"
                  label="Status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  sx={{ borderRadius: '8px', textAlign: 'left' }}
                >
                  <MenuItem value="ALL">Alle Status</MenuItem>
                  <MenuItem value="COMPLETED">Erfolgreich</MenuItem>
                  <MenuItem value="FAILED">Fehlgeschlagen</MenuItem>
                  <MenuItem value="CANCELLED">Abgebrochen</MenuItem>
                  <MenuItem value="PROCESSING">Korrektur läuft</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 6, md: 3.5 }}>
              <FormControl size="small" fullWidth>
                <InputLabel id="action-filter-label">Aktionstyp</InputLabel>
                <Select
                  labelId="action-filter-label"
                  label="Aktionstyp"
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  sx={{ borderRadius: '8px', textAlign: 'left' }}
                >
                  <MenuItem value="ALL">Alle Typen</MenuItem>
                  <MenuItem value="ERSTELLT">Neue Korrekturen</MenuItem>
                  <MenuItem value="ERSETZT">Korrekturen überschrieben</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Card>

        {/* Data List table */}
        <TableContainer
          component={Paper}
          elevation={0}
          sx={{
            borderRadius: '16px',
            border: '1px solid #cbd5e1',
            backgroundColor: '#ffffff',
            boxShadow: '0 4px 12px rgba(15, 23, 42, 0.015)',
            overflow: 'hidden',
          }}
        >
          {loading ? (
            <Box sx={{ py: 8, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress size={30} thickness={4} />
            </Box>
          ) : logs.length === 0 ? (
            <Box
              sx={{
                py: 10,
                px: 3,
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#ffffff',
                transition: 'all 0.3s ease',
                '&:hover .icon-container': {
                  transform: 'scale(1.08) rotate(2deg)',
                  backgroundColor: '#e2e8f0',
                },
              }}
            >
              <Box
                className="icon-container"
                sx={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 3,
                  transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)',
                }}
              >
                <ReceiptLongIcon sx={{ fontSize: '3rem' }} />
              </Box>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 800,
                  color: '#0f172a',
                  mb: 1.5,
                  letterSpacing: '-0.01em',
                }}
              >
                Noch keine Protokolleinträge vorhanden
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: '#64748b',
                  maxWidth: '460px',
                  lineHeight: 1.6,
                  mb: 4,
                }}
              >
                Sobald Korrekturen für deine Klassen durchgeführt, überschrieben oder abgebrochen
                werden, erscheinen die Protokolle hier in Echtzeit.
              </Typography>
              <Button
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                onClick={() => router.push('/dashboard')}
                sx={{
                  borderRadius: '12px',
                  px: 4,
                  py: 1.4,
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  boxShadow: '0 4px 14px rgba(15, 23, 42, 0.1)',
                  '&:hover': {
                    backgroundColor: '#1e293b',
                    boxShadow: '0 6px 20px rgba(15, 23, 42, 0.15)',
                    transform: 'translateY(-1px)',
                  },
                  transition: 'all 0.2s ease',
                }}
              >
                Korrektur starten
              </Button>
            </Box>
          ) : filteredLogs.length === 0 ? (
            <Box
              sx={{
                py: 10,
                px: 3,
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#ffffff',
                transition: 'all 0.3s ease',
                '&:hover .icon-container': {
                  transform: 'scale(1.08)',
                  backgroundColor: '#fffbeb',
                },
              }}
            >
              <Box
                className="icon-container"
                sx={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  backgroundColor: '#fffbeb',
                  color: '#d97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 3,
                  transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  boxShadow: '0 4px 20px rgba(217, 119, 6, 0.03)',
                }}
              >
                <FilterAltOffIcon sx={{ fontSize: '3rem' }} />
              </Box>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 800,
                  color: '#0f172a',
                  mb: 1.5,
                  letterSpacing: '-0.01em',
                }}
              >
                Keine passenden Protokolleinträge gefunden
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: '#64748b',
                  maxWidth: '460px',
                  lineHeight: 1.6,
                  mb: 4,
                }}
              >
                Es wurden keine Einträge gefunden, die deiner Suche oder deinen ausgewählten Filtern
                entsprechen.
              </Typography>
              <Button
                variant="outlined"
                onClick={handleResetFilters}
                sx={{
                  borderRadius: '12px',
                  px: 4,
                  py: 1.4,
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  borderColor: '#cbd5e1',
                  color: '#475569',
                  borderWidth: '1.5px',
                  '&:hover': {
                    borderColor: '#94a3b8',
                    backgroundColor: '#f8fafc',
                    borderWidth: '1.5px',
                    transform: 'translateY(-1px)',
                  },
                  transition: 'all 0.2s ease',
                }}
              >
                Filter zurücksetzen
              </Button>
            </Box>
          ) : (
            <Table>
              <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800, color: '#475569', fontSize: '0.85rem' }}>
                    Zeitstempel
                  </TableCell>
                  <TableCell sx={{ fontWeight: 800, color: '#475569', fontSize: '0.85rem' }}>
                    Schüler/in
                  </TableCell>
                  <TableCell sx={{ fontWeight: 800, color: '#475569', fontSize: '0.85rem' }}>
                    Prüfung / Klasse
                  </TableCell>
                  <TableCell sx={{ fontWeight: 800, color: '#475569', fontSize: '0.85rem' }}>
                    Aktionstyp
                  </TableCell>
                  <TableCell sx={{ fontWeight: 800, color: '#475569', fontSize: '0.85rem' }}>
                    Modell
                  </TableCell>
                  <TableCell sx={{ fontWeight: 800, color: '#475569', fontSize: '0.85rem' }}>
                    Dauer
                  </TableCell>
                  <TableCell sx={{ fontWeight: 800, color: '#475569', fontSize: '0.85rem' }}>
                    Status
                  </TableCell>
                  <TableCell sx={{ width: '60px' }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow
                    key={log.id}
                    hover
                    sx={{
                      '&:last-child td, &:last-child th': { border: 0 },
                      cursor: 'pointer',
                    }}
                    onClick={() => handleOpenDrawer(log)}
                  >
                    <TableCell sx={{ color: '#0f172a', fontSize: '0.875rem' }}>
                      {new Date(log.createdAt).toLocaleString('de-CH', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#1e293b', fontSize: '0.875rem' }}>
                      {log.studentName === 'Automatische Zuordnung' ? (
                        <Box component="span" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                          🤖 Auto-Match
                        </Box>
                      ) : (
                        log.studentName
                      )}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.875rem', color: '#1e293b' }}>
                      <Typography variant="body2" sx={{ fontWeight: 650, color: '#0f172a' }}>
                        {log.examTitle}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {log.className}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ color: '#475569', fontSize: '0.825rem', fontWeight: 600 }}>
                      {getActionLabel(log.actionType)}
                    </TableCell>
                    <TableCell
                      sx={{ color: '#475569', fontSize: '0.825rem', fontFamily: 'monospace' }}
                    >
                      {log.modelUsed}
                    </TableCell>
                    <TableCell sx={{ color: '#475569', fontSize: '0.85rem', fontWeight: 600 }}>
                      {log.durationMs ? `${(log.durationMs / 1000).toFixed(1)}s` : '—'}
                    </TableCell>
                    <TableCell>{getStatusChip(log.status)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <IconButton size="small" onClick={() => handleOpenDrawer(log)}>
                        <InfoOutlinedIcon sx={{ color: '#64748b', fontSize: '1.25rem' }} />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TableContainer>
      </Box>

      {/* Slide-out details drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={handleCloseDrawer}
        slotProps={{
          paper: {
            sx: { width: { xs: '100%', sm: 460 }, borderLeft: '1px solid #cbd5e1' },
          },
        }}
      >
        {selectedLog && (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Drawer Header */}
            <Box
              sx={{
                p: '20px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#f8fafc',
                borderBottom: '1px solid #cbd5e1',
              }}
            >
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <TimelineIcon sx={{ color: '#1b77d1' }} />
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                  Protokolldetails
                </Typography>
              </Stack>
              <IconButton onClick={handleCloseDrawer} size="small">
                <CloseIcon />
              </IconButton>
            </Box>

            {/* Drawer Scrollable Content */}
            <Box sx={{ p: 3, overflowY: 'auto', flexGrow: 1, textAlign: 'left' }}>
              {/* Event Context Card */}
              <Card
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: '12px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  mb: 3.5,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ color: 'text.secondary', fontWeight: 700, display: 'block', mb: 1 }}
                >
                  KONTEXT
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5 }}>
                  {selectedLog.examTitle}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: 'text.secondary', fontWeight: 600, mb: 1.5 }}
                >
                  {selectedLog.className}
                </Typography>

                <Divider sx={{ my: 1.5, borderColor: '#cbd5e1' }} />

                <Grid container spacing={2}>
                  <Grid size={{ xs: 6 }}>
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.secondary', display: 'block' }}
                    >
                      Schüler/in
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#1e293b' }}>
                      {selectedLog.studentName}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.secondary', display: 'block' }}
                    >
                      Aktionstyp
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#1e293b' }}>
                      {getActionLabel(selectedLog.actionType)}
                    </Typography>
                  </Grid>
                </Grid>
              </Card>

              {/* Status and Milestones Timeline */}
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', fontWeight: 700, display: 'block', mb: 2 }}
              >
                AUSFÜHRUNGS-ZEITLINIE
              </Typography>

              <Box sx={{ pl: 2, mb: 4.5 }}>
                {/* Milestone 1: Erstellt */}
                <Box
                  sx={{
                    position: 'relative',
                    pl: 3.5,
                    pb: 3,
                    borderLeft: '2px solid #e2e8f0',
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      left: '-8px',
                      top: '0px',
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      backgroundColor: '#1b77d1',
                      border: '2px solid #ffffff',
                    }}
                  />
                  <Typography variant="body2" sx={{ fontWeight: 750, color: '#1e293b' }}>
                    Hochgeladen & in die Warteschlange gestellt
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {new Date(selectedLog.createdAt).toLocaleString('de-CH')}
                  </Typography>
                </Box>

                {/* Milestone 2: Processing */}
                {(selectedLog.status === 'PROCESSING' ||
                  selectedLog.status === 'COMPLETED' ||
                  selectedLog.status === 'FAILED' ||
                  selectedLog.status === 'CANCELLED') && (
                  <Box
                    sx={{
                      position: 'relative',
                      pl: 3.5,
                      pb: 3,
                      borderLeft:
                        selectedLog.status !== 'PROCESSING'
                          ? '2px solid #e2e8f0'
                          : '2px dashed #cbd5e1',
                    }}
                  >
                    <Box
                      sx={{
                        position: 'absolute',
                        left: '-8px',
                        top: '0px',
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        backgroundColor: '#0284c7',
                        border: '2px solid #ffffff',
                      }}
                    />
                    <Typography variant="body2" sx={{ fontWeight: 750, color: '#1e293b' }}>
                      KI-Analyse & OCR Verarbeitung
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.secondary', display: 'block' }}
                    >
                      Modell: {selectedLog.modelUsed}
                    </Typography>
                  </Box>
                )}

                {/* Milestone 3: End Status */}
                <Box sx={{ position: 'relative', pl: 3.5 }}>
                  <Box
                    sx={{
                      position: 'absolute',
                      left: '-8px',
                      top: '0px',
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      backgroundColor:
                        selectedLog.status === 'COMPLETED'
                          ? '#16a34a'
                          : selectedLog.status === 'FAILED'
                            ? '#dc2626'
                            : selectedLog.status === 'CANCELLED'
                              ? '#4b5563'
                              : '#94a3b8',
                      border: '2px solid #ffffff',
                    }}
                  />
                  <Typography variant="body2" sx={{ fontWeight: 750, color: '#1e293b' }}>
                    {selectedLog.status === 'COMPLETED' && 'Erfolgreich abgeschlossen'}
                    {selectedLog.status === 'FAILED' && 'Korrektur fehlgeschlagen'}
                    {selectedLog.status === 'CANCELLED' && 'Korrektur abgebrochen'}
                    {(selectedLog.status === 'PENDING' || selectedLog.status === 'PROCESSING') &&
                      'Warte auf Resultate...'}
                  </Typography>

                  {selectedLog.durationMs && (
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.secondary', display: 'block' }}
                    >
                      Gesamtdauer: {(selectedLog.durationMs / 1000).toFixed(1)}s
                    </Typography>
                  )}
                </Box>
              </Box>

              {/* Technical error block if failed */}
              {selectedLog.status === 'FAILED' && selectedLog.errorMessage && (
                <Box sx={{ mt: 2 }}>
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary', fontWeight: 700, display: 'block', mb: 1.5 }}
                  >
                    FEHLERMELDUNG (DIAGNOSE-LOGS)
                  </Typography>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: '10px',
                      backgroundColor: '#fef2f2',
                      borderColor: '#fca5a5',
                      color: '#991b1b',
                      fontSize: '0.85rem',
                      fontFamily: 'monospace',
                      overflowX: 'auto',
                      whiteSpace: 'pre-wrap',
                      textAlign: 'left',
                    }}
                  >
                    {selectedLog.errorMessage}
                  </Paper>
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Drawer>
    </DashboardLayout>
  );
}
