# Architecture

## Stack

- **Backend**: Rust (all game logic, state management, game loop)
- **Desktop framework**: Tauri v2 (native window, IPC bridge)
- **Frontend**: Vanilla JavaScript + Canvas 2D (rendering only, no game logic)
- **No bundler, no npm, no framework** -- static HTML/CSS/JS served directly

## Game Loop

The game loop runs in a dedicated Rust thread, sleeping 16ms per iteration (~60fps). Each tick:

1. Skip if `game_over` or `paused`
2. Apply `speed_multiplier` to dt (1x/2x/3x)
3. Accumulate `game_time` and `spirit_time`
4. Update spirit link pulse animations (`+= dt * 3.0`)
5. Wave cooldown / start check
6. `recalc_tower_energy()` -- distance-based power for all towers
7. `spawn_enemies(dt)` -- spawn next enemy from current wave entry
8. `tick_black_holes(dt)` -- spawn timer, pull physics, kill checks, tower destruction
9. `move_enemies(dt)` -- move toward core, apply spirit triangle slow
10. `towers_shoot(dt)` -- target nearest enemy, lead prediction, fire projectiles
11. `core_shoot(dt)` -- lightning strikes ALL enemies in range
12. `enemies_shoot(dt)` -- fighters fire at core when in 300px range
13. `tick_hive_drones(dt)` -- spawn/remove drones, Idle/Attacking/Returning FSM
14. `tick_player(dt)` -- respawn, movement, healing, shooting, collision with enemies/projectiles
15. `move_projectiles(dt)` -- update positions, check lifetime/off-screen
16. `check_collisions()` -- projectile-vs-enemy, projectile-vs-core, cannon piercing
17. `check_enemy_reach_core()` -- kamikaze damage
18. `cleanup()` -- remove dead enemies and projectiles
19. `check_wave_complete()` -- advance to next wave, grant reward + tower slot

After tick, the full `GameState` is cloned and emitted via `app.emit("game-state", &snapshot)`.

Stats are logged to `game_log.txt` every 10 game-seconds and on game over.

## Frontend Rendering

The frontend (`game.js`) listens for `game-state` events and renders every frame via `requestAnimationFrame`.

Key rendering systems:
- **Background**: parallax star layers, distant planets, nebulae
- **Placement zone**: trapezoidal grid overlay
- **Towers**: kind-specific shapes (rotating barrels, diamond frame, lens, hexagon)
- **Enemies**: kind-specific organic shapes (scarab, squid, crab)
- **Projectiles**: colored based on kind, with trail rendering
- **Trail system**: ring buffer per entity for smooth motion trails
- **Particle system**: explosions, hit sparks, engine exhaust (with particle limits)
- **Spirit links**: pulsing energy lines between linked towers
- **Spirit triangles**: semi-transparent slow field fill
- **Lightning arcs**: jagged lines from core to enemies
- **Black holes**: rotating accretion disk effect
- **Player ship**: oriented triangle with engine glow
- **HUD**: wave, core HP, score, money, tower count, speed, ship stats
- **LOD system**: reduces visual detail when many entities are active
- **Performance**: zero `shadowBlur` usage, particle count limits

UI overlays:
- Start menu with controls help
- Pause menu
- Tower context menu (upgrade, spirit link, move, sell)
- Toolbar (tower selection, slot purchase, speed, pause, restart)
- Wave banner (announcement)
- Game over screen with final stats

## IPC Commands

All 14 Tauri commands registered in `lib.rs`:

| Command              | Signature                                          | Returns   |
|----------------------|----------------------------------------------------|-----------|
| `get_state`          | `()` -> `GameState`                                | Full state |
| `place_tower`        | `(x: f64, y: f64, kind: TowerKind)` -> `bool`     | Success   |
| `upgrade_tower`      | `(tower_id: u32)` -> `bool`                        | Success   |
| `select_tower_kind`  | `(kind: TowerKind)`                                | void      |
| `toggle_pause`       | `()` -> `bool`                                     | New pause state |
| `restart_game`       | `()`                                               | void      |
| `set_speed`          | `(multiplier: f64)`                                | void      |
| `sell_tower`         | `(tower_id: u32)` -> `bool`                        | Success   |
| `buy_tower_slot`     | `()` -> `bool`                                     | Success   |
| `move_tower`         | `(tower_id: u32, x: f64, y: f64)` -> `bool`       | Success   |
| `check_placement`    | `(x: f64, y: f64, kind: TowerKind)` -> `PlacementResult` | Validation |
| `create_spirit_link` | `(tower_a: u32, tower_b: u32)` -> `bool`           | Success   |
| `set_player_input`   | `(input: PlayerInput)`                             | void      |
| `upgrade_ship`       | `()` -> `bool`                                     | Success   |

