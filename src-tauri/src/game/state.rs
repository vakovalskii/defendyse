use serde::Serialize;
use rand::Rng;
use crate::game::core::PlanetCore;
use crate::game::enemy::{Enemy, EnemyKind};
use crate::game::tower::{Tower, TowerKind};
use crate::game::projectile::{Projectile, ProjectileKind, ProjectileOwner};
use crate::game::wave::Wave;
use crate::game::spirit::{self, SpiritLink, SpiritTriangle};
use crate::game::drone::{HiveDrone, DroneState};
use crate::game::anomaly::BlackHole;
use crate::game::player::{PlayerShip, PlayerInput};

pub const WORLD_W: f64 = 1536.0;
pub const WORLD_H: f64 = 864.0;

// Placement zone: trapezoidal — wide near core, narrow on right
// At x_min (near core): full height (y: 40..680)
// At x_max (far right): narrow band (y: 280..440)
pub const PLACE_X_MIN: f64 = 200.0;
pub const PLACE_X_MAX: f64 = 1200.0;
pub const PLACE_Y_CENTER: f64 = 432.0;
pub const PLACE_Y_HALF_MIN: f64 = 100.0;
pub const PLACE_Y_HALF_MAX: f64 = 390.0;

pub const GRID_SIZE: f64 = 60.0;

/// Get allowed y-range at a given x position (trapezoidal zone)
pub fn zone_y_range(x: f64) -> (f64, f64) {
    let t = ((x - PLACE_X_MIN) / (PLACE_X_MAX - PLACE_X_MIN)).clamp(0.0, 1.0);
    let half = PLACE_Y_HALF_MAX + t * (PLACE_Y_HALF_MIN - PLACE_Y_HALF_MAX);
    (PLACE_Y_CENTER - half, PLACE_Y_CENTER + half)
}

pub fn is_in_zone(x: f64, y: f64) -> bool {
    if x < PLACE_X_MIN || x > PLACE_X_MAX { return false; }
    let (y_min, y_max) = zone_y_range(x);
    y >= y_min && y <= y_max
}

