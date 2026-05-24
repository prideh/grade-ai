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
  Stack,
  CircularProgress,
  Alert,
  Divider,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonIcon from '@mui/icons-material/Person';
import GroupIcon from '@mui/icons-material/Group';
import HistoryIcon from '@mui/icons-material/History';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import SchoolIcon from '@mui/icons-material/School';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AssignmentIcon from '@mui/icons-material/Assignment';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import { LineChart } from '@mui/x-charts/LineChart';
import DashboardLayout from '@/components/DashboardLayout';

export default function StudentDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params.id as string;

  // Data States
  const [student, setStudent] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [trajectory, setTrajectory] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  
  // Loading & Error States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch Student details and analytics
  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const res = await fetch(`/api/students/${studentId}`);
      if (!res.ok) {
        if (res.status === 404) {
          router.replace('/classes');
          return;
        }
        throw new Error('Schülerdetails konnten nicht geladen werden.');
      }
      
      const data = await res.json();
      setStudent(data.student);
      setStats(data.stats);
      setTrajectory(data.trajectory || []);
      setSubmissions(data.submissions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (studentId) {
      fetchData();
    }
  }, [studentId]);

  if (loading) {
    return (
      <DashboardLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
          <CircularProgress size={40} />
        </Box>
      </DashboardLayout>
    );
  }

  // Pre-process trajectory for MUI Line Chart
  const lineChartXData = trajectory.length > 0
    ? trajectory.map((item, index) => `${item.date}\n(${item.examTitle.split(':')[0]})`)
    : [];
  const lineChartYData = trajectory.length > 0
    ? trajectory.map((item) => item.grade)
    : [];

  return (
    <DashboardLayout>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* Back navigation and profile title */}
        <Stack spacing={2}>
          {student && (
            <Link href={`/classes/${student.classId}`} passHref style={{ textDecoration: 'none' }}>
              <Button startIcon={<ArrowBackIcon />} sx={{ textTransform: 'none', fontWeight: 650, color: 'text.secondary' }}>
                Zurück zur Klasse {student.className}
              </Button>
            </Link>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', mb: 0.5 }}>
                {student?.name} (Profil)
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                Klasse: {student?.className} • Eingeschrieben am {student?.createdAt}
              </Typography>
            </Box>
          </Box>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ borderRadius: '12px' }}>
            {error}
          </Alert>
        )}

        {/* 1. Student Summary Statistics Cards */}
        <Grid container spacing={3}>
          {/* Card 1: Student Average */}
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
                    Notenschnitt (Ø)
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a' }}>
                    {stats?.averageGrade}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Card 2: Comparison Class Average */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
              <CardContent sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '10px',
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <GroupIcon />
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                    Klassenschnitt (Ø)
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#475569' }}>
                    {stats?.classAverage}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Card 3: Exams taken */}
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
                  <AssignmentIcon />
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                    Korrigierte Arbeiten
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#ea580c' }}>
                    {stats?.totalExamsCorrected}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Card 4: Academic Performance indicator */}
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
                  <WorkspacePremiumIcon />
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                    Status
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 800,
                      color: stats?.averageGrade !== 'N/A' && parseFloat(stats?.averageGrade) >= 4.0 ? '#16a34a' : '#ef4444',
                    }}
                  >
                    {stats?.averageGrade !== 'N/A' && parseFloat(stats?.averageGrade) >= 4.0 ? 'Genügend' : 'Ungenügend'}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* 2. Visual Analytics: Performance Trajectory Line Chart */}
        <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mb: 2 }}>
              Notenverlauf (Trajektorie)
            </Typography>
            {trajectory.length === 0 ? (
              <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', py: 6, textAlign: 'center' }}>
                Bisher liegen keine bewerteten Notenergebnisse vor.
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <LineChart
                  xAxis={[{ scaleType: 'point', data: lineChartXData }]}
                  series={[
                    {
                      data: lineChartYData,
                      label: 'Note',
                      color: '#1b77d1',
                      valueFormatter: (v) => v?.toFixed(1) || '',
                    },
                  ]}
                  height={260}
                  width={680}
                  margin={{ top: 20, bottom: 40, left: 30, right: 20 }}
                />
              </Box>
            )}
          </CardContent>
        </Card>

        {/* 3. Deep AI Feedback Aggregator: Strengths, Weaknesses, Tips */}
        {stats?.totalExamsCorrected > 0 && (
          <Grid container spacing={4}>
            {/* Strengths Card */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'none', height: '100%' }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 800,
                      color: '#15803d',
                      mb: 2,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    <CheckCircleIcon /> Stärken (Konsolidiert)
                  </Typography>
                  {stats.strengths.length === 0 ? (
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                      Bisher keine spezifischen Stärken dokumentiert.
                    </Typography>
                  ) : (
                    <List sx={{ p: 0 }}>
                      {stats.strengths.map((str: string, idx: number) => (
                        <ListItem key={idx} sx={{ px: 0, py: 0.75 }}>
                          <ListItemIcon sx={{ minWidth: '32px', color: '#16a34a' }}>
                            <CheckCircleIcon sx={{ fontSize: '1.2rem' }} />
                          </ListItemIcon>
                          <ListItemText>
                            <Typography variant="body2" sx={{ fontSize: '0.9rem', color: '#334155', fontWeight: 550 }}>
                              {str}
                            </Typography>
                          </ListItemText>
                        </ListItem>
                      ))}
                    </List>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Weaknesses Card */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'none', height: '100%' }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 800,
                      color: '#b91c1c',
                      mb: 2,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    <ErrorIcon /> Entwicklungspotenzial (Fehlerquellen)
                  </Typography>
                  {stats.weaknesses.length === 0 ? (
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                      Bisher keine nennenswerten Schwächen festgestellt.
                    </Typography>
                  ) : (
                    <List sx={{ p: 0 }}>
                      {stats.weaknesses.map((weak: string, idx: number) => (
                        <ListItem key={idx} sx={{ px: 0, py: 0.75 }}>
                          <ListItemIcon sx={{ minWidth: '32px', color: '#dc2626' }}>
                            <ErrorIcon sx={{ fontSize: '1.2rem' }} />
                          </ListItemIcon>
                          <ListItemText>
                            <Typography variant="body2" sx={{ fontSize: '0.9rem', color: '#334155', fontWeight: 550 }}>
                              {weak}
                            </Typography>
                          </ListItemText>
                        </ListItem>
                      ))}
                    </List>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* AI Actionable Tips Log */}
            {stats.helpfulTips.length > 0 && (
              <Grid size={{ xs: 12 }}>
                <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 800,
                        color: '#ea580c',
                        mb: 2,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                      }}
                    >
                      <LightbulbIcon /> Konkrete Lerntipps & Übungshinweise
                    </Typography>
                    <List sx={{ p: 0 }}>
                      {stats.helpfulTips.map((tip: string, idx: number) => (
                        <ListItem key={idx} sx={{ px: 0, py: 1 }}>
                          <ListItemIcon sx={{ minWidth: '32px', color: '#ea580c' }}>
                            <LightbulbIcon sx={{ fontSize: '1.25rem' }} />
                          </ListItemIcon>
                          <ListItemText>
                            <Typography variant="body2" sx={{ fontSize: '0.925rem', color: '#0f172a', fontWeight: 600 }}>
                              {tip}
                            </Typography>
                          </ListItemText>
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        )}

        {/* 4. Submissions History Table */}
        <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
          <CardContent sx={{ p: 3 }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2.5 }}>
              <HistoryIcon sx={{ color: '#0f172a' }} />
              <Typography variant="h6" sx={{ fontWeight: 850, color: '#0f172a', letterSpacing: '-0.01em' }}>
                Prüfungshistorie des Schülers
              </Typography>
            </Stack>

            {submissions.length === 0 ? (
              <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', py: 4, textAlign: 'center' }}>
                Bisher wurden keine Prüfungsarbeiten für diesen Schüler hochgeladen.
              </Typography>
            ) : (
              <TableContainer component={Box} sx={{ border: '1px solid #f1f5f9', borderRadius: '8px' }}>
                <Table>
                  <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Prüfungstitel</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Fach</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Punkte</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Note</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Datum</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>Aktion</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {submissions.map((sub) => (
                      <TableRow key={sub.id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                        <TableCell sx={{ fontWeight: 650 }}>{sub.examTitle}</TableCell>
                        <TableCell>
                          <Chip label={sub.subject} size="small" sx={{ backgroundColor: '#f1f5f9', color: '#475569', fontWeight: 600 }} />
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
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>N/A</Typography>
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
          </CardContent>
        </Card>

      </Box>
    </DashboardLayout>
  );
}
