const os = require("os");
const fs = require("fs/promises");
const path = require("path");
const mongoose = require("mongoose");

let memoryServer = null;

function getEmbeddedDbPath() {
  return path.join(os.homedir(), ".inventory-management-system", "mongo-data");
}

async function startEmbeddedMongo() {
  const { MongoMemoryServer } = require("mongodb-memory-server");
  const dbPath = process.env.EMBEDDED_MONGO_DB_PATH || getEmbeddedDbPath();

  if (memoryServer) {
    return memoryServer.getUri();
  }

  await fs.mkdir(dbPath, { recursive: true });

  memoryServer = await MongoMemoryServer.create({
    instance: {
      dbName: "inventory_management",
      dbPath
    }
  });

  return memoryServer.getUri();
}

async function connectDatabase() {
  const explicitMongoUri = process.env.MONGO_URI;
  const defaultMongoUri = "mongodb://127.0.0.1:27017/inventory_management";
  const mongoUri = explicitMongoUri || defaultMongoUri;
  const allowEmbedded =
    process.env.USE_EMBEDDED_MONGO === "true" ||
    (!explicitMongoUri && process.env.NODE_ENV !== "production");

  mongoose.set("strictQuery", true);

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000
    });
    console.log(`Connected to MongoDB at ${mongoUri}`);
    return;
  } catch (error) {
    if (!allowEmbedded) {
      throw error;
    }

    console.warn(
      `MongoDB at ${mongoUri} is unavailable. Starting embedded MongoDB for local development.`
    );

    const embeddedUri = await startEmbeddedMongo();
    await mongoose.connect(embeddedUri, {
      serverSelectionTimeoutMS: 5000
    });
    console.log(`Connected to embedded MongoDB at ${embeddedUri}`);
  }
}

async function disconnectDatabase() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

module.exports = { connectDatabase, disconnectDatabase };
