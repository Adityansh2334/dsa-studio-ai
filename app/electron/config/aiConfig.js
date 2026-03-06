const crypto = require("crypto");
const os = require("os");

/**
 * Derive a stable 32-byte secret from:
 *  - machine hostname
 *  - OS username
 *  - app-specific salt
 *
 * This works in dev, prod, and packaged exe.
 */
function deriveSecret() {
    const machine = os.hostname();
    const user = os.userInfo().username;
    const salt = "DSA_SELF_PREPARE_2026_SECURE_SALT";

    return crypto
        .createHash("sha256")
        .update(machine + user + salt)
        .digest(); // 32 bytes
}

const SECRET = deriveSecret();
const ALGO = "aes-256-gcm";

/**
 * Encrypt AI key
 */
function encrypt(text) {
    if (!text) return null;

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGO, SECRET, iv);

    const encrypted = Buffer.concat([
        cipher.update(text, "utf8"),
        cipher.final()
    ]);

    const tag = cipher.getAuthTag();

    // iv + tag + encrypted
    return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

/**
 * Decrypt AI key
 */
function decrypt(payload) {
    if (!payload) return null;

    const buffer = Buffer.from(payload, "base64");

    const iv = buffer.subarray(0, 12);
    const tag = buffer.subarray(12, 28);
    const data = buffer.subarray(28);

    const decipher = crypto.createDecipheriv(ALGO, SECRET, iv);
    decipher.setAuthTag(tag);

    return decipher.update(data, null, "utf8") + decipher.final("utf8");
}

module.exports = {
    encrypt,
    decrypt
};
