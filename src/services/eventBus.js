const { EventEmitter } = require("events");

const bus = new EventEmitter();
bus.setMaxListeners(100);

function emitAppEvent(type, payload = {}) {
  bus.emit("event", {
    type,
    payload,
    timestamp: new Date().toISOString()
  });
}

module.exports = { bus, emitAppEvent };
