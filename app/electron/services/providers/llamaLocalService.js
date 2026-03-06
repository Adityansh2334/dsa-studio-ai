
const axios = require("axios");
const {checkLlamaServer, startLlamaServer, stopLlamaServer, waitForLlamaReady} = require("../aiConfig/llamaService");

/* ---------- GENERATION ---------- */
async function generateWithLlama(userId, prompt, modelKey, _temp) {
    async function callLlama() {
        let temp = 0.4;
        if(_temp){
            temp = _temp;
        }
        const res = await axios.post(
            "http://127.0.0.1:8249/v1/chat/completions",
            {
                model: "local-model",
                messages: [
                    {
                        role: "system",
                        content:
                            "You are generating structured data for a software system. Your response will be parsed by code. If you do not follow the format EXACTLY, the response will be REJECTED."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: temp,
                max_tokens: 7000
            },
            { timeout: 1000 * 60 * 10 }
        );

        return res.data.choices[0].message.content;
    }

    // 🔁 Ensure correct server/model before first try
    const state = await checkLlamaServer(modelKey);

    if (!state.running) {
        await startLlamaServer(modelKey);
        await waitForLlamaReady();
    } else if (!state.correctModel) {
        await stopLlamaServer();
        await startLlamaServer(modelKey);
        await waitForLlamaReady();
    }

    try {
        // 🟢 FIRST TRY
        return await callLlama();
    } catch (err1) {
        console.warn("⚠️ Llama HTTP failed. Retrying once...", err1.message);

        try {
            // 🟡 RETRY SAME CALL (sometimes axios just glitches)
            return await callLlama();
        } catch (err2) {
            console.warn("⚠️ Retry failed. Restarting Llama server...", err2.message);

            try {
                // 🔴 HARD RECOVERY: restart llama
                await stopLlamaServer();
                await startLlamaServer(modelKey);
                await waitForLlamaReady();

                // 🟣 FINAL RETRY after restart
                return await callLlama();
            } catch (err3) {
                console.error("❌ Llama completely unresponsive:", err3.message);
                throw new Error("Local AI server not responding after recovery attempts");
            }
        }
    }
}


async function generateWithLlamaStream(userId, prompt, model, options = {}) {
    const { stream = false, onToken = null } = options;

    const response = await fetch("http://127.0.0.1:8249/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.4,
            stream
        })
    });

    if (!stream) {
        const json = await response.json();
        return json.choices[0].message.content;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter(l => l.startsWith("data:"));

        for (const line of lines) {
            const data = line.replace("data:", "").trim();
            if (data === "[DONE]") return;

            try {
                const json = JSON.parse(data);
                const token = json.choices?.[0]?.delta?.content;
                if (token && onToken) onToken(token);
            } catch {}
        }
    }
}

module.exports = {
    generateWithLlama,
    generateWithLlamaStream
};
