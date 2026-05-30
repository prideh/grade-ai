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
import StarsIcon from '@mui/icons-material/Stars';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DashboardLayout from '@/components/DashboardLayout';

interface SimpleClass {
  id: string;
  name: string;
  studentsCount: number;
  totalExams: number;
  averageGrade: string;
}

interface PrismaExamItem {
  id: string;
  title: string;
  subject: string;
  maxPoints: number;
  classId: string;
  className: string;
  rubricText: string;
  submissionsCount: number;
}

interface ExamListItem extends PrismaExamItem {
  averageGrade: string;
}

export default function ExamsPage() {
  const [exams, setExams] = useState<ExamListItem[]>([]);
  const [classes, setClasses] = useState<SimpleClass[]>([]);
  const [activeClassId, setActiveClassId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Dialog State
  const [openCreate, setOpenCreate] = useState(false);
  const [examTitle, setExamTitle] = useState('');

  // Copy Exam State
  const [openCopy, setOpenCopy] = useState(false);
  const [copySourceExam, setCopySourceExam] = useState<ExamListItem | null>(null);
  const [copyTitle, setCopyTitle] = useState('');
  const [copySubject, setCopySubject] = useState('');
  const [copyMaxPoints, setCopyMaxPoints] = useState<number>(20);
  const [copyRubric, setCopyRubric] = useState('');
  const [copyTargetClassId, setCopyTargetClassId] = useState('');
  const [copyLoading, setCopyLoading] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [examSubject, setExamSubject] = useState('Mathematik');
  const [examMaxPoints, setExamMaxPoints] = useState<number>(20);
  const [examRubric, setExamRubric] = useState('');
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
            setExamRubric(
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
            setExamRubric(text);
          }
        };
        reader.readAsText(file);
      }
    }
  };

  const handleResetRubric = () => {
    setExamRubric('');
    setUploadedFileName('');
  };

  const [selectedClassId, setSelectedClassId] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Fetch all exams & classes
  const fetchData = React.useCallback(async () => {
    try {
      // Fetch classes
      const classesRes = await fetch('/api/classes');
      setError('');

      let loadedClasses: SimpleClass[] = [];
      if (classesRes.ok) {
        const classesData = await classesRes.json();
        loadedClasses = await Promise.all(
          (classesData.classes || []).map(
            async (cls: { id: string; name: string; _count?: { students?: number } }) => {
              try {
                const detailRes = await fetch(`/api/classes/${cls.id}`);
                if (detailRes.ok) {
                  const detailData = await detailRes.json();
                  return {
                    id: cls.id,
                    name: cls.name,
                    studentsCount: cls._count?.students || 0,
                    totalExams: detailData.exams?.length || 0,
                    averageGrade: detailData.stats?.averageGrade || 'N/A',
                  };
                }
              } catch (e) {
                console.error('Error fetching details for class', cls.id, e);
              }
              return {
                id: cls.id,
                name: cls.name,
                studentsCount: cls._count?.students || 0,
                totalExams: 0,
                averageGrade: 'N/A',
              };
            }
          )
        );
        setClasses(loadedClasses);
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

      if (loadedClasses.length > 0) {
        setActiveClassId((prev) => {
          if (prev && loadedClasses.some((c) => c.id === prev)) {
            return prev;
          }
          return loadedClasses[0].id;
        });
        setSelectedClassId((prev) => {
          if (prev && loadedClasses.some((c) => c.id === prev)) {
            return prev;
          }
          return loadedClasses[0].id;
        });
      }
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
      setUploadedFileName('');
      setActiveClassId(selectedClassId); // Automatically select the tab of the class for the new exam
      fetchData(); // Refresh list
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Prüfung konnte nicht erstellt werden.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleOpenCopy = (exam: ExamListItem) => {
    setCopySourceExam(exam);
    setCopyTitle(`${exam.title} (Kopie)`);
    setCopySubject(exam.subject);
    setCopyMaxPoints(exam.maxPoints);
    setCopyRubric(exam.rubricText || 'Standard Musterlösung');

    const otherClasses = classes.filter((c) => c.id !== exam.classId);
    if (otherClasses.length > 0) {
      setCopyTargetClassId(otherClasses[0].id);
    } else {
      setCopyTargetClassId('');
    }

    setCopyError('');
    setOpenCopy(true);
  };

  const handleCopyExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!copyTitle.trim() || !copySubject.trim() || !copyTargetClassId) {
      setCopyError('Bitte fülle alle Pflichtfelder aus.');
      return;
    }

    setCopyLoading(true);
    setCopyError('');

    try {
      const res = await fetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: copyTitle,
          subject: copySubject,
          maxPoints: Number(copyMaxPoints),
          rubricText: copyRubric,
          classId: copyTargetClassId,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Kopieren fehlgeschlagen.');
      }

      setOpenCopy(false);
      setCopySourceExam(null);
      setActiveClassId(copyTargetClassId); // Automatically select the tab of the class for the copied exam
      fetchData(); // Refresh list
    } catch (err) {
      setCopyError(err instanceof Error ? err.message : 'Prüfung konnte nicht kopiert werden.');
    } finally {
      setCopyLoading(false);
    }
  };

  const filteredExams = exams.filter((ex) => ex.classId === activeClassId);

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

        {/* Class Selector Deck */}
        {classes.length > 0 && (
          <Stack spacing={1.5}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary' }}>
              Wähle eine Klasse, um deren Prüfungen anzuzeigen:
            </Typography>
            <Stack
              direction="row"
              spacing={2}
              sx={{
                overflowX: 'auto',
                pb: 1.5,
                pt: 0.5,
                px: 0.5,
                '&::-webkit-scrollbar': { height: '6px' },
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: '#cbd5e1',
                  borderRadius: '3px',
                },
              }}
            >
              {classes.map((cls) => {
                const isActive = cls.id === activeClassId;
                return (
                  <Card
                    key={cls.id}
                    onClick={() => {
                      setActiveClassId(cls.id);
                      setSelectedClassId(cls.id);
                    }}
                    sx={{
                      minWidth: '220px',
                      flexShrink: 0,
                      borderRadius: '12px',
                      border: '2px solid',
                      borderColor: isActive ? '#1b77d1' : '#e2e8f0',
                      boxShadow: isActive ? '0 10px 20px -10px rgba(27, 119, 209, 0.3)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      backgroundColor: isActive ? '#f0f7ff' : '#ffffff',
                      '&:hover': {
                        borderColor: '#1b77d1',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 8px 16px -8px rgba(0,0,0,0.1)',
                      },
                    }}
                  >
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Stack spacing={0.75}>
                        <Typography
                          variant="subtitle1"
                          sx={{
                            fontWeight: 800,
                            color: isActive ? '#1b77d1' : '#0f172a',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {cls.name}
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                          <Typography
                            variant="caption"
                            sx={{ color: 'text.secondary', fontWeight: 600 }}
                          >
                            {cls.studentsCount} Schüler
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#cbd5e1' }}>
                            •
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ color: 'text.secondary', fontWeight: 600 }}
                          >
                            {cls.totalExams} {cls.totalExams === 1 ? 'Prüfung' : 'Prüfungen'}
                          </Typography>
                        </Stack>
                        {cls.averageGrade !== 'N/A' && (
                          <Stack
                            direction="row"
                            spacing={0.75}
                            sx={{ alignItems: 'center', mt: 0.5 }}
                          >
                            <Typography
                              variant="caption"
                              sx={{ color: 'text.secondary', fontWeight: 600 }}
                            >
                              Klassenschnitt:
                            </Typography>
                            <Chip
                              label={cls.averageGrade}
                              size="small"
                              sx={{
                                height: '18px',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                backgroundColor:
                                  parseFloat(cls.averageGrade) >= 4.0 ? '#dcfce7' : '#fee2e2',
                                color: parseFloat(cls.averageGrade) >= 4.0 ? '#15803d' : '#b91c1c',
                                borderRadius: '4px',
                              }}
                            />
                          </Stack>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          </Stack>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : classes.length === 0 ? (
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
              Keine Klassen gefunden
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: 'text.secondary', maxWidth: '400px', mx: 'auto', mb: 3 }}
            >
              Erstelle zuerst eine Schulklasse in der Klassenverwaltung, um Prüfungen für sie
              anlegen zu können.
            </Typography>
            <Link href="/classes" passHref style={{ textDecoration: 'none' }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 650 }}
              >
                Klassenverwaltung öffnen
              </Button>
            </Link>
          </Card>
        ) : filteredExams.length === 0 ? (
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
              Erstelle deine erste Prüfung für{' '}
              {classes.find((c) => c.id === activeClassId)?.name || 'diese Klasse'}, um einen
              Erwartungshorizont für die automatische Folgefehler-Korrektur zu hinterlegen.
            </Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setOpenCreate(true)}
              sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 650 }}
            >
              Erste Prüfung anlegen
            </Button>
          </Card>
        ) : (
          <Grid container spacing={3}>
            {filteredExams.map((ex) => (
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

                  <CardActions sx={{ p: 2, pt: 0, justifyContent: 'space-between' }}>
                    <Button
                      size="small"
                      startIcon={<ContentCopyIcon />}
                      onClick={() => handleOpenCopy(ex)}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 650,
                        color: 'text.secondary',
                        '&:hover': { backgroundColor: '#f1f5f9', color: '#0f172a' },
                      }}
                    >
                      Kopieren
                    </Button>
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

                {uploadedFileName || examRubric.startsWith('{"mimeType":') ? (
                  <Box
                    sx={{
                      border: '1px solid #cbd5e1',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      backgroundColor: '#f8fafc',
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
                  <Stack spacing={1.5}>
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
                        id="dialogRubricFile"
                        onChange={handleRubricFileChange}
                        style={{ display: 'none' }}
                      />
                      <Button
                        component="label"
                        htmlFor="dialogRubricFile"
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
                )}
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

        {/* Dialog for Copy Exam */}
        <Dialog open={openCopy} onClose={() => setOpenCopy(false)} maxWidth="sm" fullWidth>
          <form onSubmit={handleCopyExam}>
            <DialogTitle sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
              Prüfung kopieren
            </DialogTitle>
            <DialogContent>
              <Stack spacing={2.5} sx={{ mt: 1 }}>
                {copyError && <Alert severity="error">{copyError}</Alert>}

                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                  Kopiere die Prüfung <strong>{copySourceExam?.title}</strong> in eine andere
                  Klasse. Alle Einstellungen und der Erwartungshorizont werden übernommen.
                </Typography>

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 8 }}>
                    <TextField
                      label="Neuer Prüfungstitel"
                      placeholder="z.B. Klassenarbeit 1: Lineare Gleichungen"
                      fullWidth
                      variant="outlined"
                      value={copyTitle}
                      onChange={(e) => setCopyTitle(e.target.value)}
                      required
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <FormControl fullWidth>
                      <InputLabel id="copy-subject-label">Fach</InputLabel>
                      <Select
                        labelId="copy-subject-label"
                        value={copySubject}
                        label="Fach"
                        onChange={(e) => setCopySubject(e.target.value)}
                        sx={{ borderRadius: '8px' }}
                        MenuProps={{ disablePortal: true }}
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
                      <InputLabel id="copy-class-label">Zielklasse</InputLabel>
                      <Select
                        labelId="copy-class-label"
                        value={copyTargetClassId}
                        label="Zielklasse"
                        onChange={(e) => setCopyTargetClassId(e.target.value)}
                        required
                        sx={{ borderRadius: '8px' }}
                        MenuProps={{ disablePortal: true }}
                      >
                        {classes.map((c) => (
                          <MenuItem key={c.id} value={c.id}>
                            {c.name} {c.id === copySourceExam?.classId && '(Aktuelle Klasse)'}
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
                      value={copyMaxPoints}
                      onChange={(e) => setCopyMaxPoints(Number(e.target.value))}
                      required
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                    />
                  </Grid>
                </Grid>

                <TextField
                  label="Erwartungshorizont / Musterlösung"
                  multiline
                  rows={4}
                  fullWidth
                  variant="outlined"
                  value={copyRubric}
                  onChange={(e) => setCopyRubric(e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                />
              </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 2, pt: 0 }}>
              <Button
                onClick={() => setOpenCopy(false)}
                sx={{ textTransform: 'none', fontWeight: 650 }}
              >
                Abbrechen
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={copyLoading}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  backgroundColor: '#1b77d1',
                  borderRadius: '8px',
                }}
              >
                {copyLoading ? <CircularProgress size={20} /> : 'Kopieren'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
}
