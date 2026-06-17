# ZMK Corne WebUI

Local webapp for editing this Corne keyboard's configuration. See `docs/webui-plan.md` (at the repo root) for the architecture and phase plan.

## Quick start

```bash
cd webui
npm install
npm run dev
```

- Frontend: <http://localhost:5173>
- Backend:  http://127.0.0.1:5174

The frontend proxies `/api/*` to the backend, so you only need the one URL in your browser.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Starts both frontend (Vite) and backend (tsx watch) concurrently. |
| `npm run dev:frontend` | Frontend only. |
| `npm run dev:backend` | Backend only. |
| `npm run start` | Builds the frontend then runs only the backend on port 5174, which serves the built UI itself — one URL, one process. |
| `npm run typecheck` | Runs `tsc --noEmit`. |
| `npm run lint` | Runs ESLint. |
| `npm run test` | Runs Vitest. |
| `npm run build` | Type-checks and builds a production frontend bundle into `dist/`. |
| `npm run format` | Runs Prettier across the project. |

## Production mode

`npm run start` is the simplest way to run the app for personal use. After a one-time `npm install`, every launch:

1. Rebuilds the frontend (fast — ~1 sec).
2. Starts the backend on `127.0.0.1:5174`.
3. The backend serves both the API *and* the built UI from `dist/`.

Open <http://127.0.0.1:5174>.

## Layout

```
webui/
├── server/       # Express backend (parsers, file IO, build/SSE)
├── src/          # React frontend
├── docs/         # Markdown docs rendered in-app
└── ...           # config (tsconfig, eslint, prettier, vite)
```

The backend resolves the repo root from its own `__dirname` and refuses to start if `config/corne.keymap` isn't present, so launching it from outside the repo will fail loudly.
