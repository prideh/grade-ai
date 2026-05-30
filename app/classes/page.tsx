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
  IconButton,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import GroupIcon from '@mui/icons-material/Group';
import SchoolIcon from '@mui/icons-material/School';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import DashboardLayout from '@/components/DashboardLayout';

interface PrismaClassInfo {
  id: string;
  name: string;
  createdAt: string;
  _count: {
    students: number;
  };
}

interface ClassListItem extends PrismaClassInfo {
  totalExams: number;
  averageGrade: string;
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [defaultClassId, setDefaultClassId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('gradeai_default_class_id');
    }
    return null;
  });

  const handleToggleDefaultClass = (classId: string) => {
    if (defaultClassId === classId) {
      localStorage.removeItem('gradeai_default_class_id');
      setDefaultClassId(null);
    } else {
      localStorage.setItem('gradeai_default_class_id', classId);
      setDefaultClassId(classId);
    }
  };

  // Dialog State
  const [openCreate, setOpenCreate] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Fetch all classes
  const fetchClasses = React.useCallback(async () => {
    try {
      const res = await fetch('/api/classes');
      setError('');
      if (!res.ok) throw new Error('Fehler beim Laden der Klassen.');
      const data = await res.json();

      // For each class, fetch details to show total exams and class averages
      const detailedClasses = await Promise.all(
        (data.classes || []).map(async (cls: PrismaClassInfo) => {
          try {
            const detailRes = await fetch(`/api/classes/${cls.id}`);
            if (detailRes.ok) {
              const detailData = await detailRes.json();
              return {
                ...cls,
                totalExams: detailData.exams?.length || 0,
                averageGrade: detailData.stats?.averageGrade || 'N/A',
              };
            }
          } catch (e) {
            console.error('Error fetching details for class', cls.id, e);
          }
          return { ...cls, totalExams: 0, averageGrade: 'N/A' };
        })
      );

      setClasses(detailedClasses);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchClasses();
    });
  }, [fetchClasses]);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) {
      setCreateError('Bitte gib einen Klassennamen an.');
      return;
    }

    setCreateLoading(true);
    setCreateError('');

    try {
      const res = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newClassName }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Erstellen fehlgeschlagen.');
      }

      setOpenCreate(false);
      setNewClassName('');
      fetchClasses(); // Refresh
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Klasse konnte nicht erstellt werden.');
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* Header Action Block */}
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
              Klassenverwaltung
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', fontWeight: 550 }}>
              Erstelle und verwalte deine Schulklassen und verfolge deren Gesamtleistungen.
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
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
            Klasse erstellen
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
            <GroupIcon sx={{ fontSize: '4rem', color: '#94a3b8', mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#475569', mb: 1 }}>
              Keine Klassen gefunden
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: 'text.secondary', maxWidth: '400px', mx: 'auto', mb: 3 }}
            >
              Erstelle deine erste Schulklasse, um Schüler hinzuzufügen und handschriftliche
              Prüfungen korrigieren zu können.
            </Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setOpenCreate(true)}
              sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 650 }}
            >
              Erste Klasse erstellen
            </Button>
          </Card>
        ) : (
          <Grid container spacing={3}>
            {classes.map((cls) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={cls.id}>
                <Card
                  sx={{
                    borderRadius: '12px',
                    border: cls.id === defaultClassId ? '2px solid #1b77d1' : '1px solid #e2e8f0',
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
                      sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 2.5 }}
                    >
                      <Box>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                          <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                            {cls.name}
                          </Typography>
                          {cls.id === defaultClassId && (
                            <Chip
                              label="Standard"
                              size="small"
                              sx={{
                                height: '20px',
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                backgroundColor: '#1b77d1',
                                color: '#ffffff',
                                borderRadius: '4px',
                              }}
                            />
                          )}
                        </Stack>
                        <Typography
                          variant="caption"
                          sx={{ color: 'text.secondary', fontWeight: 600 }}
                        >
                          Erstellt am {new Date(cls.createdAt).toLocaleDateString('de-CH')}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Tooltip
                          title={
                            cls.id === defaultClassId
                              ? 'Standardklasse entfernen'
                              : 'Als Standardklasse festlegen'
                          }
                        >
                          <IconButton
                            size="small"
                            onClick={() => handleToggleDefaultClass(cls.id)}
                            sx={{
                              color: cls.id === defaultClassId ? '#eab308' : '#94a3b8',
                              padding: '4px',
                              '&:hover': {
                                color: cls.id === defaultClassId ? '#ca8a04' : '#64748b',
                                backgroundColor: '#f1f5f9',
                              },
                            }}
                          >
                            {cls.id === defaultClassId ? (
                              <StarIcon sx={{ fontSize: '1.5rem' }} />
                            ) : (
                              <StarBorderIcon sx={{ fontSize: '1.5rem' }} />
                            )}
                          </IconButton>
                        </Tooltip>
                        <Box
                          sx={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '8px',
                            backgroundColor: cls.id === defaultClassId ? '#fef9c3' : '#f0f7ff',
                            color: cls.id === defaultClassId ? '#ca8a04' : '#1b77d1',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <SchoolIcon sx={{ fontSize: '1.25rem' }} />
                        </Box>
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
                            Schüler/innen
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: '#334155' }}>
                            {cls._count.students} Schüler
                          </Typography>
                        </Stack>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Stack spacing={0.25}>
                          <Typography
                            variant="caption"
                            sx={{ color: 'text.secondary', fontWeight: 600 }}
                          >
                            Prüfungen
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: '#334155' }}>
                            {cls.totalExams} Prüfungen
                          </Typography>
                        </Stack>
                      </Grid>
                      <Grid size={{ xs: 12 }} sx={{ mt: 1 }}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                          <Typography
                            variant="caption"
                            sx={{ color: 'text.secondary', fontWeight: 600 }}
                          >
                            Notenschnitt (Ø):
                          </Typography>
                          {cls.averageGrade !== 'N/A' ? (
                            <Chip
                              label={cls.averageGrade}
                              size="small"
                              sx={{
                                backgroundColor:
                                  parseFloat(cls.averageGrade) >= 4.0 ? '#dcfce7' : '#fee2e2',
                                color: parseFloat(cls.averageGrade) >= 4.0 ? '#15803d' : '#b91c1c',
                                fontWeight: 'bold',
                                borderRadius: '6px',
                                fontSize: '0.8rem',
                              }}
                            />
                          ) : (
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.85rem' }}
                            >
                              Keine Noten
                            </Typography>
                          )}
                        </Stack>
                      </Grid>
                    </Grid>
                  </CardContent>

                  <CardActions sx={{ p: 2, pt: 0, justifyContent: 'flex-end' }}>
                    <Link href={`/classes/${cls.id}`} passHref style={{ textDecoration: 'none' }}>
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
                        Details & Roster
                      </Button>
                    </Link>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Dialog for Create Class */}
        <Dialog open={openCreate} onClose={() => setOpenCreate(false)} maxWidth="xs" fullWidth>
          <form onSubmit={handleCreateClass}>
            <DialogTitle sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
              Neue Klasse erstellen
            </DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ mt: 1 }}>
                {createError && <Alert severity="error">{createError}</Alert>}
                <TextField
                  label="Klassenbezeichnung"
                  placeholder="z.B. Klasse 9c"
                  fullWidth
                  variant="outlined"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  autoFocus
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '8px',
                    },
                  }}
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
                {createLoading ? <CircularProgress size={20} /> : 'Erstellen'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
}