#[derive(Debug, Clone, Serialize)]
pub struct LightningArc {
    pub x1: f64,
    pub y1: f64,
    pub x2: f64,
    pub y2: f64,
    pub life: f64, // fades out
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct GameStats {
    pub drones_killed: u32,
    pub fighters_killed: u32,
    pub tanks_killed: u32,
    pub drones_leaked: u32,    // reached core
    pub fighters_leaked: u32,
    pub tanks_leaked: u32,
    pub damage_taken: f64,
    pub damage_dealt: f64,
    pub money_earned: u32,
    pub money_spent: u32,
    pub towers_placed: u32,
    pub towers_sold: u32,
    pub towers_upgraded: u32,
    pub waves_survived: u32,
    pub game_time: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct GameState {
    pub core: PlanetCore,
    pub enemies: Vec<Enemy>,
    pub towers: Vec<Tower>,
    pub projectiles: Vec<Projectile>,
    pub wave: Wave,
    pub score: u32,
    pub money: u32,
    pub game_over: bool,
    pub wave_active: bool,
    pub wave_cooldown: f64,
    pub next_enemy_id: u32,
    pub next_tower_id: u32,
    pub paused: bool,
    pub selected_tower_kind: TowerKind,
    pub speed_multiplier: f64,
    pub max_towers: u32,
    pub grid_size: f64,
    pub zone_x_min: f64,
    pub zone_x_max: f64,
    pub zone_y_half_min: f64,
    pub zone_y_half_max: f64,
    pub zone_y_center: f64,
    pub stats: GameStats,
    pub spirit_links: Vec<SpiritLink>,
    pub spirit_triangles: Vec<SpiritTriangle>,
    pub next_link_id: u32,
    pub spirit_time: f64,
    pub hive_drones: Vec<HiveDrone>,
    pub next_drone_id: u32,
    pub lightning_arcs: Vec<LightningArc>,
    pub black_holes: Vec<BlackHole>,
    pub next_bh_id: u32,
    pub bh_spawn_timer: f64,
    pub player: PlayerShip,
    #[serde(skip)]
    pub player_input: PlayerInput,
}

impl GameState {
    pub fn new() -> Self {
        Self {
            core: PlanetCore::new(90.0, WORLD_H / 2.0),
            enemies: vec![],
            towers: vec![],
            projectiles: vec![],
            wave: Wave::generate(1),
            score: 0,
            money: 150,
            game_over: false,
            wave_active: false,
            wave_cooldown: 3.0,
            next_enemy_id: 1,
            next_tower_id: 1,
            paused: false,
            selected_tower_kind: TowerKind::Gatling,
            speed_multiplier: 1.0,
            max_towers: 5,
            grid_size: GRID_SIZE,
            zone_x_min: PLACE_X_MIN,
            zone_x_max: PLACE_X_MAX,
            zone_y_half_min: PLACE_Y_HALF_MIN,
            zone_y_half_max: PLACE_Y_HALF_MAX,
            zone_y_center: PLACE_Y_CENTER,
            stats: GameStats::default(),
            spirit_links: vec![],
            spirit_triangles: vec![],
            next_link_id: 1,
            spirit_time: 0.0,
            hive_drones: vec![],
            next_drone_id: 1,
            lightning_arcs: vec![],
            black_holes: vec![],
            next_bh_id: 1,
            bh_spawn_timer: 20.0,
            player: PlayerShip::new(200.0, WORLD_H / 2.0),
            player_input: PlayerInput::default(),
        }
    }

    pub fn tick(&mut self, dt: f64) {
        if self.game_over || self.paused {
            return;
        }

        let dt = dt * self.speed_multiplier;
        self.stats.game_time += dt;
        self.spirit_time += dt;

        // Update link pulse animations
        for link in &mut self.spirit_links {
            link.pulse_phase += dt * 3.0; // pulse speed
        }

        // Wave cooldown / start
        if !self.wave_active {
            self.wave_cooldown -= dt;
            if self.wave_cooldown <= 0.0 {
                self.wave_active = true;
                self.wave.started = true;
            }
        }

        self.recalc_tower_energy();
        self.spawn_enemies(dt);
        self.tick_black_holes(dt);
        self.move_enemies(dt);
        self.towers_shoot(dt);
        self.core_shoot(dt);
        self.enemies_shoot(dt);
        self.tick_hive_drones(dt);
        self.tick_player(dt);
        self.move_projectiles(dt);
        self.check_collisions();
        self.check_enemy_reach_core();
        self.cleanup();
        self.check_wave_complete();

        if !self.core.is_alive() {
            self.game_over = true;
        }
    }

    fn spawn_enemies(&mut self, dt: f64) {
        if self.wave.finished_spawning {
            return;
        }

        self.wave.spawn_timer -= dt;
        if self.wave.spawn_timer > 0.0 {
            return;
        }

        let idx = self.wave.current_spawn_index;
        if idx >= self.wave.spawns.len() {
            self.wave.finished_spawning = true;
            return;
        }

        let spawn = &self.wave.spawns[idx].clone();

        let mut rng = rand::thread_rng();
        let y = rng.gen_range(40.0..WORLD_H - 40.0);
        let x = WORLD_W + 20.0;

        let mut enemy = Enemy::new(self.next_enemy_id, spawn.kind, x, y);
        // Apply wave scaling
        enemy.hp *= spawn.hp_mult;
        enemy.max_hp *= spawn.hp_mult;
        enemy.speed *= spawn.speed_mult;
        enemy.damage *= spawn.hp_mult.sqrt(); // damage scales slower
        self.next_enemy_id += 1;
        self.enemies.push(enemy);

        self.wave.spawned_in_current += 1;
        self.wave.spawn_timer = spawn.interval;

        if self.wave.spawned_in_current >= spawn.count {
            self.wave.current_spawn_index += 1;
            self.wave.spawned_in_current = 0;
        }
    }

    fn tick_black_holes(&mut self, dt: f64) {
        let mut rng = rand::thread_rng();

        // Spawn timer
        if self.wave_active {
            self.bh_spawn_timer -= dt;
            if self.bh_spawn_timer <= 0.0 {
                // Spawn on defense zone borders: right, top, bottom (not left/core side)
                let side = rng.gen_range(0u32..3);
                let (x, y) = match side {
                    0 => { // right border
                        let yy = rng.gen_range(100.0..WORLD_H - 100.0);
                        (PLACE_X_MAX + rng.gen_range(-30.0..30.0), yy)
                    },
                    1 => { // top border
                        let xx = rng.gen_range(PLACE_X_MIN + 100.0..PLACE_X_MAX);
                        let (y_min, _) = zone_y_range(xx);
                        (xx, y_min + rng.gen_range(-20.0..20.0))
                    },
                    _ => { // bottom border
                        let xx = rng.gen_range(PLACE_X_MIN + 100.0..PLACE_X_MAX);
                        let (_, y_max) = zone_y_range(xx);
                        (xx, y_max + rng.gen_range(-20.0..20.0))
                    },
                };

                {
                    let bh = BlackHole::new(self.next_bh_id, x, y);
                    self.next_bh_id += 1;
                    self.black_holes.push(bh);
                }

                // Next spawn: 15-30 seconds
                self.bh_spawn_timer = rng.gen_range(15.0..30.0);
            }
        }

        // Update existing black holes
        for bh in &mut self.black_holes {
            bh.lifetime -= dt;
            bh.rotation += dt * 3.0;
        }

        // Pull enemies toward black holes
        let bh_snap: Vec<(f64, f64, f64, f64, f64)> = self.black_holes.iter()
            .filter(|b| b.lifetime > 0.0)
            .map(|b| (b.x, b.y, b.pull_radius, b.pull_force, b.kill_radius))
            .collect();

        for enemy in &mut self.enemies {
            if !enemy.alive { continue; }
            for &(bx, by, pr, pf, kr) in &bh_snap {
                let dx = bx - enemy.x;
                let dy = by - enemy.y;
                let dist = (dx * dx + dy * dy).sqrt().max(1.0);
                if dist < pr {
                    // Pull strength increases as you get closer (inverse)
                    let strength = pf * (1.0 - dist / pr) * dt;
                    enemy.x += (dx / dist) * strength;
                    enemy.y += (dy / dist) * strength;

                    // Kill if sucked into center
                    if dist < kr {
                        enemy.alive = false;
                    }
                }
            }
        }

        // Pull towers (displacement, destroy if too close)
        // We collect tower ids to remove after iteration
        let mut towers_to_remove = vec![];
        for tower in &mut self.towers {
            for &(bx, by, pr, pf, kr) in &bh_snap {
                let dx = bx - tower.x;
                let dy = by - tower.y;
                let dist = (dx * dx + dy * dy).sqrt().max(1.0);
                if dist < pr {
                    let strength = pf * 0.3 * (1.0 - dist / pr) * dt; // towers resist more
                    tower.x += (dx / dist) * strength;
                    tower.y += (dy / dist) * strength;

                    if dist < kr {
                        towers_to_remove.push(tower.id);
                    }
                }
            }
        }
        for tid in &towers_to_remove {
            self.towers.retain(|t| t.id != *tid);
            self.spirit_links.retain(|l| l.tower_a != *tid && l.tower_b != *tid);
            self.hive_drones.retain(|d| d.hive_id != *tid);
        }
        if !towers_to_remove.is_empty() {
            self.recalc_triangles();
        }

        // Pull hive drones
        for drone in &mut self.hive_drones {
            for &(bx, by, pr, pf, _kr) in &bh_snap {
                let dx = bx - drone.x;
                let dy = by - drone.y;
                let dist = (dx * dx + dy * dy).sqrt().max(1.0);
                if dist < pr {
                    let strength = pf * 0.5 * (1.0 - dist / pr) * dt;
                    drone.x += (dx / dist) * strength;
                    drone.y += (dy / dist) * strength;
                }
            }
        }

        // Pull projectiles
        for proj in &mut self.projectiles {
            if !proj.alive { continue; }
            for &(bx, by, pr, pf, _kr) in &bh_snap {
                let dx = bx - proj.x;
                let dy = by - proj.y;
                let dist = (dx * dx + dy * dy).sqrt().max(1.0);
                if dist < pr {
                    let strength = pf * 2.0 * (1.0 - dist / pr) * dt;
                    proj.vx += (dx / dist) * strength;
                    proj.vy += (dy / dist) * strength;
                }
            }
        }

        // Remove expired
        self.black_holes.retain(|b| b.lifetime > 0.0);
    }

    fn move_enemies(&mut self, dt: f64) {
        let triangles = self.spirit_triangles.clone();
        for enemy in &mut self.enemies {
            if !enemy.alive { continue; }

            // Check if inside any spirit triangle → slow
            let mut speed_mult = 1.0;
            for tri in &triangles {
                if spirit::point_in_triangle(enemy.x, enemy.y, &tri.vertices) {
                    speed_mult = 1.0 - spirit::TRIANGLE_SLOW_FACTOR;
                    break;
                }
            }

            let dx = self.core.x - enemy.x;
            let dy = self.core.y - enemy.y;
            let dist = (dx * dx + dy * dy).sqrt().max(0.001);
            enemy.x += (dx / dist) * enemy.speed * speed_mult * dt;
            enemy.y += (dy / dist) * enemy.speed * speed_mult * dt;
        }
    }

    /// Energy = 1.0 at core, decays to MIN_ENERGY at max distance
    fn recalc_tower_energy(&mut self) {
        let cx = self.core.x;
        let cy = self.core.y;
        // Max possible distance from core to far edge of placement zone
        let max_dist = PLACE_X_MAX - cx; // ~1110px
        let min_energy = 0.3; // 30% at max distance

        for tower in &mut self.towers {
            let dx = tower.x - cx;
            let dy = tower.y - cy;
            let dist = (dx * dx + dy * dy).sqrt();
            let t = (dist / max_dist).clamp(0.0, 1.0);
            // Smooth falloff: close = strong, far = weak
            tower.energy = 1.0 - t * (1.0 - min_energy);
        }
    }

    fn count_tower_links(&self, tower_id: u32) -> usize {
        self.spirit_links.iter()
            .filter(|l| l.tower_a == tower_id || l.tower_b == tower_id)
            .count()
    }

    fn towers_shoot(&mut self, dt: f64) {
        let core_x = self.core.x;
        let core_y = self.core.y;
        let enemies_snapshot: Vec<(u32, f64, f64, f64, bool)> = self.enemies.iter()
            .map(|e| (e.id, e.x, e.y, e.speed, e.alive))
            .collect();

        // Pre-compute link counts for each tower
        let link_counts: Vec<(u32, usize)> = self.towers.iter()
            .map(|t| (t.id, self.count_tower_links(t.id)))
            .collect();

        for tower in &mut self.towers {
            let links = link_counts.iter()
                .find(|(id, _)| *id == tower.id)
                .map(|(_, c)| *c)
                .unwrap_or(0);

            // Hive towers don't shoot — they use drones
            if tower.kind == TowerKind::Hive { continue; }

            // Energy + Spirit bonus: faster fire rate
            let energy = tower.energy;
            let speed_bonus = energy * (1.0 + links as f64 * spirit::SPEED_BONUS_PER_LINK);
            tower.fire_timer -= dt * speed_bonus;
            if tower.fire_timer > 0.0 { continue; }

            let mut best: Option<(u32, f64, f64, f64, f64)> = None;
            for &(id, ex, ey, espeed, alive) in &enemies_snapshot {
                if !alive { continue; }
                let dx = ex - tower.x;
                let dy = ey - tower.y;
                let dist = (dx * dx + dy * dy).sqrt();
                if dist <= tower.range {
                    if best.is_none() || dist < best.unwrap().4 {
                        best = Some((id, ex, ey, espeed, dist));
                    }
                }
            }

            if let Some((_id, ex, ey, espeed, dist)) = best {
                let proj_kind = match tower.kind {
                    TowerKind::Gatling => ProjectileKind::Gatling,
                    TowerKind::Cannon => ProjectileKind::Cannon,
                    TowerKind::Laser => ProjectileKind::Laser,
                    TowerKind::Hive => unreachable!(),
                };
                let proj_speed = match proj_kind {
                    ProjectileKind::Gatling => 600.0,
                    ProjectileKind::Cannon => 200.0,
                    ProjectileKind::Laser => 900.0,
                    _ => 400.0,
                };
                let time_to_hit = dist / proj_speed;
                let edx = core_x - ex;
                let edy = core_y - ey;
                let edist = (edx * edx + edy * edy).sqrt().max(0.001);
                let evx = edx / edist * espeed;
                let evy = edy / edist * espeed;
                let lead_x = ex + evx * time_to_hit;
                let lead_y = ey + evy * time_to_hit;

                // Energy + Spirit bonus: more damage
                let dmg_bonus = energy * (1.0 + links as f64 * spirit::DAMAGE_BONUS_PER_LINK);
                let proj = Projectile::new(tower.x, tower.y, lead_x, lead_y, tower.damage * dmg_bonus, ProjectileOwner::Tower(tower.id), proj_kind);
                self.projectiles.push(proj);
                tower.fire_timer = tower.fire_cooldown;
            }
        }
    }

    fn core_shoot(&mut self, dt: f64) {
        // Fade out old lightning arcs
        for arc in &mut self.lightning_arcs {
            arc.life -= dt;
        }
        self.lightning_arcs.retain(|a| a.life > 0.0);

        self.core.fire_timer -= dt;
        if self.core.fire_timer > 0.0 { return; }

        // Lightning strike ALL enemies in range
        let cx = self.core.x;
        let cy = self.core.y;
        let range = self.core.range;
        let dmg = self.core.damage;
        let mut hit_any = false;

        for enemy in &mut self.enemies {
            if !enemy.alive { continue; }
            let dx = enemy.x - cx;
            let dy = enemy.y - cy;
            let dist = (dx * dx + dy * dy).sqrt();
            if dist <= range {
                self.stats.damage_dealt += dmg.min(enemy.hp);
                enemy.take_damage(dmg);
                hit_any = true;

                // Create visual lightning arc to this enemy
                self.lightning_arcs.push(LightningArc {
                    x1: cx, y1: cy,
                    x2: enemy.x, y2: enemy.y,
                    life: 0.15,
                });

                if !enemy.alive {
                    let wb = 1 + self.wave.number.saturating_sub(10) / 10;
                    let (score_val, money_val) = match enemy.kind {
                        EnemyKind::Drone => { self.stats.drones_killed += 1; (10 * wb, 4 * wb) },
                        EnemyKind::Fighter => { self.stats.fighters_killed += 1; (25 * wb, 12 * wb) },
                        EnemyKind::Tank => { self.stats.tanks_killed += 1; (100 * wb, 35 * wb) },
                    };
                    self.score += score_val;
                    self.money += money_val;
                    self.stats.money_earned += money_val;
                }
            }
        }

        if hit_any {
            self.core.fire_timer = self.core.fire_cooldown;
        }
    }

    fn enemies_shoot(&mut self, dt: f64) {
        let core_x = self.core.x;
        let core_y = self.core.y;
        let mut new_projectiles = vec![];

        for enemy in &mut self.enemies {
            if !enemy.alive || !enemy.can_shoot { continue; }
            enemy.fire_timer -= dt;
            if enemy.fire_timer > 0.0 { continue; }

            let dx = core_x - enemy.x;
            let dy = core_y - enemy.y;
            let dist = (dx * dx + dy * dy).sqrt();
            if dist < 300.0 {
                new_projectiles.push(Projectile::new(
                    enemy.x, enemy.y, core_x, core_y,
                    2.0, ProjectileOwner::Enemy(enemy.id), ProjectileKind::EnemyShot,
                ));
                enemy.fire_timer = enemy.fire_cooldown;
            }
        }

        self.projectiles.extend(new_projectiles);
    }

    fn tick_player(&mut self, dt: f64) {
        let p = &mut self.player;

        // Respawn logic
        if !p.alive {
            p.respawn_timer -= dt;
            if p.respawn_timer <= 0.0 {
                p.alive = true;
                p.hp = p.max_hp * 0.5; // respawn at 50% hp
                p.x = self.core.x + 60.0;
                p.y = self.core.y;
                p.invuln_timer = 2.0; // 2 sec invulnerability
            }
            return;
        }

        p.invuln_timer = (p.invuln_timer - dt).max(0.0);
        p.engine_phase += dt * 12.0;

        // Movement
        let input = &self.player_input;
        let mut vx = 0.0f64;
        let mut vy = 0.0f64;
        if input.up { vy -= 1.0; }
        if input.down { vy += 1.0; }
        if input.left { vx -= 1.0; }
        if input.right { vx += 1.0; }
        let vmag = (vx * vx + vy * vy).sqrt();
        if vmag > 0.0 {
            vx /= vmag;
            vy /= vmag;
            p.x += vx * p.speed * dt;
            p.y += vy * p.speed * dt;
            p.angle = vy.atan2(vx);
        }

        p.x = p.x.clamp(20.0, WORLD_W - 20.0);
        p.y = p.y.clamp(20.0, WORLD_H - 20.0);

        // Heal near core
        let dx = p.x - self.core.x;
        let dy = p.y - self.core.y;
        let dist_to_core = (dx * dx + dy * dy).sqrt();
        if dist_to_core < self.core.radius + 60.0 && p.hp < p.max_hp {
            p.hp = (p.hp + p.heal_rate * dt).min(p.max_hp);
        }

        // Shooting — multi-shot fan
        p.fire_timer -= dt;
        if input.fire && p.fire_timer <= 0.0 {
            let mut best: Option<(f64, f64, f64)> = None;
            for e in &self.enemies {
                if !e.alive { continue; }
                let edx = e.x - p.x;
                let edy = e.y - p.y;
                let edist = (edx * edx + edy * edy).sqrt();
                if best.is_none() || edist < best.unwrap().2 {
                    best = Some((e.x, e.y, edist));
                }
            }

            if let Some((ex, ey, _)) = best {
                let base_angle = (ey - p.y).atan2(ex - p.x);
                let spread = p.shot_spread;
                let fan_angle = 0.12; // radians between shots

                for i in 0..spread {
                    let offset = (i as f64 - (spread as f64 - 1.0) / 2.0) * fan_angle;
                    let a = base_angle + offset;
                    let tx = p.x + a.cos() * 500.0;
                    let ty = p.y + a.sin() * 500.0;
                    let proj = Projectile::new(
                        p.x, p.y, tx, ty,
                        p.damage,
                        ProjectileOwner::Tower(0),
                        ProjectileKind::PlayerShot,
                    );
                    self.projectiles.push(proj);
                }
                p.fire_timer = p.fire_cooldown;
            }
        }

        // Check enemy projectile hits on player
        for proj in &mut self.projectiles {
            if !proj.alive { continue; }
            if let ProjectileOwner::Enemy(_) = proj.owner {
                let pdx = proj.x - p.x;
                let pdy = proj.y - p.y;
                let pdist = (pdx * pdx + pdy * pdy).sqrt();
                if pdist < 10.0 {
                    p.take_damage(proj.damage);
                    proj.alive = false;
                }
            }
        }

        // Check collision with enemies (kamikaze contact)
        for enemy in &mut self.enemies {
            if !enemy.alive { continue; }
            let edx = enemy.x - p.x;
            let edy = enemy.y - p.y;
            let edist = (edx * edx + edy * edy).sqrt();
            if edist < enemy.size + 8.0 {
                p.take_damage(enemy.damage * 0.5);
                enemy.take_damage(p.damage * 2.0); // ship rams enemy
                if !enemy.alive {
                    let wb = 1 + self.wave.number.saturating_sub(10) / 10;
                    let (sv, mv) = match enemy.kind {
                        EnemyKind::Drone => { self.stats.drones_killed += 1; (10*wb, 4*wb) },
                        EnemyKind::Fighter => { self.stats.fighters_killed += 1; (25*wb, 12*wb) },
                        EnemyKind::Tank => { self.stats.tanks_killed += 1; (100*wb, 35*wb) },
                    };
                    self.score += sv;
                    self.money += mv;
                    self.stats.money_earned += mv;
                    p.gain_xp(sv / 2);
                }
            }
        }
    }

    fn tick_hive_drones(&mut self, dt: f64) {
        // 1. Spawn drones for hives that need them
        let hive_info: Vec<(u32, f64, f64, f64, f64, u32, f64)> = self.towers.iter()
            .filter(|t| t.kind == TowerKind::Hive)
            .map(|t| (t.id, t.x, t.y, t.damage, t.range, t.max_drones, t.energy))
            .collect();

        for (hive_id, hx, hy, dmg, _range, max_d, energy) in &hive_info {
            let current = self.hive_drones.iter().filter(|d| d.hive_id == *hive_id).count() as u32;
            if current < *max_d {
                let drone = HiveDrone::new(self.next_drone_id, *hive_id, *hx, *hy, *dmg * *energy);
                self.next_drone_id += 1;
                self.hive_drones.push(drone);
            }
        }

        // 2. Remove drones whose hive was sold
        let hive_ids: Vec<u32> = hive_info.iter().map(|h| h.0).collect();
        self.hive_drones.retain(|d| hive_ids.contains(&d.hive_id));

        // Build enemy snapshot
        let enemies_snap: Vec<(u32, f64, f64, bool)> = self.enemies.iter()
            .map(|e| (e.id, e.x, e.y, e.alive))
            .collect();

        let hive_pos: Vec<(u32, f64, f64, f64)> = hive_info.iter()
            .map(|h| (h.0, h.1, h.2, h.4))
            .collect();

        // 3. Update each drone
        for drone in &mut self.hive_drones {
            let (hx, hy, hrange) = hive_pos.iter()
                .find(|h| h.0 == drone.hive_id)
                .map(|h| (h.1, h.2, h.3))
                .unwrap_or((0.0, 0.0, 250.0));

            match drone.state {
                DroneState::Idle => {
                    // Orbit around hive
                    drone.orbit_angle += dt * 2.0;
                    let orbit_r = 25.0;
                    drone.x = hx + drone.orbit_angle.cos() * orbit_r;
                    drone.y = hy + drone.orbit_angle.sin() * orbit_r;

                    // Look for target
                    let mut best: Option<(u32, f64)> = None;
                    for &(eid, ex, ey, alive) in &enemies_snap {
                        if !alive { continue; }
                        let dx = ex - hx;
                        let dy = ey - hy;
                        let dist = (dx * dx + dy * dy).sqrt();
                        if dist <= hrange {
                            if best.is_none() || dist < best.unwrap().1 {
                                best = Some((eid, dist));
                            }
                        }
                    }
                    if let Some((eid, _)) = best {
                        drone.state = DroneState::Attacking;
                        drone.target_enemy = Some(eid);
                    }
                }
                DroneState::Attacking => {
                    drone.attack_timer -= dt;

                    // Find target position
                    let target = drone.target_enemy.and_then(|tid|
                        enemies_snap.iter().find(|e| e.0 == tid && e.3)
                    );

                    if let Some(&(_, ex, ey, _)) = target {
                        // Fly toward enemy
                        let dx = ex - drone.x;
                        let dy = ey - drone.y;
                        let dist = (dx * dx + dy * dy).sqrt().max(0.001);
                        drone.x += (dx / dist) * drone.speed * dt;
                        drone.y += (dy / dist) * drone.speed * dt;

                        // Check if close enough to deal damage
                        if dist < 15.0 && drone.attack_timer <= 0.0 {
                            if let Some(enemy) = self.enemies.iter_mut().find(|e| e.id == drone.target_enemy.unwrap() && e.alive) {
                                self.stats.damage_dealt += drone.damage.min(enemy.hp);
                                enemy.take_damage(drone.damage);
                                if !enemy.alive {
                                    let wb = 1 + self.wave.number.saturating_sub(10) / 10;
                                    let (score_val, money_val) = match enemy.kind {
                                        EnemyKind::Drone => { self.stats.drones_killed += 1; (10 * wb, 4 * wb) },
                                        EnemyKind::Fighter => { self.stats.fighters_killed += 1; (25 * wb, 12 * wb) },
                                        EnemyKind::Tank => { self.stats.tanks_killed += 1; (100 * wb, 35 * wb) },
                                    };
                                    self.score += score_val;
                                    self.money += money_val;
                                    self.stats.money_earned += money_val;
                                    // Target dead — find next target in range
                                    drone.target_enemy = None;
                                    let mut next_target: Option<(u32, f64)> = None;
                                    for &(eid, eex, eey, ealive) in &enemies_snap {
                                        if !ealive { continue; }
                                        let ddx = eex - hx;
                                        let ddy = eey - hy;
                                        let ddist = (ddx * ddx + ddy * ddy).sqrt();
                                        if ddist <= hrange {
                                            if next_target.is_none() || ddist < next_target.unwrap().1 {
                                                next_target = Some((eid, ddist));
                                            }
                                        }
                                    }
                                    if let Some((neid, _)) = next_target {
                                        drone.target_enemy = Some(neid);
                                        // stay Attacking
                                    } else {
                                        drone.state = DroneState::Returning;
                                    }
                                }
                            }
                            drone.attack_timer = drone.attack_cooldown;
                        }
                    } else {
                        // Target dead or gone — find new target before returning
                        drone.target_enemy = None;
                        let mut next_target: Option<(u32, f64)> = None;
                        for &(eid, eex, eey, ealive) in &enemies_snap {
                            if !ealive { continue; }
                            let ddx = eex - hx;
                            let ddy = eey - hy;
                            let ddist = (ddx * ddx + ddy * ddy).sqrt();
                            if ddist <= hrange {
                                if next_target.is_none() || ddist < next_target.unwrap().1 {
                                    next_target = Some((eid, ddist));
                                }
                            }
                        }
                        if let Some((neid, _)) = next_target {
                            drone.target_enemy = Some(neid);
                            // stay Attacking
                        } else {
                            drone.state = DroneState::Returning;
                        }
                    }
                }
                DroneState::Returning => {
                    // Check for new targets while returning
                    let mut new_target: Option<(u32, f64)> = None;
                    for &(eid, ex, ey, alive) in &enemies_snap {
                        if !alive { continue; }
                        let ddx = ex - hx;
                        let ddy = ey - hy;
                        let ddist = (ddx * ddx + ddy * ddy).sqrt();
                        if ddist <= hrange {
                            if new_target.is_none() || ddist < new_target.unwrap().1 {
                                new_target = Some((eid, ddist));
                            }
                        }
                    }
                    if let Some((neid, _)) = new_target {
                        drone.target_enemy = Some(neid);
                        drone.state = DroneState::Attacking;
                    } else {
                        let dx = hx - drone.x;
                        let dy = hy - drone.y;
                        let dist = (dx * dx + dy * dy).sqrt().max(0.001);
                        drone.x += (dx / dist) * drone.speed * dt;
                        drone.y += (dy / dist) * drone.speed * dt;
                        if dist < 30.0 {
                            drone.state = DroneState::Idle;
                        }
                    }
                }
            }
        }
    }

    fn move_projectiles(&mut self, dt: f64) {
        for p in &mut self.projectiles {
            p.update(dt);
            if p.is_off_screen(WORLD_W, WORLD_H) {
                p.alive = false;
            }
        }
    }

    fn check_collisions(&mut self) {
        for proj in &mut self.projectiles {
            if !proj.alive { continue; }

            match proj.owner {
                ProjectileOwner::Tower(_) | ProjectileOwner::Core => {
                    let is_piercing = proj.kind == ProjectileKind::Cannon;

                    for enemy in &mut self.enemies {
                        if !enemy.alive { continue; }
                        // Skip already-pierced enemies
                        if is_piercing && proj.pierced_ids.contains(&enemy.id) { continue; }

                        let dx = proj.x - enemy.x;
                        let dy = proj.y - enemy.y;
                        let dist = (dx * dx + dy * dy).sqrt();
                        if dist < enemy.size + proj.size {
                            self.stats.damage_dealt += proj.damage.min(enemy.hp);
                            enemy.take_damage(proj.damage);

                            if is_piercing {
                                // Cannon: don't die, remember hit, keep going
                                proj.pierced_ids.push(enemy.id);
                            } else {
                                proj.alive = false;
                            }

                            if !enemy.alive {
                                let wave_bonus = 1 + self.wave.number.saturating_sub(10) / 10;
                                let (score_val, money_val) = match enemy.kind {
                                    EnemyKind::Drone =>  { self.stats.drones_killed += 1; (10 * wave_bonus, 4 * wave_bonus) },
                                    EnemyKind::Fighter => { self.stats.fighters_killed += 1; (25 * wave_bonus, 12 * wave_bonus) },
                                    EnemyKind::Tank =>   { self.stats.tanks_killed += 1; (100 * wave_bonus, 35 * wave_bonus) },
                                };
                                self.score += score_val;
                                self.money += money_val;
                                self.stats.money_earned += money_val;
                            }
                            if !is_piercing { break; }
                        }
                    }
                }
                ProjectileOwner::Enemy(_) => {
                    let dx = proj.x - self.core.x;
                    let dy = proj.y - self.core.y;
                    let dist = (dx * dx + dy * dy).sqrt();
                    if dist < self.core.radius {
                        self.stats.damage_taken += proj.damage;
                        self.core.take_damage(proj.damage);
                        proj.alive = false;
                    }
                }
            }
        }
    }

    fn check_enemy_reach_core(&mut self) {
        let core_x = self.core.x;
        let core_y = self.core.y;
        let core_r = self.core.radius;

        for enemy in &mut self.enemies {
            if !enemy.alive { continue; }
            let dx = enemy.x - core_x;
            let dy = enemy.y - core_y;
            let dist = (dx * dx + dy * dy).sqrt();
            if dist < core_r + enemy.size {
                self.stats.damage_taken += enemy.damage;
                match enemy.kind {
                    EnemyKind::Drone => self.stats.drones_leaked += 1,
                    EnemyKind::Fighter => self.stats.fighters_leaked += 1,
                    EnemyKind::Tank => self.stats.tanks_leaked += 1,
                }
                self.core.take_damage(enemy.damage);
                enemy.alive = false;
            }
        }
    }

    fn cleanup(&mut self) {
        self.enemies.retain(|e| e.alive);
        self.projectiles.retain(|p| p.alive);
    }

    fn check_wave_complete(&mut self) {
        if self.wave.finished_spawning && self.enemies.is_empty() {
            let next = self.wave.number + 1;
            self.wave = Wave::generate(next);
            self.wave_active = false;
            self.wave_cooldown = 5.0;
            let wave_reward = 20 + next * 5; // modest wave bonus
            self.money += wave_reward;
            self.stats.money_earned += wave_reward;
            self.stats.waves_survived += 1;
            if next % 2 == 0 {
                self.max_towers += 1;
            }
        }
    }

    /// Count how many same-kind towers have overlapping range with position (gx, gy)
    pub fn count_overlapping_same_kind(&self, gx: f64, gy: f64, kind: TowerKind) -> u32 {
        let new_range = Tower::new(0, kind, 0.0, 0.0).range;
        let mut count = 0u32;
        for t in &self.towers {
            if t.kind != kind { continue; }
            let dx = gx - t.x;
            let dy = gy - t.y;
            let dist = (dx * dx + dy * dy).sqrt();
            // Ranges overlap if distance < sum of both ranges
            if dist < new_range + t.range {
                count += 1;
            }
        }
        count
    }

    /// Snap to grid and validate placement
    pub fn place_tower(&mut self, x: f64, y: f64, kind: TowerKind) -> bool {
        let gx = (x / GRID_SIZE).round() * GRID_SIZE;
        let gy = (y / GRID_SIZE).round() * GRID_SIZE;

        if !is_in_zone(gx, gy) {
            return false;
        }

        if self.towers.len() as u32 >= self.max_towers {
            return false;
        }

        let cost = Tower::new(0, kind, 0.0, 0.0).cost;
        if self.money < cost { return false; }

        // No overlapping positions (same grid cell)
        for t in &self.towers {
            let dx = gx - t.x;
            let dy = gy - t.y;
            if dx.abs() < 1.0 && dy.abs() < 1.0 {
                return false;
            }
        }

        // Max 3 same-kind towers with overlapping ranges in cluster
        if self.count_overlapping_same_kind(gx, gy, kind) >= 3 {
            return false;
        }

        self.money -= cost;
        self.stats.money_spent += cost;
        self.stats.towers_placed += 1;
        let tower = Tower::new(self.next_tower_id, kind, gx, gy);
        self.next_tower_id += 1;
        self.towers.push(tower);
        true
    }

    pub fn buy_tower_slot(&mut self) -> bool {
        if self.money >= 1000 {
            self.money -= 1000;
            self.stats.money_spent += 1000;
            self.max_towers += 1;
            return true;
        }
        false
    }

    pub fn upgrade_tower(&mut self, tower_id: u32) -> bool {
        if let Some(tower) = self.towers.iter_mut().find(|t| t.id == tower_id) {
            let cost = tower.upgrade_cost();
            if self.money >= cost {
                self.money -= cost;
                self.stats.money_spent += cost;
                self.stats.towers_upgraded += 1;
                tower.upgrade();
                return true;
            }
        }
        false
    }

    pub fn sell_tower(&mut self, tower_id: u32) -> bool {
        if let Some(idx) = self.towers.iter().position(|t| t.id == tower_id) {
            let refund = self.towers[idx].cost / 2;
            self.money += refund;
            self.stats.money_earned += refund;
            self.stats.towers_sold += 1;
            self.towers.remove(idx);
            // Remove links involving this tower
            self.spirit_links.retain(|l| l.tower_a != tower_id && l.tower_b != tower_id);
            self.recalc_triangles();
            return true;
        }
        false
    }

    pub fn set_speed(&mut self, multiplier: f64) {
        self.speed_multiplier = multiplier.clamp(1.0, 3.0);
    }

    pub fn move_tower(&mut self, tower_id: u32, x: f64, y: f64) -> bool {
        let gx = (x / GRID_SIZE).round() * GRID_SIZE;
        let gy = (y / GRID_SIZE).round() * GRID_SIZE;

        if !is_in_zone(gx, gy) { return false; }

        // Check not occupied by another tower
        for t in &self.towers {
            if t.id == tower_id { continue; }
            let dx = gx - t.x;
            let dy = gy - t.y;
            if dx.abs() < 1.0 && dy.abs() < 1.0 {
                return false;
            }
        }

        // Get kind before checking overlap
        let kind = match self.towers.iter().find(|t| t.id == tower_id) {
            Some(t) => t.kind,
            None => return false,
        };

        // Check cluster limit (exclude self from count)
        let mut overlap = 0u32;
        let new_range = Tower::new(0, kind, 0.0, 0.0).range;
        for t in &self.towers {
            if t.id == tower_id || t.kind != kind { continue; }
            let dx = gx - t.x;
            let dy = gy - t.y;
            let dist = (dx * dx + dy * dy).sqrt();
            if dist < new_range + t.range {
                overlap += 1;
            }
        }
        if overlap >= 3 { return false; }

        if let Some(tower) = self.towers.iter_mut().find(|t| t.id == tower_id) {
            tower.x = gx;
            tower.y = gy;
            // Break links when moved
            self.spirit_links.retain(|l| l.tower_a != tower_id && l.tower_b != tower_id);
            self.recalc_triangles();
            return true;
        }
        false
    }

    pub fn create_spirit_link(&mut self, tower_a_id: u32, tower_b_id: u32) -> bool {
        if tower_a_id == tower_b_id { return false; }
        if self.money < spirit::LINK_COST { return false; }

        // Check both towers exist
        let pos_a = self.towers.iter().find(|t| t.id == tower_a_id).map(|t| (t.x, t.y));
        let pos_b = self.towers.iter().find(|t| t.id == tower_b_id).map(|t| (t.x, t.y));
        let (ax, ay) = match pos_a { Some(p) => p, None => return false };
        let (bx, by) = match pos_b { Some(p) => p, None => return false };

        // Check distance
        let dx = ax - bx;
        let dy = ay - by;
        if (dx * dx + dy * dy).sqrt() > spirit::LINK_MAX_DISTANCE { return false; }

        // Check max links per tower
        if self.count_tower_links(tower_a_id) >= spirit::MAX_LINKS_PER_TOWER { return false; }
        if self.count_tower_links(tower_b_id) >= spirit::MAX_LINKS_PER_TOWER { return false; }

        // Check not already linked
        let already = self.spirit_links.iter().any(|l|
            (l.tower_a == tower_a_id && l.tower_b == tower_b_id) ||
            (l.tower_a == tower_b_id && l.tower_b == tower_a_id)
        );
        if already { return false; }

        self.money -= spirit::LINK_COST;
        self.stats.money_spent += spirit::LINK_COST;
        self.spirit_links.push(SpiritLink {
            id: self.next_link_id,
            tower_a: tower_a_id,
            tower_b: tower_b_id,
            pulse_phase: 0.0,
        });
        self.next_link_id += 1;
        self.recalc_triangles();
        true
    }

    fn recalc_triangles(&mut self) {
        self.spirit_triangles.clear();

        // Find all sets of 3 towers where each pair is linked
        let link_set: Vec<(u32, u32)> = self.spirit_links.iter()
            .map(|l| (l.tower_a, l.tower_b))
            .collect();

        let tower_ids: Vec<u32> = self.towers.iter().map(|t| t.id).collect();

        for i in 0..tower_ids.len() {
            for j in (i+1)..tower_ids.len() {
                for k in (j+1)..tower_ids.len() {
                    let a = tower_ids[i];
                    let b = tower_ids[j];
                    let c = tower_ids[k];

                    let has_ab = link_set.iter().any(|&(x,y)| (x==a&&y==b) || (x==b&&y==a));
                    let has_bc = link_set.iter().any(|&(x,y)| (x==b&&y==c) || (x==c&&y==b));
                    let has_ac = link_set.iter().any(|&(x,y)| (x==a&&y==c) || (x==c&&y==a));

                    if has_ab && has_bc && has_ac {
                        let pa = self.towers.iter().find(|t| t.id == a).map(|t| (t.x, t.y)).unwrap();
                        let pb = self.towers.iter().find(|t| t.id == b).map(|t| (t.x, t.y)).unwrap();
                        let pc = self.towers.iter().find(|t| t.id == c).map(|t| (t.x, t.y)).unwrap();
                        self.spirit_triangles.push(SpiritTriangle {
                            tower_ids: [a, b, c],
                            vertices: [pa, pb, pc],
                        });
                    }
                }
            }
        }
    }

    pub fn check_placement(&self, x: f64, y: f64, kind: TowerKind) -> PlacementResult {
        let gx = (x / GRID_SIZE).round() * GRID_SIZE;
        let gy = (y / GRID_SIZE).round() * GRID_SIZE;
        let in_zone = is_in_zone(gx, gy);
        let has_slot = (self.towers.len() as u32) < self.max_towers;
        let cost = Tower::new(0, kind, 0.0, 0.0).cost;
        let can_afford = self.money >= cost;
        let overlap_count = self.count_overlapping_same_kind(gx, gy, kind);
        let occupied = self.towers.iter().any(|t| (gx - t.x).abs() < 1.0 && (gy - t.y).abs() < 1.0);
        let valid = in_zone && has_slot && can_afford && overlap_count < 3 && !occupied;

        PlacementResult {
            valid,
            snapped_x: gx,
            snapped_y: gy,
            overlap_count,
            in_zone,
            has_slot,
            can_afford,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct PlacementResult {
    pub valid: bool,
    pub snapped_x: f64,
    pub snapped_y: f64,
    pub overlap_count: u32,
    pub in_zone: bool,
    pub has_slot: bool,
    pub can_afford: bool,
}
