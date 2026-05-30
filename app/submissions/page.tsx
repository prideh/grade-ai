'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Chip,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  IconButton,
  Stack,
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import DashboardLayout from '@/components/DashboardLayout';

interface ClassData {
  id: string;
  name: string;
}

interface ExamData {
  id: string;
  title: string;
  classId: string;
  className: string;
}

interface SubmissionData {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  examTitle: string;
  subject: string;
  points: string;
  grade: string;
  status: string;
  date: string;
  classId: string;
  examId: string;
}

export default function SubmissionsPage() {
  // Data States
  const [submissions, setSubmissions] = useState<SubmissionData[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [exams, setExams] = useState<ExamData[]>([]);

  // Loading & Error States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('ALL');
  const [selectedExamId, setSelectedExamId] = useState('ALL');

  // Fetch all data
  const fetchData = React.useCallback(async () => {
    try {
      // Fetch classes
      const classesRes = await fetch('/api/classes');
      setError('');

      if (classesRes.ok) {
        const classesData = await classesRes.json();
        setClasses(classesData.classes || []);
      }

      // Fetch exams
      const examsRes = await fetch('/api/exams');
      if (examsRes.ok) {
        const examsData = await examsRes.json();
        setExams(examsData.exams || []);
      }

      // Fetch all submissions (we fetch a larger subset for global listing)
      const res = await fetch('/api/submissions');
      if (!res.ok) throw new Error('Fehler beim Laden der Korrekturen.');
      const data = await res.json();

      setSubmissions(data.submissions || []);
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

  const handleDeleteSubmission = async (id: string) => {
    if (
      !confirm(
        'Möchtest du diese Korrektur wirklich löschen? Dieser Schritt kann nicht rückgängig gemacht werden.'
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/submissions/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Korrektur konnte nicht gelöscht werden.');
      }

      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler beim Löschen.');
    }
  };

  // Filter Logic
  const filteredSubmissions = submissions
    .filter((sub) => sub.status === 'COMPLETED')
    .filter((sub) => {
      // 1. Search Query (name or exam title)
      const matchSearch =
        sub.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sub.examTitle.toLowerCase().includes(searchQuery.toLowerCase());

      const matchClassId = selectedClassId === 'ALL' || sub.classId === selectedClassId;
      const matchExamId = selectedExamId === 'ALL' || sub.examId === selectedExamId;

      return matchSearch && matchClassId && matchExamId;
    });

  return (
    <DashboardLayout>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* Header Section */}
        <Box>
          <Typography
            variant="h4"
            sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', mb: 1 }}
          >
            Korrekturen-Historie
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', fontWeight: 550 }}>
            Übersicht über alle handschriftlich korrigierten Arbeiten, deren Ergebnisse und
            AI-Feedbacks.
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ borderRadius: '12px' }}>
            {error}
          </Alert>
        )}

        {/* Filters Card */}
        <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
          <CardContent sx={{ p: 3 }}>
            <Grid container spacing={2} sx={{ alignItems: 'center' }}>
              {/* Search Bar */}
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  placeholder="Schüler/in oder Prüfung suchen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  fullWidth
                  variant="outlined"
                  size="small"
                  slotProps={{
                    input: {
                      startAdornment: (
                        <SearchIcon sx={{ color: 'text.secondary', mr: 1, fontSize: '1.2rem' }} />
                      ),
                    },
                  }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                />
              </Grid>

              {/* Class Filter */}
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <FormControl fullWidth size="small">
                  <InputLabel id="class-filter-label">Klasse</InputLabel>
                  <Select
                    labelId="class-filter-label"
                    value={selectedClassId}
                    label="Klasse"
                    onChange={(e) => {
                      setSelectedClassId(e.target.value);
                      setSelectedExamId('ALL'); // Reset exam filter when class changes
                    }}
                    sx={{ borderRadius: '8px' }}
                  >
                    <MenuItem value="ALL">Alle Klassen</MenuItem>
                    {classes.map((c) => (
                      <MenuItem key={c.id} value={c.id}>
                        {c.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Exam Filter */}
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <FormControl fullWidth size="small">
                  <InputLabel id="exam-filter-label">Prüfung</InputLabel>
                  <Select
                    labelId="exam-filter-label"
                    value={selectedExamId}
                    label="Prüfung"
                    onChange={(e) => setSelectedExamId(e.target.value)}
                    sx={{ borderRadius: '8px' }}
                  >
                    <MenuItem value="ALL">Alle Prüfungen</MenuItem>
                    {exams
                      .filter((ex) => selectedClassId === 'ALL' || ex.classId === selectedClassId)
                      .map((ex) => (
                        <MenuItem key={ex.id} value={ex.id}>
                          {ex.title.split(':')[0]} ({ex.className})
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Submissions Grid Table */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : filteredSubmissions.length === 0 ? (
          <Card
            sx={{
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: 'none',
              p: 5,
              textAlign: 'center',
            }}
          >
            <HistoryIcon sx={{ fontSize: '3rem', color: '#94a3b8', mb: 1.5 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#475569', mb: 0.5 }}>
              Keine Korrekturen gefunden
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Passe deine Filter an oder starte eine neue Prüfungskorrektur im Workspace.
            </Typography>
          </Card>
        ) : (
          <TableContainer
            component={Paper}
            sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'none' }}
          >
            <Table>
              <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Schüler/in</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Klasse</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Prüfung</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Fach</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Punkte</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Note</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Datum</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>Aktion</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredSubmissions.map((sub) => {
                  const isUnassigned = !sub.studentId;
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
                      <TableCell sx={{ fontWeight: 700 }}>
                        {sub.studentId ? (
                          <Link
                            href={`/students/${sub.studentId}`}
                            style={{ textDecoration: 'none', color: '#1b77d1' }}
                          >
                            {sub.studentName}
                          </Link>
                        ) : (
                          <Stack spacing={0.5} sx={{ py: 0.5 }}>
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
                            <Typography
                              variant="caption"
                              sx={{
                                color: '#b45309',
                                fontStyle: 'italic',
                                fontWeight: 600,
                              }}
                            >
                              (Bitte auf dem Dashboard zuordnen)
                            </Typography>
                          </Stack>
                        )}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{sub.className}</TableCell>
                      <TableCell>{sub.examTitle}</TableCell>
                      <TableCell>
                        <Chip
                          label={sub.subject}
                          size="small"
                          sx={{ backgroundColor: '#e3f2fd', color: '#1b77d1', fontWeight: 650 }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{sub.points}</TableCell>
                      <TableCell>
                        <Chip
                          label={sub.grade}
                          size="small"
                          sx={{
                            backgroundColor: parseFloat(sub.grade) >= 4.0 ? '#1b77d1' : '#dc2626',
                            color: '#ffffff',
                            fontWeight: 'bold',
                            borderRadius: '6px',
                          }}
                        />
                      </TableCell>
                      <TableCell>{sub.date}</TableCell>
                      <TableCell sx={{ textAlign: 'right' }}>
                        <Box
                          sx={{
                            display: 'flex',
                            gap: '8px',
                            justifyContent: 'flex-end',
                            alignItems: 'center',
                          }}
                        >
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
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteSubmission(sub.id)}
                            title="Korrektur löschen / abbrechen"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </DashboardLayout>
  );
}
