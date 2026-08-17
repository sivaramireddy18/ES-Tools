"use client";

import React, { useState } from "react";

export interface EepromState {
  memory: Uint8Array;
}

export interface Tmp102State {
  temperatureC: number;
}

export interface Ds3231State {
  hours: number;
  minutes: number;
  seconds: number;
}

interface Props {
  eeprom: EepromState;
  tmp102: Tmp102State;
  setTmp102: React.Dispatch<React.SetStateAction<Tmp102State>>;
  ds3231: Ds3231State;
}

export default function I2cVirtualPeripherals({
  eeprom,
  tmp102,
  setTmp102,
  ds3231,
}: Props) {
  const [activeTab, setActiveTab] = useState<"eeprom" | "tmp102" | "ds3231">("eeprom");

  // Calculate 12-bit raw temperature code for TMP102
  const rawTempCode = Math.round(tmp102.temperatureC * 16) << 4;
  const msb = (rawTempCode >> 8) & 0xff;
  const lsb = rawTempCode & 0xff;

  return (
    <div className="flex flex-col h-full bg-[#0c0e14] border border-zinc-800/80 rounded-lg overflow-hidden font-mono text-zinc-300 select-none">
      {/* Device Tab Selector */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 bg-[#0a0c10] px-3 pt-2 shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab("eeprom")}
            className={`px-3 py-1 text-[10px] font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === "eeprom"
                ? "border-cyan-400 text-cyan-300 bg-[#12151e]"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            AT24C256 [0x50]
          </button>
          <button
            onClick={() => setActiveTab("tmp102")}
            className={`px-3 py-1 text-[10px] font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === "tmp102"
                ? "border-emerald-400 text-emerald-300 bg-[#12151e]"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            TMP102 TEMP [0x48]
          </button>
          <button
            onClick={() => setActiveTab("ds3231")}
            className={`px-3 py-1 text-[10px] font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === "ds3231"
                ? "border-amber-400 text-amber-300 bg-[#12151e]"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            DS3231 RTC [0x68]
          </button>
        </div>
        <span className="text-[9px] text-zinc-500">I2C SLAVE PERIPHERALS</span>
      </div>

      {/* Device Detail View */}
      <div className="flex-1 p-3 overflow-y-auto">
        {/* ── AT24C256 EEPROM ── */}
        {activeTab === "eeprom" && (
          <div className="space-y-3">
            <div className="flex justify-between items-center text-[10px]">
              <span className="font-bold text-cyan-400">AT24C256 256Kbit I2C EEPROM</span>
              <span className="text-zinc-500">Address: 7-bit 0x50 (1010000b)</span>
            </div>
            <p className="text-[10px] text-zinc-400 font-sans">
              Non-volatile memory array. Send 16-bit word address MSB/LSB, followed by data byte(s) to write. Read operations stream sequentially.
            </p>

            <div className="bg-[#080a0e] p-2 rounded border border-zinc-800 space-y-1 text-[10px]">
              <div className="flex justify-between text-zinc-500 font-bold border-b border-zinc-800/60 pb-1">
                <span>ADDR</span>
                <span className="flex-1 text-center">MEMORY CELLS (0x00 - 0x0F)</span>
                <span>ASCII</span>
              </div>

              {/* 32 bytes preview */}
              {[0, 16].map((rowOffset) => (
                <div key={rowOffset} className="flex items-center text-[9px]">
                  <span className="w-10 text-zinc-500 font-bold">
                    0x{rowOffset.toString(16).toUpperCase().padStart(2, "0")}
                  </span>
                  <div className="flex-1 grid grid-cols-16 gap-0.5 text-center px-2">
                    {Array.from({ length: 16 }, (_, idx) => {
                      const val = eeprom.memory[rowOffset + idx] || 0;
                      return (
                        <span
                          key={idx}
                          className={`rounded-xs ${
                            val > 0
                              ? "bg-cyan-500/20 text-cyan-300 font-bold"
                              : "text-zinc-600"
                          }`}
                        >
                          {val.toString(16).toUpperCase().padStart(2, "0")}
                        </span>
                      );
                    })}
                  </div>
                  <span className="w-14 text-right text-zinc-400 tracking-wider font-sans text-[8px]">
                    {Array.from({ length: 16 }, (_, idx) => {
                      const val = eeprom.memory[rowOffset + idx] || 0;
                      return val >= 32 && val <= 126 ? String.fromCharCode(val) : ".";
                    }).join("")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TMP102 Temperature Sensor ── */}
        {activeTab === "tmp102" && (
          <div className="space-y-3">
            <div className="flex justify-between items-center text-[10px]">
              <span className="font-bold text-emerald-400">TMP102 Digital Temp Sensor</span>
              <span className="text-zinc-500">Address: 7-bit 0x48 (ADD0=GND)</span>
            </div>

            <div className="p-3 bg-[#080a0e] rounded border border-zinc-800 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-400">Simulated Temperature:</span>
                <span className="text-lg font-bold text-emerald-400 font-mono">
                  {tmp102.temperatureC.toFixed(1)} °C / {(tmp102.temperatureC * 1.8 + 32).toFixed(1)} °F
                </span>
              </div>

              {/* Slider */}
              <input
                type="range"
                min="-40"
                max="125"
                step="0.5"
                value={tmp102.temperatureC}
                onChange={(e) =>
                  setTmp102({ temperatureC: parseFloat(e.target.value) })
                }
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800/80 text-[10px]">
                <div className="p-2 bg-[#12151e] rounded border border-zinc-800">
                  <span className="text-zinc-500 text-[9px] block">TEMPERATURE REG MSB (0x00)</span>
                  <span className="text-cyan-300 font-bold font-mono">
                    0x{msb.toString(16).toUpperCase().padStart(2, "0")} (bin: {msb.toString(2).padStart(8, "0")})
                  </span>
                </div>
                <div className="p-2 bg-[#12151e] rounded border border-zinc-800">
                  <span className="text-zinc-500 text-[9px] block">TEMPERATURE REG LSB (0x01)</span>
                  <span className="text-cyan-300 font-bold font-mono">
                    0x{lsb.toString(16).toUpperCase().padStart(2, "0")} (bin: {lsb.toString(2).padStart(8, "0")})
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── DS3231 RTC ── */}
        {activeTab === "ds3231" && (
          <div className="space-y-3">
            <div className="flex justify-between items-center text-[10px]">
              <span className="font-bold text-amber-400">DS3231 Extremely Accurate I2C RTC</span>
              <span className="text-zinc-500">Address: 7-bit 0x68</span>
            </div>

            <div className="p-3 bg-[#080a0e] rounded border border-zinc-800 space-y-3">
              <div className="text-center py-2 bg-[#12151e] rounded border border-zinc-800">
                <span className="text-[10px] text-zinc-500 block uppercase">RTC Current Clock</span>
                <span className="text-2xl font-bold font-mono text-amber-400 tracking-widest">
                  {String(ds3231.hours).padStart(2, "0")}:
                  {String(ds3231.minutes).padStart(2, "0")}:
                  {String(ds3231.seconds).padStart(2, "0")}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[10px]">
                <div className="p-2 bg-[#12151e] rounded border border-zinc-800 text-center">
                  <span className="text-zinc-500 text-[8px] block">SECONDS (0x00)</span>
                  <span className="text-zinc-300 font-bold">BCD: 0x{ds3231.seconds.toString(16).padStart(2, "0")}</span>
                </div>
                <div className="p-2 bg-[#12151e] rounded border border-zinc-800 text-center">
                  <span className="text-zinc-500 text-[8px] block">MINUTES (0x01)</span>
                  <span className="text-zinc-300 font-bold">BCD: 0x{ds3231.minutes.toString(16).padStart(2, "0")}</span>
                </div>
                <div className="p-2 bg-[#12151e] rounded border border-zinc-800 text-center">
                  <span className="text-zinc-500 text-[8px] block">HOURS (0x02)</span>
                  <span className="text-zinc-300 font-bold">BCD: 0x{ds3231.hours.toString(16).padStart(2, "0")}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
