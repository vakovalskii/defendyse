# Entities and Stats

## Planet Core

The player's base, positioned at (90, 432).

| Stat          | Value  |
|---------------|--------|
| Radius        | 40px   |
| HP            | 350    |
| Damage        | 3.0 per enemy per strike |
| Range         | 130px  |
| Fire cooldown | 0.6s   |

Core lightning hits ALL enemies within range simultaneously. Instant damage, no projectile travel time.

## Towers

### Gatling Tower
Rapid-fire bullets. Cheap, fast, single-target.

| Stat          | Value  |
|---------------|--------|
| Cost          | $40    |
| Damage        | 1.0    |
| Range         | 100px  |
| Fire cooldown | 0.18s  |
| Projectile    | 600 px/s, size 2.0, lifetime 5.0s |

### Cannon Tower
Slow, heavy piercing plasma. Passes through all enemies in its path.

| Stat          | Value  |
|---------------|--------|
| Cost          | $90    |
| Damage        | 15.0   |
| Range         | 180px  |
| Fire cooldown | 1.8s   |
| Projectile    | 250 px/s, size 7.0, lifetime 8.0s, piercing |

### Laser Tower
Very fast shots, short range. Near-instant hit.

| Stat          | Value  |
|---------------|--------|
| Cost          | $65    |
| Damage        | 2.5    |
| Range         | 80px   |
| Fire cooldown | 0.22s  |
| Projectile    | 900 px/s, size 1.5, lifetime 0.15s |

### Hive Tower
Deploys autonomous drones. Does not fire projectiles directly.

| Stat          | Value  |
|---------------|--------|
| Cost          | $120   |
| Damage        | 1.5 (base drone damage) |
| Range         | 250px (drone engagement range) |
| Fire cooldown | N/A    |
| Max drones    | 2 (base) |

### Upgrade Formula

Upgrade cost:
```
upgrade_cost = ceil(base_cost * level * sqrt(level) * 0.5)
```

Per upgrade:
- Damage: x1.08 (+8% per level, compounds)
- Range: x1.015 (+1.5% per level)
- Fire cooldown: x0.98 (-2% per level, floor 0.02s)

Hive-specific: +1 max drone every 3 levels (when `level % 3 == 0`).

Example upgrade costs (Gatling, base $40):
| Level | Cost to upgrade |
|-------|----------------|
| 1     | $20            |
| 2     | $57            |
| 3     | $104           |
| 5     | $224           |
| 10    | $633           |

### Sell Refund
Selling returns `base_cost / 2`.

### Tower Slots
- Start: 5 slots
- +1 every 2 waves (on even wave numbers)
- Buy additional: $1000

## Spirit Links

Connect two towers for mutual buffs.

| Property            | Value   |
|---------------------|---------|
| Cost                | $100    |
| Max distance        | 250px   |
| Max links per tower | 2       |
| DMG bonus per link  | +20%    |
| Fire rate per link  | +15%    |

### Spirit Triangle
When 3 towers are mutually linked (A-B, B-C, A-C), the triangle interior becomes a slow field.

| Property     | Value |
|--------------|-------|
| Slow factor  | 35% speed reduction |
| Detection    | Barycentric coordinate point-in-triangle test |

Links break when a tower is moved, sold, or destroyed by a black hole.

## Enemies

### Drone
Small, fast, fragile swarmers. Move toward core, no ranged attack.

| Stat          | Base value |
|---------------|-----------|
| HP            | 1.0       |
| Speed         | 65 px/s   |
| Damage        | 8.0 (on core contact) |
| Size          | 4px       |
| Can shoot     | No        |

### Fighter
Mid-size, fast, ranged attacker. Shoots at core when within 300px.

| Stat          | Base value |
|---------------|-----------|
| HP            | 4.0       |
| Speed         | 75 px/s   |
| Damage        | 12.0 (on core contact) |
| Size          | 6px       |
| Can shoot     | Yes       |
| Fire cooldown | 1.5s      |
| Shot damage   | 2.0 (fixed projectile damage) |
| Shoot range   | 300px     |

