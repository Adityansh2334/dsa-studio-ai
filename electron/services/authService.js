const db = require("./database/database");
const bcrypt = require("bcryptjs");
const dayjs = require("dayjs");

function registerUser({ name, email, phone, password }) {
    const hash = bcrypt.hashSync(password, 10);

    const stmt = db.prepare(`
        INSERT INTO users (name, email, phone, password_hash)
        VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(name, email, phone, hash);

    return {
        id: result.lastInsertRowid,
        name,
        email,
        phone
    };
}

function loginUser({ email, password }) {
    const user = db
        .prepare(`SELECT * FROM users WHERE email = ?`)
        .get(email);

    if (!user) throw new Error("USER_NOT_FOUND");

    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) throw new Error("INVALID_PASSWORD");

    const now = dayjs();
    const expires = now.add(15, "day");

    db.prepare(`
        UPDATE users
        SET last_login_at = ?, session_expires_at = ?
        WHERE id = ?
    `).run(now.toISOString(), expires.toISOString(), user.id);

    return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        createdOn: user.created_at,
    };
}

module.exports = { registerUser, loginUser };
