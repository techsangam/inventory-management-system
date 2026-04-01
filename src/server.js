require("dotenv").config();
const { connectDatabase, disconnectDatabase } = require("./config/db");
const { app } = require("./app");

let serverInstance = null;

async function startServer(customPort = process.env.PORT || 4000) {
  if (serverInstance) {
    return serverInstance;
  }

  await connectDatabase();

  await new Promise((resolve, reject) => {
    const instance = app.listen(customPort, () => {
      serverInstance = instance;
      console.log(`Inventory Management System running on http://localhost:${customPort}`);
      resolve();
    });

    instance.on("error", reject);
  });

  return serverInstance;
}

async function stopServer() {
  if (serverInstance) {
    await new Promise((resolve, reject) => {
      serverInstance.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    serverInstance = null;
  }

  await disconnectDatabase();
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error("Failed to start server", error);
    process.exit(1);
  });
}

module.exports = { startServer, stopServer };
