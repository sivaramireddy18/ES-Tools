"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useHardwareBus, FIRMWARE_ROMS } from "@/context/HardwareBusContext";
import SystemHeader from "@/components/SystemHeader";
import FlasherPanel from "@/components/FlasherPanel";
import LogicAnalyzer from "@/components/LogicAnalyzer";
import DutPanel from "@/components/DutPanel";
import SerialConsole from "@/components/SerialConsole";
import MemoryInspector from "@/components/MemoryInspector";
import RegisterViewer from "@/components/RegisterViewer";
import LiveNarrationBanner from "@/components/common/LiveNarrationBanner";
import BeginnerGuideModal from "@/components/common/BeginnerGuideModal";
import McuArchitectureViewer from "@/components/mcu/McuArchitectureViewer";

type RightPanelTab = "console" | "memory" | "registers" | "routing";

/**
 * ValidationBench — High-Performance Post-Silicon Validation Workstation
 */
export default function ValidationBench() {
  const { sharedMemory, flashAndRun, hardReset, setSelectedRomId, targetStatus } =
    useHardwareBus();

  const [timebase, setTimebase] = useState(20);
  const [isPaused, setIsPaused] = useState(false);
  const [activeTab, setActiveTab] = useState<RightPanelTab>("console");
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Keyboard shortcut listener
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or select
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "SELECT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        setIsPaused((p) => !p);
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        hardReset();
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        if (targetStatus !== "FLASHING") {
          flashAndRun();
        }
      } else if (e.key >= "1" && e.key <= "5") {
        const index = parseInt(e.key, 10) - 1;
        if (index < FIRMWARE_ROMS.length) {
          setSelectedRomId(FIRMWARE_ROMS[index].id);
        }
      } else if (e.key === "?") {
        setShowShortcuts((s) => !s);
      }
    },
    [flashAndRun, hardReset, setSelectedRomId, targetStatus]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="w-screen h-screen bg-[#060709] text-zinc-200 flex flex-col font-mono select-none overflow-hidden antialiased">
      {/* ── Top System Bar ── */}
      <SystemHeader />

      {/* ── Live Layman Narration Banner ── */}
      <LiveNarrationBanner
        protocol="bench"
        currentPhase={
          targetStatus === "RUNNING"
            ? "FIRMWARE RUNNING — Core executing loop() & polling SharedArrayBuffer bus at 60Hz"
            : targetStatus === "FLASHING"
            ? "JTAG FLASHING — Loading binary image into virtual microcontroller memory"
            : targetStatus === "HALTED"
            ? "CPU HALTED — Core halted, memory registers reset to 0x00"
            : "BENCH IDLE — Select a ROM or drop a .wasm binary and click FLASH & RUN"
        }
        isStreaming={targetStatus === "RUNNING"}
        onOpenGuide={() => setIsGuideOpen(true)}
      />

      {/* ── Beginner Guide Modal ── */}
      <BeginnerGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        initialTopic="bench"
      />

      {/* ── Main 3-Column Bench Grid ── */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-[22%_53%_25%] overflow-hidden bg-[#060709]">
        {/* ─────────── LEFT: Flasher Control Panel ─────────── */}
        <FlasherPanel />

        {/* ─────────── CENTER: Logic Analyzer ─────────── */}
        <section className="h-full border-r border-zinc-800/70 bg-[#080a0e] flex flex-col overflow-hidden">
          {/* Waveform Toolbar */}
          <div className="h-10 px-3 bg-[#0d0e14] border-b border-zinc-800/60 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />
              <span className="text-[11px] font-bold text-zinc-200 tracking-wider uppercase">
                LOGIC ANALYZER // DIGITAL CHANNELS (D0 – D7)
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Keyboard Shortcuts Trigger */}
              <button
                onClick={() => setShowShortcuts((s) => !s)}
                className="px-2 py-0.5 text-[10px] text-zinc-400 hover:text-cyan-300 bg-zinc-900 border border-zinc-800 rounded font-mono cursor-pointer transition-colors"
                title="Keyboard Shortcuts (?)"
              >
                ⌨ SHORTCUTS
              </button>

              {/* Timebase Selection */}
              <div className="flex items-center gap-1">
                <span className="text-zinc-500 text-[9px] mr-1 uppercase hidden lg:inline">
                  Timebase
                </span>
                {[10, 20, 50, 100].map((val) => (
                  <button
                    key={val}
                    onClick={() => setTimebase(val)}
                    className={`px-2 py-0.5 text-[10px] rounded font-mono transition-all duration-150 cursor-pointer ${
                      timebase === val
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_8px_rgba(34,211,238,0.2)] font-bold"
                        : "bg-zinc-900/60 text-zinc-500 hover:text-zinc-300 border border-zinc-800"
                    }`}
                  >
                    {val}ms
                  </button>
                ))}
              </div>

              {/* Pause / Resume */}
              <button
                onClick={() => setIsPaused(!isPaused)}
                className={`px-2.5 py-1 text-[10px] font-bold rounded border transition-all duration-150 cursor-pointer ${
                  isPaused
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_8px_rgba(251,191,36,0.2)]"
                    : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_8px_rgba(52,211,153,0.2)]"
                }`}
              >
                {isPaused ? "▶ RESUME [Space]" : "⏸ PAUSE [Space]"}
              </button>
            </div>
          </div>

          {/* Canvas Area */}
          <div className="flex-1 w-full h-full relative overflow-hidden bg-[#080a0e]">
            <LogicAnalyzer sab={sharedMemory} timebase={timebase} isPaused={isPaused} />

            {/* Bottom metadata overlay */}
            <div className="absolute bottom-2 right-3 pointer-events-none px-2.5 py-1 bg-zinc-950/80 rounded-md border border-zinc-800/80 text-[9px] font-mono text-zinc-500 flex gap-3 backdrop-blur-sm">
              <span>SAMPLES: 500/CH (Ring Buffer O(1))</span>
              <span>RATE: 60 FPS</span>
              <span className={isPaused ? "text-amber-400 font-bold" : "text-cyan-400 font-bold"}>
                {isPaused ? "● PAUSED" : "● LIVE STREAM"}
              </span>
            </div>
          </div>
        </section>

        {/* ─────────── RIGHT: DUT I/O + Telemetry Tabs ─────────── */}
        <section className="h-full bg-[#0c0e14] flex flex-col divide-y divide-zinc-800/60 overflow-hidden">
          {/* DUT Interactive Panel: LEDs + DIP Switches */}
          <div className="p-3 shrink-0">
            <DutPanel />
          </div>

          {/* Telemetry Tabs Container */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Tab Navigation */}
            <div className="flex items-center border-b border-zinc-800/80 bg-[#0a0c10] px-2 pt-1 shrink-0 overflow-x-auto">
              <button
                onClick={() => setActiveTab("console")}
                className={`px-3 py-1.5 text-[10px] font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === "console"
                    ? "border-emerald-400 text-emerald-300 bg-[#0e1118]"
                    : "border-transparent text-zinc-500 hover:text-zinc-300"
                }`}
              >
                UART CONSOLE
              </button>
              <button
                onClick={() => setActiveTab("registers")}
                className={`px-3 py-1.5 text-[10px] font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === "registers"
                    ? "border-cyan-400 text-cyan-300 bg-[#0e1118]"
                    : "border-transparent text-zinc-500 hover:text-zinc-300"
                }`}
              >
                REGISTERS
              </button>
              <button
                onClick={() => setActiveTab("routing")}
                className={`px-3 py-1.5 text-[10px] font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === "routing"
                    ? "border-purple-400 text-purple-300 bg-[#0e1118]"
                    : "border-transparent text-zinc-500 hover:text-zinc-300"
                }`}
              >
                🏛️ MCU ROUTING
              </button>
              <button
                onClick={() => setActiveTab("memory")}
                className={`px-3 py-1.5 text-[10px] font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === "memory"
                    ? "border-amber-400 text-amber-300 bg-[#0e1118]"
                    : "border-transparent text-zinc-500 hover:text-zinc-300"
                }`}
              >
                HEX MEMORY
              </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-hidden p-2.5">
              {activeTab === "console" && <SerialConsole />}
              {activeTab === "registers" && <RegisterViewer />}
              {activeTab === "routing" && (
                <div className="h-full overflow-hidden rounded border border-zinc-800">
                  <McuArchitectureViewer />
                </div>
              )}
              {activeTab === "memory" && <MemoryInspector />}
            </div>
          </div>
        </section>
      </div>

      {/* ── Keyboard Shortcuts Modal ── */}
      {showShortcuts && (
        <div
          onClick={() => setShowShortcuts(false)}
          className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#10131c] border border-zinc-700 rounded-lg p-5 max-w-md w-full shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="text-xs font-bold text-cyan-300 tracking-wider">
                ⌨ VALIDATION BENCH KEYBOARD SHORTCUTS
              </span>
              <button
                onClick={() => setShowShortcuts(false)}
                className="text-zinc-500 hover:text-zinc-200 text-sm font-mono cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-[11px] font-mono">
              <div className="flex justify-between py-1 border-b border-zinc-800/40">
                <span className="text-zinc-400">Flash & Run Payload</span>
                <kbd className="px-2 py-0.5 bg-zinc-800 text-emerald-400 rounded border border-zinc-700 font-bold">F</kbd>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800/40">
                <span className="text-zinc-400">Hard Reset (RST)</span>
                <kbd className="px-2 py-0.5 bg-zinc-800 text-rose-400 rounded border border-zinc-700 font-bold">R</kbd>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800/40">
                <span className="text-zinc-400">Pause / Resume Analyzer</span>
                <kbd className="px-2 py-0.5 bg-zinc-800 text-cyan-400 rounded border border-zinc-700 font-bold">Space</kbd>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800/40">
                <span className="text-zinc-400">Select Firmware ROM 1 - 5</span>
                <kbd className="px-2 py-0.5 bg-zinc-800 text-amber-400 rounded border border-zinc-700 font-bold">1 – 5</kbd>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-zinc-400">Toggle Shortcuts Dialog</span>
                <kbd className="px-2 py-0.5 bg-zinc-800 text-zinc-300 rounded border border-zinc-700 font-bold">?</kbd>
              </div>
            </div>

            <div className="text-[10px] text-zinc-500 text-center pt-1 border-t border-zinc-800">
              Press <kbd className="px-1 bg-zinc-800 rounded text-zinc-300">Esc</kbd> or click outside to dismiss
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
