"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { useHardwareBus } from "@/context/HardwareBusContext";

const PIN_COLORS = [
  "#22d3ee", // D0: Cyan
  "#34d399", // D1: Emerald
  "#f43f5e", // D2: Rose
  "#fbbf24", // D3: Amber
  "#a855f7", // D4: Purple
  "#38bdf8", // D5: Sky
  "#f97316", // D6: Orange
  "#ec4899", // D7: Pink
];

export default function DutPanel() {
  const { sharedMemory, appendLog } = useHardwareBus();

  // Direct DOM refs for 60 FPS LED updates — bypasses React state entirely
  const ledRefs = useRef<(HTMLDivElement | null)[]>([]);
  const animFrameRef = useRef<number | null>(null);

  // 60 FPS LED polling loop
  useEffect(() => {
    if (!sharedMemory) return;
    const sabView = new Uint8Array(sharedMemory);

    const pollLeds = () => {
      for (let pin = 0; pin < 8; pin++) {
        const el = ledRefs.current[pin];
        if (el) {
          const on = sabView[pin] > 0;
          const color = PIN_COLORS[pin];
          el.style.backgroundColor = on ? color : "#27272a";
          el.style.boxShadow = on ? `0 0 12px ${color}, 0 0 24px ${color}40` : "none";
        }
      }
      animFrameRef.current = requestAnimationFrame(pollLeds);
    };

    animFrameRef.current = requestAnimationFrame(pollLeds);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [sharedMemory]);

  // Write switch state directly to SharedArrayBuffer
  const handleSwitch = useCallback(
    (pin: number, checked: boolean) => {
      if (!sharedMemory) return;
      const sabView = new Uint8Array(sharedMemory);
      sabView[pin] = checked ? 1 : 0;
      appendLog(
        `[GPIO_IN] SW${pin - 4} (Pin ${pin}) → ${checked ? "HIGH (1)" : "LOW (0)"}`,
        "tx"
      );
    },
    [sharedMemory, appendLog]
  );

  return (
    <div className="space-y-4 font-mono">
      {/* ── OUTPUTS: LED Status Bank (Pins 0–7) ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] font-bold text-zinc-300 tracking-[0.1em] flex items-center gap-1.5 uppercase">
            <span className="w-1.5 h-1.5 rounded-sm bg-emerald-400" />
            Output LEDs (D0 – D7)
          </h3>
          <span className="text-[9px] text-zinc-600 font-mono">Port A [0:7]</span>
        </div>

        <div className="grid grid-cols-8 gap-1.5 bg-[#0a0c11] p-2.5 rounded-md border border-zinc-800/40">
          {Array.from({ length: 8 }, (_, pin) => (
            <div key={`led-${pin}`} className="flex flex-col items-center gap-1">
              <span className="text-[9px] font-bold" style={{ color: PIN_COLORS[pin] }}>
                D{pin}
              </span>
              <div
                ref={(el) => { ledRefs.current[pin] = el; }}
                className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700/50 transition-[box-shadow] duration-100"
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── INPUTS: DIP Switches (Pins 4–7) ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] font-bold text-zinc-300 tracking-[0.1em] flex items-center gap-1.5 uppercase">
            <span className="w-1.5 h-1.5 rounded-sm bg-amber-400" />
            DIP Switches (SW0 – SW3)
          </h3>
          <span className="text-[9px] text-zinc-600 font-mono">Port B [4:7]</span>
        </div>

        <div className="grid grid-cols-4 gap-2 bg-[#0a0c11] p-2.5 rounded-md border border-zinc-800/40">
          {[4, 5, 6, 7].map((pin) => (
            <div key={`sw-${pin}`} className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] text-zinc-400 font-bold">SW{pin - 4}</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  onChange={(e) => handleSwitch(pin, e.target.checked)}
                  disabled={!sharedMemory}
                />
                <div className="w-9 h-5 bg-zinc-800 rounded-full peer peer-checked:bg-amber-500 peer-disabled:opacity-30 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:rounded-full after:h-4 after:w-4 after:transition-all after:duration-200 peer-checked:after:translate-x-full peer-checked:after:bg-white peer-checked:after:shadow-[0_0_6px_rgba(251,191,36,0.5)]" />
              </label>
              <span className="text-[9px] text-zinc-600">Pin {pin}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
