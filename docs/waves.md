# Wave System

## Wave Generation

Each wave `n` generates spawn entries for each enemy type. All formulas use integer arithmetic where noted.

### Scaling Formulas

HP scale (applied to all enemy types):
```
hp_scale = 1.0 + (n - 1) * 0.05
```

Speed scale (capped at 1.5x):
```
speed_scale = min(1.0 + n * 0.003, 1.5)
```

Damage scaling (applied during spawn, derived from HP mult):
```
damage_mult = sqrt(hp_mult)
```

### Drone Spawns (all waves)
```
count    = 8 + n * 5 + n^2 / 50       (integer division)
interval = max(0.35 - n * 0.004, 0.07) seconds
```

### Fighter Spawns (from wave 3)
```
count    = (n - 2) * 2 + n^2 / 60     (integer division)
interval = max(1.2 - n * 0.006, 0.3)  seconds
```

### Tank Spawns (from wave 5)
```
count    = ceil((n - 4) * 0.8) + n^2 / 200  (integer division on n^2/200)
interval = max(3.0 - n * 0.01, 1.2)         seconds
speed_mult = speed_scale * 0.9              (tanks are 10% slower than base scaling)
```

## Example Waves

### Wave 1
| Type   | Count | Interval | HP mult | Speed mult |
|--------|-------|----------|---------|------------|
| Drone  | 13    | 0.346s   | 1.00    | 1.003      |

### Wave 3
| Type    | Count | Interval | HP mult | Speed mult |
|---------|-------|----------|---------|------------|
| Drone   | 23    | 0.338s   | 1.10    | 1.009      |
| Fighter | 2     | 1.182s   | 1.10    | 1.009      |

### Wave 5
| Type    | Count | Interval | HP mult | Speed mult |
|---------|-------|----------|---------|------------|
| Drone   | 33    | 0.330s   | 1.20    | 1.015      |
| Fighter | 6     | 1.170s   | 1.20    | 1.015      |
| Tank    | 1     | 2.950s   | 1.20    | 0.914      |

### Wave 10
| Type    | Count | Interval | HP mult | Speed mult |
|---------|-------|----------|---------|------------|
| Drone   | 60    | 0.310s   | 1.45    | 1.030      |
| Fighter | 17    | 1.140s   | 1.45    | 1.030      |
| Tank    | 5     | 2.900s   | 1.45    | 0.927      |

### Wave 20
| Type    | Count | Interval | HP mult | Speed mult |
|---------|-------|----------|---------|------------|
| Drone   | 116   | 0.270s   | 1.95    | 1.060      |
| Fighter | 42    | 1.080s   | 1.95    | 1.060      |
| Tank    | 14    | 2.800s   | 1.95    | 0.954      |

### Wave 50
| Type    | Count | Interval | HP mult | Speed mult |
|---------|-------|----------|---------|------------|
| Drone   | 308   | 0.150s   | 3.45    | 1.150      |
| Fighter | 137   | 0.900s   | 3.45    | 1.150      |
| Tank    | 49    | 2.500s   | 3.45    | 1.035      |

## Wave Flow

1. Game starts with 3.0s cooldown before wave 1
2. Wave spawns enemies sequentially: all drones, then all fighters, then all tanks
3. Each spawn entry has its own interval timer
4. Wave is "finished spawning" when all entries are exhausted
5. Wave is "complete" when finished spawning AND all enemies are dead
6. On wave complete:
   - Next wave is generated: `Wave::generate(current + 1)`
   - Wave cooldown: 5.0s between waves
   - Wave bonus money: `20 + next_wave_number * 5`
   - If `next_wave_number % 2 == 0`: +1 tower slot

## Tower Slot Gain

Starting slots: 5

Automatic gain: +1 slot every 2 waves (wave 2, 4, 6, 8...).

| After wave | Total slots (free) |
|------------|-------------------|
| Start      | 5                 |
| 2          | 6                 |
| 4          | 7                 |
| 10         | 10                |
| 20         | 15                |
| 50         | 30                |

Additional slots can be purchased for $1000 each at any time.

## Black Hole Spawn Timer

- Initial timer: 20.0s
- After each spawn: random 15.0 to 30.0s
- Only ticks during active waves (not during cooldown)
- Black holes spawn on the edges of the placement zone (right, top, or bottom border)
- Each black hole lasts 8.0s
