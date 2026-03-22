# Defendyse -- Planet Defense Game

## Quick Start
```bash
cargo tauri dev
```

Build for release:
```bash
cargo tauri build
```

## Stack
Rust + Tauri v2 + Vanilla JS Canvas 2D. No bundler, no framework, no npm.

## Docs
- `docs/physics.md` -- movement, collision, projectile ballistics, targeting, power system, spirit links, black holes, placement constraints
- `docs/entities.md` -- core stats, tower stats/upgrades, enemy stats/rewards, spirit links, player ship, black holes, hive drones
- `docs/waves.md` -- wave generation formulas, infinite scaling, example waves, flow, tower slots, black hole spawning
- `docs/lore.md` -- setting, organic swarm castes, techno defense grid, spirit links, black holes, player ship narrative
- `docs/architecture.md` -- stack, game loop tick order, IPC commands, file structure, CI/CD, performance, UI systems

## File Structure
```
src-tauri/src/
  main.rs              # Entry point
  lib.rs               # Tauri setup, 14 IPC commands, game loop thread, stats logging
  game/
    mod.rs             # Module declarations
    state.rs           # GameState, tick logic, placement, collisions, all subsystems
    core.rs            # PlanetCore (HP 350, DMG 3, range 130, cooldown 0.6s)
    enemy.rs           # Enemy types: Drone, Fighter, Tank
    tower.rs           # Tower types: Gatling, Cannon, Laser, Hive + upgrade system
    projectile.rs      # 6 projectile kinds with speed/size/lifetime, piercing support
    wave.rs            # Wave generation with HP/speed scaling, enemy composition
    spirit.rs          # Spirit links (+20% DMG, +15% fire rate), triangles (35% slow)
    drone.rs           # HiveDrone with Idle/Attacking/Returning FSM
    anomaly.rs         # BlackHole (pull_radius 150, kill_radius 12, lifetime 8s)
    player.rs          # PlayerShip with XP system, manual upgrade, multi-shot fan

src/
  index.html           # Markup: canvas, main menu, HUD, toolbar, game over, tower menu
  style.css            # Styles
  game.js              # Canvas 2D renderer, IPC calls, input handling, UI state

.github/workflows/
  build.yml            # CI/CD: builds on tag push for Windows, macOS ARM/Intel, Linux

tauri.conf.json        # Tauri v2 config: 1536x864 window, identifier com.defendyse.app
```

## Key Architecture Decisions
- Game loop runs in Rust thread at ~60fps (16ms sleep), emits full GameState via Tauri events
- Frontend is pure renderer -- zero game logic in JS, all state comes from Rust
- All game state centralized in `GameState` struct in `state.rs` (~1200 lines)
- 14 Tauri IPC commands for all player actions (place/upgrade/sell/move towers, spirit links, ship control)
- Game stats logged to `game_log.txt` every 10 game-seconds and on game over
- Infinite wave scaling with percentage-based formulas -- no level cap
- Speed multiplier (1x/2x/3x) applied to dt in tick
- Grid-snapped tower placement (60px) in trapezoidal zone with cluster limits
- Tower energy system: proximity to core affects damage/fire rate (1.0 at core, 0.3 at max distance)
- Black holes spawn on zone borders every 15-30s, pull enemies/towers/projectiles/drones
- Player ship with WASD movement, auto-aim nearest enemy, XP leveling + money upgrades
