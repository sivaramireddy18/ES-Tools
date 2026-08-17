"use client";

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { RunnerOutgoingMessage } from "@/workers/runner.worker";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TargetStatus = "POWERED_OFF" | "FLASHING" | "RUNNING" | "HALTED";

export type LogLevel = "info" | "warn" | "error" | "rx" | "tx";

export interface LogEntry {
  id: string;
  time: string;
  level: LogLevel;
  text: string;
}

export interface FirmwareOption {
  id: string;
  name: string;
  filename: string;
  url: string;
  description: string;
  tag: string;
}

export const FIRMWARE_ROMS: FirmwareOption[] = [
  {
    id: "rom_student",
    name: "0x04_Student_Firmware.wasm",
    filename: "student_firmware.wasm",
    url: "/firmware/student_firmware.wasm",
    description:
      "Full DUT I/O: Reads DIP Switches SW0-3 (Pins 4-7) and drives LEDs 0-3 (Pins 0-3)",
    tag: "STUDENT FIRMWARE",
  },
  {
    id: "rom_mock",
    name: "MOCK_TEST_PATTERN",
    filename: "mock_signal_gen.js",
    url: "mock",
    description:
      "Multi-signal bit-bang: 30Hz Clock (D0), 1Hz Heartbeat (D1), UART TX Bursts (D2)",
    tag: "SYNTHETIC HW",
  },
  {
    id: "rom_mock_spi",
    name: "MOCK_SPI_TRANSFER",
    filename: "mock_spi.js",
    url: "mock_spi",
    description:
      "SPI bus transaction: SCK (D0), MOSI (D1), CS (D2), MISO loopback (D3)",
    tag: "SPI BUS",
  },
  {
    id: "rom_mock_i2c",
    name: "MOCK_I2C_TRANSACTION",
    filename: "mock_i2c.js",
    url: "mock_i2c",
    description:
      "I2C bus: SCL (D0), SDA (D1) — Start, 7-bit addr 0x48, data 0xA5, ACK, Stop",
    tag: "I2C BUS",
  },
  {
    id: "rom_mock_pwm",
    name: "MOCK_PWM_SWEEP",
    filename: "mock_pwm.js",
    url: "mock_pwm",
    description:
      "PWM duty cycle sweep 0→100→0% on D3 with reference clock on D0 + ADC sawtooth",
    tag: "PWM / ADC",
  },
  {
    id: "rom_01",
    name: "0x01_Blinky.wasm",
    filename: "lab1_blinky.wasm",
    url: "/firmware/lab1_blinky.wasm",
    description: "Lab 1: 1Hz Blinky on GPIO Output Pin 0 (500ms period)",
    tag: "GPIO TIMING",
  },
  {
    id: "rom_02",
    name: "0x02_Heartbeat.wasm",
    filename: "lab2_heartbeat.wasm",
    url: "/firmware/lab2_heartbeat.wasm",
    description: "Lab 2: 10Hz Heartbeat beacon driving GPIO Output Pin 2",
    tag: "FAST PULSE",
  },
  {
    id: "rom_03",
    name: "0x03_UART_Echo.wasm",
    filename: "lab3_uart_echo.wasm",
    url: "/firmware/lab3_uart_echo.wasm",
    description:
      "Lab 3: Multi-pin synchronized output (Pins 0 & 2) + UART stream",
    tag: "SYNC SERIAL",
  },
];

// ─── Context Shape ───────────────────────────────────────────────────────────

interface HardwareBusContextValue {
  // Hardware state
  sharedMemory: SharedArrayBuffer | null;
  targetStatus: TargetStatus;
  powerLed: boolean;
  clockLed: boolean;
  trapLed: boolean;

  // Firmware selection
  selectedRomId: string;
  setSelectedRomId: (id: string) => void;
  selectedRom: FirmwareOption;
  customBinary: Uint8Array | null;
  customFileName: string | null;

  // Log buffer
  logs: LogEntry[];
  appendLog: (text: string, level?: LogLevel) => void;
  clearLogs: () => void;

