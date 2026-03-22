use serde::Serialize;
use crate::game::enemy::EnemyKind;

#[derive(Debug, Clone, Serialize)]
pub struct SpawnEntry {
    pub kind: EnemyKind,
    pub count: u32,
    pub interval: f64,
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
        let mut spawns = vec![];

        // Drones: always present, scale fast
        let drone_count = 3 + number * 4;
        let drone_interval = (0.5 - number as f64 * 0.02).max(0.15);
        spawns.push(SpawnEntry {
            kind: EnemyKind::Drone,
            count: drone_count,
            interval: drone_interval,
        });

        // Fighters: from wave 2, scale steadily
        if number >= 2 {
            let fighter_count = 1 + (number - 1) * 2;
            let fighter_interval = (1.2 - number as f64 * 0.05).max(0.4);
            spawns.push(SpawnEntry {
                kind: EnemyKind::Fighter,
                count: fighter_count,
                interval: fighter_interval,
            });
        }

        // Tanks: from wave 3, cap at 8
        if number >= 3 {
            let tank_count = (number - 2).min(8);
            let tank_interval = (3.0 - number as f64 * 0.1).max(1.5);
            spawns.push(SpawnEntry {
                kind: EnemyKind::Tank,
                count: tank_count,
                interval: tank_interval,
            });
        }

        Self {
            number,
            spawns,
            current_spawn_index: 0,
            spawned_in_current: 0,
            spawn_timer: 0.0,
            started: false,
            finished_spawning: false,
        }
    }
}
