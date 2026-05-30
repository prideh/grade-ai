import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { GoogleGenAI } from '@google/genai';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 });
    }

    const body = await request.json();
    const { rubricText } = body;

    if (!rubricText) {
      return NextResponse.json({ error: 'Musterlösung fehlt.' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API-Schlüssel ist nicht konfiguriert.' },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const contents: (string | { inlineData: { mimeType: string; data: string } })[] = [];

    // Parse the rubric payload (could be image/pdf in base64 or plain text)
    if (rubricText.startsWith('{"mimeType":')) {
      try {
        const parsed = JSON.parse(rubricText);
        contents.push({
          inlineData: {
            mimeType: parsed.mimeType,
            data: parsed.data,
          },
        });
      } catch {
        contents.push(rubricText);
      }
    } else {
      contents.push(rubricText);
    }

    const PARSE_PROMPT = `
Analysiere die bereitgestellte Musterlösung / Erwartungshorizont für eine Prüfung.
Deine Aufgabe ist es, alle einzelnen Aufgaben (z.B. Aufgabe 1, Aufgabe 2, etc.) zu identifizieren und die dafür vorgesehenen maximalen Punkte herauszulesen.
Achte besonders auf Punktangaben wie "(4 Punkte)", "[5 P.]", "Maximal 3 Punkte", oder ähnliches in der Nähe des Aufgabentitels.

Gib das Ergebnis als valides JSON-Array zurück. Verwende exakt folgende JSON-Struktur und keinen zusätzlichen Text oder Markdown-Umschlag:
[
  {
    "taskId": "1",
    "title": "Aufgabe 1",
    "maxPoints": 4.0
  },
  {
    "taskId": "2",
    "title": "Aufgabe 2",
    "maxPoints": 5.0
  }
]

Regeln:
1. "taskId" muss eine eindeutige ID sein (z.B. "1", "2", "3a").
2. "title" sollte ein schöner, lesbarer Titel sein (z.B. "Aufgabe 1", "Aufgabe 2").
3. "maxPoints" muss eine positive Gleitkommazahl sein. Wenn keine Punkte lesbar sind, schätze einen sinnvollen Standardwert (z.B. 4.0 oder 5.0) basierend auf der Komplexität der Aufgabe.
`;

    contents.push(PARSE_PROMPT);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', // Fast and accurate for parsing tasks
      contents: contents,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1, // Highly consistent output
      },
    });

    const responseText = response.text || '';
    // Extract only the matching JSON array payload using balanced bracket counting
    const startIdx = responseText.indexOf('[');
    let cleanJson = responseText;

    if (startIdx !== -1) {
      let bracketCount = 0;
      for (let i = startIdx; i < responseText.length; i++) {
        const char = responseText[i];
        if (char === '[') {
          bracketCount++;
        } else if (char === ']') {
          bracketCount--;
          if (bracketCount === 0) {
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
    const parsedTasks = JSON.parse(cleanJson);

    return NextResponse.json({ success: true, tasks: parsedTasks });
  } catch (error) {
    console.error('Error parsing rubric text:', error);
    return NextResponse.json(
      { error: 'Die Musterlösung konnte nicht analysiert werden.' },
      { status: 500 }
    );
  }
}
