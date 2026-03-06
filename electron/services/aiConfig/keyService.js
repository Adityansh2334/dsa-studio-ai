const db = require("../database/database");
const { decrypt } = require("../../config/aiConfig");

/**
 * Returns decrypted AI keys for a user
 */
function getDecryptedKeysForUser(userId) {
    const row = db.prepare(`
        SELECT openrouter_key, hf_key
        FROM user_ai_keys
        WHERE user_id = ?
    `).get(userId);

    if (!row) return null;

    return {
        openRouterKey: row.openrouter_key
            ? decrypt(row.openrouter_key)
            : null,

        hfKey: row.hf_key
            ? decrypt(row.hf_key)
            : null
    };
}

module.exports = { getDecryptedKeysForUser };
