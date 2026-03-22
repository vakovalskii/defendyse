use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum TowerKind {
    Gatling,
    Cannon,
    Laser,
    Hive, // drone station
}

#[derive(Debug, Clone, Serialize)]
pub struct Tower {
    pub id: u32,
    pub kind: TowerKind,
    pub x: f64,
    pub y: f64,
    pub damage: f64,
    pub range: f64,
    pub fire_cooldown: f64,
    pub fire_timer: f64,
    pub level: u32,
    pub cost: u32,
    pub max_drones: u32, // only for Hive
    pub energy: f64,     // 0.0-1.0, based on distance from core
}

impl Tower {
    pub fn new(id: u32, kind: TowerKind, x: f64, y: f64) -> Self {
        match kind {
            TowerKind::Gatling => Self {
                id, kind, x, y,
                damage: 1.0, range: 100.0, fire_cooldown: 0.18,
                fire_timer: 0.0, level: 1, cost: 40, max_drones: 0, energy: 1.0,
            },
            TowerKind::Cannon => Self {
                id, kind, x, y,
                damage: 15.0, range: 180.0, fire_cooldown: 1.8,
                fire_timer: 0.0, level: 1, cost: 90, max_drones: 0, energy: 1.0,
            },
            TowerKind::Laser => Self {
                id, kind, x, y,
                damage: 2.5, range: 80.0, fire_cooldown: 0.22,
                fire_timer: 0.0, level: 1, cost: 65, max_drones: 0, energy: 1.0,
            },
            TowerKind::Hive => Self {
                id, kind, x, y,
                damage: 1.5, range: 250.0, fire_cooldown: 0.0,
                fire_timer: 0.0, level: 1, cost: 120, max_drones: 2, energy: 1.0,
            },
        }
    }

    pub fn upgrade_cost(&self) -> u32 {
        // Cost grows: base * level * sqrt(level) — affordable early, expensive late
        let l = self.level as f64;
        (self.cost as f64 * l * l.sqrt() * 0.5).ceil() as u32
    }

    pub fn upgrade(&mut self) {
        self.level += 1;
        // Damage: +8% per level (compounds to massive at high levels)
        self.damage *= 1.08;
        // Range: +1.5% per level, capped at 3x base
        self.range *= 1.015;
        // Fire rate: 2% faster, cooldown floor of 0.02s
        self.fire_cooldown = (self.fire_cooldown * 0.98).max(0.02);
        if self.kind == TowerKind::Hive {
            // +1 drone every 3 levels
            if self.level % 3 == 0 {
                self.max_drones += 1;
            }
        }
    }
}
