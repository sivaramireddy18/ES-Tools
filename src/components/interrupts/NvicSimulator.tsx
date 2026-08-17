"use client";

import React, { useState, useEffect, useRef } from "react";

interface IrqLine {
  id: string;
  name: string;
  preempt: number;
  sub: number;
  isrCode: string;
  latencyCycles: number;
  color: string;
}

const DEFAULT_IRQS: IrqLine[] = [
  { id: "exti0", name: "EXTI0 (Button)", preempt: 2, sub: 0, isrCode: "void EXTI0_IRQHandler() {\n  EXTI->PR |= EXTI_PR_PR0; // clear flag\n  toggleLed(); // short ISR!\n}", latencyCycles: 12, color: "emerald" },
  { id: "usart1", name: "USART1 (RX)", preempt: 1, sub: 1, isrCode: "void USART1_IRQHandler() {\n  rxBuf[head++] = USART1->DR;\n  if (head >= BUF_SIZE) head = 0;\n}", latencyCycles: 12, color: "cyan" },
  { id: "tim2", name: "TIM2 (1kHz tick)", preempt: 3, sub: 0, isrCode: "void TIM2_IRQHandler() {\n  TIM2->SR &= ~TIM_SR_UIF; // MUST clear!\n  systemTick++;\n}", latencyCycles: 12, color: "amber" },
  { id: "dma2", name: "DMA2 S0 (ADC done)", preempt: 0, sub: 0, isrCode: "void DMA2_Stream0_IRQHandler() {\n  DMA2->LIFCR = DMA_LIFCR_CTCIF0;\n  processAdcData(adcBuf, 512);\n}", latencyCycles: 12, color: "rose" },
];

const VT_ENTRIES = [
  { offset: "0x0000", name: "Initial SP value", val: "0x20020000" },
  { offset: "0x0004", name: "Reset Handler", val: "0x08000149" },
  { offset: "0x0008", name: "NMI Handler", val: "0x080001A3" },
  { offset: "0x000C", name: "HardFault Handler", val: "0x080001B5" },
  { offset: "0x0010", name: "MemManage Handler", val: "0x080001C7" },
  { offset: "0x0014", name: "BusFault Handler", val: "0x080001D9" },
  { offset: "0x003C", name: "SysTick Handler", val: "0x08000209" },
  { offset: "0x0058", name: "EXTI0 Handler", val: "0x0800023D" },
  { offset: "0x00D4", name: "USART1 Handler", val: "0x08000301" },
  { offset: "0x00B0", name: "TIM2 Handler", val: "0x080002A5" },
  { offset: "0x0070", name: "DMA2_Str0 Handler", val: "0x08000269" },
];

