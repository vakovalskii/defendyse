use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub enum ProjectileOwner {
    Tower(u32),
    Core,
    Enemy(u32),
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub enum ProjectileKind {
    Gatling,  // fast, small
    Cannon,   // slow, big, splash
    Laser,    // instant beam (rendered as line)
    Core,     // core defense shot
    EnemyShot,
}

#[derive(Debug, Clone, Serialize)]
pub struct Projectile {
    pub x: f64,
    pub y: f64,
    pub vx: f64,
    pub vy: f64,
    pub damage: f64,
    pub alive: bool,
    pub owner: ProjectileOwner,
    pub kind: ProjectileKind,
    pub speed: f64,
    pub size: f64,
    // for laser beam rendering
    pub origin_x: f64,
    pub origin_y: f64,
    pub lifetime: f64,
}

impl Projectile {
    pub fn new(x: f64, y: f64, target_x: f64, target_y: f64, damage: f64, owner: ProjectileOwner, kind: ProjectileKind) -> Self {
        let dx = target_x - x;
        let dy = target_y - y;
        let dist = (dx * dx + dy * dy).sqrt().max(0.001);

        let (speed, size, lifetime) = match kind {
            ProjectileKind::Gatling   => (600.0, 2.0, 5.0),
            ProjectileKind::Cannon    => (200.0, 6.0, 5.0),
            ProjectileKind::Laser     => (900.0, 1.5, 0.15), // very fast, short-lived visual
            ProjectileKind::Core      => (350.0, 3.5, 5.0),
            ProjectileKind::EnemyShot => (250.0, 2.5, 5.0),
        };

        Self {
            x, y,
            vx: dx / dist * speed,
            vy: dy / dist * speed,
            damage,
            alive: true,
            owner,
            kind,
            speed,
            size,
            origin_x: x,
            origin_y: y,
            lifetime,
        }
    }

    pub fn update(&mut self, dt: f64) {
        self.x += self.vx * dt;
        self.y += self.vy * dt;
        self.lifetime -= dt;
        if self.lifetime <= 0.0 {
            self.alive = false;
        }
    }

    pub fn is_off_screen(&self, w: f64, h: f64) -> bool {
        self.x < -50.0 || self.x > w + 50.0 || self.y < -50.0 || self.y > h + 50.0
    }
}
