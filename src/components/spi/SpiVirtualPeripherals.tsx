"use client";

import React, { useState } from "react";

export interface W25Q128State {
  jedecId: number[];
  flashMemory: Uint8Array;
}

export interface Mcp3008State {
  channels: number[]; // 8 channels (0..1023)
}

export interface Max7219State {
  matrix: number[]; // 8 rows of 8 bits
}

interface Props {
  flash: W25Q128State;
  adc: Mcp3008State;
  setAdc: React.Dispatch<React.SetStateAction<Mcp3008State>>;
  matrix: Max7219State;
}

export default function SpiVirtualPeripherals({
  flash,
  adc,
  setAdc,
  matrix,
}: Props) {
  const [activeTab, setActiveTab] = useState<"flash" | "adc" | "matrix">("flash");

  return (
    <div className="flex flex-col h-full bg-[#0c0e14] border border-zinc-800/80 rounded-lg overflow-hidden font-mono text-zinc-300 select-none">
      {/* Device Tab Selector */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 bg-[#0a0c10] px-3 pt-2 shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab("flash")}
            className={`px-3 py-1 text-[10px] font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === "flash"
                ? "border-cyan-400 text-cyan-300 bg-[#12151e]"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            W25Q128 FLASH [CS0]
          </button>
          <button
            onClick={() => setActiveTab("adc")}
            className={`px-3 py-1 text-[10px] font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === "adc"
                ? "border-emerald-400 text-emerald-300 bg-[#12151e]"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            MCP3008 ADC [CS1]
          </button>
          <button
            onClick={() => setActiveTab("matrix")}
            className={`px-3 py-1 text-[10px] font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === "matrix"
                ? "border-rose-400 text-rose-300 bg-[#12151e]"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            MAX7219 MATRIX [CS2]
          </button>
        </div>
        <span className="text-[9px] text-zinc-500">SPI SLAVE PERIPHERALS</span>
      </div>

      {/* Device Detail Content */}
      <div className="flex-1 p-3 overflow-y-auto">
        {/* ── Winbond W25Q128 Flash ── */}
        {activeTab === "flash" && (
          <div className="space-y-3">
            <div className="flex justify-between items-center text-[10px]">
              <span className="font-bold text-cyan-400">Winbond W25Q128 128M-bit SPI NOR Flash</span>
              <span className="text-zinc-500">CS Line: CS0 (Active LOW)</span>
            </div>

            <div className="p-3 bg-[#080a0e] rounded border border-zinc-800 space-y-2.5 text-[10px]">
              <div className="flex justify-between">
                <span className="text-zinc-400">Manufacturer JEDEC ID (0x9F):</span>
                <span className="text-emerald-400 font-bold">
                  {flash.jedecId.map((b) => `0x${b.toString(16).toUpperCase().padStart(2, "0")}`).join(" ")}
                </span>
              </div>
              <div className="text-[9px] text-zinc-500 font-sans">
                • 0xEF = Winbond Serial Flash<br />
                • 0x40 = Memory Type (SPI)<br />
                • 0x18 = Capacity (128M-bit / 16M-byte)
              </div>

              <div className="border-t border-zinc-800/80 pt-2 space-y-1">
                <span className="text-zinc-500 font-bold block">Page 0 Memory (0x000000)</span>
                <div className="grid grid-cols-8 gap-1 text-center">
                  {Array.from({ length: 8 }, (_, idx) => {
                    const byteVal = flash.flashMemory[idx] || 0;
                    return (
                      <div key={idx} className="p-1 bg-[#12151e] rounded border border-zinc-800">
                        <span className="text-[8px] text-zinc-600 block">+{idx}</span>
                        <span className="text-cyan-300 font-bold">
                          0x{byteVal.toString(16).toUpperCase().padStart(2, "0")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Microchip MCP3008 ADC ── */}
        {activeTab === "adc" && (
          <div className="space-y-3">
            <div className="flex justify-between items-center text-[10px]">
              <span className="font-bold text-emerald-400">MCP3008 8-Channel 10-Bit SPI ADC</span>
              <span className="text-zinc-500">CS Line: CS1 (Active LOW)</span>
            </div>

            <div className="p-3 bg-[#080a0e] rounded border border-zinc-800 space-y-2">
              <span className="text-[9px] text-zinc-400 block">
                Simulated Analog Channels (CH0 - CH3 Potentiometers)
              </span>

              <div className="space-y-2">
                {[0, 1, 2, 3].map((ch) => {
                  const val = adc.channels[ch] || 0;
                  const volts = ((val / 1023) * 3.3).toFixed(2);
                  return (
                    <div key={ch} className="space-y-0.5">
                      <div className="flex justify-between text-[9px]">
                        <span className="text-zinc-400 font-bold">CH{ch} (ANALOG IN)</span>
                        <span className="text-emerald-400 font-bold">
                          {volts}V ({val} / 1023)
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1023"
                        value={val}
                        onChange={(e) => {
                          const newChs = [...adc.channels];
                          newChs[ch] = parseInt(e.target.value, 10);
                          setAdc({ channels: newChs });
                        }}
                        className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── MAX7219 8x8 LED Matrix ── */}
        {activeTab === "matrix" && (
          <div className="space-y-3">
            <div className="flex justify-between items-center text-[10px]">
              <span className="font-bold text-rose-400">MAX7219 Serially Interfaced 8x8 LED Matrix</span>
              <span className="text-zinc-500">CS Line: CS2 (Active LOW)</span>
            </div>

            <div className="p-3 bg-[#080a0e] rounded border border-zinc-800 flex flex-col items-center space-y-2">
              <div className="grid grid-cols-8 gap-1.5 p-2.5 bg-[#050608] rounded border border-zinc-800">
                {matrix.matrix.map((rowVal, r) =>
                  Array.from({ length: 8 }, (_, c) => {
                    const on = ((rowVal >> (7 - c)) & 1) === 1;
                    return (
                      <div
                        key={`${r}-${c}`}
                        className={`w-4 h-4 rounded-full transition-colors duration-100 ${
                          on
                            ? "bg-rose-500 shadow-[0_0_8px_#f43f5e]"
                            : "bg-zinc-800"
                        }`}
                      />
                    );
                  })
                )}
              </div>
              <span className="text-[9px] text-zinc-500">
                Send 16-bit word: [Address Byte 0x01-0x08] + [Data Byte 0x00-0xFF]
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
