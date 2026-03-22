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

## Wave Flow
1. Game starts → 3 second cooldown before Wave 1
2. Enemies spawn sequentially: all Drones first, then Fighters, then Tanks
3. Wave complete when: all enemies spawned AND all enemies dead
4. Between waves: 5 second cooldown + $50 bonus
5. Next wave auto-starts after cooldown

## Future: LLM Dynamic Waves
Planned integration with GPT/Qwen/Ollama to dynamically generate:
- Enemy compositions
- World modifiers (fog, haste, regen, split-on-death)
- Narrative text
- Difficulty scaling based on player performance
