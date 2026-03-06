const { OpenAI } = require("openai");
const { getDecryptedKeysForUser } = require("../aiConfig/keyService");
const { app } = require("electron");
const axios = require("axios");

const isDev = !app.isPackaged;

class HuggingfaceError extends Error {
    constructor(message, { status, originalError, isQuotaError = false } = {}) {
        super(message);
        this.name = "HuggingfaceError";
        this.status = status;
        this.originalError = originalError;
        this.isQuotaError = isQuotaError;
    }
}

/* ======================================================
   GENERATE USING HUGGINGFACE
====================================================== */
async function generateWithHF(userId, prompt, _temp) {
    try {
        let temp = 0.4;
        if(_temp){
            temp = _temp;
        }
        const keys = getDecryptedKeysForUser(userId);

        if (!keys?.hfKey) {
            throw new HuggingfaceError("HF API key not configured");
        }

        const client = new OpenAI({
            baseURL: "https://router.huggingface.co/v1",
            apiKey: keys.hfKey,
        });

        const response = await client.chat.completions.create({
            model: "mistralai/Mistral-7B-Instruct-v0.2:featherless-ai",
            messages: [{ role: "user", content: prompt }],
            temperature: temp,
            max_tokens: 3000,
        });

        if (isDev) {
            console.log("HF response:", JSON.stringify(response, null, 2));
        }

        if (!response?.choices?.length) {
            throw new HuggingfaceError("No choices in HF response", {
                status: 200,
            });
        }

        const content = response.choices[0]?.message?.content;

        if (!content) {
            throw new HuggingfaceError("Empty HF response content", {
                status: 200,
            });
        }

        return content;

    } catch (error) {

        const status = error?.response?.status;
        const data = error?.response?.data;

        if (isDev) {
            console.error("[HF ERROR FULL]", {
                message: error.message,
                status,
                data,
                stack: error.stack
            });
        }

        /* -----------------------------
           AUTH ERROR
        ----------------------------- */
        if (status === 401) {
            throw new HuggingfaceError(
                "Invalid HuggingFace API key",
                { status }
            );
        }

        /* -----------------------------
           RATE LIMIT
        ----------------------------- */
        if (status === 429) {
            throw new HuggingfaceError(
                "HuggingFace rate limit exceeded",
                { status, isQuotaError: true }
            );
        }

        /* -----------------------------
           BILLING / QUOTA
        ----------------------------- */
        if (
            status === 402 ||
            data?.error?.toLowerCase?.().includes("quota") ||
            data?.error?.toLowerCase?.().includes("limit")
        ) {
            throw new HuggingfaceError(
                "HuggingFace quota exhausted",
                { status, isQuotaError: true }
            );
        }

        /* -----------------------------
           NETWORK OR UNKNOWN
        ----------------------------- */
        throw new HuggingfaceError(
            isDev
                ? `HF generation failed: ${error.message}`
                : "AI generation failed",
            {
                status,
                originalError: isDev ? error : undefined
            }
        );
    }
}

/* ======================================================
   VALIDATE HF KEY
====================================================== */
async function validateHFKey(apiKey) {
    try {
        await axios.get(
            "https://huggingface.co/api/whoami-v2",
            {
                headers: {
                    Authorization: `Bearer ${apiKey}`
                },
                timeout: 8000
            }
        );

        return { valid: true };

    } catch (err) {

        const status = err.response?.status;

        if (status === 401) {
            return { valid: false, reason: "Invalid API key" };
        }

        if (status === 402) {
            return { valid: false, reason: "Quota exhausted" };
        }

        if (status === 429) {
            return { valid: false, reason: "Rate limit exceeded" };
        }

        return { valid: false, reason: "API validation failed" };
    }
}

async function generateWithHFStream(userId, prompt, options = {}) {
    const { onToken = null } = options;

    try {
        const keys = getDecryptedKeysForUser(userId);

        if (!keys?.hfKey) {
            throw new HuggingfaceError("HF API key not configured");
        }

        const response = await fetch(
            "https://router.huggingface.co/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${keys.hfKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "mistralai/Mistral-7B-Instruct-v0.2:featherless-ai",
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.4,
                    max_tokens: 3000,
                    stream: true
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();

            let parsed;
            try {
                parsed = JSON.parse(errorText);
            } catch {
                parsed = { error: errorText };
            }

            const status = response.status;

            if (status === 401) {
                throw new HuggingfaceError("Invalid HuggingFace API key", { status });
            }

            if (status === 429) {
                throw new HuggingfaceError("HuggingFace rate limit exceeded", {
                    status,
                    isQuotaError: true
                });
            }

            if (
                status === 402 ||
                parsed?.error?.toLowerCase?.().includes("quota") ||
                parsed?.error?.toLowerCase?.().includes("limit")
            ) {
                throw new HuggingfaceError("HuggingFace quota exhausted", {
                    status,
                    isQuotaError: true
                });
            }

            throw new HuggingfaceError(
                isDev
                    ? `HF stream failed: ${parsed?.error || errorText}`
                    : "AI generation failed",
                { status }
            );
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");

        let fullContent = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });

            // HF router uses OpenAI-style SSE:
            // data: { ...json... }

            const lines = chunk.split("\n").filter(Boolean);

            for (const line of lines) {
                if (!line.startsWith("data:")) continue;

                const data = line.replace("data:", "").trim();

                if (data === "[DONE]") {
                    return fullContent;
                }

                try {
                    const json = JSON.parse(data);
                    const token = json.choices?.[0]?.delta?.content;

                    if (token) {
                        fullContent += token;
                        if (onToken) onToken(token);
                    }
                } catch (err) {
                    if (isDev) {
                        console.error("HF stream parse error:", err);
                    }
                }
            }
        }

        return fullContent;

    } catch (error) {

        if (isDev) {
            console.error("[HF STREAM ERROR FULL]", error);
        }

        if (error instanceof HuggingfaceError) {
            throw error;
        }

        throw new HuggingfaceError(
            isDev
                ? `HF streaming failed: ${error.message}`
                : "AI generation failed"
        );
    }
}

module.exports = { generateWithHF, validateHFKey, generateWithHFStream };
