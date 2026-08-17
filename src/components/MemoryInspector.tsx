"use client";

import React, { useEffect, useRef, useState } from "react";
import { useHardwareBus } from "@/context/HardwareBusContext";

export default function MemoryInspector() {
  const { sharedMemory } = useHardwareBus();
  const [selectedOffset, setSelectedOffset] = useState<number | null>(null);
  const [memorySlice, setMemorySlice] = useState<number[]>([]);
  const prevMemoryRef = useRef<Uint8Array | null>(null);
  const [changedIndices, setChangedIndices] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!sharedMemory) {
      setMemorySlice(new Array(128).fill(0));
      return;
    }

    const sabView = new Uint8Array(sharedMemory);
    let animId: number;
    let frameCount = 0;

    const updateMem = () => {
      frameCount++;
      // Update memory dump view every 4 frames (~15 FPS) to keep CPU overhead minimal
      if (frameCount % 4 === 0) {
        const sliceSize = 128; // display first 128 bytes (0x0000 - 0x007F)
        const currentData: number[] = [];
        const changed = new Set<number>();
        const prev = prevMemoryRef.current;

        for (let i = 0; i < sliceSize; i++) {
          const val = sabView[i];
          currentData.push(val);
          if (prev && prev[i] !== val) {
            changed.add(i);
          }
        }

        setMemorySlice(currentData);
        setChangedIndices(changed);

        if (!prevMemoryRef.current) {
          prevMemoryRef.current = new Uint8Array(sliceSize);
        }
        prevMemoryRef.current.set(currentData);
      }
      animId = requestAnimationFrame(updateMem);
    };

    animId = requestAnimationFrame(updateMem);
    return () => cancelAnimationFrame(animId);
  }, [sharedMemory]);

  const rows = [];
  for (let i = 0; i < memorySlice.length; i += 16) {
    const rowBytes = memorySlice.slice(i, i + 16);
    rows.push({ offset: i, bytes: rowBytes });
  }

  return (
    <div className="flex flex-col h-full bg-[#080a0e] text-zinc-300 font-mono text-[10px] p-2.5 space-y-2 select-none overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-1.5 shrink-0">
        <div className="flex items-center gap-1.5 font-bold tracking-wider text-cyan-400">
          <span className="w-1.5 h-1.5 rounded-sm bg-cyan-400" />
          <span>HEX MEMORY DUMP (0x0000 - 0x007F)</span>
        </div>
        <span className="text-[9px] text-zinc-500">SharedArrayBuffer Bus</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-zinc-800">
        {/* Header Offset Bar */}
        <div className="flex text-zinc-600 font-bold border-b border-zinc-800/40 pb-1">
          <span className="w-12 shrink-0">OFFSET</span>
          <div className="grid grid-cols-16 flex-1 gap-1 text-center">
            {Array.from({ length: 16 }, (_, idx) => (
              <span key={idx} className="w-4">
                {idx.toString(16).toUpperCase().padStart(2, "0")}
              </span>
            ))}
          </div>
          <span className="w-16 text-right shrink-0">ASCII</span>
        </div>

        {/* Memory Rows */}
        {rows.map((row) => (
          <div
            key={row.offset}
            className="flex items-center hover:bg-zinc-900/40 rounded px-0.5 py-0.5"
          >
            <span className="w-12 text-zinc-500 font-bold shrink-0">
              0x{row.offset.toString(16).toUpperCase().padStart(4, "0")}
            </span>
            <div className="grid grid-cols-16 flex-1 gap-1 text-center">
              {row.bytes.map((byte, col) => {
                const byteOffset = row.offset + col;
                const isChanged = changedIndices.has(byteOffset);
                const isSelected = selectedOffset === byteOffset;

                return (
                  <span
                    key={col}
                    onClick={() => setSelectedOffset(byteOffset)}
                    className={`w-4 cursor-pointer rounded-xs transition-colors duration-200 ${
                      isSelected
                        ? "bg-cyan-500/30 text-cyan-200 font-bold outline outline-1 outline-cyan-400"
                        : isChanged
                        ? "bg-amber-500/25 text-amber-300 font-bold shadow-[0_0_6px_rgba(251,191,36,0.4)]"
                        : byte > 0
                        ? "text-emerald-400 font-semibold"
                        : "text-zinc-600"
                    }`}
                  >
                    {byte.toString(16).toUpperCase().padStart(2, "0")}
                  </span>
                );
              })}
            </div>
            <span className="w-16 text-right text-zinc-500 tracking-widest shrink-0 font-sans text-[9px]">
              {row.bytes
                .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : "."))
                .join("")}
            </span>
          </div>
        ))}
      </div>

      {/* Register inspection footer */}
      {selectedOffset !== null && (
        <div className="p-1.5 bg-[#12151e] border border-zinc-800 rounded text-[9px] flex items-center justify-between shrink-0">
          <span className="text-zinc-400">
            Byte <strong className="text-cyan-300">0x{selectedOffset.toString(16).toUpperCase().padStart(4, "0")}</strong>:
          </span>
          <span className="text-emerald-400 font-bold">
            Hex: 0x{(memorySlice[selectedOffset] || 0).toString(16).toUpperCase().padStart(2, "0")} | Dec: {memorySlice[selectedOffset] || 0} | Bin: {(memorySlice[selectedOffset] || 0).toString(2).padStart(8, "0")}
          </span>
        </div>
      )}
    </div>
  );
}
