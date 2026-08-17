import fs from "fs";
import path from "path";

/**
 * Helper to encode a WASM section with its ID and length
 */
function encodeSection(sectionId, payload) {
  return [sectionId, payload.length, ...payload];
}

/**
 * Builds a complete WebAssembly binary representing student firmware:
 * 1. Imports:
 *    - env.__js_gpio_write(pin, state) -> func 0
 *    - env.__js_gpio_read(pin) -> state -> func 1
 * 2. Exports:
 *    - setup() -> func 2
 *    - loop() -> func 3
 * 3. Logic in loop():
 *    - Read Switch 0 (Pin 4) -> Write to LED 0 (Pin 0)
 *    - Read Switch 1 (Pin 5) -> Write to LED 1 (Pin 1)
 *    - Read Switch 2 (Pin 6) -> Write to LED 2 (Pin 2)
 *    - Read Switch 3 (Pin 7) -> Write to LED 3 (Pin 3)
 */
function createStudentFirmwareBinary() {
  // ── Types:
  // Type 0: (i32, i32) -> () [__js_gpio_write]
  // Type 1: (i32) -> (i32)    [__js_gpio_read]
  // Type 2: () -> ()         [setup, loop]
  const typePayload = [
    0x03, // 3 type entries
    0x60, 0x02, 0x7f, 0x7f, 0x00, // Type 0: (i32, i32) -> ()
    0x60, 0x01, 0x7f, 0x01, 0x7f, // Type 1: (i32) -> (i32)
    0x60, 0x00, 0x00              // Type 2: () -> ()
  ];
  const typeSection = encodeSection(1, typePayload);

  // ── Imports:
  // Import 0: env.__js_gpio_write (func 0, type 0)
  // Import 1: env.__js_gpio_read  (func 1, type 1)
  const importPayload = [
    0x02, // 2 imports
    0x03, 0x65, 0x6e, 0x76, // "env"
    0x0f, ...Buffer.from("__js_gpio_write"), // "__js_gpio_write"
    0x00, 0x00,             // kind: func, type 0

    0x03, 0x65, 0x6e, 0x76, // "env"
    0x0e, ...Buffer.from("__js_gpio_read"), // "__js_gpio_read"
    0x00, 0x01              // kind: func, type 1
  ];
  const importSection = encodeSection(2, importPayload);

  // ── Functions: 2 local functions (setup: func 2, loop: func 3), both Type 2
  const funcPayload = [
    0x02, // 2 functions
    0x02, // func 2 uses Type 2
    0x02  // func 3 uses Type 2
  ];
  const funcSection = encodeSection(3, funcPayload);

  // ── Exports: "setup" (func 2) and "loop" (func 3)
  const exportPayload = [
    0x02, // 2 exports
    0x05, ...Buffer.from("setup"), 0x00, 0x02,
    0x04, ...Buffer.from("loop"), 0x00, 0x03
  ];
  const exportSection = encodeSection(7, exportPayload);

  // ── Code:
  // setup() body
  const setupBody = [0x00, 0x0b]; // 0 locals, end
  const setupFunc = [setupBody.length, ...setupBody];

  // loop() body
  const loopOpcodes = [
    0x00, // 0 locals

    // Pin 0 <= Read Pin 4
    0x41, 0x00, // i32.const 0 (target LED 0)
    0x41, 0x04, // i32.const 4 (source SW 0)
    0x10, 0x01, // call __js_gpio_read
    0x10, 0x00, // call __js_gpio_write

    // Pin 1 <= Read Pin 5
    0x41, 0x01, // i32.const 1 (target LED 1)
    0x41, 0x05, // i32.const 5 (source SW 1)
    0x10, 0x01, // call __js_gpio_read
    0x10, 0x00, // call __js_gpio_write

    // Pin 2 <= Read Pin 6
    0x41, 0x02, // i32.const 2 (target LED 2)
    0x41, 0x06, // i32.const 6 (source SW 2)
    0x10, 0x01, // call __js_gpio_read
    0x10, 0x00, // call __js_gpio_write

    // Pin 3 <= Read Pin 7
    0x41, 0x03, // i32.const 3 (target LED 3)
    0x41, 0x07, // i32.const 7 (source SW 3)
    0x10, 0x01, // call __js_gpio_read
    0x10, 0x00, // call __js_gpio_write

    0x0b // end opcode
  ];
  const loopFunc = [loopOpcodes.length, ...loopOpcodes];

  const codePayload = [
    0x02, // 2 function bodies
    ...setupFunc,
    ...loopFunc
  ];
  const codeSection = encodeSection(10, codePayload);

  const fullWasm = [
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, // Header
    ...typeSection,
    ...importSection,
    ...funcSection,
    ...exportSection,
    ...codeSection
  ];

  return Buffer.from(fullWasm);
}

const outPath = path.join(process.cwd(), "public", "firmware", "student_firmware.wasm");
const binary = createStudentFirmwareBinary();
fs.writeFileSync(outPath, binary);
console.log(`Generated: ${outPath} (${binary.length} bytes)`);
