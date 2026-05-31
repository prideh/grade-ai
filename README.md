# Grade AI

Grade AI is an advanced K-12 grading and correction platform built for teachers. It automates and optimizes the tedious process of grading paper-based exams using modern multimodal artificial intelligence. By leveraging handwriting recognition (OCR) and deep mathematical reasoning, the application automates grading while keeping the teacher in complete control.

---

## 🌟 Key Capabilities

### 1. Multimodal OCR & Handwriting Recognition

- Deciphers complex student handwriting, mathematical symbols, fractions, variables, and cross-outs directly from uploaded images (JPEG, PNG) or PDF scans.
- Automatically transcribes the student's solution into a structured digital format for step-by-step evaluation.

### 2. Consequential Error Tracking (_Folgefehler_)

- Implements deep mathematical reasoning to analyze solution paths step-by-step.
- If a student makes an initial calculation mistake (_Rechenfehler_), points are deducted only for that specific step.
- If the student correctly applies subsequent formulas or logic using their incorrect intermediate values, Grade AI automatically identifies these as **Folgefehler** (carry-over errors).
- Student receives **full partial credits (_Teilpunkte_)** for subsequent steps, preventing unfair double-penalization in accordance with Swiss and European educational standards.

### 3. Automatic Rubric & Key Parsing

- Teachers can upload unstructured grading keys, text guides, or sample solutions (_Musterlösung_).
- A built-in AI parser deciphers the rubric files and automatically constructs a structured tasks template with pre-defined maximum points.

### 4. Swiss Linear Grading Scale

- Automatically calculates school grades according to the official linear Swiss grading formula:
  $$\text{Note} = 5 \times \left(\frac{\text{Gesamterzielte Punkte}}{\text{Gesamtmaximale Punkte}}\right) + 1$$
- Grades are rounded to the nearest $0.1$ increment (on a scale from $1.0$ to $6.0$, where $4.0$ is the passing threshold).

### 5. Interactive Grading Cockpit

- Shows the original student exam sheet or PDF side-by-side with the digital transcript.
- Simulates red-ink corrections with interactive visual boxes indicating errors and correct steps.
- Allows teachers to manually adjust points, toggle error types (No Error, Consequential Error, Other Error), write comments, and auto-save changes instantly directly to a PostgreSQL database.

### 6. Printable PDF Feedback Sheets

- Generates professional, ready-to-print feedback reports for students.
- Includes absolute score summaries, calculated grade, strengths/weaknesses breakdown, helpful advice, and tailored exercise recommendations.

---

## 🛠️ Technology Stack

- **Frontend & Routing:** Next.js 16 (App Router), React 19
- **Styling & UI:** Material UI (MUI), Emotion, Vanilla CSS
- **Database & ORM:** PostgreSQL, Prisma ORM
- **Artificial Intelligence:** Google Gemini 3.5 Flash / 3.1 Pro (via the official `@google/genai` SDK)
- **Containerization:** Docker & Docker Compose
- **Formatting & Quality:** ESLint, Prettier, Husky (Git commit hooks)

---

## 🚀 Getting Started

Follow these steps to set up and run the application locally:

### 1. Prerequisites

Ensure you have the following installed on your machine:

- **Node.js** (LTS version, v20 or higher recommended)
- **npm** (comes packaged with Node.js)
- **Docker / Docker Desktop** (for running the local PostgreSQL database container)

### 2. Install Dependencies

Run the package installation command from the project root directory:

```bash
npm install
```

### 3. Configure Environment Variables

Create a local environment configuration file:

1. Duplicate the template file:
   ```bash
   cp .env.example .env
   ```
2. Open the `.env` file and fill in the values:
   - `DATABASE_URL`: Pre-configured for the local Docker PostgreSQL container.
   - `GEMINI_API_KEY`: Provide a valid Google Gemini API key to enable handwriting OCR and AI-assisted grading.
   - `JWT_SECRET`: A secure, random string for authentication session tokens.

### 4. Start the Database

Ensure Docker Desktop is running, then spin up the PostgreSQL database container:

```bash
docker compose up -d
```

### 5. Initialize the Database Schema & Seeding

Prepare your database structures and generate the local Prisma client:

1. Generate the Prisma client:
   ```bash
   npx prisma generate
   ```
2. Push the schema design to the PostgreSQL database:
   ```bash
   npx prisma db push
   ```
3. Populate default classes, exams, students, and sample submissions:
   ```bash
   npx prisma db seed
   ```

   - _Note: The default credentials for testing the workspace are `lehrer@schule.ch` / `password123`._

### 6. Start the Development Server

Launch the local Next.js development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your web browser to explore Grade AI.

---

## 📂 Project Structure

- **`app/`**: Next.js App Router pages, client components, and API endpoints.
- **`components/`**: Shared reusable React UI components.
- **`lib/`**: Business logic, database client, AI integration helpers (`lib/gemini.ts`), and helper modules.
- **`prisma/`**: Prisma database schema (`schema.prisma`), migrations, and seeding scripts.
- **`proxy.ts`**: Edge routing, middleware, and reverse-proxy route handling.
