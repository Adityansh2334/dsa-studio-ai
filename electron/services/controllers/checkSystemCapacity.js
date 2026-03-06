const os = require("os");
const si = require("systeminformation");
const { exec } = require("child_process");
const db = require("../database/database");

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let inMemoryCache = null;
let capacityPromise = null;

/* ========================================================= */

async function checkSystemCapacity(retry = 0) {

    if (capacityPromise) {
        console.log("🔁 Reusing ongoing capacity check promise");
        return capacityPromise;
    }

    capacityPromise = (async () => {

        try {

            console.log("🧠 checkSystemCapacity() START");
            const startTime = Date.now();

            /* ---------------- MEMORY CACHE ---------------- */

            if (inMemoryCache) {
                console.log("⚡ Returning in-memory cache");
                return inMemoryCache;
            }

            /* ---------------- DB CACHE ---------------- */

            console.log("🔎 Checking DB cache...");
            const cached = db.prepare(`
                SELECT data, updated_at
                FROM system_capacity_cache
                WHERE id = 1
            `).get();

            if (cached) {
                const isFresh = (Date.now() - cached.updated_at) < CACHE_TTL_MS;
                console.log("📦 DB cache found. Fresh:", isFresh);

                if (isFresh) {
                    const parsed = JSON.parse(cached.data);
                    inMemoryCache = parsed;
                    console.log("⚡ Returning DB cached result");
                    return parsed;
                }
            } else {
                console.log("❌ No DB cache found");
            }

            /* ================= CPU ================= */

            console.log("🔄 Fetching CPU info...");
            const cpuData = await safeCpuFetch();
            console.log("✅ CPU fetch attempt done");

            let cpuModel = os.cpus()[0]?.model || "Unknown CPU";
            let cpuCores = os.cpus().length;
            let cpuDetailsRetrievalFailed = false;

            if (cpuData) {
                cpuModel = cpuData.brand;
                cpuCores = cpuData.physicalCores || cpuData.cores;
            } else {
                cpuDetailsRetrievalFailed = true;
                console.log("⚡ Using fallback os.cpus()");
            }

            /* ================= MEMORY ================= */

            const mem = await safeSiCall("Memory", () => si.mem());

            let totalMemGB = Math.round(os.totalmem() / 1024 / 1024 / 1024);
            let freeMemGB = Math.round(os.freemem() / 1024 / 1024 / 1024);
            let memoryRetrievalFailed = false;

            if (mem) {
                totalMemGB = Math.round(mem.total / 1024 / 1024 / 1024);
                freeMemGB = Math.round(mem.available / 1024 / 1024 / 1024);
            } else {
                memoryRetrievalFailed = true;
                console.log("⚡ Using fallback memory values");
            }

            /* ================= GRAPHICS ================= */

            const graphics = await safeSiCall("Graphics", () => si.graphics());

            let gpuList = [];
            let hasDedicatedGPU = false;
            let graphicsFailed = false;

            if (graphics?.controllers?.length) {
                gpuList = graphics.controllers.map(c => c.model);
                hasDedicatedGPU = gpuList.some(g =>
                    /nvidia|rtx|gtx|amd|radeon|rx/i.test(g)
                );
            } else {
                graphicsFailed = true;
                console.log("⚠️ Graphics unavailable — assuming no GPU");
            }

            /* ================= DISK ================= */

            const disk = await safeSiCall("Disk", () => si.fsSize());

            let freeDiskGB = 20; // SAFE fallback
            let isDiskRetrievalFailed = false;

            if (disk?.length) {
                const rootDisk =
                    disk.find(d => d.mount === "/" || d.mount === "C:") || disk[0];

                if (rootDisk?.available) {
                    freeDiskGB = Math.round(
                        rootDisk.available / 1024 / 1024 / 1024
                    );
                }
            } else {
                isDiskRetrievalFailed = true;
                console.log("⚠️ Disk info unavailable — using fallback 20GB");
            }

            /* ================= RETRY LOGIC ================= */

            if (
                retry === 0 &&
                (cpuDetailsRetrievalFailed || memoryRetrievalFailed || graphicsFailed)
            ) {
                console.log("🔁 Hardware detection incomplete — retrying once...");
                capacityPromise = null;
                await new Promise(r => setTimeout(r, 1500));
                return checkSystemCapacity(1);
            }

            /* ================= ARCHITECTURE ================= */

            const isAppleSilicon =
                os.platform() === "darwin" && os.arch() === "arm64";

            const numaNodes = os.cpus().length > 8;

            const isModernIntel =
                /([4-9]th|\d{2}th)\s?Gen/i.test(cpuModel) ||
                /i[3579]-(4|5|6|7|8|9|\d{2})\d{3}/i.test(cpuModel) ||
                /Ultra/i.test(cpuModel);

            const isModernAMD =
                /Ryzen|EPYC|Threadripper/i.test(cpuModel);

            const hasAvx2 = isModernIntel || isModernAMD;

            const cpuSupported =
                hasAvx2 || isAppleSilicon || isModernIntel || isModernAMD;

            /* ================= GPU VRAM ================= */

            let gpuVRAMGB = null;

            if (hasDedicatedGPU) {

                console.log("🎮 Dedicated GPU detected. Checking VRAM...");

                const safeExec = (command) =>
                    new Promise(resolve => {
                        exec(command, { timeout: 3000 }, (err, stdout) => {
                            if (err) return resolve(null);

                            const match = stdout.match(/\d+/);
                            if (!match) return resolve(null);

                            resolve(parseInt(match[0], 10));
                        });
                    });

                let gpuVRAMMB = null;

                if (gpuList.some(g => /nvidia/i.test(g))) {
                    gpuVRAMMB = await safeExec(
                        "nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits"
                    );
                }

                if (!gpuVRAMMB && graphics?.controllers?.length) {
                    const dedicated = graphics.controllers.find(g =>
                        /nvidia|amd|radeon|rtx|gtx/i.test(g.model)
                    );
                    if (dedicated?.vram) {
                        gpuVRAMMB = dedicated.vram;
                    }
                }

                gpuVRAMGB = gpuVRAMMB
                    ? Math.round(gpuVRAMMB / 1024)
                    : 0;

                console.log("🎮 GPU VRAM:", gpuVRAMGB, "GB");
            }

            /* ================= DECISION ENGINE ================= */

            let allowed = false;
            let reason = "";
            let tier = "unsupported";
            let recommendedModels = [];
            let tps = 0;

            if (!cpuSupported && !hasDedicatedGPU) {
                reason =
                    "Your CPU is too old and lacks AVX2 support, and no dedicated GPU was found. Local AI will not run.";
            } else if (isDiskRetrievalFailed){
                reason = "Disk retrieval failed. Please restart your PC and try again.";
            } else if (memoryRetrievalFailed){
                reason = "Memory retrieval failed. Please restart your PC and try again.";
            } else if (cpuDetailsRetrievalFailed){
                reason = "CPU details retrieval failed. Please restart your PC and try again.";
            } else if (totalMemGB < 8) {
                reason = "At least 8GB of RAM is required to run even the smallest models.";
            } else if (freeDiskGB < 10) {
                reason = "At least 8GB of RAM is required to run even the smallest models.";
            } else if (cpuCores < 4 && !hasDedicatedGPU) {
                reason = "Minimum 4 CPU cores recommended.";
            } else {
                allowed = true;

                // if (hasDedicatedGPU) {
                //     tier = "GPU";
                //     tps = 40;
                //     reason =
                //         "Dedicated GPU detected! You can run high-performance coding models.";
                //
                //     recommendedModels =
                //         totalMemGB >= 16
                //             ? ["deepseek-r1-7b", "qwen2.5-coder-7b"]
                //             : ["qwen2.5-coder-3b", "qwen2.5-coder-1.5b"];
                // } else {
                //     tier = "CPU";
                //     tps = isAppleSilicon ? 25 : 6;
                //     reason = `${isAppleSilicon ? "Apple Silicon" : "AVX2 CPU"} detected. Models will run on your processor.`;
                //
                //     recommendedModels = isAppleSilicon
                //         ? ["qwen2.5-coder-7b", "llama3.2-3b"]
                //         : ["qwen2.5-coder-1.5b", "phi-3.5-mini"];
                // }

                if (hasDedicatedGPU) {

                    tier = "GPU";
                    tps = 40;

                    reason = "Dedicated GPU detected. High-performance models available.";

                    if (gpuVRAMGB >= 10 || totalMemGB >= 32) {
                        recommendedModels = [
                            { "modelName": "deepseek-r1-14b", "recommended": true },
                            { "modelName": "qwen2.5-coder-7b", "recommended": false },
                            { "modelName": "deepseek-r1-7b", "recommended": false }
                        ];
                    } else {
                        recommendedModels = [
                            { "modelName": "qwen2.5-coder-3b", "recommended": false },
                            { "modelName": "qwen2.5-coder-7b", "recommended": true },
                            { "modelName": "deepseek-r1-7b", "recommended": false }
                        ];
                    }

                } else {

                    tier = "CPU";

                    tps = isAppleSilicon ? 25 : 8;

                    reason = `${isAppleSilicon ? "Apple Silicon" : "CPU"} detected. Models will run locally on your processor.`;

                    if (totalMemGB >= 24) {
                        recommendedModels = [
                            { "modelName": "qwen2.5-coder-3b", "recommended": true },
                            { "modelName": "llama3.2-3b", "recommended": true },
                            { "modelName": "qwen2.5-coder-7b", "recommended": false }
                        ];
                    } else if (totalMemGB >= 12) {
                        recommendedModels = [
                            { "modelName": "qwen2.5-coder-3b", "recommended": false },
                            { "modelName": "qwen2.5-coder-1.5b", "recommended": true },
                            { "modelName": "llama3.2-3b", "recommended": false }
                        ];
                    } else {
                        recommendedModels = [
                            { "modelName": "qwen2.5-coder-1.5b", "recommended": true }
                        ];
                    }
                }

                const etaSeconds = Math.ceil(250 / tps);
                reason += ` Estimated response time: ~${etaSeconds} seconds.`;
            }

            const result = {
                allowed,
                reason,
                tier,
                recommendedModels,
                system: {
                    cpuModel,
                    cpuCores,
                    totalMemGB,
                    freeDiskGB,
                    hasAvx2,
                    isAppleSilicon,
                    hasDedicatedGPU,
                    freeMemGB,
                    gpuVRAMGB,
                    numaNodes,
                    gpu: gpuList.join(", ")
                }
            };

            /* ================= SAVE CACHE ================= */

            if(allowed) {
                console.log("💾 Saving cache to DB...");

                db.prepare(`
                    INSERT
                    OR REPLACE INTO system_capacity_cache
            (id, data, system_type, updated_at)
            VALUES (1, ?, ?, ?)
                `).run(JSON.stringify(result), tier, Date.now());

                inMemoryCache = result;

                console.log("✅ checkSystemCapacity DONE in",
                    Date.now() - startTime,
                    "ms"
                );
            } else {
                console.log("Not Allowed System as detection failed or not met the requirements.")
                console.log("✅ checkSystemCapacity DONE in",
                    Date.now() - startTime,
                    "ms"
                );
            }

            return result;

        } catch (error) {
            console.error("💥 Hardware detection failed:", error);

            return {
                allowed: false,
                reason: "Failed to detect system hardware."
            };
        } finally {
            capacityPromise = null;
        }

    })();

    return capacityPromise;
}

/* ========================================================= */

async function safeCpuFetch(timeoutMs = 3000) {
    return new Promise(async (resolve) => {
        const timer = setTimeout(() => {
            console.warn("⚠️ si.cpu() timeout — using fallback");
            resolve(null);
        }, timeoutMs);

        try {
            const cpu = await si.cpu();
            clearTimeout(timer);
            resolve(cpu);
        } catch {
            clearTimeout(timer);
            resolve(null);
        }
    });
}

async function safeSiCall(label, fn, timeoutMs = 4000) {
    console.log(`🔄 Fetching ${label} info...`);

    return new Promise(async (resolve) => {
        const timer = setTimeout(() => {
            console.warn(`⚠️ ${label} fetch timeout — using fallback/null`);
            resolve(null);
        }, timeoutMs);

        try {
            const result = await fn();
            clearTimeout(timer);
            console.log(`✅ ${label} fetched`);
            resolve(result);
        } catch {
            clearTimeout(timer);
            resolve(null);
        }
    });
}

/* ========================================================= */

module.exports = {
    checkSystemCapacity
};
