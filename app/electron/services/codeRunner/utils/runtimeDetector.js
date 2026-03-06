const { spawn } = require("child_process");
const { RUNTIMES } = require("../utils/constants");
const db = require("../../database/database");

/**
 * ===============================
 * Safe Spawn
 * ===============================
 */
function safeSpawn(command, args = []) {

    return new Promise((resolve) => {

        try {

            console.log(`[RuntimeDetector] Executing: ${command} ${args.join(" ")}`);

            const child = spawn(command, args, {
                windowsHide: true
            });

            let output = "";

            child.stdout.on("data", (d) => {
                output += d.toString();
            });

            child.stderr.on("data", (d) => {
                output += d.toString();
            });

            child.on("close", () => {
                resolve(output.trim() || "Unknown");
            });

            child.on("error", (err) => {

                console.error("[RuntimeDetector] Spawn failed:", err.message);

                resolve("Unknown");
            });

        } catch (err) {

            console.error("[RuntimeDetector] Spawn error:", err);

            resolve("Unknown");
        }

    });

}


/**
 * ===============================
 * Parse Helpers
 * ===============================
 */

function parseJavaVersion(text = "") {

    try {

        if (!text) return "Unknown";

        const match = text.match(/\b(\d+\.\d+\.\d+)\b/);

        if (match) return match[1];

        return "Unknown";

    } catch (err) {

        console.error("[RuntimeDetector] Java version parse failed:", err);

        return "Unknown";
    }
}

function parsePythonVersion(text = "") {

    try {

        const match = text.match(/Python\s+([\d.]+)/i);

        if (match) return match[1];

        return text || "Unknown";

    } catch (err) {

        console.error("[RuntimeDetector] Python version parse failed:", err);

        return "Unknown";
    }
}

function parseNodeVersion(text = "") {

    try {

        if (!text) return "Unknown";

        return text.replace("v", "").trim();

    } catch (err) {

        console.error("[RuntimeDetector] Node version parse failed:", err);

        return "Unknown";
    }
}

function parseMonoVersion(text = "") {

    try {

        const match = text.match(/version\s+([\d.]+)/i);

        if (match) return match[1];

        return text.split("\n")[0] || "Unknown";

    } catch (err) {

        console.error("[RuntimeDetector] Mono version parse failed:", err);

        return "Unknown";
    }
}


/**
 * ===============================
 * Detect Runtime Versions
 * ===============================
 */

async function getRuntimeVersions() {

    try {

        console.log("[RuntimeDetector] Detecting runtime versions...");

        const nodeRaw = await safeSpawn(RUNTIMES.node, ["-v"]);
        const pythonRaw = await safeSpawn(RUNTIMES.python, ["--version"]);
        const javaRaw = await safeSpawn(RUNTIMES.java?.java, ["--version"]);
        const monoRaw = await safeSpawn(RUNTIMES.mono?.mono, ["--version"]);

        const versions = {

            javascript: {
                name: "Node.js",
                version: parseNodeVersion(nodeRaw)
            },

            python: {
                name: "Python",
                version: parsePythonVersion(pythonRaw)
            },

            java: {
                name: "Java",
                version: parseJavaVersion(javaRaw)
            },

            dotnet: {
                name: "Mono",
                version: parseMonoVersion(monoRaw)
            }
        };

        console.log("[RuntimeDetector] Detected runtimes:", versions);

        return versions;

    } catch (err) {

        console.error("[RuntimeDetector] Runtime detection failed:", err);

        return {
            javascript: { name: "Node.js", version: "Unknown" },
            python: { name: "Python", version: "Unknown" },
            java: { name: "Java", version: "Unknown" },
            dotnet: { name: "Mono", version: "Unknown" }
        };
    }
}


/**
 * ===============================
 * Label Builder (UI Friendly)
 * ===============================
 */

async function getRuntimeLabels() {

    try {

        console.log("[RuntimeDetector] Fetching runtime labels from DB...");

        let row = db
            .prepare(`SELECT * FROM runtime_info WHERE id = 1`)
            .get();

        /**
         * If not exists → detect + store
         */
        if (!row) {

            console.log("[RuntimeDetector] No runtime info in DB. Detecting...");

            const versions = await getRuntimeVersions();

            /**
             * Do NOT store if everything is Unknown
             */
            const allUnknown =
                versions.javascript.version === "Unknown" &&
                versions.python.version === "Unknown" &&
                versions.java.version === "Unknown" &&
                versions.dotnet.version === "Unknown";

            if (!allUnknown) {

                db.prepare(`
                            INSERT INTO runtime_info (
                                id,
                                javascript_version,
                                python_version,
                                java_version,
                                dotnet_version
                            )
                            VALUES (1, ?, ?, ?, ?)
                            ON CONFLICT(id) DO UPDATE SET
                                javascript_version = excluded.javascript_version,
                                python_version = excluded.python_version,
                                java_version = excluded.java_version,
                                dotnet_version = excluded.dotnet_version;
                `).run(
                    versions.javascript.version,
                    versions.python.version,
                    versions.java.version,
                    versions.dotnet.version
                );

            } else {

                console.log("[RuntimeDetector] All runtime versions unknown — skipping DB storage");

            }

            row = db
                .prepare(`SELECT * FROM runtime_info WHERE id = 1`)
                .get();
        }

        const labels = {
            javascript: `JavaScript (${row.javascript_version || "Unknown"})`,
            python: `Python (${row.python_version || "Unknown"})`,
            java: `Java (${row.java_version || "Unknown"})`,
            dotnet: `C# (Mono ${row.dotnet_version || "Unknown"})`
        };

        console.log("[RuntimeDetector] Runtime labels ready:", labels);

        return labels;

    } catch (err) {

        console.error("[RuntimeDetector] Failed to build runtime labels:", err);

        return {
            javascript: "JavaScript (Unknown)",
            python: "Python (Unknown)",
            java: "Java (Unknown)",
            dotnet: "C# (Mono Unknown)"
        };
    }
}


/**
 * ===============================
 */

module.exports = {
    getRuntimeVersions,
    getRuntimeLabels
};