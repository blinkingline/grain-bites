# Grain Bites

A web implementation of *Grain Bites*, the 2-player postcard dice-dueling game
by Ian Howard (art by Marty Cobb). Play against a computer opponent — no
postcard, marker, or dice required.

Play it live: https://grainbites.geeb.us

## Rules summary

Each side has seven team members, one per number range: `ODD`, `EVEN`,
`1-2`, `3-4`, `5-6`, `1-3`, `4-6`. On your turn, choose a **Fast** attack
(roll 2d6) or a **Slow** attack (roll 3d6), then assign one rolled die to an
opposing member whose range matches that die's value. If no die matches any
surviving opponent, they gain a Bounce token instead.

The defender then chooses to **Dodge** or **Catch**, and the attacker's
remaining dice are rerolled (1 die if Fast, 2 if Slow):

- **Dodge** succeeds if *none* of the rerolled dice match the target's
  range — the member survives.
- **Catch** succeeds if *at least one* rerolled die matches — the defender
  immediately eliminates one attacker member of their choice.
- If the chosen defense fails, the targeted member is eliminated.

**Bounces** (max 3 per team) can be spent, one at a time and stackable, to
shift the value of a die you personally rolled by ±1 — but only on your own
rolls. The game ends the moment one team's seven members are all eliminated.

## Development

```bash
npm install
npm run dev      # local dev server
npm test         # unit tests (vitest)
npm run build    # production build to dist/
```

The game engine (`src/game/`) is framework-free and fully unit-tested,
separate from the DOM rendering in `src/main.ts`. CI (`.github/workflows/ci.yml`)
runs tests and a production build on every push. Deployment is to a
self-hosted VPS via `./deploy.sh grain-bites` — see `CLAUDE.md` for details.
