const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const util = require("util");
const os = require("os");
const {exec} = require("child_process");

let logFilePath;
let logsDir;

const MAX_LOG_SIZE = 2 * 1024 * 1024; // 2 MB
const RETENTION_DAYS = 7;

/* ------------------------------------------------------- */
function initLogger() {
    logsDir = path.join(
        app.getPath("appData"),
        "DSA-Self-Prepare-Models",
        "logs"
    );

    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }

    cleanupOldLogs();
    logFilePath = getActiveLogFile();
    overrideConsole();

    console.log("Logger initialized at:", logFilePath);
}

/* ------------------------------------------------------- */
// 🔥 RUNTIME rotation check
function ensureRotation() {
    try {
        if (!fs.existsSync(logFilePath)) {
            logFilePath = getActiveLogFile();
            return;
        }

        const stats = fs.statSync(logFilePath);

        if (stats.size >= MAX_LOG_SIZE) {
            logFilePath = getActiveLogFile(); // pick next file
        }
    } catch {}
}

/* ------------------------------------------------------- */
function getActiveLogFile() {
    let index = 1;

    while (true) {
        const file = path.join(logsDir, `dsa-app-${index}.log`);

        if (!fs.existsSync(file)) {
            return file;
        }

        const stats = fs.statSync(file);
        if (stats.size < MAX_LOG_SIZE) {
            return file;
        }

        index++;
    }
}

/* ------------------------------------------------------- */
// 🔥 7-day retention
function cleanupOldLogs() {
    try {
        const files = fs.readdirSync(logsDir);
        const now = Date.now();

        for (const f of files) {
            const full = path.join(logsDir, f);
            const stats = fs.statSync(full);

            const ageDays = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24);

            if (ageDays > RETENTION_DAYS) {
                fs.unlinkSync(full);
            }
        }
    } catch {}
}

/* ------------------------------------------------------- */
function writeLog(level, ...args) {
    try {
        ensureRotation(); // ⭐ critical fix

        const time = new Date().toISOString();

        const formatted = args
            .map(a =>
                typeof a === "object"
                    ? util.inspect(a, { depth: null, colors: false })
                    : a
            )
            .join(" ");

        const line = `[${time}] [${level}] ${formatted}\n`;
        fs.appendFileSync(logFilePath, line, "utf8");
    } catch {}
}

/* ------------------------------------------------------- */
function overrideConsole() {
    const original = {
        log: console.log,
        error: console.error,
        warn: console.warn,
        info: console.info,
    };

    console.log = (...args) => {
        writeLog("LOG", ...args);
        original.log(...args);
    };

    console.error = (...args) => {
        writeLog("ERROR", ...args);
        original.error(...args);
    };

    console.warn = (...args) => {
        writeLog("WARN", ...args);
        original.warn(...args);
    };

    console.info = (...args) => {
        writeLog("INFO", ...args);
        original.info(...args);
    };
}

async function exportLogs() {
    try {
        const desktopZip = path.join(os.homedir(), "Downloads", "dsa-app-error-logs.zip");

        if (fs.existsSync(desktopZip)) {
            fs.unlinkSync(desktopZip);
        }

        const command =
            `powershell -NoProfile -ExecutionPolicy Bypass ` +
            `Compress-Archive -LiteralPath "${logsDir}" -DestinationPath "${desktopZip}" -Force`;

        return await new Promise((resolve, reject) => {
            exec(command, (err, stdout, stderr) => {
                console.log("CMD:", command);
                console.log("STDOUT:", stdout);
                console.log("STDERR:", stderr);

                if (err) return reject(err);

                resolve({ success: true, path: desktopZip });
            });
        });

    } catch (err) {
        console.error("Log export failed:", err);
        return { error: true };
    }
}

/* ------------------------------------------------------- */
function getLogPath() {
    return logFilePath;
}

module.exports = {
    initLogger,
    getLogPath,
    exportLogs,
};
