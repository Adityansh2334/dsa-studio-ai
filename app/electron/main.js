const { app, BrowserWindow, ipcMain, Menu  } = require("electron");

// 🔥 Fix Windows certificate store issue for HTTPS
app.commandLine.appendSwitch("ignore-certificate-errors", "false");
require("win-ca");

const { exec } = require("child_process");
const os = require("os");
const fs = require("fs");

/* ======================================================
   DEP IMPORTS
====================================================== */
const path = require("path");
const { default: autoTable } = require("jspdf-autotable"); // Import the autoTable function
const { generatePdf } = require("./services/controllers/pdfDownloader");

/* ===================================================
   JS IMPORTS
====================================================== */
const db = require("./services/database/database.js");
const { getTodayProblems } = require("./services/worker/dailyService.js");
const { regenerateSolution } = require("./services/aiConfig/ai.js");
const { encrypt } = require("./config/aiConfig");
const { registerUser, loginUser } = require("./services/authService");
const {checkSystemCapacity} = require("./services/controllers/checkSystemCapacity");
const DBH = require("./services/controllers/databaseHandler");
const problemStream = require("./events/problemStream");
const patterns = require("./services/worker/patterns");
const { initLogger, exportLogs} = require("./utils/logger");
const {askProblemTutorAI} = require("./services/aiConfig/problemTutorAI");
const {encryptAndSaveDB} = require("./utils/dbCrypto");
const { initGlobalErrorHandler } = require("./utils/globalErrorHandler");
const {validateOpenRouterApiKey} = require("./services/providers/openrouter");
const {validateHFKey} = require("./services/providers/huggingface");
const {resetAI} = require("./services/aiConfig/aiRuntimeState");
const {getUserAnalytics, getDailyAnalyticsInsight, getInsightHistory, predictUserProgression} = require("./services/analytics/analyticsService");
const {generateVisualizationAI} = require("./services/aiVisualization/aiVisualizationService");
const {clearStaleJobs} = require("./services/aiQueue/aiJobClear");
const {validateVisualization} = require("./services/aiVisualization/aiVisualizationUtility");
const generationStream = require("./events/generationStream");
const codeRunnerService = require("./services/codeRunner/codeRunnerService");
const {fetchTemplate} = require("./services/controllers/templateController");
const {getRuntimeLabels} = require("./services/codeRunner/utils/runtimeDetector");


/* ======================== Local Variables =============================== */
let mainWindow = null;
let currentUserId = null; // ✅ SESSION STATE
const isDev = !app.isPackaged;


ipcMain.on("renderer-log", (_, msg) => console.log("[RENDERER]", msg));
ipcMain.on("renderer-error", (_, msg) => console.error("[RENDERER]", msg));
ipcMain.on("renderer-warn", (_, msg) => console.warn("[RENDERER]", msg));

/**
 * Called after login / auto login / restore session
 */
function setAuthenticatedUser(userId) {
    currentUserId = userId;
}

/**
 * Used inside every IPC that requires auth
 */
function getAuthenticatedUserId() {
    if (!currentUserId) {
        throw new Error("Unauthorized: No active session");
    }
    return currentUserId;
}

/* ======================================================
   WINDOW
====================================================== */

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        title: "DSA Self Prepare",
        backgroundColor: "#0B0F19",
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true
        }
    });

    if (isDev) {
        mainWindow.loadURL("http://localhost:5173");
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
    }
}
/* ======================================================
   IPC HANDLERS (SAFE)
====================================================== */

/* ---------- LLAMA CPP ---------- */

ipcMain.handle("prepare-offline-ai",
    safeIpc(async (event, modelKey) => {
        const { prepareOfflineAI } = require("./services/aiConfig/llamaService");
        return await prepareOfflineAI(modelKey);
    })
);

ipcMain.handle("download-offline-model",
    safeIpc(async (event, modelKey) => {
        const { downloadOfflineModel } = require("./services/aiConfig/llamaService");
        return await downloadOfflineModel(event, modelKey);
    })
);

/* ---------- APP ---------- */

