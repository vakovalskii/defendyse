# Physics & Game Mechanics

## World
- Canvas: 1280x720 (logical units = pixels)
- Coordinate system: top-left origin (0,0), x grows right, y grows down
- Core located at x=80, y=360 (left side center)
- Enemies spawn at x=1300 (off-screen right), random y [40..680]

## Movement
- All entities move in straight lines toward their target
- Direction calculated as normalized vector: `(target - pos) / distance`
- Position update: `pos += direction * speed * dt`
- `dt` = time since last tick (~16ms at 60fps)

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
| Core | 350 | 3.5 | 5.0 | Core defense bolt |
| EnemyShot | 250 | 2.5 | 5.0 | Fighter attack |

- Projectiles travel in a straight line from origin to target position at fire time
- No homing/tracking — projectiles can miss if enemy moves
- Projectiles despawn when: off-screen, lifetime expired, or hit target

## Targeting
- Towers and Core target the **closest** enemy within range
- Fighters target the Core when within 300px
- No prediction/leading — fires at current enemy position
