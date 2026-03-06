const { runSingleTest } = require("./testExecutor");
const { evaluateSubmission } = require("./aiWorks/aiEvaluator");
const {detectLanguage} = require("./utils/languageDetector");

/**
 * ======================================================
 * RUN CODE (Console Output Only)
 * ======================================================
 */
async function runCode({ language, code, problemId}) {
    try {
        if (!language) {
            language = detectLanguage(code);
        }
        console.log("RUN CODE EXECUTED WITH LANG: ", language);
        const result = await runSingleTest({
            language,
            userCode: code,
            problemId
        });

        return {
            success: true,
            stdout: result.stdout,
            stderr: result.stderr,
            error: result.error,
            combined: result.combined,
        };

    } catch (err) {

        return {
            success: false,
            error: err.message
        };

    }
}


/**
 * ======================================================
 * SUBMIT CODE (Full Evaluation)
 * ======================================================
 */
async function submitCode({
                              language,
                              code,
                              problem,
                              userId
                          }) {
    try {
        console.log("RUN SUBMIT EXECUTED WITH LANG: ", language);
        const evaluation = await evaluateSubmission({
            language,
            code,
            problem,
            userId
        });

        console.log("EVALUATION :::::: ", evaluation);

        return evaluation;

    } catch (err) {

        return {
            success: false,
            error: err.message
        };

    }
}


/**
 * ======================================================
 */

module.exports = {
    runCode,
    submitCode
};