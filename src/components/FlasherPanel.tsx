"use client";

import React, { useRef, useState } from "react";
import { useHardwareBus, FIRMWARE_ROMS } from "@/context/HardwareBusContext";

export default function FlasherPanel() {
  const {
    selectedRomId,
    setSelectedRomId,
    selectedRom,
    customBinary,
    customFileName,
    targetStatus,
    powerLed,
    clockLed,
    trapLed,
    flashAndRun,
    hardReset,
    uploadWasm,
  } = useHardwareBus();

  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) uploadWasm(e.dataTransfer.files[0]);
  };

  return (
    <section className="h-full border-r border-zinc-800/70 bg-[#0c0e14] flex flex-col justify-between p-3.5 space-y-3 overflow-y-auto">
      <div className="space-y-3">
        {/* ── Section Header ── */}
        <div className="pb-2 border-b border-zinc-800/60 flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-[0.1em] text-zinc-300 flex items-center gap-1.5 uppercase">
            <span className="w-1.5 h-1.5 rounded-sm bg-cyan-400" />
            Flasher Control
          </span>
          <span className="text-[9px] text-zinc-600 font-mono">v3.0.0</span>
        </div>

        {/* ── ROM Selector ── */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-zinc-500 tracking-wide uppercase block">
            Target Firmware (ROM)
          </label>
          <select
            value={selectedRomId}
            onChange={(e) => setSelectedRomId(e.target.value)}
            className="w-full px-2.5 py-2 bg-[#111420] border border-zinc-700/50 rounded-md text-xs text-cyan-200 font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 cursor-pointer transition-colors"
          >
            {customBinary && (
              <option value="custom" className="bg-[#111420] text-emerald-300 font-bold">
                ★ [CUSTOM] {customFileName}
              </option>
            )}
            {FIRMWARE_ROMS.map((rom) => (
              <option key={rom.id} value={rom.id} className="bg-[#111420] text-zinc-200">
                {rom.name}
              </option>
            ))}
          </select>
        </div>

        {/* ── Drag & Drop Upload Zone ── */}
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-zinc-500 tracking-wide uppercase flex items-center justify-between">
            <span>Upload Custom .wasm</span>
            <span className="text-zinc-600 text-[9px] normal-case">Local Binary</span>
          </label>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`p-3.5 rounded-lg border-2 border-dashed transition-all duration-200 text-center cursor-pointer ${
              isDragging
                ? "border-cyan-400/70 bg-cyan-500/8 text-cyan-200 scale-[1.01]"
                : customBinary
                ? "border-emerald-500/40 bg-emerald-500/5 text-zinc-300"
                : "border-zinc-700/50 bg-[#111420] hover:border-zinc-600/60 hover:bg-[#13162050] text-zinc-500"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".wasm"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) uploadWasm(e.target.files[0]);
              }}
            />

            {customBinary ? (
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 font-bold">
                  <span>✓</span>
                  <span className="truncate max-w-[160px]">{customFileName}</span>
                </div>
                <span className="text-[10px] text-zinc-500 block">
                  {customBinary.byteLength.toLocaleString()} bytes • Click to change
                </span>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="text-xs text-zinc-400 font-medium">📂 Drop .wasm or Browse</div>
                <span className="text-[9px] text-zinc-600 block">
                  Compiled Clang / Emscripten binary
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Selected ROM Info Card ── */}
        <div className="p-2.5 bg-[#111420] rounded-md border border-zinc-800/50 space-y-1 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-cyan-400 font-bold tracking-wide">
              {selectedRomId === "custom" ? "USER PAYLOAD" : selectedRom.tag}
            </span>
            <span className="text-[9px] text-zinc-600 font-mono">
              {selectedRomId === "custom" ? customFileName : selectedRom.filename}
            </span>
          </div>
          <p className="text-[10px] text-zinc-400 leading-snug">
            {selectedRomId === "custom"
              ? `Custom WebAssembly binary (${customBinary?.byteLength.toLocaleString()} bytes) loaded into JTAG flasher.`
              : selectedRom.description}
          </p>
        </div>

        {/* ── Action Buttons ── */}
        <div className="space-y-2 pt-1">
          <button
            onClick={flashAndRun}
            disabled={targetStatus === "FLASHING"}
            className="w-full flex items-center justify-center gap-2 py-3 px-3 rounded-md font-bold text-xs tracking-[0.08em] text-emerald-950 uppercase transition-all duration-200 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 shadow-[0_0_20px_rgba(16,185,129,0.25)] border border-emerald-300/40 cursor-pointer"
          >
            {targetStatus === "FLASHING" ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-emerald-950" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Flashing...</span>
              </>
            ) : (
              <>
                <span className="text-base leading-none">⚡</span>
                <span>Flash & Run</span>
              </>
            )}
          </button>

          <button
            onClick={hardReset}
            className="w-full py-2 px-3 rounded-md font-bold text-[11px] tracking-[0.06em] text-red-300 uppercase transition-all duration-200 active:scale-[0.97] bg-red-950/30 hover:bg-red-900/40 border border-red-800/40 hover:border-red-600/60 shadow-[0_0_12px_rgba(239,68,68,0.1)] cursor-pointer"
          >
            Hard Reset (RST)
          </button>
        </div>

        {/* ── System Status Indicators ── */}
        <div className="p-2.5 bg-[#111420] rounded-md border border-zinc-800/50 space-y-2">
          <span className="text-[10px] font-bold tracking-[0.1em] text-zinc-400 uppercase block border-b border-zinc-800/50 pb-1.5">
            System Status
          </span>

          <div className="grid grid-cols-3 gap-1.5 text-center">
            {/* Power LED */}
            <div className="flex flex-col items-center gap-1 p-2 bg-[#0a0c11] rounded-md border border-zinc-800/40">
              <span
                className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${
                  powerLed
                    ? "bg-emerald-400 shadow-[0_0_10px_#34d399,0_0_20px_rgba(52,211,153,0.3)]"
                    : "bg-zinc-700"
                }`}
              />
              <span className="text-[9px] text-zinc-400 font-semibold tracking-wide">POWER</span>
              <span className="text-[8px] text-emerald-400/80">+3.3V</span>
            </div>

            {/* Clock LED */}
            <div className="flex flex-col items-center gap-1 p-2 bg-[#0a0c11] rounded-md border border-zinc-800/40">
              <span
                className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${
                  clockLed
                    ? "bg-cyan-400 shadow-[0_0_10px_#22d3ee,0_0_20px_rgba(34,211,238,0.3)] animate-pulse"
                    : "bg-zinc-700"
                }`}
              />
              <span className="text-[9px] text-zinc-400 font-semibold tracking-wide">CLOCK</span>
              <span className="text-[8px] text-cyan-400/80">168 MHz</span>
            </div>

            {/* Trap LED */}
            <div className="flex flex-col items-center gap-1 p-2 bg-[#0a0c11] rounded-md border border-zinc-800/40">
              <span
                className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${
                  trapLed
                    ? "bg-rose-500 shadow-[0_0_10px_#f43f5e,0_0_20px_rgba(244,63,94,0.3)]"
                    : "bg-zinc-700"
                }`}
              />
              <span className="text-[9px] text-zinc-400 font-semibold tracking-wide">TRAP</span>
              <span className={`text-[8px] ${trapLed ? "text-rose-400" : "text-zinc-600"}`}>
                {trapLed ? "FAULT" : "NORMAL"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Diagnostics ── */}
      <div className="p-2.5 bg-[#111420] rounded-md border border-zinc-800/50 space-y-1.5 text-[10px] font-mono">
        <div className="flex justify-between text-zinc-500">
          <span>TARGET STATE</span>
          <span
            className={`font-bold ${
              targetStatus === "RUNNING"
                ? "text-emerald-400"
                : targetStatus === "FLASHING"
                ? "text-amber-400"
                : targetStatus === "HALTED"
                ? "text-rose-400"
                : "text-zinc-600"
            }`}
          >
            {targetStatus}
          </span>
        </div>
        <div className="flex justify-between text-zinc-500">
          <span>MEMORY BUS</span>
          <span className="text-zinc-400">0x0000 – 0x03FF (1024B)</span>
        </div>
        <div className="flex justify-between text-zinc-500">
          <span>GPIO PINS</span>
          <span className="text-zinc-400">8 OUT / 8 IN</span>
        </div>
      </div>
    </section>
  );
}
