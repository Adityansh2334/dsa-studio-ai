const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("logger", {
    log: (...args) => ipcRenderer.send("renderer-log", args.join(" ")),
    error: (...args) => ipcRenderer.send("renderer-error", args.join(" ")),
    warn: (...args) => ipcRenderer.send("renderer-warn", args.join(" "))
});
let problemStreamRegistered = false;
contextBridge.exposeInMainWorld("api", {
    // ✅ pass mode: "normal" | "interview"
    getTodayProblems: (mode = "normal") =>
        ipcRenderer.invoke("get-today-problems", mode),

    regenerateSolution: (problemId) =>
        ipcRenderer.invoke("regenerate-solution", problemId),

    markProblemSolved: (id) =>
        ipcRenderer.invoke("mark-problem-solved", id),

    getUserProgress: () =>
        ipcRenderer.invoke("get-user-progress"),

    checkAIKeys: () => ipcRenderer.invoke("check-ai-keys"),

    saveAIKeys: (keys) => ipcRenderer.invoke("save-ai-keys", keys),

    register: (data) => ipcRenderer.invoke("auth-register", data),
    login: (data) => ipcRenderer.invoke("auth-login", data),
    logout: () => ipcRenderer.invoke("auth-logout"),
    restoreSession: () => ipcRenderer.invoke("restore-session"),
    updateUserPreferences: (data) =>
        ipcRenderer.invoke("update-user-preferences", data),

    getUserPreferences: () =>
        ipcRenderer.invoke("get-user-preferences"),
    restartApp: () => ipcRenderer.invoke("restart-app"),
    updateInterviewPreferences: (data) =>
        ipcRenderer.invoke("update-interview-preferences", data),

    prepareOfflineAI: (model) => ipcRenderer.invoke("prepare-offline-ai", model),
    checkSystemForOllama:() => ipcRenderer.invoke("check-system-for-ollama"),
    downloadOfflineModel: (model) => ipcRenderer.invoke("download-offline-model", model),


    onOllamaProgress: (cb) => ipcRenderer.on("ai-progress", (_, d) => cb(d)),
    onOllamaStatus: (cb) => ipcRenderer.on("ai-status", (_, d) => cb(d)),


    downloadProblemPdf: ({problem, content}) => ipcRenderer.invoke("download-problem-pdf", { problem, content }),

    /* ================= REALTIME PROBLEM STREAM ================= */

    listenProblemStream: () => {

        if (problemStreamRegistered) return;

        ipcRenderer.send("listen-problem-stream");

        problemStreamRegistered = true;
    },

    onProblemGenerated: (cb) => {
        ipcRenderer.on("problem-generated", (_, problem) => cb(problem));
    },

    removeProblemListener: () => {
        ipcRenderer.removeAllListeners("problem-generated");
    },

    /* ================= AI CHATBOT ================= */

    loadProblemChat: (problemId) => ipcRenderer.invoke("load-problem-chat", problemId),
    getPatterns: () => ipcRenderer.invoke("get-patterns"),

    getInterviewContexts: () => ipcRenderer.invoke("get-interview-contexts"),
    deleteInterviewContext: (context) => ipcRenderer.invoke("delete-interview-context", context),

    logError: (msg) => ipcRenderer.send("log-error", msg),
    exportErrorLogs: () => ipcRenderer.invoke("export-error-logs"),

    validateOpenRouterApiKey: (apiKey) => ipcRenderer.invoke("validate-openrouter-api-key", apiKey),
    validateHFKey: (apiKey) => ipcRenderer.invoke("validate-hf-api-key", apiKey),

    cancelOfflineModelDownload: (model) =>
        ipcRenderer.invoke("cancel-offline-model-download", model),

    askProblemAIStream: (data, onToken) => {

        ipcRenderer.removeAllListeners("ai-tutor-token");
        ipcRenderer.removeAllListeners("ai-tutor-done");

        ipcRenderer.on("ai-tutor-token", (_, token) => {
            onToken(token);
        });

        return ipcRenderer.invoke("ask-problem-ai-stream", data);
    },
    getUserLimitCount: (mode) => ipcRenderer.invoke("get-user-limit-count", mode),
    getProblemsCount: (interviewContext) => ipcRenderer.invoke("get-problems-count", interviewContext),

    resetPassword: (data) => ipcRenderer.invoke("reset-password", data),

    /* ----------------- ANALYTICS ---------------------- */
    getUserAnalytics: () => ipcRenderer.invoke("get-user-analytics"),
    getAnalyticsAI: (stats) => ipcRenderer.invoke("get-analytics-ai", stats),
    getInsightHistory: () => ipcRenderer.invoke("get-insight-history"),
    getUserProgression:() => ipcRenderer.invoke("get-progress-prediction"),
    getOrGenerateVisualization: (payload) =>
        ipcRenderer.invoke("get-or-generate-visualization", payload),

    /* ============= GENERATION COUNT EVENTS ================*/

    listenGenerationStream: () =>
        ipcRenderer.send("listen-generation-stream"),

    onGenerationStarted: (cb) => {

        const handler = (_, data) => cb(data);

        ipcRenderer.on("generation-started", handler);

        return () => {
            ipcRenderer.removeListener("generation-started", handler);
        };
    },

    onGenerationProgress: (cb) => {

        const handler = (_, data) => cb(data);

        ipcRenderer.on("generation-progress", handler);

        return () => {
            ipcRenderer.removeListener("generation-progress", handler);
        };
    },

    onGenerationFinished: (cb) => {

        const handler = () => cb();

        ipcRenderer.on("generation-finished", handler);

        return () => {
            ipcRenderer.removeListener("generation-finished", handler);
        };
    },

    codeRunner: (payload) => ipcRenderer.invoke("codeRunner", payload),
    codeSubmit: (payload) => ipcRenderer.invoke("codeSubmit", payload),

    getTemplate: (data) => ipcRenderer.invoke("get-template", data),
    getRuntimes: () => ipcRenderer.invoke("get-runtimes"),

    getProblemById: (problemId) => ipcRenderer.invoke("get-problem-by-id", problemId),

});

// Expose ipcRenderer for event listeners like toast notifications
contextBridge.exposeInMainWorld("electron", {
    ipcRenderer: {
        on: (channel, handler) => ipcRenderer.on(channel, handler),
        removeListener: (channel, handler) => ipcRenderer.removeListener(channel, handler),
    },
});
