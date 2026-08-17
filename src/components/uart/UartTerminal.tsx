"use client";

import React, { useRef, useEffect } from "react";

export interface UartTerminalMessage {
  id: string;
  time: string;
  type: "TX" | "RX" | "ERROR" | "INFO";
  text: string;
  hex: string;
}

interface Props {
  logs: UartTerminalMessage[];
  clearLogs: () => void;
  masterBaud: number;
  receiverBaud: number;
  isMismatch: boolean;
  isStreaming: boolean;
  activeChar?: string;
  currentBit?: number;
}

export default function UartTerminal({
  logs,
  clearLogs,
  masterBaud,
  receiverBaud,
  isMismatch,
  isStreaming,
  activeChar,
  currentBit,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="flex flex-col h-full bg-[#0c0e14] border border-zinc-800/80 rounded-lg overflow-hidden font-mono text-zinc-300 select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 bg-[#0a0c10] px-3 py-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-bold text-zinc-200">
            SERIAL TRANSCEIVER & CABLE STREAM
          </span>
        </div>

        <div className="flex items-center gap-3 text-[10px]">
          {isMismatch && (
            <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded font-bold animate-pulse">
              ⚠ BAUD MISMATCH: TX {masterBaud} vs RX {receiverBaud}
            </span>
          )}
          <button
            onClick={clearLogs}
            className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
          >
            Clear
          </button>
        </div>
      </div>

      {/* ── Physical Cable / Bit-Train Visualization ── */}
      <div className="p-3 bg-[#080a0e] border-b border-zinc-800/80 space-y-2 shrink-0">
        <div className="flex justify-between items-center text-[9px] text-zinc-400 font-bold">
          <span>PHYSICAL SERIAL TX CABLE (RS-232 / TTL)</span>
          <span className={isStreaming ? "text-cyan-400 font-bold animate-pulse" : "text-zinc-500"}>
            {isStreaming ? `TRANSMITTING '${activeChar}' (BIT ${currentBit !== undefined ? currentBit : 0}/10)` : "LINE IDLE (MARK: 3.3V)"}
          </span>
        </div>

        <div className="flex items-center justify-between text-[9px]">
          {/* TX MCU Pin */}
          <div className="px-2 py-1 bg-cyan-950/60 border border-cyan-800/60 rounded text-cyan-300 font-bold shrink-0">
            MCU TX PIN
          </div>

          {/* Animated Cable Line with Traveling Bit Pulses */}
          <div className="flex-1 h-3 bg-zinc-900 rounded-full mx-2.5 relative overflow-hidden border border-zinc-800 flex items-center">
            {isStreaming && (
              <div
                className="absolute top-0 bottom-0 w-12 rounded-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-400 shadow-[0_0_10px_#22d3ee]"
                style={{
                  left: `${((currentBit !== undefined ? currentBit : 0) / 10) * 80}%`,
                  transition: "left 0.1s ease-out",
                }}
              />
            )}
            <div className="w-full text-center text-[7px] text-zinc-600 font-mono tracking-widest z-10">
              {isStreaming ? "•••• SERIAL DATA PACKET IN FLIGHT ••••" : "IDLE HIGH (3.3V)"}
            </div>
          </div>

          {/* RX Receiver Pin */}
          <div className={`px-2 py-1 rounded font-bold shrink-0 border ${
            isMismatch
              ? "bg-rose-950/60 border-rose-800/60 text-rose-300"
              : "bg-emerald-950/60 border-emerald-800/60 text-emerald-300"
          }`}>
            RX RECEIVER
          </div>
        </div>

        {/* 16x Baud Rate Oversampling Clock */}
        <div className="flex justify-between items-center text-[8px] text-zinc-500 pt-1 border-t border-zinc-800/60">
          <span>16x OVERSAMPLING BAUD CLOCK:</span>
          <span className="text-zinc-400 font-mono">
            Sample Point: <strong className="text-cyan-300">Tick 8/16</strong> (Center of Bit Period)
          </span>
        </div>
      </div>

      {/* Message Output Console */}
      <div className="flex-1 p-3 bg-[#080a0e] overflow-y-auto space-y-1 text-[11px] scrollbar-thin scrollbar-thumb-zinc-800">
        {logs.length === 0 ? (
          <div className="text-zinc-600 text-center py-6">
            Terminal ready. Transmit an ASCII string or hex payload from the master panel to observe serial framing.
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className={`p-1.5 rounded flex items-start gap-2 ${
                log.type === "TX"
                  ? "bg-cyan-500/5 border border-cyan-500/20 text-cyan-200"
                  : log.type === "RX"
                  ? "bg-emerald-500/5 border border-emerald-500/20 text-emerald-200"
                  : log.type === "ERROR"
                  ? "bg-rose-500/10 border border-rose-500/30 text-rose-300 font-bold"
                  : "text-zinc-400"
              }`}
            >
              <span className="text-zinc-600 text-[9px] shrink-0">{log.time}</span>
              <span
                className={`font-bold text-[9px] shrink-0 ${
                  log.type === "TX"
                    ? "text-cyan-400"
                    : log.type === "RX"
                    ? "text-emerald-400"
                    : "text-rose-400"
                }`}
              >
                [{log.type}]
              </span>
              <div className="flex-1 break-all">
                <span className="font-semibold">{log.text}</span>
                {log.hex && (
                  <span className="text-zinc-500 text-[10px] block mt-0.5">
                    HEX: {log.hex}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
