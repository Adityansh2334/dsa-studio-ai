const axios = require("axios");
const { app } = require("electron");

const isDev = !app.isPackaged;
const { getDecryptedKeysForUser } = require("../aiConfig/keyService");

class OpenRouterError extends Error {
    constructor(message, { status, originalError, isQuotaError = false } = {}) {
        super(message);
        this.name = 'OpenRouterError';
        this.status = status;
        this.originalError = originalError;
        this.isQuotaError = isQuotaError;
    }
}


async function generateWithOpenRouter(userId, prompt, _temp) {
    try {
        // Load API key from encrypted storage
        const keys = getDecryptedKeysForUser(userId);

        let temp = 0.4;
        if(_temp){
            temp = _temp;
        }

        if (!keys?.openRouterKey) {
            throw new Error("OpenRouter API key not configured for this user");
        }

        const res = await axios.post(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                model: "mistralai/mistral-7b-instruct",
                messages: [{ role: "user", content: prompt }],
                temperature: temp
            },
            {
                headers: {
                    Authorization: `Bearer ${keys.openRouterKey}`,
                    "HTTP-Referer": "https://dsa-self-prepare",
                    "X-Title": "DSA Self Prepare"
                },
                timeout: 60_000
            }
        );

        const responseData = res.data;
        
        // Debug log the full response in development
        if (isDev) {
            console.log('[OpenRouter Debug] Full response:', JSON.stringify(responseData, null, 2));
        }

        if (!responseData) {
            throw new OpenRouterError('No response data received from OpenRouter');
        }
        
        if (!Array.isArray(responseData.choices) || responseData.choices.length === 0) {
            throw new OpenRouterError(
                'No choices in OpenRouter response', 
                { 
                    status: 200,
                    originalError: isDev ? new Error('Empty choices array in response') : undefined
                }
            );
        }
        
        const firstChoice = responseData.choices[0];
        if (!firstChoice?.message?.content) {
            throw new OpenRouterError(
                'Invalid message format in OpenRouter response',
                {
                    status: 200,
                    originalError: isDev ? new Error(`Invalid response format: ${JSON.stringify(firstChoice)}`) : undefined
                }
            );
        }
        
        return firstChoice.message.content;
    } catch (error) {
        // If it's already an OpenRouterError, just rethrow it
        if (error.name === 'OpenRouterError') {
            if (isDev) {
                console.error('[OpenRouter Error]', {
                    message: error.message,
                    status: error.status,
                    originalError: error.originalError,
                    stack: error.stack
                });
            }
            throw error;
        }

        // Handle rate limiting
        // Handle quota / billing errors
        if (
            error.response?.status === 429 ||
            error.response?.status === 402 ||
            error.response?.data?.error?.type === "insufficient_quota" ||
            error.response?.data?.error?.message?.toLowerCase().includes("quota")
        ) {
            const quotaError = new OpenRouterError(
                "Your OpenRouter quota has been exhausted. Please renew or update your API key.",
                {
                    status: error.response?.status,
                    isQuotaError: true,
                    originalError: isDev ? error : undefined
                }
            );

            throw quotaError;
        }


        // Handle other API errors
        if (error.response?.data?.error) {
            const errorMessage = isDev 
                ? `OpenRouter API error: ${error.response.data.error.message || 'Unknown error'}`
                : 'OpenRouter API error';
                
            const apiError = new OpenRouterError(
                errorMessage,
                {
                    status: error.response?.status,
                    originalError: isDev ? error : undefined
                }
            );
            throw apiError;
        }

        // Handle network errors and other unexpected errors
        const errorMessage = isDev 
            ? `Failed to generate response: ${error.message}`
            : 'Failed to generate response';
            
        throw new OpenRouterError(errorMessage, {
            status: error.response?.status,
            originalError: isDev ? error : undefined
        });
    }
}

async function validateOpenRouterApiKey(apiKey) {
    try {
        await axios.post(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                model: "mistralai/mistral-7b-instruct",
                messages: [{ role: "user", content: "Hello" }],
                max_tokens: 5
            },
            {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "HTTP-Referer": "https://dsa-self-prepare",
                    "X-Title": "DSA Self Prepare"
                },
                timeout: 15000
            }
        );

        return { valid: true };

    } catch (err) {

        if (err.response?.status === 401) {
            return { valid: false, reason: "Invalid API key" };
        }

        if (
            err.response?.status === 402 ||
            err.response?.data?.error?.type === "insufficient_quota"
        ) {
            return { valid: false, reason: "Quota exhausted" };
        }

        return { valid: false, reason: "Please check your API key and try again." };
    }
}


async function generateWithOpenRouterStream(userId, prompt, options = {}) {
    const { onToken = null } = options;

    try {
        const keys = getDecryptedKeysForUser(userId);

        if (!keys?.openRouterKey) {
            throw new Error("OpenRouter API key not configured for this user");
        }

        const response = await fetch(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${keys.openRouterKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "mistralai/mistral-7b-instruct",
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.4,
                    stream: true
                })
            }
        );

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`OpenRouter error: ${errText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");

        let buffer = "";
        let fullContent = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split("\n");

            // keep last partial line in buffer
            buffer = lines.pop();

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
                    // ignore incomplete JSON
                }
            }
        }

        return fullContent;

    } catch (err) {
        console.error("OpenRouter stream failed:", err);
        throw err;
    }
}


module.exports = { generateWithOpenRouter, validateOpenRouterApiKey , generateWithOpenRouterStream };
