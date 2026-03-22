use serde::Serialize;
use crate::game::enemy::EnemyKind;

#[derive(Debug, Clone, Serialize)]
pub struct SpawnEntry {
    pub kind: EnemyKind,
    pub count: u32,
    pub interval: f64,
    pub hp_mult: f64,
    pub speed_mult: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct Wave {
    pub number: u32,
    pub spawns: Vec<SpawnEntry>,
    pub current_spawn_index: usize,
    pub spawned_in_current: u32,
    pub spawn_timer: f64,
    pub started: bool,
    pub finished_spawning: bool,
}

impl Wave {
    pub fn generate(number: u32) -> Self {
        let n = number;
        let mut spawns = vec![];

        // HP scale: +5% per wave (gentler curve, still infinite)
        // Wave 10: 1.45x, Wave 20: 1.95x, Wave 50: 3.45x, Wave 100: 5.95x
        let hp_scale = 1.0 + (n as f64 - 1.0) * 0.05;
        // Speed: very gentle, cap 1.5x
        let speed_scale = (1.0 + n as f64 * 0.003).min(1.5);

        // Drones: more to compensate for player ship
        let drone_count = 8 + n * 5 + n * n / 50;
        let drone_interval = (0.35 - n as f64 * 0.004).max(0.07);
        spawns.push(SpawnEntry {
            kind: EnemyKind::Drone,
            count: drone_count,
            interval: drone_interval,
            hp_mult: hp_scale,
            speed_mult: speed_scale,
        });

        // Fighters: from wave 3
        if n >= 3 {
            let fighter_count = (n - 2) * 2 + n * n / 60;
            let fighter_interval = (1.2 - n as f64 * 0.006).max(0.3);
            spawns.push(SpawnEntry {
                kind: EnemyKind::Fighter,
                count: fighter_count,
                interval: fighter_interval,
                hp_mult: hp_scale,
                speed_mult: speed_scale,
            });
        }

        // Tanks: from wave 5, give player time to build up
        if n >= 5 {
            let tank_count = ((n - 4) as f64 * 0.8).ceil() as u32 + n * n / 200;
            let tank_interval = (3.0 - n as f64 * 0.01).max(1.2);
            spawns.push(SpawnEntry {
                kind: EnemyKind::Tank,
                count: tank_count,
                interval: tank_interval,
                hp_mult: hp_scale,
                speed_mult: speed_scale * 0.9,
            });
        }

        Self {
            number: n,
            spawns,
            current_spawn_index: 0,
            spawned_in_current: 0,
            spawn_timer: 0.0,
            started: false,
            finished_spawning: false,
        }
    }
}
