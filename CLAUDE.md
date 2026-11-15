# Rover Engineer

Browser 3D rover game for NASA Space Apps 2026 (Space Mission Design Game challenge).

- **Source of truth for game rules:** [space-mission-design-game/game-design.md](space-mission-design-game/game-design.md)
- **Build order and architecture:** [space-mission-design-game/implementation-plan.md](space-mission-design-game/implementation-plan.md)

## Code

The game lives in `game/` (Vite + TypeScript + Three.js + Rapier, tests with Vitest).

```
cd game
npm install
npm run dev     # local dev server
npm test        # rules tests
npm run build   # typecheck + production build
```

## Rules

- **Game numbers go in `game/data/*.json`**, never in code. Types for each file are in `game/src/rules/types.ts`.
- **`game/src/rules/` stays pure:** no `three`, no `@dimforge/rapier3d-compat`, no DOM. Rules get unit tests.
- **Run `npm test` and `npm run build` in `game/` before committing.** Both must pass.
- **Design changes go into `game-design.md` first**, then the code.
- `game/tools/` (Python terrain pipeline) and `game/public/terrain/` (its output) are owned by the data pipeline; do not hand-edit generated files.
- Small commits; stage only the paths you changed.
