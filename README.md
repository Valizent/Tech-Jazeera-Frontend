# Tech-Jazeera Frontend

React/Vite client for the Valizent CRM — an internal ERP for a manpower
supply & trading company: employees, clients, deployments/mobilisations,
attendance, documents, quotations/invoices, payroll, leave, financial
requests, and a management dashboard, plus a separate self-service (ESS)
portal for workers. Also wrapped as an installable Android app via Capacitor
(reuses this same codebase — see `docs/P-MOBILE-notes.md`).

This is one of **two separate repos**, not a monorepo:
- **This repo** (`Tech-Jazeera-Frontend`) — the client, deployed via
  Cloudflare Pages' own git integration (no workflow file needed for it).
- [`Tech-Jazeera-Backend`](https://github.com/The-Saudi-Project/Tech-Jazeera-Backend) —
  the Express/MongoDB API, deployed via GitHub Actions to a company-owned
  Oracle VM.

**Read [`CLAUDE.md`](CLAUDE.md) first** — it's the project's source of truth
(architecture decisions, hard rules, UI requirements, and a full
feature-by-feature status log). Then `docs/` for the how-and-why behind each
module (`docs/M<N>-notes.md` for Phase 1, `docs/P2-*`/`docs/P3-*` and
feature-named files after that).

## Stack

React 18, Vite, TailwindCSS (token-based colors, dark-mode-ready, no
component library), React Router, TanStack Query, React Hook Form + Zod,
Axios. i18next for the Worker ESS portal and the staff panel shell
(English/Arabic, real RTL for Arabic). See `CLAUDE.md`'s "Locked stack"
section for the full, justified list.

## Setup

The backend must be running first (see `Tech-Jazeera-Backend`'s own
README).

```bash
npm install
npm run dev
```

Open http://localhost:5173 and sign in with the Admin account seeded on the
backend. The client expects the API at `http://localhost:5000/api` by
default; override with `VITE_API_URL` in a local `.env` (copy
`.env.example`) — required when pointing at a deployed backend, or when
testing the Android/emulator build (see `.env.example`'s own comments for
the exact URL each target needs).

## Build

```bash
npm run build     # production build — code-split, ~117 chunks
npm run preview   # serve the production build locally
```

Cloudflare Pages runs this same build on every push to `main`.

## Testing & linting

```bash
npm run lint       # eslint
```

Runs in CI on every push (`.github/workflows/ci.yml`), alongside the
backend's own test suite in its repo.

## Native app (Android)

The `android/` (and scaffolded, unbuilt `ios/`) folders wrap this same web
app via Capacitor — not a separate codebase. See `docs/P-MOBILE-notes.md`
for the release-build process and the real cross-origin-cookie fix that
made login persistence work inside the native shell.
