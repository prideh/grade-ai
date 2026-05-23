import { ExamCorrectionResult } from './gemini';

export const MOCK_EXAM_RESULT: ExamCorrectionResult = {
  schuelerName: 'Max Mustermann',
  fach: 'Mathematik & Naturwissenschaften',
  datum: '22. Mai 2026',
  gesamterzieltePunkte: 12.5,
  gesamtmaximalPunkte: 16,
  note: '2-',
  aufgaben: [
    {
      aufgabeId: '1',
      titel: 'Aufgabe 1: Lineare Gleichungen',
      schuelerAntwort: '4x - 12 = 8\n4x = 16\nx = 4',
      erzieltePunkte: 2,
      maximalPunkte: 3,
      status: 'Folgenfehler',
      schritte: [
        {
          schrittIndex: 1,
          schrittText: '4x = 16',
          istKorrekt: false,
          fehlerTyp: 'Rechenfehler',
          erreichtePunkte: 0,
          maximalPunkte: 1,
          begruendung:
            'Rechenfehler: Es wurde fälschlicherweise 12 auf beiden Seiten abgezogen (-12) anstatt addiert (+12). Korrekt wäre: 4x = 20.',
        },
        {
          schrittIndex: 2,
          schrittText: 'x = 4',
          istKorrekt: true,
          fehlerTyp: 'Folgenfehler',
          erreichtePunkte: 2,
          maximalPunkte: 2,
          begruendung:
            'Folgenfehler: Basierend auf der vorherigen fehlerhaften Zeile (4x = 16) wurde die Äquivalenzumformung (Division durch 4) mathematisch fehlerfrei und konsequent ausgeführt. Daher volle Teilpunktzahl für diesen Schritt!',
        },
      ],
      lehrerKommentar:
        'Sehr guter und sauber aufgeschriebener Rechenweg! Du hast dich leider direkt im ersten Schritt beim Vorzeichen vertan (-12 statt +12). Da du danach aber absolut fehlerfrei mit deinem Zwischenergebnis weitergerechnet hast, erhältst du vollen Punktabzug für den Rechenfehler, aber volle Punkte für den Folgeschritt (Folgenfehler-Regel).',
    },
    {
      aufgabeId: '2',
      titel: 'Aufgabe 2: Quadratische Gleichungen (Mitternachtsformel)',
      schuelerAntwort:
        'x^2 - 6x + 8 = 0\nx = [ 6 +- sqrt(36 - 4*1*7) ] / 2\nx = [ 6 +- sqrt(36 - 28) ] / 2\nx = [ 6 +- sqrt(8) ] / 2\nx = (6 +- 2.83) / 2',
      erzieltePunkte: 4.5,
      maximalPunkte: 5,
      status: 'Folgenfehler',
      schritte: [
        {
          schrittIndex: 1,
          schrittText: 'Abschreibfehler (c = 7 statt c = 8)',
          istKorrekt: false,
          fehlerTyp: 'Rechenfehler',
          erreichtePunkte: 0.5,
          maximalPunkte: 1,
          begruendung:
            'Abschreibfehler: Der Wert für c wurde fälschlicherweise als 7 statt 8 aus der Angabe übernommen. Abzug von 0,5 Punkten.',
        },
        {
          schrittIndex: 2,
          schrittText: 'Einsetzen in Formel & Ausrechnen',
          istKorrekt: true,
          fehlerTyp: 'Folgenfehler',
          erreichtePunkte: 4,
          maximalPunkte: 4,
          begruendung:
            'Folgenfehler: Die Mitternachtsformel wurde korrekt notiert und alle weiteren Rechenschritte inklusive Wurzelziehen und Division wurden mit dem fehlerhaften Wert c = 7 konsequent richtig gelöst.',
        },
      ],
      lehrerKommentar:
        'Ein ärgerlicher Abschreibfehler zu Beginn (7 statt 8), aber danach exzellent und formelgetreu gerechnet. Gut gemacht!',
    },
    {
      aufgabeId: '3',
      titel: 'Aufgabe 3: Biologie (Photosynthese)',
      schuelerAntwort:
        'Pflanzen brauchen Licht, Wasser und Kolendioxid um Sauerstoff und Zucker herzustellen. Das machen sie in den Chloroplasten.',
      erzieltePunkte: 6,
      maximalPunkte: 8,
      status: 'Korrekt',
      schritte: [
        {
          schrittIndex: 1,
          schrittText: 'Inhaltliche Erklärung',
          istKorrekt: true,
          fehlerTyp: 'KeinFehler',
          erreichtePunkte: 6,
          maximalPunkte: 6,
          begruendung:
            'Die biologischen Ausgangsstoffe (Wasser, Kohlendioxid, Licht) und die Endprodukte (Sauerstoff, Glucose/Zucker) sowie der Ort (Chloroplasten) wurden inhaltlich vollkommen korrekt wiedergegeben.',
        },
        {
          schrittIndex: 2,
          schrittText: 'Rechtschreibung (Kolendioxid)',
          istKorrekt: false,
          fehlerTyp: 'SonstigerFehler',
          erreichtePunkte: 0,
          maximalPunkte: 2,
          begruendung:
            "Rechtschreibfehler: 'Kolendioxid' schreibt man mit 'h' (Kohlendioxid). Dafür gibt es einen leichten Abzug in der Darstellungsleistung.",
        },
      ],
      lehrerKommentar:
        'Biologisch hast du das Thema perfekt verstanden! Achte in Zukunft noch etwas auf die korrekte Schreibweise der Fachbegriffe (Kohlendioxid).',
    },
  ],
  schuelerFeedback: {
    staerken: [
      'Hervorragendes Verständnis von Äquivalenzumformungen in der Algebra.',
      'Sichere Anwendung komplexer Formeln wie der Mitternachtsformel.',
      'Sehr gute inhaltliche Wiedergabe biologischer Prozesse (Photosynthese).',
    ],
    schwaechen: [
      'Flüchtigkeitsfehler bei Vorzeichen beim Seitenwechsel von Termen.',
      'Ungenauigkeiten beim Übertragen von Variablenwerten aus der Aufgabenstellung.',
      'Kleine Rechtschreibfehler bei naturwissenschaftlichen Fachbegriffen.',
    ],
    hilfreicherTipp:
      'Mache bei Gleichungsauflösungen immer eine kurze Gegenprobe (Einsetzen des Ergebnisses in die Ausgangsgleichung), um Vorzeichenfehler sofort zu bemerken. Schau dir beim Abschreiben die Zahlen lieber zweimal an!',
    uebungsEmpfehlung:
      'Löse 3 Aufgaben zur Mitternachtsformel auf Seite 84 und achte besonders darauf, die Werte für a, b und c farbig zu markieren, bevor du sie einsetzt.',
  },
};
