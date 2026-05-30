'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Box,
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
  IconButton,
  Tooltip,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DescriptionIcon from '@mui/icons-material/Description';
import SettingsIcon from '@mui/icons-material/Settings';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import PersonIcon from '@mui/icons-material/Person';
import HistoryIcon from '@mui/icons-material/History';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import GroupIcon from '@mui/icons-material/Group';
import AssignmentIcon from '@mui/icons-material/Assignment';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ErrorIcon from '@mui/icons-material/Error';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import DashboardLayout from '@/components/DashboardLayout';
import { getCachedTeacher, setCachedTeacher } from '@/lib/sessionCache';

interface DashboardClass {
  id: string;
  name: string;
  _count?: {
    students: number;
  };
}

interface DashboardStudent {
  id: string;
  name: string;
}

interface DashboardExam {
  id: string;
  title: string;
  subject: string;
  maxPoints: number;
}

interface DashboardSubmission {
  id: string;
  studentName: string;
  examTitle: string;
  className: string;
  subject: string;
  points: string;
  grade: string;
  date: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  errorMessage?: string | null;
}

export default function Dashboard() {
  const router = useRouter();

  // Auth and Session state
  const [_teacher, setTeacher] = useState<{ id: string; name: string; email: string } | null>(
    getCachedTeacher()
  );
  const [authChecking, setAuthChecking] = useState(!getCachedTeacher());

  // Database lists
  const [classes, setClasses] = useState<DashboardClass[]>([]);
  const [students, setStudents] = useState<DashboardStudent[]>([]);
  const [exams, setExams] = useState<DashboardExam[]>([]);
  const [recentSubmissions, setRecentSubmissions] = useState<DashboardSubmission[]>([]);
  const [dismissedSubmissionIds, setDismissedSubmissionIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('gradeai_dismissed_submission_ids');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          console.error(e);
        }
      }
    }
    return [];
  });

  const handleDismissSubmission = async (subId: string) => {
    const sub = recentSubmissions.find((s) => s.id === subId);

    const isCancelOrFailure =
      sub && (sub.status === 'FAILED' || sub.status === 'PENDING' || sub.status === 'PROCESSING');

    if (isCancelOrFailure) {
      if (sub.status === 'PENDING' || sub.status === 'PROCESSING') {
        if (!confirm('Möchtest du diese aktive Korrektur wirklich abbrechen und löschen?')) {
          return;
        }
      }

      try {
        const res = await fetch(`/api/submissions/${subId}`, { method: 'DELETE' });
        if (!res.ok) {
          throw new Error('Abbrechen fehlgeschlagen.');
        }
        fetchRecentSubmissions(); // Neu laden aus DB, damit der Eintrag verschwindet
        return;
      } catch (err) {
        console.error('Error canceling/deleting submission on dismiss:', err);
        setError('Fehler beim Abbrechen der Korrektur.');
        return;
      }
    }

    // Für COMPLETED Einträge: Nur lokal ausblenden, in DB belassen
    const updated = [...dismissedSubmissionIds, subId];
    setDismissedSubmissionIds(updated);
    localStorage.setItem('gradeai_dismissed_submission_ids', JSON.stringify(updated));
  };

  // Selection states
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [defaultClassId, setDefaultClassId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('gradeai_default_class_id');
    }
    return null;
  });
  const [selectedStudentId, setSelectedStudentId] = useState<string>('AUTO'); // Recommended default
  const [selectedExamId, setSelectedExamId] = useState<string>('NEW'); // 'NEW' or specific exam UUID

  // New exam states
  const [examTitle, setExamTitle] = useState<string>('');
  const [examSubject, setExamSubject] = useState<string>('Mathematik');
  const [rubricText, setRubricText] = useState<string>('');
  const [rubricFile, setRubricFile] = useState<File | null>(null);

  // Correction configs
  const [model, setModel] = useState<'gemini-3.5-flash' | 'gemini-3.1-pro-preview'>(
    'gemini-3.5-flash'
  );
  const [studentFiles, setStudentFiles] = useState<File[]>([]); // Supports bulk uploads
  const [assignState, setAssignState] = useState<Record<string, string>>({}); // Inline student assignments

  // Loading & Error states
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [openConfirmOverwrite, setOpenConfirmOverwrite] = useState<boolean>(false);
  const [replacingSubmissionId, setReplacingSubmissionId] = useState<string | null>(null);
  const [globalExamsCount, setGlobalExamsCount] = useState<number>(0);
  const [initialDataLoading, setInitialDataLoading] = useState<boolean>(true);

  // 4. Handle Class Change (Fetch Students & Exams for selected class)
  const handleClassChange = React.useCallback(async (classId: string) => {
    setSelectedClassId(classId);
    setSelectedStudentId('AUTO'); // Recommended default: Auto-Match
    setStudentFiles([]); // Reset uploads
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
        const loadedExams = examsData.exams || [];
        setExams(loadedExams);
        // Pre-select the latest created exam if one exists, else NEW
        if (loadedExams.length > 0) {
          setSelectedExamId(loadedExams[0].id);
        } else {
          setSelectedExamId('NEW');
        }
      }
    } catch (err) {
      console.error('Error fetching class details:', err);
    }
  }, []);

  // 2. Fetch classes from DB
  const fetchClasses = React.useCallback(async () => {
    try {
      const res = await fetch('/api/classes');
      if (res.ok) {
        const data = await res.json();
        setClasses(data.classes || []);
        // Pre-select default class if available, else first class
        if (data.classes && data.classes.length > 0) {
          const stored = localStorage.getItem('gradeai_default_class_id');
          const classExists = data.classes.some((c: DashboardClass) => c.id === stored);
          if (stored && classExists) {
            handleClassChange(stored);
          } else {
            handleClassChange(data.classes[0].id);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching classes:', err);
    }
  }, [handleClassChange]);

  // 3. Fetch recent submissions history from DB
  const fetchRecentSubmissions = React.useCallback(async () => {
    try {
      const res = await fetch('/api/submissions');
      if (res.ok) {
        const data = await res.json();
        setRecentSubmissions(data.submissions || []);
      }

      // Refresh global exams count dynamically
      const examsRes = await fetch('/api/exams');
      if (examsRes.ok) {
        const examsData = await examsRes.json();
        setGlobalExamsCount(examsData.exams?.length || 0);
      }
    } catch (err) {
      console.error('Error fetching recent submissions or global exams count:', err);
    }
  }, []);

  // 1. Verify Authentication & Load Initial Data
  useEffect(() => {
    let active = true;
    const cached = getCachedTeacher();

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
            try {
              await Promise.all([fetchClasses(), fetchRecentSubmissions()]);
            } finally {
              setInitialDataLoading(false);
            }
          }
        }
      } catch (err) {
        console.error('Session verification failed:', err);
        router.replace('/login');
      }
    }

    if (cached) {
      Promise.resolve().then(async () => {
        try {
          await Promise.all([fetchClasses(), fetchRecentSubmissions()]);
        } finally {
          setInitialDataLoading(false);
        }
      });
    }

    checkAuth();

    return () => {
      active = false;
    };
  }, [router, fetchClasses, fetchRecentSubmissions]);

  // Memoized check for active background jobs to prevent unnecessary polling interval resets
  const hasActiveJobs = React.useMemo(() => {
    return recentSubmissions.some((sub) => sub.status === 'PENDING' || sub.status === 'PROCESSING');
  }, [recentSubmissions]);

  // Poll recent submissions if there are any pending/processing jobs in the queue
  useEffect(() => {
    if (!hasActiveJobs) return;

    const interval = setInterval(() => {
      fetchRecentSubmissions();
    }, 3000);

    return () => clearInterval(interval);
  }, [hasActiveJobs, fetchRecentSubmissions]);

  // Set default class handler
  const handleSetDefaultClass = () => {
    if (!selectedClassId) return;

    if (defaultClassId === selectedClassId) {
      localStorage.removeItem('gradeai_default_class_id');
      setDefaultClassId(null);
    } else {
      localStorage.setItem('gradeai_default_class_id', selectedClassId);
      setDefaultClassId(selectedClassId);
    }
  };

  // 5. Handle Logout
  const _handleLogout = async () => {
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
    if (e.dataTransfer.files) {
      const files = Array.from(e.dataTransfer.files);
      if (selectedStudentId === 'AUTO') {
        setStudentFiles((prev) => [...prev, ...files]);
      } else if (files[0]) {
        setStudentFiles([files[0]]);
      }
      setError('');
    }
  };

  const handleManualAssign = async (submissionId: string) => {
    const studentId = assignState[submissionId];
    if (!studentId) return;

    try {
      const res = await fetch(`/api/submissions/${submissionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Zuweisung fehlgeschlagen');
      }

      // Refresh submissions
      fetchRecentSubmissions();
      setAssignState((prev) => {
        const copy = { ...prev };
        delete copy[submissionId];
        return copy;
      });
    } catch (err) {
      console.error('Error in manual assignment:', err);
      setError(err instanceof Error ? err.message : 'Zuweisung fehlgeschlagen.');
    }
  };

  const handleReplaceSubmission = async (submissionId: string) => {
    setError('');
    setReplacingSubmissionId(submissionId);
    try {
      const res = await fetch(`/api/submissions/${submissionId}/replace`, {
        method: 'POST',
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Ersetzen fehlgeschlagen.');
      }
      fetchRecentSubmissions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Ersetzen.');
    } finally {
      setReplacingSubmissionId(null);
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
      setError('Bitte wähle einen Schüler oder Auto-Match aus.');
      return;
    }
    if (selectedExamId === 'NEW' && (!examTitle || !examSubject)) {
      setError('Bitte gib einen Prüfungstitel und ein Fach für die neue Prüfung an.');
      return;
    }
    if (studentFiles.length === 0) {
      setError('Bitte lade mindestens eine Schülerarbeit (PDF oder Bild) hoch.');
      return;
    }

    setLoading(true);
    setError('');
    setLoadingStep('Bereite Upload vor...');

    let resolvedExamId = selectedExamId;

    try {
      const uploadFile = async (file: File, isFirst = false) => {
        const formData = new FormData();
        formData.append('classId', selectedClassId);
        formData.append('studentExam', file);
        formData.append('model', model);

        if (shouldOverwrite) {
          formData.append('overwrite', 'true');
        }

        if (!isFirst && resolvedExamId !== 'NEW') {
          formData.append('examId', resolvedExamId);
        } else if (selectedExamId === 'NEW') {
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

        if (selectedStudentId !== 'AUTO') {
          formData.append('studentId', selectedStudentId);
        }

        const res = await fetch('/api/correct', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const errorData = await res.json();
          if (res.status === 409 && errorData.exists) {
            setLoading(false);
            setOpenConfirmOverwrite(true);
            throw new Error('DUPLICATE_SUBMISSION');
          }
          throw new Error(errorData.error || `Fehler beim Upload von ${file.name}`);
        }

        return await res.json();
      };

      setLoadingStep(`Lade Arbeit 1 von ${studentFiles.length} hoch...`);
      const firstResult = await uploadFile(studentFiles[0], true);
      resolvedExamId = firstResult.examId;

      if (studentFiles.length > 1) {
        setLoadingStep(`Lade verbleibende ${studentFiles.length - 1} Arbeiten hoch...`);
        const uploadPromises = studentFiles.slice(1).map((file) => {
          return uploadFile(file, false).catch((err) => {
            console.error(`Swallowed individual upload error for ${file.name}:`, err);
            return { error: err.message, fileName: file.name };
          });
        });

        await Promise.all(uploadPromises);
      }

      setStudentFiles([]);
      setLoading(false);
      fetchRecentSubmissions();

      // Immer auf dem Dashboard bleiben, damit die aktive Warteschlange direkt sichtbar ist und live mitverfolgt werden kann
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      if (err instanceof Error && err.message === 'DUPLICATE_SUBMISSION') {
        return; // Handled by overwrite modal
      }
      const errMsg = err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten.';
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

  // Calculate dynamic overall grade average of all completed submissions
  let overallAverage = 'N/A';
  const completedSubmissions = recentSubmissions.filter((sub) => sub.status === 'COMPLETED');
  if (completedSubmissions.length > 0) {
    const sumGrades = completedSubmissions.reduce(
      (sum, sub) => sum + parseFloat(sub.grade || '1.0'),
      0
    );
    overallAverage = (sumGrades / completedSubmissions.length).toFixed(2);
  }

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
                    {initialDataLoading ? '...' : totalClasses}
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
                    {initialDataLoading ? '...' : totalStudents}
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
                    {initialDataLoading ? '...' : globalExamsCount}
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
                    {initialDataLoading ? '...' : overallAverage}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Active Corrections Queue Tracker */}
        {recentSubmissions.some(
          (sub) =>
            (sub.status === 'PENDING' ||
              sub.status === 'PROCESSING' ||
              sub.status === 'FAILED' ||
              sub.status === 'COMPLETED') &&
            !dismissedSubmissionIds.includes(sub.id)
        ) && (
          <Card
            sx={{
              borderRadius: '16px',
              border: '2px solid #e0f2fe',
              boxShadow: '0 4px 20px rgba(2, 132, 199, 0.08)',
              background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
              overflow: 'hidden',
            }}
          >
            <CardContent sx={{ p: '24px' }}>
              {(() => {
                const activeCount = recentSubmissions.filter(
                  (sub) => sub.status === 'PENDING' || sub.status === 'PROCESSING'
                ).length;
                return (
                  <Stack
                    direction="row"
                    sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}
                  >
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                      {activeCount > 0 ? (
                        <CircularProgress size={22} thickness={5} sx={{ color: '#0284c7' }} />
                      ) : (
                        <CheckCircleIcon sx={{ color: '#0369a1', fontSize: '1.5rem' }} />
                      )}
                      <Typography
                        variant="h6"
                        sx={{ fontWeight: 800, color: '#0369a1', letterSpacing: '-0.01em' }}
                      >
                        {activeCount > 0
                          ? 'Aktive Korrekturen in der Warteschlange'
                          : 'Kürzliche Korrekturen'}
                      </Typography>
                    </Stack>
                    <Chip
                      label={`${activeCount} aktiv`}
                      size="small"
                      sx={{
                        backgroundColor: activeCount > 0 ? '#0284c7' : '#0369a1',
                        color: '#ffffff',
                        fontWeight: 'bold',
                      }}
                    />
                  </Stack>
                );
              })()}

              <Stack spacing={1.5}>
                {recentSubmissions
                  .filter(
                    (sub) =>
                      (sub.status === 'PENDING' ||
                        sub.status === 'PROCESSING' ||
                        sub.status === 'FAILED' ||
                        sub.status === 'COMPLETED') &&
                      !dismissedSubmissionIds.includes(sub.id)
                  )
                  .slice(0, 5) // Show top 5
                  .map((job) => {
                    const isProcessing = job.status === 'PROCESSING';
                    const isFailed = job.status === 'FAILED';
                    const isCompleted = job.status === 'COMPLETED';

                    return (
                      <Box
                        key={job.id}
                        sx={{
                          backgroundColor: '#ffffff',
                          borderRadius: '12px',
                          border: '1px solid #cbd5e1',
                          padding: '14px 18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                        }}
                      >
                        <Stack
                          direction="row"
                          spacing={2}
                          sx={{ alignItems: 'center', overflow: 'hidden' }}
                        >
                          {isFailed ? (
                            <Box sx={{ color: 'error.main', display: 'flex' }}>
                              <ErrorIcon />
                            </Box>
                          ) : isProcessing ? (
                            <CircularProgress
                              size={18}
                              thickness={5}
                              sx={{ color: 'primary.main' }}
                            />
                          ) : isCompleted ? (
                            <Box sx={{ color: 'success.main', display: 'flex' }}>
                              <CheckCircleIcon />
                            </Box>
                          ) : (
                            <Box
                              sx={{
                                color: 'text.secondary',
                                animation: 'pulse 1.5s infinite',
                                display: 'flex',
                              }}
                            >
                              <SettingsIcon />
                            </Box>
                          )}

                          <Box sx={{ overflow: 'hidden', textAlign: 'left' }}>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#1e293b' }}>
                              {job.studentName === 'Nicht zugeordnet' ? (
                                <Box
                                  component="span"
                                  sx={{
                                    color: '#d97706',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                >
                                  🤖 Auto-Match läuft... ({job.examTitle.split(':')[0]}) (
                                  {job.className})
                                </Box>
                              ) : (
                                `${job.studentName} — ${job.examTitle} (${job.className})`
                              )}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{ color: 'text.secondary', display: 'block' }}
                            >
                              {isFailed
                                ? `Fehlgeschlagen: ${job.errorMessage || 'Unbekannter KI-Fehler'}`
                                : isProcessing
                                  ? 'KI analysiert Lösungswege auf Folgefehler...'
                                  : isCompleted
                                    ? 'Korrektur abgeschlossen. Resultate im Workspace verfügbar.'
                                    : 'In der Warteschlange...'}
                            </Typography>
                          </Box>
                        </Stack>

                        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                          <Chip
                            label={
                              isFailed
                                ? 'Fehler'
                                : isProcessing
                                  ? 'Wird korrigiert'
                                  : isCompleted
                                    ? 'Fertig'
                                    : 'Wartend'
                            }
                            size="small"
                            color={
                              isFailed
                                ? 'error'
                                : isProcessing
                                  ? 'info'
                                  : isCompleted
                                    ? 'success'
                                    : 'warning'
                            }
                            sx={{ fontWeight: 'bold' }}
                          />
                          {isFailed && job.errorMessage?.includes('bereits eine Korrektur') && (
                            <Button
                              size="small"
                              variant="contained"
                              color="error"
                              disabled={replacingSubmissionId === job.id}
                              onClick={() => handleReplaceSubmission(job.id)}
                              startIcon={
                                replacingSubmissionId === job.id ? (
                                  <CircularProgress size={16} color="inherit" />
                                ) : (
                                  <AutoAwesomeIcon />
                                )
                              }
                              sx={{
                                textTransform: 'none',
                                fontWeight: 700,
                                borderRadius: '8px',
                                backgroundColor: '#dc2626',
                                '&:hover': {
                                  backgroundColor: '#b91c1c',
                                },
                              }}
                            >
                              Korrektur ersetzen
                            </Button>
                          )}
                          <Link
                            href={`/correct/${job.id}`}
                            passHref
                            style={{ textDecoration: 'none' }}
                          >
                            <Button
                              size="small"
                              variant="text"
                              sx={{ textTransform: 'none', fontWeight: 600 }}
                            >
                              Workspace öffnen
                            </Button>
                          </Link>
                          <Tooltip
                            title={
                              isCompleted
                                ? 'Aus Liste ausblenden'
                                : isFailed
                                  ? 'Fehlgeschlagenen Job löschen'
                                  : 'Korrektur abbrechen & löschen'
                            }
                          >
                            <IconButton
                              size="small"
                              onClick={() => handleDismissSubmission(job.id)}
                              sx={{
                                color: 'text.secondary',
                                '&:hover': {
                                  color: 'error.main',
                                  backgroundColor: '#fee2e2',
                                },
                              }}
                            >
                              <CloseIcon sx={{ fontSize: '1.1rem' }} />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </Box>
                    );
                  })}
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Wizard Start Title */}
        <Box>
          <Typography
            variant="h4"
            component="h2"
            sx={{
              fontWeight: 800,
              color: '#0f172a',
              marginBottom: '8px',
              letterSpacing: '-0.02em',
            }}
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
                      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
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
                                {cls.name} ({cls._count?.students || 0} Schüler)
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        {selectedClassId && (
                          <Button
                            variant={defaultClassId === selectedClassId ? 'contained' : 'outlined'}
                            color="primary"
                            onClick={handleSetDefaultClass}
                            startIcon={
                              defaultClassId === selectedClassId ? (
                                <StarIcon sx={{ color: '#ffffff' }} />
                              ) : (
                                <StarBorderIcon />
                              )
                            }
                            sx={{
                              height: '56px',
                              borderRadius: '8px',
                              px: 3,
                              textTransform: 'none',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                            }}
                          >
                            {defaultClassId === selectedClassId
                              ? 'Standardklasse'
                              : 'Als Standard setzen'}
                          </Button>
                        )}
                      </Stack>
                    </Grid>

                    {/* Student Selector Cards */}
                    {selectedClassId && (
                      <Grid size={{ xs: 12 }}>
                        <Typography
                          variant="subtitle2"
                          sx={{ fontWeight: 650, color: 'text.primary', mb: 1.5 }}
                        >
                          Schüler/in auswählen:
                        </Typography>
                        {students.length === 0 ? (
                          <Typography
                            variant="body2"
                            sx={{ color: 'text.secondary', fontStyle: 'italic' }}
                          >
                            Keine Schüler in dieser Klasse gefunden.
                          </Typography>
                        ) : (
                          <Grid container spacing={2}>
                            {/* Option A (Recommended Default): AI Auto-Matching */}
                            <Grid size={{ xs: 6, sm: 4 }} key="AUTO">
                              <Box
                                onClick={() => {
                                  setSelectedStudentId('AUTO');
                                  setError('');
                                  setStudentFiles([]); // Reset uploads
                                }}
                                sx={{
                                  border:
                                    selectedStudentId === 'AUTO'
                                      ? '2.5px solid #1b77d1'
                                      : '1px solid #e2e8f0',
                                  borderRadius: '12px',
                                  padding: '16px',
                                  textAlign: 'center',
                                  cursor: 'pointer',
                                  backgroundColor:
                                    selectedStudentId === 'AUTO' ? '#f0f7ff' : '#ffffff',
                                  transition: 'all 0.2s ease',
                                  boxShadow:
                                    selectedStudentId === 'AUTO'
                                      ? '0 4px 12px rgba(27, 119, 209, 0.08)'
                                      : 'none',
                                  '&:hover': {
                                    borderColor: '#1b77d1',
                                    backgroundColor:
                                      selectedStudentId === 'AUTO' ? '#f0f7ff' : '#f8fafc',
                                  },
                                }}
                              >
                                <AutoAwesomeIcon
                                  sx={{
                                    fontSize: '2rem',
                                    color:
                                      selectedStudentId === 'AUTO' ? '#1b77d1' : 'text.secondary',
                                    mb: 1,
                                  }}
                                />
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontWeight: selectedStudentId === 'AUTO' ? 700 : 500,
                                    color:
                                      selectedStudentId === 'AUTO' ? '#1b77d1' : 'text.primary',
                                  }}
                                >
                                  Auto-Match (🤖)
                                </Typography>
                              </Box>
                            </Grid>

                            {students.map((student) => {
                              const isSelected = selectedStudentId === student.id;
                              return (
                                <Grid size={{ xs: 6, sm: 4 }} key={student.id}>
                                  <Box
                                    onClick={() => {
                                      setSelectedStudentId(student.id);
                                      setError('');
                                      setStudentFiles([]); // Reset uploads
                                    }}
                                    sx={{
                                      border: isSelected
                                        ? '2.5px solid #1b77d1'
                                        : '1px solid #e2e8f0',
                                      borderRadius: '12px',
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
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 'bold', color: 'success.main' }}
                              >
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
                          <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: 650, color: 'primary.main' }}
                          >
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
                            <Typography
                              variant="caption"
                              sx={{ fontWeight: 600, color: 'text.secondary' }}
                            >
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
                                  <Typography
                                    variant="body2"
                                    sx={{ color: 'text.primary', fontWeight: 600 }}
                                  >
                                    {rubricFile.name}
                                  </Typography>
                                </Stack>
                                <Button
                                  size="small"
                                  color="error"
                                  onClick={() => setRubricFile(null)}
                                >
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
                                    sx={{
                                      color: 'text.primary',
                                      borderColor: '#e2e8f0',
                                      fontWeight: 600,
                                    }}
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
                      {selectedStudentId === 'AUTO'
                        ? 'Schülerarbeiten hochladen (Bulk-Upload)'
                        : 'Schülerarbeit hochladen (Scans/Fotos/PDF)'}
                    </Typography>

                    <Box
                      onDragOver={handleDragOver}
                      onDrop={handleDropStudent}
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.multiple = selectedStudentId === 'AUTO';
                        input.accept = 'image/*,application/pdf';
                        input.onchange = (e: Event) => {
                          const target = e.target as HTMLInputElement;
                          if (target.files) {
                            const files = Array.from(target.files);
                            if (selectedStudentId === 'AUTO') {
                              setStudentFiles((prev) => [...prev, ...files]);
                            } else if (files[0]) {
                              setStudentFiles([files[0]]);
                            }
                            setError('');
                          }
                        };
                        input.click();
                      }}
                      sx={{
                        border:
                          studentFiles.length > 0 ? '2px dashed #2e7d32' : '2px dashed #cbd5e1',
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
                      {studentFiles.length > 0 ? (
                        <Stack spacing={1.5} sx={{ width: '100%' }}>
                          {selectedStudentId === 'AUTO' ? (
                            <>
                              <Typography
                                variant="subtitle2"
                                sx={{
                                  fontWeight: 700,
                                  color: 'text.secondary',
                                  textAlign: 'left',
                                  mb: 0.5,
                                }}
                              >
                                Ausgewählte Arbeiten ({studentFiles.length}):
                              </Typography>
                              <Box
                                sx={{
                                  display: 'grid',
                                  gridTemplateColumns: '1fr',
                                  gap: '8px',
                                  width: '100%',
                                }}
                              >
                                {studentFiles.map((file, fileIdx) => (
                                  <Box
                                    key={fileIdx}
                                    sx={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '10px 16px',
                                      borderRadius: '8px',
                                      border: '1px solid #cbd5e1',
                                      background: '#ffffff',
                                    }}
                                    onClick={(e) => e.stopPropagation()} // Stop triggering file picker
                                  >
                                    <Stack
                                      direction="row"
                                      spacing={1.5}
                                      sx={{ alignItems: 'center', overflow: 'hidden' }}
                                    >
                                      <DescriptionIcon sx={{ color: 'primary.main' }} />
                                      <Box sx={{ textAlign: 'left', overflow: 'hidden' }}>
                                        <Typography
                                          variant="body2"
                                          sx={{
                                            fontWeight: 700,
                                            color: 'text.primary',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          {file.name}
                                        </Typography>
                                        <Typography
                                          variant="caption"
                                          sx={{ color: 'text.secondary' }}
                                        >
                                          {(file.size / (1024 * 1024)).toFixed(2)} MB
                                        </Typography>
                                      </Box>
                                    </Stack>
                                    <Button
                                      size="small"
                                      color="error"
                                      sx={{
                                        minWidth: 'auto',
                                        p: '4px',
                                        textTransform: 'none',
                                        fontWeight: 600,
                                      }}
                                      onClick={() => {
                                        setStudentFiles((prev) =>
                                          prev.filter((_, idx) => idx !== fileIdx)
                                        );
                                      }}
                                    >
                                      Entfernen
                                    </Button>
                                  </Box>
                                ))}
                              </Box>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<CloudUploadIcon />}
                                sx={{ mt: 1, textTransform: 'none', fontWeight: 600 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const input = document.createElement('input');
                                  input.type = 'file';
                                  input.multiple = true;
                                  input.accept = 'image/*,application/pdf';
                                  input.onchange = (evt: Event) => {
                                    const target = evt.target as HTMLInputElement;
                                    if (target.files) {
                                      const files = Array.from(target.files);
                                      setStudentFiles((prev) => [...prev, ...files]);
                                    }
                                  };
                                  input.click();
                                }}
                              >
                                Weitere Arbeiten hinzufügen
                              </Button>
                            </>
                          ) : (
                            <Stack spacing={1.5} sx={{ alignItems: 'center' }}>
                              <DescriptionIcon sx={{ fontSize: '3rem', color: 'success.main' }} />
                              <Typography
                                variant="subtitle1"
                                sx={{ fontWeight: 650, color: 'success.main' }}
                              >
                                {studentFiles[0].name}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                {(studentFiles[0].size / (1024 * 1024)).toFixed(2)} MB • Bereit für
                                Analyse
                              </Typography>
                            </Stack>
                          )}
                        </Stack>
                      ) : (
                        <Stack spacing={1.5} sx={{ alignItems: 'center' }}>
                          <CloudUploadIcon sx={{ fontSize: '3rem', color: 'text.secondary' }} />
                          <Typography
                            variant="subtitle1"
                            sx={{ fontWeight: 650, color: 'text.primary' }}
                          >
                            Zieh die Arbeit(en) hierher oder klicke zum Auswählen
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {selectedStudentId === 'AUTO'
                              ? 'Wähle eine oder mehrere Dateien aus • PDF, JPG, PNG'
                              : 'Wähle eine einzelne Datei aus • PDF, JPG, PNG'}
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
            <Card
              sx={{
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                boxShadow: 'none',
                height: '100%',
              }}
            >
              <CardContent
                sx={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}
              >
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
                  <SettingsIcon sx={{ color: 'primary.main', fontSize: '1.25rem' }} /> Optionen
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
                      setModel(e.target.value as 'gemini-3.5-flash' | 'gemini-3.1-pro-preview');
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
                          border:
                            model === 'gemini-3.5-flash'
                              ? '1.5px solid #1b77d1'
                              : '1px solid #e2e8f0',
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
                          <Typography
                            variant="caption"
                            sx={{ color: 'text.secondary', display: 'block' }}
                          >
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
                          border:
                            model === 'gemini-3.1-pro-preview'
                              ? '1.5px solid #1b77d1'
                              : '1px solid #e2e8f0',
                          background: model === 'gemini-3.1-pro-preview' ? '#f0f7ff' : '#ffffff',
                          cursor: 'pointer',
                          '&:hover': { borderColor: '#1b77d1' },
                        }}
                      >
                        <Radio value="gemini-3.1-pro-preview" size="small" />
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            Gemini 3.1 Pro (Preview)
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ color: 'text.secondary', display: 'block' }}
                          >
                            Tiefes Folgefehler-Tracking
                          </Typography>
                        </Box>
                      </Box>
                    </Stack>
                  </RadioGroup>
                </Stack>

                {/* Start Button */}
                <Button
                  onClick={() => startAnalysis(false)}
                  className="glow-button"
                  variant="contained"
                  fullWidth
                  size="large"
                  endIcon={<FlashOnIcon />}
                  disabled={!selectedStudentId || studentFiles.length === 0 || loading}
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
        {recentSubmissions.filter((sub) => sub.status === 'COMPLETED').length > 0 && (
          <Box sx={{ mt: 4 }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2 }}>
              <HistoryIcon sx={{ color: '#0f172a' }} />
              <Typography
                variant="h5"
                sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}
              >
                Letzte Korrekturen (Historie)
              </Typography>
            </Stack>
            <TableContainer
              component={Paper}
              sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'none' }}
            >
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
                  {recentSubmissions
                    .filter((sub) => sub.status === 'COMPLETED')
                    .map((sub) => {
                      const isUnassigned = sub.studentName === 'Nicht zugeordnet';
                      return (
                        <TableRow
                          key={sub.id}
                          sx={{
                            backgroundColor: isUnassigned ? '#fffbeb' : 'inherit',
                            '&:hover': {
                              backgroundColor: isUnassigned ? '#fff7ed' : '#f8fafc',
                            },
                            '&:last-child td, &:last-child th': { border: 0 },
                          }}
                        >
                          <TableCell sx={{ fontWeight: 600 }}>
                            {sub.studentName !== 'Nicht zugeordnet' ? (
                              sub.studentName
                            ) : (
                              <Stack spacing={1} sx={{ py: 1 }}>
                                <Chip
                                  label="Zuordnung ausstehend"
                                  size="small"
                                  sx={{
                                    backgroundColor: '#fef3c7',
                                    color: '#d97706',
                                    fontWeight: 'bold',
                                    alignSelf: 'flex-start',
                                    borderRadius: '6px',
                                  }}
                                />
                                <Box
                                  sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <FormControl size="small" sx={{ minWidth: '160px' }}>
                                    <Select
                                      value={assignState[sub.id] || ''}
                                      onChange={(e) =>
                                        setAssignState((prev) => ({
                                          ...prev,
                                          [sub.id]: e.target.value,
                                        }))
                                      }
                                      displayEmpty
                                      sx={{
                                        height: '32px',
                                        fontSize: '0.85rem',
                                        borderRadius: '6px',
                                      }}
                                    >
                                      <MenuItem value="" disabled>
                                        <em>Schüler auswählen...</em>
                                      </MenuItem>
                                      {students.map((st) => (
                                        <MenuItem key={st.id} value={st.id}>
                                          {st.name}
                                        </MenuItem>
                                      ))}
                                    </Select>
                                  </FormControl>
                                  <Button
                                    size="small"
                                    variant="contained"
                                    disabled={!assignState[sub.id]}
                                    onClick={() => handleManualAssign(sub.id)}
                                    sx={{
                                      minWidth: 'auto',
                                      px: 1.5,
                                      py: 0.5,
                                      height: '32px',
                                      textTransform: 'none',
                                      borderRadius: '6px',
                                      fontWeight: 600,
                                    }}
                                  >
                                    Zuordnen
                                  </Button>
                                </Box>
                              </Stack>
                            )}
                          </TableCell>
                          <TableCell>{sub.examTitle}</TableCell>
                          <TableCell>
                            <Chip
                              label={sub.subject}
                              size="small"
                              sx={{ backgroundColor: '#e3f2fd', color: '#1b77d1', fontWeight: 600 }}
                            />
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{sub.points}</TableCell>
                          <TableCell>
                            <Chip
                              label={sub.grade}
                              size="small"
                              sx={{
                                backgroundColor:
                                  parseFloat(sub.grade) >= 4.0 ? '#1b77d1' : '#dc2626',
                                color: '#ffffff',
                                fontWeight: 'bold',
                                borderRadius: '6px',
                              }}
                            />
                          </TableCell>
                          <TableCell>{sub.date}</TableCell>
                          <TableCell sx={{ textAlign: 'right' }}>
                            <Link
                              href={`/correct/${sub.id}`}
                              passHref
                              style={{ textDecoration: 'none' }}
                            >
                              <Button
                                variant="outlined"
                                size="small"
                                sx={{ textTransform: 'none', fontWeight: 600 }}
                              >
                                Workspace öffnen
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
              padding: '8px',
            },
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
          Korrektur überschreiben?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>
            Für diese/n Schüler/in existiert bereits eine Korrektur für diese Prüfung. Wenn du
            fortfährst, wird die{' '}
            <Box component="span" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
              bestehende Korrektur komplett überschrieben
            </Box>
            . Alle manuellen Änderungen und Lehrer-Kommentare gehen dabei unwiderruflich verloren.
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
                backgroundColor: '#c62828',
              },
            }}
          >
            Ja, überschreiben
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
