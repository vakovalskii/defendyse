# Architecture

## Stack
- **Backend**: Rust (game logic, game loop, LLM integration)
- **Frontend**: Vanilla JS + Canvas 2D (rendering only)
- **Desktop**: Tauri v2 (native Mac window, IPC)

## Game Loop (Rust, ~60fps)
Runs in a separate thread. Each tick:
1. Spawn enemies (if wave active)
2. Move enemies toward core
3. Towers select targets and fire
4. Core auto-fires at nearest enemy
5. Fighters shoot at core
6. Move all projectiles
7. Check projectile-enemy and projectile-core collisions
8. Check enemy-core contact (kamikaze)
9. Remove dead entities
10. Check wave completion → next wave

State is serialized via serde and emitted to frontend via `app.emit("game-state", &state)`.

## Frontend (JS, event-driven)
- Listens to `game-state` events from Rust
- Renders entire state each frame on Canvas 2D
- Sends commands back via `invoke()`:
  - `place_tower(x, y, kind)`
  - `upgrade_tower(tower_id)`
  - `select_tower_kind(kind)`
  - `toggle_pause()`
  - `restart_game()`

## IPC Commands
| Command | Args | Returns |
|---------|------|---------|
| `get_state` | — | GameState |
| `place_tower` | x, y, kind | bool |
| `upgrade_tower` | tower_id | bool |
| `select_tower_kind` | kind | — |
| `toggle_pause` | — | bool |
| `restart_game` | — | — |

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
    ├── tower.rs          # Tower types (Gatling, Cannon, Laser)
    ├── projectile.rs     # Projectile kinds and physics
    └── wave.rs           # Wave generation system

src/
└── index.html           # Frontend: Canvas renderer + UI
```
