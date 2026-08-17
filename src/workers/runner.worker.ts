/**
 * Runner Web Worker — Hardware Execution Engine v3.0
 *
 * Memory Map (1024 bytes):
 *   Bytes 0–7:   GPIO Port A (Output pins / LEDs D0–D7)
 *   Bytes 8–15:  GPIO Port B (Input pins / DIP switches SW0–SW7)
 *   Byte  16:    SysTick 8-bit prescaler
 *   Bytes 17–20: 32-bit system uptime (ms), little-endian
 *   Byte  21:    ADC Channel 0 (simulated analog, 0–255)
 *   Byte  22:    PWM duty cycle register (0–255 = 0%–100%)
 *   Byte  23:    Interrupt flag register (bit-packed)
 *   Bytes 32–63: UART TX circular buffer (32 bytes)
 *   Byte  64:    UART TX write pointer
 *   Bytes 65–96: UART RX circular buffer (32 bytes)
 *   Byte  97:    UART RX read pointer
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RunnerStdoutMessage {
  type: "RUNNER_STDOUT";
  text: string;
  timestamp: string;
}

export interface RunnerSuccessMessage {
  type: "RUN_SUCCESS";
  message: string;
  timestamp: string;
}

export interface RunnerStatusMessage {
  type: "RUNNER_STATUS";
  status: "RUNNING" | "STOPPED" | "ERROR";
  message: string;
  timestamp: string;
}

export interface RunnerGpioUpdateMessage {
  type: "GPIO_UPDATE";
  pin?: number;
  state?: number;
  timestamp: string;
}

export type RunnerOutgoingMessage =
  | RunnerStdoutMessage
  | RunnerSuccessMessage
  | RunnerStatusMessage
  | RunnerGpioUpdateMessage;

// ─── State ───────────────────────────────────────────────────────────────────

let simulationInterval: ReturnType<typeof setInterval> | null = null;
let wasmInterval: ReturnType<typeof setInterval> | null = null;

function clearAllIntervals(): void {
  if (simulationInterval) { clearInterval(simulationInterval); simulationInterval = null; }
  if (wasmInterval) { clearInterval(wasmInterval); wasmInterval = null; }
}

function ts(): string { return new Date().toISOString(); }

function post(msg: RunnerOutgoingMessage): void { self.postMessage(msg); }

// ─── Mock Signal Generators ─────────────────────────────────────────────────

/**
 * MOCK_TEST_PATTERN: 3-channel signal generator
 *  D0 = 30Hz system clock (50% duty)
 *  D1 = 1Hz heartbeat pulse (83ms on, 917ms off)
 *  D2 = UART TX async burst (idle high, 15-tick burst every 2s)
 */
function mockTestPattern(sabView: Uint8Array): void {
  let tick = 0;
  simulationInterval = setInterval(() => {
    sabView[0] = tick % 2;                                       // D0: Clock
    sabView[1] = (tick % 60 < 5) ? 1 : 0;                       // D1: Heartbeat
    sabView[2] = (tick % 120 < 15) ? (Math.random() > 0.5 ? 1 : 0) : 1; // D2: UART burst
    sabView[16] = tick % 256;
    writeUptime(sabView, tick * 16);

    if (tick % 120 === 0) {
      const hex = Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, "0");
      post({ type: "RUNNER_STDOUT", text: `[UART_TX] FRAME: 0x${hex} | CRC: OK`, timestamp: ts() });
    }
    tick++;
  }, 16);
}

/**
 * MOCK_SPI_TRANSFER: Coordinated 3-wire SPI bus
 *  D0 = SCK  (clock, toggles during transfer)
 *  D1 = MOSI (data, shifts out bits MSB-first)
 *  D2 = CS   (chip select, active low during transfer)
 *  D3 = MISO (loopback = MOSI delayed by 1 tick)
 */
