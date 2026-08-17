"use client";

import React, { useState } from "react";
import { useHardwareBus } from "@/context/HardwareBusContext";

interface PinConnection {
  pin: string;
  header: "CN7_LEFT" | "CN10_RIGHT" | "ARDUINO_D" | "ARDUINO_A";
  signal: string;
  connectedTo: string;
  wireColor: string;
  description: string;
  voltage: number;
}

export default function RealisticLabSetup() {
  const { targetStatus, sharedMemory } = useHardwareBus();

  // Selected probe / multimeter target
  const [probedPin, setProbedPin] = useState<string>("PA5");
  const [activeFault, setActiveFault] = useState<"NONE" | "DISCONNECT_SDA" | "SHORT_GND" | "NOISE">("NONE");
  const [boardLedPwr, setBoardLedPwr] = useState<boolean>(true);
  const [boardLedCom, setBoardLedCom] = useState<boolean>(true);

  // Read actual live GPIO states if SharedArrayBuffer available
  let liveGpioA = 0;
  if (sharedMemory) {
    const mem = new Uint8Array(sharedMemory);
    liveGpioA = mem[0]; // GPIOA_ODR
  }

  const pinMap: Record<string, PinConnection> = {
    PA5: {
      pin: "PA5",
      header: "CN10_RIGHT",
      signal: "SPI1_SCK / LED_GREEN",
      connectedTo: "Logic Analyzer Ch 0 (Brown Wire) + On-Board User LED2",
      wireColor: "#854d0e",
      description: "SPI Clock Output / User Green LED toggle",
      voltage: (liveGpioA & (1 << 0)) ? 3.3 : 0.0,
    },
    PA7: {
      pin: "PA7",
      header: "CN10_RIGHT",
      signal: "SPI1_MOSI",
      connectedTo: "Logic Analyzer Ch 1 (Red Wire) → W25Q128 Flash Pin 5",
      wireColor: "#ef4444",
      description: "Master Out Slave In Serial Data Line",
      voltage: (liveGpioA & (1 << 1)) ? 3.3 : 0.0,
    },
    PA6: {
      pin: "PA6",
      header: "CN10_RIGHT",
      signal: "SPI1_MISO",
      connectedTo: "Logic Analyzer Ch 2 (Orange Wire) → W25Q128 Flash Pin 2",
      wireColor: "#f97316",
      description: "Master In Slave Out Serial Return Line",
      voltage: 0.0,
    },
    PA9: {
      pin: "PA9",
      header: "CN10_RIGHT",
      signal: "USART1_TX",
      connectedTo: "FTDI USB-UART Dongle RX Pin (Yellow Wire)",
      wireColor: "#eab308",
      description: "UART Serial Transmit @ 115,200 Baud",
      voltage: 3.3,
    },
    PA10: {
      pin: "PA10",
      header: "CN10_RIGHT",
      signal: "USART1_RX",
      connectedTo: "FTDI USB-UART Dongle TX Pin (Green Wire)",
      wireColor: "#22c55e",
      description: "UART Serial Receive Line",
      voltage: 3.3,
    },
    PB6: {
      pin: "PB6",
      header: "CN7_LEFT",
      signal: "I2C1_SCL",
      connectedTo: "Logic Analyzer Ch 3 (Blue Wire) → AT24C256 EEPROM SCL",
      wireColor: "#3b82f6",
      description: "I2C Clock Line with 4.7kΩ Pull-Up to 3.3V",
      voltage: 3.3,
    },
    PB7: {
      pin: "PB7",
      header: "CN7_LEFT",
      signal: "I2C1_SDA",
      connectedTo: activeFault === "DISCONNECT_SDA" ? "DISCONNECTED (Floating)" : "Logic Analyzer Ch 4 (Violet Wire) → AT24C256 EEPROM SDA",
      wireColor: activeFault === "DISCONNECT_SDA" ? "#71717a" : "#a855f7",
      description: "I2C Data Open-Drain Line with 4.7kΩ Pull-Up",
      voltage: activeFault === "DISCONNECT_SDA" ? 0.0 : 3.3,
    },
    PC13: {
      pin: "PC13",
      header: "CN7_LEFT",
      signal: "USER_BUTTON (B1)",
      connectedTo: "On-Board Blue Tactile Pushbutton (Active LOW)",
      wireColor: "#06b6d4",
      description: "User pushbutton input connected to EXTI Line 13",
      voltage: 3.3,
    },
    GND: {
      pin: "GND",
      header: "CN7_LEFT",
      signal: "COMMON GROUND",
      connectedTo: "Instrument Ground Bus (Black Alligator Lead)",
      wireColor: "#27272a",
      description: "0.0V Ground Reference Plane",
      voltage: 0.0,
    },
    VDD: {
      pin: "+3.3V",
      header: "CN7_LEFT",
      signal: "VDD 3.3V RAIL",
      connectedTo: "Breadboard Power Rail (Red Wire)",
      wireColor: "#dc2626",
      description: "Main 3.3V LDO Power Output from ST-LINK",
      voltage: 3.3,
    },
  };

  const currentProbe = pinMap[probedPin] || pinMap["PA5"];

  return (
    <div className="flex flex-col h-full bg-[#07090e] text-zinc-200 font-mono text-xs select-none overflow-hidden">
      {/* ── Top Bench Toolbar ── */}
      <div className="h-10 px-4 bg-[#0d1017] border-b border-zinc-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399] animate-pulse" />
          <span className="text-xs font-bold text-emerald-300 tracking-wider uppercase">
            PHYSICAL EMBEDDED LAB HARDWARE WORKSTATION
          </span>
          <span className="text-[10px] text-zinc-500 hidden md:inline">
            // STM32 NUCLEO-F446RE + ST-LINK/V2-1 + 8-CH LOGIC ANALYZER + BREADBOARD
          </span>
        </div>

        {/* Fault Injection Selector */}
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-zinc-500 uppercase font-bold">FAULT INJECTION:</span>
          <select
            value={activeFault}
            onChange={(e) => setActiveFault(e.target.value as typeof activeFault)}
            className="p-1 bg-[#141824] border border-zinc-700 rounded text-amber-300 font-bold focus:outline-none cursor-pointer"
          >
            <option value="NONE">NOMINAL (All Wires Connected)</option>
            <option value="DISCONNECT_SDA">UNPLUG PB7 (I2C SDA Wire Open)</option>
            <option value="SHORT_GND">SHORT PA5 (SPI SCK to GND)</option>
          </select>
        </div>
      </div>

      {/* ── Main Workstation Visual Layout ── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[68%_32%] overflow-hidden bg-[#05060a]">
        {/* ────────── LEFT: Realistic Physical Bench Canvas ────────── */}
        <div className="p-4 overflow-y-auto space-y-4 flex flex-col">
          {/* Virtual Bench Desk Surface */}
          <div className="bg-[#0b0e14] border border-zinc-800/90 rounded-xl p-4 relative shadow-[inset_0_0_40px_rgba(0,0,0,0.8)] space-y-4">
            {/* Header / Setup Title */}
            <div className="flex justify-between items-center border-b border-zinc-800/80 pb-2.5">
              <div className="flex items-center gap-3">
                <span className="text-sm">🔬</span>
                <div>
                  <span className="text-xs font-bold text-zinc-100 uppercase tracking-wide block">
                    Post-Silicon DUT Test Bench & Instrument Wiring
                  </span>
                  <span className="text-[10px] text-zinc-500 font-sans">
                    Hover or click any pin/header to attach the Oscilloscope & Multimeter probe!
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400">
                  USB POWER: <strong className="text-emerald-400">5.00V / 240mA</strong>
                </span>
                <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400">
                  TARGET VDD: <strong className="text-cyan-400">3.31V</strong>
                </span>
              </div>
            </div>

            {/* Visual Hardware Layout Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* ═════════ 1. ST-LINK V2-1 & NUCLEO TARGET PCB ═════════ */}
              <div className="md:col-span-2 bg-[#0d1624] border-2 border-cyan-800/60 rounded-xl p-3.5 relative shadow-[0_0_25px_rgba(6,182,212,0.15)] flex flex-col justify-between">
                {/* PCB Silk-Screen Header */}
                <div className="flex justify-between items-start border-b border-cyan-900/60 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-cyan-500/20 border border-cyan-400 flex items-center justify-center font-bold text-[9px] text-cyan-300">
                      ST
                    </div>
                    <div>
                      <span className="font-bold text-[11px] text-cyan-200 tracking-wider block">
                        NUCLEO-F446RE (ARM Cortex-M4 @ 180MHz)
                      </span>
                      <span className="text-[9px] text-cyan-500 font-mono">
                        MB1136 rev C-04 // LQFP64 SILICON PACKAGE
                      </span>
                    </div>
                  </div>

                  {/* ST-LINK Status LEDs */}
                  <div className="flex items-center gap-2 text-[9px]">
                    <div className="flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${boardLedPwr ? "bg-red-500 shadow-[0_0_6px_#ef4444]" : "bg-zinc-800"}`} />
                      <span className="text-zinc-400">LD3 (PWR)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${targetStatus === "RUNNING" ? "bg-emerald-400 shadow-[0_0_6px_#34d399] animate-pulse" : "bg-amber-400 animate-ping"}`} />
                      <span className="text-zinc-400">LD1 (COM)</span>
                    </div>
                  </div>
                </div>

                {/* ST-LINK Section & Target Microcontroller Chip */}
                <div className="py-3 grid grid-cols-3 gap-3 items-center">
                  {/* Left: ST-LINK Section */}
                  <div className="p-2 bg-[#09101a] rounded border border-cyan-900/40 text-center space-y-1">
                    <span className="text-[8px] text-cyan-400 uppercase font-bold block">
                      ST-LINK / V2-1 DEBUGGER
                    </span>
                    <div className="w-8 h-3.5 mx-auto bg-zinc-800 rounded-sm border border-zinc-600 flex items-center justify-center text-[7px] text-zinc-400">
                      USB-C
                    </div>
                    <span className="text-[8px] text-zinc-500 block">SWD PROBE LINK</span>
                  </div>

                  {/* Center: STM32 MCU Silicon Chip (LQFP64) */}
                  <div className="p-3 bg-[#0a0c10] rounded-lg border-2 border-zinc-700 shadow-lg text-center relative group cursor-pointer hover:border-cyan-400 transition-colors">
                    <span className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-zinc-600" />
                    <span className="text-[9px] font-bold text-zinc-300 block">STM32F446</span>
                    <span className="text-[7px] text-zinc-500 block">RET6 ARM</span>
                    <span className="text-[8px] px-1 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 inline-block mt-1 font-bold">
                      180 MHz
                    </span>
                  </div>

                  {/* Right: User Pushbutton & User LED */}
                  <div className="space-y-1.5 text-center">
                    <button
                      onClick={() => setProbedPin("PC13")}
                      className={`w-full py-1 rounded text-[9px] font-bold border transition-all cursor-pointer ${
                        probedPin === "PC13"
                          ? "bg-blue-600 text-white border-blue-400 shadow-[0_0_10px_#3b82f6]"
                          : "bg-blue-900/40 text-blue-300 border-blue-700 hover:bg-blue-800/60"
                      }`}
                    >
                      B1 USER (BLUE)
                    </button>
                    <button
                      onClick={() => setProbedPin("PA5")}
                      className={`w-full py-1 rounded text-[9px] font-bold border transition-all cursor-pointer ${
                        probedPin === "PA5"
                          ? "bg-emerald-600 text-white border-emerald-400 shadow-[0_0_10px_#10b981]"
                          : "bg-emerald-950/40 text-emerald-300 border-emerald-700 hover:bg-emerald-900/60"
                      }`}
                    >
                      LD2 USER (GREEN)
                    </button>
                  </div>
                </div>

                {/* Morpho & Arduino Pin Headers */}
                <div className="space-y-1.5 pt-2 border-t border-cyan-900/40 text-[9px]">
                  <span className="text-[9px] text-zinc-400 uppercase font-bold block">
                    Morpho Expansion Headers (Click Pin to Probe):
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Left Header (CN7) */}
                    <div className="p-1.5 bg-[#080d16] rounded border border-zinc-800 space-y-1">
                      <span className="text-[8px] text-cyan-400 font-bold block">CN7 (LEFT HEADER)</span>
                      <div className="grid grid-cols-2 gap-1">
                        {["PB6", "PB7", "PC13", "GND"].map((p) => (
                          <button
                            key={p}
                            onClick={() => setProbedPin(p)}
                            className={`px-1.5 py-0.5 rounded text-[9px] text-left font-bold transition-all cursor-pointer ${
                              probedPin === p
                                ? "bg-cyan-500 text-zinc-950 shadow-[0_0_8px_#22d3ee]"
                                : "bg-zinc-900/80 text-zinc-400 hover:text-cyan-300"
                            }`}
                          >
                            📍 {p}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Right Header (CN10) */}
                    <div className="p-1.5 bg-[#080d16] rounded border border-zinc-800 space-y-1">
                      <span className="text-[8px] text-cyan-400 font-bold block">CN10 (RIGHT HEADER)</span>
                      <div className="grid grid-cols-2 gap-1">
                        {["PA5", "PA7", "PA6", "PA9"].map((p) => (
                          <button
                            key={p}
                            onClick={() => setProbedPin(p)}
                            className={`px-1.5 py-0.5 rounded text-[9px] text-left font-bold transition-all cursor-pointer ${
                              probedPin === p
                                ? "bg-cyan-500 text-zinc-950 shadow-[0_0_8px_#22d3ee]"
                                : "bg-zinc-900/80 text-zinc-400 hover:text-cyan-300"
                            }`}
                          >
                            📍 {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ═════════ 2. ATTACHED INSTRUMENTS & BREADBOARD ═════════ */}
              <div className="space-y-3 flex flex-col justify-between">
                {/* Saleae 8-Channel USB Logic Analyzer Unit */}
                <div className="p-3 bg-[#12131a] rounded-xl border border-zinc-700 shadow-md space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-[10px] text-amber-300">
                      📟 8-CH USB LOGIC ANALYZER
                    </span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]" />
                  </div>
                  <div className="space-y-1 text-[9px]">
                    <div className="flex justify-between text-zinc-400">
                      <span>Rate: <strong>24 MSPS</strong></span>
                      <span>Buffer: <strong>16 MB Ring</strong></span>
                    </div>
                    <div className="p-1.5 bg-zinc-950 rounded border border-zinc-800 space-y-0.5 font-mono text-[8px]">
                      <span className="text-yellow-400 block">Ch 0: PA5 (SPI SCK)</span>
                      <span className="text-red-400 block">Ch 1: PA7 (SPI MOSI)</span>
                      <span className="text-blue-400 block">Ch 3: PB6 (I2C SCL)</span>
                      <span className="text-purple-400 block">Ch 4: PB7 (I2C SDA)</span>
                    </div>
                  </div>
                </div>

                {/* FTDI USB-UART Serial Dongle */}
                <div className="p-2.5 bg-[#12131a] rounded-xl border border-zinc-700 space-y-1.5 text-[9px]">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sky-300">📨 FTDI USB-UART BRIDGE</span>
                    <span className="text-[8px] text-zinc-500">CP2102</span>
                  </div>
                  <div className="p-1.5 bg-zinc-950 rounded border border-zinc-800 flex justify-between font-mono text-[8px]">
                    <span className="text-emerald-400">TX: PA9 (115.2k)</span>
                    <span className="text-cyan-400">RX: PA10</span>
                  </div>
                </div>

                {/* Solderless Breadboard with Peripheral ICs */}
                <div className="p-2.5 bg-[#181a20] rounded-xl border border-zinc-700 space-y-1 text-[9px]">
                  <span className="font-bold text-zinc-300 block">🍞 LAB BREADBOARD</span>
                  <div className="grid grid-cols-2 gap-1 text-[8px]">
                    <div className="p-1 bg-zinc-950 rounded border border-zinc-800">
                      <span className="text-cyan-300 font-bold block">AT24C256</span>
                      <span className="text-zinc-500">I2C EEPROM</span>
                    </div>
                    <div className="p-1 bg-zinc-950 rounded border border-zinc-800">
                      <span className="text-emerald-300 font-bold block">W25Q128</span>
                      <span className="text-zinc-500">SPI NOR Flash</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ────────── RIGHT: Live Multimeter & Pin Diagnostic Telemetry ────────── */}
        <div className="p-4 bg-[#0a0c12] border-l border-zinc-800/80 flex flex-col space-y-3.5 overflow-y-auto">
          {/* Digital Multimeter / DSO Readout Box */}
          <div className="p-3.5 bg-[#0e121c] rounded-xl border-2 border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.15)] space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-cyan-300 tracking-wider uppercase flex items-center gap-1.5">
                <span>⚡</span>
                <span>VIRTUAL DIGITAL MULTIMETER</span>
              </span>
              <span className="text-[8px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
                6.5 DIGITS
              </span>
            </div>

            {/* 7-Segment Style Voltage Readout */}
            <div className="p-3 bg-[#050608] rounded-lg border border-cyan-900/60 text-center space-y-0.5">
              <span className="text-[9px] text-zinc-500 uppercase font-bold block">
                DC VOLTAGE AT PROBE ({currentProbe.pin})
              </span>
              <div className="text-3xl font-bold text-emerald-400 font-mono tracking-wider shadow-inner">
                {currentProbe.voltage.toFixed(3)} V
              </div>
              <span className="text-[9px] text-zinc-400 font-mono">
                {currentProbe.voltage >= 2.0 ? "LOGIC HIGH (3.3V)" : "LOGIC LOW (0.0V)"}
              </span>
            </div>
          </div>

          {/* Active Probed Pin Details */}
          <div className="p-3 bg-[#0e121c] rounded-xl border border-zinc-800 space-y-2 text-[10px]">
            <span className="text-cyan-400 font-bold uppercase block border-b border-zinc-800 pb-1">
              Active Probed Pin: {currentProbe.pin}
            </span>

            <div className="space-y-1.5 text-[10px]">
              <div>
                <span className="text-zinc-500 block">Hardware Signal:</span>
                <span className="font-bold text-zinc-200">{currentProbe.signal}</span>
              </div>
              <div>
                <span className="text-zinc-500 block">Physical Wiring & Probe:</span>
                <span className="font-mono text-amber-300" style={{ color: currentProbe.wireColor }}>
                  ● {currentProbe.connectedTo}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block">Description:</span>
                <p className="text-zinc-300 font-sans text-[11px] leading-relaxed">
                  {currentProbe.description}
                </p>
              </div>
            </div>
          </div>

          {/* Real-World Lab Checklist */}
          <div className="p-3 bg-[#0e121c] rounded-xl border border-zinc-800 space-y-1.5 text-[10px]">
            <span className="text-emerald-400 font-bold uppercase block">
              Embedded Lab Setup Checklist:
            </span>
            <ul className="space-y-1 text-zinc-400 font-sans text-[10px]">
              <li className="flex items-center gap-1.5">
                <span className="text-emerald-400">✓</span>
                <span>Common Ground (GND) shared between MCU & Logic Analyzer</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-emerald-400">✓</span>
                <span>4.7kΩ pull-up resistors installed on I2C SCL & SDA</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-emerald-400">✓</span>
                <span>ST-LINK SWD debug firmware flashed successfully</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-emerald-400">✓</span>
                <span>USB-UART baud rate matched at 115,200 baud</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
