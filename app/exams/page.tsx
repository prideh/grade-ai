'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import AssignmentIcon from '@mui/icons-material/Assignment';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import DashboardLayout from '@/components/DashboardLayout';

interface SimpleClass {
  id: string;
  name: string;
}

interface PrismaExamItem {
  id: string;
  title: string;
  subject: string;
  maxPoints: number;
  className: string;
  submissionsCount: number;
}

interface ExamListItem extends PrismaExamItem {
  averageGrade: string;
}

export default function ExamsPage() {
  const [exams, setExams] = useState<ExamListItem[]>([]);
  const [classes, setClasses] = useState<SimpleClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Dialog State
  const [openCreate, setOpenCreate] = useState(false);
  const [examTitle, setExamTitle] = useState('');
  const [examSubject, setExamSubject] = useState('Mathematik');
  const [examMaxPoints, setExamMaxPoints] = useState<number>(20);
  const [examRubric, setExamRubric] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Fetch all exams & classes
  const fetchData = React.useCallback(async () => {
    try {
      // Fetch classes
      const classesRes = await fetch('/api/classes');
      setError('');

      if (classesRes.ok) {
        const classesData = await classesRes.json();
        setClasses(classesData.classes || []);
        if (classesData.classes?.length > 0) {
          setSelectedClassId(classesData.classes[0].id);
        }
      }

      // Fetch exams
      const examsRes = await fetch('/api/exams');
      if (!examsRes.ok) throw new Error('Fehler beim Laden der Prüfungen.');
      const examsData = await examsRes.json();

      // Fetch details for each exam to calculate and display class averages
      const detailedExams = await Promise.all(
        (examsData.exams || []).map(async (ex: PrismaExamItem) => {
          try {
            const detailRes = await fetch(`/api/exams/${ex.id}`);
            if (detailRes.ok) {
              const detailData = await detailRes.json();
              return {
                ...ex,
                averageGrade: detailData.stats?.averageGrade || 'N/A',
              };
            }
          } catch (e) {
            console.error('Error fetching details for exam', ex.id, e);
          }
          return { ...ex, averageGrade: 'N/A' };
        })
      );

      setExams(detailedExams);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchData();
    });
  }, [fetchData]);

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examTitle.trim() || !examSubject.trim() || !selectedClassId) {
      setCreateError('Bitte fülle alle Pflichtfelder aus.');
      return;
    }

    setCreateLoading(true);
    setCreateError('');

    try {
      const res = await fetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: examTitle,
          subject: examSubject,
          maxPoints: Number(examMaxPoints),
          rubricText: examRubric || 'Standard Musterlösung',
          classId: selectedClassId,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Erstellen fehlgeschlagen.');
      }

      setOpenCreate(false);
      setExamTitle('');
      setExamRubric('');
      fetchData(); // Refresh list
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Prüfung konnte nicht erstellt werden.');
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* Header Section */}
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
              sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', mb: 1 }}
            >
              Prüfungsverwaltung
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', fontWeight: 550 }}>
              Definiere Prüfungen, passe Erwartungshorizonte an und vergleiche Klassenleistungen.
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            disabled={classes.length === 0}
            onClick={() => setOpenCreate(true)}
            sx={{
              padding: '10px 20px',
              borderRadius: '8px',
              fontWeight: 700,
              textTransform: 'none',
              backgroundColor: '#1b77d1',
              boxShadow: '0 4px 10px rgba(27, 119, 209, 0.2)',
              '&:hover': { backgroundColor: '#1565c0' },
            }}
          >
            Prüfung anlegen
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ borderRadius: '12px' }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : exams.length === 0 ? (
          <Card
            sx={{
              borderRadius: '16px',
              border: '2px dashed #cbd5e1',
              boxShadow: 'none',
              backgroundColor: 'transparent',
              p: 6,
              textAlign: 'center',
            }}
          >
            <AssignmentIcon sx={{ fontSize: '4rem', color: '#94a3b8', mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#475569', mb: 1 }}>
              Keine Prüfungen gefunden
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: 'text.secondary', maxWidth: '400px', mx: 'auto', mb: 3 }}
            >
              Erstelle deine erste Prüfung, um einen Erwartungshorizont für die automatische
              Folgefehler-Korrektur zu hinterlegen.
            </Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              disabled={classes.length === 0}
              onClick={() => setOpenCreate(true)}
              sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 650 }}
            >
              Erste Prüfung anlegen
            </Button>
          </Card>
        ) : (
          <Grid container spacing={3}>
            {exams.map((ex) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={ex.id}>
                <Card
                  sx={{
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    boxShadow: 'none',
                    transition: 'all 0.25s ease',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      borderColor: '#1b77d1',
                      boxShadow: '0 10px 20px -10px rgba(0,0,0,0.05)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 3, pb: 1 }}>
                    <Stack
                      direction="row"
                      sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}
                    >
                      <Box>
                        <Typography
                          variant="h6"
                          sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5, lineClamp: 2 }}
                        >
                          {ex.title}
                        </Typography>
                        <Chip
                          label={ex.subject}
                          size="small"
                          sx={{
                            backgroundColor: '#e3f2fd',
                            color: '#1b77d1',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            mb: 1,
                          }}
                        />
                      </Box>
                      <Box
                        sx={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '8px',
                          backgroundColor: '#fff7ed',
                          color: '#ea580c',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <AssignmentIcon sx={{ fontSize: '1.25rem' }} />
                      </Box>
                    </Stack>

                    <Divider sx={{ mb: 2, borderColor: '#f1f5f9' }} />

                    <Grid container spacing={2}>
                      <Grid size={{ xs: 6 }}>
                        <Stack spacing={0.25}>
                          <Typography
                            variant="caption"
                            sx={{ color: 'text.secondary', fontWeight: 600 }}
                          >
                            Klasse
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: '#334155' }}>
                            {ex.className}
                          </Typography>
                        </Stack>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Stack spacing={0.25}>
                          <Typography
                            variant="caption"
                            sx={{ color: 'text.secondary', fontWeight: 600 }}
                          >
                            Max. Punkte
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: '#334155' }}>
                            {ex.maxPoints} Punkte
                          </Typography>
                        </Stack>
                      </Grid>
                      <Grid size={{ xs: 6 }} sx={{ mt: 1 }}>
                        <Stack spacing={0.25}>
                          <Typography
                            variant="caption"
                            sx={{ color: 'text.secondary', fontWeight: 600 }}
                          >
                            Korrekturen
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: '#334155' }}>
                            {ex.submissionsCount} bewertet
                          </Typography>
                        </Stack>
                      </Grid>
                      <Grid size={{ xs: 6 }} sx={{ mt: 1 }}>
                        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                          <Typography
                            variant="caption"
                            sx={{ color: 'text.secondary', fontWeight: 600 }}
                          >
                            Schnitt (Ø):
                          </Typography>
                          {ex.averageGrade !== 'N/A' ? (
                            <Chip
                              label={ex.averageGrade}
                              size="small"
                              sx={{
                                backgroundColor:
                                  parseFloat(ex.averageGrade) >= 4.0 ? '#dcfce7' : '#fee2e2',
                                color: parseFloat(ex.averageGrade) >= 4.0 ? '#15803d' : '#b91c1c',
                                fontWeight: 'bold',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                              }}
                            />
                          ) : (
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.8rem' }}
                            >
                              Keine Noten
                            </Typography>
                          )}
                        </Stack>
                      </Grid>
                    </Grid>
                  </CardContent>

                  <CardActions sx={{ p: 2, pt: 0, justifyContent: 'flex-end' }}>
                    <Link href={`/exams/${ex.id}`} passHref style={{ textDecoration: 'none' }}>
                      <Button
                        size="small"
                        endIcon={<ArrowForwardIcon />}
                        sx={{
                          textTransform: 'none',
                          fontWeight: 700,
                          color: '#1b77d1',
                          '&:hover': { backgroundColor: '#f0f7ff' },
                        }}
                      >
                        Musterlösung & Stats
                      </Button>
                    </Link>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Dialog for Create Exam */}
        <Dialog open={openCreate} onClose={() => setOpenCreate(false)} maxWidth="sm" fullWidth>
          <form onSubmit={handleCreateExam}>
            <DialogTitle sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
              Neue Prüfung anlegen
            </DialogTitle>
            <DialogContent>
              <Stack spacing={2.5} sx={{ mt: 1 }}>
                {createError && <Alert severity="error">{createError}</Alert>}

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 8 }}>
                    <TextField
                      label="Prüfungstitel"
                      placeholder="z.B. Klassenarbeit 1: Lineare Gleichungen"
                      fullWidth
                      variant="outlined"
                      value={examTitle}
                      onChange={(e) => setExamTitle(e.target.value)}
                      required
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <FormControl fullWidth>
                      <InputLabel id="subject-label">Fach</InputLabel>
                      <Select
                        labelId="subject-label"
                        value={examSubject}
                        label="Fach"
                        onChange={(e) => setExamSubject(e.target.value)}
                        sx={{ borderRadius: '8px' }}
                      >
                        <MenuItem value="Mathematik">Mathematik</MenuItem>
                        <MenuItem value="Physik">Physik</MenuItem>
                        <MenuItem value="Chemie">Chemie</MenuItem>
                        <MenuItem value="Geometrie">Geometrie</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormControl fullWidth>
                      <InputLabel id="class-label">Zielklasse</InputLabel>
                      <Select
                        labelId="class-label"
                        value={selectedClassId}
                        label="Zielklasse"
                        onChange={(e) => setSelectedClassId(e.target.value)}
                        required
                        sx={{ borderRadius: '8px' }}
                      >
                        {classes.map((c) => (
                          <MenuItem key={c.id} value={c.id}>
                            {c.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Maximale Punkte"
                      type="number"
                      fullWidth
                      variant="outlined"
                      value={examMaxPoints}
                      onChange={(e) => setExamMaxPoints(Number(e.target.value))}
                      required
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                    />
                  </Grid>
                </Grid>

                <TextField
                  label="Erwartungshorizont / Musterlösung"
                  placeholder="Gib Formeln, richtige Ergebnisse oder Teilschritte ein. Je präziser deine Musterlösung, desto genauer bewertet die KI."
                  multiline
                  rows={4}
                  fullWidth
                  variant="outlined"
                  value={examRubric}
                  onChange={(e) => setExamRubric(e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                />
              </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 2, pt: 0 }}>
              <Button
                onClick={() => setOpenCreate(false)}
                sx={{ textTransform: 'none', fontWeight: 650 }}
              >
                Abbrechen
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={createLoading}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  backgroundColor: '#1b77d1',
                  borderRadius: '8px',
                }}
              >
                {createLoading ? <CircularProgress size={20} /> : 'Anlegen'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
}
