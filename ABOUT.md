# Game Bling

Game Bling is a mobile-first World Cup prediction room app for small friend groups.

The first version is designed for 5-10 friends who want a quick, low-friction way to predict matches, compare points, and keep the tournament fun without creating full user accounts. A room creator shares a short room link and invite code. Friends join with a display name, then submit match predictions before kickoff.

## What It Does

- Creates private prediction rooms with short invite links.
- Lets players join using room code + display name instead of email/password.
- Shows preloaded World Cup fixtures so the app works even if live data is limited.
- Lets players predict final score, match result, half-time score, first team to score, and last team to score.
- Locks predictions at kickoff.
- Syncs match status and results from a football data API when available.
- Scores predictions and shows room/global leaderboards.
- Shows a personalized home shortcut back into the current room after a player joins.
- Collapses saved predictions into a compact receipt, with editing available in an expandable section before kickoff.
- Gives server-action buttons immediate pending states so actions feel responsive.
- Gives every player a simple avatar so the app feels social.

## Product Principles

- **Fast to use:** joining and predicting should take seconds.
- **Useful without perfect live data:** fixtures are seeded upfront; API sync improves the experience but does not hold it hostage.
- **Mobile first:** phone use is the default, not an afterthought.
- **Small-group fun over betting complexity:** this is not a real-money gambling product.
- **Simple data model:** keep the schema understandable and avoid premature platform complexity.
- **Reusable foundation:** the first theme is FIFA World Cup, but the structure should later support other tournaments and sports.

## Key Docs

- Product requirements: `docs/PRD.md`
- Phased technical plan: `docs/IMPLEMENTATION_PLAN.md`
- Technical specification: `docs/TECHNICAL_SPEC.md`
- Design spec: `docs/superpowers/specs/2026-06-14-game-bling-design.md`
- Mockups: `mockuup/index.html`, `mockuup/all-flows-single.html`, and `mockuup/post-save-room-hub-flow.html`

## Deployment Target

- Frontend/app: Next.js deployed on Vercel.
- Database: Supabase Postgres.
- Live data provider: API-Football first, with a provider adapter so it can be swapped later.

## Local Development

Run the local app on `http://127.0.0.1:3003` only. The `npm run dev` script frees port `3003` before starting Next.js on that exact port. If another process is using `3003`, stop that process instead of switching ports.

The visible home-page brand is `Gam3Bling`.