ipcMain.handle("restart-app",
    safeIpc(async () => {
        console.log("🔁 Restarting application...");
        if (!app.isPackaged) {
            BrowserWindow.getAllWindows().forEach(w => w.reload());
            return;
        }
        app.relaunch();
        app.exit(0);
    })
);

/* ---------- AUTH ---------- */

ipcMain.handle("auth-register",async (_, payload) => {
    const user = await registerUser(payload);
    setAuthenticatedUser(user.id);
    DBH.insertUserSession(user.id);
    return user;
});

ipcMain.handle("auth-login", async (_, payload) => {
    const user = await loginUser(payload);
    setAuthenticatedUser(user.id);

    DBH.markUserLoggedIn(user.id);
    return user;
});

ipcMain.handle("restore-session",
    safeIpc(async () => {
        const row = DBH.getLastLoggedInUser();
        if (!row) return null;
        setAuthenticatedUser(row.id);
        return row;
    })
);

ipcMain.handle("auth-logout",
    safeIpc(async () => {
        const userId = getAuthenticatedUserId();
        if (!userId) return;
        DBH.markUserLoggedOut(userId);
        resetAI();
        currentUserId = null;
    })
);

/* ---------- AI KEYS ---------- */

ipcMain.handle("check-ai-keys",
    safeIpc(async () => {
        const row = DBH.getAIKeys(getAuthenticatedUserId());
        return Boolean(row?.openrouter_key || row?.hf_key || row?.ollama_model);
    })
);

ipcMain.handle("save-ai-keys",
    safeIpc(async (_, { openRouterKey, hfKey, ollamaModel, mode, provider }) => {
        if (mode === "online" && !openRouterKey && !hfKey) {
            throw new Error("OpenRouter key or HF key is required");
        }

        DBH.saveAIKeys(
            getAuthenticatedUserId(),
            encrypt(openRouterKey),
            hfKey ? encrypt(hfKey) : null,
            ollamaModel || null,
            mode,
            provider
        );

        DBH.markerUserLoginSuccess(getAuthenticatedUserId());
        return { success: true };
    })
);

ipcMain.handle("validate-openrouter-api-key",
    safeIpc(async (_, apiKey) => {
        return await validateOpenRouterApiKey(apiKey);
    })
);

ipcMain.handle("validate-hf-api-key",
    safeIpc(async (_, apiKey) => {
        return await validateHFKey(apiKey);
    })
);

/* ---------- DAILY PROBLEMS ---------- */

ipcMain.handle("get-today-problems",async (_, mode = "normal") => {
    const userId = getAuthenticatedUserId();
    return getTodayProblems(mode, userId);
});

ipcMain.on("listen-problem-stream", (event) => {
    const sender = event.sender;
    const handler = (problem) => sender.send("problem-generated", problem);

    problemStream.on("new-problem", handler);

    sender.on("destroyed", () => {
        problemStream.off("new-problem", handler);
    });
});

ipcMain.handle("get-user-progress",
    safeIpc(async () => {
        return DBH.getUserProgress(getAuthenticatedUserId());
    })
);

ipcMain.handle("mark-problem-solved",
    safeIpc(async (_, problemId) => {
        return DBH.markProblemSolved(problemId, getAuthenticatedUserId());
    })
);

/* ---------- REGENERATE ---------- */

ipcMain.handle("regenerate-solution",
    safeIpc(async (_, problemId) => {
        const row = db
            .prepare("SELECT * FROM problems WHERE id = ? AND user_id = ?")
            .get(problemId, getAuthenticatedUserId());

        if (!row) throw new Error("Problem not found");

        const content = JSON.parse(row.content);

        const regenerated = await regenerateSolution(
            getAuthenticatedUserId(),
            content.problem,
            content.solution?.java || "",
            row.pattern,
            row.difficulty
        );

        const updated = {
            ...content,
            solution: { ...content.solution, ...regenerated.solution }
        };

        db.prepare(`
            UPDATE problems
            SET content = ?
            WHERE id = ?
        `).run(JSON.stringify(updated), problemId);

        return { ...row, content: JSON.stringify(updated) };
    })
);

