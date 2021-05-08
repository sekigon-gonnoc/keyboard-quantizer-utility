# keyboard-quantizer-utility
Change default layer of keyboard quantizer or QMK enabled keyboard depends on active application.

## Configuration

```
{
  "keyboards": [
    {
      "label": "kq",                            // Arbitrary label.
      "productName": "keyboard_quantizer",
      "vid": "0xfeed",
      "pid": "0x9999"
    }
  ],
  "applications" [
    "path": ["C:\\Windows\\System32\\cmd.exe"], // Application path
    "title": [                                  // String in title bar
      "**"                                      // Wild card is available
    ],
    "layer" : [
      "kq-0": 0,                                // Default layer setting.
      "kq-*": 0,                                // Key is a label defined in keyboards section followed by device id.
    ]
  ]
}
```

## QMK Firmware

Add following code to your keyboard.c

```c
#ifdef VIA_ENABLE
#include "via.h"
void raw_hid_receive_kb(uint8_t *data, uint8_t length) {
    uint8_t command_id = data[0];
    uint8_t *command_data = &(data[1]);

    if (command_id == id_set_keyboard_value && command_data[0] == 0x99) {
        // Set default layer
        if (command_data[1] < DYNAMIC_KEYMAP_LAYER_COUNT)
        {
            default_layer_set(1 << command_data[1]);
        }
    }
    else if (command_id == id_get_keyboard_value && command_data[0] == 0x99) {
        // Return device id
        // TODO: Save and read device id from eeprom
        const uint8_t device_id = 0;
        command_data[1] = device_id;
    }
}
#endif
```

## Build

```bash
    yarn install
    # Start app
    yarn start
    # Build App
    yarn build
    # If you get errors, try electron- rebuild
    yarn run electron-rebuild
```
