# Defendyse — Planet Defense Game

## Quick Start
```bash
cargo tauri dev
```

## Stack
Rust + Tauri v2 + Vanilla JS Canvas 2D

## Docs
- `docs/physics.md` — movement, collision, projectile ballistics, targeting
- `docs/entities.md` — core stats, tower stats/upgrades, enemy stats/rewards
- `docs/waves.md` — wave generation formula, scaling, flow, LLM plans
- `docs/lore.md` — setting, swarm castes, defense grid narrative
- `docs/architecture.md` — stack, game loop, IPC commands, file structure

## Key Architecture Decisions
- Game loop runs in Rust thread at ~60fps, emits full state via Tauri events
- Frontend is pure renderer — zero game logic in JS
- All game state in `src-tauri/src/game/state.rs`
- Planned: LLM integration (GPT/Qwen/Ollama) for dynamic wave generation
