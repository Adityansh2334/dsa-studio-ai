
function buildVisualizationPrompt(data) {

    const retryInstruction = data.retryMode
        ? `
CRITICAL RETRY MODE:
Your previous response was INVALID.

You MUST:
- Follow schema exactly
- Provide numeric comparison values
- Provide visualization states
- Provide at least 5 detailed steps
- Do NOT omit any fields
`
        : "";

    return `
You are a senior Data Structures and Algorithms expert and visualization educator.

Your task is to generate algorithm visualization data for an interactive learning platform.

The output will be used to render animated diagrams in UI.

${retryInstruction}

====================
INPUT
====================

Problem:
${data.problemText}

Solution Explanation:
${data.solutionExplanation}

Code:
${data.code}

====================
OUTPUT FORMAT (STRICT JSON ONLY)
====================

Return ONLY valid JSON.
NO markdown.
NO backticks.
NO comments.
NO explanations outside JSON.

Schema:

{
  "pattern": "string",

  "pattern_explanation": "string",

  "when_to_use": "string",

  "pattern_visualization": {
    "type": "string",
    "states": [
      {
        "label": "string",
        "description": "string",
        "data": {}
      }
    ]
  },

  "complexity": {
    "time": "string",
    "space": "string"
  },

  "chartData": [
    { "n": number, "operations": number }
  ],

  "comparison": [
    {
      "name": "string",
      "complexity": "string",
      "value": number
    }
  ],

  "steps": [
    "string"
  ],

  "execution_flow": [
    {
      "step": number,
      "action": "string",
      "state": {}
    }
  ],

  "insights": [
    "string"
  ],

  "diagram": "string",

  "explanation": "string"
}

====================
PATTERN VISUALIZATION RULES (VERY IMPORTANT)
====================

pattern_visualization.type MUST be one of:

- sliding_window
- two_pointers
- tree
- graph
- dynamic_programming
- array
- generic

states MUST describe how the pattern works visually.

Template Example:

"pattern_visualization": {
  "type": "sliding_window",
  "states": [
    {
      "label": "Initialize window",
      "description": "Start with window covering first element",
      "data": {
        "windowStart": 0,
        "windowEnd": 0
      }
    }
  ]
}

====================
EXECUTION FLOW RULES (VERY IMPORTANT)
====================

execution_flow must describe exact algorithm procedure.

Each step should include:

- action (what algorithm does)
- state (data structure changes)

Template Example:

{
  "step": 1,
  "action": "Insert element into heap",
  "state": {
    "heap": [5,3,1]
  }
}

Minimum 5 steps required.

This will be used for animation.

====================
COMPARISON RULES
====================

comparison.value MUST be numeric.

Higher number = slower.

====================
STEPS RULES
====================

Steps MUST:

1. Minimum 5 steps
2. Sequential execution
3. Explain internal logic
4. Beginner friendly
5. Animation ready

====================
CHART DATA RULES
====================

chartData represents growth:

X-axis = input size (n)
Y-axis = operations

====================
DIAGRAM RULES
====================

diagram should be ASCII when applicable.

If not applicable → return "".

====================
MANDATORY QUALITY RULES
====================

1. insights ≥ 3 items
2. explanation must be detailed
3. pattern_explanation must describe internal working
4. DO NOT write:
   - unavailable
   - N/A
   - not applicable
5. JSON must parse correctly

If rules are violated response will be rejected.

ONLY RETURN JSON.
`;
}

function validateVisualization(data) {

    if (!data) return false;

    /* ======================
       STEPS
    ====================== */

    if (!Array.isArray(data.steps))
        return false;

    if (data.steps.length < 2)
        return false;

    const meaningfulSteps =
        data.steps.some(
            s =>
                s &&
                s.length > 10 &&
                !s.toLowerCase().includes("unavailable")
        );

    if (!meaningfulSteps) return false;

    /* ======================
       COMPLEXITY
    ====================== */

    if (!data.complexity?.time)
        return false;

    /* ======================
       EXPLANATION
    ====================== */

    if (!data.explanation ||
        data.explanation.length < 20)
        return false;

    /* ======================
       PATTERN VISUALIZATION
    ====================== */

    if (
        data.pattern_visualization &&
        (
            !data.pattern_visualization.type ||
            !Array.isArray(data.pattern_visualization.states)
        )
    ) {
        return false;
    }

    /* ======================
       EXECUTION FLOW
    ====================== */

    if (
        data.execution_flow &&
        !Array.isArray(data.execution_flow)
    ) {
        return false;
    }

    /* ======================
       COMPARISON
    ====================== */

    if (data.comparison && Array.isArray(data.comparison)) {

        const validComparison =
            data.comparison.some(
                c =>
                    c &&
                    typeof c.value === "number" &&
                    c.value > 0
            );

        if (!validComparison) return false;
    }

    /* ======================
       CHART DATA
    ====================== */

    if (data.chartData && Array.isArray(data.chartData)) {

        const validChart =
            data.chartData.some(
                p =>
                    typeof p.n === "number" &&
                    typeof p.operations === "number"
            );

        if (!validChart) return false;
    }

    /* ======================
       DIAGRAM
    ====================== */

    if (data.diagram && data.diagram.trim().length < 3)
        return false;

    if (!data.pattern_explanation || data.pattern_explanation.length < 10)
        return false;

    if (!data.when_to_use || data.when_to_use.length < 10)
        return false;

    return true;
}

function sanitizeAIResponse(text) {

    if (!text) return "";

    let cleaned = text.trim();

    /* =========================
       REMOVE CODE FENCES
    ========================= */

    cleaned = cleaned
        .replace(/```json/gi, "")
        .replace(/```/g, "");

    /* =========================
       REMOVE LEADING TEXT BEFORE {
    ========================= */

    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (firstBrace !== -1 && lastBrace !== -1) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }

    /* =========================
       REMOVE TRAILING COMMAS
    ========================= */

    cleaned = cleaned.replace(/,\s*}/g, "}");
    cleaned = cleaned.replace(/,\s*]/g, "]");

    /* =========================
       REMOVE INVALID CHARACTERS
    ========================= */

    cleaned = cleaned.replace(/[\u0000-\u001F]+/g, "");

    /* =========================
       FIX EXTRA CLOSING BRACES
    ========================== */

    while (cleaned.endsWith("}}")) {
        try {
            JSON.parse(cleaned);
            break;
        } catch {
            cleaned = cleaned.slice(0, -1);
        }
    }

    return cleaned.trim();
}

function normalizeVisualization(data) {

    const diagram =
        typeof data.diagram === "string" &&
        data.diagram.includes("\n")
            ? data.diagram
            : "";

    return {

        pattern: data.pattern || "",

        pattern_explanation:
            data.pattern_explanation || "",

        when_to_use:
            data.when_to_use || "",

        pattern_visualization:
            data.pattern_visualization || {
                type: "generic",
                states: []
            },

        complexity:
            data.complexity || {},

        chartData:
            Array.isArray(data.chartData)
                ? data.chartData
                : [],

        comparison:
            Array.isArray(data.comparison)
                ? data.comparison
                : [],

        steps:
            Array.isArray(data.steps)
                ? data.steps
                : [],

        execution_flow:
            Array.isArray(data.execution_flow)
                ? data.execution_flow
                : [],

        insights:
            Array.isArray(data.insights)
                ? data.insights
                : [],

        diagram,

        explanation:
            data.explanation || ""
    };
}

module.exports ={
    buildVisualizationPrompt,
    normalizeVisualization,
    validateVisualization,
    sanitizeAIResponse
}