function mockSpiTransfer(sabView: Uint8Array): void {
  let tick = 0;
  const spiPayload = [0xA5, 0x3C, 0xF0, 0x0F]; // 4 bytes to transfer
  simulationInterval = setInterval(() => {
    const cyclePos = tick % 200; // 200 ticks per SPI transaction cycle

    if (cyclePos < 64) {
      // Active transfer: 64 ticks = 8 bits × 4 bytes × 2 (rise + fall)
      sabView[2] = 0; // CS active low
      const bitIdx = Math.floor(cyclePos / 2);
      const byteIdx = Math.floor(bitIdx / 8);
      const bitPos = 7 - (bitIdx % 8);
      const dataVal = byteIdx < spiPayload.length ? spiPayload[byteIdx] : 0;

      sabView[0] = cyclePos % 2;                    // SCK toggle
      sabView[1] = (dataVal >> bitPos) & 1;          // MOSI: MSB-first
      sabView[3] = tick > 0 ? sabView[1] : 0;       // MISO: loopback delayed
    } else {
      // Idle between transfers
      sabView[0] = 0; // SCK idle low
      sabView[1] = 0; // MOSI idle
      sabView[2] = 1; // CS deasserted (idle high)
      sabView[3] = 0; // MISO idle
    }

    sabView[16] = tick % 256;
    writeUptime(sabView, tick * 16);

    if (cyclePos === 0 && tick > 0) {
      post({
        type: "RUNNER_STDOUT",
        text: `[SPI] TX: ${spiPayload.map(b => "0x" + b.toString(16).toUpperCase().padStart(2, "0")).join(" ")} | RX: loopback OK`,
        timestamp: ts(),
      });
    }
    tick++;
  }, 16);
}

/**
 * MOCK_I2C_TRANSACTION: 2-wire I2C bus with start/stop conditions
 *  D0 = SCL (clock line)
 *  D1 = SDA (data line)
 */
function mockI2cTransaction(sabView: Uint8Array): void {
  let tick = 0;
  // I2C frame: START + 7-bit addr (0x48) + R/W + ACK + 8-bit data (0xA5) + ACK + STOP
  // Total: 2(start) + 18(addr+rw+ack) + 18(data+ack) + 2(stop) = 40 clock phases
  const i2cAddr = 0x48;
  const i2cData = 0xA5;
  const frameBits: number[] = [];

  // Build frame: addr (7 bits) + W(0) + ACK(0) + data (8 bits) + ACK(0)
  for (let i = 6; i >= 0; i--) frameBits.push((i2cAddr >> i) & 1); // 7-bit address
  frameBits.push(0);  // Write bit
  frameBits.push(0);  // ACK from slave
  for (let i = 7; i >= 0; i--) frameBits.push((i2cData >> i) & 1); // 8-bit data
  frameBits.push(0);  // ACK from slave

  simulationInterval = setInterval(() => {
    const cyclePos = tick % 160;

    if (cyclePos === 0) {
      // START condition: SDA falls while SCL is HIGH
      sabView[0] = 1; sabView[1] = 1;
    } else if (cyclePos === 1) {
      sabView[0] = 1; sabView[1] = 0; // SDA goes low = START
    } else if (cyclePos >= 2 && cyclePos < 2 + frameBits.length * 2) {
      // Clock bits in/out
      const phase = cyclePos - 2;
      const bitIdx = Math.floor(phase / 2);
      if (phase % 2 === 0) {
        sabView[0] = 0;                              // SCL low: setup data
        sabView[1] = frameBits[bitIdx];               // SDA: data bit
      } else {
        sabView[0] = 1;                              // SCL high: sample
      }
    } else if (cyclePos === 2 + frameBits.length * 2) {
      // STOP condition: SDA rises while SCL is HIGH
      sabView[0] = 1; sabView[1] = 0;
    } else if (cyclePos === 3 + frameBits.length * 2) {
      sabView[0] = 1; sabView[1] = 1; // SDA goes high = STOP
    } else {
      // Idle: both lines HIGH
      sabView[0] = 1; sabView[1] = 1;
    }

    sabView[16] = tick % 256;
    writeUptime(sabView, tick * 16);

    if (cyclePos === 0 && tick > 0) {
      post({
        type: "RUNNER_STDOUT",
        text: `[I2C] ADDR: 0x${i2cAddr.toString(16).toUpperCase()} W | DATA: 0x${i2cData.toString(16).toUpperCase()} | ACK: OK`,
        timestamp: ts(),
      });
    }
    tick++;
  }, 16);
}

