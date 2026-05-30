# Grade AI

Grade AI is a Next.js application designed to automate and optimize grading workflows using artificial intelligence. It features an asynchronous grading queue, automatic student matching, and detailed audit capabilities.

This guide outlines the steps required to configure and run the application in a local development environment.

---

## Prerequisites

Before setting up the project, ensure you have the following installed on your machine:

- **Node.js** (LTS version, v20 or higher recommended)
- **npm** (comes packaged with Node.js)
- **Docker / Docker Desktop** (for running the local PostgreSQL database)

---

## Getting Started

Follow these steps to set up and run the repository locally:

### 1. Install Dependencies

Install the required npm packages from the project root:

```bash
npm install
```

### 2. Configure Environment Variables

The application requires environment variables for database connectivity, authentication, and AI services.

1. Create a `.env` file by duplicating the template:
   ```bash
   cp .env.example .env
   ```
2. Open the `.env` file and configure the values:
   - `DATABASE_URL`: Already pre-configured for the local Docker PostgreSQL container.
   - `GEMINI_API_KEY`: Provide a valid Gemini API key to enable AI grading features.
   - `JWT_SECRET`: Input a secure, random string for authentication session tokens.

### 3. Start the Database

Ensure Docker Desktop is running, then launch the PostgreSQL database container in the background:

```bash
docker compose up -d
```

### 4. Initialize the Database & Generate Prisma Client

Prepare the database schema and generate the customized Prisma client files:

1. Generate the Prisma client (output to `lib/generated/prisma` as configured in `schema.prisma`):
   ```bash
   npx prisma generate
   ```
2. Push the Prisma schema structure to your running PostgreSQL container:
   ```bash
   npx prisma db push
   ```
3. Populate the database with default teacher credentials and sample data:
   ```bash
   npx prisma db seed
   ```
   _(Required if you want to use the prefilled `lehrer@schule.ch` / `password123` credentials and view sample classes, students, and exams)._

### 5. Start the Development Server

Run the local Next.js development server:

```bash
npm run dev
```

The application will be accessible at [http://localhost:3000](http://localhost:3000).

---

## Project Structure

- **`app/`**: Next.js App Router pages and API routes.
- **`components/`**: Reusable React UI components.
- **`lib/`**: Shared utilities including authentication, database clients, and AI client helpers.
  - **`lib/generated/`**: Directory where the local Prisma client is generated.
- **`prisma/`**: Prisma ORM schema definition (`schema.prisma`), database migrations, and seed scripts.
- **`proxy.ts`**: Edge routing and reverse-proxy middleware configuration.
