# Repository Guidelines

## Project Structure & Module Organization
- `webapp/` Next.js 14 frontend; routes under `webapp/app/`, shared UI in `webapp/components/`, realtime helpers in `webapp/lib/`, static assets in `webapp/public/`.
- `websocket-server/` TypeScript relay bridging Twilio and OpenAI; session state in `websocket-server/src/sessionManager.ts`, function handlers in `websocket-server/src/functionHandlers.ts`, local Twilio sandbox via `websocket-server/twiml.xml`.
- Copy each package's `.env.example` to `.env` before running dev scripts so secrets resolve consistently.

## Build, Test, and Development Commands
- `cd webapp && npm install`: install frontend dependencies after a fresh clone.
- `cd websocket-server && npm install`: install relay dependencies.
- `cd webapp && npm run dev`: launch the Next.js dev server with hot reload.
- `cd websocket-server && npm run dev`: start the websocket relay on port 8081 via nodemon.
- `cd webapp && npm run build`: produce the optimized frontend bundle.
- `cd websocket-server && npm run build`: compile the relay with `tsc` and surface type errors.
- `cd webapp && npm run lint`: enforce the shared ESLint + Prettier profile.

## Coding Style & Naming Conventions
- Write strict TypeScript with 2-space indentation, double quotes, and trailing commas; rely on the repo ESLint config to format via Prettier.
- Use PascalCase for React components and shared types, camelCase for utilities, and align filenames with their primary export (e.g., `LiveTranscript.tsx`).
- Keep component-specific hooks, styles, or tests beside the component; reserve `webapp/lib/` for cross-cutting realtime helpers.

## Testing Guidelines
- Automated tests are not yet wired; place future coverage as colocated `*.test.ts` files mirroring the source path.
- Before shipping, manually smoke test by loading `/twiml`, watching relay logs, and confirming live transcripts flow end-to-end.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (`feat:`, `fix:`, `chore:`) and split frontend/back-end changes when practical.
- Document environment or schema updates in commit bodies and PR descriptions.
- PRs should include a concise summary, linked issues, verification steps (`npm run dev`, call recording, screenshots), and remain open only after lint and type checks succeed.

## Security & Configuration Tips
- Keep Twilio and OpenAI secrets in `.env` files and never expose them client-side.
- When tunneling the relay, run `ngrok http 8081` and set `PUBLIC_URL` to the generated HTTPS origin.
- Treat edits to `webapp/lib/twilio.ts` and backend handlers as security-sensitive; double-check validation, authentication, and error handling before merging.
