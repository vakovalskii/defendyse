use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct BlackHole {
    pub id: u32,
    pub x: f64,
    pub y: f64,
    pub radius: f64,       // visual size
    pub pull_radius: f64,  // gravitational pull range
    pub pull_force: f64,   // pixels/sec acceleration
    pub kill_radius: f64,  // destroy anything this close
    pub lifetime: f64,     // seconds remaining
    pub max_lifetime: f64,
    pub rotation: f64,     // for visual spin
}

impl BlackHole {
    pub fn new(id: u32, x: f64, y: f64) -> Self {
        Self {
            id, x, y,
            radius: 15.0,
            pull_radius: 150.0,
            pull_force: 80.0,
            kill_radius: 12.0,
            lifetime: 8.0,
            max_lifetime: 8.0,
            rotation: 0.0,
        }
    }
}
