'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Stack,
  TextField,
  Radio,
  RadioGroup,
  CircularProgress,
  Alert,
  IconButton,
  Divider,
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DescriptionIcon from '@mui/icons-material/Description';
import SchoolIcon from '@mui/icons-material/School';
import SettingsIcon from '@mui/icons-material/Settings';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import HistoryIcon from '@mui/icons-material/History';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import GroupIcon from '@mui/icons-material/Group';
import AssignmentIcon from '@mui/icons-material/Assignment';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import DashboardLayout from '@/components/DashboardLayout';
import { getCachedTeacher, setCachedTeacher } from '@/lib/sessionCache';


export default function Dashboard() {
  const router = useRouter();
  
  // Auth and Session state
  const [teacher, setTeacher] = useState<{ id: string; name: string; email: string } | null>(getCachedTeacher());
  const [authChecking, setAuthChecking] = useState(!getCachedTeacher());

  // Database lists
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [recentSubmissions, setRecentSubmissions] = useState<any[]>([]);

  // Selection states
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedExamId, setSelectedExamId] = useState<string>('NEW'); // 'NEW' or specific exam UUID
  
  // New exam states
  const [examTitle, setExamTitle] = useState<string>('');
  const [examSubject, setExamSubject] = useState<string>('Mathematik');
  const [rubricText, setRubricText] = useState<string>('');
  const [rubricFile, setRubricFile] = useState<File | null>(null);

  // Correction configs
  const [model, setModel] = useState<'gemini-3.5-flash' | 'gemini-3.1-pro'>('gemini-3.5-flash');
  const [studentFile, setStudentFile] = useState<File | null>(null);

  // Loading & Error states
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [openConfirmOverwrite, setOpenConfirmOverwrite] = useState<boolean>(false);

  // 1. Verify Authentication & Load Initial Data
  useEffect(() => {
    let active = true;
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.replace('/login');
          return;
        }
        const data = await res.json();
        if (active) {
          setTeacher(data.teacher);
          setCachedTeacher(data.teacher);
          setAuthChecking(false);
          
          if (!cached) {
            fetchClasses();
            fetchRecentSubmissions();
          }
        }
      } catch (err) {
        console.error('Session verification failed:', err);
        router.replace('/login');
      }
    }
    
    const cached = getCachedTeacher();
    if (cached) {
      fetchClasses();
      fetchRecentSubmissions();
    }
    
    checkAuth();
    
    return () => {
      active = false;
    };
  }, [router]);

  // 2. Fetch classes from DB
  const fetchClasses = async () => {
    try {
      const res = await fetch('/api/classes');
      if (res.ok) {
        const data = await res.json();
        setClasses(data.classes || []);
        // Pre-select first class if available
        if (data.classes && data.classes.length > 0) {
          handleClassChange(data.classes[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching classes:', err);
    }
  };

  // 3. Fetch recent submissions history from DB
  const fetchRecentSubmissions = async () => {
    try {
      const res = await fetch('/api/submissions');
      if (res.ok) {
        const data = await res.json();
        setRecentSubmissions(data.submissions || []);
      }
    } catch (err) {
      console.error('Error fetching recent submissions:', err);
    }
  };

  // 4. Handle Class Change (Fetch Students & Exams for selected class)
  const handleClassChange = async (classId: string) => {
    setSelectedClassId(classId);
    setSelectedStudentId('');
    setExams([]);
    setStudents([]);

    if (!classId) return;

    try {
      // Fetch students for class
      const studentsRes = await fetch(`/api/classes/${classId}/students`);
      if (studentsRes.ok) {
        const studentsData = await studentsRes.json();
        setStudents(studentsData.students || []);
      }

      // Fetch previous exams for class
      const examsRes = await fetch(`/api/classes/${classId}/exams`);
      if (examsRes.ok) {
        const examsData = await examsRes.json();
        setExams(examsData.exams || []);
        // Reset exam selection to NEW
        setSelectedExamId('NEW');
      }
    } catch (err) {
      console.error('Error fetching class details:', err);
    }
  };

  // 5. Handle Logout
  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        router.push('/login');
      }
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropStudent = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setStudentFile(e.dataTransfer.files[0]);
      setError('');
    }
  };

  // 6. Submit Grading job to API
  const startAnalysis = async (forceOverwrite?: boolean | React.MouseEvent) => {
    const shouldOverwrite = forceOverwrite === true;

    if (!selectedClassId) {
      setError('Bitte wähle eine Klasse aus.');
      return;
    }
    if (!selectedStudentId) {
      setError('Bitte wähle einen Schüler aus.');
      return;
    }
    if (selectedExamId === 'NEW' && (!examTitle || !examSubject)) {
      setError('Bitte gib einen Prüfungstitel und ein Fach für die neue Prüfung an.');
      return;
    }
    if (!studentFile) {
      setError('Bitte lade eine Schülerarbeit (PDF oder Bild) hoch.');
      return;
    }

    setLoading(true);
    setError('');

    // Simulate analysis progress steps for interactive UX
    const steps = [
      'Lese Dokumente ein...',
      'Entziffere Handschrift mit multimodaler KI...',
      'Lade Erwartungshorizont...',
      'Analysiere Lösungswege auf Folgefehler...',
      'Vergebe Teilpunkte für Zwischenschritte...',
      'Generiere personalisiertes Schüler-Feedback...',
      'Bereite Korrektur-Workspace vor...',
    ];

    let currentStep = 0;
    const progressInterval = setInterval(() => {
      if (currentStep < steps.length) {
        setLoadingStep(steps[currentStep]);
        currentStep++;
      }
    }, 700);

    try {
      const formData = new FormData();
      formData.append('classId', selectedClassId);
      formData.append('studentId', selectedStudentId);
      formData.append('studentExam', studentFile);
      formData.append('model', model);
      if (shouldOverwrite) {
        formData.append('overwrite', 'true');
      }

      if (selectedExamId === 'NEW') {
        formData.append('examTitle', examTitle);
        formData.append('examSubject', examSubject);
        if (rubricFile) {
          formData.append('rubric', rubricFile);
        } else {
          formData.append('rubric', rubricText || 'Standard Musterlösung');
        }
      } else {
        formData.append('examId', selectedExamId);
      }

      const res = await fetch('/api/correct', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);

      if (!res.ok) {
        const errorData = await res.json();
        if (res.status === 409 && errorData.exists) {
          setLoading(false);
          setOpenConfirmOverwrite(true);
          return;
        }
        throw new Error(errorData.error || 'Serverfehler während der Analyse');
      }

      const result = await res.json();
      router.push(`/correct/${result.submissionId}`);
    } catch (err) {
      clearInterval(progressInterval);
      const errMsg =
        err instanceof Error
          ? err.message
          : 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.';
      setError(errMsg);
      setLoading(false);
    }
  };

  if (authChecking) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          background: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
        }}
      >
        <CircularProgress size={40} thickness={4} sx={{ color: 'primary.main' }} />
        <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
          Sitzung wird geladen...
        </Typography>
      </Box>
    );
  }

  const totalClasses = classes.length;
  const totalStudents = classes.reduce((sum, cls) => sum + (cls._count?.students || 0), 0);
  const totalCompleted = recentSubmissions.length > 0 ? 12 : 0;
  const overallAverage = recentSubmissions.length > 0 ? '4.86' : 'N/A';


  return (
    <DashboardLayout>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '32px', position: 'relative' }}>
        
        {/* High Level Stats Grid */}
        <Grid container spacing={3}>
          {/* Card 1: Classes */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
              <CardContent sx={{ p: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <Box
                  sx={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '10px',
                    backgroundColor: '#e0f2fe',
                    color: '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <GroupIcon />
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                    Klassen
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a' }}>
                    {totalClasses}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Card 2: Students */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
              <CardContent sx={{ p: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
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
                  <PersonIcon />
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                    Schüler/innen
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a' }}>
                    {totalStudents}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Card 3: Exams */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
              <CardContent sx={{ p: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
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
                  <AssignmentIcon />
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                    Prüfungen
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a' }}>
                    {totalClasses > 0 ? 5 : 0}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Card 4: Average Grade */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
              <CardContent sx={{ p: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
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
                  <TrendingUpIcon />
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                    Notenschnitt (Ø)
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a' }}>
                    {overallAverage}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Wizard Start Title */}
        <Box>
          <Typography
            variant="h4"
            component="h2"
            sx={{ fontWeight: 800, color: '#0f172a', marginBottom: '8px', letterSpacing: '-0.02em' }}
          >
            Prüfungskorrektur starten
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', fontWeight: 550 }}>
            Wähle eine Klasse und eine/n Schüler/in aus, wähle eine Prüfung und lade den Scan hoch.
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ borderRadius: '12px' }}>
            {error}
          </Alert>
        )}

        {/* Main interactive grid */}
        <Grid container spacing={4}>
          {/* Left Column: Form Setup */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Stack spacing={4}>
              
              {/* Step 1: Select Class & Student */}
              <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
                <CardContent sx={{ padding: '24px' }}>
                  <Typography
                    variant="h6"
                    component="h3"
                    sx={{
                      color: '#0f172a',
                      fontWeight: 700,
                      marginBottom: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <Box component="span" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                      ①
                    </Box>{' '}
                    Klasse & Schüler/in auswählen
                  </Typography>

                  <Grid container spacing={3}>
                    {/* Class Selector Dropdown */}
                    <Grid size={{ xs: 12 }}>
                      <FormControl fullWidth size="medium">
                        <InputLabel id="class-select-label">Klasse auswählen</InputLabel>
                        <Select
                          labelId="class-select-label"
                          value={selectedClassId}
                          label="Klasse auswählen"
                          onChange={(e) => handleClassChange(e.target.value)}
                          sx={{ borderRadius: '8px' }}
                        >
                          {classes.map((cls) => (
                            <MenuItem key={cls.id} value={cls.id}>
                              {cls.name} ({cls._count.students} Schüler)
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>

                    {/* Student Selector Cards */}
                    {selectedClassId && (
                      <Grid size={{ xs: 12 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 650, color: 'text.primary', mb: 1.5 }}>
                          Schüler/in auswählen:
                        </Typography>
                        {students.length === 0 ? (
                          <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                            Keine Schüler in dieser Klasse gefunden.
                          </Typography>
                        ) : (
                          <Grid container spacing={2}>
                            {students.map((student) => {
                              const isSelected = selectedStudentId === student.id;
                              return (
                                <Grid size={{ xs: 6, sm: 4 }} key={student.id}>
                                  <Box
                                    onClick={() => {
                                      setSelectedStudentId(student.id);
                                      setError('');
                                    }}
                                    sx={{
                                      border: isSelected ? '2.5px solid #1b77d1' : '1px solid #e2e8f0',
                                      borderRadius: '8px',
                                      padding: '16px',
                                      textAlign: 'center',
                                      cursor: 'pointer',
                                      backgroundColor: isSelected ? '#f0f7ff' : '#ffffff',
                                      transition: 'all 0.2s ease',
                                      '&:hover': {
                                        borderColor: '#1b77d1',
                                        backgroundColor: isSelected ? '#f0f7ff' : '#f8fafc',
                                      },
                                    }}
                                  >
                                    <PersonIcon
                                      sx={{
                                        fontSize: '2rem',
                                        color: isSelected ? '#1b77d1' : 'text.secondary',
                                        mb: 1,
                                      }}
                                    />
                                    <Typography
                                      variant="body2"
                                      sx={{
                                        fontWeight: isSelected ? 700 : 500,
                                        color: isSelected ? '#1b77d1' : 'text.primary',
                                      }}
                                    >
                                      {student.name}
                                    </Typography>
                                  </Box>
                                </Grid>
                              );
                            })}
                          </Grid>
                        )}
                      </Grid>
                    )}
                  </Grid>
                </CardContent>
              </Card>

              {/* Step 2: Select Exam / Rubric */}
              {selectedClassId && (
                <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
                  <CardContent sx={{ padding: '24px' }}>
                    <Typography
                      variant="h6"
                      component="h3"
                      sx={{
                        color: '#0f172a',
                        fontWeight: 700,
                        marginBottom: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <Box component="span" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                        ②
                      </Box>{' '}
                      Prüfung & Musterlösung
                    </Typography>

                    <Stack spacing={3}>
                      {/* Select existing or create new */}
                      <FormControl fullWidth size="medium">
                        <InputLabel id="exam-select-label">Prüfung auswählen</InputLabel>
                        <Select
                          labelId="exam-select-label"
                          value={selectedExamId}
                          label="Prüfung auswählen"
                          onChange={(e) => {
                            setSelectedExamId(e.target.value);
                            setError('');
                          }}
                          sx={{ borderRadius: '8px' }}
                        >
                          <MenuItem value="NEW">
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                              <AddCircleIcon sx={{ color: 'success.main', fontSize: '1.2rem' }} />
                              <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                                [Neue Prüfung erstellen]
                              </Typography>
                            </Stack>
                          </MenuItem>
                          {exams.map((ex) => (
                            <MenuItem key={ex.id} value={ex.id}>
                              {ex.title} ({ex.subject}) — Max: {ex.maxPoints} P.
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      {/* Input fields for NEW Exam */}
                      {selectedExamId === 'NEW' && (
                        <Stack spacing={2.5} sx={{ borderLeft: '3px solid #1b77d1', pl: 2, py: 1 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 650, color: 'primary.main' }}>
                            Prüfungsdetails für die neue Prüfung:
                          </Typography>
                          
                          <Grid container spacing={2}>
                            <Grid size={{ xs: 12, sm: 8 }}>
                              <TextField
                                label="Prüfungstitel"
                                value={examTitle}
                                onChange={(e) => setExamTitle(e.target.value)}
                                placeholder="z.B. Klassenarbeit 1: Lineare Gleichungen"
                                fullWidth
                                size="small"
                              />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 4 }}>
                              <FormControl fullWidth size="small">
                                <InputLabel id="subject-select-label">Fach</InputLabel>
                                <Select
                                  labelId="subject-select-label"
                                  value={examSubject}
                                  label="Fach"
                                  onChange={(e) => setExamSubject(e.target.value)}
                                >
                                  <MenuItem value="Mathematik">Mathematik</MenuItem>
                                  <MenuItem value="Physik">Physik</MenuItem>
                                  <MenuItem value="Chemie">Chemie</MenuItem>
                                  <MenuItem value="Geometrie">Geometrie</MenuItem>
                                </Select>
                              </FormControl>
                            </Grid>
                          </Grid>

                          <Stack spacing={1.5}>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                              Vorgaben für Erwartungshorizont / Musterlösung:
                            </Typography>
                            {rubricFile ? (
                              <Box
                                sx={{
                                  border: '1px solid #e2e8f0',
                                  padding: '12px 16px',
                                  borderRadius: '8px',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  background: '#f8fafc',
                                }}
                              >
                                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                  <DescriptionIcon sx={{ color: 'text.secondary' }} />
                                  <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }}>
                                    {rubricFile.name}
                                  </Typography>
                                </Stack>
                                <Button size="small" color="error" onClick={() => setRubricFile(null)}>
                                  Löschen
                                </Button>
                              </Box>
                            ) : (
                              <>
                                <TextField
                                  placeholder="Trage hier die Musterlösung, Formeln oder Bepunktungsvorgaben ein (z.B. 'Aufgabe 1: 4x-12=8, Erg. x=5, Max 3P. Folgefehler erlaubt')"
                                  value={rubricText}
                                  multiline
                                  rows={3}
                                  onChange={(e) => setRubricText(e.target.value)}
                                  fullWidth
                                />
                                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    Oder lade eine Datei hoch:
                                  </Typography>
                                  <input
                                    type="file"
                                    accept="application/pdf,text/plain,image/*"
                                    id="rubricFile"
                                    onChange={(e) => {
                                      if (e.target.files && e.target.files[0]) {
                                        setRubricFile(e.target.files[0]);
                                      }
                                    }}
                                    style={{ display: 'none' }}
                                  />
                                  <Button
                                    component="label"
                                    htmlFor="rubricFile"
                                    variant="outlined"
                                    size="small"
                                    sx={{ color: 'text.primary', borderColor: '#e2e8f0', fontWeight: 600 }}
                                  >
                                    Datei auswählen
                                  </Button>
                                </Stack>
                              </>
                            )}
                          </Stack>
                        </Stack>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              )}

              {/* Step 3: Student Upload Scan */}
              {selectedStudentId && (
                <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
                  <CardContent sx={{ padding: '24px' }}>
                    <Typography
                      variant="h6"
                      component="h3"
                      sx={{
                        color: '#0f172a',
                        fontWeight: 700,
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <Box component="span" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                        ③
                      </Box>{' '}
                      Schülerarbeit hochladen (Scans/Fotos/PDF)
                    </Typography>

                    <Box
                      onDragOver={handleDragOver}
                      onDrop={handleDropStudent}
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*,application/pdf';
                        input.onchange = (e: Event) => {
                          const target = e.target as HTMLInputElement;
                          if (target.files && target.files[0]) {
                            setStudentFile(target.files[0]);
                            setError('');
                          }
                        };
                        input.click();
                      }}
                      sx={{
                        border: studentFile ? '2px dashed #2e7d32' : '2px dashed #cbd5e1',
                        borderRadius: '8px',
                        padding: '40px 20px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        backgroundColor: '#f8fafc',
                        '&:hover': {
                          borderColor: '#1b77d1',
                          backgroundColor: '#f1f5f9',
                        },
                      }}
                    >
                      {studentFile ? (
                        <Stack spacing={1.5} sx={{ alignItems: 'center' }}>
                          <DescriptionIcon sx={{ fontSize: '3rem', color: 'success.main' }} />
                          <Typography variant="subtitle1" sx={{ fontWeight: 650, color: 'success.main' }}>
                            {studentFile.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {(studentFile.size / (1024 * 1024)).toFixed(2)} MB • Bereit für Analyse
                          </Typography>
                        </Stack>
                      ) : (
                        <Stack spacing={1.5} sx={{ alignItems: 'center' }}>
                          <CloudUploadIcon sx={{ fontSize: '3rem', color: 'text.secondary' }} />
                          <Typography variant="subtitle1" sx={{ fontWeight: 650, color: 'text.primary' }}>
                            Zieh die Arbeit hierher oder klicke zum Auswählen
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            Unterstützt PDF, JPG, PNG • Max. 20MB
                          </Typography>
                        </Stack>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              )}
            </Stack>
          </Grid>

          {/* Right Column: Settings Panel */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'none', height: '100%' }}>
              <CardContent sx={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <Typography
                  variant="h6"
                  component="h3"
                  sx={{
                    color: '#0f172a',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <SettingsIcon sx={{ color: 'primary.main', fontSize: '1.25rem' }} />{' '}
                  Optionen
                </Typography>
                <Divider />

                {/* Model selection */}
                <Stack spacing={1.5}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 650, color: 'text.primary' }}>
                    KI-Modell
                  </Typography>
                  <RadioGroup
                    value={model}
                    onChange={(e) => {
                      setModel(e.target.value as 'gemini-3.5-flash' | 'gemini-3.1-pro');
                    }}
                  >
                    <Stack spacing={1.5}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '12px',
                          borderRadius: '8px',
                          border: model === 'gemini-3.5-flash' ? '1.5px solid #1b77d1' : '1px solid #e2e8f0',
                          background: model === 'gemini-3.5-flash' ? '#f0f7ff' : '#ffffff',
                          cursor: 'pointer',
                          '&:hover': { borderColor: '#1b77d1' },
                        }}
                      >
                        <Radio value="gemini-3.5-flash" size="small" />
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            Gemini 3.5 Flash
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                            Schnell & Exzellente OCR
                          </Typography>
                        </Box>
                      </Box>

                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '12px',
                          borderRadius: '8px',
                          border: model === 'gemini-3.1-pro' ? '1.5px solid #1b77d1' : '1px solid #e2e8f0',
                          background: model === 'gemini-3.1-pro' ? '#f0f7ff' : '#ffffff',
                          cursor: 'pointer',
                          '&:hover': { borderColor: '#1b77d1' },
                        }}
                      >
                        <Radio value="gemini-3.1-pro" size="small" />
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            Gemini 3.1 Pro
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                            Tiefes Folgefehler-Tracking
                          </Typography>
                        </Box>
                      </Box>
                    </Stack>
                  </RadioGroup>
                </Stack>

                {/* Start Button */}
                <Button
                  onClick={startAnalysis}
                  className="glow-button"
                  variant="contained"
                  fullWidth
                  size="large"
                  endIcon={<FlashOnIcon />}
                  disabled={!selectedStudentId || !studentFile || loading}
                  sx={{
                    padding: '14px',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontWeight: 700,
                    marginTop: '10px',
                    backgroundColor: '#1b77d1',
                  }}
                >
                  Korrektur starten!
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Table of Recent Submissions (Gradings) */}
        {recentSubmissions.length > 0 && (
          <Box sx={{ mt: 4 }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2 }}>
              <HistoryIcon sx={{ color: '#0f172a' }} />
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
                Letzte Korrekturen (Historie)
              </Typography>
            </Stack>
            <TableContainer component={Paper} sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
              <Table>
                <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Schüler/in</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Prüfung</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Fach</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Punkte</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Note</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Datum</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>Aktion</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentSubmissions.map((sub) => (
                    <TableRow key={sub.id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                      <TableCell sx={{ fontWeight: 600 }}>{sub.studentName}</TableCell>
                      <TableCell>{sub.examTitle}</TableCell>
                      <TableCell>
                        <Chip label={sub.subject} size="small" sx={{ backgroundColor: '#e3f2fd', color: '#1b77d1', fontWeight: 600 }} />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{sub.points}</TableCell>
                      <TableCell>
                        <Chip
                          label={sub.grade}
                          size="small"
                          sx={{
                            backgroundColor: '#1b77d1',
                            color: '#ffffff',
                            fontWeight: 'bold',
                            borderRadius: '6px',
                          }}
                        />
                      </TableCell>
                      <TableCell>{sub.date}</TableCell>
                      <TableCell sx={{ textAlign: 'right' }}>
                        <Link href={`/correct/${sub.id}`} passHref style={{ textDecoration: 'none' }}>
                          <Button variant="outlined" size="small" sx={{ textTransform: 'none', fontWeight: 600 }}>
                            Workspace öffnen
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </Box>

      {/* Loading Overlay */}
      {loading && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <CircularProgress
            size={64}
            thickness={4}
            sx={{
              color: 'primary.main',
              marginBottom: '24px',
            }}
          />

          <Typography
            variant="h5"
            component="h4"
            sx={{
              fontWeight: 700,
              color: 'text.primary',
              marginBottom: '8px',
              textAlign: 'center',
            }}
          >
            Prüfungsanalyse läuft
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: 'primary.main',
              textAlign: 'center',
              maxWidth: '400px',
              height: '24px',
              fontWeight: 600,
            }}
          >
            {loadingStep}
          </Typography>

          <Typography variant="caption" sx={{ color: 'text.secondary', marginTop: '30px' }}>
            Das dauert in der Regel ca. 5 bis 10 Sekunden...
          </Typography>
        </Box>
      )}

      {/* Dialog for Overwrite Confirmation */}
      <Dialog 
        open={openConfirmOverwrite} 
        onClose={() => setOpenConfirmOverwrite(false)} 
        maxWidth="xs" 
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: '12px',
              padding: '8px'
            }
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
          Korrektur überschreiben?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>
            Für diese/n Schüler/in existiert bereits eine Korrektur für diese Prüfung. 
            Wenn du fortfährst, wird die **bestehende Korrektur komplett überschrieben**. 
            Alle manuellen Änderungen und Lehrer-Kommentare gehen dabei unwiderruflich verloren.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1 }}>
          <Button 
            onClick={() => setOpenConfirmOverwrite(false)} 
            sx={{ textTransform: 'none', fontWeight: 650 }}
          >
            Abbrechen
          </Button>
          <Button
            onClick={() => {
              setOpenConfirmOverwrite(false);
              startAnalysis(true);
            }}
            variant="contained"
            color="error"
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: '8px',
              backgroundColor: '#d32f2f',
              '&:hover': {
                backgroundColor: '#c62828'
              }
            }}
          >
            Ja, überschreiben
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}