### Tank
Large, slow, massive HP. No ranged attack but devastating on contact.

| Stat          | Base value |
|---------------|-----------|
| HP            | 80.0      |
| Speed         | 20 px/s   |
| Damage        | 40.0 (on core contact) |
| Size          | 12px      |
| Can shoot     | No        |

### Wave Scaling Applied to Enemies
- HP: `base_hp * hp_mult` (where `hp_mult = 1.0 + (wave - 1) * 0.05`)
- Speed: `base_speed * speed_mult` (where `speed_mult = min(1.0 + wave * 0.003, 1.5)`)
- Damage: `base_damage * sqrt(hp_mult)` (damage scales slower than HP)
- Tanks get additional speed penalty: `speed_mult * 0.9`

### Kill Rewards
Base values, scaled by wave bonus:
```
wave_bonus = 1 + saturating_sub(wave_number, 10) / 10
```
(Waves 1-10: bonus=1. Wave 20: bonus=2. Wave 30: bonus=3.)

| Enemy   | Score       | Money       |
|---------|-------------|-------------|
| Drone   | 10 * wb     | 4 * wb      |
| Fighter | 25 * wb     | 12 * wb     |
| Tank    | 100 * wb    | 35 * wb     |

Player ship kills also grant XP equal to `score_value / 2`.

## Player Ship

Controllable fighter ship with auto-aim and XP progression.

### Base Stats
| Stat          | Value  |
|---------------|--------|
| HP            | 60     |
| Speed         | 180 px/s |
| Damage        | 3.0    |
| Fire cooldown | 0.25s  |
| Heal rate     | 20 HP/s (when near core) |
| Heal range    | core.radius + 60 (100px from core center) |
| Shot spread   | 1 (single shot) |
| Respawn timer | 3.0s   |
| Respawn HP    | 50% of max_hp |
| Invuln on respawn | 2.0s |
| Projectile    | PlayerShot: 500 px/s, size 3.0, lifetime 4.0s |

### XP System (Auto Level-up)
- Starting XP to next: 15
- XP gained: `score_value / 2` per kill

On level up:
- max_hp += 8
- hp += 8 (capped at max_hp)
- damage *= 1.1
- xp_to_next = floor(xp_to_next * 1.3)

XP overflows carry over (while loop processes multiple level-ups).

### Manual Upgrade (costs money)
- Starting cost: $80

On upgrade:
- level += 1
- max_hp += 15
- hp = max_hp (full heal)
- damage *= 1.2
- speed += 8
- fire_cooldown *= 0.93 (floor 0.05s)
- heal_rate += 3.0
- Every 3 levels (when `level % 3 == 0`): shot_spread += 1 (max 7)
- Next cost: floor(cost * 1.5)

### Combat
- Ram damage: deals `player.damage * 2.0` to enemy, takes `enemy.damage * 0.5`
- Invulnerability timer prevents damage when > 0

## Black Holes

Environmental hazard that spawns on placement zone borders.

| Stat          | Value  |
|---------------|--------|
| Visual radius | 15px   |
| Pull radius   | 150px  |
| Pull force    | 80 px/s^2 |
| Kill radius   | 12px   |
| Lifetime      | 8.0s   |
| Spawn interval| 15-30s (random) |
| Initial timer | 20s    |
| Rotation speed| 3.0 rad/s |

Effects:
- Pulls enemies, towers, drones, projectiles toward center
- Destroys enemies at kill_radius (no reward)
- Destroys towers at kill_radius (removes links and drones)
- Only spawns during active waves
- Spawns on right, top, or bottom edges of placement zone

## Hive Drones

Autonomous units spawned by Hive towers.

| Stat           | Value  |
|----------------|--------|
| Speed          | 200 px/s |
| Damage         | hive.damage * hive.energy |
| Attack cooldown| 0.8s   |
| Attack range   | 15px   |
| Orbit radius   | 25px (idle) |
| Orbit speed    | 2.0 rad/s |
| Return threshold| 30px from hive |

States: Idle (orbiting hive) -> Attacking (flying to target) -> Returning (back to hive).
Drones are removed when their hive is sold or destroyed.
