'use client';

import * as React from 'react';
import { useState } from 'react';
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
  FormControlLabel,
  Checkbox,
  Radio,
  RadioGroup,
  CircularProgress,
  Alert,
  IconButton,
  Divider,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DescriptionIcon from '@mui/icons-material/Description';
import DeleteIcon from '@mui/icons-material/Delete';
import SchoolIcon from '@mui/icons-material/School';
import SettingsIcon from '@mui/icons-material/Settings';
import FlashOnIcon from '@mui/icons-material/FlashOn';

export default function Dashboard() {
  const router = useRouter();
  const [model, setModel] = useState<'gemini-3.5-flash' | 'gemini-3.1-pro'>('gemini-3.5-flash');

  // File upload states
  const [studentFile, setStudentFile] = useState<File | null>(null);
  const [rubricFile, setRubricFile] = useState<File | null>(null);
  const [rubricText, setRubricText] = useState<string>('');

  // Loading & Error states
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [error, setError] = useState<string>('');

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

  const startAnalysis = async () => {
    if (!studentFile) {
      setError('Bitte lade eine Schülerarbeit (PDF oder Bild) hoch.');
      return;
    }

    setLoading(true);
    setError('');

    // Simulate progress steps
    const steps = [
      'Lese Dokumente ein...',
      'Entziffere Handschrift mit multimodaler KI...',
      'Lade Erwartungshorizont...',
      'Analysiere Lösungswege auf Folgenfehler...',
      'Vergebe Teilpunkte für Zwischenschritte...',
      'Generiere personalisiertes Schüler-Feedback...',
      'Bereite Korrektur-Workspace vor...',
    ];

    for (let i = 0; i < steps.length; i++) {
      setLoadingStep(steps[i]);
      await new Promise((resolve) => setTimeout(resolve, i === 1 || i === 3 ? 1200 : 700));
    }

    try {
      const formData = new FormData();
      if (studentFile) formData.append('studentExam', studentFile);
      if (rubricFile) {
        formData.append('rubric', rubricFile);
      } else {
        formData.append('rubric', rubricText || 'Standard Mathematik-Musterlösung');
      }
      formData.append('model', model);

      const res = await fetch('/api/correct', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Serverfehler während der Analyse');
      }

      const result = await res.json();
      sessionStorage.setItem('gradingResult', JSON.stringify(result));

      const slugify = (text: string) =>
        text
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');

      const slug = result.schuelerName ? slugify(result.schuelerName) : 'max-mustermann';
      router.push(`/correct/${slug}`);
    } catch (err) {
      const errMsg =
        err instanceof Error
          ? err.message
          : 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.';
      setError(errMsg);
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <Box
        component="header"
        sx={{
          padding: '16px 40px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          zIndex: 10,
        }}
      >
        <Link href="/" passHref style={{ textDecoration: 'none' }}>
          <Stack direction="row" spacing={1.5} sx={{ cursor: 'pointer', alignItems: 'center' }}>
            <Box
              sx={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#1b77d1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SchoolIcon sx={{ color: 'white', fontSize: '1rem' }} />
            </Box>
            <Typography
              variant="h6"
              component="span"
              sx={{
                fontWeight: 800,
                color: '#0f172a',
              }}
            >
              Grade
              <Box component="span" sx={{ color: '#1b77d1', fontWeight: 800 }}>
                Ai
              </Box>
            </Typography>
          </Stack>
        </Link>
        <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 550 }}>
          Dashboard
        </Typography>
      </Box>

      {/* Main body */}
      <Container
        maxWidth="lg"
        sx={{
          flex: 1,
          padding: '40px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '32px',
          position: 'relative',
        }}
      >
        <Box>
          <Typography
            variant="h4"
            component="h2"
            sx={{ fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}
          >
            Neue Korrektur starten
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', fontWeight: 500 }}>
            Lade deine Prüfungs-Scans und die Musterlösung hoch, um die automatisierte Korrektur zu
            starten.
          </Typography>
        </Box>

        {/* Error message */}
        {error && (
          <Alert severity="error" sx={{ borderRadius: '12px' }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={4}>
          {/* Left: Upload column */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Stack spacing={4}>
              {/* Student exam exam upload */}
              <Card>
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
                      ①
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
                        <Typography
                          variant="subtitle1"
                          sx={{ fontWeight: 650, color: 'success.main' }}
                        >
                          {studentFile.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {(studentFile.size / (1024 * 1024)).toFixed(2)} MB • Bereit für Analyse
                        </Typography>
                      </Stack>
                    ) : (
                      <Stack spacing={1.5} sx={{ alignItems: 'center' }}>
                        <CloudUploadIcon sx={{ fontSize: '3rem', color: 'text.secondary' }} />
                        <>
                          <Typography
                            variant="subtitle1"
                            sx={{ fontWeight: 650, color: 'text.primary' }}
                          >
                            Zieh deine Datei hierher oder klicke zum Auswählen
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            Unterstützt PDF, JPG, PNG • Max. 20MB
                          </Typography>
                        </>
                      </Stack>
                    )}
                  </Box>
                </CardContent>
              </Card>

              {/* Rubric / Musterlösung input */}
              <Card>
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
                      ②
                    </Box>{' '}
                    Erwartungshorizont / Musterlösung
                  </Typography>

                  <Stack spacing={2}>
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
                            sx={{ color: 'text.primary', fontWeight: 550 }}
                          >
                            {rubricFile.name}
                          </Typography>
                        </Stack>
                        <IconButton
                          onClick={() => setRubricFile(null)}
                          sx={{ color: 'error.main' }}
                          size="small"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    ) : (
                      <>
                        <TextField
                          placeholder="Trage hier die Musterlösung, Formeln oder Bepunktungsvorgaben ein (z.B. 'Aufgabe 1: 4x-12=8, Erg. x=5, Max 3P. Folgenfehler erlaubt')"
                          value={rubricText}
                          multiline
                          rows={4}
                          onChange={(e) => {
                            setRubricText(e.target.value);
                          }}
                          fullWidth
                          sx={{
                            backgroundColor: '#ffffff',
                          }}
                        />
                        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                          <Typography
                            variant="caption"
                            sx={{ color: 'text.secondary', fontWeight: 500 }}
                          >
                            Oder lade eine Datei hoch:
                          </Typography>
                          <input
                            type="file"
                            accept="application/pdf,text/plain,image/*"
                            id="rubricFile"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                // Selected file
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
                </CardContent>
              </Card>
            </Stack>
          </Grid>

          {/* Right: Settings panel */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ height: '100%' }}>
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
                  <SettingsIcon sx={{ color: 'primary.main', fontSize: '1.25rem' }} />{' '}
                  Korrektur-Optionen
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
                          border:
                            model === 'gemini-3.5-flash'
                              ? '1.5px solid #1b77d1'
                              : '1px solid #e2e8f0',
                          background: model === 'gemini-3.5-flash' ? '#f0f7ff' : '#ffffff',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            borderColor: '#1b77d1',
                            background: '#f8fafc',
                          },
                        }}
                      >
                        <Radio value="gemini-3.5-flash" size="small" />
                        <Box>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 700,
                              color: model === 'gemini-3.5-flash' ? '#1b77d1' : 'text.primary',
                            }}
                          >
                            Gemini 3.5 Flash
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ color: 'text.secondary', display: 'block', fontWeight: 500 }}
                          >
                            Standard (Hervorragende OCR & sehr schnell)
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
                            model === 'gemini-3.1-pro'
                              ? '1.5px solid #1b77d1'
                              : '1px solid #e2e8f0',
                          background: model === 'gemini-3.1-pro' ? '#f0f7ff' : '#ffffff',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            borderColor: '#1b77d1',
                            background: '#f8fafc',
                          },
                        }}
                      >
                        <Radio value="gemini-3.1-pro" size="small" />
                        <Box>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 700,
                              color: model === 'gemini-3.1-pro' ? '#1b77d1' : 'text.primary',
                            }}
                          >
                            Gemini 3.1 Pro
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ color: 'text.secondary', display: 'block', fontWeight: 500 }}
                          >
                            Thorough (Tiefgehendes Folgenfehler-Tracking)
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
                  sx={{
                    padding: '14px',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontWeight: 700,
                    marginTop: '10px',
                  }}
                >
                  Prüfung analysieren!
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>

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
    </Box>
  );
}
