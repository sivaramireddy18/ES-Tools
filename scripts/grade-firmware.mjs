#!/usr/bin/env node
/**
 * Headless Post-Silicon Autograding Harness
 * Usage: node scripts/grade-firmware.mjs <path-to-firmware.wasm>
 */

import fs from "fs";
import path from "path";

const wasmPath = process.argv[2] || "public/firmware/student_firmware.wasm";

console.log("=================================================");
console.log("  EMBEDDED SYSTEMS VALIDATION AUTOGRADER v3.0");
console.log(`  Testing Target: ${wasmPath}`);
console.log("=================================================\n");

if (!fs.existsSync(wasmPath)) {
  console.error(`[ERROR] File not found: ${wasmPath}`);
  process.exit(1);
}

const wasmBuffer = fs.readFileSync(wasmPath);

// Create 1024-byte bus memory
const bus = new Uint8Array(1024);

const imports = {
  env: {
    __js_gpio_write: (pin, state) => {
      bus[pin & 0x07] = state ? 1 : 0;
    },
    __js_gpio_read: (pin) => {
      const idx = pin & 0x07;
      return idx >= 4 ? (bus[idx + 4] > 0 ? 1 : 0) : (bus[idx] > 0 ? 1 : 0);
    },
    __js_delay_ms: () => {},
    __js_millis: () => 100,
    __js_adc_read: () => 128,
    __js_yield: () => {},
    putchar: () => {},
    puts: () => {},
  },
};

async function runGrade() {
  try {
    const wasmModule = await WebAssembly.compile(wasmBuffer);
    const instance = await WebAssembly.instantiate(wasmModule, imports);
    const exports = instance.exports;

    let passedTests = 0;
    const totalTests = 4;

    console.log("[TEST 1/4] Running setup() initialization routine...");
    if (typeof exports.setup === "function") {
      exports.setup();
      console.log("  ✓ setup() executed without trap fault.");
      passedTests++;
    } else {
      console.log("  ⚠ setup() export not found, checking loop/tick only.");
    }

    const runTick = typeof exports.loop === "function" ? exports.loop : exports.tick;

    if (!runTick) {
      console.error("  ✕ Fatal: No loop() or tick() function exported.");
      process.exit(1);
    }

    console.log("\n[TEST 2/4] Verifying GPIO Input SW0 (Pin 4) -> LED0 (Pin 0) Mapping...");
    // Set SW0 HIGH (byte 8 = 1)
    bus[8] = 1;
    bus[0] = 0;
    runTick();
    if (bus[0] === 1) {
      console.log("  ✓ LED0 asserted when SW0 is HIGH.");
      passedTests++;
    } else {
      console.log(`  ✕ Expected Pin 0 to be 1, got ${bus[0]}`);
    }

    console.log("\n[TEST 3/4] Verifying GPIO Input SW1 (Pin 5) -> LED1 (Pin 1) Mapping...");
    bus[9] = 1;
    bus[1] = 0;
    runTick();
    if (bus[1] === 1) {
      console.log("  ✓ LED1 asserted when SW1 is HIGH.");
      passedTests++;
    } else {
      console.log(`  ✕ Expected Pin 1 to be 1, got ${bus[1]}`);
    }

    console.log("\n[TEST 4/4] Verifying Clearing DIP Switch SW0 -> LED0 Clears...");
    bus[8] = 0;
    runTick();
    if (bus[0] === 0) {
      console.log("  ✓ LED0 deasserted when SW0 is LOW.");
      passedTests++;
    } else {
      console.log(`  ✕ Expected Pin 0 to be 0, got ${bus[0]}`);
    }

    const score = Math.round((passedTests / totalTests) * 100);
    console.log("\n=================================================");
    console.log(`  FINAL GRADE: ${score}% (${passedTests}/${totalTests} PASS)`);
    console.log("=================================================");

    if (score >= 75) {
      console.log("  STATUS: PASS ✓ (Post-Silicon Validation Approved)");
    } else {
      console.log("  STATUS: FAIL ✕ (Logic Error in DUT Firmware)");
    }
  } catch (err) {
    console.error(`\n[FATAL TRAP EXCEPTION] ${err.message}`);
    process.exit(1);
  }
}

runGrade();
