use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub enum EnemyKind {
    Drone,
    Fighter,
    Tank,
}

#[derive(Debug, Clone, Serialize)]
pub struct Enemy {
    pub id: u32,
    pub kind: EnemyKind,
    pub x: f64,
    pub y: f64,
    pub hp: f64,
    pub max_hp: f64,
    pub speed: f64,
    pub damage: f64,
    pub alive: bool,
    pub can_shoot: bool,
    pub fire_cooldown: f64,
    pub fire_timer: f64,
    pub size: f64,
}

impl Enemy {
    pub fn new(id: u32, kind: EnemyKind, x: f64, y: f64) -> Self {
        match kind {
            // Drone: 1HP, dies to 1 Gatling shot. Dangerous in swarms.
            EnemyKind::Drone => Self {
                id, kind, x, y,
                hp: 1.0, max_hp: 1.0,
                speed: 65.0,
                damage: 10.0,
                alive: true,
                can_shoot: false,
                fire_cooldown: 0.0,
                fire_timer: 0.0,
                size: 4.0,
            },
            // Fighter: needs ~3 Laser hits or ~5 Gatling hits. Shoots back.
            EnemyKind::Fighter => Self {
                id, kind, x, y,
                hp: 5.0, max_hp: 5.0,
                speed: 80.0,
                damage: 15.0,
                alive: true,
                can_shoot: true,
                fire_cooldown: 1.2,
                fire_timer: 0.0,
                size: 6.0,
            },
            // Tank: needs ~14 Cannon hits or a LOT of Gatling. Slow but devastating.
            EnemyKind::Tank => Self {
                id, kind, x, y,
                hp: 160.0, max_hp: 160.0,
                speed: 22.0,
                damage: 50.0,
                alive: true,
                can_shoot: false,
                fire_cooldown: 0.0,
                fire_timer: 0.0,
                size: 12.0,
            },
        }
    }

    pub fn take_damage(&mut self, dmg: f64) {
        self.hp -= dmg;
        if self.hp <= 0.0 {
            self.alive = false;
        }
    }
}
