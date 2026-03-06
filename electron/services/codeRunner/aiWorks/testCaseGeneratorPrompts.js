function getPrompt(language, problem, userCode) {

    const COMMON_RULES = `
========================================
RESPONSE FORMAT (STRICT — NON NEGOTIABLE)
========================================

You MUST return ONLY a JSON ARRAY.

Structure MUST be EXACTLY:

[
  {
    "variables": [
      "variable declaration 1",
      "variable declaration 2"
    ],
    "expected": "output"
  }
]

RULES:

1. JSON ONLY — NO TEXT BEFORE OR AFTER.
2. NO markdown.
3. NO comments.
4. NO explanations.
5. expected MUST be STRING.
6. variables MUST be ARRAY OF STRINGS.
7. EXACTLY 10 test cases.
8. VARIABLES must be directly executable inside runner.
9. DO NOT include function calls.
10. DO NOT include driver code.
11. DO NOT include console.log / print.
12. DO NOT include object creation UNLESS class is REQUIRED.
13. KEEP values deterministic.
14. MATCH USER CODE PARAMETERS EXACTLY.
15. EXPECTED must match USER CODE behavior.
16. If return is array/object → expected MUST be JSON string.

INVALID EXAMPLE:

[
  {
    "input": ...
  }
]

ONLY variables + expected allowed.

========================================
EXECUTION MODEL
========================================

Platform will:

1. Inject variables into code
2. Automatically call function / class
3. Capture return value
4. Compare with expected

So YOU ONLY provide variable declarations.
`;

    const promptJS = `
You are a PROFESSIONAL coding judge system.

Generate TEST CASES for JavaScript.

${COMMON_RULES}

========================================
LANGUAGE RULES — JAVASCRIPT
========================================

Use ONLY:

let variable = value;

Examples:

let n = 5;
let arr = [1,2,3];
let s = "abc";

DO NOT use var.
DO NOT use const.

========================================
USER CODE
========================================

${userCode}

========================================
PROBLEM
========================================

${problem?.problem || ""}

Constraints:
${problem?.constraints || ""}

Example:
${problem?.exampleInput || ""}
${problem?.exampleOutput || ""}

========================================
FINAL TASK
========================================

Generate 10 deterministic cases:

• normal
• edge
• boundary
• corner

Return ONLY JSON array.
`;

    const promptPython = `
You are a PROFESSIONAL coding judge system.

Generate TEST CASES for Python.

${COMMON_RULES}

========================================
LANGUAGE RULES — PYTHON
========================================

Examples:

n = 5
arr = [1,2,3]
s = "abc"

NO semicolons.
NO print.
NO main block.

========================================
USER CODE
========================================

${userCode}

========================================
PROBLEM
========================================

${problem?.problem || ""}

Constraints:
${problem?.constraints || ""}

Example:
${problem?.exampleInput || ""}
${problem?.exampleOutput || ""}

========================================
FINAL TASK
========================================

Generate 10 deterministic cases.

Return ONLY JSON array.
`;

    const promptJava = `
You are a PROFESSIONAL coding judge system.

Generate TEST CASES for Java.

${COMMON_RULES}

========================================
NUMERIC RULE
========================================

Java int uses 32-bit overflow.
Expected MUST respect overflow behavior.

========================================
LANGUAGE RULES — JAVA (STRICT)
========================================

You MUST use ONLY valid Java syntax.

Examples:

int n = 5;
int[] arr = {1,2,3};
String s = "abc";

Semicolon REQUIRED at end of each line.

========================================
CRITICAL RESULT VARIABLE RULE (MANDATORY)
========================================

The LAST line inside variables MUST assign the output into
a variable named EXACTLY:

result

You MUST include the TYPE of result.

Examples:

Primitive return:
int result = obj.maxProfit(prices);

boolean result = obj.search(word);

Object return:
TreeNode result = obj.buildTree(arr);

List<Integer> result = obj.solve(nums);

If method is static:
int result = Solution.methodName(args);

If class operation:
boolean result = trie.search("apple");

========================================
IMPORTANT EXECUTION MODEL
========================================

The platform will:

1. Inject variables into main()
2. Compile user code
3. Execute program
4. Read printed result

Therefore:

• Variables MUST be directly runnable
• DO NOT include System.out.println
• DO NOT include main()
• DO NOT include driver code
• DO NOT include comments
• DO NOT omit result variable
• DO NOT use var keyword
• ALWAYS include explicit type

========================================
USER CODE (SOURCE OF TRUTH)
========================================

${userCode}

========================================
PROBLEM CONTEXT
========================================

${problem?.problem || ""}

Constraints:
${problem?.constraints || ""}

Example:
${problem?.exampleInput || ""}
${problem?.exampleOutput || ""}

========================================
FINAL TASK
========================================

Generate EXACTLY 10 deterministic test cases.

Each test case MUST follow:

[
  {
    "variables": [
      "Java variable declarations",
      "typed result assignment"
    ],
    "expected": "output"
  }
]

Return ONLY JSON array.
`;

    const promptCSharp = `
You are a PROFESSIONAL coding judge system.

Generate TEST CASES for C#.

${COMMON_RULES}

========================================
NUMERIC RULE
========================================

C# int uses 32-bit overflow.
Expected MUST respect overflow.

========================================
LANGUAGE RULES — C#
========================================

Examples:

int n = 5;
int[] arr = new int[]{1,2,3};
string s = "abc";

Semicolon REQUIRED.

========================================
USER CODE
========================================

${userCode}

========================================
PROBLEM
========================================

${problem?.problem || ""}

Constraints:
${problem?.constraints || ""}

Example:
${problem?.exampleInput || ""}
${problem?.exampleOutput || ""}

========================================
FINAL TASK
========================================

Generate 10 deterministic cases.

Return ONLY JSON array.
`;

    switch (language) {
        case "javascript": return promptJS;
        case "python": return promptPython;
        case "java": return promptJava;
        case "dotnet": return promptCSharp;
        default: throw new Error("Unsupported language");
    }
}

module.exports = {
    getPrompt
};