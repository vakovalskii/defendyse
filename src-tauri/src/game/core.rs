use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct PlanetCore {
    pub x: f64,
    pub y: f64,
    pub radius: f64,
    pub hp: f64,
    pub max_hp: f64,
    pub damage: f64,
    pub range: f64,
    pub fire_cooldown: f64,
    pub fire_timer: f64,
}

impl PlanetCore {
    pub fn new(x: f64, y: f64) -> Self {
        Self {
            x,
            y,
            radius: 40.0,
            hp: 350.0,
            max_hp: 350.0,
            damage: 3.0,       // per enemy per strike
            range: 130.0,      // lightning range
            fire_cooldown: 0.6,
            fire_timer: 0.0,
        }
    }

    pub fn is_alive(&self) -> bool {
        self.hp > 0.0
    }

    pub fn take_damage(&mut self, dmg: f64) {
        self.hp = (self.hp - dmg).max(0.0);
    }
}
