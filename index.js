const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");

// شغل الخادم
require("./server");

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
      icon: path.join(__dirname, 'astaas/icon.ico'), // حدد مسار الأيقونة هنا
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false,
    },
  });

  win.loadURL("http://localhost:3000");
}

// إعداد الحدث للتعامل مع عرض رسالة التنبيه
ipcMain.handle("show-dialog", async (event, message) => {
  const options = {
    type: "info",
    buttons: ["OK"],
    title: "تنبيه",
    message: message,
  };
  await dialog.showMessageBox(options);
});

app.on("ready", createWindow);

// =============================================***=================
// const { app, BrowserWindow, dialog, ipcMain } = require("electron");
// const path = require("path");

// require("./server"); // تأكد من أن ملف server.js هو اسم الملف الصحيح

// function createWindow() {
//   const win = new BrowserWindow({
//     width: 800,
//     height: 600,
//     webPreferences: {
//       nodeIntegration: true,
//       contextIsolation: false,
//       preload: path.join(__dirname, "preload.js"), // ربط الـ preload
//     },
//   });
//    win.webContents.openDevTools();

//   win.loadURL("http://localhost:3000");
// }

// app.on("ready", createWindow);

// // إعداد الحدث لعرض رسالة التنبيه عبر dialog
// ipcMain.on("show-dialog", (event, { type, title, message }) => {
//   dialog.showMessageBox({
//     type: type,
//     title: title,
//     message: message,
//     buttons: ["OK"],
//   });
// });

// const { app, BrowserWindow } = require("electron");
// const path = require("path");

// // شغل الخادم
// require("./server"); // تأكد من أن ملف server.js هو اسم الملف الصحيح

// function createWindow() {
//   const win = new BrowserWindow({
//     width: 800,
//     height: 600,
//     webPreferences: {
//       nodeIntegration: true,
//       contextIsolation: false,
//     },
//   });

//   win.loadURL("http://localhost:3000"); // إذا كان التطبيق يعتمد على خادم Express يعمل على المنفذ 3000
//   // win.webContents.openDevTools();
// }

// app.on("ready", createWindow);
