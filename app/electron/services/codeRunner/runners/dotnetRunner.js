const { executeSandbox } = require("../sandbox/sandbox");
const { EXECUTION_LIMITS, RUNTIMES } = require("../utils/constants");

async function runDotnet(code, input = "") {

    const mono = RUNTIMES.mono.mono;
    const mcs = RUNTIMES.mono.mcs;

    const exeName = "Program.exe";

    try {

        const result = await executeSandbox({

            commands: [

                /**
                 * Compile
                 */
                {
                    command: mono,
                    args: [
                        mcs,
                        "-langversion:latest",
                        "-nologo",
                        "-out:" + exeName,
                        "Program.cs"
                    ]
                },

                /**
                 * Run
                 */
                {
                    command: mono,
                    args: [exeName]
                }

            ],

            files: [
                {
                    name: "Program.cs",
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

module.exports = { runDotnet };