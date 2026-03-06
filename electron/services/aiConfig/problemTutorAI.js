const { generateTutorLLM} = require("./aiRouter");

async function askProblemTutorAI({
                                     userId,
                                     problem,
                                     question,
                                     onToken = null
                                 }) {
    const prompt = buildTutorPrompt(problem, question);

    try {
        return await generateTutorLLM(userId, prompt, {
            stream: true,
            onToken
        });
    } catch (error) {
        console.error("Tutor AI error:", error);
        return "Unable to generate response. Please try again later.";
    }
}

function buildTutorPrompt(problem, question) {
    return `
You are a DSA tutor helping a student understand ONE specific problem.

You are NOT allowed to create new problems.
You are NOT allowed to give generic DSA theory.
You must ONLY answer the user's question related to this problem.

Here is the problem:

TITLE:
${problem.title}

PROBLEM:
${problem.problem}

CONSTRAINTS:
${problem.constraints}

HINTS:
${problem.hints.join("\n")}

SOLUTION EXPLANATION:
${problem.solution.explanation}

JAVA:
${problem.solution.java}

PYTHON:
${problem.solution.python}

USER QUESTION:
${question}

RULES:
- Answer briefly and clearly
- Refer only to this problem
- If question is unrelated, say:
  "This question is outside the scope of this problem."
- If you provide SQL, code, or any script, you MUST wrap it in triple backticks and specify the language.
    Example:
    \`\`\`sql
    SELECT * FROM table;
`;
}

module.exports = { askProblemTutorAI };
