const path = require("path");
const os = require("os");
const fs = require("fs");
const { app } = require("electron");

/**
 * ===============================
 * Runtime Root Resolver
 * ===============================
 */

function getRuntimeRoot() {

    if (app.isPackaged) {
        // Production build (.exe)
        console.log("INSIDE GET RUNTIME :::::: PROD::::::: ");
        return path.join(
            process.resourcesPath,
            "app.asar.unpacked",
            "electron",
            "resources",
            "runtime"
        );
    }

    // Dev mode
    return path.join(
        app.getAppPath(),
        "electron",
        "resources",
        "runtime"
    );
}

/**
 * ===============================
 * Runtime Paths
 * ===============================
 */

const RUNTIME_ROOT = getRuntimeRoot();

const RUNTIMES = {

    node: path.join(
        RUNTIME_ROOT,
        "node",
        "node.exe"),

    python: path.join(
        RUNTIME_ROOT,
        "python",
        "python.exe"
    ),

    java: {
        java: path.join(
            RUNTIME_ROOT,
            "java",
            "bin",
            "java.exe"
        ),

        javac: path.join(
            RUNTIME_ROOT,
            "java",
            "bin",
            "javac.exe"
        ),

        gson: path.join(
            RUNTIME_ROOT,
            "java",
            "lib",
            "gson.jar"
        )
    },

    mono: {
        mono: path.join(RUNTIME_ROOT, "mono", "bin", "mono.exe"),
        mcs: path.join(RUNTIME_ROOT, "mono", "lib", "mono", "4.5", "mcs.exe"),
    }
};

/**
 * ===============================
 * Temp Sandbox Root
 * ===============================
 */

const TEMP_ROOT = path.join(os.tmpdir(), "dsa-runner", app.getVersion());

if (!fs.existsSync(TEMP_ROOT)) {
    fs.mkdirSync(TEMP_ROOT, { recursive: true });
}

/**
 * ===============================
 * Execution Limits
 * ===============================
 */

const EXECUTION_LIMITS = {
    timeout: 5000,
    memory: 256
};

/**
 * ===============================
 * Internal Limits
 * ===============================
 */

const LIMITS = {
    TIMEOUT_MS: 8000,
    MAX_BUFFER: 1024 * 1024 * 5
};

/**
 * ===============================
 * Supported Languages
 * ===============================
 */

const LANGUAGES = {

    javascript: {
        extension: "js",
        runner: "node"
    },

    python: {
        extension: "py",
        runner: "python"
    },

    java: {
        extension: "java",
        runner: "java"
    },

    dotnet: {
        extension: "cs",
        runner: "dotnet"
    }
};

/**
 * ===============================
 * Default File Names
 * ===============================
 */

const FILE_NAMES = {
    javascript: "solution.js",
    python: "solution.py",
    java: "Solution.java",
    dotnet: "Program.cs"
};

/**
 * ===============================
 * Export
 * ===============================
 */

module.exports = {
    RUNTIME_ROOT,
    RUNTIMES,
    TEMP_ROOT,
    LIMITS,
    EXECUTION_LIMITS,
    LANGUAGES,
    FILE_NAMES
};