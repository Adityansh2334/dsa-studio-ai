const { executeSandbox } = require("../sandbox/sandbox");

const { EXECUTION_LIMITS, RUNTIMES } = require("../utils/constants");

/**
 * =========================================
 * Execute Python Code (Sandboxed)
 * =========================================
 */

async function runPython(code, input = "") {

    try {

        const result = await executeSandbox({

            command: RUNTIMES.python,   // bundled python runtime
            args: ["main.py"],

            files: [
                {
                    name: "main.py",
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
    runPython,
};