use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub enum DroneState {
    Idle,       // orbiting hive
    Attacking,  // flying to target
    Returning,  // flying back to hive
}

#[derive(Debug, Clone, Serialize)]
pub struct HiveDrone {
    pub id: u32,
    pub hive_id: u32,     // tower it belongs to
    pub x: f64,
    pub y: f64,
    pub state: DroneState,
    pub target_enemy: Option<u32>,
    pub damage: f64,
    pub speed: f64,
    pub attack_cooldown: f64,
    pub attack_timer: f64,
    pub orbit_angle: f64,  // for idle orbit animation
}

impl HiveDrone {
    pub fn new(id: u32, hive_id: u32, hive_x: f64, hive_y: f64, damage: f64) -> Self {
        Self {
            id,
            hive_id,
            x: hive_x,
            y: hive_y,
            state: DroneState::Idle,
            target_enemy: None,
            damage,
            speed: 200.0,
            attack_cooldown: 0.8,
            attack_timer: 0.0,
            orbit_angle: id as f64 * 1.5, // spread drones around orbit
        }
    }
}
