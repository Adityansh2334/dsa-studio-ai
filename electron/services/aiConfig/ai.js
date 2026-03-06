const { generateLLM } = require("./aiRouter");
const db = require("../database/database");

/* ======================================================
   REGENERATE SOLUTION ONLY (STRICT FIX)
====================================================== */
async function regenerateSolution(userId,
    problemText,
    previousSolution,
    pattern,
    difficulty
) {


    const prompt = `
You are a senior DSA instructor.

The following problem is CORRECT.
The previous solution is WRONG or INCOMPLETE.

Your task:
- Fix the solution
- Produce COMPLETE, PRODUCTION-READY code
- Do NOT repeat the problem statement

Problem:
${problemText}

Previous incorrect solution:
${previousSolution}

Pattern: ${pattern}
Difficulty: ${difficulty}

STRICT RULES:
- Java must be complete and compilable
- Python must be runnable
- NO placeholders
- NO TODO
- NO markdown
- NO JSON

FORMAT EXACTLY:

SOLUTION_EXPLANATION:
...

JAVA:
...

PYTHON:
...

TIME:
...

SPACE:
...

DIFFICULTY:
...

PATTERN:
...
`;

    return await generateLLM(
        userId,
        prompt,
        0.4,
        {
            type: "regenerate_solution",            // important for worker routing
            forceRegenerate: false,
            meta: {},                    // send full payload to worker if needed
            retryCount: 6                   // worker retry attempts
        }
    );


}

function getStyleInstruction(style = "product") {
    const s = style.toLowerCase();

    if (s.includes("faang")) {
        return "Focus on optimal solutions, tricky edge cases, and deep reasoning.";
    }

    if (s.includes("startup")) {
        return "Focus on practical implementation and real-world scenarios.";
    }

    if (s.includes("service")) {
        return "Use standard DSA questions with moderate difficulty.";
    }

    if (s.includes("system")) {
        return "Include scalability thinking and design considerations.";
    }

    return "Use balanced product-company interview difficulty.";
}


function getCompanyInstruction(company) {
    if (!company || company.toLowerCase() === "generic") return "";

    const c = company.toLowerCase();

    if (c.includes("amazon")) {
        return "Emphasize constraints, edge cases, and scalable thinking.";
    }

    if (c.includes("google")) {
        return "Emphasize algorithm depth and mathematical reasoning.";
    }

    if (c.includes("meta")) {
        return "Include data structure design and optimization.";
    }

    if (c.includes("microsoft")) {
        return "Focus on clean implementation and correctness.";
    }

    return `Mimic interview style commonly seen in ${company}.`;
}

async function generateProblemBatch(userId, batchSpecs, mode = "normal", isForceGenerate= false) {
    const separatorStart = "===PROBLEM_START===";
    const separatorEnd = "===PROBLEM_END===";

    /* --------------------------------------------------
       FETCH USER PREF + PROVIDER (same as single)
    -------------------------------------------------- */
    const row = db.prepare(`
        SELECT ai_provider FROM user_ai_keys WHERE user_id = ?
    `).get(userId);

    if (!row) throw new Error("User not authenticated");

    const pref = db.prepare(`
        SELECT * FROM user_preferences WHERE user_id = ?
    `).get(userId) || {};

    /* --------------------------------------------------
       BUILD MODE HINT (same logic as generateProblem)
    -------------------------------------------------- */

    const interviewContext =
        mode === "interview"
            ? `
Interview Style: ${pref.interview_style || "product"}
Company: ${pref.interview_company || "Generic"}
Role: ${pref.interview_role || "Software Engineer"}
Experience: ${pref.interview_experience || "1-3 years"}

Guidance:
${getStyleInstruction(pref.interview_style)}
${getCompanyInstruction(pref.interview_company)}

Adjust difficulty according to experience level.
`
            : "";

    const modeHint =
        mode === "interview"
            ? `
This is INTERVIEW MODE.

Goals:
- Simulate realistic technical interview questions
- Encourage optimal thinking and edge case awareness
- Require reasoning similar to real interview pressure

${interviewContext}
`
            : `
This is LEARNING MODE.
- Be beginner friendly
- Use simple English
- Focus on intuition
`;

    /* --------------------------------------------------
       BUILD SPEC TEXT
    -------------------------------------------------- */
    const specText = batchSpecs.map((b, i) => `
    Problem #${i + 1}
    Pattern: ${b.pattern}
    Difficulty: ${b.difficulty}
    `).join("\n");

    /* --------------------------------------------------
       PROVIDER-AWARE PROMPT (LLAMA vs CLOUD)
    -------------------------------------------------- */
    const entropy = Math.floor(Math.random() * 100000);

    const prompt = `
RandomSeed: ${entropy}

You are generating ONLY STRUCTURED TEXT for a software system.

This is NOT a normal chat response.
This is MACHINE-PARSED DATA.

DO NOT GENERATE JSON STRUCTURED DATA.

${modeHint}

You must generate ${batchSpecs.length} COMPLETELY DIFFERENT DSA problems.

════════════════════════════════════════════

FOR EACH PROBLEM YOU MUST FOLLOW EXACTLY:

You MUST begin response with:
${separatorStart}

TITLE:
<one line title>

PROBLEM:
<clear problem description>

Example:
Input: <input>
Output: <output>
Explanation: <why output is correct>

CONSTRAINTS:
<2 to 4 realistic constraints>

HINTS:
- <hint 1>
- <hint 2>

SOLUTION_EXPLANATION:
<step by step explanation>

JAVA:
<complete working Java code>

PYTHON:
<complete working Python code>

JAVA_STARTER:
<starter template for Java with test variable>

PYTHON_STARTER:
<starter template for Python with test variable>

JAVASCRIPT_STARTER:
<starter template for JavaScript with test variable>

CSHARP_STARTER:
<starter template for C# with test variable>

TIME:
O(...)

SPACE:
O(...)

DIFFICULTY:
<difficulty level as per given in prompt>

PATTERN:
<pattern name as per given in prompt>

You MUST end response with:
${separatorEnd}


════════════════════════════════════════════

ABSOLUTE RULES (NON-NEGOTIABLE):

1. Header names must be EXACTLY as per Template
2. Do NOT rename headers.
3. Do NOT skip headers.
4. Do NOT add new headers.
5. Do NOT use markdown symbols (###, **, \`\`\`, -, etc).
6. Do NOT generate JSON output.
7. Do NOT add any text before ${separatorStart}
8. Do NOT add any text after ${separatorEnd}
9. Example section is MANDATORY inside PROBLEM.
10. Each problem must be unique and non-textbook.
11. STARTER templates MUST match function signature from solutions.
12. STARTER templates MUST NOT contain logic.
13. STARTER templates MUST contain TODO comment.
14. STARTER templates MUST contain placeholder return only.
15. NO main method or driver code in STARTER templates.
16. Java starter must use class Solution.
17. Python starter must use class Solution.
18. C# starter must use public class Program with static method.
19. JavaScript starter must use function syntax.
20. STARTER templates must compile.

If you violate ANY rule above, the response becomes useless.

Requirements for problems:
${specText}
`;

    return await generateLLM(
        userId,
        prompt,
        0.4,
        {
            type: "problem_batch",            // important for worker routing
            forceRegenerate: isForceGenerate,
            meta: {},                    // send full payload to worker if needed
            retryCount: 8,                   // worker retry attempts
            separatorStart: separatorStart,
            separatorEnd: separatorEnd
        }
    );
}

/* ======================================================
   EXPORTS
====================================================== */
module.exports = {
    regenerateSolution,
    generateProblemBatch
};
