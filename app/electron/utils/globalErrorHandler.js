const fs = require("fs");

let log;

function initGlobalErrorHandler(logger) {
    log = logger;

    process.on("uncaughtException", (err) => {
        handle("UNCAUGHT_EXCEPTION", err);
    });

    process.on("unhandledRejection", (reason) => {
        handle("UNHANDLED_REJECTION", reason);
    });

    process.on("warning", (w) => {
        handle("NODE_WARNING", w);
    });
}

function handle(type, err) {
    const message = err?.stack || err?.message || String(err);

    if (log) {
        console.error(`[GLOBAL ${type}]`, message);
    } else {
        console.error(`[GLOBAL ${type}]`, message);
    }
}

module.exports = { initGlobalErrorHandler };
