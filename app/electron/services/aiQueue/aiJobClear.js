const db = require("../database/database");

function clearStaleJobs() {

    console.log("🧹 Clearing stale AI jobs...");

    // Jobs that were running when app closed
    db.prepare(`
        DELETE FROM ai_jobs
        WHERE status IN ('running', 'pending')
    `).run();

    // Optional: remove very old done jobs
    db.prepare(`
        DELETE FROM ai_jobs
        WHERE status = 'done'
        AND created_at < ?
    `).run(Date.now() - 24 * 60 * 60 * 1000); // older than 24h

}

module.exports = {
    clearStaleJobs
}
