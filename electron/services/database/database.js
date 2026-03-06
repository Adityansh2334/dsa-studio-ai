const { app } = require("electron");
const Database = require("better-sqlite3");

const { TMP_DB, decryptDBIfExists } = require("../../utils/dbCrypto");

decryptDBIfExists();

let dbPath = TMP_DB;

if(!app.isPackaged){
    dbPath = "dsa.db";
    console.log("📁 DB Location on dev mode:", dbPath);
} else {
    console.log("📁 DB Location on production:", dbPath);
}

const db = new Database(dbPath);

db.prepare(`
    CREATE TABLE IF NOT EXISTS problems (
                                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                                            date TEXT NOT NULL,
                                            mode TEXT NOT NULL,
                                            title TEXT NOT NULL,
                                            difficulty TEXT,
                                            pattern TEXT,
                                            content TEXT,
                                            fingerprint TEXT UNIQUE,
                                            solved INTEGER DEFAULT 0,
                                            user_id INTEGER,
                                            interview_context TEXT,
                                            created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
`).run();

db.prepare(`
   CREATE TABLE IF NOT EXISTS users (
                                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                                            name TEXT NOT NULL,
                                            email TEXT UNIQUE NOT NULL,
                                            phone TEXT,
                                            password_hash TEXT NOT NULL,
                                            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                                            last_login_at DATETIME,
                                            session_expires_at DATETIME
)
`).run();

db.prepare(`
            CREATE TABLE IF NOT EXISTS user_ai_keys (
                user_id INTEGER PRIMARY KEY,
                openrouter_key TEXT,
                hf_key TEXT,
                ollama_model TEXT,
                ai_provider TEXT,
                ai_mode TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME
            )
`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS user_session
            (
                user_id       INTEGER PRIMARY KEY,
                last_login_at DATETIME,
                is_logged_in INTEGER DEFAULT 1,
                is_success_login INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS user_preferences (
                    user_id INTEGER PRIMARY KEY,
                    daily_problem_count INTEGER DEFAULT 3,
                    daily_difficulty TEXT DEFAULT 'mixed',
                    daily_patterns TEXT,
                
                    interview_problem_count INTEGER DEFAULT 10,
                    interview_style TEXT DEFAULT 'mixed',
                    interview_company TEXT,
                    interview_role TEXT,
                    interview_experience TEXT,
                    interview_difficulty TEXT,
                    interview_patterns TEXT,
                
                    preferred_language TEXT DEFAULT 'java',
                    show_hints INTEGER DEFAULT 1,
                
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`).run();

db.prepare(`
                                CREATE TABLE IF NOT EXISTS user_progress (
                                    user_id INTEGER PRIMARY KEY,
                                    first_day TEXT,
                                    last_solved_day TEXT,
                                    streak INTEGER DEFAULT 0
)
`).run();

db.prepare(
                                    `CREATE TABLE IF NOT EXISTS generation_queue (
                                    user_id INTEGER,
                                    date TEXT,
                                    mode TEXT,
                                    interview_context TEXT,
                                    required_count INTEGER,
                                    generated_count INTEGER DEFAULT 0,
                                    status TEXT DEFAULT 'pending',
                                    updated_at TEXT,
                                    started_at TEXT,
                                    PRIMARY KEY (user_id, date, mode, interview_context)
)
`).run();

db.prepare(`
                                    CREATE TABLE IF NOT EXISTS problem_ai_chat (
                                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                                        user_id INTEGER,
                                        problem_id INTEGER,
                                        role TEXT,           -- 'user' | 'ai'
                                        message TEXT,
                                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                                    )
`).run();

db.prepare(`
                                    CREATE TABLE IF NOT EXISTS system_capacity_cache (
                                        id INTEGER PRIMARY KEY CHECK (id = 1),
                                        data TEXT,
                                        system_type TEXT NOT NULL DEFAULT 'CPU', -- CPU | GPU
                                        updated_at INTEGER
                                    )
`).run();

db.prepare(`
                                    CREATE TABLE IF NOT EXISTS user_ai_insight_history (
                                                           id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                           user_id INTEGER,
                                                           date TEXT,
                                                           fingerprint TEXT,
                                                           insight TEXT,
                                                           score INTEGER,
                                                           level TEXT,
                                                           created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();

db.prepare(`
                                    CREATE INDEX IF NOT EXISTS idx_ai_insight_user_date
                                    ON user_ai_insight_history(user_id, date)
`).run();

db.prepare(`
                                    CREATE TABLE IF NOT EXISTS user_progress_prediction (
                                        user_id INTEGER PRIMARY KEY,
                                        fingerprint TEXT,
                                        progress_percent INTEGER,
                                        message TEXT,
                                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                                    )
`).run();

db.prepare(`
                                        CREATE TABLE IF NOT EXISTS algorithm_pattern_visualizations (
                                                                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                                    pattern TEXT,
                                                                    pattern_hash TEXT UNIQUE,
                                                                    visualization_json TEXT,
                                                                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();

db.prepare(`
                                        CREATE TABLE IF NOT EXISTS algorithm_problem_visualizations (
                                                                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                                    problem_id TEXT,
                                                                    pattern_hash TEXT,
                                                                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();

db.prepare(`
                                        CREATE TABLE IF NOT EXISTS problem_code_templates (
                                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                                    
                                        problem_id TEXT NOT NULL,
                                        language TEXT NOT NULL,
                                    
                                        template_code TEXT NOT NULL,

                                        execution_metadata TEXT,

                                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                    
                                        UNIQUE(problem_id, language)
)
`).run();

db.prepare(`
                                        CREATE TABLE IF NOT EXISTS runtime_info (
                                        id INTEGER PRIMARY KEY CHECK (id = 1),
                                    
                                        javascript_version TEXT,
                                        python_version TEXT,
                                        java_version TEXT,
                                        dotnet_version TEXT,
                                    
                                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`).run();

db.prepare(`
                        CREATE TABLE IF NOT EXISTS driver_cache (
                        hash TEXT PRIMARY KEY,
                        code TEXT
)
`).run();

db.exec(`
                                        CREATE TABLE IF NOT EXISTS ai_jobs (
                                            id TEXT PRIMARY KEY,
                                            key TEXT,
                                            type TEXT,
                                            provider TEXT,
                                            payload TEXT,
                                            status TEXT,
                                            retries INTEGER DEFAULT 0,
                                            max_retries INTEGER DEFAULT 2,
                                            result TEXT,
                                            error TEXT,
                                            created_at INTEGER,
                                            updated_at INTEGER
                                        );
                                        
                                        CREATE INDEX IF NOT EXISTS idx_ai_jobs_status
                                        ON ai_jobs(status);
`);

module.exports = db;
