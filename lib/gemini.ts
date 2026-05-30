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
  id?: string;
  schuelerName: string;
  fach: string;
  datum: string;
  gesamterzieltePunkte: number;
  gesamtmaximalPunkte: number;
  note: string;
  studentExamUrl?: string;
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
   Runde das Ergebnis kaufmännisch auf die nächste Zehntelnote (z.B. 6.0, 5.7, 5.6, 5.0, 4.3, 4.0 etc.).
   Die beste Note ist 6.0 (hervorragend), die genügende Note (Bestehensgrenze) ist 4.0, und die schlechteste Note ist 1.0.
5. Vollständigkeit (Jede Aufgabe bewerten): Analysiere das gesamte eingereichte Blatt vollständig von oben nach unten. Identifiziere, transkribiere und korrigiere JEDE einzelne Aufgabe (z.B. Aufgabe 1, Aufgabe 2, Aufgabe 3 etc.), die auf dem Prüfungsblatt gelöst wurde. Lass niemals Aufgaben aus! Das "aufgaben" Array in deiner JSON-Rückgabe MUSS für jede auf dem Blatt vorhandene Aufgabe ein eigenes Objekt enthalten.

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
      "schuelerAntwort": "Transkription der Schülerantwort für Aufgabe 1",
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
    },
    {
      "aufgabeId": "2",
      "titel": "Aufgabe 2",
      "schuelerAntwort": "Transkription der Schülerantwort für Aufgabe 2",
      "erzieltePunkte": 5,
      "maximalPunkte": 5,
      "status": "Korrekt",
      "schritte": [
        {
          "schrittIndex": 1,
          "schrittText": "2x = 10",
          "istKorrekt": true,
          "fehlerTyp": "KeinFehler",
          "erreichtePunkte": 2.5,
          "maximalPunkte": 2.5,
          "begruendung": "Sehr gut vereinfacht."
        },
        {
          "schrittIndex": 2,
          "schrittText": "x = 5",
          "istKorrekt": true,
          "fehlerTyp": "KeinFehler",
          "erreichtePunkte": 2.5,
          "maximalPunkte": 2.5,
          "begruendung": "Korrekt nach x aufgelöst."
        }
      ],
      "lehrerKommentar": "Aufgabe fehlerfrei gelöst. Weiter so!"
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
export interface PredefinedTask {
  taskId: string;
  title: string;
  maxPoints: number;
}

export async function runLiveGeminiCorrection(
  studentExamImageBase64: string,
  rubric: string | { mimeType: string; data: string },
  modelName: 'gemini-3.5-flash' | 'gemini-3.1-pro-preview' = 'gemini-3.5-flash',
  customApiKey?: string,
  studentMimeType: string = 'image/jpeg',
  predefinedTasks?: PredefinedTask[]
): Promise<ExamCorrectionResult> {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not defined in environment variables.');
  }

  // Initialize the official Google Gen AI SDK
  const ai = new GoogleGenAI({ apiKey });

  try {
    const contents: (string | { inlineData: { mimeType: string; data: string } })[] = [];

    // Add student's written response (Base64 Image/PDF)
    contents.push({
      inlineData: {
        mimeType: studentMimeType,
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

    let finalPrompt = SYSTEM_PROMPT;
    if (predefinedTasks && predefinedTasks.length > 0) {
      finalPrompt = `${SYSTEM_PROMPT}

WICHTIGE ZUSATZVORGABE (STRIKTES TEMPLATE):
Die zu korrigierende Prüfung hat ein vordefiniertes Aufgaben-Template. Du MUSST die Schülerantworten exakt nach diesem Aufgaben-Template bewerten und strukturieren.
Erstelle im "aufgaben" Array in deiner JSON-Rückgabe exakt ein Objekt pro vordefinierter Aufgabe mit der entsprechenden "aufgabeId", dem "titel" und der exakten "maximalPunkte".
Verwende exakt folgende Aufgaben und deren Punktelimits:
${predefinedTasks.map((t) => `- Aufgabe ID: "${t.taskId}", Titel: "${t.title}", Maximalpunkte: ${t.maxPoints}`).join('\n')}

Regeln für dieses Template:
1. Erstelle KEINE Aufgaben in deiner JSON-Rückgabe, die nicht in dieser Liste aufgeführt sind.
2. Weiche NICHT von der vorgegebenen "aufgabeId", dem "titel" und der "maximalPunkte" ab.
3. Die Summe aller "maximalPunkte" im JSON MUSS exakt ${predefinedTasks.reduce((sum, t) => sum + t.maxPoints, 0)} entsprechen.
4. Die erreichte Punktzahl ("erzieltePunkte") darf für jede Aufgabe niemals grösser sein als die vorgegebene "maximalPunkte" für diese Aufgabe.
5. Die erreichten Punkte der Teilschritte ("schritte.erreichtePunkte") in einer Aufgabe müssen in der Summe exakt den "erzieltePunkte" der Aufgabe entsprechen und dürfen deren "maximalPunkte" nicht überschreiten.
`;
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: contents,
      config: {
        systemInstruction: finalPrompt,
        responseMimeType: 'application/json',
        temperature: 0.0, // Set to 0.0 for maximum determinism and consistency
        seed: 42, // Static seed to ensure highly reproducible sampling paths
      },
    });

    const responseText = response.text || '';

    // Extract only the matching JSON object payload using balanced brace counting
    const startIdx = responseText.indexOf('{');
    let cleanJson = responseText;

    if (startIdx !== -1) {
      let braceCount = 0;
      for (let i = startIdx; i < responseText.length; i++) {
        const char = responseText[i];
        if (char === '{') {
          braceCount++;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            cleanJson = responseText.substring(startIdx, i + 1);
            break;
          }
        }
      }
    } else {
      cleanJson = responseText
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
    }
    return JSON.parse(cleanJson) as ExamCorrectionResult;
  } catch (error) {
    console.error('Error during live Gemini correction call:', error);
    throw error;
  }
}
