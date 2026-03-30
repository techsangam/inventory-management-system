require("dotenv").config();
const { connectDatabase } = require("./config/db");
const { app } = require("./app");

const port = process.env.PORT || 4000;

async function startServer() {
  try {
    await connectDatabase();
    app.listen(port, () => {
      console.log(`Inventory Management System running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Failed to start server", error);
    process.exit(1);
  }
}

startServer();
