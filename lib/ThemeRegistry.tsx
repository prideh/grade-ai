'use client';

import * as React from 'react';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { GlobalStyles } from '@mui/material';

const escolaTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1b77d1', // Escola Blue
      light: '#42a5f5',
      dark: '#1565c0',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#938eef', // Escola Lavender
      light: '#b388ff',
      dark: '#7e57c2',
      contrastText: '#ffffff',
    },
    background: {
      default: '#f8fafc', // Soft light gray page background
      paper: '#ffffff', // Pure white paper cards
    },
    text: {
      primary: '#333333', // Charcoal
      secondary: '#666666', // Medium Gray
      disabled: '#9e9e9e',
    },
    divider: '#e2e8f0', // Fine light-gray dividers
    success: {
      main: '#2e7d32', // Professional green
      contrastText: '#ffffff',
    },
    warning: {
      main: '#ed6c02', // Professional orange for sequence errors
      contrastText: '#ffffff',
    },
    error: {
      main: '#d32f2f', // Red for errors
      contrastText: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Nunito", "Inter", "system-ui", "-apple-system", sans-serif',
    h1: {
      fontWeight: 800,
      letterSpacing: '-0.02em',
      color: '#0f172a',
    },
    h2: {
      fontWeight: 800,
      letterSpacing: '-0.01em',
      color: '#0f172a',
    },
    h3: {
      fontWeight: 700,
      letterSpacing: '-0.01em',
      color: '#0f172a',
    },
    h4: {
      fontWeight: 700,
      color: '#0f172a',
    },
    h5: {
      fontWeight: 600,
      color: '#0f172a',
    },
    h6: {
      fontWeight: 600,
      color: '#0f172a',
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 8, // School standard, cleaner and slightly sharper rounded corners
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#f8fafc',
          color: '#333333',
          overflowX: 'hidden',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          padding: '8px 20px',
          transition: 'all 0.2s ease',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 2px 8px rgba(27, 119, 209, 0.15)',
          },
          '&.MuiButton-containedPrimary': {
            backgroundColor: '#1b77d1',
            color: '#ffffff',
            '&:hover': {
              backgroundColor: '#1565c0',
            },
          },
          '&.MuiButton-containedSecondary': {
            backgroundColor: '#938eef',
            color: '#ffffff',
            '&:hover': {
              backgroundColor: '#7e57c2',
            },
          },
        },
        outlined: {
          borderColor: '#e2e8f0',
          backgroundColor: '#ffffff',
          color: '#333333',
          '&:hover': {
            borderColor: '#cbd5e1',
            backgroundColor: '#f8fafc',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          border: '1px solid #e2e8f0',
          backgroundColor: '#ffffff',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          backgroundImage: 'none',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          border: '1px solid #e2e8f0',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            '& fieldset': {
              borderColor: '#e2e8f0',
            },
            '&:hover fieldset': {
              borderColor: '#cbd5e1',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#1b77d1',
            },
          },
        },
      },
    },
  },
});

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterCacheProvider>
      <ThemeProvider theme={escolaTheme}>
        <CssBaseline />
        <GlobalStyles
          styles={{
            '@media print': {
              'body, html': {
                backgroundColor: '#ffffff !important',
                color: '#000000 !important',
              },
              '.no-print': {
                display: 'none !important',
              },
              '.print-only': {
                display: 'block !important',
              },
              '#print-container': {
                display: 'block !important',
                position: 'absolute',
                left: 0,
                top: 0,
                width: '100%',
                backgroundColor: '#ffffff !important',
                color: '#000000 !important',
                padding: '0 !important',
                margin: '0 !important',
                zIndex: 999999,
              },
            },
            /* Minimalist school action buttons */
            '.glow-button': {
              position: 'relative',
              overflow: 'hidden',
              backgroundColor: '#1b77d1',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 4px rgba(27, 119, 209, 0.15)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            },
            '.glow-button:hover': {
              backgroundColor: '#1565c0',
              boxShadow: '0 4px 8px rgba(27, 119, 209, 0.25)',
              transform: 'translateY(-1px)',
            },
            '.glow-button:active': {
              transform: 'translateY(0)',
            },
          }}
        />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
