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

## Towers (Techno Machines)
All towers are techno machines with distinct geometric shapes. Towers weaken with distance from core (power system): 100% effectiveness near core, 30% at the far edge.

### Gatling — $50
Fast-firing, low damage, medium range. Best against Drones (scarabs).

| Stat | Base | Per Level (+8% DMG per level) |
|------|------|------|
| Damage | 1.0 | Scales +8% per level |
| Range | 120 px | L2: 132, L3: 145 |
| Fire Rate | 0.15s | L2: 0.135s, L3: 0.12s |
| Shape | Green square (techno machine) | |

### Cannon — $100
Slow-firing, high damage, long range. Best against Tanks (crabs).

| Stat | Base | Per Level |
|------|------|------|
| Damage | 20.0 | Scales +8% per level |
| Range | 200 px | L2: 220, L3: 242 |
| Fire Rate | 2.0s | L2: 1.8s, L3: 1.62s |
| Shape | Orange diamond (techno machine) | |

### Laser — $75
Medium fire, medium damage, short range. Fast projectile.

| Stat | Base | Per Level |
|------|------|------|
| Damage | 3.0 | Scales +8% per level |
| Range | 80 px | L2: 88, L3: 97 |
| Fire Rate | 0.3s | L2: 0.27s, L3: 0.24s |
| Shape | Magenta triangle (techno machine) | |

### Hive (Drone Station) — $150
Spawns autonomous drones that hunt enemies. Drones seek the nearest enemy and attack independently.

| Stat | Base | Per Level |
|------|------|------|
| Drones | 2 | +1 drone every 3 levels |
| Drone Damage | Scales +8% per level | |
| Range | Autonomous (drones hunt freely) | |
| Shape | Hexagonal techno station | |

### Upgrade System
- Upgrade cost formula: `base_cost * level * sqrt(level) * 0.5`
- Tower upgrades grant +8% DMG per level
- Designed for infinite scaling (1000+ levels)

### Placement Rules
- **Trapezoidal placement zone**: wide near core, narrow at far edge
- Cannot place within 60px of core center (radius 40 + 20 buffer)
- Cannot place within 30px of another tower
- **Max 3 same-type towers** with overlapping ranges
- Must have enough money

### Tower Slots
- Start with **5 tower slots**
- Gain **+1 slot every 2 waves**
- Can buy additional slots for **$1000**

---

## Spirit Links
Towers can be connected via Spirit Links to boost each other.

### Spirit Link
- **Cost**: $100 per link
- **Bonus**: +20% DMG, +15% fire rate per link
- Connect any two towers

### Spirit Triangle
- When **3 towers** are all linked to each other (forming a triangle), they create a **35% slow field** affecting enemies in the triangle area

---

## Enemies (Organic Creatures)
All enemies are organic, biological creatures from the swarm.

### Drone — Scarab Bug
Simple kamikaze unit. Cheap, expendable. Visually resembles a scarab beetle.

| Stat | Value |
|------|-------|
| HP | 1 (scales +8% per wave) |
| Speed | 120 px/s |
| Kamikaze Damage | 10 |
| Can Shoot | No |
| Size | 4 px |
| Kill Reward | $5 + 10 score (scales with wave number) |
| Visual | Scarab bug (organic) |

### Fighter — Squid/Octopus
Fast, can shoot at the core. Dangerous. Visually resembles a squid or octopus.

| Stat | Value |
|------|-------|
| HP | 4 (scales +8% per wave) |
| Speed | 180 px/s |
| Kamikaze Damage | 15 |
| Can Shoot | Yes (2 dmg, 1.5s cooldown, 300px range) |
| Size | 6 px |
| Kill Reward | $15 + 25 score (scales with wave number) |
| Visual | Squid/octopus (organic) |

### Tank — Crab
Slow, massive HP. Deals huge damage on contact. Visually resembles a crab.

| Stat | Value |
|------|-------|
| HP | 150 (scales +8% per wave) |
| Speed | 40 px/s |
| Kamikaze Damage | 50 |
| Can Shoot | No |
| Size | 12 px |
| Kill Reward | $50 + 100 score (scales with wave number) |
| Visual | Crab (organic) |
