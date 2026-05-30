'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  CircularProgress,
  Alert,
  Divider,
  Chip,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AssessmentIcon from '@mui/icons-material/Assessment';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import StarsIcon from '@mui/icons-material/Stars';
import SchoolIcon from '@mui/icons-material/School';
import AssignmentIcon from '@mui/icons-material/Assignment';
import SaveIcon from '@mui/icons-material/Save';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { BarChart } from '@mui/x-charts/BarChart';
import DashboardLayout from '@/components/DashboardLayout';

interface ExamData {
  id: string;
  title: string;
  classId: string;
  className: string;
  subject: string;
  maxPoints: number;
  rubricText?: string;
}

interface ExamStats {
  averageGrade: string;
  passRate: string;
  highestGrade: string;
  lowestGrade: string;
  stdDev: string;
  totalCompleted: number;
  gradeDistribution: Record<string, number>;
}

interface ExamRosterStudent {
  studentId: string;
  studentName: string;
  status: 'COMPLETED' | 'DRAFT' | 'UNSTARTED';
  earnedPoints: number | string;
  grade: string;
  date: string;
  submissionId?: string;
}

export default function ExamDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const examId = params.id as string;

  // Data States
  const [exam, setExam] = useState<ExamData | null>(null);
  const [stats, setStats] = useState<ExamStats | null>(null);
  const [roster, setRoster] = useState<ExamRosterStudent[]>([]);

  // Loading & Error States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Rubric Editing
  const [rubricText, setRubricText] = useState('');
  const [editingRubric, setEditingRubric] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');

  const handleRubricFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadedFileName(file.name);

      const reader = new FileReader();
      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          if (dataUrl) {
            const base64Data = dataUrl.split(',')[1];
            setRubricText(
              JSON.stringify({
                mimeType: file.type,
                data: base64Data,
              })
            );
          }
        };
        reader.readAsDataURL(file);
      } else {
        reader.onload = (event) => {
          const text = event.target?.result as string;
          if (text) {
            setRubricText(text);
          }
        };
        reader.readAsText(file);
      }
    }
  };

  const handleResetRubric = () => {
    setRubricText('');
    setUploadedFileName('');
  };

  // Dialogs
  const [openDelete, setOpenDelete] = useState(false);

  // Fetch Exam details
  const fetchData = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/exams/${examId}`);
      setError('');

      if (!res.ok) {
        if (res.status === 404) {
          router.replace('/exams');
          return;
        }
        throw new Error('Prüfungsdetails konnten nicht geladen werden.');
      }

      const data = await res.json();
      setExam(data.exam);
      setStats(data.stats);
      setRoster(data.roster || []);
      setRubricText(data.exam.rubricText || '');
      setUploadedFileName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setLoading(false);
    }
  }, [examId, router]);

  useEffect(() => {
    if (examId) {
      Promise.resolve().then(() => {
        fetchData();
      });
    }
  }, [examId, fetchData]);

  // SAVE updated rubric text
  const handleSaveRubric = async () => {
    setSaveLoading(true);
    try {
      const res = await fetch(`/api/exams/${examId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rubricText }),
      });
      if (!res.ok) throw new Error('Musterlösung konnte nicht aktualisiert werden.');
      setEditingRubric(false);
      setUploadedFileName('');
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler beim Speichern.');
    } finally {
      setSaveLoading(false);
    }
  };

  // DELETE Exam
  const handleDeleteExam = async () => {
    setSaveLoading(true);
    try {
      const res = await fetch(`/api/exams/${examId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Prüfung konnte nicht gelöscht werden.');
      router.push('/exams');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler beim Löschen.');
      setSaveLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
          <CircularProgress size={40} />
        </Box>
      </DashboardLayout>
    );
  }

  // Pre-process grade distribution
  const distributionKeys = ['1.0-2.0', '2.0-3.0', '3.0-4.0', '4.0-5.0', '5.0-6.0'];
  const chartData = stats?.gradeDistribution
    ? distributionKeys.map((key) => stats.gradeDistribution[key] || 0)
    : [0, 0, 0, 0, 0];

  return (
    <DashboardLayout>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* Navigation & Header */}
        <Stack spacing={2}>
          <Link href="/exams" passHref style={{ textDecoration: 'none' }}>
            <Button
              startIcon={<ArrowBackIcon />}
              sx={{ textTransform: 'none', fontWeight: 650, color: 'text.secondary' }}
            >
              Zurück zur Prüfungsübersicht
            </Button>
          </Link>

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 2,
            }}
          >
            <Box>
              <Typography
                variant="h4"
                sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', mb: 0.5 }}
              >
                {exam?.title}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                Klasse:{' '}
                <Link
                  href={`/classes/${exam?.classId}`}
                  style={{ color: '#1b77d1', fontWeight: 700, textDecoration: 'none' }}
                >
                  {exam?.className}
                </Link>{' '}
                • Fach: {exam?.subject} • Max. Punkte: {exam?.maxPoints} P.
              </Typography>
            </Box>

            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => setOpenDelete(true)}
              sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 650 }}
            >
              Prüfung löschen
            </Button>
          </Box>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ borderRadius: '12px' }}>
            {error}
          </Alert>
        )}

        {/* 1. Statistical Aggregates Grid */}
        <Grid container spacing={3}>
          {/* Card 1: Class Average */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
              <CardContent sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '10px',
                    backgroundColor: '#e0f2fe',
                    color: '#1b77d1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <TrendingUpIcon />
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                    Klassenschnitt (Ø)
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a' }}>
                    {stats?.averageGrade}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Card 2: Pass Rate */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
              <CardContent sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '10px',
                    backgroundColor: '#dcfce7',
                    color: '#16a34a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <StarsIcon />
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                    Bestehensquote
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a' }}>
                    {stats?.passRate}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Card 3: Best / Worst */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
              <CardContent sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '10px',
                    backgroundColor: '#fff7ed',
                    color: '#ea580c',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AssessmentIcon />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary', fontWeight: 600, display: 'block' }}
                  >
                    Spannweite (Max - Min)
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 750, color: '#1e293b' }}>
                    Beste: {stats?.highestGrade} | Tiefste: {stats?.lowestGrade}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Card 4: Standard Deviation */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
              <CardContent sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '10px',
                    backgroundColor: '#f3e8ff',
                    color: '#9333ea',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <SchoolIcon />
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                    Standardabweichung
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a' }}>
                    ±{stats?.stdDev}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* 2. Histogram Chart & Rubric Panel */}
        <Grid container spacing={4}>
          {/* Histogram Chart */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card
              sx={{
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                boxShadow: 'none',
                height: '100%',
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mb: 2 }}>
                  Notenverteilung der Prüfung
                </Typography>
                {stats?.totalCompleted === 0 ? (
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.secondary',
                      fontStyle: 'italic',
                      py: 6,
                      textAlign: 'center',
                    }}
                  >
                    Bisher wurden keine Arbeiten für diese Prüfung korrigiert.
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                    <BarChart
                      xAxis={[
                        {
                          scaleType: 'band',
                          data: ['1.0-2.0', '2.0-3.0', '3.0-4.0', '4.0-5.0', '5.0-6.0'],
                        },
                      ]}
                      series={[{ data: chartData, label: 'Korrekturen', color: '#1b77d1' }]}
                      width={480}
                      height={260}
                      margin={{ top: 20, bottom: 30, left: 30, right: 10 }}
                    />
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Rubric config block */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card
              sx={{
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                boxShadow: 'none',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <CardContent sx={{ p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 2,
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                    Musterlösung & Erwartungshorizont
                  </Typography>
                  {!editingRubric ? (
                    <Button
                      size="small"
                      startIcon={<EditIcon />}
                      onClick={() => setEditingRubric(true)}
                    >
                      Bearbeiten
                    </Button>
                  ) : (
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => {
                          setEditingRubric(false);
                          setUploadedFileName('');
                          setRubricText(exam?.rubricText || '');
                        }}
                      >
                        Abbrechen
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<SaveIcon />}
                        onClick={handleSaveRubric}
                        disabled={saveLoading}
                      >
                        Speichern
                      </Button>
                    </Stack>
                  )}
                </Box>

                <Divider sx={{ mb: 2 }} />

                {editingRubric ? (
                  uploadedFileName || rubricText.startsWith('{"mimeType":') ? (
                    <Box
                      sx={{
                        border: '1px solid #cbd5e1',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: '#f8fafc',
                        mb: 2,
                      }}
                    >
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <StarsIcon sx={{ color: 'primary.main' }} />
                        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                          {uploadedFileName || 'Bild-Musterlösung geladen'}
                        </Typography>
                      </Stack>
                      <Button size="small" color="error" onClick={handleResetRubric}>
                        Zurücksetzen
                      </Button>
                    </Box>
                  ) : (
                    <Stack spacing={1.5} sx={{ flexGrow: 1 }}>
                      <TextField
                        multiline
                        rows={7}
                        fullWidth
                        variant="outlined"
                        value={rubricText}
                        onChange={(e) => setRubricText(e.target.value)}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' }, flexGrow: 1 }}
                      />
                      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                        <Typography
                          variant="caption"
                          sx={{ color: 'text.secondary', fontWeight: 600 }}
                        >
                          Oder lade eine Datei/einen Screenshot hoch:
                        </Typography>
                        <input
                          type="file"
                          accept="application/pdf,text/plain,image/*"
                          id="editRubricFile"
                          onChange={handleRubricFileChange}
                          style={{ display: 'none' }}
                        />
                        <Button
                          component="label"
                          htmlFor="editRubricFile"
                          variant="outlined"
                          size="small"
                          sx={{
                            color: 'text.primary',
                            borderColor: '#cbd5e1',
                            fontWeight: 650,
                            textTransform: 'none',
                          }}
                        >
                          Datei auswählen
                        </Button>
                      </Stack>
                    </Stack>
                  )
                ) : (
                  <Box
                    sx={{
                      p: 2.5,
                      borderRadius: '8px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      fontFamily: exam?.rubricText?.startsWith('{"mimeType":')
                        ? 'inherit'
                        : 'monospace',
                      fontSize: '0.85rem',
                      whiteSpace: exam?.rubricText?.startsWith('{"mimeType":')
                        ? 'normal'
                        : 'pre-wrap',
                      color: '#334155',
                      flexGrow: 1,
                      overflowY: exam?.rubricText?.startsWith('{"mimeType":"application/pdf"')
                        ? 'hidden'
                        : 'auto',
                      maxHeight: exam?.rubricText?.startsWith('{"mimeType":"application/pdf"')
                        ? '500px'
                        : '220px',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    {(() => {
                      if (exam?.rubricText?.startsWith('{"mimeType":')) {
                        try {
                          const parsed = JSON.parse(exam.rubricText);
                          if (parsed.mimeType === 'application/pdf') {
                            return (
                              <Stack spacing={2} sx={{ width: '100%' }}>
                                <Stack
                                  direction="row"
                                  sx={{ justifyContent: 'space-between', alignItems: 'center' }}
                                >
                                  <Stack
                                    direction="row"
                                    spacing={1.5}
                                    sx={{ alignItems: 'center', p: 0.5 }}
                                  >
                                    <StarsIcon sx={{ color: 'primary.main', fontSize: '1.5rem' }} />
                                    <Box>
                                      <Typography
                                        variant="subtitle2"
                                        sx={{ fontWeight: 700, color: 'text.primary' }}
                                      >
                                        PDF-Musterlösung hinterlegt
                                      </Typography>
                                      <Typography
                                        variant="caption"
                                        sx={{ color: 'text.secondary' }}
                                      >
                                        Die KI liest dieses Dokument zur Korrektur.
                                      </Typography>
                                    </Box>
                                  </Stack>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() => {
                                      const newTab = window.open();
                                      if (newTab) {
                                        newTab.document.write(
                                          `<title>PDF Musterlösung</title><body style="margin:0"><iframe width="100%" height="100%" style="border:none" src="data:application/pdf;base64,${parsed.data}"></iframe></body>`
                                        );
                                      }
                                    }}
                                    sx={{ textTransform: 'none', borderRadius: '6px' }}
                                  >
                                    In neuem Tab öffnen
                                  </Button>
                                </Stack>
                                <Box
                                  sx={{
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    height: '350px',
                                    backgroundColor: '#f8fafc',
                                  }}
                                >
                                  <iframe
                                    src={`data:${parsed.mimeType};base64,${parsed.data}`}
                                    title="PDF Musterlösung Vorschau"
                                    width="100%"
                                    height="100%"
                                    style={{ border: 'none' }}
                                  />
                                </Box>
                              </Stack>
                            );
                          }
                          return (
                            <Box
                              sx={{
                                maxWidth: '100%',
                                maxHeight: '180px',
                                display: 'flex',
                                justifyContent: 'center',
                              }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={`data:${parsed.mimeType};base64,${parsed.data}`}
                                alt="Musterlösung"
                                style={{
                                  maxWidth: '100%',
                                  maxHeight: '180px',
                                  objectFit: 'contain',
                                  borderRadius: '4px',
                                }}
                              />
                            </Box>
                          );
                        } catch {
                          return 'Ungültige Musterlösung';
                        }
                      }
                      return exam?.rubricText || 'Keine Musterlösung hinterlegt.';
                    })()}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* 3. Class Roster Submissions Tracker */}
        <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
          <CardContent sx={{ p: 3 }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2.5 }}>
              <AssignmentIcon sx={{ color: '#0f172a' }} />
              <Typography
                variant="h6"
                sx={{ fontWeight: 850, color: '#0f172a', letterSpacing: '-0.01em' }}
              >
                Korrektur-Status (Klassenliste)
              </Typography>
            </Stack>

            <TableContainer
              component={Box}
              sx={{ border: '1px solid #f1f5f9', borderRadius: '8px' }}
            >
              <Table>
                <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Schüler/in</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Punkte</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Note</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Korrekturdatum</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>
                      Korrektur-Aktion
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {roster.map((student) => {
                    let statusLabel = 'Ungestartet';
                    let statusColor: 'default' | 'success' | 'warning' = 'default';
                    if (student.status === 'COMPLETED') {
                      statusLabel = 'Abgeschlossen';
                      statusColor = 'success';
                    } else if (student.status === 'DRAFT') {
                      statusLabel = 'Entwurf';
                      statusColor = 'warning';
                    }

                    return (
                      <TableRow
                        key={student.studentId}
                        sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                      >
                        <TableCell sx={{ fontWeight: 600 }}>
                          <Link
                            href={`/students/${student.studentId}`}
                            style={{ textDecoration: 'none', color: '#1b77d1', fontWeight: 700 }}
                          >
                            {student.studentName}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={statusLabel}
                            size="small"
                            color={statusColor}
                            variant={statusColor === 'default' ? 'outlined' : 'filled'}
                            sx={{ fontWeight: 'bold' }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>
                          {student.earnedPoints !== 'N/A'
                            ? `${student.earnedPoints} / ${exam?.maxPoints}`
                            : '—'}
                        </TableCell>
                        <TableCell>
                          {student.status === 'COMPLETED' ? (
                            <Chip
                              label={student.grade}
                              size="small"
                              sx={{
                                backgroundColor:
                                  parseFloat(student.grade) >= 4.0 ? '#1b77d1' : '#dc2626',
                                color: '#ffffff',
                                fontWeight: 'bold',
                                borderRadius: '6px',
                              }}
                            />
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell>{student.date}</TableCell>
                        <TableCell sx={{ textAlign: 'right' }}>
                          {student.status !== 'UNSTARTED' ? (
                            <Link
                              href={`/correct/${student.submissionId}`}
                              passHref
                              style={{ textDecoration: 'none' }}
                            >
                              <Button
                                variant="outlined"
                                size="small"
                                sx={{ textTransform: 'none', fontWeight: 600 }}
                              >
                                Korrektur bearbeiten
                              </Button>
                            </Link>
                          ) : (
                            <Link href={`/dashboard`} passHref style={{ textDecoration: 'none' }}>
                              <Button
                                variant="contained"
                                color="success"
                                size="small"
                                startIcon={<PlayArrowIcon />}
                                sx={{ textTransform: 'none', fontWeight: 700 }}
                              >
                                Arbeit einscannen
                              </Button>
                            </Link>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        {/* Delete Exam Dialog Confirmation */}
        <Dialog open={openDelete} onClose={() => setOpenDelete(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 800, color: '#0f172a' }}>Prüfung löschen?</DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ color: 'text.primary', mb: 1 }}>
              Möchtest du die Prüfung <strong>{exam?.title}</strong> wirklich löschen?
            </Typography>
            <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 600 }}>
              Dabei werden all ihre bereits durchgeführten Korrekturen und AI-Feedbacks
              unwiderruflich entfernt!
            </Typography>
          </DialogContent>
          <DialogActions sx={{ p: 2, pt: 0 }}>
            <Button
              onClick={() => setOpenDelete(false)}
              sx={{ textTransform: 'none', fontWeight: 650 }}
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleDeleteExam}
              variant="contained"
              color="error"
              disabled={saveLoading}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '8px' }}
            >
              {saveLoading ? <CircularProgress size={20} /> : 'Dauerhaft löschen'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
}
