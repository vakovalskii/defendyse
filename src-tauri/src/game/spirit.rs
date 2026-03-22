use serde::Serialize;

pub const LINK_COST: u32 = 100;
pub const LINK_MAX_DISTANCE: f64 = 250.0;
pub const MAX_LINKS_PER_TOWER: usize = 2;

// Bonuses per link
pub const DAMAGE_BONUS_PER_LINK: f64 = 0.20;   // +20% damage per link
pub const SPEED_BONUS_PER_LINK: f64 = 0.15;     // +15% fire rate per link

// Triangle spirit field
pub const TRIANGLE_SLOW_FACTOR: f64 = 0.35;     // 35% slow to enemies inside

#[derive(Debug, Clone, Serialize)]
pub struct SpiritLink {
    pub id: u32,
    pub tower_a: u32,
    pub tower_b: u32,
    pub pulse_phase: f64, // for animation sync
}

/// A triangle formed by 3 mutually linked towers
#[derive(Debug, Clone, Serialize)]
pub struct SpiritTriangle {
    pub tower_ids: [u32; 3],
    pub vertices: [(f64, f64); 3], // positions for rendering
}

/// Check if point is inside triangle using barycentric coordinates
pub fn point_in_triangle(px: f64, py: f64, v: &[(f64, f64); 3]) -> bool {
    let (x1, y1) = v[0];
    let (x2, y2) = v[1];
    let (x3, y3) = v[2];

    let denom = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3);
    if denom.abs() < 0.001 { return false; }

    let a = ((y2 - y3) * (px - x3) + (x3 - x2) * (py - y3)) / denom;
    let b = ((y3 - y1) * (px - x3) + (x1 - x3) * (py - y3)) / denom;
    let c = 1.0 - a - b;

    a >= 0.0 && b >= 0.0 && c >= 0.0
}