/**
 * MOCK_PWM_SWEEP: PWM duty cycle ramp on D3
 *  D0 = System clock
 *  D3 = PWM output (variable duty cycle, period = 20 ticks)
 */
function mockPwmSweep(sabView: Uint8Array): void {
  let tick = 0;
  simulationInterval = setInterval(() => {
    const pwmPeriod = 20;
    // Sweep duty from 0→20 over 300 ticks, then 20→0 over 300 ticks
    const sweepPhase = tick % 600;
    const duty = sweepPhase < 300
      ? Math.floor((sweepPhase / 300) * pwmPeriod)
      : Math.floor(((600 - sweepPhase) / 300) * pwmPeriod);

    sabView[0] = tick % 2; // D0: reference clock
    sabView[3] = (tick % pwmPeriod) < duty ? 1 : 0; // D3: PWM output
    sabView[22] = Math.floor((duty / pwmPeriod) * 255); // PWM register

    sabView[16] = tick % 256;
    writeUptime(sabView, tick * 16);

    // Also generate a sawtooth on ADC channel 0
    sabView[21] = tick % 256;

    if (tick % 300 === 0) {
      post({
        type: "RUNNER_STDOUT",
        text: `[PWM] Duty: ${Math.round((duty / pwmPeriod) * 100)}% | ADC0: ${sabView[21]}`,
        timestamp: ts(),
      });
    }
    tick++;
  }, 16);
}

/** Write 32-bit little-endian uptime to bytes 17–20 */
function writeUptime(view: Uint8Array, ms: number): void {
  view[17] = ms & 0xff;
  view[18] = (ms >> 8) & 0xff;
  view[19] = (ms >> 16) & 0xff;
  view[20] = (ms >> 24) & 0xff;
}

// ─── Message Handler ─────────────────────────────────────────────────────────

