# Entities & Stats

## Planet Core
The player's base. Located on the left side of the screen.

| Stat | Value |
|------|-------|
| Position | (80, 360) |
| Radius | 40 px |
| HP | 500 |
| Damage | 5 |
| Range | 150 px |
| Fire Rate | 0.5s cooldown |

The core auto-fires at the nearest enemy in range.
When HP reaches 0 → Game Over.

---

## Towers (AA Defense)

### Gatling — $50
Fast-firing, low damage, medium range. Best against Drones.

| Stat | Base | Per Level (×1.3 dmg, ×1.1 range, ×0.9 cooldown) |
|------|------|------|
| Damage | 1.0 | L2: 1.3, L3: 1.69 |
| Range | 120 px | L2: 132, L3: 145 |
| Fire Rate | 0.15s | L2: 0.135s, L3: 0.12s |
| Shape | Green square | |

### Cannon — $100
Slow-firing, high damage, long range. Best against Tanks.

| Stat | Base | Per Level |
|------|------|------|
| Damage | 20.0 | L2: 26, L3: 33.8 |
| Range | 200 px | L2: 220, L3: 242 |
| Fire Rate | 2.0s | L2: 1.8s, L3: 1.62s |
| Shape | Orange diamond | |

### Laser — $75
Medium fire, medium damage, short range. Fast projectile.

| Stat | Base | Per Level |
|------|------|------|
| Damage | 3.0 | L2: 3.9, L3: 5.07 |
| Range | 80 px | L2: 88, L3: 97 |
| Fire Rate | 0.3s | L2: 0.27s, L3: 0.24s |
| Shape | Magenta triangle | |

### Upgrade System
- Cost per upgrade: `base_cost × current_level`
- Gatling: L2=$50, L3=$100, L4=$150...
- Cannon: L2=$100, L3=$200, L4=$300...
- Laser: L2=$75, L3=$150, L4=$225...

### Placement Rules
- Cannot place within 60px of core center (radius 40 + 20 buffer)
- Cannot place within 30px of another tower
- Must have enough money

---

## Enemies

### Drone (Swarm)
Simple kamikaze unit. Cheap, expendable.

| Stat | Value |
|------|-------|
| HP | 1 |
| Speed | 120 px/s |
| Kamikaze Damage | 10 |
| Can Shoot | No |
| Size | 4 px |
| Kill Reward | $5 + 10 score |
| Shape | Red rectangle |

### Fighter (Assault)
Fast, can shoot at the core. Dangerous.

| Stat | Value |
|------|-------|
| HP | 4 |
| Speed | 180 px/s |
| Kamikaze Damage | 15 |
| Can Shoot | Yes (2 dmg, 1.5s cooldown, 300px range) |
| Size | 6 px |
| Kill Reward | $15 + 25 score |
| Shape | Yellow arrow |

### Tank (Heavy)
Slow, massive HP. Deals huge damage on contact.

| Stat | Value |
|------|-------|
| HP | 150 |
| Speed | 40 px/s |
| Kamikaze Damage | 50 |
| Can Shoot | No |
| Size | 12 px |
| Kill Reward | $50 + 100 score |
| Shape | Orange circle with red border |
