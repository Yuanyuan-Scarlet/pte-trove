# Repository Guidelines

## Project Structure & Module Organization

[`SPEC.md`](SPEC.md) is the authoritative product and engineering requirements document. Read it before changing behavior.

Routes live in `app/`, reusable client UI in `components/`, business services in `lib/`, D1 schema and migrations in `db/` and `drizzle/`, Worker entry code in `worker/`, static assets in `public/`, tests in `tests/`, and operational utilities in `scripts/`. Do not commit generated PDFs, uploaded source material, `old-sold` archives, credentials, or customer data.

## Build, Test, and Development Commands

Use Node 22.13 or Node 24+; `.nvmrc` selects Node 26.3.0.

The following commands use the same syntax in Windows PowerShell, Linux Bash, and macOS zsh/Bash. Run them from the repository root.

```shell
npm install          # install locked dependencies
npm run dev          # start local Node.js and SQLite development
npm test             # run domain, schema, PDF, and ZIP tests
npm run lint         # enforce React and TypeScript style
npx tsc --noEmit     # type-check without writing output
npm run build        # create the production standalone build
```

## Coding Style & Naming Conventions

Use two-space indentation in TypeScript, ESLint for static checks, and descriptive English identifiers such as `materialVersion` and `generationDeadline`. Keep product-entry constants uppercase (`WFD`, `DI`, `SST`, `RS`, `WE`, `BUNDLE`). Store timestamps in UTC and apply `Asia/Shanghai` only at business and presentation boundaries.

## Line Endings

All project text files must use Unix LF line endings. Keep `.gitattributes` configured to enforce LF across development environments and release archives; do not commit CRLF or mixed-line-ending text files.

## Testing Guidelines

Every behavior change must include automated tests. Cover the 240-hour generation boundary, 720-hour expiry boundary, phone and order validation, both one-to-one uniqueness constraints, idempotent generation, session scope, ZIP contents, per-page watermarks, and archival behavior. Name tests after observable outcomes, for example `rejects_new_generation_after_240_hours`.

## Commit & Pull Request Guidelines

Use a one-sentence commit message that summarizes the change, such as `Add material version expiry validation.` Pull requests should explain the behavior changed, cite relevant `SPEC.md` sections, list verification performed, and include mobile screenshots for UI changes. Call out schema migrations, environment variables, security implications, and intentional specification deviations.

## Security & Configuration

Keep administrator credentials, Aliyun SMS keys, signing keys, and storage secrets in environment variables or a secret manager. Never log plaintext OTPs, session tokens, link tokens, full phone numbers, or order numbers. Keep source PDFs, generated files, history, and `old-sold` outside publicly served directories.
