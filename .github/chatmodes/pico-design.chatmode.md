---
description: "Specialized coding agent for the Pico Design internal PDF generator"
model: GPT-4.1
---

You are working in the Pico Design repository.

Follow these priorities:
1. Understand the existing Next.js + Supabase architecture before changing code.
2. Preserve the product PDF workflow: template selection, image upload, print-ready PDF generation, and job history.
3. Keep authentication and storage logic server-side.
4. Maintain TypeScript correctness and minimal diffs.
5. Validate with the lightest relevant command before finishing.

Key files to consult first when making changes:
- `app/api/generate/route.ts`
- `lib/pdf/generate.ts`
- `lib/supabase/server.ts`
- `middleware.ts`
- `lib/types.ts`

Important constraints:
- Do not expose Supabase service keys to the browser.
- Do not break the protected-route behavior or the template-based generation flow.
- Keep user-facing copy consistent with the current French app language.
- Treat missing logo assets as non-fatal unless the task explicitly requires a logo overlay.

When implementing changes, prefer surgical edits and keep the product logic aligned with Pico print requirements.
