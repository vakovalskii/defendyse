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
                damage: 12.0, range: 170.0, fire_cooldown: 2.2,
                fire_timer: 0.0, level: 1, cost: 90, max_drones: 0, energy: 1.0,
            },
            TowerKind::Laser => Self {
                id, kind, x, y,
                damage: 2.0, range: 70.0, fire_cooldown: 0.25,
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
        self.cost * self.level
    }

    pub fn upgrade(&mut self) {
        self.level += 1;
        self.damage *= 1.25;
        self.range *= 1.08;
        self.fire_cooldown *= 0.92;
        if self.kind == TowerKind::Hive {
            self.max_drones += 1; // +1 drone per upgrade
        }
    }
}
