const path=require("path");
const { app, BrowserWindow }=require("electron");
const { spawn }=require("child_process");
const http=require("http");

let serverProcess;
const PORT=process.env.PORT||4000;
const SERVER_URL=`http://localhost:${PORT}`;

function waitForServer(retries=40){
  return new Promise((resolve,reject)=>{
    const attempt=()=>{
      http.get(`${SERVER_URL}/api/health`,(res)=>{
        res.resume();
        resolve();
      }).on("error",()=>{
        if(retries<=0){reject(new Error("Server did not start in time"));return;}
        retries-=1;
        setTimeout(attempt,500);
      });
    };
    attempt();
  });
}

async function createWindow(){
  const win=new BrowserWindow({
    width:1440,
    height:920,
    minWidth:1100,
    minHeight:760,
    backgroundColor:"#f4efe7",
    webPreferences:{ contextIsolation:true }
  });
  await win.loadURL(SERVER_URL);
}

app.whenReady().then(async()=>{
  serverProcess=spawn(process.execPath,[path.join(__dirname,"..","src","server.js")],{
    cwd:path.join(__dirname,".."),
    stdio:"inherit",
    env:{ ...process.env, PORT:String(PORT) }
  });
  await waitForServer();
  await createWindow();
  app.on("activate",()=>{ if(BrowserWindow.getAllWindows().length===0){ createWindow(); } });
});

app.on("window-all-closed",()=>{ if(process.platform!=="darwin") app.quit(); });
app.on("before-quit",()=>{ if(serverProcess){ serverProcess.kill(); } });
