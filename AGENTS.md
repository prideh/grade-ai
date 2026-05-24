<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

- **Edge Routing / Middleware:** Use `proxy.ts` in the root instead of `middleware.ts`. Export a named `proxy` function (e.g., `export async function proxy(request: NextRequest)`) instead of a default `middleware` export. Using `middleware.ts` will trigger Next.js 16 deprecation warnings.

<!-- END:nextjs-agent-rules -->

# Audit Agent Shortcut Instruction Set

Whenever the user requests an audit, e.g. with prompts like `"audit the latest change"`, `"audit changes"`, or `"git diff audit"`, the agent should:

1. Proactively execute terminal commands `git status` or `git diff HEAD~1` (or comparison against main/current changes) in the workspace to locate recently modified or staged files.
2. Read the diffs and perform a high-value senior developer audit evaluating:
   - **Security**: Timing attack vulnerabilities (timingSafeEqual), cryptographic validation of JWT production keys, credential handling.
   - **Performance**: N+1 loop-nested database operations, redundant API roundtrips (e.g. duplicate session validations), unoptimized state rendering.
   - **Modern Practices & UX**: SPA standards (avoiding hard document reloads), Next.js 16/Prisma 7 conventions.
3. Present findings in a structured, actionable dashboard table including Severity, Component, Issue, Impact, and a clean suggested code optimization block.

# Style, Research & Collaboration Standards

- **Verbosity & Tone:** Avoid greetings, polite intros, and generic conversational filler. Get straight to the technical content. Keep explanations balanced: be clear and thorough where needed, but keep comments structured, direct, and free of conversational padding.
- **Fact Verification:** Prioritize running proactive Google searches to double-check framework-specific conventions, library changes, and breaking APIs (especially for new versions like Next.js 16+ or Prisma 7+) before proposing major changes. Never guess.
- **Requirement Clarification:** If any business logic, requirement, layout expectation, or user intent is ambiguous or underspecified, stop and ask the user directly for clarification instead of making assumptions.
- **Root-Cause Code Integrity (No Band-Aids):** Avoid short-term hacks, temporary "band-aid" overrides (e.g. arbitrary timeouts, suppressing typescript warnings, or wrapping broken code in silent try-catch blocks). Address the root cause of issues, write fully typed, structurally sound, and clean code that aligns with the project's long-term architecture.
- **No Git Hook Bypassing:** Never bypass Git hooks (such as Husky) under any circumstances. Never use flags like `--no-verify`, `-n`, or custom environment overrides that disable pre-commit or pre-push checks. If a lint check, type compilation, or test suite fails, resolve the root cause of the failures rather than bypassing the validation.
- **Swiss German Spelling Standards (No "ß"):** Always use "ss" instead of "ß" in any user-facing text, notifications, comments, code, or documentation. Swiss German spelling conventions do not use the "ß" character.
