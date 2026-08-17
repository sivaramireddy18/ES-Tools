"use client";

import React, { useEffect, useRef } from "react";
import { useHardwareBus } from "@/context/HardwareBusContext";

export default function SerialConsole() {
  const { logs, clearLogs } = useHardwareBus();
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUp = useRef(false);

  // Detect if user has scrolled up (scroll lock)
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    isUserScrolledUp.current = !atBottom;
  };

  // Auto-scroll only if user hasn't scrolled up
  useEffect(() => {
    if (!isUserScrolledUp.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  const levelStyles: Record<string, { badge: string; text: string; prefix: string }> = {
    error: { badge: "text-rose-400", text: "text-rose-300 font-medium", prefix: "✕" },
    warn: { badge: "text-amber-400", text: "text-amber-300", prefix: "▲" },
    rx: { badge: "text-emerald-400", text: "text-emerald-300", prefix: "◀ RX" },
    tx: { badge: "text-cyan-400", text: "text-cyan-300", prefix: "▶ TX" },
    info: { badge: "text-zinc-500", text: "text-zinc-400", prefix: "•" },
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <span className="text-[11px] font-bold tracking-[0.08em] text-zinc-300 flex items-center gap-1.5 uppercase">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
          </span>
          Serial Console
          <span className="text-zinc-600 text-[9px] normal-case font-normal ml-1">115200 8N1</span>
        </span>

        <div className="flex items-center gap-2">
          <span className="text-[9px] text-zinc-600 font-mono">
            {logs.length} lines
          </span>
          <button
            onClick={clearLogs}
            className="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-zinc-800/50"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Log Output */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 bg-[#080a0e] border border-zinc-800/50 rounded-lg p-2.5 overflow-y-auto font-mono text-[11px] space-y-0.5"
      >
        {logs.map((log) => {
          const style = levelStyles[log.level] || levelStyles.info;
          return (
            <div
              key={log.id}
              className="leading-relaxed flex items-start gap-1.5 break-all py-px hover:bg-zinc-900/30 rounded px-1 -mx-1 transition-colors"
            >
              <span className="text-zinc-600 text-[10px] shrink-0 tabular-nums">{log.time}</span>
              <span className={`font-semibold shrink-0 text-[10px] w-6 text-right ${style.badge}`}>
                {style.prefix}
              </span>
              <span className={style.text}>{log.text}</span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
