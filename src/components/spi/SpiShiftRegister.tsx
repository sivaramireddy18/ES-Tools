"use client";

import React from "react";

interface Props {
  masterByte: number;
  slaveByte: number;
  activeBit: number; // 0..7
  isTransferring: boolean;
  bitOrder: "MSB" | "LSB";
}

export default function SpiShiftRegister({
  masterByte,
  slaveByte,
  activeBit,
  isTransferring,
  bitOrder,
}: Props) {
  const masterBits = Array.from({ length: 8 }, (_, i) => {
    const bitPos = bitOrder === "MSB" ? 7 - i : i;
    return (masterByte >> bitPos) & 1;
  });

  const slaveBits = Array.from({ length: 8 }, (_, i) => {
    const bitPos = bitOrder === "MSB" ? 7 - i : i;
    return (slaveByte >> bitPos) & 1;
  });

  const curMosiBit = masterBits[activeBit] ?? 0;
  const curMisoBit = slaveBits[activeBit] ?? 0;

  return (
    <div className="p-3 bg-[#080a0e] rounded-lg border border-zinc-800 font-mono text-[10px] space-y-3 select-none">
      <div className="flex justify-between items-center border-b border-zinc-800/80 pb-1.5">
        <div className="flex items-center gap-1.5 font-bold text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] animate-pulse" />
          <span>FULL-DUPLEX SHIFT REGISTER & PHYSICAL BUS</span>
        </div>
        <span className="text-[9px] text-zinc-500">
          {bitOrder}-First Transfer
        </span>
      </div>

      {/* ── Master Shift Register ── */}
      <div className="space-y-1 bg-[#0d1017] p-2.5 rounded border border-zinc-800/80">
        <div className="flex justify-between text-zinc-400 items-center">
          <span className="text-[9px] font-bold text-cyan-300">MASTER MCU SHIFT REGISTER</span>
          <span className="text-cyan-400 font-bold bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/60">
            0x{masterByte.toString(16).toUpperCase().padStart(2, "0")} (bin: {masterByte.toString(2).padStart(8, "0")})
          </span>
        </div>
        <div className="grid grid-cols-8 gap-1 pt-1">
          {masterBits.map((bit, idx) => {
            const isCur = isTransferring && activeBit === idx;
            return (
              <div
                key={idx}
                className={`py-1.5 text-center rounded border font-bold transition-all duration-200 ${
                  isCur
                    ? "bg-cyan-400 text-zinc-950 border-cyan-200 shadow-[0_0_12px_#22d3ee] scale-110 -translate-y-0.5"
                    : bit === 1
                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                    : "bg-zinc-900/80 text-zinc-600 border-zinc-800"
                }`}
              >
                <span className="text-[7px] text-zinc-500 block">b{7 - idx}</span>
                <span>{bit}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Physical Bus Wires with Animated Travelling Electrons ── */}
      <div className="bg-[#050608] p-2.5 rounded border border-zinc-800/80 space-y-2 relative overflow-hidden">
        {/* MOSI Wire */}
        <div className="flex items-center justify-between text-[9px] relative">
          <span className="text-emerald-400 font-bold w-12">MOSI →</span>
          <div className="flex-1 h-2 bg-zinc-900 rounded-full mx-2 relative overflow-hidden border border-zinc-800">
            {isTransferring && (
              <div
                className="absolute top-0 bottom-0 w-8 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 shadow-[0_0_8px_#34d399] animate-[marquee_1s_linear_infinite]"
                style={{
                  left: `${(activeBit / 7) * 75}%`,
                  transition: "left 0.15s ease-out",
                }}
              />
            )}
          </div>
          <span className="text-emerald-300 font-bold px-1.5 py-0.2 bg-emerald-950/60 rounded border border-emerald-800/60 text-[9px]">
            BIT: {curMosiBit}
          </span>
        </div>

        {/* MISO Wire */}
        <div className="flex items-center justify-between text-[9px] relative">
          <span className="text-rose-400 font-bold w-12">← MISO</span>
          <div className="flex-1 h-2 bg-zinc-900 rounded-full mx-2 relative overflow-hidden border border-zinc-800">
            {isTransferring && (
              <div
                className="absolute top-0 bottom-0 w-8 rounded-full bg-gradient-to-r from-rose-400 to-amber-400 shadow-[0_0_8px_#f43f5e]"
                style={{
                  right: `${(activeBit / 7) * 75}%`,
                  transition: "right 0.15s ease-out",
                }}
              />
            )}
          </div>
          <span className="text-rose-300 font-bold px-1.5 py-0.2 bg-rose-950/60 rounded border border-rose-800/60 text-[9px]">
            BIT: {curMisoBit}
          </span>
        </div>

        {/* SCK Clock Line */}
        <div className="flex items-center justify-between text-[8px] text-zinc-500 pt-0.5 border-t border-zinc-800/60">
          <span>SCK CLOCK TICK:</span>
          <span className={isTransferring ? "text-cyan-400 font-bold animate-pulse" : ""}>
            {isTransferring ? `CLOCK CYCLE ${activeBit + 1} / 8 (50% DUTY)` : "IDLE (CLOCK AT REST)"}
          </span>
        </div>
      </div>

      {/* ── Slave Shift Register ── */}
      <div className="space-y-1 bg-[#0d1017] p-2.5 rounded border border-zinc-800/80">
        <div className="flex justify-between text-zinc-400 items-center">
          <span className="text-[9px] font-bold text-rose-300">SLAVE PERIPHERAL SHIFT REGISTER</span>
          <span className="text-rose-400 font-bold bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-800/60">
            0x{slaveByte.toString(16).toUpperCase().padStart(2, "0")} (bin: {slaveByte.toString(2).padStart(8, "0")})
          </span>
        </div>
        <div className="grid grid-cols-8 gap-1 pt-1">
          {slaveBits.map((bit, idx) => {
            const isCur = isTransferring && activeBit === idx;
            return (
              <div
                key={idx}
                className={`py-1.5 text-center rounded border font-bold transition-all duration-200 ${
                  isCur
                    ? "bg-rose-500 text-zinc-950 border-rose-200 shadow-[0_0_12px_#f43f5e] scale-110 -translate-y-0.5"
                    : bit === 1
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                    : "bg-zinc-900/80 text-zinc-600 border-zinc-800"
                }`}
              >
                <span className="text-[7px] text-zinc-500 block">b{7 - idx}</span>
                <span>{bit}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
