const fs = require("fs");
const path = require("path");
const { app, BrowserWindow, dialog } = require("electron");
const { startServer, stopServer } = require("../src/server");

app.commandLine.appendSwitch("no-sandbox");
app.commandLine.appendSwitch("disable-gpu-sandbox");
app.disableHardwareAcceleration();

const PORT = Number(process.env.PORT || 4310);
const SERVER_URL = `http://localhost:${PORT}`;

process.env.PORT = String(PORT);
process.env.USE_EMBEDDED_MONGO = process.env.USE_EMBEDDED_MONGO || "true";

let splashWindow = null;
let mainWindow = null;
let logFilePath = "";

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  if (!logFilePath) {
    return;
  }
  fs.appendFileSync(logFilePath, `${line}\n`);
}

function buildStartupHtml(title, message) {
  return `data:text/html;charset=utf-8,${encodeURIComponent(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>${title}</title>
        <style>
          body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: Segoe UI, sans-serif; background: linear-gradient(180deg, #f6f1ea 0%, #efe6da 100%); color: #15232a; }
          .card { width: min(520px, calc(100vw - 40px)); padding: 28px; border-radius: 24px; background: rgba(255, 250, 244, 0.94); box-shadow: 0 24px 60px rgba(16, 36, 44, 0.12); }
          h1 { margin: 0 0 12px; font-size: 28px; }
          p { margin: 0; line-height: 1.55; white-space: pre-wrap; }
          .dot { width: 14px; height: 14px; border-radius: 999px; background: #126e74; box-shadow: 0 0 0 10px rgba(18, 110, 116, 0.12); margin-bottom: 18px; }
        </style>
      </head>
      <body>
        <section class="card">
          <div class="dot"></div>
          <h1>${title}</h1>
          <p>${message}</p>
        </section>
      </body>
    </html>
  `)}`;
}

async function createSplashWindow() {
  log("Creating splash window");
  splashWindow = new BrowserWindow({
    width: 620,
    height: 420,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    backgroundColor: "#f4efe7",
    center: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  splashWindow.on("closed", () => log("Splash window closed"));

  await splashWindow.loadURL(
    buildStartupHtml(
      "Starting Inventory Management System",
      "Preparing the local server and database. The first launch can take a little longer."
    )
  );

  splashWindow.show();
  splashWindow.focus();
}

async function updateSplash(title, message) {
  log(`Splash update: ${title}`);
  if (!splashWindow || splashWindow.isDestroyed()) {
    return;
  }
  await splashWindow.loadURL(buildStartupHtml(title, message));
  splashWindow.show();
  splashWindow.focus();
}

async function createMainWindow() {
  log(`Creating main window for ${SERVER_URL}`);
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 760,
    backgroundColor: "#f4efe7",
    autoHideMenuBar: true,
    center: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.webContents.on("did-fail-load", (_event, code, description, url) => {
    log(`Main window failed to load: ${code} ${description} ${url}`);
    dialog.showErrorBox("Inventory Management System", `Window failed to load: ${description}`);
  });

  mainWindow.webContents.on("did-finish-load", () => {
    log("Main window finished loading");
    mainWindow.show();
    mainWindow.focus();
  });

  await mainWindow.loadURL(SERVER_URL);
  mainWindow.show();
  mainWindow.focus();
}

app.whenReady().then(async () => {
  logFilePath = path.join(app.getPath("userData"), "startup.log");
  log("Electron ready");
  await createSplashWindow();

  try {
    await updateSplash("Starting Inventory Management System", "Launching the API server and opening your workspace...");
    log("Starting embedded/web server");
    await startServer(PORT);
    log("Server started");
    await updateSplash("Opening workspace", "Almost there...");
    await createMainWindow();
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
    }
  } catch (error) {
    const message = error?.stack || error?.message || String(error);
    log(`Desktop startup failed: ${message}`);
    await updateSplash("Desktop startup failed", message);
    dialog.showErrorBox("Inventory Management System", message);
    return;
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  log("App quitting");
  stopServer().catch((error) => {
    log(`Failed to stop background server: ${error?.stack || error}`);
  });
});
