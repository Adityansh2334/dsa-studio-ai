const fs = require("fs");
const CryptoJS = require("crypto-js");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { app } = require("electron");


// ensure folder exists
const userDataPath = path.join(app.getPath("appData"), "DSA-Self-Prepare-Models", "db");
if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
}

let ENC_PATH = path.join(userDataPath, "dsa.enc");
const TMP_DB = path.join(os.tmpdir(), "dsa.tmp.db");

// derive key from machine
function getMachineKey() {
    const id = os.hostname() + os.userInfo().username;
    return crypto.createHash("sha256").update(id).digest("hex");
}

function decryptDBIfExists() {
    if (!fs.existsSync(ENC_PATH)) return;

    const encrypted = fs.readFileSync(ENC_PATH, "utf8");
    const bytes = CryptoJS.AES.decrypt(encrypted, getMachineKey());
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);

    fs.writeFileSync(TMP_DB, Buffer.from(decrypted, "base64"));
}

async function encryptAndSaveDB() {
    if (!fs.existsSync(TMP_DB)) return;

    const dbData = fs.readFileSync(TMP_DB);
    const base64 = dbData.toString("base64");

    const encrypted = CryptoJS.AES.encrypt(base64, getMachineKey()).toString();
    fs.writeFileSync(ENC_PATH, encrypted);

    fs.unlinkSync(TMP_DB);
}

module.exports = {
    TMP_DB,
    decryptDBIfExists,
    encryptAndSaveDB
};
