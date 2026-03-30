const AuditLog = require("../models/AuditLog");
const { emitAppEvent } = require("./eventBus");

async function createAuditLog({
  req,
  userId,
  action,
  entityType,
  entityId = "",
  metadata = {}
}) {
  const log = await AuditLog.create({
    user: userId || req?.user?._id,
    action,
    entityType,
    entityId: entityId ? String(entityId) : "",
    metadata,
    ip: req?.ip || "",
    userAgent: req?.headers?.["user-agent"] || ""
  });

  emitAppEvent("audit.created", {
    action,
    entityType,
    entityId,
    userId: userId || req?.user?._id
  });

  return log;
}

module.exports = { createAuditLog };
