# Physics & Game Mechanics

## World
- Canvas: 1280x720 (logical units = pixels)
- Coordinate system: top-left origin (0,0), x grows right, y grows down
- Core located at x=80, y=360 (left side center)
- Enemies spawn at x=1300 (off-screen right), random y [40..680]
- **Placement zone**: trapezoidal shape — wide near core, narrow at far edge

## Power System
Towers weaken with distance from the core:
- **Near core**: 100% effectiveness (damage, fire rate)
- **Far edge**: 30% effectiveness
- Linear interpolation between near and far
- Encourages strategic placement closer to the core

## Movement
- All entities move in straight lines toward their target
- Direction calculated as normalized vector: `(target - pos) / distance`
- Position update: `pos += direction * speed * dt`
- `dt` = time since last tick (~16ms at 60fps)
- Speed controls: x1 / x2 / x3 multiplier applied to dt

## Collision Detection
- Circle-to-circle: `distance(a, b) < a.size + b.size`
- Projectile vs Enemy: `distance < enemy.size + projectile.size`
- Projectile vs Core: `distance < core.radius`
- Enemy reaches Core: `distance < core.radius + enemy.size` → kamikaze damage

## Projectile Physics
Each tower type has distinct ballistics:

| Type | Speed (px/s) | Size (px) | Lifetime (s) | Behavior |
|------|-------------|-----------|---------------|----------|
| Gatling | 600 | 2.0 | 5.0 | Fast bullet stream |
| Cannon | 200 | 6.0 | 5.0 | Slow heavy shell |
| Laser | 900 | 1.5 | 0.15 | Near-instant beam, fades fast |
| Hive Drone | Autonomous | 3.0 | — | Hunts nearest enemy, persistent |
| Core | 350 | 3.5 | 5.0 | Core defense bolt |
| EnemyShot | 250 | 2.5 | 5.0 | Fighter attack |

- Projectiles travel in a straight line from origin to target position at fire time
- No homing/tracking — projectiles can miss if enemy moves (except Hive drones which actively track)
- Projectiles despawn when: off-screen, lifetime expired, or hit target
- Hive drones are persistent and autonomously hunt enemies; +1 drone every 3 tower levels

## Targeting
- Towers and Core target the **closest** enemy within range
- Fighters target the Core when within 300px
- Hive drones independently seek nearest enemy
- No prediction/leading — fires at current enemy position

## Spirit Links
- Two linked towers: +20% DMG, +15% fire rate per link
- Spirit Triangle (3 mutually linked towers): creates a 35% slow field in the triangle area
- Link cost: $100 per connection

## Placement Constraints
- **Trapezoidal zone**: wider near core, narrower at far edge
- Cannot place within 60px of core center (radius 40 + 20 buffer)
- Cannot place within 30px of another tower
- **Max 3 same-type towers** with overlapping ranges
- Tower slots: start with 5, +1 every 2 waves, buy for $1000

## Visual Effects
- Parallax starfield: 3 layers at different scroll speeds
- Nebulae: ambient background elements
- Particle system: projectile trails, explosions, ambient particles
- Floating damage numbers on hits
- Screen shake on impacts
- Neon glow on towers and projectiles
