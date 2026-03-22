use serde::Serialize;
use crate::game::enemy::EnemyKind;

#[derive(Debug, Clone, Serialize)]
pub struct SpawnEntry {
    pub kind: EnemyKind,
    pub count: u32,
    pub interval: f64,
    pub hp_mult: f64,   // scales enemy HP
    pub speed_mult: f64, // scales enemy speed
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

        // Scaling factor: enemies get stronger every wave
        // HP multiplier: 1.0 at wave 1, grows ~8% per wave → wave 100 = ~2200x, wave 1000 = insane
        let hp_scale = 1.0 + (n as f64 - 1.0) * 0.08;
        // Speed scale: very gentle, caps at 2x
        let speed_scale = (1.0 + n as f64 * 0.005).min(2.0);

        // Drones: always, count grows linearly + quadratic component
        let drone_count = 5 + n * 3 + n * n / 50;
        let drone_interval = (0.5 - n as f64 * 0.005).max(0.08);
        spawns.push(SpawnEntry {
            kind: EnemyKind::Drone,
            count: drone_count,
            interval: drone_interval,
            hp_mult: hp_scale,
            speed_mult: speed_scale,
        });

        // Fighters: from wave 2, scale steadily
        if n >= 2 {
            let fighter_count = (n - 1) * 2 + n * n / 80;
            let fighter_interval = (1.0 - n as f64 * 0.008).max(0.2);
            spawns.push(SpawnEntry {
                kind: EnemyKind::Fighter,
                count: fighter_count,
                interval: fighter_interval,
                hp_mult: hp_scale,
                speed_mult: speed_scale,
            });
        }

        // Tanks: from wave 3, scale slower but HP scales hard
        if n >= 3 {
            let tank_count = ((n - 2) as f64 * 0.8).ceil() as u32 + n * n / 200;
            let tank_interval = (2.5 - n as f64 * 0.01).max(0.8);
            spawns.push(SpawnEntry {
                kind: EnemyKind::Tank,
                count: tank_count,
                interval: tank_interval,
                hp_mult: hp_scale * 1.1, // tanks scale slightly faster
                speed_mult: speed_scale * 0.9, // but stay slower
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
