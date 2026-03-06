const { EventEmitter } = require("events");

/**
 * Global event bus for streaming problems from workers → main → renderer
 * @type {EventEmitter}
 */
const generationStream = new EventEmitter();

module.exports = generationStream;