const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const { TEMP_ROOT } = require("../utils/constants");

/**
 * =========================================
 * Create Unique Sandbox Session
 * =========================================
 */

function createSessionDir() {
    const sessionId =
        Date.now().toString() +
        "-" +
        crypto.randomBytes(4).toString("hex");

    const sessionPath = path.join(TEMP_ROOT, sessionId);

    fs.mkdirSync(sessionPath, { recursive: true });

    return {
        id: sessionId,
        path: sessionPath,
    };
}

/**
 * =========================================
 * Write Code File
 * =========================================
 */

function writeCodeFile(sessionPath, fileName, code) {
    const filePath = path.join(sessionPath, fileName);

    fs.writeFileSync(filePath, code, "utf8");

    return filePath;
}

/**
 * =========================================
 * Write JSON File (optional helper)
 * =========================================
 */

function writeJSON(sessionPath, fileName, data) {
    const filePath = path.join(sessionPath, fileName);

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    return filePath;
}

/**
 * =========================================
 * Read File
 * =========================================
 */

function readFile(filePath) {
    if (!fs.existsSync(filePath)) return null;

    return fs.readFileSync(filePath, "utf8");
}

/**
 * =========================================
 * Cleanup Session
 * =========================================
 */

function cleanupSession(sessionPath) {
    try {
        if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, {
                recursive: true,
                force: true,
            });
        }
    } catch (err) {
        console.warn("Sandbox cleanup failed:", err.message);
    }
}

/**
 * =========================================
 * Cleanup Old Sessions (optional)
 * =========================================
 */

function cleanupOldSessions(maxAgeMs = 1000 * 60 * 30) {
    try {
        const now = Date.now();

        if (!fs.existsSync(TEMP_ROOT)) return;

        const dirs = fs.readdirSync(TEMP_ROOT);

        for (const dir of dirs) {
            const fullPath = path.join(TEMP_ROOT, dir);

            const stat = fs.statSync(fullPath);

            if (!stat.isDirectory()) continue;

            const age = now - stat.mtimeMs;

            if (age > maxAgeMs) {
                fs.rmSync(fullPath, {
                    recursive: true,
                    force: true,
                });
            }
        }
    } catch (err) {
        console.warn("Old session cleanup error:", err.message);
    }
}

/**
 * =========================================
 * Exports
 * =========================================
 */

module.exports = {
    createSessionDir,
    writeCodeFile,
    writeJSON,
    readFile,
    cleanupSession,
    cleanupOldSessions,
};