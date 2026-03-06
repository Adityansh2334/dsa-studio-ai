

function buildCorrectionPrompt(originalPrompt, badOutput) {

    const separatorStart = "===PROBLEM_START===";
    const separatorEnd = "===PROBLEM_END===";

    return `
Your previous response FAILED validation.

You must FIX the format and regenerate correctly.

DO NOT change the problem idea.
DO NOT add explanations outside the template.
DO NOT generate JSON structure output.
ONLY output valid structured data.

BROKEN OUTPUT:
----------------
${badOutput || "EMPTY RESPONSE"}
----------------

REQUIRED FORMAT (STRICT):

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
<starter template for Java>

PYTHON_STARTER:
<starter template for Python>

JAVASCRIPT_STARTER:
<starter template for JavaScript>

CSHARP_STARTER:
<starter template for C#>

TIME:
O(...)

SPACE:
O(...)

DIFFICULTY:
<difficulty level>

PATTERN:
<pattern name>

${separatorEnd}

CRITICAL RULES:

1. Headers must match EXACTLY
2. No markdown symbols
3. No extra text before or after separators
4. All sections mandatory
5. Java & Python must be complete
6. Example must be inside PROBLEM
7. STARTER templates MUST match function signature from solutions.
8. STARTER templates MUST NOT contain logic.
9. STARTER templates MUST contain TODO comment.
10. STARTER templates MUST contain placeholder return only.
11. NO main method or driver code in STARTER templates.
12. Java starter must use class Solution.
13. Python starter must use class Solution.
14. C# starter must use public class Program with static method.
15. JavaScript starter must use function syntax.
16. STARTER templates must compile.

Now FIX the response.
`;
}

/* ======================================================
   ROBUST SECTION PARSER
   (Extended for STARTER templates)
====================================================== */
function parseSections(text) {
    const sections = {};
    let currentKey = null;

    const HEADER_REGEX =
        /^(TITLE|PROBLEM|CONSTRAINTS|HINTS|JAVA|PYTHON|JAVA_STARTER|PYTHON_STARTER|JAVASCRIPT_STARTER|CSHARP_STARTER|SOLUTION_EXPLANATION|TIME|SPACE|DIFFICULTY|PATTERN):$/i;

    const INLINE_REGEX =
        /^(TITLE|PROBLEM|CONSTRAINTS|HINTS|JAVA|PYTHON|JAVA_STARTER|PYTHON_STARTER|JAVASCRIPT_STARTER|CSHARP_STARTER|SOLUTION_EXPLANATION|TIME|SPACE|DIFFICULTY|PATTERN):\s*(.+)$/i;

    for (const rawLine of text?.split("\n") || []) {
        const line = rawLine.trim();

        // Exact header line
        if (HEADER_REGEX.test(line)) {
            currentKey = line.replace(":", "").toUpperCase();
            sections[currentKey] = [];
            continue;
        }

        // Inline header (e.g., TITLE: Something)
        const inlineMatch = line.match(INLINE_REGEX);
        if (inlineMatch) {
            currentKey = inlineMatch[1].toUpperCase();
            sections[currentKey] = [inlineMatch[2]];
            continue;
        }

        // Collect content
        if (currentKey) {
            sections[currentKey].push(rawLine);
        }
    }

    return sections;
}

function sanitizeLLMOutput(raw) {
    if (!raw) return "";

    let text = String(raw);

    // =====================================================
    // 0️⃣ EXTRACT JAVA & PYTHON BLOCKS (PROTECT THEM)
    // =====================================================

    const protectedBlocks = {};
    let blockIndex = 0;

    text = text.replace(
        /(JAVA:\s*[\s\S]*?)(?=\n(?:PYTHON|TIME|SPACE|DIFFICULTY|PATTERN):|\n*$)/gi,
        (match) => {
            const key = `__JAVA_BLOCK_${blockIndex++}__`;
            protectedBlocks[key] = match;
            return key;
        }
    );

    text = text.replace(
        /(PYTHON:\s*[\s\S]*?)(?=\n(?:JAVA|TIME|SPACE|DIFFICULTY|PATTERN):|\n*$)/gi,
        (match) => {
            const key = `__PYTHON_BLOCK_${blockIndex++}__`;
            protectedBlocks[key] = match;
            return key;
        }
    );

    // =====================================================
    // 1️⃣ Remove code fences (outside protected blocks)
    // =====================================================

    text = text.replace(/```(?:java|python)?/gi, "");
    text = text.replace(/```/g, "");

    // =====================================================
    // 2️⃣ Remove markdown garbage (outside code blocks)
    // =====================================================

    text = text.replace(/[*#]/g, "");

    // =====================================================
    // 3️⃣ Normalize bad header names
    // =====================================================

    const fixes = [
        [/QUESTION/gi, "PROBLEM"],
        [/JAVA\s*CODE/gi, "JAVA"],
        [/PYTHON\s*CODE/gi, "PYTHON"],
        [/SOLUTION\s*EXPLANATION/gi, "SOLUTION_EXPLANATION"],
        [/TIME\s*COMPLEXITY/gi, "TIME"],
        [/SPACE\s*COMPLEXITY/gi, "SPACE"],
    ];

    fixes.forEach(([r, v]) => text = text.replace(r, v));

    // =====================================================
    // 4️⃣ Force headers to be on their own line
    // =====================================================

    text = text.replace(
        /(TITLE|PROBLEM|CONSTRAINTS|HINTS|SOLUTION_EXPLANATION|JAVA|PYTHON|TIME|SPACE|DIFFICULTY|PATTERN):\s*/gi,
        "\n$1:\n"
    );

    // =====================================================
    // 5️⃣ Trim before TITLE
    // =====================================================

    const lines = text.split("\n");
    const start = lines.findIndex(l => /^TITLE:/i.test(l.trim()));
    if (start !== -1) {
        text = lines.slice(start).join("\n");
    }

    // =====================================================
    // 6️⃣ Force Example to live inside PROBLEM
    // =====================================================

    (function enforceExampleInsideProblem() {
        const lines = text.split("\n");

        let result = [];
        let inProblem = false;
        let collectingExample = false;
        let exampleBuffer = [];

        for (let line of lines) {
            const trimmed = line.trim();

            if (/^PROBLEM:/i.test(trimmed)) {
                inProblem = true;
                result.push(line);
                continue;
            }

            if (/^EXAMPLE:?/i.test(trimmed)) {
                collectingExample = true;
                exampleBuffer.push("Example:");
                continue;
            }

            if (
                collectingExample &&
                /^(CONSTRAINTS|HINTS|SOLUTION_EXPLANATION|JAVA|PYTHON|TIME|SPACE|DIFFICULTY|PATTERN):/i.test(trimmed)
            ) {
                if (inProblem && exampleBuffer.length) {
                    result.push(...exampleBuffer);
                    exampleBuffer = [];
                }
                collectingExample = false;
            }

            if (collectingExample) {
                exampleBuffer.push(line);
                continue;
            }

            result.push(line);
        }

        if (inProblem && exampleBuffer.length) {
            result.push(...exampleBuffer);
        }

        text = result.join("\n");
    })();

    // =====================================================
    // 7️⃣ RESTORE JAVA & PYTHON BLOCKS (UNTOUCHED)
    // =====================================================

    Object.entries(protectedBlocks).forEach(([key, value]) => {
        text = text.replace(key, value);
    });

    return text.trim();
}

module.exports = {
        sanitizeLLMOutput,
        parseSections,
        buildCorrectionPrompt
};