# Copilot instructions for Pico Design

## Project context
- This repository is a Next.js 14 app using the App Router and TypeScript.
- The app generates print-ready PDFs from uploaded product images for Pico production workflows.
- Authentication is enforced by middleware and Supabase.
- PDF generation runs on the Node.js runtime because it depends on `sharp` and `pdf-lib`.

## Architecture
- `app/` contains routes and UI screens.
- `components/` holds client-side UI components.
- `lib/pdf/` contains the real PDF generation logic and unit conversions.
- `lib/supabase/` contains Supabase browser/server/admin clients.
- `supabase/migrations/` contains the database schema, which must be executed in the Supabase dashboard before local use.

## Working rules
- Prefer the existing project patterns and naming conventions over inventing new ones.
- Keep business logic in server-side code and shared libs, not in page components.
- Preserve the `@/` alias structure and Next.js App Router conventions.
- Use `createServerSupabaseClient()` and `createAdminSupabaseClient()` for server-side data access rather than ad hoc client code.
- When touching PDF generation, remain careful about print dimensions, bleed, and DPI conversion rules.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to the client or logs.
- Keep environment variables aligned with `.env.local.example`.

## Validation
- Run the smallest relevant verification command after changes, typically `npm run lint` or a focused app build when behavior changes.
- Prefer targeted edits and minimal diffs.
- Avoid broad refactors unless the task explicitly requires them.

## Repo-specific notes
- Authenticated users are redirected to `/login` unless already signed in.
- The PDF generator expects a valid template from `templates` and an uploaded image in the `uploads` bucket.
- If the `assets/pico-logo.png` object is missing in Supabase storage, generation should still proceed without the logo rather than failing.
- The project uses French user-facing copy in several places; keep language consistent with the existing app tone when editing UI text.