self.onmessage = async (event: MessageEvent) => {
  const data = event.data;
  if (!data || typeof data !== "object") return;

  const { type, firmwareUrl, sab, sharedMemory } = data;
  const targetSab = sab || sharedMemory;

  // ── TERMINATE ──
  if (type === "TERMINATE" || type === "STOP_EXECUTION") {
    clearAllIntervals();
    if (targetSab instanceof SharedArrayBuffer) {
      const v = new Uint8Array(targetSab);
      for (let i = 0; i < 8; i++) v[i] = 0;
    }
    post({ type: "RUNNER_STATUS", status: "STOPPED", message: "Target CPU halted.", timestamp: ts() });
    return;
  }

  // ── FLASH_AND_RUN ──
  if (type === "FLASH_AND_RUN" || type === "RUN_FIRMWARE" || type === "RUN_WASM") {
    clearAllIntervals();

    if (!targetSab || !(targetSab instanceof SharedArrayBuffer)) {
      post({ type: "RUNNER_STATUS", status: "ERROR", message: "Missing SharedArrayBuffer.", timestamp: ts() });
      return;
    }

    const sabView = new Uint8Array(targetSab);
    const selectedUrl = firmwareUrl || "mock";

    // ── Mock patterns ──
    if (selectedUrl === "mock" || selectedUrl.includes("mock")) {
      const pattern = selectedUrl.toLowerCase();

      if (pattern.includes("spi")) {
        post({ type: "RUN_SUCCESS", message: "SPI Transfer mock active. D0=SCK, D1=MOSI, D2=CS, D3=MISO.", timestamp: ts() });
        post({ type: "RUNNER_STDOUT", text: "[BOOTLOADER] MOCK_SPI_TRANSFER @ 60Hz", timestamp: ts() });
        mockSpiTransfer(sabView);
      } else if (pattern.includes("i2c")) {
        post({ type: "RUN_SUCCESS", message: "I2C Transaction mock active. D0=SCL, D1=SDA.", timestamp: ts() });
        post({ type: "RUNNER_STDOUT", text: "[BOOTLOADER] MOCK_I2C_TRANSACTION @ 60Hz", timestamp: ts() });
        mockI2cTransaction(sabView);
      } else if (pattern.includes("pwm")) {
        post({ type: "RUN_SUCCESS", message: "PWM Sweep mock active. D0=CLK, D3=PWM.", timestamp: ts() });
        post({ type: "RUNNER_STDOUT", text: "[BOOTLOADER] MOCK_PWM_SWEEP @ 60Hz", timestamp: ts() });
        mockPwmSweep(sabView);
      } else {
        post({ type: "RUN_SUCCESS", message: "Test Pattern active. D0=CLK, D1=Heartbeat, D2=UART TX.", timestamp: ts() });
        post({ type: "RUNNER_STDOUT", text: "[BOOTLOADER] MOCK_TEST_PATTERN @ 60Hz", timestamp: ts() });
        mockTestPattern(sabView);
      }
      return;
    }

    // ── Real WASM execution ──
    try {
      let wasmBuffer: ArrayBuffer;

      if (data.binary && (data.binary instanceof Uint8Array || data.binary instanceof ArrayBuffer)) {
        wasmBuffer = data.binary instanceof Uint8Array ? data.binary.buffer as ArrayBuffer : data.binary;
      } else {
        const response = await fetch(selectedUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
        wasmBuffer = await response.arrayBuffer();
      }

      let uptimeMs = 0;

      const importObject: WebAssembly.Imports = {
        env: {
          __js_gpio_write: (pin: number, state: number) => {
            sabView[pin & 0x07] = state ? 1 : 0;
          },
          __js_gpio_read: (pin: number): number => {
            // Read from input port (bytes 8–15) for pins 4–7, output port (0–7) for pins 0–3
            const idx = pin & 0x07;
            return idx >= 4 ? (sabView[idx + 4] > 0 ? 1 : 0) : (sabView[idx] > 0 ? 1 : 0);
          },
          __js_delay_ms: (_ms: number) => { /* no-op in browser, cooperative yield */ },
          __js_millis: (): number => uptimeMs,
          __js_adc_read: (_ch: number): number => sabView[21],
          __js_yield: () => {},
          putchar: (char: number) => {
            post({ type: "RUNNER_STDOUT", text: String.fromCharCode(char), timestamp: ts() });
          },
          puts: (strPtr: number) => {
            post({ type: "RUNNER_STDOUT", text: `[STDOUT] @0x${strPtr.toString(16)}`, timestamp: ts() });
          },
        },
      };

      const wasmModule = await WebAssembly.compile(wasmBuffer);
      const wasmInstance = await WebAssembly.instantiate(wasmModule, importObject);
      const exports = wasmInstance.exports as Record<string, unknown>;

      post({ type: "RUN_SUCCESS", message: `Firmware '${selectedUrl}' loaded (${wasmBuffer.byteLength}B).`, timestamp: ts() });
      post({ type: "RUNNER_STDOUT", text: `[BOOTLOADER] Loaded '${selectedUrl}' (${wasmBuffer.byteLength} bytes). CPU active.`, timestamp: ts() });

      if (typeof exports.setup === "function") (exports.setup as () => void)();

      let wasmTick = 0;
      wasmInterval = setInterval(() => {
        wasmTick++;
        uptimeMs += 16;
        if (typeof exports.loop === "function") (exports.loop as () => void)();
        else if (typeof exports.tick === "function") (exports.tick as () => void)();
        sabView[16] = wasmTick % 256;
        writeUptime(sabView, uptimeMs);
      }, 16);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      post({ type: "RUNNER_STATUS", status: "ERROR", message: `WASM Load Error: ${msg}`, timestamp: ts() });
    }
  }
};

export {};
