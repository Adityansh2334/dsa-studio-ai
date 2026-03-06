const { EventEmitter } = require("events");

/**
 * Global event bus for streaming problems from workers → main → renderer
 * @type {EventEmitter}
 */
const problemStream = new EventEmitter();

module.exports = problemStream;
