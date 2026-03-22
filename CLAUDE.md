# Claude Code Instructions

## Project

Telegram Taxi Bot — Node.js 22, TypeScript, grammy.js, PostgreSQL 16 + PostGIS. A Telegram bot connecting riders with nearby drivers via live location sharing.

## Stack

- **Runtime:** Node.js 22, TypeScript (compiled to `dist/` via `tsc`)
- **Bot framework:** grammy.js with `@grammyjs/conversations`
- **Database:** PostgreSQL 16 + PostGIS 3.4 (via `pg` pool)
- **Local dev:** Docker Compose (`docker compose up -d --build`)

## Commands

```bash
npm run build     # compile TypeScript → dist/
npm run dev       # run directly with ts-node (no compile)
npm run migrate   # run migrations standalone
docker compose up -d --build bot   # rebuild and restart bot container only
docker compose logs -f bot         # tail bot logs
```

## Code Conventions

- CommonJS modules (`require` / `module.exports` in output — TypeScript `"module": "commonjs"`)
- No `console.log` in production code — errors are caught and handled, not logged to stdout
- All DB calls live in `src/services/` — handlers never query the DB directly
- `ctx.driver` is always populated by `loadDriver` middleware — never re-query inside a handler when `ctx.driver` suffices
- Coordinate order: PostGIS always takes `(longitude, latitude)` — Telegram provides `{ latitude, longitude }` — always swap explicitly
- Every new conversation must be registered with `bot.use(createConversation(...))` inside `registerDriverHandlers` before it can be entered
- Wrap all DB calls inside conversations in `conversation.external()` to prevent replay side-effects

## Architecture

```
src/bot.ts          ← entry point, middleware chain order matters:
                      session → conversations → loadDriver → handlers
src/config.ts       ← all env vars validated here, nowhere else
src/types.ts        ← BotContext type, import from here not from bot.ts
src/db/             ← connection pool + idempotent migrations
src/services/       ← all DB logic, no grammy imports
src/middleware/     ← loadDriver, adminOnly
src/handlers/       ← grammy handlers, import from services only
```

## Documentation — Keep Up To Date

**Whenever you make a change, update the relevant docs in the same commit or PR.**

| What changed | Doc to update |
|---|---|
| New feature or changed user flow | `README.md` — How It Works section |
| New env var or config option | `README.md` — Environment Variables table |
| New DB table, column, index, or query | `DATABASE.md` |
| New admin command or changed command behaviour | `README.md` — Admin Commands section |
| New setup step or changed deployment process | `README.md` — Setup / Deployment sections |
| Architecture change (new service, handler, middleware) | `README.md` — Architecture Overview and Project Structure |

Docs live alongside the code. A feature is not done until its documentation is updated.

## Commit Style

Conventional commits. Keep each commit atomic — one logical change per commit.

```
feat: short description
fix: short description
chore: short description
docs: short description
refactor: short description
```

Body is optional but encouraged for non-obvious changes. Always add:
```
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

## Adding Features — Checklist

- [ ] Service function in `src/services/` (DB logic)
- [ ] Handler in `src/handlers/` (bot interaction)
- [ ] Keyboard in `src/handlers/keyboards.ts` if new buttons are needed
- [ ] Migration in `src/db/migrations.sql` if schema changes (always idempotent — use `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`)
- [ ] `DATABASE.md` updated if schema changed
- [ ] `README.md` updated if user-facing behaviour changed
- [ ] TypeScript compiles cleanly: `npm run build`
- [ ] Tested locally via `docker compose up -d --build bot`
