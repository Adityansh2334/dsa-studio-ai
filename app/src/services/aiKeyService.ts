// src/services/aiKeyService.ts

type AIKeys = {
    openRouterKey: string;
    hfKey?: string;
    ollamaModel?: string;
    mode: "online" | "offline";
    provider: "openrouter" | "hf" | "llama";
};

/**
 * Check if AI keys are already configured (prod)
 * or available via env (dev handled internally)
 * @returns Promise<boolean> true if at least one AI key is configured
 */
export async function isAIConfigured(): Promise<boolean> {
    if (!window.api?.checkAIKeys) {
        console.warn("checkAIKeys API not available");
        return false;
    }
    try {
        const hasKeys = await window.api.checkAIKeys();
        return Boolean(hasKeys);
    } catch (error) {
        console.error("Error checking AI keys:", error);
        return false;
    }
}

/**
 * Save AI keys securely (encrypted, main process)
 */
export async function saveAIKeys(keys: AIKeys): Promise<void> {
    if (!window.api?.saveAIKeys) {
        throw new Error("saveAIKeys API not available");
    }

    await window.api.saveAIKeys({
        openRouterKey: keys.openRouterKey,
        hfKey: keys.hfKey || "",
        ollamaModel: keys.ollamaModel || "",
        mode: keys.mode,
        provider: keys.provider
    });
}
