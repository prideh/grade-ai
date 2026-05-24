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
  Chip,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import SchoolIcon from '@mui/icons-material/School';
import PersonIcon from '@mui/icons-material/Person';
import AssessmentIcon from '@mui/icons-material/Assessment';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import StarsIcon from '@mui/icons-material/Stars';
import GroupIcon from '@mui/icons-material/Group';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { BarChart } from '@mui/x-charts/BarChart';
import DashboardLayout from '@/components/DashboardLayout';

interface ClassData {
  id: string;
  name: string;
  createdAt: string;
  teacherId: string;
}

interface ClassStats {
  averageGrade: string;
  passRate: string;
  highestGrade: string;
  lowestGrade: string;
  stdDev: string;
  totalSubmissions: number;
  gradeDistribution: Record<string, number>;
}

interface StudentRosterItem {
  id: string;
  name: string;
  totalExamsCorrected: number;
  averageGrade: string;
}

interface ExamRosterItem {
  id: string;
  title: string;
  subject: string;
  maxPoints: number;
  submissionsCount: number;
  averageGrade: string;
}

interface SimpleClassInfo {
  id: string;
  name: string;
}

export default function ClassDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const classId = params.id as string;

  // Data State
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [stats, setStats] = useState<ClassStats | null>(null);
  const [students, setStudents] = useState<StudentRosterItem[]>([]);
  const [exams, setExams] = useState<ExamRosterItem[]>([]);
  const [allClasses, setAllClasses] = useState<SimpleClassInfo[]>([]); // For student transfer selection

  // Loading & Error States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Dialogs States
  const [openAddStudent, setOpenAddStudent] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [studentActionLoading, setStudentActionLoading] = useState(false);
  const [studentActionError, setStudentActionError] = useState('');

  const [openTransfer, setOpenTransfer] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentRosterItem | null>(null);
  const [targetClassId, setTargetClassId] = useState('');

  const [openDeleteStudent, setOpenDeleteStudent] = useState(false);
  const [openDeleteClass, setOpenDeleteClass] = useState(false);
  const [openEditClass, setOpenEditClass] = useState(false);
  const [editedClassName, setEditedClassName] = useState('');

  // Fetch Class Details
  const fetchData = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/classes/${classId}`);

      // Call setState ONLY after the first await to satisfy react-hooks/set-state-in-effect
      setError('');

      if (!res.ok) {
        if (res.status === 404) {
          router.replace('/classes');
          return;
        }
        throw new Error('Klassendetails konnten nicht geladen werden.');
      }

      const data = await res.json();
      setClassData(data.class);
      setStats(data.stats);
      setStudents(data.students || []);
      setExams(data.exams || []);
      setEditedClassName(data.class.name);

      // Fetch all classes for transfer select list
      const classesRes = await fetch('/api/classes');
      if (classesRes.ok) {
        const classesData = await classesRes.json();
        setAllClasses(classesData.classes || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setLoading(false);
    }
  }, [classId, router]);

  useEffect(() => {
    if (classId) {
      Promise.resolve().then(() => {
        fetchData();
      });
    }
  }, [classId, fetchData]);

  // ADD Student
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim()) {
      setStudentActionError('Bitte gib einen Namen an.');
      return;
    }

    setStudentActionLoading(true);
    setStudentActionError('');

    try {
      const res = await fetch(`/api/classes/${classId}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newStudentName }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erstellen fehlgeschlagen.');

      setOpenAddStudent(false);
      setNewStudentName('');
      fetchData(); // Refresh data
    } catch (err) {
      setStudentActionError(err instanceof Error ? err.message : 'Fehler beim Hinzufügen.');
    } finally {
      setStudentActionLoading(false);
    }
  };

  // TRANSFER Student
  const handleTransferStudent = async () => {
    if (!selectedStudent) return;
    if (!targetClassId) {
      setStudentActionError('Bitte wähle eine Zielklasse aus.');
      return;
    }

    setStudentActionLoading(true);
    setStudentActionError('');

    try {
      const res = await fetch(`/api/students/${selectedStudent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: targetClassId }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Transfer fehlgeschlagen.');

      setOpenTransfer(false);
      setSelectedStudent(null);
      setTargetClassId('');
      fetchData(); // Refresh
    } catch (err) {
      setStudentActionError(err instanceof Error ? err.message : 'Fehler beim Transfer.');
    } finally {
      setStudentActionLoading(false);
    }
  };

  // DELETE Student
  const handleDeleteStudent = async () => {
    if (!selectedStudent) return;
    setStudentActionLoading(true);
    setStudentActionError('');

    try {
      const res = await fetch(`/api/students/${selectedStudent.id}`, {
        method: 'DELETE',
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Löschen fehlgeschlagen.');

      setOpenDeleteStudent(false);
      setSelectedStudent(null);
      fetchData(); // Refresh
    } catch (err) {
      setStudentActionError(err instanceof Error ? err.message : 'Fehler beim Löschen.');
    } finally {
      setStudentActionLoading(false);
    }
  };

  // DELETE Class
  const handleDeleteClass = async () => {
    setStudentActionLoading(true);
    try {
      const res = await fetch(`/api/classes/${classId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Klasse konnte nicht gelöscht werden.');
      router.push('/classes');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler beim Löschen der Klasse.');
      setStudentActionLoading(false);
    }
  };

  // EDIT Class Name
  const handleEditClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editedClassName.trim()) return;

    setStudentActionLoading(true);
    try {
      const res = await fetch(`/api/classes/${classId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editedClassName }),
      });
      if (!res.ok) throw new Error('Fehler beim Aktualisieren.');
      setOpenEditClass(false);
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler beim Ändern des Namens.');
    } finally {
      setStudentActionLoading(false);
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

  // Pre-process grade distribution for MUI Charts
  const distributionKeys = ['1.0-2.0', '2.0-3.0', '3.0-4.0', '4.0-5.0', '5.0-6.0'];
  const chartData = stats?.gradeDistribution
    ? distributionKeys.map((key) => stats.gradeDistribution[key] || 0)
    : [0, 0, 0, 0, 0];

  return (
    <DashboardLayout>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* Navigation back and Class Title */}
        <Stack spacing={2}>
          <Link href="/classes" passHref style={{ textDecoration: 'none' }}>
            <Button
              startIcon={<ArrowBackIcon />}
              sx={{ textTransform: 'none', fontWeight: 650, color: 'text.secondary' }}
            >
              Zurück zur Klassenübersicht
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
                {classData?.name}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                Erstellt am {classData?.createdAt} • {students.length} Schüler enrolled
              </Typography>
            </Box>

            <Stack direction="row" spacing={1.5}>
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() => setOpenEditClass(true)}
                sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 650 }}
              >
                Name ändern
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => setOpenDeleteClass(true)}
                sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 650 }}
              >
                Klasse auflösen
              </Button>
            </Stack>
          </Box>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ borderRadius: '12px' }}>
            {error}
          </Alert>
        )}

        {/* 1. Statistics Summary Grid */}
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
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a' }}>
                      {stats?.averageGrade}
                    </Typography>
                    {stats?.averageGrade !== 'N/A' && (
                      <Typography
                        variant="caption"
                        sx={{ color: 'success.main', fontWeight: 'bold' }}
                      >
                        Schweizer Note
                      </Typography>
                    )}
                  </Stack>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Card 2: Passing Rate */}
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

        {/* 2. Visual Analytics Section: Grade Histogram and Quick Actions */}
        <Grid container spacing={4}>
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
                  Notenverteilung (Klassenweit)
                </Typography>
                {stats?.totalSubmissions === 0 ? (
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.secondary',
                      fontStyle: 'italic',
                      py: 4,
                      textAlign: 'center',
                    }}
                  >
                    Noch keine bewerteten Prüfungsarbeiten für diese Klasse vorhanden.
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
                      series={[{ data: chartData, label: 'Anzahl Arbeiten', color: '#1b77d1' }]}
                      width={480}
                      height={260}
                      margin={{ top: 20, bottom: 30, left: 30, right: 10 }}
                    />
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Card
              sx={{
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                boxShadow: 'none',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              <CardContent sx={{ p: 4, textAlign: 'center' }}>
                <Box
                  sx={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '12px',
                    backgroundColor: '#f0f7ff',
                    color: '#1b77d1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 2,
                  }}
                >
                  <GroupIcon sx={{ fontSize: '2rem' }} />
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', mb: 1 }}>
                  Prüfung korrigieren
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: 'text.secondary', maxWidth: '380px', mx: 'auto', mb: 3 }}
                >
                  Du möchtest eine handschriftliche Arbeit eines Schülers aus dieser Klasse
                  bewerten? Navigiere zum Workspace.
                </Typography>
                <Link href="/dashboard" passHref style={{ textDecoration: 'none' }}>
                  <Button
                    variant="contained"
                    endIcon={<ArrowForwardIcon />}
                    sx={{
                      padding: '10px 24px',
                      borderRadius: '8px',
                      fontWeight: 700,
                      textTransform: 'none',
                      backgroundColor: '#1b77d1',
                    }}
                  >
                    Korrektur-Workspace starten
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* 3. Students Roster Card */}
        <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
          <CardContent sx={{ p: 3 }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2.5,
                flexWrap: 'wrap',
                gap: 2,
              }}
            >
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <PersonIcon sx={{ color: '#0f172a' }} />
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 850, color: '#0f172a', letterSpacing: '-0.01em' }}
                >
                  Klassen-Roster (Schüler/innen)
                </Typography>
              </Stack>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => setOpenAddStudent(true)}
                sx={{
                  borderRadius: '8px',
                  textTransform: 'none',
                  fontWeight: 650,
                  fontSize: '0.85rem',
                }}
              >
                Schüler/in hinzufügen
              </Button>
            </Box>

            {students.length === 0 ? (
              <Typography
                variant="body2"
                sx={{ color: 'text.secondary', fontStyle: 'italic', py: 4, textAlign: 'center' }}
              >
                Bisher sind keine Schüler enrolled.
              </Typography>
            ) : (
              <TableContainer
                component={Box}
                sx={{ border: '1px solid #f1f5f9', borderRadius: '8px' }}
              >
                <Table>
                  <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Bewertete Arbeiten</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Persönlicher Schnitt (Ø)</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>
                        Aktionen
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {students.map((student) => (
                      <TableRow
                        key={student.id}
                        sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                      >
                        <TableCell sx={{ fontWeight: 600 }}>
                          <Link
                            href={`/students/${student.id}`}
                            style={{ textDecoration: 'none', color: '#1b77d1', fontWeight: 700 }}
                          >
                            {student.name}
                          </Link>
                        </TableCell>
                        <TableCell>{student.totalExamsCorrected} Arbeiten</TableCell>
                        <TableCell>
                          {student.averageGrade !== 'N/A' ? (
                            <Chip
                              label={student.averageGrade}
                              size="small"
                              sx={{
                                backgroundColor:
                                  parseFloat(student.averageGrade) >= 4.0 ? '#dcfce7' : '#fee2e2',
                                color:
                                  parseFloat(student.averageGrade) >= 4.0 ? '#15803d' : '#b91c1c',
                                fontWeight: 'bold',
                                borderRadius: '6px',
                              }}
                            />
                          ) : (
                            <Typography
                              variant="body2"
                              sx={{
                                color: 'text.secondary',
                                fontStyle: 'italic',
                                fontSize: '0.85rem',
                              }}
                            >
                              Keine Noten
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ textAlign: 'right' }}>
                          <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                            <Link
                              href={`/students/${student.id}`}
                              passHref
                              style={{ textDecoration: 'none' }}
                            >
                              <Button
                                variant="text"
                                size="small"
                                sx={{ textTransform: 'none', fontWeight: 650 }}
                              >
                                Profil öffnen
                              </Button>
                            </Link>
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => {
                                setSelectedStudent(student);
                                setTargetClassId(classId);
                                setOpenTransfer(true);
                              }}
                            >
                              <SwapHorizIcon />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => {
                                setSelectedStudent(student);
                                setOpenDeleteStudent(true);
                              }}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>

        {/* 4. Exams History Card */}
        <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
          <CardContent sx={{ p: 3 }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2.5 }}>
              <AssessmentIcon sx={{ color: '#0f172a' }} />
              <Typography
                variant="h6"
                sx={{ fontWeight: 850, color: '#0f172a', letterSpacing: '-0.01em' }}
              >
                Durchgeführte Prüfungen
              </Typography>
            </Stack>

            {exams.length === 0 ? (
              <Typography
                variant="body2"
                sx={{ color: 'text.secondary', fontStyle: 'italic', py: 4, textAlign: 'center' }}
              >
                Bisher wurden keine Prüfungen für diese Klasse erstellt.
              </Typography>
            ) : (
              <TableContainer
                component={Box}
                sx={{ border: '1px solid #f1f5f9', borderRadius: '8px' }}
              >
                <Table>
                  <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Titel</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Fach</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Max. Punkte</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Korrekturen abgeschlossen</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Klassenschnitt (Ø)</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>
                        Aktionen
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {exams.map((exam) => (
                      <TableRow
                        key={exam.id}
                        sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                      >
                        <TableCell sx={{ fontWeight: 650 }}>
                          <Link
                            href={`/exams/${exam.id}`}
                            style={{ textDecoration: 'none', color: '#1b77d1', fontWeight: 700 }}
                          >
                            {exam.title}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={exam.subject}
                            size="small"
                            sx={{ backgroundColor: '#f1f5f9', color: '#475569', fontWeight: 600 }}
                          />
                        </TableCell>
                        <TableCell>{exam.maxPoints} P.</TableCell>
                        <TableCell>{exam.submissionsCount} bewertet</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>
                          {exam.averageGrade !== 'N/A' ? (
                            <Chip
                              label={exam.averageGrade}
                              size="small"
                              sx={{
                                backgroundColor:
                                  parseFloat(exam.averageGrade) >= 4.0 ? '#dcfce7' : '#fee2e2',
                                color: parseFloat(exam.averageGrade) >= 4.0 ? '#15803d' : '#b91c1c',
                                fontWeight: 'bold',
                                borderRadius: '6px',
                              }}
                            />
                          ) : (
                            <Typography
                              variant="body2"
                              sx={{
                                color: 'text.secondary',
                                fontStyle: 'italic',
                                fontSize: '0.85rem',
                              }}
                            >
                              Keine Noten
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ textAlign: 'right' }}>
                          <Link
                            href={`/exams/${exam.id}`}
                            passHref
                            style={{ textDecoration: 'none' }}
                          >
                            <Button
                              variant="text"
                              size="small"
                              sx={{ textTransform: 'none', fontWeight: 650 }}
                            >
                              Analyse öffnen
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>

        {/* --- Dialogs --- */}

        {/* Add Student Dialog */}
        <Dialog
          open={openAddStudent}
          onClose={() => setOpenAddStudent(false)}
          maxWidth="xs"
          fullWidth
        >
          <form onSubmit={handleAddStudent}>
            <DialogTitle sx={{ fontWeight: 800, color: '#0f172a' }}>
              Schüler/in einschreiben
            </DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ mt: 1 }}>
                {studentActionError && <Alert severity="error">{studentActionError}</Alert>}
                <TextField
                  label="Name des Schülers / der Schülerin"
                  placeholder="z.B. Max Mustermann"
                  fullWidth
                  variant="outlined"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  autoFocus
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                />
              </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 2, pt: 0 }}>
              <Button
                onClick={() => setOpenAddStudent(false)}
                sx={{ textTransform: 'none', fontWeight: 650 }}
              >
                Abbrechen
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={studentActionLoading}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  backgroundColor: '#1b77d1',
                  borderRadius: '8px',
                }}
              >
                {studentActionLoading ? <CircularProgress size={20} /> : 'Einschreiben'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>

        {/* Transfer Student Dialog */}
        <Dialog open={openTransfer} onClose={() => setOpenTransfer(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 800, color: '#0f172a' }}>
            Schüler/in umteilen (Klassentransfer)
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              {studentActionError && <Alert severity="error">{studentActionError}</Alert>}
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Teile den Schüler <strong>{selectedStudent?.name}</strong> in eine andere Klasse um.
                Alle seine Korrekturen und Noten werden mitgenommen.
              </Typography>
              <FormControl fullWidth>
                <InputLabel id="transfer-class-label">Zielklasse</InputLabel>
                <Select
                  labelId="transfer-class-label"
                  value={targetClassId}
                  label="Zielklasse"
                  onChange={(e) => setTargetClassId(e.target.value)}
                  sx={{ borderRadius: '8px' }}
                >
                  {allClasses
                    .filter((c) => c.id !== classId)
                    .map((c) => (
                      <MenuItem key={c.id} value={c.id}>
                        {c.name}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2, pt: 0 }}>
            <Button
              onClick={() => setOpenTransfer(false)}
              sx={{ textTransform: 'none', fontWeight: 650 }}
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleTransferStudent}
              variant="contained"
              disabled={studentActionLoading || !targetClassId}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                backgroundColor: '#1b77d1',
                borderRadius: '8px',
              }}
            >
              {studentActionLoading ? <CircularProgress size={20} /> : 'Umteilen'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Student Dialog */}
        <Dialog
          open={openDeleteStudent}
          onClose={() => setOpenDeleteStudent(false)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle sx={{ fontWeight: 800, color: '#0f172a' }}>
            Schüler/in austragen?
          </DialogTitle>
          <DialogContent>
            <Stack spacing={1.5}>
              {studentActionError && <Alert severity="error">{studentActionError}</Alert>}
              <Typography variant="body2" sx={{ color: 'text.primary' }}>
                Möchtest du <strong>{selectedStudent?.name}</strong> wirklich dauerhaft aus dieser
                Klasse austragen?
              </Typography>
              <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 600 }}>
                Achtung: Dies löscht unwiderruflich all seine Prüfungen, AI-Feedbacks und
                Korrekturergebnisse!
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2, pt: 0 }}>
            <Button
              onClick={() => setOpenDeleteStudent(false)}
              sx={{ textTransform: 'none', fontWeight: 650 }}
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleDeleteStudent}
              variant="contained"
              color="error"
              disabled={studentActionLoading}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '8px' }}
            >
              {studentActionLoading ? <CircularProgress size={20} /> : 'Austragen'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Class Dialog */}
        <Dialog
          open={openDeleteClass}
          onClose={() => setOpenDeleteClass(false)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle sx={{ fontWeight: 800, color: '#0f172a' }}>Klasse auflösen?</DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ color: 'text.primary', mb: 1 }}>
              Möchtest du die Klasse <strong>{classData?.name}</strong> wirklich auflösen?
            </Typography>
            <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 600 }}>
              Dabei werden alle eingeschriebenen Schüler, Prüfungen und Korrekturdaten dauerhaft
              gelöscht!
            </Typography>
          </DialogContent>
          <DialogActions sx={{ p: 2, pt: 0 }}>
            <Button
              onClick={() => setOpenDeleteClass(false)}
              sx={{ textTransform: 'none', fontWeight: 650 }}
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleDeleteClass}
              variant="contained"
              color="error"
              disabled={studentActionLoading}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '8px' }}
            >
              {studentActionLoading ? <CircularProgress size={20} /> : 'Klasse auflösen'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Edit Class Dialog */}
        <Dialog
          open={openEditClass}
          onClose={() => setOpenEditClass(false)}
          maxWidth="xs"
          fullWidth
        >
          <form onSubmit={handleEditClass}>
            <DialogTitle sx={{ fontWeight: 800, color: '#0f172a' }}>Klassenname ändern</DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <TextField
                  label="Neuer Klassenname"
                  fullWidth
                  variant="outlined"
                  value={editedClassName}
                  onChange={(e) => setEditedClassName(e.target.value)}
                  autoFocus
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                />
              </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 2, pt: 0 }}>
              <Button
                onClick={() => setOpenEditClass(false)}
                sx={{ textTransform: 'none', fontWeight: 650 }}
              >
                Abbrechen
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={studentActionLoading || !editedClassName.trim()}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  backgroundColor: '#1b77d1',
                  borderRadius: '8px',
                }}
              >
                {studentActionLoading ? <CircularProgress size={20} /> : 'Speichern'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
}
