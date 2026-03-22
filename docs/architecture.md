# Architecture

## Stack
- **Backend**: Rust (game logic, game loop, LLM integration)
- **Frontend**: Vanilla JS + Canvas 2D (rendering only)
- **Desktop**: Tauri v2 (native Mac window, IPC)

## Game Loop (Rust, ~60fps)
Runs in a separate thread. Each tick:
1. Spawn enemies (if wave active)
2. Move enemies toward core
3. Apply power system (towers weaken with distance from core)
4. Towers select targets and fire
5. Core auto-fires at nearest enemy
6. Fighters shoot at core
7. Hive drones hunt nearest enemies autonomously
8. Move all projectiles
9. Check projectile-enemy and projectile-core collisions
10. Check enemy-core contact (kamikaze)
11. Apply Spirit Link bonuses (+20% DMG, +15% fire rate per link)
12. Apply Spirit Triangle slow fields (35% slow for 3-linked towers)
13. Remove dead entities
14. Check wave completion → next wave
15. Scale money rewards with wave number

State is serialized via serde and emitted to frontend via `app.emit("game-state", &state)`.

Game events are logged to `game_log.txt` for balancing analysis.

## Frontend (JS, event-driven)
- Listens to `game-state` events from Rust
- Renders entire state each frame on Canvas 2D
- Visual effects: parallax starfield (3 layers), nebulae, particle system, floating damage numbers, screen shake, neon glow
- Sends commands back via `invoke()`:
  - `place_tower(x, y, kind)`
  - `upgrade_tower(tower_id)`
  - `select_tower_kind(kind)`
  - `create_spirit_link(tower_id_a, tower_id_b)`
  - `toggle_pause()`
  - `restart_game()`
  - `set_speed(multiplier)` — x1/x2/x3

## UI Menus
- **Start Menu**: START / CONTROLS buttons
- **Pause Menu** (Escape key): CONTINUE / RESTART / CONTROLS buttons
- **Speed Controls**: x1 / x2 / x3 toggle during gameplay

## IPC Commands
| Command | Args | Returns |
|---------|------|---------|
| `get_state` | — | GameState |
| `place_tower` | x, y, kind | bool |
| `upgrade_tower` | tower_id | bool |
| `select_tower_kind` | kind | — |
| `create_spirit_link` | tower_a, tower_b | bool |
| `toggle_pause` | — | bool |
| `restart_game` | — | — |
| `set_speed` | multiplier | — |

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

game_log.txt             # Runtime game log for balancing
```
