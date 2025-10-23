# Repository Guidelines

## Project Structure & Module Organization
- `webapp/`: Next.js 14 frontend; routes inside `webapp/app/`, shared UI in `webapp/components/`, realtime helpers in `webapp/lib/`, and static assets under `webapp/public/`.
- `websocket-server/`: TypeScript relay linking Twilio and OpenAI; session state in `websocket-server/src/sessionManager.ts`, callable handlers in `websocket-server/src/functionHandlers.ts`, and local IVR sandbox at `websocket-server/twiml.xml`.
- Create `.env` files by copying each package's `.env.example` before running any scripts so keys resolve consistently.

## Build, Test, and Development Commands
- `cd webapp && npm install`: install frontend dependencies.
- `cd websocket-server && npm install`: install backend dependencies.
- `npm run dev` (inside each package): launches Next.js or the nodemon relay with hot reload on port 8081.
- `npm run build`: compiles production bundles; the backend emits `dist/`, the frontend warms `.next/`.
- `cd webapp && npm run lint`: enforces the project ESLint profile.
- `cd websocket-server && npm run build`: runs `tsc` with strict settings to surface type regressions.

## Coding Style & Naming Conventions
- Author code in strict TypeScript with 2-space indentation, double quotes, and trailing commas; run Prettier via the configured ESLint ruleset.
- Use PascalCase for React components and shared types, camelCase for utilities, and align filenames with their primary export (e.g., `LiveTranscript.tsx`).
- Co-locate component-specific hooks, styles, or tests next to their component; reserve `webapp/lib/` for cross-cutting realtime helpers.

## Testing Guidelines
- Automated tests are not wired yet; when adding coverage, place colocated `*.test.ts` files and mirror the source path.
- Manual smoke tests: load `/twiml` in the frontend, observe websocket logs from the relay, and confirm live transcripts render end-to-end before shipping.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (`feat:`, `fix:`, `chore:`); split frontend and backend changes when practical.
- Document environment or schema updates clearly in commit bodies.
- PRs should include a concise summary, linked issues, verification steps (`npm run dev`, recorded call, screenshots), and remain open only after lint and type checks succeed.

## Security & Configuration Tips
- Keep Twilio and OpenAI secrets in `.env` files and never expose them client-side.
- When tunneling the relay, run `ngrok http 8081` and set `PUBLIC_URL` to the generated HTTPS origin.
- Treat edits to `webapp/lib/twilio.ts` and backend handlers as security sensitive—double-check validation, authentication, and error handling before merging.
