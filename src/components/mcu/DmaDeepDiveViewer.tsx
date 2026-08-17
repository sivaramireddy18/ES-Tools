"use client";

import React, { useState, useEffect, useRef } from "react";

type DmaMode = "M2P" | "P2M" | "M2M";
type DmaMethod = "polling" | "interrupt" | "dma";

const CHANNEL_MAP = [
  { stream: "DMA2 S0", ch: "CH0", peripheral: "ADC1", dir: "P→M", speed: "2.4 MSPS", color: "text-emerald-400" },
  { stream: "DMA2 S1", ch: "CH6", peripheral: "USART6 TX", dir: "M→P", speed: "10 Mbps", color: "text-cyan-400" },
  { stream: "DMA2 S2", ch: "CH4", peripheral: "USART1 RX", dir: "P→M", speed: "10 Mbps", color: "text-cyan-400" },
  { stream: "DMA2 S5", ch: "CH4", peripheral: "SPI1 TX", dir: "M→P", speed: "42 MHz", color: "text-amber-400" },
  { stream: "DMA1 S0", ch: "CH1", peripheral: "I2C1 TX", dir: "M→P", speed: "400 kHz", color: "text-purple-400" },
  { stream: "DMA1 S5", ch: "CH4", peripheral: "USART2 TX", dir: "M→P", speed: "10 Mbps", color: "text-cyan-400" },
  { stream: "DMA1 S6", ch: "CH3", peripheral: "TIM2 CH1", dir: "M→P", speed: "168 MHz", color: "text-rose-400" },
  { stream: "DMA1 S7", ch: "CH5", peripheral: "SPI3 TX", dir: "M→P", speed: "21 MHz", color: "text-amber-400" },
];

const COMPARISON = [
  {
    method: "Polling (CPU busy-wait)",
    cpuLoad: 100,
    latency: "0 cycles",
    code: `// Blocking — CPU stuck in loop\nwhile(!(USART1->SR & USART_SR_TXE));\nUSART1->DR = data;`,
    pros: "Zero setup, easiest to debug",
    cons: "CPU does nothing else while waiting. 100% CPU load. Can't do other tasks.",
    color: "border-rose-500 bg-rose-950/20",
  },
  {
    method: "Interrupt-Driven",
    cpuLoad: 5,
    latency: "12 cycles",
    code: `// ISR fires when TXE ready\nvoid USART1_IRQHandler() {\n  USART1->DR = txBuf[i++];\n}`,
    pros: "CPU is free between interrupts. Low latency.",
    cons: "ISR overhead per byte. Unpredictable timing for large transfers.",
    color: "border-amber-500 bg-amber-950/20",
  },
  {
    method: "DMA Transfer",
    cpuLoad: 0,
    latency: "setup only",
    code: `// One-shot: CPU free for 1000 bytes!\nDMA2_Stream7->M0AR = (uint32_t)buf;\nDMA2_Stream7->NDTR = length;\nDMA2_Stream7->CR |= DMA_SxCR_EN;`,
    pros: "0% CPU load during transfer. Sustained bandwidth. Best for audio, large buffers.",
    cons: "Higher setup complexity. Cache coherency issues on M7.",
    color: "border-emerald-500 bg-emerald-950/20",
  },
];

