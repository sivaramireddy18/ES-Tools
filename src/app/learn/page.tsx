"use client";

import React from "react";
import Link from "next/link";
import SystemHeader from "@/components/SystemHeader";

const MODULES = [
  {
    phase: "🔬 Foundation — How the MCU Works",
    color: "cyan",
    items: [
      { href: "/mcu", label: "MCU Silicon & Bus Matrix", tag: "ARM Cortex-M4", desc: "Explore the AHB/APB crossbar, GPIO schematic at transistor level, memory map, and all silicon signal routing scenarios.", icon: "🏛️", difficulty: "Beginner" },
      { href: "/mcu?tab=cpu_pipeline", label: "CPU Pipeline", tag: "Fetch→Decode→Execute", desc: "See how 3 instructions run simultaneously in the 3-stage pipeline. Branch penalties, Thumb-2 ISA, FPU registers.", icon: "🔬", difficulty: "Intermediate" },
      { href: "/mcu?tab=clock_tree", label: "Clock Tree & RCC", tag: "PLL Configuration", desc: "Interactively configure PLL multiplier, bus prescalers. See how all peripheral clocks derive from one oscillator.", icon: "🕐", difficulty: "Intermediate" },
      { href: "/mcu?tab=dma_deep_dive", label: "DMA Deep-Dive", tag: "Zero CPU Overhead", desc: "All 3 DMA modes with live transfer simulator. Compare polling vs interrupt vs DMA performance.", icon: "🚀", difficulty: "Intermediate" },
    ],
  },
  {
    phase: "⚡ Peripherals — Communicating with the World",
    color: "emerald",
    items: [
      { href: "/uart", label: "UART Serial", tag: "RS232/TTL", desc: "Full UART protocol simulator with baud rate mismatch demo, frame structure, and signal decoding.", icon: "📨", difficulty: "Beginner" },
      { href: "/i2c", label: "I2C Bus", tag: "2-Wire Protocol", desc: "Multi-device bus with start/stop/ACK/NACK animation, open-drain explanation, pull-up resistor demo.", icon: "💬", difficulty: "Beginner" },
      { href: "/spi", label: "SPI Bus", tag: "4-Wire High-Speed", desc: "Full-duplex conveyor belt demo. SPI modes (CPOL/CPHA), chip select, and shift register visualization.", icon: "🔄", difficulty: "Beginner" },
      { href: "/timers", label: "Timers & PWM", tag: "TIM2/TIM3", desc: "Interactive PSC/ARR/CCR sliders. Live PWM waveform canvas, LED brightness control, servo motor demo.", icon: "⏱", difficulty: "Intermediate" },
      { href: "/adc", label: "ADC — Analog to Digital", tag: "12-bit SAR", desc: "Convert real voltages. SAR bit-by-bit animation, noise simulation, sensor emulation (thermistor, potentiometer).", icon: "🎚", difficulty: "Intermediate" },
      { href: "/interrupts", label: "Interrupts & NVIC", tag: "Priority Control", desc: "Configure preempt/sub priorities, fire interrupts, see stack frame push. ISR best practices with annotated code.", icon: "🔔", difficulty: "Intermediate" },
    ],
  },
  {
    phase: "💻 Programming — Writing Firmware",
    color: "violet",
    items: [
      { href: "/programming", label: "Embedded C Patterns", tag: "Non-Blocking Code", desc: "Bit manipulation calculator, state machines, ring buffers, callbacks, CMSIS register access, memory layout.", icon: "⚙", difficulty: "Intermediate" },
      { href: "/lab", label: "Realistic Lab Setup", tag: "Board & Oscilloscope", desc: "Virtual STM32 Nucleo board with oscilloscope, logic probe, breadboard. Understand real hardware workflow.", icon: "🔌", difficulty: "Beginner" },
      { href: "/", label: "WASM Validation Bench", tag: "Run Real Firmware", desc: "Flash real C firmware compiled to WebAssembly. Watch logic analyzer, UART console, and memory inspector live.", icon: "🖥️", difficulty: "Advanced" },
    ],
  },
];

const DIFFICULTY_COLOR: Record<string, string> = {
  Beginner: "bg-emerald-900/50 text-emerald-300 border-emerald-700",
  Intermediate: "bg-amber-900/50 text-amber-300 border-amber-700",
  Advanced: "bg-rose-900/50 text-rose-300 border-rose-700",
};

const PHASE_COLOR: Record<string, string> = {
  cyan: "border-cyan-500 bg-cyan-950/20",
  emerald: "border-emerald-500 bg-emerald-950/20",
  violet: "border-violet-500 bg-violet-950/20",
};

const PHASE_TEXT: Record<string, string> = {
  cyan: "text-cyan-300",
  emerald: "text-emerald-300",
  violet: "text-violet-300",
};

export default function LearnPage() {
  return (
    <main className="w-screen h-screen overflow-hidden bg-[#060709] flex flex-col font-mono">
      <SystemHeader />
      <div className="flex-1 overflow-y-auto">
        {/* Hero */}
        <div className="px-6 py-8 bg-gradient-to-b from-cyan-950/30 to-transparent border-b border-zinc-800/60 text-center">
          <div className="flex justify-center mb-3">
            <span className="relative flex h-3 w-3 mr-3 mt-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-400 shadow-[0_0_10px_#22d3ee]" />
            </span>
            <h1 className="text-2xl font-bold text-cyan-300 uppercase tracking-widest">
              ES Tools — Learning Path
            </h1>
          </div>
          <p className="text-zinc-400 text-sm font-sans max-w-2xl mx-auto">
            A complete interactive curriculum for embedded systems engineering. From transistors to firmware — 
            learn at silicon gate level with live simulations, register-level code, and real WASM firmware execution.
          </p>
          <div className="flex justify-center gap-3 mt-4">
            {["Beginner", "Intermediate", "Advanced"].map((d) => (
              <span key={d} className={`px-3 py-1 rounded-full text-[10px] font-bold border ${DIFFICULTY_COLOR[d]}`}>{d}</span>
            ))}
          </div>
        </div>

        {/* Module Grid */}
        <div className="px-6 py-6 space-y-8 max-w-6xl mx-auto">
          {MODULES.map((phase) => (
            <div key={phase.phase}>
              <div className={`inline-block px-4 py-1.5 rounded-lg border text-xs font-bold mb-4 ${PHASE_COLOR[phase.color]}`}>
                <span className={PHASE_TEXT[phase.color]}>{phase.phase}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {phase.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group block p-4 rounded-xl border border-zinc-800 bg-[#0d1017] hover:border-${phase.color}-500/60 hover:bg-[#10141e] transition-all duration-200 hover:shadow-[0_0_20px_rgba(0,0,0,0.5)]`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{item.icon}</span>
                        <div>
                          <div className="font-bold text-zinc-200 text-[11px] group-hover:text-cyan-300 transition-colors">{item.label}</div>
                          <div className="text-[9px] text-zinc-500">{item.tag}</div>
                        </div>
                      </div>
                      <span className={`text-[8px] px-2 py-0.5 rounded-full border font-bold shrink-0 ${DIFFICULTY_COLOR[item.difficulty]}`}>{item.difficulty}</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 font-sans leading-relaxed">{item.desc}</p>
                    <div className="mt-3 flex items-center gap-1 text-[10px] text-zinc-600 group-hover:text-cyan-400 transition-colors">
                      <span>Open module</span>
                      <span>→</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800/60 text-center text-[10px] text-zinc-600 font-sans">
          Embedded Systems Interactive Learning Engine · Built with Next.js + WebAssembly
        </div>
      </div>
    </main>
  );
}
