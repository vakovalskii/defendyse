# Physics and Mechanics

## World

- World size: 1536 x 864 pixels
- Core position: (90, 432) -- left-center of screen
- Off-screen margin: 50px for projectile cleanup

## Power System (Tower Energy)

Towers closer to the core are stronger. Energy acts as a multiplier on damage and fire rate.

```
max_dist = PLACE_X_MAX - core.x  (1200 - 90 = 1110px)
min_energy = 0.3
t = clamp(dist_to_core / max_dist, 0, 1)
energy = 1.0 - t * (1.0 - 0.3)
```

- At core (dist=0): energy = 1.0 (100%)
- At max distance (dist=1110): energy = 0.3 (30%)
- Smooth linear falloff between

Energy multiplies tower damage and fire rate when shooting.

## Movement

### Enemies
All enemies move in a straight line toward the core:
```
dx = core.x - enemy.x
dy = core.y - enemy.y
dist = sqrt(dx^2 + dy^2)
enemy.x += (dx / dist) * speed * speed_mult * dt
enemy.y += (dy / dist) * speed * speed_mult * dt
```

If the enemy is inside a spirit triangle, `speed_mult = 0.65` (35% slow). Otherwise `speed_mult = 1.0`.

Enemies spawn at `x = WORLD_W + 20` (1556), with random `y` in range `40..824`.

### Player Ship
Arrow keys (or WASD via `PlayerInput`). Diagonal movement is normalized to unit length.
```
speed = 180.0 px/s (base)
clamp: x in [20, 1516], y in [20, 844]
```
Ship angle tracks movement direction via `atan2(vy, vx)`.

### Black Hole Pull
Black holes pull enemies, towers, drones, and projectiles within `pull_radius`:
```
strength = pull_force * (1.0 - dist / pull_radius) * dt
```
Multipliers per entity type:
- Enemies: 1.0x
- Towers: 0.3x (resist more)
- Hive drones: 0.5x
- Projectiles: 2.0x (pulled hard)

Enemies within `kill_radius` (12px) are destroyed. Towers within `kill_radius` are removed (along with their spirit links and drones).

## Collision Detection

All collisions are circle-circle distance checks.

### Projectile vs Enemy
```
dist < enemy.size + projectile.size
```

### Projectile vs Core (enemy shots only)
```
dist < core.radius  (40px)
```

### Projectile vs Player (enemy shots only)
```
dist < 10px
```

### Enemy vs Core (kamikaze)
```
dist < core.radius + enemy.size
```
Enemy deals its full `damage` to core, then dies.

### Enemy vs Player Ship (ram)
```
dist < enemy.size + 8px
```
Player takes `enemy.damage * 0.5`. Enemy takes `player.damage * 2.0`.

### Hive Drone vs Enemy
```
dist < 15px (attack range)
```

## Projectile Physics

All projectiles use normalized direction * speed for velocity:
```
vx = (dx / dist) * speed
vy = (dy / dist) * speed
```

Updated each tick: `x += vx * dt`, `y += vy * dt`, `lifetime -= dt`.

| Kind       | Speed (px/s) | Size (px) | Lifetime (s) | Notes                                |
|------------|-------------|-----------|-------------|--------------------------------------|
| Gatling    | 600         | 2.0       | 5.0         | Standard single-target               |
| Cannon     | 250         | 7.0       | 8.0         | Piercing -- passes through enemies   |
| Laser      | 900         | 1.5       | 0.15        | Near-instant, very short lifetime    |
| Core       | 350         | 3.5       | 5.0         | Core lightning (visual arcs)         |
| EnemyShot  | 250         | 2.5       | 5.0         | Fighter projectiles at core          |
| PlayerShot | 500         | 3.0       | 4.0         | Cyan bolts from player ship          |

## Targeting

### Tower Targeting
Towers target the nearest enemy within range. Lead prediction is applied:
```
proj_speed = {Gatling: 600, Cannon: 200, Laser: 900}
time_to_hit = dist / proj_speed
lead_x = enemy.x + enemy_vx * time_to_hit
lead_y = enemy.y + enemy_vy * time_to_hit
```

Damage is multiplied by `energy * (1.0 + link_count * 0.20)`.
Fire rate is multiplied by `energy * (1.0 + link_count * 0.15)`.

### Core Lightning
Fires every 0.6s. Hits ALL enemies within range (130px) simultaneously. Deals 3 DMG per enemy per strike. Creates visual `LightningArc` with 0.15s lifetime.

### Hive Drones
Drones orbit their hive when idle. When an enemy enters the hive's range, the nearest enemy is targeted. Drones fly at 200 px/s to their target, deal damage on contact (within 15px), then seek the next target or return. While returning, they check for new targets in range and re-engage.

### Player Ship Auto-aim
When firing (Space), targets the nearest enemy globally (no range limit). Fires a fan of `shot_spread` projectiles with 0.12 radians between each shot:
```
offset = (i - (spread - 1) / 2) * 0.12
angle = base_angle + offset
target = (x + cos(angle) * 500, y + sin(angle) * 500)
```

### Enemy Shooting
Fighters shoot at the core when within 300px. Projectile damage is 2.0 (fixed, not the fighter's melee damage). Cooldown is 1.5s per fighter.

## Spirit Links

- Cost: $100 per link
- Max distance: 250px between towers
- Max links per tower: 2
- Bonuses per link: +20% damage, +15% fire rate
- Triangle: when 3 towers are all mutually linked, forms a slow field
- Triangle slow: 35% speed reduction for enemies inside (barycentric point-in-triangle test)
- Moving a tower breaks all its links
- Selling a tower removes all its links and recalculates triangles

## Black Holes

- Visual radius: 15px
- Pull radius: 150px
- Pull force: 80 px/s^2
- Kill radius: 12px
- Lifetime: 8.0s
- Initial spawn timer: 20s, subsequent: random 15-30s
- Only spawn during active waves
- Spawn locations: zone borders (right edge, top edge, bottom edge of placement zone) with +/-20-30px jitter
- Destroy enemies within kill_radius (no kill reward)
- Destroy towers within kill_radius (removes links/drones)
- Rotation: 3.0 rad/s (visual spin)

## Placement Constraints

### Trapezoidal Zone
```
X range: 200 to 1200
Y center: 432
At x=200 (near core): y half-range = 390 -> y from 42 to 822
At x=1200 (far right): y half-range = 100 -> y from 332 to 532
Linear interpolation between
```

Formula:
```
t = (x - 200) / (1200 - 200)
half = 390 + t * (100 - 390)
y_min = 432 - half
y_max = 432 + half
```

### Grid Snap
All tower positions snap to 60px grid:
```
gx = round(x / 60) * 60
gy = round(y / 60) * 60
```

### Overlap Limits
- No two towers in the same grid cell
- Max 3 same-kind towers with overlapping ranges in a cluster
- Overlap check: `dist < new_tower.range + existing_tower.range`

### Tower Slots
- Starting slots: 5
- +1 slot every 2 waves (when `next_wave_number % 2 == 0`)
- Buy additional slot: $1000

## Cannon Piercing

Cannon projectiles pass through enemies instead of being destroyed on hit. The `pierced_ids` vector tracks which enemies have already been hit to prevent double-damage on the same enemy. The projectile continues until its lifetime expires (8.0s) or it goes off-screen.
