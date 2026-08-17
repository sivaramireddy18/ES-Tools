import fs from "fs";
import path from "path";

function encodeSection(sectionId, payload) {
  return [sectionId, payload.length, ...payload];
}

function createFirmwareBinary(labNumber) {
  // Types:
  // Type 0: (i32, i32) -> () [__js_gpio_write]
  // Type 1: () -> ()         [setup, loop]
  const typePayload = [
    0x02,
    0x60, 0x02, 0x7f, 0x7f, 0x00,
    0x60, 0x00, 0x00
  ];
  const typeSection = encodeSection(1, typePayload);

  // Import: env.__js_gpio_write
  const importPayload = [
    0x01,
    0x03, 0x65, 0x6e, 0x76,
    0x0f, ...Buffer.from("__js_gpio_write"),
    0x00, 0x00
  ];
  const importSection = encodeSection(2, importPayload);

  // Functions: setup (Type 1), loop (Type 1)
  const funcPayload = [0x02, 0x01, 0x01];
  const funcSection = encodeSection(3, funcPayload);

  // Exports: setup, loop
  const exportPayload = [
    0x02,
    0x05, ...Buffer.from("setup"), 0x00, 0x01,
    0x04, ...Buffer.from("loop"), 0x00, 0x02
  ];
  const exportSection = encodeSection(7, exportPayload);

  let loopBody = [];
  if (labNumber === 1) {
    // Lab 1: Blinky Pin 0 -> __js_gpio_write(0, 1)
    loopBody = [
      0x41, 0x00,
      0x41, 0x01,
      0x10, 0x00
    ];
  } else if (labNumber === 2) {
    // Lab 2: Heartbeat Pin 2 -> __js_gpio_write(2, 1)
    loopBody = [
      0x41, 0x02,
      0x41, 0x01,
      0x10, 0x00
    ];
  } else {
    // Lab 3: UART Echo / Pin 0 & Pin 2 active
    loopBody = [
      0x41, 0x00, 0x41, 0x01, 0x10, 0x00,
      0x41, 0x02, 0x41, 0x01, 0x10, 0x00
    ];
  }

  const loopCodeBytes = [0x00, ...loopBody, 0x0b];
  const setupCodeBytes = [0x00, 0x0b];

  const codePayload = [
    0x02,
    setupCodeBytes.length, ...setupCodeBytes,
    loopCodeBytes.length, ...loopCodeBytes
  ];
  const codeSection = encodeSection(10, codePayload);

  const fullWasm = [
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
    ...typeSection,
    ...importSection,
    ...funcSection,
    ...exportSection,
    ...codeSection
  ];

  return Buffer.from(fullWasm);
}

const dir = path.join(process.cwd(), "public", "firmware");
fs.writeFileSync(path.join(dir, "lab1_blinky.wasm"), createFirmwareBinary(1));
fs.writeFileSync(path.join(dir, "lab2_heartbeat.wasm"), createFirmwareBinary(2));
fs.writeFileSync(path.join(dir, "lab3_uart_echo.wasm"), createFirmwareBinary(3));
console.log("Pre-compiled firmware binaries successfully generated in public/firmware/");
