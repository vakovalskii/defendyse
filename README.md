# DEFENDYSE — Planet Defense

<p align="center">
  <b>Tower defense + player ship + organic enemies vs techno machines</b><br>
  <i>Rust + Tauri v2 + Canvas 2D</i>
</p>

**[Gameplay Video](https://github.com/vakovalskii/defendyse/releases/download/v0.3.0/gameplay2.mp4)**


https://github.com/user-attachments/assets/f2a9896e-21bc-44eb-b09f-2ced89212d3b


---

## What is this?

A tower defense game where you protect a planetary core from waves of organic alien creatures (scarab bugs, squids, crabs). Build techno defense towers, fly your own spaceship, link towers with spirit energy, and survive black hole anomalies.

**Built entirely with Rust + Tauri v2.** No Unity, no Godot — custom engine. Game logic runs in Rust at 60fps, frontend is pure Canvas 2D.

## Download

**[Latest Release](https://github.com/vakovalskii/defendyse/releases/latest)** — Windows (.exe), macOS (.dmg), Linux (.AppImage)

## Features

### Towers (Techno Machines)
| Tower | Cost | Specialty |
|-------|------|-----------|
| **Gatling** | $40 | Fast fire, anti-drone |
| **Cannon** | $90 | Piercing plasma — passes through ALL enemies |
| **Laser** | $65 | Fast beam, anti-fighter |
| **Hive** | $120 | Spawns autonomous hunter drones |

### Enemies (Organic Creatures)
| Enemy | Visual | Threat |
|-------|--------|--------|
| **Drone** | Scarab bug with legs | Swarm kamikaze |
| **Fighter** | Squid with tentacles | Fast, shoots back |
| **Tank** | Crab with claws | Massive HP, devastating impact |

### Core Mechanics
- **Power System** — towers near the core are stronger (100%), weakening to 30% at the far edge
- **Spirit Links** — connect towers for +20% DMG, +15% fire rate. Three linked towers create a 35% slow field
- **Core Lightning** — the core strikes ALL nearby enemies with chain lightning
- **Black Holes** — random anomalies that suck in both towers and enemies
- **Player Ship** — fly with arrow keys, shoot with space, upgrade with U. Auto-levels from kills

### Infinite Scaling
Designed for 1000+ waves. Enemies scale +5% HP per wave, tower upgrades give +8% DMG per level. Economy scales to match.

## Controls

| Key | Action |
|-----|--------|
| **Click** | Place tower / open tower menu |
| **1-4** | Select tower type |
| **Arrow Keys** | Fly ship |
| **Space** | Ship shoots (auto-aim) |
| **U** | Upgrade ship |
| **Q / W / E** | Speed x1 / x2 / x3 |
| **B** | Buy tower slot ($1000) |
| **Esc** | Pause menu |

## Build from source

```bash
# Prerequisites: Rust, Node.js, Tauri CLI
cargo install tauri-cli --version "^2"

# Development
cargo tauri dev

# Release build
cargo tauri build
```

## Architecture

```
src-tauri/src/
├── lib.rs              # Tauri setup, IPC commands, game loop thread
└── game/
    ├── state.rs        # GameState, tick logic, all systems
    ├── core.rs         # Planet core (lightning defense)
    ├── tower.rs        # 4 tower types + upgrades
    ├── enemy.rs        # 3 enemy types
    ├── projectile.rs   # 6 projectile kinds (piercing cannon)
    ├── wave.rs         # Wave generation + scaling
    ├── spirit.rs       # Spirit links + triangles
    ├── drone.rs        # Hive autonomous drones
    ├── anomaly.rs      # Black hole anomalies
    └── player.rs       # Player ship + upgrades

src/
├── index.html          # Markup + menus
├── style.css           # Styles
└── game.js             # Canvas 2D renderer + controls
```

- **Game loop**: Rust thread at 60fps, emits full state via Tauri events
- **Renderer**: Pure Canvas 2D, zero shadowBlur (manual glow), LOD for 40+ enemies
- **Trails**: Ring buffer (3000 points, Float32Array, zero GC)
- **CI/CD**: GitHub Actions builds for Windows/macOS/Linux on tag push

## Tech Stack

| Layer | Tech |
|-------|------|
| Game logic | Rust |
| Desktop shell | Tauri v2 |
| Rendering | Canvas 2D (vanilla JS) |
| Build | Cargo + Tauri CLI |
| CI/CD | GitHub Actions |

## License

MIT

---

*Built with Claude Code*
