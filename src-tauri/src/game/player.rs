use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PlayerInput {
    pub up: bool,
    pub down: bool,
    pub left: bool,
    pub right: bool,
    pub fire: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct PlayerShip {
    pub x: f64,
    pub y: f64,
    pub hp: f64,
    pub max_hp: f64,
    pub speed: f64,
    pub damage: f64,
    pub fire_cooldown: f64,
    pub fire_timer: f64,
    pub alive: bool,
    pub respawn_timer: f64,
    pub level: u32,
    pub xp: u32,
    pub xp_to_next: u32,
    pub angle: f64,
    pub heal_rate: f64,
    pub invuln_timer: f64,
    pub upgrade_cost: u32,
    pub engine_phase: f64, // for engine animation
    pub shot_spread: u32,  // 1=single, 2=double, 3=triple, 4+=fan
}

impl PlayerShip {
    pub fn new(x: f64, y: f64) -> Self {
        Self {
            x, y,
            hp: 60.0,
            max_hp: 60.0,
            speed: 180.0,
            damage: 3.0,
            fire_cooldown: 0.25,
            fire_timer: 0.0,
            alive: true,
            respawn_timer: 0.0,
            level: 1,
            xp: 0,
            xp_to_next: 15,
            angle: 0.0,
            heal_rate: 20.0,
            invuln_timer: 0.0,
            upgrade_cost: 80,
            engine_phase: 0.0,
            shot_spread: 1,
        }
    }

    pub fn gain_xp(&mut self, amount: u32) {
        self.xp += amount;
        while self.xp >= self.xp_to_next {
            self.xp -= self.xp_to_next;
            self.level_up_auto();
        }
    }

    fn level_up_auto(&mut self) {
        self.level += 1;
        self.max_hp += 8.0;
        self.hp = (self.hp + 8.0).min(self.max_hp);
        self.damage *= 1.1;
        self.xp_to_next = (self.xp_to_next as f64 * 1.3) as u32;
    }

    /// Manual upgrade for money
    pub fn upgrade(&mut self) {
        self.level += 1;
        self.max_hp += 15.0;
        self.hp = self.max_hp;
        self.damage *= 1.2;
        self.speed += 8.0;
        self.fire_cooldown = (self.fire_cooldown * 0.93).max(0.05);
        self.heal_rate += 3.0;

        // Every 3 levels add a shot
        if self.level % 3 == 0 && self.shot_spread < 7 {
            self.shot_spread += 1;
        }

        self.upgrade_cost = (self.upgrade_cost as f64 * 1.5) as u32;
    }

    pub fn take_damage(&mut self, dmg: f64) {
        if self.invuln_timer > 0.0 { return; }
        self.hp -= dmg;
        if self.hp <= 0.0 {
            self.hp = 0.0;
            self.alive = false;
            self.respawn_timer = 3.0;
        }
    }
}