`PlacementResult` contains: `valid`, `snapped_x`, `snapped_y`, `overlap_count`, `in_zone`, `has_slot`, `can_afford`.

`PlayerInput` contains: `up`, `down`, `left`, `right`, `fire` (all booleans).

`TowerKind` enum: `Gatling`, `Cannon`, `Laser`, `Hive`.

## File Structure

```
defendyse/
  src-tauri/
    Cargo.toml
    tauri.conf.json            # Window: 1536x864, identifier: com.defendyse.app
    src/
      main.rs                  # Entry point
      lib.rs                   # Tauri builder, 14 IPC commands, game loop thread, stats logging
      game/
        mod.rs                 # Module declarations (10 modules)
        state.rs               # GameState struct (~1200 lines): tick, placement, collisions, waves
        core.rs                # PlanetCore: HP 350, DMG 3, range 130, cooldown 0.6s
        enemy.rs               # Enemy enum (Drone/Fighter/Tank) + stats
        tower.rs               # Tower enum (Gatling/Cannon/Laser/Hive) + upgrade system
        projectile.rs          # 6 ProjectileKinds, speed/size/lifetime, pierced_ids
        wave.rs                # Wave::generate() with HP/speed scaling formulas
        spirit.rs              # SpiritLink, SpiritTriangle, point_in_triangle, constants
        drone.rs               # HiveDrone with Idle/Attacking/Returning state machine
        anomaly.rs             # BlackHole with pull/kill physics
        player.rs              # PlayerShip with XP, manual upgrade, multi-shot

  src/
    index.html                 # Main markup: canvas, menus, HUD, toolbar, overlays
    style.css                  # Styles for all UI elements
    game.js                    # Canvas 2D renderer, IPC calls, input handling, UI logic

  .github/
    workflows/
      build.yml                # CI/CD pipeline

  CLAUDE.md                    # Project overview (this ecosystem)
  docs/
    physics.md                 # Game mechanics with exact numbers
    entities.md                # All entity stats
    waves.md                   # Wave generation formulas
    lore.md                    # Narrative
    architecture.md            # This file
```

## CI/CD

GitHub Actions workflow (`.github/workflows/build.yml`) triggers on tag push (`v*`).

Build matrix:
| Platform        | Target                      | Artifacts            |
|-----------------|-----------------------------|----------------------|
| windows-latest  | x86_64-pc-windows-msvc      | .exe, .msi           |
| macos-latest    | aarch64-apple-darwin         | .dmg, .app           |
| macos-13        | x86_64-apple-darwin          | .dmg, .app           |
| ubuntu-22.04    | x86_64-unknown-linux-gnu     | .deb, .AppImage      |

Steps per platform:
1. Checkout code
2. Install Rust stable with target
3. Install Node.js 20
4. Install Linux dependencies (webkit2gtk, appindicator, librsvg, patchelf) on Ubuntu
5. Install Tauri CLI v2 (`cargo install tauri-cli --version "^2"`)
6. Build (`cargo tauri build --target $target`)
7. Upload artifacts

Release job downloads all artifacts and creates a GitHub release with `softprops/action-gh-release@v2`, auto-generating release notes.

## Performance Considerations

- Zero `shadowBlur` -- all glow effects use layered draws or opacity
- LOD system reduces visual detail with many entities on screen
- Ring buffer trails -- fixed-size arrays, no allocations per frame
- Particle count limits -- prevents runaway particle spawning
- Full state clone per frame -- acceptable for game size, enables lock-free rendering
- 16ms sleep in game loop -- yields CPU between ticks
- `serde::Serialize` on all game structs for zero-copy IPC via Tauri events

## State Management

- Single `GameState` struct behind `Mutex<GameState>` in Tauri managed state
- Game loop thread locks mutex, calls `tick(dt)`, clones state, unlocks, emits
- IPC commands lock mutex for the duration of the command
- `#[serde(skip)]` on `player_input` to avoid sending transient input state to frontend
- `speed_multiplier` clamped to [1.0, 3.0]
