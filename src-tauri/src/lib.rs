mod game;

use game::state::{GameState, GameStats, PlacementResult};
use game::tower::TowerKind;
use game::player::PlayerInput;
use std::sync::Mutex;
use std::time::Instant;
use tauri::{AppHandle, Emitter, Manager, State};

struct AppState {
    game: Mutex<GameState>,
}

#[tauri::command]
fn get_state(state: State<AppState>) -> GameState {
    state.game.lock().unwrap().clone()
}

#[tauri::command]
fn place_tower(state: State<AppState>, x: f64, y: f64, kind: TowerKind) -> bool {
    state.game.lock().unwrap().place_tower(x, y, kind)
}

#[tauri::command]
fn upgrade_tower(state: State<AppState>, tower_id: u32) -> bool {
    state.game.lock().unwrap().upgrade_tower(tower_id)
}

#[tauri::command]
fn select_tower_kind(state: State<AppState>, kind: TowerKind) {
    state.game.lock().unwrap().selected_tower_kind = kind;
}

#[tauri::command]
fn toggle_pause(state: State<AppState>) -> bool {
    let mut g = state.game.lock().unwrap();
    g.paused = !g.paused;
    g.paused
}

#[tauri::command]
fn restart_game(state: State<AppState>) {
    let mut g = state.game.lock().unwrap();
    *g = GameState::new();
}

#[tauri::command]
fn set_speed(state: State<AppState>, multiplier: f64) {
    state.game.lock().unwrap().set_speed(multiplier);
}

#[tauri::command]
fn sell_tower(state: State<AppState>, tower_id: u32) -> bool {
    state.game.lock().unwrap().sell_tower(tower_id)
}

#[tauri::command]
fn buy_tower_slot(state: State<AppState>) -> bool {
    state.game.lock().unwrap().buy_tower_slot()
}

#[tauri::command]
fn move_tower(state: State<AppState>, tower_id: u32, x: f64, y: f64) -> bool {
    state.game.lock().unwrap().move_tower(tower_id, x, y)
}

#[tauri::command]
fn check_placement(state: State<AppState>, x: f64, y: f64, kind: TowerKind) -> PlacementResult {
    state.game.lock().unwrap().check_placement(x, y, kind)
}

#[tauri::command]
fn create_spirit_link(state: State<AppState>, tower_a: u32, tower_b: u32) -> bool {
    state.game.lock().unwrap().create_spirit_link(tower_a, tower_b)
}

#[tauri::command]
fn set_player_input(state: State<AppState>, input: PlayerInput) {
    state.game.lock().unwrap().player_input = input;
}

#[tauri::command]
fn upgrade_ship(state: State<AppState>) -> bool {
    let mut g = state.game.lock().unwrap();
    let cost = g.player.upgrade_cost;
    if g.money >= cost {
        g.money -= cost;
        g.stats.money_spent += cost;
        g.player.upgrade();
        return true;
    }
    false
}

fn write_stats_log(stats: &GameStats, wave: u32, game_over: bool) {
    let log_path = std::env::current_dir()
        .unwrap_or_default()
        .parent()
        .unwrap_or(std::path::Path::new("."))
        .join("game_log.txt");

    let status = if game_over { "GAME OVER" } else { "IN PROGRESS" };
    let entry = format!(
        "[{status}] wave={wave} time={:.0}s | kills: drone={} fighter={} tank={} | leaked: drone={} fighter={} tank={} | dmg_dealt={:.0} dmg_taken={:.0} | money: earned={} spent={} | towers: placed={} upgraded={} sold={}\n",
        stats.game_time,
        stats.drones_killed, stats.fighters_killed, stats.tanks_killed,
        stats.drones_leaked, stats.fighters_leaked, stats.tanks_leaked,
        stats.damage_dealt, stats.damage_taken,
        stats.money_earned, stats.money_spent,
        stats.towers_placed, stats.towers_upgraded, stats.towers_sold,
    );

    use std::io::Write;
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(&log_path) {
        let _ = f.write_all(entry.as_bytes());
    }
}

fn start_game_loop(app: AppHandle) {
    std::thread::spawn(move || {
        let mut last = Instant::now();
        let mut log_timer = 0.0f64;
        let mut was_game_over = false;
        loop {
            std::thread::sleep(std::time::Duration::from_millis(16));
            let now = Instant::now();
            let dt = now.duration_since(last).as_secs_f64();
            last = now;

            let state = app.state::<AppState>();
            let game_snapshot = {
                let mut g = state.game.lock().unwrap();
                g.tick(dt);
                g.clone()
            };

            // Log stats every 10 game-seconds and on game over
            log_timer += dt;
            if log_timer >= 10.0 {
                log_timer = 0.0;
                write_stats_log(&game_snapshot.stats, game_snapshot.wave.number, game_snapshot.game_over);
            }
            if game_snapshot.game_over && !was_game_over {
                write_stats_log(&game_snapshot.stats, game_snapshot.wave.number, true);
            }
            was_game_over = game_snapshot.game_over;

            let _ = app.emit("game-state", &game_snapshot);
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            game: Mutex::new(GameState::new()),
        })
        .invoke_handler(tauri::generate_handler![
            get_state,
            place_tower,
            upgrade_tower,
            select_tower_kind,
            toggle_pause,
            restart_game,
            set_speed,
            sell_tower,
            buy_tower_slot,
            move_tower,
            check_placement,
            create_spirit_link,
            set_player_input,
            upgrade_ship,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            start_game_loop(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