ipcMain.handle("get-problem-by-id",
    safeIpc(async (_, problemId) => {
        return DBH.getProblemById(problemId)
    })
);

/* ---------- USER PREFERENCES ---------- */

ipcMain.handle("get-user-preferences",
    safeIpc(async () => {
        return DBH.getUserPreferences(getAuthenticatedUserId());
    })
);

ipcMain.handle("update-user-preferences",
    safeIpc(async (_, data) => {
        DBH.updateUserPreferences(getAuthenticatedUserId(), data);
        return { success: true };
    })
);

ipcMain.handle("update-interview-preferences",
    safeIpc(async (_, data) => {
        DBH.updateInterviewPreferences(getAuthenticatedUserId(), data);
        return true;
    })
);

ipcMain.handle("check-system-for-ollama",
    safeIpc(async () => {
        return await checkSystemCapacity();
    })
);

ipcMain.handle("download-problem-pdf",
    safeIpc(async (event, { problem, content }) => {
        return await generatePdf(problem, content);
    })
);

/* ---------- AI TUTOR ---------- */

ipcMain.handle("load-problem-chat",
    safeIpc(async (_, problemId) => {
        return DBH.loadAiChatProblems(getAuthenticatedUserId(), problemId);
    })
);

ipcMain.handle(
    "ask-problem-ai-stream",
    async (event, { problem, problemId, question }) => {

        const userId = getAuthenticatedUserId();

        DBH.saveAiUserQuestions(userId, problemId, question);

        let fullResponse = "";

        await askProblemTutorAI({
            userId,
            problem,
            question,
            onToken: (token) => {
                fullResponse += token;
                event.sender.send("ai-tutor-token", token);
            }
        });

        DBH.saveAiResponse(userId, problemId, fullResponse);

        event.sender.send("ai-tutor-done");

        return true;
    }
);

/* ---------- STATIC ---------- */

ipcMain.handle("get-patterns",
    safeIpc(async () => patterns.map(p => p.pattern))
);

ipcMain.handle("get-interview-contexts",
    safeIpc(async () => {
        return DBH.getInterviewPreferences(getAuthenticatedUserId());
    })
);

ipcMain.handle("delete-interview-context",
    safeIpc(async (_,  context ) => {
        DBH.deleteInterviewContext(getAuthenticatedUserId(), context);
        return true;
    })
);

ipcMain.on("log-error", (_, msg) => {
    console.error("RENDERER ERROR:", msg);
});

ipcMain.handle("export-error-logs", async () => {
    return await exportLogs();
});

ipcMain.handle("cancel-offline-model-download", async (_, model) => {
    const { cancelOfflineModelDownload } = require("./services/aiConfig/llamaService");
    return await cancelOfflineModelDownload(model);
});

/* ---------- LIMIT COUNT ---------- */

ipcMain.handle("get-user-limit-count", async (_, mode) => {

    const limit = DBH.gerUserPreferenceLimit(getAuthenticatedUserId(), mode);

    if (mode === "normal") {
        return limit?.daily_problem_count ?? 3;
    } else {
        return limit?.interview_problem_count ?? 10;
    }
});

/* ---------- PROBLEM COUNT DATA ---------- */
ipcMain.handle("get-problems-count", async (_, interviewContext) => {
    if(interviewContext) {
        const interviewCount = DBH.getProblemsCountInterview(getAuthenticatedUserId(), interviewContext);
        return interviewCount.count;
    }
    const normalProblemsCount = DBH.getTotalProblemsCount(getAuthenticatedUserId());
    return normalProblemsCount.count;
});

/* RESET PASSWORD */
ipcMain.handle("reset-password", async (_, data) => {
    return DBH.resetPassword(data.email, data.password);
});

/* ----------------- ANALYTICS --------------- */
ipcMain.handle("get-user-analytics", (_) => {
    const userId = getAuthenticatedUserId();
    return getUserAnalytics(userId);
});

ipcMain.handle("get-analytics-ai", async (_, stats) => {

    const userId = getAuthenticatedUserId();

    return await getDailyAnalyticsInsight(userId, stats);

});

