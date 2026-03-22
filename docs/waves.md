# Wave System

## Wave Generation Formula
Waves scale with wave number `N`:

| Enemy Type | Appears | Count | Spawn Interval |
|-----------|---------|-------|----------------|
| Drone | Wave 1+ | 5 + N×3 | 0.4s |
| Fighter | Wave 2+ | N | 1.0s |
| Tank | Wave 4+ | min(N-3, 5) | 3.0s |

### Examples
- **Wave 1**: 8 Drones
- **Wave 2**: 11 Drones, 2 Fighters
- **Wave 3**: 14 Drones, 3 Fighters
- **Wave 4**: 17 Drones, 4 Fighters, 1 Tank
- **Wave 5**: 20 Drones, 5 Fighters, 2 Tanks
- **Wave 8**: 29 Drones, 8 Fighters, 5 Tanks (max tanks)

## Infinite Scaling
Designed for 1000+ waves:
- **Enemy HP**: scales +8% per wave (compounding)
- **Tower DMG**: upgrades grant +8% per level
- **Money rewards**: scale with wave number to keep upgrades affordable
- **Upgrade cost**: `base_cost * level * sqrt(level) * 0.5`

## Tower Slots
- Start with **5 tower slots**
- Gain **+1 slot every 2 waves**
- Can purchase additional slots for **$1000**

## Wave Flow
1. Game starts → Start Menu (START / CONTROLS)
2. 3 second cooldown before Wave 1
3. Enemies spawn sequentially: all Drones first, then Fighters, then Tanks
4. Wave complete when: all enemies spawned AND all enemies dead
5. Between waves: 5 second cooldown + $50 bonus (plus wave-scaled bonus)
6. Next wave auto-starts after cooldown
7. Speed controls available: x1 / x2 / x3

## Game Logging
All wave events, kills, and economy data are written to `game_log.txt` for balancing analysis.

## Future: LLM Dynamic Waves
Planned integration with GPT/Qwen/Ollama to dynamically generate:
- Enemy compositions
- World modifiers (fog, haste, regen, split-on-death)
- Narrative text
- Difficulty scaling based on player performance
