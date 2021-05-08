const electron = require("electron");
const Store = require("electron-store");
const activeWindow = require("active-win");
const HID = require("node-hid");
const micromatch = require("micromatch");

const store = new Store();
let tray = null;
let targetWindow = null;

store.set("AppName", "Keyboard Quantizer Utility");

const trayIcon = `${__dirname}/trayIcon.${process.platform === "win32" ? "ico" : "png"
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
          electron.shell.openExternal(
            `${electron.app.getPath("userData")}/config.json`
          );
        },
      },
      {
        label: "Homepage",
        click: () => {
          electron.shell.openExternal("https://github.com/sekigon-gonnoc");
        },
      },
      {
        label: "Exit",
        role: "quit",
      },
    ])
  );

  setInterval(() => {
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
          console.log("Active window changed");
          const app = store.get("application")?.find((a) => {
            return (
              micromatch.isMatch(targetWindow.owner.path.toString(), a.path) &&
              micromatch.isMatch(targetWindow.title.toString(), a.title)
            );
          });

          if (app) {
            kbds.forEach((kb) => {
              const qkb = new HID.HID(kb.path);
              qkb.on('data', (data) => {
                console.log(`receive:`, data);
                if (data[0] == 0x02 && data[1] == 0x99) {

                  const kbLabel = kb.label + `-${data[2]}`;
                  console.log(`Device  ${kbLabel}`);

                  const key = Object.keys(app.layer).find((k) =>
                    micromatch.isMatch(
                      kbLabel,
                      k.toString()
                    )
                  );

                  // set default layer
                  qkb.write([0x00, 0x03, 0x99, app.layer[key]]);
                }
                else if (data[0] == 0x03 && data[1] == 0x99) {
                  console.log(`Set default layer ${data[2]}`);
                  qkb.close();
                  // console.log("device closed");
                }
                else if (data[0] == 0xff) {
                  // unhandled
                  qkb.close();
                  // console.log("device closed");
                }
              });

              qkb.on('error', (data)=>{console.log(`error ${data}`)});

              // read id command
              qkb.write([0x00, 0x02, 0x99]);

            });
          }
        }
      }
    }
    catch (e) {
      console.error(e);
      electron.app.quit();
    }
  }, 100);
});