ipcMain.handle("get-insight-history", () => {
    const userId = getAuthenticatedUserId();
    return getInsightHistory(userId);
});

ipcMain.handle("get-progress-prediction", async (_) => {

    const userId = getAuthenticatedUserId();

    return await predictUserProgression(userId);

});

ipcMain.handle(
    "get-or-generate-visualization",
    async (event, payload) => {

        try {

            
            const { problemId, forceRegenerate } = payload;
            console.log("FORCE REGENERATE ??",forceRegenerate);
            /* =========================
               CACHE CHECK
            ========================= */

            if (!forceRegenerate) {

                const cached =
                    DBH.getAIVisualizationCache(problemId);

                if (cached) {
                    return {
                        success: true,
                        data: cached,
                        cached: true,
                        source: "cache"
                    };
                }
            }

            /* =========================
               GENERATE
            ========================= */

            const aiResult =
                await generateVisualizationAI(
                    getAuthenticatedUserId(),
                    payload
                );

            const isValid =
                validateVisualization(aiResult);

            /* =========================
               STORE IF VALID
            ========================= */

            if (isValid) {

                DBH.storeAIVisualizationCache(
                    problemId,
                    payload.pattern,
                    aiResult
                );

                return {
                    success: true,
                    data: aiResult,
                    cached: false,
                    source: "ai"
                };
            }

            console.log("❌ Invalid visualization → not stored");

            return {
                success: true,
                data: aiResult,
                cached: false,
                source: "ai-invalid"
            };

        } catch (err) {

            console.error("Visualization Error:", err);

            return {
                success: false,
                error: err.message
            };
        }
    }
);

ipcMain.on("listen-generation-stream", (event) => {

    const sender = event.sender;

    const started = (data) => sender.send("generation-started", data);
    const progress = (data) => sender.send("generation-progress", data);
    const finished = () => sender.send("generation-finished");

    generationStream.on("generation-started", started);
    generationStream.on("problem-generated", progress);
    generationStream.on("generation-finished", finished);

    sender.on("destroyed", () => {
        generationStream.off("generation-started", started);
        generationStream.off("problem-generated", progress);
        generationStream.off("generation-finished", finished);
    });
});


/* ========================= CODE RUNNER ====================== */
/**
 * =========================
 * RUN CODE
 * =========================
 */
ipcMain.handle("codeRunner",
    safeIpc(async (_, payload) => {
    try {

        const result = await codeRunnerService.runCode(payload);

        return result;

    } catch (err) {

        return {
            success: false,
            error: err.message
        };

    }
})
);

/**
 * =========================
 * SUBMIT CODE
 * =========================
 */
ipcMain.handle("codeSubmit",
    safeIpc(async (_, payload) => {
    try {

        const result = await codeRunnerService.submitCode(payload);

        return result;

    } catch (err) {

        return {
            success: false,
            error: err.message
        };

    }
})

);

/**
 * =========================
 * GET TEMPLATE
 * =========================
 */
ipcMain.handle(
    "get-template",
    safeIpc(async (_, payload) => {
        console.log("INSIDE GET TEMPLATE ::::::::::::::");
        return await fetchTemplate(payload);
    })
);

/**
 * =========================
 * GET RUNTIME LABELS
 * =========================
 */
ipcMain.handle(
    "get-runtimes",
    safeIpc(async () => {
        console.log("INSIDE GET RUNTIMES ::::::::::::::");
        return getRuntimeLabels();
    })
);


/* ===================================================
   APP LIFECYCLE
====================================================== */

app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    initLogger();
    initGlobalErrorHandler();
    clearStaleJobs();
    createWindow();
});

app.on("before-quit", async () => {
    try {
        db.close();
        await encryptAndSaveDB();
    } catch (err) {
        console.error("Shutdown error:", err);
    }
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

/* ===================================================
   APP HELPER FUNCTIONS
====================================================== */

function safeIpc(handler) {
    return async (event, ...args) => {
        try {
            return await handler(event, ...args);
        } catch (err) {
            console.error("IPC ERROR:", err);
            return { error: err.message };
        }
    };
}

