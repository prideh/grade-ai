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
  Stack,
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
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import SearchIcon from '@mui/icons-material/Search';
import DashboardLayout from '@/components/DashboardLayout';

export default function SubmissionsPage() {
  // Data States
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  
  // Loading & Error States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('ALL');
  const [selectedExamId, setSelectedExamId] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Fetch all data
  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch classes
      const classesRes = await fetch('/api/classes');
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
      
      // Load detailed submissions to get original structures if needed
      // (The dashboard maps recent submissions. For the full submissions page, let's fetch and map them dynamically).
      // Since `/api/submissions` returns mapped summaries, we can use that list or fetch details if we need to filter on relational fields.
      // Let's inspect the `/api/submissions` response: it has studentName, examTitle, subject, grade, points, date, and id.
      // To filter by classId and examId, we can add these fields to our mapped response or we can fetch a larger subset.
      // Actually, since this is a global list, let's make sure our local state has the class and exam associations, or we can filter them by string matching since it is extremely reliable in a POC!
      // Let's check: the mapped structures returned by `/api/submissions` contain examTitle, studentName, subject, etc.
      // We can enrich the API response or perform string matches. Or wait, let's look at `/api/submissions` route again.
      // In `/api/submissions/route.ts`, it fetches submissions and maps:
      // `id`, `studentName`, `examTitle`, `subject`, `grade`, `points`, `date`.
      // Let's modify the local submissions state or call details. In this page, let's fetch the list, and since they are mapped summaries, we can match string titles or we can fetch all submissions via Prisma directly if we want!
      // Better yet, we can fetch all submissions directly, or since the API is fast, we can use the submissions summary returned and map them nicely.
      // Let's see: we want to filter by Class and Exam. In the database, every submission has `student.class.name` and `exam.title`.
      // We can easily filter the returned submissions using string matching, e.g., matching the `examTitle` or `studentName`!
      // Let's fetch the list first.
      setSubmissions(data.submissions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter Logic
  const filteredSubmissions = submissions.filter((sub) => {
    // 1. Search Query (name or exam title)
    const matchSearch =
      sub.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.examTitle.toLowerCase().includes(searchQuery.toLowerCase());
    
    // 2. Class Filter (string matching)
    let matchClass = true;
    if (selectedClassId !== 'ALL') {
      const cls = classes.find((c) => c.id === selectedClassId);
      // Wait, since we mapped submissions, does the sub have class name?
      // Our seeded submissions have class names implicitly, or we can query.
      // Let's see: if we look at the class selected, we can see if student name or exam fits.
      // Wait, let's look at how we can filter. A much cleaner way to ensure absolute relational correctness is to fetch submissions directly or match by Class ID.
      // Wait, in `app/api/submissions/route.ts`, the submissions fetched can include the `classId` and `examId` to make filtering 100% robust!
      // Let's check: let's modify `/api/submissions/route.ts` slightly to include `classId`, `examId`, and `status` in the JSON response!
      // This is a brilliant and robust way. Let's look at `app/api/submissions/route.ts` again.
      // It returns:
      // id: sub.id, studentName: sub.student.name, examTitle: sub.exam.title, subject: sub.exam.subject, grade: sub.gradeRounded, points: ..., date: ...
      // If we add: `classId: sub.exam.classId, examId: sub.examId, status: sub.status`, we can filter perfectly!
      // Let's do that in a bit! For now, let's write the frontend filtering logic assuming we have `classId`, `examId`, and `status` in our list items.
    }
    
    // For now, let's write the filters in a flexible way:
    const matchClassId = selectedClassId === 'ALL' || sub.classId === selectedClassId;
    const matchExamId = selectedExamId === 'ALL' || sub.examId === selectedExamId;
    const matchStatus = selectedStatus === 'ALL' || sub.status === selectedStatus;

    return matchSearch && matchClassId && matchExamId && matchStatus;
  });

  return (
    <DashboardLayout>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* Header Section */}
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', mb: 1 }}>
            Korrekturen-Historie
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', fontWeight: 550 }}>
            Übersicht über alle handschriftlich korrigierten Arbeiten, deren Ergebnisse und AI-Feedbacks.
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
                      startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1, fontSize: '1.2rem' }} />,
                    },
                  }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                />
              </Grid>

              {/* Class Filter */}
              <Grid size={{ xs: 12, sm: 4, md: 3 }}>
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
              <Grid size={{ xs: 12, sm: 4, md: 3 }}>
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

              {/* Status Filter */}
              <Grid size={{ xs: 12, sm: 4, md: 2 }}>
                <FormControl fullWidth size="small">
                  <InputLabel id="status-filter-label">Status</InputLabel>
                  <Select
                    labelId="status-filter-label"
                    value={selectedStatus}
                    label="Status"
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    sx={{ borderRadius: '8px' }}
                  >
                    <MenuItem value="ALL">Alle Status</MenuItem>
                    <MenuItem value="COMPLETED">Abgeschlossen</MenuItem>
                    <MenuItem value="DRAFT">Entwurf</MenuItem>
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
          <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'none', p: 5, textAlign: 'center' }}>
            <HistoryIcon sx={{ fontSize: '3rem', color: '#94a3b8', mb: 1.5 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#475569', mb: 0.5 }}>
              Keine Korrekturen gefunden
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Passe deine Filter an oder starte eine neue Prüfungskorrektur im Workspace.
            </Typography>
          </Card>
        ) : (
          <TableContainer component={Paper} sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
            <Table>
              <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Schüler/in</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Klasse</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Prüfung</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Fach</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Punkte</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Note</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Datum</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>Aktion</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredSubmissions.map((sub) => (
                  <TableRow key={sub.id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                    <TableCell sx={{ fontWeight: 700 }}>
                      <Link href={`/students/${sub.studentId}`} style={{ textDecoration: 'none', color: '#1b77d1' }}>
                        {sub.studentName}
                      </Link>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{sub.className}</TableCell>
                    <TableCell>{sub.examTitle}</TableCell>
                    <TableCell>
                      <Chip label={sub.subject} size="small" sx={{ backgroundColor: '#e3f2fd', color: '#1b77d1', fontWeight: 650 }} />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{sub.points}</TableCell>
                    <TableCell>
                      {sub.status === 'COMPLETED' ? (
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
                      ) : (
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>—</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={sub.status === 'COMPLETED' ? 'Abgeschlossen' : 'Entwurf'}
                        size="small"
                        color={sub.status === 'COMPLETED' ? 'success' : 'warning'}
                        variant="outlined"
                        sx={{ fontWeight: 'bold' }}
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
        )}

      </Box>
    </DashboardLayout>
  );
}
