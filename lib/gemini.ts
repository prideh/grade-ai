import { GoogleGenAI } from '@google/genai';

// Interface for structured grading response
export interface CorrectedStep {
  schrittIndex: number;
  schrittText: string;
  istKorrekt: boolean;
  fehlerTyp: 'KeinFehler' | 'Rechenfehler' | 'Folgefehler' | 'SonstigerFehler';
  erreichtePunkte: number;
  maximalPunkte: number;
  begruendung: string;
}

export interface CorrectedTask {
  aufgabeId: string;
  titel: string;
  schuelerAntwort: string;
  erzieltePunkte: number;
  maximalPunkte: number;
  status: 'Korrekt' | 'Folgefehler' | 'Fehler';
  schritte: CorrectedStep[];
  lehrerKommentar: string;
}

export interface ExamCorrectionResult {
  schuelerName: string;
  fach: string;
  datum: string;
  gesamterzieltePunkte: number;
  gesamtmaximalPunkte: number;
  note: string;
  aufgaben: CorrectedTask[];
  schuelerFeedback: {
    staerken: string[];
    schwaechen: string[];
    hilfreicherTipp: string;
    uebungsEmpfehlung: string;
  };
}

// System prompt to instruct Gemini on OCR, math analysis, and Folgefehler calculations
const SYSTEM_PROMPT = `
Du bist ein professioneller, empathischer Lehrer und ein hochpräzises KI-Korrektur-System.
Deine Aufgabe ist es, handschriftliche Prüfungen von Schülern zu korrigieren, zu bewerten und ein detailliertes Feedback zu geben.

WICHTIGSTE REGELN FÜR DIE BEWERTUNG:
1. Handschrifterkennung: Lies die eingereichten Scans sorgfältig. Tolerierte leichte Schreibungenauigkeiten bei Kindern, solange die mathematische oder textuelle Aussage klar erkennbar ist.
2. Teilpunktvergabe (Partial Credits): Vergib Teilpunkte für jeden richtigen Teilschritt, auch wenn das Endergebnis falsch ist.
3. Folgefehler (Consequential/Carry-over Errors) - BESONDERS WICHTIG FÜR MATHE:
   - Wenn sich ein Schüler in Schritt N verrechnet (Rechenfehler), erhält er für diesen Teilschritt Punktabzug.
   - Wenn der Schüler in den nachfolgenden Schritten (Schritt N+1, N+2...) mit diesem FEHLERHAFTEN Wert (Folgewert) mathematisch vollkommen KORREKT weiterrechnet, darfst du für diese Folgeschritte KEINEN weiteren Punktabzug vornehmen!
   - Markiere solche Folge-Schritte explizit als "Folgefehler" (fehlerTyp: "Folgefehler") und vergib dafür die VOLLEN Teilpunkte des Teilschritts, da die logische Formelanwendung und das Prinzip korrekt waren.
4. Schweizer Notensystem: Berechne die Schulnote ("note") zwingend nach der offiziellen Schweizer Formel:
   Note = 5 * (gesamterzieltePunkte / gesamtmaximalPunkte) + 1.
   Runde das Ergebnis kaufmännisch auf die nächste halbe Note (z.B. 6.0, 5.5, 5.0, 4.5, 4.0, 3.5 etc.).
   Die beste Note ist 6.0 (hervorragend), die genügende Note (Bestehensgrenze) ist 4.0, und die schlechteste Note ist 1.0.

Deine Rückgabe MUSS ein valides, geparstes JSON-Objekt sein, das exakt dem folgenden TypeScript-Interface entspricht. Gib KEINEN Markdown-Wrapper (wie \`\`\`json) und keinen zusätzlichen Text aus. Nur das nackte JSON.

Schnittstellenstruktur:
{
  "schuelerName": "Name des Schülers",
  "fach": "Fach der Prüfung (z.B. Mathematik)",
  "datum": "Datum",
  "gesamterzieltePunkte": 21,
  "gesamtmaximalPunkte": 28,
  "note": "Schweizer Schulnote (z.B. 5.0 oder 5.5)",
  "aufgaben": [
    {
      "aufgabeId": "1",
      "titel": "Aufgabe 1",
      "schuelerAntwort": "Transkription der Schülerantwort",
      "erzieltePunkte": 4,
      "maximalPunkte": 5,
      "status": "Folgefehler", // "Korrekt" | "Folgefehler" | "Fehler"
      "schritte": [
        {
          "schrittIndex": 1,
          "schrittText": "4x = 16",
          "istKorrekt": false,
          "fehlerTyp": "Rechenfehler", // "KeinFehler" | "Rechenfehler" | "Folgefehler" | "SonstigerFehler"
          "erreichtePunkte": 0,
          "maximalPunkte": 1,
          "begruendung": "Es wurde fälschlicherweise 12 subtrahiert statt addiert."
        },
        {
          "schrittIndex": 2,
          "schrittText": "x = 4",
          "istKorrekt": true,
          "fehlerTyp": "Folgefehler",
          "erreichtePunkte": 2,
          "maximalPunkte": 2,
          "begruendung": "Folgefehler: Richtig durch 4 geteilt basierend auf dem falschen Zwischenschritt."
        }
      ],
      "lehrerKommentar": "Guter Rechenweg, leider ein kleiner Vorzeichenfehler zu Beginn, danach sauber weitergerechnet."
    }
  ],
  "schuelerFeedback": {
    "staerken": ["Stärke 1", "Stärke 2"],
    "schwaechen": ["Schwäche 1", "Schwäche 2"],
    "hilfreicherTipp": "Konkreter Tipp zur Fehlervermeidung",
    "uebungsEmpfehlung": "Konkrete Übungsaufgabe"
  }
}
`;
export async function runLiveGeminiCorrection(
  studentExamImageBase64: string,
  rubric: string | { mimeType: string; data: string },
  modelName: 'gemini-3.5-flash' | 'gemini-3.1-pro' = 'gemini-3.5-flash',
  customApiKey?: string
): Promise<ExamCorrectionResult> {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not defined in environment variables.');
  }

  // Initialize the official Google Gen AI SDK
  const ai = new GoogleGenAI({ apiKey });

  try {
    const contents: (string | { inlineData: { mimeType: string; data: string } })[] = [];

    // Add student's written response (Base64 Image)
    contents.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: studentExamImageBase64,
      },
    });

    // Add rubric context (Text or Image)
    if (typeof rubric === 'string') {
      contents.push(
        `Hier ist der Erwartungshorizont/Musterlösung für diese Prüfung:\n${rubric}\n\nBitte korrigiere die hochgeladene Schülerprüfung anhand dieser Vorgaben und liefere das geforderte JSON.`
      );
    } else {
      contents.push({
        inlineData: {
          mimeType: rubric.mimeType,
          data: rubric.data,
        },
      });
      contents.push(
        `Das oben stehende zweite Bild ist der Erwartungshorizont/Musterlösung für diese Prüfung. Bitte korrigiere die hochgeladene Schülerprüfung anhand dieses Bildes und liefere das geforderte JSON.`
      );
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: contents,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        temperature: 0.1, // Low temperature for consistent grading
      },
    });

    const responseText = response.text || '';

    // Clean any potential wrapper elements
    const cleanJson = responseText
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
    return JSON.parse(cleanJson) as ExamCorrectionResult;
  } catch (error) {
    console.error('Error during live Gemini correction call:', error);
    throw error;
  }
}
