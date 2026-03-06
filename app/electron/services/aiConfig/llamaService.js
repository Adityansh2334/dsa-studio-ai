const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const { app} = require("electron");
const {checkSystemCapacity} = require("../controllers/checkSystemCapacity");

let llamaServerProcess = null;
let activeDownloadController = null;
let activeWriter = null;
let activeDestPath = null;

/* ---------- PATHS ---------- */

function getModelsDir() {
    const dir = path.join(app.getPath("appData"), "DSA-Self-Prepare-Models", "models");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function getLlamaDir() {
    if (app.isPackaged) {
        // Production (.exe)
        return path.join(
            process.resourcesPath,
            "app.asar.unpacked",
            "electron",
            "resources",
            "ai"
        );
    }

    // dev mode → go UP to electron root
    return path.join(app.getAppPath(), "electron", "resources", "ai");
}

function getModelPath(modelKey) {
    return path.join(getModelsDir(), `${modelKey}.gguf`);
}

/* ---------- MODEL MAP ---------- */

const MODEL_MAP = {
    /* ---------------- CPU VERY LOW (old AVX2 / 8GB RAM) ---------------- */
    "qwen2.5-coder-1.5b": {
        file: "qwen2.5-coder-1.5b-instruct-q4_k_m.gguf",
        url: "https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF/resolve/main/qwen2.5-coder-1.5b-instruct-q4_k_m.gguf",
        sizeGB: 1.1
    },

    /* ---------------- CPU GOOD (16GB RAM modern i7 / Ryzen) ---------------- */
    "qwen2.5-coder-3b": {
        file: "qwen2.5-coder-3b-instruct-q4_k_m.gguf",
        url: "https://huggingface.co/Qwen/Qwen2.5-Coder-3B-Instruct-GGUF/resolve/main/qwen2.5-coder-3b-instruct-q4_k_m.gguf",
        sizeGB: 2.3
    },

    "llama3.2-3b": {
        file: "llama-3.2-3b-instruct-q4_k_m.gguf",
        url: "https://huggingface.co/unsloth/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf",
        sizeGB: 2.6
    },

    /* ---------------- GPU / Apple Silicon SWEET SPOT ---------------- */
    "qwen2.5-coder-7b": {
        file: "qwen2.5-coder-7b-instruct-q4_k_m.gguf",
        url: "https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct-GGUF/resolve/main/qwen2.5-coder-7b-instruct-q4_k_m.gguf",
        sizeGB: 4.8
    },

    "deepseek-r1-7b": {
        file: "deepseek-r1-distill-qwen-7b-q4_k_m.gguf",
        url: "https://huggingface.co/unsloth/DeepSeek-R1-Distill-Qwen-7B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-7B-Q4_K_M.gguf",
        sizeGB: 5.1
    },

    /* ---------------- HIGH-END GPU (RTX / AMD 8GB+ VRAM) ---------------- */
    "deepseek-r1-14b": {
        file: "deepseek-r1-distill-qwen-14b-q4_k_m.gguf",
        url: "https://huggingface.co/lmstudio-community/DeepSeek-R1-Distill-Qwen-14B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-14B-Q4_K_M.gguf",
        sizeGB: 9.2
    }
};

/* ---------- CHECK AND DOWNLOAD MODEL IF NEEDED ---------- */

async function prepareOfflineAI(modelKey) {
    console.log("🚀 Preparing offline AI for model:", modelKey);
    const meta = MODEL_MAP[modelKey];
    if (!meta) {
        return { status: "needs-setup", reason: "unknown-model" };
    }

    // ✅ check llama.cpp exists
    if (!isLlamaInstalled()) {
        return { status: "needs-setup", reason: "not-installed" };
    }

    // ✅ check model health
    if (!isModelHealthy(modelKey)) {
        return { status: "needs-setup", reason: "model-missing-or-corrupt" };
    }

    return { status: "ready" };
}


async function downloadOfflineModel(event, modelKey) {
    const meta = MODEL_MAP[modelKey];
    if (!meta) {
        event.sender.send("ai-status", "❌ Unknown model");
        throw new Error("Unknown model");
    }

    const dest = getModelPath(modelKey);
    const tempDest = dest + ".part";
    activeDestPath = dest;

    // ✅ Remove corrupted model
    if (fs.existsSync(dest) && !isModelHealthy(modelKey)) {
        event.sender.send("ai-status", "Corrupted model detected. Re-downloading...");
        fs.unlinkSync(dest);
    }

    // ✅ Skip if already healthy
    if (isModelHealthy(modelKey)) {
        event.sender.send("ai-status", "Model already ready ✅");
        return { status: "ready" };
    }

    event.sender.send("ai-status", `Downloading AI model: ${modelKey}`);

    try {
        await streamDownload(meta.url, tempDest, event);

        // Rename temp to final only after full success
        fs.renameSync(tempDest, dest);

    } catch (e) {

        // Clean temp file on failure
        if (fs.existsSync(tempDest)) {
            fs.unlinkSync(tempDest);
        }

        event.sender.send("ai-status", "❌ Model download failed");
        throw e;
    } finally {
        activeDownloadController = null;
        activeWriter = null;
    }

    // ✅ Final validation
    if (!isModelHealthy(modelKey)) {
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        event.sender.send("ai-status", "❌ Downloaded model is corrupted");
        throw new Error("Corrupted model after download");
    }

    event.sender.send("ai-status", "Model ready ✅");
    return { status: "ready" };
}

/* ---- Helper Functions ---- */

async function streamDownload(url, dest, event) {

    activeDownloadController = new AbortController();
    const signal = activeDownloadController.signal;

    const response = await axios({
        method: "GET",
        url,
        responseType: "stream",
        maxRedirects: 10,
        signal,
        headers: {
            "User-Agent": "Mozilla/5.0"
        }
    });

    const total = Number(response.headers["content-length"]);
    let downloaded = 0;

    activeWriter = fs.createWriteStream(dest);

    response.data.on("data", chunk => {
        downloaded += chunk.length;

        event.sender.send("ai-progress", {
            percent: total
                ? ((downloaded / total) * 100).toFixed(2)
                : "0",
            downloaded,
            total
        });
    });

    response.data.on("error", err => {
        if (signal.aborted) return;
        throw err;
    });

    response.data.pipe(activeWriter);

    return new Promise((resolve, reject) => {

        activeWriter.on("finish", resolve);

        activeWriter.on("error", err => {
            if (signal.aborted) return reject(new Error("Download cancelled"));
            reject(err);
        });
    });
}


function isModelHealthy(modelKey) {
    try {
        const file = getModelPath(modelKey);
        if (!fs.existsSync(file)) return false;

        const stats = fs.statSync(file);

        // ✅ Rule 1: must be at least 500MB
        if (stats.size < 500 * 1024 * 1024) return false;

        // ✅ Rule 2: check GGUF magic header
        const fd = fs.openSync(file, "r");
        const buffer = Buffer.alloc(4);
        fs.readSync(fd, buffer, 0, 4, 0);
        fs.closeSync(fd);

        return buffer.toString() === "GGUF";
    } catch {
        return false;
    }
}

function isLlamaInstalled() {
    try {
        const dir = (getLlamaDir());

        const requiredFiles = [
            "llama-server.exe"
        ];

        for (const file of requiredFiles) {
            if (!fs.existsSync(path.join(dir, file))) {
                return false;
            }
        }

        return true;
    } catch {
        return false;
    }
}

async function startLlamaServer(modelKey) {
    if (llamaServerProcess) {
        console.log("🟡 Llama already running");
        return;
    }

    console.log("🚀 Starting llama-server...");

    const modelPath = getModelPath(modelKey);
    const llamaExe = getLlamaExe();

    const systemDetails = await checkSystemCapacity();

    const {
        cpuCores,
        totalMemGB,
        freeMemGB,
        hasDedicatedGPU,
        isAppleSilicon,
        gpuVRAMGB,
        gpu
    } = systemDetails.system;

    /* ======================================================
       THREAD CALCULATION (SAFE FOR ELECTRON UI)
    ====================================================== */

    const SAFE_CPU_FACTOR = 0.4; // prevent UI freeze
    const SAFE_GPU_FACTOR = 0.75;

    let threads;

    /* ======================================================
       DETECT REAL GPU (NOT SHARED / INTEGRATED)
    ====================================================== */

    const isRealDedicatedGPU =
        hasDedicatedGPU &&
        gpuVRAMGB &&
        gpuVRAMGB >= 2

    /* ======================================================
       CONTEXT + BATCH LOGIC
       MODEL TYPE: 1.5B Q4_K_M / PHI-3 MINI Q4
    ====================================================== */

    let ctxSize;
    let batchSize;

    if (isRealDedicatedGPU) {

        console.log("🟢 Dedicated GPU detected:", gpu, gpuVRAMGB, "GB");

        threads = Math.max(2, Math.floor(cpuCores * SAFE_GPU_FACTOR));

        if (gpuVRAMGB >= 8) {
            ctxSize = 8192;
            batchSize = 512;
        }
        else if (gpuVRAMGB >= 6) {
            ctxSize = 6144;
            batchSize = 384;
        }
        else {
            ctxSize = 4096;
            batchSize = 256;
        }

    } else {

        console.log("🟡 CPU-only / Integrated GPU mode");

        threads = Math.max(2, Math.floor(cpuCores * SAFE_CPU_FACTOR));

        /*
            IMPORTANT:
            For 1.5B / Phi3-mini,
            large ctx is unnecessary on CPU.
        */

        if (freeMemGB >= 16) {
            ctxSize = 4096;
            batchSize = 192;
        }
        else if (freeMemGB >= 8) {
            ctxSize = 3072;
            batchSize = 128;
        }
        else {
            ctxSize = 2048;
            batchSize = 96;
        }
    }

    /* Round ctx to nearest 512 */
    ctxSize = Math.ceil(ctxSize / 512) * 512;

    /* Hard Safety Caps */
    ctxSize = Math.min(ctxSize, 8192);
    batchSize = Math.max(64, batchSize);

    console.log("threads:", threads);
    console.log("ctxSize:", ctxSize);
    console.log("batchSize:", batchSize);

    /* ======================================================
       BUILD LLAMA SERVER ARGS
    ====================================================== */

    const args = [
        "--model", modelPath,
        "--port", "8249",
        "--host", "127.0.0.1",

        "--threads", threads.toString(),
        "--ctx-size", ctxSize.toString(),
        "--batch-size", batchSize.toString(),

        "--flash-attn", "auto",
        "--mmap",

        "--keep", "0",
        "--cache-ram", "0",
        "--no-context-shift",
    ];

    /* ======================================================
       MEMORY LOCK (ONLY HIGH-RAM SYSTEMS)
    ====================================================== */

    if (totalMemGB >= 32 && freeMemGB >= 16) {
        args.push("--mlock");
    }

    /* ======================================================
       GPU LAYERS (ONLY REAL GPU)
    ====================================================== */

    if (isRealDedicatedGPU) {

        if (gpuVRAMGB >= 8) {
            args.push("--gpu-layers", "999");
        }
        else if (gpuVRAMGB >= 6) {
            args.push("--gpu-layers", "50");
        }
        else {
            args.push("--gpu-layers", "25");
        }

    } else {
        args.push("--gpu-layers", "0");
    }

    /* ======================================================
       APPLE SILICON
    ====================================================== */

    if (isAppleSilicon) {
        args.push("--metal");
    }

    llamaServerProcess = spawn(llamaExe, args, {
        stdio: ["ignore", "pipe", "pipe"]
    });


    llamaServerProcess.stdout.on("data", d => {
        const msg = d.toString();
        if (msg.includes("HTTP server listening")) {
            console.log("✅ Llama server ready");
        }
    });

    llamaServerProcess.stderr.on("data", d => {
        console.log("LLAMA SERVER:", d.toString());
    });

    llamaServerProcess.on("exit", () => {
        console.log("🛑 Llama server exited");
        llamaServerProcess = null;
    });
}

const LLAMA_PORT = 8249;
const BASE_URL = `http://127.0.0.1:${LLAMA_PORT}`;

async function checkLlamaServer(modelKey) {
    try {
        // 1️⃣ Check server is alive
        const health = await axios.get(`${BASE_URL}/health`, {
            timeout: 1500
        });

        if (health.status !== 200) {
            return { running: false };
        }

        // 2️⃣ Check which model is loaded
        const props = await axios.get(`${BASE_URL}/props`, {
            timeout: 1500
        });

        const loadedPath = props.data?.model_path || "";
        const loadedModel = loadedPath.split("\\").pop().replace(".gguf", "");

        if (loadedModel === modelKey) {
            return {
                running: true,
                correctModel: true,
                loadedModel
            };
        }

        return {
            running: true,
            correctModel: false,
            loadedModel
        };

    } catch (err) {
        return { running: false };
    }
}

async function stopLlamaServer() {
    if (!llamaServerProcess) return;

    llamaServerProcess.kill("SIGTERM");
    llamaServerProcess = null;
}

async function waitForLlamaReady(timeoutMs = 60000) {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
        try {
            await axios.get(BASE_URL);
            console.log("✅ Llama server is ready");
            return;
        } catch {
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    throw new Error("Llama server did not become ready in time");
}

async function cancelOfflineModelDownload() {
    try {

        if (activeDownloadController) {
            activeDownloadController.abort();
        }

        if (activeWriter) {
            activeWriter.destroy();
        }

        const tempPath = activeDestPath + ".part";

        if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
        }

        return { cancelled: true };

    } catch (err) {
        console.error("Cancel failed:", err);
        return { error: true };
    } finally {
        activeDownloadController = null;
        activeWriter = null;
        activeDestPath = null;
    }
}

function getLlamaExe() {
    return path.join(getLlamaDir(), "llama-server.exe");
}

module.exports = {
    prepareOfflineAI,
    downloadOfflineModel,
    startLlamaServer,
    checkLlamaServer,
    stopLlamaServer,
    waitForLlamaReady,
    cancelOfflineModelDownload
};