export default function DmaDeepDiveViewer() {
  const [mode, setMode] = useState<DmaMode>("P2M");
  const [circularMode, setCircularMode] = useState(false);
  const [transferSize, setTransferSize] = useState(256);
  const [transferring, setTransferring] = useState(false);
  const [progress, setProgress] = useState(0);
  const [halfComplete, setHalfComplete] = useState(false);
  const [complete, setComplete] = useState(false);
  const [cpuMethod, setCpuMethod] = useState<DmaMethod>("polling");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTransfer = () => {
    setTransferring(true);
    setProgress(0);
    setHalfComplete(false);
    setComplete(false);
    let p = 0;
    intervalRef.current = setInterval(() => {
      p += 100 / (transferSize / 8);
      if (p >= 50 && !halfComplete) setHalfComplete(true);
      if (p >= 100) {
        setProgress(100);
        setComplete(true);
        if (!circularMode) {
          setTransferring(false);
          if (intervalRef.current) clearInterval(intervalRef.current);
        } else {
          p = 0;
          setHalfComplete(false);
          setComplete(false);
        }
      } else {
        setProgress(Math.min(100, p));
      }
    }, 60);
  };

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const modeInfo = {
    P2M: { label: "Peripheral → Memory", desc: "ADC result copied to SRAM buffer. CPU reads buffer after DMA signals TC (Transfer Complete).", example: "ADC1_DR → sram_buffer[512]" },
    M2P: { label: "Memory → Peripheral", desc: "UART transmit buffer DMA-ed directly to USART1_DR. No CPU involvement per byte.", example: "uart_txBuf[1024] → USART1_DR" },
    M2M: { label: "Memory → Memory", desc: "Fast memcpy: DMA copies SRAM to SRAM at full AHB bus speed. Equivalent to memcpy but 0% CPU.", example: "srcBuf[4096] → dstBuf[4096]" },
  };

  return (
    <div className="flex flex-col h-full bg-[#080a0e] text-zinc-200 font-mono text-xs overflow-y-auto">
      <div className="p-3 bg-purple-950/20 border-b border-purple-800/30 shrink-0">
        <span className="text-[11px] font-bold text-purple-300 uppercase block">
          🚀 DMA — Direct Memory Access Controller (Deep Dive)
        </span>
        <p className="text-zinc-400 text-[10px] font-sans mt-0.5">
          DMA is a hardware controller that moves data between memory and peripherals <strong>without consuming any CPU cycles</strong>. The CPU only sets up the transfer — DMA does the rest while the CPU runs other code.
        </p>
      </div>

      <div className="flex-1 p-3 space-y-3">
        {/* Mode Selector */}
        <div className="grid grid-cols-3 gap-2">
          {(["P2M", "M2P", "M2M"] as DmaMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`p-2.5 rounded-lg border text-[10px] font-bold cursor-pointer transition-all text-left ${
                mode === m ? "bg-purple-500/20 border-purple-400 text-purple-200 shadow-[0_0_10px_#a855f7]" : "bg-zinc-900/60 border-zinc-800 text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <div>{m}</div>
              <div className="font-normal text-[9px] mt-0.5">{modeInfo[m].label}</div>
            </button>
          ))}
        </div>

        {/* Mode Detail + Simulator */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-[#0d1017] border border-zinc-800 rounded-lg p-3 space-y-2">
            <span className="text-[10px] font-bold text-purple-300 uppercase">{modeInfo[mode].label}</span>
            <p className="text-[10px] font-sans text-zinc-400">{modeInfo[mode].desc}</p>
            <div className="text-[9px] bg-[#050708] border border-zinc-800 p-2 rounded font-mono text-cyan-300">{modeInfo[mode].example}</div>

            <div className="flex items-center gap-3 pt-1">
              <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-zinc-400">
                <input type="checkbox" checked={circularMode} onChange={(e) => setCircularMode(e.target.checked)} className="accent-purple-400" />
                Circular Mode (ring buffer)
              </label>
            </div>

            <div>
              <div className="flex justify-between text-[9px] text-zinc-500 mb-1">
                <span>Transfer size: {transferSize} bytes</span>
                <span>{(transferSize / 4).toFixed(0)} words</span>
              </div>
              <input
                type="range" min={16} max={4096} value={transferSize}
                onChange={(e) => setTransferSize(parseInt(e.target.value))}
                className="w-full accent-purple-400 cursor-pointer h-1.5"
              />
            </div>

            <button
              onClick={startTransfer}
              disabled={transferring && !circularMode}
              className="w-full py-1.5 rounded font-bold text-[10px] cursor-pointer bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400 text-purple-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {transferring ? "⚡ TRANSFER IN PROGRESS..." : "▶ START DMA TRANSFER"}
            </button>
          </div>

          {/* Transfer Progress Visualizer */}
          <div className="bg-[#050709] border border-zinc-800 rounded-lg p-3 space-y-2">
            <span className="text-[10px] font-bold text-zinc-400 uppercase">Transfer Visualizer</span>

            {/* Source */}
            <div className={`p-2 rounded border text-[10px] transition-all ${transferring ? "border-cyan-400 bg-cyan-500/10 text-cyan-200" : "border-zinc-800 text-zinc-500"}`}>
              <span className="font-bold block">{mode === "P2M" ? "ADC1_DR (Peripheral)" : "SRAM Source Buffer"}</span>
              <span className="text-[9px]">{mode === "P2M" ? "0x4001204C" : "0x20000000"}</span>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[9px] text-zinc-500">
                <span>DMA NDTR (items remaining): {Math.round(transferSize * (1 - progress / 100))}</span>
                <span>{progress.toFixed(0)}%</span>
              </div>
              <div className="h-4 bg-zinc-900 rounded border border-zinc-800 relative overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white">
                  {transferring ? `${Math.round(transferSize * progress / 100)} / ${transferSize} bytes` : complete ? "COMPLETE ✓" : "IDLE"}
                </div>
              </div>
              {halfComplete && (
                <div className="text-[9px] text-amber-300 font-bold">⚡ HTIF (Half Transfer Interrupt) fired — CPU notified!</div>
              )}
              {complete && !circularMode && (
                <div className="text-[9px] text-emerald-300 font-bold">✅ TCIF (Transfer Complete Interrupt) fired — DMA disabled.</div>
              )}
              {circularMode && transferring && (
                <div className="text-[9px] text-purple-300 font-bold">🔄 Circular mode: buffer wraps. DMA never stops.</div>
              )}
            </div>

            {/* Destination */}
            <div className={`p-2 rounded border text-[10px] transition-all ${complete || (transferring && progress > 0) ? "border-emerald-400 bg-emerald-500/10 text-emerald-200" : "border-zinc-800 text-zinc-500"}`}>
              <span className="font-bold block">{mode === "M2P" ? "USART1_DR (Peripheral)" : "SRAM Destination Buffer"}</span>
              <span className="text-[9px]">{mode === "M2P" ? "0x40011004" : "0x20002000"}</span>
            </div>

            <div className="p-2 bg-zinc-900/50 rounded text-[9px] text-zinc-500 font-sans">
              <strong className="text-zinc-300">CPU during transfer:</strong> {transferring ? "🟢 Running other code — 0% DMA load!" : "Idle"}
            </div>
          </div>
        </div>

        {/* DMA Channel Map */}
        <div className="bg-[#0d1017] border border-zinc-800 rounded-lg p-3">
          <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-2">📋 STM32F4 DMA Stream/Channel Request Map</span>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
            {CHANNEL_MAP.map((ch, i) => (
              <div key={i} className="p-2 bg-[#080a0e] rounded border border-zinc-800 space-y-0.5">
                <div className={`text-[9px] font-bold ${ch.color}`}>{ch.stream} / {ch.ch}</div>
                <div className="text-[10px] text-zinc-300">{ch.peripheral}</div>
                <div className="text-[9px] text-zinc-500">{ch.dir} @ {ch.speed}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Polling vs Interrupt vs DMA */}
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-zinc-400 uppercase block">📊 Polling vs Interrupt vs DMA — Which to Use?</span>
          <div className="flex gap-2 mb-2">
            {(["polling", "interrupt", "dma"] as DmaMethod[]).map((m) => (
              <button
                key={m}
                onClick={() => setCpuMethod(m)}
                className={`flex-1 py-1 rounded border text-[10px] font-bold cursor-pointer transition-all capitalize ${cpuMethod === m ? "bg-cyan-500/20 border-cyan-400 text-cyan-200" : "bg-zinc-900 border-zinc-800 text-zinc-500"}`}
              >
                {m}
              </button>
            ))}
          </div>
          {COMPARISON.filter(c => c.method.toLowerCase().includes(cpuMethod)).map((c) => (
            <div key={c.method} className={`p-3 rounded-lg border ${c.color} space-y-2`}>
              <div className="flex justify-between items-center">
                <span className="font-bold text-[11px]">{c.method}</span>
                <span className="text-[9px] px-2 py-0.5 bg-black/30 rounded">CPU Load: {c.cpuLoad}%</span>
              </div>
              <div className="h-2 bg-zinc-900 rounded overflow-hidden">
                <div className={`h-full transition-all ${c.cpuLoad === 100 ? "bg-rose-500" : c.cpuLoad === 0 ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${c.cpuLoad}%` }} />
              </div>
              <pre className="text-[9px] bg-[#050708] p-2 rounded border border-zinc-800 text-cyan-300 overflow-x-auto">{c.code}</pre>
              <div className="grid grid-cols-2 gap-2 text-[9px]">
                <div className="text-emerald-400"><strong>✅ PRO:</strong> {c.pros}</div>
                <div className="text-rose-400"><strong>⚠ CON:</strong> {c.cons}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
