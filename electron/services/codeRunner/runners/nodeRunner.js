const { executeSandbox } = require("../sandbox/sandbox");
const { EXECUTION_LIMITS, RUNTIMES } = require("../utils/constants");

/**
 * =========================================
 * Execute Node Code (Sandboxed)
 * =========================================
 */

async function runNode(code, input = "") {

    try {

        const result = await executeSandbox({

            command: RUNTIMES.node,
            args: ["main.js"],

            files: [
                {
                    name: "main.js",
                    content: code
                }
            ],

            input,
            timeout: EXECUTION_LIMITS.timeout,
            memoryMB: EXECUTION_LIMITS.memory
        });

        return {
            success: !result.error && !result.stderr,
            stdout: result.stdout || "",
            stderr: result.stderr || "",
            error: result.error || null,
            combined: result.combined || null,
        };

    } catch (err) {

        return {
            success: false,
            stdout: "",
            stderr: "",
            error: err.message
        };

    }
}


/**
 * =========================================
 */

module.exports = {
    runNode,
};