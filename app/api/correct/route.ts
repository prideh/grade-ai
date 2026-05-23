import { NextResponse } from 'next/server';
import { runLiveGeminiCorrection } from '../../../lib/gemini';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const studentExam = formData.get('studentExam') as File | null;
    const rubric = formData.get('rubric') as File | string | null;
    const model = (formData.get('model') as string) || 'gemini-3.5-flash';
    // Retrieve API key from environment variable or client-side Authorization header
    let apiKey = process.env.GEMINI_API_KEY;
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const clientKey = authHeader.substring(7).trim();
      if (clientKey) {
        apiKey = clientKey;
      }
    }

    // Verify we have an API key configured
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'Gemini API-Schlüssel fehlt. Bitte trage deinen API-Schlüssel in der .env.local Datei ein.',
        },
        { status: 401 }
      );
    }

    // Otherwise, perform real Gemini multimodal evaluation!
    if (!studentExam) {
      return NextResponse.json(
        { error: 'Es wurde keine Schülerarbeit hochgeladen.' },
        { status: 400 }
      );
    }

    // Convert student exam to base64
    const studentBytes = await studentExam.arrayBuffer();
    const studentBase64 = Buffer.from(studentBytes).toString('base64');

    // Process rubric parameter (can be plain text, text file, or image/screenshot)
    let rubricParam: string | { mimeType: string; data: string } = '';
    if (rubric) {
      if (typeof rubric === 'string') {
        rubricParam = rubric;
      } else {
        const mimeType = rubric.type || '';
        const rubricBytes = await rubric.arrayBuffer();

        if (mimeType.startsWith('image/')) {
          const base64Data = Buffer.from(rubricBytes).toString('base64');
          rubricParam = { mimeType, data: base64Data };
        } else {
          // Default to UTF-8 text file reading for other file uploads
          rubricParam = Buffer.from(rubricBytes).toString('utf-8');
        }
      }
    } else {
      rubricParam =
        'Keine explizite Musterlösung hochgeladen. Korrigiere nach bestem fachlichen Wissen.';
    }

    const result = await runLiveGeminiCorrection(
      studentBase64,
      rubricParam,
      model as 'gemini-3.5-flash' | 'gemini-3.1-pro',
      apiKey
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in API /correct route:', error);
    const errMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Korrektur fehlgeschlagen: ' + errMessage }, { status: 500 });
  }
}
