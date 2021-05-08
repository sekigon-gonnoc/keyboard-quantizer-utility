const electron = require("electron");
const Store = require("electron-store");
const activeWindow = require("active-win");
const HID = require("node-hid");
const micromatch = require("micromatch");

const store = new Store();
let tray = null;
let targetWindow = null;
let disabled = false;

store.set("appName", "Keyboard Quantizer Utility");
if (!store.get("keyboards")) {
  store.set("keyboards", [
    {
      label: "kq",
      productName: "keyboard_quantizer",
      vid: "0xfeed",
      pid: "0x9999",
    },
    {
      label: "mq",
      productName: "mouse_quantizer",
      vid: "0xfeed",
      pid: "0x3999",
    },
  ]);
}

if (!store.get("applications")) {
  store.set("applications", [
    {
      path: "**",
      title: "**",
      layer: {
        "kq-*": 0,
        "mq-*": 0,
      },
    },
  ]);
}

const trayIcon = `${__dirname}/trayIcon.${
  process.platform === "win32" ? "ico" : "png"
}`;

const trayIconDisabled = `${__dirname}/trayIconDisabled.${
  process.platform === "win32" ? "ico" : "png"
}`;

const isQmkKeyboard = (k, d) => {
  return (
    d.vid ===
      `0x${("0000" + k.vendorId.toString(16)).slice(-4).toLowerCase()}` &&
    d.pid ===
      `0x${("0000" + k.productId.toString(16)).slice(-4).toLowerCase()}` &&
    k.usagePage == 0xff60 &&
    k.usage == 0x61
  );
};

electron.app.on("ready", () => {
  if (process.platform === "darwin") {
    electron.app.dock.hide();
  }
  tray = new electron.Tray(trayIcon);
  tray.setContextMenu(
    electron.Menu.buildFromTemplate([
      {
        label: "Config",
        click: () => {
          electron.shell.showItemInFolder(
            `${electron.app.getPath("userData")}/config.json`
          );
        },
      },
      {
        label: "Disable",
        type: "checkbox",
        checked: false,
        click: (e) => {
          disabled = e.checked;
          tray.setImage(disabled ? trayIconDisabled : trayIcon);
        },
      },
      {
        label: "Homepage",
        click: () => {
          electron.shell.openExternal("https://github.com/sekigon-gonnoc");
        },
      },
      {
        type: "separator",
      },
      {
        label: "Exit",
        role: "quit",
      },
    ])
  );

  setInterval(() => {
    if (disabled) {
      return;
    }
    try {
      const win = activeWindow.sync();

      const kbds = HID.devices().reduce((prev, k) => {
        let kb = store.get("keyboards")?.find((d) => isQmkKeyboard(k, d));
        if (kb) {
          kb.path = k.path;
          return prev.concat(kb);
        } else {
          return prev;
        }
      }, []);

      if (win?.owner?.path) {
        tray.setToolTip(win.owner.path);

        if (
          targetWindow?.owner?.path !== win.owner.path ||
          targetWindow?.title != win.title
        ) {
          targetWindow = win;
          console.log(
            `Active window changed.\n\tpath:${win.owner.path}, title:${win.title}`
          );
          const app = store.get("applications")?.find((a) => {
            return (
              micromatch.isMatch(targetWindow.owner.path.toString(), a.path) &&
              micromatch.isMatch(targetWindow.title.toString(), a.title)
            );
          });

          if (app) {
            console.log(`Rule is found`);
            console.log("\t", app);
            kbds.forEach((kb) => {
              const qkb = new HID.HID(kb.path);

              // read id command
              qkb.write([0x00, 0x02, 0x99]);
              const data = qkb.readTimeout(1000);
              if (data[0] == 0x02 && data[1] == 0x99) {
                const kbLabel = kb.label + `-${data[2]}`;
                console.log(`Device  ${kbLabel}`);

                const key = Object.keys(app.layer).find((k) =>
                  micromatch.isMatch(kbLabel, k.toString())
                );

                // set default layer
                qkb.write([0x00, 0x03, 0x99, app.layer[key]]);
                console.log(`Set default layer to ${app.layer[key]}`);
              }
              qkb.close();
            });
          }
        }
      }
    } catch (e) {
      console.error(e);
      electron.app.quit();
    }
  }, 100);
});