export default function NvicSimulator() {
  const [irqs, setIrqs] = useState<IrqLine[]>(DEFAULT_IRQS);
  const [activeTab, setActiveTab] = useState<"priority" | "vector_table" | "stack_frame" | "best_practices">("priority");
  const [simulatingId, setSimulatingId] = useState<string | null>(null);
  const [nestingStack, setNestingStack] = useState<string[]>([]);
  const [preemptBits, setPreemptBits] = useState(4); // PRIGROUP

  const setPreempt = (id: string, val: number) => setIrqs((prev) => prev.map((q) => q.id === id ? { ...q, preempt: val } : q));
  const setSub = (id: string, val: number) => setIrqs((prev) => prev.map((q) => q.id === id ? { ...q, sub: val } : q));

  const sortedIrqs = [...irqs].sort((a, b) => a.preempt !== b.preempt ? a.preempt - b.preempt : a.sub - b.sub);
  const highestPriority = sortedIrqs[0];

  const simulateFire = (irq: IrqLine) => {
    setSimulatingId(irq.id);
    setNestingStack((s) => [...s, irq.name]);
    setTimeout(() => {
      setSimulatingId(null);
      setNestingStack((s) => s.filter((n) => n !== irq.name));
    }, 2000);
  };

  const colorMap: Record<string, string> = {
    emerald: "border-emerald-400 bg-emerald-500/20 text-emerald-200",
    cyan: "border-cyan-400 bg-cyan-500/20 text-cyan-200",
    amber: "border-amber-400 bg-amber-500/20 text-amber-200",
    rose: "border-rose-400 bg-rose-500/20 text-rose-200",
  };

  const STACK_FRAME = [
    { name: "xPSR", desc: "Execution Program Status Register", addr: "SP+28" },
    { name: "PC", desc: "Return address (next instruction after interrupt)", addr: "SP+24" },
    { name: "LR", desc: "Link Register (EXC_RETURN magic value)", addr: "SP+20" },
    { name: "R12", desc: "Scratch register", addr: "SP+16" },
    { name: "R3", desc: "Argument register 4", addr: "SP+12" },
    { name: "R2", desc: "Argument register 3", addr: "SP+8" },
    { name: "R1", desc: "Argument register 2", addr: "SP+4" },
    { name: "R0", desc: "Argument register 1 / Return value", addr: "SP+0" },
  ];

  return (
    <div className="flex flex-col h-full bg-[#080a0e] text-zinc-200 font-mono text-xs overflow-y-auto">
      <div className="p-3 bg-rose-950/20 border-b border-rose-800/30 shrink-0">
        <span className="text-[11px] font-bold text-rose-300 uppercase block">🔔 NVIC — Nested Vectored Interrupt Controller (Complete Guide)</span>
        <p className="text-zinc-400 text-[10px] font-sans mt-0.5">The NVIC handles up to 82 interrupt sources with configurable priorities. When a higher-priority interrupt fires during an ISR, the CPU automatically preempts and nests — in just 12 clock cycles.</p>
      </div>

      {/* Sub-tabs */}
      <div className="flex border-b border-zinc-800 bg-[#0d1017] px-2 pt-1 gap-1 shrink-0 overflow-x-auto">
        {[
          { id: "priority", label: "🎚 Priority Sandbox" },
          { id: "vector_table", label: "📋 Vector Table" },
          { id: "stack_frame", label: "📦 Stack Frame" },
          { id: "best_practices", label: "✅ ISR Best Practices" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as typeof activeTab)}
            className={`px-3 py-1.5 text-[10px] font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === t.id
                ? "border-rose-400 text-rose-300 bg-[#141824]"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 p-3 space-y-3 overflow-y-auto">
        {/* ── Priority Sandbox ── */}
        {activeTab === "priority" && (
          <>
            <div className="flex items-center gap-3 bg-[#0d1017] border border-zinc-800 rounded-lg p-2">
              <span className="text-[9px] text-zinc-500 shrink-0">PRIGROUP (preempt bits):</span>
              {[4, 3, 2, 1, 0].map((b) => (
                <button
                  key={b}
                  onClick={() => setPreemptBits(b)}
                  className={`px-2 py-0.5 rounded text-[9px] font-bold cursor-pointer border transition-all ${preemptBits === b ? "bg-rose-500/20 border-rose-400 text-rose-200" : "bg-zinc-900 border-zinc-800 text-zinc-500"}`}
                >
                  {b}:{4 - b} ({Math.pow(2, b)} pre / {Math.pow(2, 4 - b)} sub)
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {irqs.map((irq) => {
                const isHighest = irq.id === highestPriority.id;
                const isActive = simulatingId === irq.id;
                return (
                  <div
                    key={irq.id}
                    className={`p-3 rounded-lg border transition-all ${isActive ? colorMap[irq.color] + " shadow-[0_0_15px]" : "bg-[#0d1017] border-zinc-800"}`}
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[11px]">{irq.name}</span>
                          {isHighest && <span className="text-[8px] px-1.5 py-0.5 bg-rose-500/30 text-rose-300 rounded font-bold border border-rose-500/40">HIGHEST</span>}
                          {isActive && <span className="text-[8px] text-amber-300 animate-pulse font-bold">⚡ ISR RUNNING...</span>}
                        </div>
                        <div className="text-[9px] text-zinc-500 mt-0.5">Latency: {irq.latencyCycles} cycles (71.4ns at 168MHz)</div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div>
                          <div className="text-[9px] text-zinc-500 mb-0.5">Preempt ({Math.pow(2, preemptBits)} levels)</div>
                          <select
                            value={irq.preempt}
                            onChange={(e) => setPreempt(irq.id, parseInt(e.target.value))}
                            className="p-1 bg-[#0c0e16] border border-zinc-700 rounded text-[10px] text-zinc-200 cursor-pointer"
                          >
                            {Array.from({ length: Math.pow(2, preemptBits) }, (_, i) => (
                              <option key={i} value={i}>{i} {i === 0 ? "(HIGHEST)" : i === Math.pow(2, preemptBits) - 1 ? "(lowest)" : ""}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div className="text-[9px] text-zinc-500 mb-0.5">Sub-priority</div>
                          <select
                            value={irq.sub}
                            onChange={(e) => setSub(irq.id, parseInt(e.target.value))}
                            className="p-1 bg-[#0c0e16] border border-zinc-700 rounded text-[10px] text-zinc-200 cursor-pointer"
                          >
                            {Array.from({ length: Math.pow(2, 4 - preemptBits) }, (_, i) => (
                              <option key={i} value={i}>{i}</option>
                            ))}
                          </select>
                        </div>
                        <button
                          onClick={() => simulateFire(irq)}
                          disabled={!!simulatingId}
                          className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 rounded text-[10px] font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                          FIRE ⚡
                        </button>
                      </div>
                    </div>

                    <div className="mt-2">
                      <div className="flex justify-between text-[9px] text-zinc-600 mb-0.5">
                        <span>Encoded priority byte</span>
                        <span>0x{((irq.preempt << (8 - preemptBits)) | irq.sub).toString(16).toUpperCase().padStart(2, "0")}</span>
                      </div>
                      <div className="h-1.5 bg-zinc-900 rounded overflow-hidden">
                        <div
                          className={`h-full transition-all ${irq.color === "rose" ? "bg-rose-500" : irq.color === "emerald" ? "bg-emerald-500" : irq.color === "cyan" ? "bg-cyan-500" : "bg-amber-500"}`}
                          style={{ width: `${100 - (irq.preempt / 15) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {nestingStack.length > 0 && (
              <div className="p-3 bg-amber-950/20 border border-amber-500/40 rounded-lg">
                <span className="text-[10px] font-bold text-amber-300 block mb-1">📚 Interrupt Nesting Stack:</span>
                <div className="flex gap-2 flex-wrap">
                  {nestingStack.map((n, i) => (
                    <span key={i} className="px-2 py-1 bg-amber-950 border border-amber-700 text-amber-300 rounded text-[9px]">[{i}] {n}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="p-2.5 bg-[#0d1017] border border-zinc-800 rounded text-[9px] font-sans text-zinc-400">
              <strong className="text-zinc-300">Preemption Rule:</strong> IRQ-A can preempt IRQ-B <em>only if A's preempt priority is numerically LOWER (= higher urgency)</em>. Sub-priority only decides order when two IRQs with the same preempt priority are both pending — no nesting between them.
            </div>
          </>
        )}

        {/* ── Vector Table ── */}
        {activeTab === "vector_table" && (
          <div className="space-y-3">
            <div className="p-3 bg-sky-950/20 border border-sky-800/30 rounded-lg text-[10px]">
              <span className="font-bold text-sky-300 uppercase block mb-1">📋 Interrupt Vector Table — Starting at 0x00000000</span>
              <p className="text-zinc-400 font-sans">On ARM Cortex-M, the vector table is an array of 32-bit function pointers stored in Flash from address 0x00000000. On STM32F4, this is remapped from 0x08000000 via the BOOT0 pin or VTOR register. When an interrupt fires, the NVIC reads the table entry and jumps to the ISR in 12 clock cycles.</p>
            </div>
            <div className="space-y-1">
              {VT_ENTRIES.map((e, i) => (
                <div key={i} className="flex gap-3 p-2 bg-[#0d1017] border border-zinc-800 rounded text-[10px]">
                  <span className="text-sky-400 font-bold w-16 shrink-0">{e.offset}</span>
                  <span className="text-zinc-300 flex-1">{e.name}</span>
                  <span className="text-emerald-400 font-mono">{e.val}</span>
                </div>
              ))}
            </div>
            <pre className="text-[9px] text-cyan-300 bg-[#050709] p-3 rounded border border-zinc-800 overflow-x-auto">{`// In startup_stm32f4xx.s (assembly)
  .section .isr_vector,"a",%progbits
  .word _estack           // Initial MSP
  .word Reset_Handler     // 0x0004
  .word NMI_Handler       // 0x0008
  .word HardFault_Handler // 0x000C
  ...
  .word EXTI0_IRQHandler  // 0x0058
  .word USART1_IRQHandler // 0x00D4
  // Weak symbols → user overrides in .c files`}</pre>
          </div>
        )}

        {/* ── Stack Frame ── */}
        {activeTab === "stack_frame" && (
          <div className="space-y-3">
            <div className="p-3 bg-purple-950/20 border border-purple-800/30 rounded-lg">
              <span className="font-bold text-purple-300 uppercase block mb-1 text-[10px]">📦 Hardware Stack Frame — What CPU Saves Automatically (12 cycles)</span>
              <p className="text-zinc-400 text-[10px] font-sans">When an interrupt fires, the CPU automatically pushes 8 registers (32 bytes) onto the current stack. This happens in <strong>12 clock cycles</strong> — entirely in hardware, no software overhead!</p>
            </div>
            <div className="space-y-1">
              {STACK_FRAME.map((f, i) => (
                <div key={i} className={`flex gap-3 p-2.5 rounded border text-[10px] ${i === 0 || i === 1 ? "border-cyan-500/40 bg-cyan-950/20" : i === 7 ? "border-emerald-500/40 bg-emerald-950/20" : "border-zinc-800 bg-[#0d1017]"}`}>
                  <span className="font-bold text-purple-300 w-10 shrink-0">{f.name}</span>
                  <span className="text-zinc-400 flex-1 font-sans">{f.desc}</span>
                  <span className="text-amber-400 font-mono text-[9px]">{f.addr}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 text-[10px]">
              <div className="p-2.5 bg-[#0d1017] border border-zinc-800 rounded">
                <span className="font-bold text-cyan-300 block mb-1">EXC_RETURN magic values</span>
                <div className="space-y-1 text-[9px]">
                  <div><span className="text-amber-300">0xFFFFFFF9</span> — Return to Thread mode, MSP</div>
                  <div><span className="text-amber-300">0xFFFFFFFD</span> — Return to Thread mode, PSP</div>
                  <div><span className="text-amber-300">0xFFFFFFF1</span> — Return to Handler mode, MSP</div>
                </div>
              </div>
              <div className="p-2.5 bg-[#0d1017] border border-zinc-800 rounded">
                <span className="font-bold text-emerald-300 block mb-1">Tail-chaining optimization</span>
                <p className="text-[9px] text-zinc-400 font-sans">If a second interrupt is pending when the first ISR exits, CPU skips the pop/push (saves 6 cycles) and goes directly to the next ISR. Called "tail-chaining".</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Best Practices ── */}
        {activeTab === "best_practices" && (
          <div className="space-y-3">
            {[
              {
                title: "✅ Always clear the interrupt flag FIRST",
                color: "border-emerald-500 bg-emerald-950/20 text-emerald-200",
                code: "// WRONG — flag still set after ISR exits → infinite re-entry!\nvoid EXTI0_IRQHandler() { doWork(); EXTI->PR = BIT0; }\n\n// CORRECT — clear immediately on entry\nvoid EXTI0_IRQHandler() { EXTI->PR = BIT0; doWork(); }",
                desc: "If you don't clear the flag, the NVIC immediately re-enters the ISR after it returns, causing an infinite loop (appears as 100% CPU lock).",
              },
              {
                title: "✅ Keep ISRs extremely short — use flags + main loop",
                color: "border-cyan-500 bg-cyan-950/20 text-cyan-200",
                code: "// BAD — blocking UART TX inside ISR!\nvoid TIM2_IRQHandler() { HAL_UART_Transmit(&h, buf, 100, 1000); }\n\n// GOOD — set a flag, let main() handle it\nvolatile bool sendReady = false;\nvoid TIM2_IRQHandler() { TIM2->SR &= ~TIM_SR_UIF; sendReady = true; }",
                desc: "Long ISRs block all lower-priority interrupts and introduce latency jitter. Do heavy work in main() by checking a volatile flag.",
              },
              {
                title: "✅ Always use volatile for shared variables",
                color: "border-amber-500 bg-amber-950/20 text-amber-200",
                code: "// WRONG — compiler caches in register, never sees ISR update\nbool done = false;\nwhile (!done) { /* infinite loop */ }\n\n// CORRECT — volatile forces memory read every loop iteration\nvolatile bool done = false;\nwhile (!done) { /* exits when ISR sets it */ }",
                desc: "Without volatile, the compiler assumes the variable can't change and caches it in a CPU register. Your polling loop will spin forever.",
              },
              {
                title: "✅ Use __disable_irq() / __enable_irq() for critical sections",
                color: "border-purple-500 bg-purple-950/20 text-purple-200",
                code: "__disable_irq(); // CPSID I — disable all maskable IRQs\ncounter++;       // Safe — no ISR can interrupt this\n__enable_irq();  // CPSIE I — re-enable\n\n// Or use atomic: __LDREX / __STREX (Cortex-M4)",
                desc: "If an ISR writes to a multi-byte variable that your main code reads, disable interrupts briefly to prevent torn reads (e.g., 32-bit value split across two bus transactions).",
              },
            ].map((bp) => (
              <div key={bp.title} className={`p-3 rounded-lg border ${bp.color} space-y-2`}>
                <span className="font-bold text-[11px] block">{bp.title}</span>
                <p className="text-[10px] font-sans text-zinc-400">{bp.desc}</p>
                <pre className="text-[9px] bg-[#050709] p-2 rounded border border-zinc-800 text-cyan-300 overflow-x-auto">{bp.code}</pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
