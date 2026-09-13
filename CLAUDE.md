# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## About This Project

Grain Bites is a web implementation of the 2-player postcard dice-dueling game by Ian Howard. It's a single-page app: one human player vs. a heuristic computer opponent, no server or backend involved.

## Tech Stack

- Language: TypeScript
- Framework / runtime: Vite (vanilla, no UI framework)
- Other key deps: Vitest for unit tests

## Project Structure

```
/
├── src/
│   ├── game/       # Framework-free game engine + AI, fully unit-tested
│   │   ├── types.ts
│   │   ├── rules.ts
│   │   ├── engine.ts     # GameEngine state machine
│   │   ├── ai.ts         # Computer opponent heuristics
│   │   └── aiDriver.ts   # Drives the AI's turns against the engine
│   ├── main.ts     # DOM rendering + event wiring
│   └── style.css
├── index.html
└── grainbites.nginx.conf  # Reference nginx config for the VPS
```

## Build & Run

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build   # outputs to dist/

# Run tests
npm test
```

## Deploy

- Source: `/home/gee/grain-bites/`
- Web root: `dist/` inside the source directory (Vite build, same pattern as Lost Ship) — nginx serves `/home/gee/grain-bites/dist` directly, no copy to `/var/www/html`
- Domain: `grainbites.geeb.us`
- nginx config: `/home/gee/grain-bites/grainbites.nginx.conf` (copy to `/etc/nginx/sites-available/`)
- Deploy with: `git push` then `./deploy.sh grain-bites` from `~/Development` (add it to the Vite-build project list alongside `lostship`)
- No sudo access in Claude sessions — user must run copy/nginx/certbot commands manually
- SSL: `certbot certonly --webroot -w /var/www/html/grainbites -d grainbites.geeb.us` (not `--nginx`)

## Conventions

- Game engine (`src/game/`) stays framework-free and DOM-free so it's unit-testable in isolation from rendering.

## Important Context

- No backend: all game state lives in the browser tab; refreshing resets the game.
