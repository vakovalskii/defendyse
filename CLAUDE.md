# Defendyse — Planet Defense Game

## Quick Start
```bash
cargo tauri dev
```

## Stack
Rust + Tauri v2 + Vanilla JS Canvas 2D

## Docs
- `docs/physics.md` — movement, collision, projectile ballistics, targeting, power system
- `docs/entities.md` — core stats, tower stats/upgrades, enemy stats/rewards, spirit links
- `docs/waves.md` — wave generation formula, infinite scaling, flow, tower slots
- `docs/lore.md` — setting, organic swarm castes, techno defense grid narrative
- `docs/architecture.md` — stack, game loop, IPC commands, file structure, UI systems

## File Structure
```
src-tauri/src/
├── main.rs              # Entry point
├── lib.rs               # Tauri setup, commands, game loop thread
└── game/
    ├── mod.rs
    ├── state.rs          # GameState + tick logic
    ├── core.rs           # PlanetCore
    ├── enemy.rs          # Enemy types (Drone, Fighter, Tank)
    ├── tower.rs          # Tower types (Gatling, Cannon, Laser, Hive)
    ├── projectile.rs     # Projectile kinds and physics
    └── wave.rs           # Wave generation system

src/
├── index.html           # Markup and structure
├── style.css            # Styles
└── game.js              # Game logic and Canvas 2D renderer
```

## Key Architecture Decisions
- Game loop runs in Rust thread at ~60fps, emits full state via Tauri events
- Frontend is pure renderer — zero game logic in JS
- All game state in `src-tauri/src/game/state.rs`
- Frontend split into three files: index.html (markup), style.css (styles), game.js (logic+render)
- Game log written to `game_log.txt` for balancing and debugging
- Infinite scaling: designed for 1000+ waves with percentage-based scaling
