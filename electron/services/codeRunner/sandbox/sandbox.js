const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const TMP_ROOT = path.join(os.tmpdir(), "dsa-sandbox");

/**
 * ======================================================
 * CONFIG
 * ======================================================
 */

const DEFAULT_LIMITS = {
    timeout: 5000,
    maxBuffer: 1024 * 1024 * 5, // 5MB output
    memoryMB: 256
};

/**
 * ======================================================
 * CREATE TEMP DIRECTORY
 * ======================================================
 */
function createTempDir() {

    if (!fs.existsSync(TMP_ROOT)) {
        fs.mkdirSync(TMP_ROOT, { recursive: true });
    }

    return fs.mkdtempSync(path.join(TMP_ROOT, "run-"));
}


/**
 * ======================================================
 * CLEAN DIRECTORY
 * ======================================================
 */
function cleanup(dir) {
    try {
        fs.rmSync(dir, { recursive: true, force: true });
    } catch {}
}


/**
 * ======================================================
 * FORCE KILL PROCESS TREE (important)
 * ======================================================
 */
function killProcessTree(pid) {

    try {

        if (process.platform === "win32") {
            spawn("taskkill", ["/PID", pid, "/T", "/F"]);
        } else {
            process.kill(-pid, "SIGKILL");
        }

    } catch {}

}


/**
 * ======================================================
 * MEMORY LIMIT WRAPPER (Best Effort)
 * ======================================================
 */
function applyMemoryLimit(command, args, memoryMB) {

    if (process.platform === "linux" || process.platform === "darwin") {

        const limitKB = memoryMB * 1024;

        return {
            command: "bash",
            args: [
                "-c",
                `ulimit -v ${limitKB}; exec ${command} ${args.join(" ")}`
            ]
        };
    }

    return { command, args };
}


/**
 * ======================================================
 * RUN SINGLE COMMAND
 * ======================================================
 */
function runCommand({
                        command,
                        args,
                        cwd,
                        input,
                        timeout,
                        memoryMB,
                        maxBuffer
                    }) {

    return new Promise((resolve) => {

        let stdout = "";
        let stderr = "";
        let finished = false;

        let wrapped = { command, args };

        if (process.platform !== "win32") {
            wrapped = applyMemoryLimit(command, args, memoryMB);
        }

        console.log("EXEC:", wrapped.command, wrapped.args);

        const child = spawn(
            wrapped.command,
            wrapped.args,
            {
                cwd,
                stdio: "pipe",
                shell: false,
                detached: process.platform !== "win32",
                env: {
                    PATH: process.env.PATH
                }
            }
        );

        const timer = setTimeout(() => {

            if (!finished) {
                killProcessTree(child.pid);

                resolve({
                    success: false,
                    stdout,
                    stderr: "Execution timed out",
                    error: "TIMEOUT"
                });
            }

        }, timeout);


        if (input) {
            try {
                child.stdin.write(input);
                child.stdin.end();
            } catch {}
        }


        child.stdout.on("data", (d) => {
            stdout += d.toString();

            if (stdout.length > maxBuffer) {
                killProcessTree(child.pid);

                resolve({
                    success: false,
                    stdout,
                    stderr: "Output limit exceeded",
                    error: "OUTPUT_LIMIT"
                });
            }
        });


        child.stderr.on("data", (d) => {
            stderr += d.toString();

            if (stderr.length > maxBuffer) {
                killProcessTree(child.pid);

                resolve({
                    success: false,
                    stdout,
                    stderr: "Error output too large",
                    error: "OUTPUT_LIMIT"
                });
            }
        });


        child.on("close", (code) => {

            finished = true;
            clearTimeout(timer);

            const out = stripAnsi(stdout.trim());
            const err = stripAnsi(stderr.trim());

            resolve({
                success: code === 0,
                stdout: out,
                stderr: err,
                combined: (out + "\n" + err).trim(),
                error: code === 0 ? null : (err || `Process exited with code ${code}`)
            });
        });


        child.on("error", (err) => {

            finished = true;
            clearTimeout(timer);

            resolve({
                success: false,
                stdout: "",
                stderr: "",
                error: err.message
            });
        });

    });
}


/**
 * ======================================================
 * RUN MULTIPLE COMMANDS (SEQUENTIAL)
 * ======================================================
 */
async function runCommandsSequential({
                                         commands,
                                         cwd,
                                         input,
                                         timeout,
                                         memoryMB,
                                         maxBuffer
                                     }) {

    let lastResult = null;

    for (const cmd of commands) {
        console.log("EXEC:", cmd, cmd.args, cwd);
        lastResult = await runCommand({
            command: cmd.command,
            args: cmd.args || [],
            cwd,
            input,
            timeout,
            memoryMB,
            maxBuffer
        });

        if (lastResult.error || lastResult.stderr) {
            return lastResult;
        }
    }

    return lastResult;
}


/**
 * ======================================================
 * SANDBOX EXECUTION WRAPPER
 * ======================================================
 */
async function executeSandbox({
                                  command,
                                  args = [],
                                  commands = [],   // ✅ NEW (compile + run support)
                                  files = [],
                                  input = "",
                                  timeout = DEFAULT_LIMITS.timeout,
                                  memoryMB = DEFAULT_LIMITS.memoryMB,
                                  maxBuffer = DEFAULT_LIMITS.maxBuffer
                              }) {

    const malicious = detectMaliciousCode(files);

    if (malicious) {
        return {
            success: false,
            stdout: "",
            stderr: "Security violation detected",
            error: "FORBIDDEN_OPERATION"
        };
    }

    const dir = createTempDir();

    try {

        /**
         * WRITE FILES SAFELY
         */
        for (const file of files) {

            if (file.content.length > 1024 * 1024) {
                return {
                    success: false,
                    stdout: "",
                    stderr: "Security violation detected",
                    error: "FORBIDDEN_OPERATION"
                };
            }

            const safeName = path.basename(file.name);
            const filePath = path.join(dir, safeName);

            if (Buffer.isBuffer(file.content)) {
                fs.writeFileSync(filePath, file.content);
            } else {
                fs.writeFileSync(filePath, file.content, "utf8");
            }
        }

        /**
         * EXECUTE
         */
        let result;

        if (Array.isArray(commands) && commands.length > 0) {

            result = await runCommandsSequential({
                commands,
                cwd: dir,
                input,
                timeout,
                memoryMB,
                maxBuffer
            });

        } else {

            result = await runCommand({
                command,
                args,
                cwd: dir,
                input,
                timeout,
                memoryMB,
                maxBuffer
            });

        }

        return result;

    } finally {

        cleanup(dir);

    }

}


function stripAnsi(text = "") {
    return text.replace(/\u001b\[[0-9;]*m/g, "");
}

function detectMaliciousCode(files = []) {

    const dangerousPatterns = [
        /rm\s+-rf/i,
        /del\s+\/f/i,
        /shutdown/i,
        /format\s+/i,
        /child_process/i,
        /process\.kill/i,
        /fork\s*\(/i,
        /Runtime\.getRuntime\(\)\.exec/i,
        /Process\.Start/i,
        /System\.exit/i,
        /while\s*\(\s*true\s*\)/i
    ];

    for (const file of files) {

        const content =
            Buffer.isBuffer(file.content)
                ? file.content.toString()
                : file.content;

        for (const pattern of dangerousPatterns) {
            if (pattern.test(content)) {
                return pattern.toString();
            }
        }
    }

    return null;
}


/**
 * ======================================================
 */

module.exports = {
    executeSandbox
};