  // Actions
  flashAndRun: () => void;
  hardReset: () => void;
  uploadWasm: (file: File) => Promise<void>;
}

const HardwareBusContext = createContext<HardwareBusContextValue | null>(null);

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useHardwareBus(): HardwareBusContextValue {
  const ctx = useContext(HardwareBusContext);
  if (!ctx) {
    throw new Error("useHardwareBus must be used within <HardwareBusProvider>");
  }
  return ctx;
}

// ─── Provider ────────────────────────────────────────────────────────────────

const MAX_LOGS = 200;
const SAB_SIZE = 1024;

export function HardwareBusProvider({ children }: { children: ReactNode }) {
  // ── Firmware selection ──
  const [selectedRomId, setSelectedRomId] = useState<string>("rom_mock");
  const [customBinary, setCustomBinary] = useState<Uint8Array | null>(null);
  const [customFileName, setCustomFileName] = useState<string | null>(null);

  // ── Hardware state ──
  const [sharedMemory, setSharedMemory] = useState<SharedArrayBuffer | null>(
    null
  );
  const [targetStatus, setTargetStatus] = useState<TargetStatus>("POWERED_OFF");
  const [powerLed, setPowerLed] = useState(true);
  const [clockLed, setClockLed] = useState(false);
  const [trapLed, setTrapLed] = useState(false);

  // ── Log buffer ──
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: "boot-1",
      time: "00:00:00.100",
      level: "info",
      text: "[JTAG] Hardware Probe initialized: J-Link SWD @ 4000 kHz",
    },
    {
      id: "boot-2",
      time: "00:00:00.250",
      level: "info",
      text: `[BENCH] ${SAB_SIZE}-byte SharedArrayBuffer hardware bus mapped to DUT registers.`,
    },
    {
      id: "boot-3",
      time: "00:00:00.400",
      level: "rx",
      text: "[UART] Target ready. Select ROM or drag-and-drop custom .wasm file.",
    },
  ]);

  // ── Refs ──
  const workerRef = useRef<Worker | null>(null);

  // ── Derived ──
  const selectedRom =
    FIRMWARE_ROMS.find((r) => r.id === selectedRomId) || FIRMWARE_ROMS[0];

  // ── Helpers ──
  const appendLog = useCallback((text: string, level: LogLevel = "info") => {
    const now = new Date();
    const time =
      now.toTimeString().split(" ")[0] +
      "." +
      String(now.getMilliseconds()).padStart(3, "0");
    setLogs((prev) => [
      ...prev.slice(-(MAX_LOGS - 1)),
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, time, level, text },
    ]);
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  // ── Worker message handler ──
  const handleWorkerMessage = useCallback(
    (e: MessageEvent<RunnerOutgoingMessage>) => {
      const data = e.data;
      if (!data || typeof data !== "object") return;

      switch (data.type) {
        case "RUN_SUCCESS":
          setTargetStatus("RUNNING");
          setClockLed(true);
          appendLog("[BOOTLOADER] Target flashed and verified. Core active.", "info");
          break;
        case "RUNNER_STDOUT":
          appendLog(data.text, "rx");
          break;
        case "RUNNER_STATUS":
          if (data.status === "ERROR") {
            setTargetStatus("HALTED");
            setTrapLed(true);
            setClockLed(false);
            appendLog(`[TRAP_FAULT] Target exception: ${data.message}`, "error");
          } else if (data.status === "STOPPED") {
            setTargetStatus("HALTED");
            setClockLed(false);
            appendLog("[HALT] Target CPU halted by probe.", "warn");
          }
          break;
      }
    },
    [appendLog]
  );

  // ── Upload .wasm file ──
  const uploadWasm = useCallback(
    async (file: File) => {
      if (!file.name.endsWith(".wasm")) {
        appendLog("[UPLOAD_ERR] Invalid file type. Must be a .wasm binary.", "error");
        return;
      }
      try {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);

        // Validate WASM magic header: '\0asm'
        if (
          bytes.length < 8 ||
          bytes[0] !== 0x00 ||
          bytes[1] !== 0x61 ||
          bytes[2] !== 0x73 ||
          bytes[3] !== 0x6d
        ) {
          appendLog(
            "[UPLOAD_ERR] Corrupt WASM header: missing '\\0asm' magic signature.",
            "error"
          );
          return;
        }

        setCustomBinary(bytes);
        setCustomFileName(file.name);
        setSelectedRomId("custom");
        appendLog(
          `[UPLOAD_OK] Loaded '${file.name}' (${bytes.byteLength} bytes). Ready to flash.`,
          "tx"
        );
      } catch (err) {
        appendLog(`[UPLOAD_ERR] Failed to parse .wasm file: ${String(err)}`, "error");
      }
    },
    [appendLog]
  );

  // ── Flash & Run ──
  const flashAndRun = useCallback(() => {
    // Terminate existing worker
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }

    setTargetStatus("FLASHING");
    setClockLed(false);
    setTrapLed(false);

    const isCustom = selectedRomId === "custom" && customBinary;
    const targetName = isCustom ? customFileName : selectedRom.name;
    const targetUrl = isCustom ? "custom" : selectedRom.url;

    appendLog(`[BOOTLOADER] Initiating JTAG flash cycle: ${targetName}...`, "warn");

    try {
      // Allocate fresh SharedArrayBuffer
      const sab = new SharedArrayBuffer(SAB_SIZE);
      const memView = new Uint8Array(sab);
      for (let i = 0; i < SAB_SIZE; i++) {
        Atomics.store(memView, i, 0);
      }
      setSharedMemory(sab);

      // Instantiate worker
      const worker = new Worker(
        new URL("../workers/runner.worker.ts", import.meta.url)
      );
      workerRef.current = worker;

      worker.onmessage = handleWorkerMessage;
      worker.onerror = (err) => {
        setTargetStatus("HALTED");
        setTrapLed(true);
        setClockLed(false);
        appendLog(`[RUNNER_ERR] Uncaught worker exception: ${err.message}`, "error");
      };

      // Dispatch firmware payload
      worker.postMessage({
        type: "FLASH_AND_RUN",
        firmwareUrl: targetUrl,
        binary: isCustom ? customBinary : undefined,
        sab: sab,
        sharedMemory: sab,
      });

      appendLog(`[JTAG] Payload '${targetName}' dispatched to target core.`, "info");
    } catch (err) {
      setTargetStatus("HALTED");
      setTrapLed(true);
      appendLog(
        `[ALLOC_ERR] Failed to allocate SharedArrayBuffer: ${String(err)}`,
        "error"
      );
    }
  }, [
    selectedRomId,
    customBinary,
    customFileName,
    selectedRom,
    appendLog,
    handleWorkerMessage,
  ]);

  // ── Hard Reset ──
  const hardReset = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: "TERMINATE" });
      workerRef.current.terminate();
      workerRef.current = null;
    }

    if (sharedMemory) {
      const memView = new Uint8Array(sharedMemory);
      for (let i = 0; i < 8; i++) {
        Atomics.store(memView, i, 0);
      }
    }

    setTargetStatus("HALTED");
    setClockLed(false);
    setTrapLed(false);
    appendLog("[RESET] Target RST line asserted. Core registers and memory cleared.", "warn");
  }, [sharedMemory, appendLog]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  // ── Context value ──
  const value: HardwareBusContextValue = {
    sharedMemory,
    targetStatus,
    powerLed,
    clockLed,
    trapLed,
    selectedRomId,
    setSelectedRomId,
    selectedRom,
    customBinary,
    customFileName,
    logs,
    appendLog,
    clearLogs,
    flashAndRun,
    hardReset,
    uploadWasm,
  };

  return (
    <HardwareBusContext.Provider value={value}>
      {children}
    </HardwareBusContext.Provider>
  );
}
