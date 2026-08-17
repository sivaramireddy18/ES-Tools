"use client";

import React, { useState, useEffect } from "react";

interface PipelineStage {
  id: "fetch" | "decode" | "execute";
  label: string;
  color: string;
  glow: string;
  description: string;
}

interface Instruction {
  addr: string;
  asm: string;
  binary: string;
  mnemonic: string;
  cycles: number;
  desc: string;
}

const STAGES: PipelineStage[] = [
  {
    id: "fetch",
    label: "FETCH",
    color: "border-cyan-400 bg-cyan-500/20 text-cyan-200",
    glow: "shadow-[0_0_15px_#22d3ee]",
    description: "CPU reads the next 32-bit instruction word from Flash memory (via ART I-Code cache). Program Counter (PC) advances by 4 bytes.",
  },
  {
    id: "decode",
    label: "DECODE",
    color: "border-amber-400 bg-amber-500/20 text-amber-200",
    glow: "shadow-[0_0_15px_#f59e0b]",
    description: "Instruction decoder identifies opcode, operand registers, and addressing mode. For Thumb-2, 16-bit and 32-bit encodings both supported.",
  },
  {
    id: "execute",
    label: "EXECUTE",
    color: "border-emerald-400 bg-emerald-500/20 text-emerald-200",
    glow: "shadow-[0_0_15px_#34d399]",
    description: "ALU / FPU / Load-Store unit performs the operation. Result written to destination register or memory. Flags (N,Z,C,V) updated in xPSR.",
  },
];

const PROGRAM: Instruction[] = [
  { addr: "0x08000000", asm: "PUSH {R4, LR}", binary: "2D E9 10 40", mnemonic: "PUSH", cycles: 2, desc: "Save R4 and Link Register onto stack. SP decrements by 8." },
  { addr: "0x08000004", asm: "LDR R0, =0x40020018", binary: "4F F4 00 00", mnemonic: "LDR", cycles: 2, desc: "Load GPIOA_BSRR address (0x40020018) into R0 using PC-relative literal pool." },
  { addr: "0x08000008", asm: "MOV R1, #1", binary: "01 21", mnemonic: "MOV", cycles: 1, desc: "Move immediate value 1 into R1. Zero-extended to 32-bit. 1 cycle Thumb-2." },
  { addr: "0x0800000C", asm: "STR R1, [R0]", binary: "01 60", mnemonic: "STR", cycles: 2, desc: "Store R1 into memory address [R0] = GPIOA_BSRR. Triggers GPIO write transaction on AHB1 bus." },
  { addr: "0x08000010", asm: "LDR R4, =0x40020010", binary: "4F F4 00 04", mnemonic: "LDR", cycles: 2, desc: "Load GPIOA_ODR address into R4 for later read-back." },
  { addr: "0x08000014", asm: "LDR R2, [R4]", binary: "22 68", mnemonic: "LDR", cycles: 2, desc: "Read GPIOA_ODR register back from peripheral into R2. Confirms pin state." },
  { addr: "0x08000018", asm: "CBZ R2, 0x08000022", binary: "10 B1", mnemonic: "CBZ", cycles: 1, desc: "Compare and Branch if Zero. If R2 == 0, skip next block. No pipeline flush on taken." },
  { addr: "0x0800001C", asm: "POP {R4, PC}", binary: "BD E8 10 40", mnemonic: "POP", cycles: 3, desc: "Restore R4 and branch to saved LR. Pipeline must flush (3 cycles) on indirect branch." },
];

const REGISTERS = [
  { name: "R0", desc: "Arg/Scratch", init: "0x00000000" },
  { name: "R1", desc: "Arg/Scratch", init: "0x00000000" },
  { name: "R2", desc: "Arg/Scratch", init: "0x00000000" },
  { name: "R3", desc: "Arg/Scratch", init: "0x00000000" },
  { name: "R4", desc: "Saved (push/pop)", init: "0x00000000" },
  { name: "SP", desc: "Stack Pointer", init: "0x20007FF8" },
  { name: "LR", desc: "Link Register", init: "0x080004A2" },
  { name: "PC", desc: "Program Counter", init: "0x08000000" },
  { name: "xPSR", desc: "Status Flags N,Z,C,V", init: "0x01000000" },
];

export default function CpuPipelineViewer() {
  const [step, setStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [regValues, setRegValues] = useState<Record<string, string>>({
    R0: "0x00000000", R1: "0x00000000", R2: "0x00000000", R3: "0x00000000",
    R4: "0x00000000", SP: "0x20007FF8", LR: "0x080004A2",
    PC: "0x08000000", xPSR: "0x01000000",
  });

  // Update register values based on instruction being executed
  useEffect(() => {
    const executeIdx = step >= 2 ? step - 2 : -1;
    if (executeIdx < 0 || executeIdx >= PROGRAM.length) return;
    const instr = PROGRAM[executeIdx];
    setRegValues((prev) => {
      const next = { ...prev };
      next.PC = PROGRAM[Math.min(step, PROGRAM.length - 1)].addr;
      if (instr.mnemonic === "LDR" && instr.asm.includes("R0")) next.R0 = "0x40020018";
      if (instr.mnemonic === "MOV") next.R1 = "0x00000001";
      if (instr.mnemonic === "STR") next.xPSR = "0x01000000";
      if (instr.mnemonic === "LDR" && instr.asm.includes("R4")) next.R4 = "0x40020010";
      if (instr.mnemonic === "LDR" && instr.asm.includes("R2")) next.R2 = "0x00000001";
      if (instr.mnemonic === "PUSH") { next.SP = "0x20007FF0"; next.xPSR = "0x01000000"; }
      if (instr.mnemonic === "POP") next.SP = "0x20007FF8";
      return next;
    });
  }, [step]);

  useEffect(() => {
    if (!isPlaying) return;
    const t = setInterval(() => setStep((s) => (s + 1) % (PROGRAM.length + 2)), 1800);
    return () => clearInterval(t);
  }, [isPlaying]);

  const fetchIdx = step;
  const decodeIdx = step - 1;
  const executeIdx = step - 2;

  const fetchInstr = PROGRAM[fetchIdx] ?? null;
  const decodeInstr = PROGRAM[decodeIdx] ?? null;
  const executeInstr = PROGRAM[executeIdx] ?? null;

  return (
    <div className="flex flex-col h-full bg-[#080a0e] text-zinc-200 font-mono text-xs overflow-y-auto">
      {/* Header */}
      <div className="p-3 bg-cyan-950/20 border-b border-cyan-800/30 flex items-center justify-between shrink-0">
        <div>
          <span className="text-[11px] font-bold text-cyan-300 uppercase block">
            ⚡ ARM Cortex-M4 3-Stage In-Order Pipeline
          </span>
          <p className="text-zinc-400 text-[10px] font-sans mt-0.5">
            Fetch → Decode → Execute running simultaneously on 3 different instructions at 168MHz. Each stage takes exactly 1 clock cycle (5.95ns).
          </p>
        </div>
        <button
          onClick={() => setIsPlaying((p) => !p)}
          className={`px-3 py-1 rounded text-[10px] font-bold border cursor-pointer shrink-0 ${
            isPlaying
              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
              : "bg-amber-500/20 text-amber-300 border-amber-500/40"
          }`}
        >
          {isPlaying ? "⏸ PAUSE" : "▶ PLAY"}
        </button>
      </div>

      <div className="flex-1 p-3 space-y-3">
        {/* Pipeline Stages */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {STAGES.map((stage) => {
            const instr = stage.id === "fetch" ? fetchInstr : stage.id === "decode" ? decodeInstr : executeInstr;
            const active = !!instr;
            return (
              <div
                key={stage.id}
                className={`p-3 rounded-lg border transition-all duration-500 ${
                  active ? `${stage.color} ${stage.glow}` : "bg-[#0d1017] border-zinc-800 text-zinc-600"
                }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-[11px] uppercase">{stage.label} STAGE</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${active ? "bg-white/10" : "bg-zinc-900"}`}>
                    {active ? "ACTIVE" : "BUBBLE"}
                  </span>
                </div>
                {instr ? (
                  <div className="space-y-1.5">
                    <div className="text-[9px] text-zinc-400 font-mono">{instr.addr}</div>
                    <div className="font-bold text-[12px]">{instr.asm}</div>
                    <div className="text-[9px] bg-black/30 px-2 py-1 rounded font-mono tracking-wider">{instr.binary}</div>
                    <p className="text-[10px] font-sans leading-snug opacity-80">{instr.desc}</p>
                  </div>
                ) : (
                  <div className="text-[10px] text-zinc-600 font-sans">No instruction (pipeline bubble)</div>
                )}
                <div className="mt-2 pt-2 border-t border-white/10 text-[9px] opacity-70">{stage.description}</div>
              </div>
            );
          })}
        </div>

        {/* Step Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setIsPlaying(false); setStep((s) => Math.max(0, s - 1)); }}
            className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] font-bold cursor-pointer"
          >◀ PREV</button>
          <div className="flex gap-1 flex-1">
            {PROGRAM.map((_, i) => (
              <button
                key={i}
                onClick={() => { setIsPlaying(false); setStep(i); }}
                className={`flex-1 h-1.5 rounded-full transition-all cursor-pointer ${
                  step === i ? "bg-cyan-400" : step > i ? "bg-cyan-800" : "bg-zinc-800"
                }`}
              />
            ))}
          </div>
          <button
            onClick={() => { setIsPlaying(false); setStep((s) => Math.min(PROGRAM.length + 1, s + 1)); }}
            className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] font-bold cursor-pointer"
          >NEXT ▶</button>
        </div>

        {/* Pipeline Flow Arrow Diagram */}
        <div className="bg-[#0d1017] border border-zinc-800 rounded-lg p-3 space-y-2">
          <span className="text-[10px] font-bold text-zinc-400 uppercase">Pipeline Throughput: 1 Instruction/Cycle (After Fill)</span>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {PROGRAM.slice(0, 6).map((instr, i) => (
              <React.Fragment key={i}>
                <div className={`shrink-0 p-2 rounded border text-[9px] text-center min-w-[80px] transition-all ${
                  i === executeIdx ? "border-emerald-400 bg-emerald-500/20 text-emerald-200" :
                  i === decodeIdx  ? "border-amber-400 bg-amber-500/20 text-amber-200" :
                  i === fetchIdx   ? "border-cyan-400 bg-cyan-500/20 text-cyan-200" :
                  "border-zinc-800 text-zinc-600"
                }`}>
                  <div className="font-bold">{instr.mnemonic}</div>
                  <div className="text-[8px]">{instr.addr.slice(-4)}</div>
                  <div className="text-[8px] mt-1">
                    {i === executeIdx ? "EXEC" : i === decodeIdx ? "DEC" : i === fetchIdx ? "FET" : "DONE"}
                  </div>
                </div>
                {i < 5 && <span className="text-zinc-600 shrink-0">→</span>}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Register Bank */}
        <div className="bg-[#0d1017] border border-zinc-800 rounded-lg p-3">
          <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-2">
            🗂 ARM Cortex-M4 Register Bank (Live State)
          </span>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
            {REGISTERS.map((reg) => {
              const val = regValues[reg.name] ?? reg.init;
              const changed = val !== reg.init;
              return (
                <div
                  key={reg.name}
                  className={`p-2 rounded border transition-all ${
                    changed ? "border-cyan-500/60 bg-cyan-950/30" : "border-zinc-800 bg-[#0a0c10]"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className={`font-bold text-[10px] ${changed ? "text-cyan-300" : "text-zinc-500"}`}>{reg.name}</span>
                    {changed && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />}
                  </div>
                  <div className={`text-[9px] font-mono mt-0.5 ${changed ? "text-cyan-200" : "text-zinc-600"}`}>{val}</div>
                  <div className="text-[8px] text-zinc-600 font-sans mt-0.5">{reg.desc}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Branch Penalty Explainer */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 bg-rose-950/20 border border-rose-800/30 rounded-lg space-y-1">
            <span className="text-[10px] font-bold text-rose-300 uppercase block">⚠ Branch Penalty (Pipeline Flush)</span>
            <p className="text-[10px] text-zinc-400 font-sans leading-snug">
              When a branch (<code>BX LR</code>, <code>POP PC</code>, <code>B</code>) is executed, the 2 instructions already in Fetch and Decode stages are <strong>thrown away</strong> (pipeline flush). This costs <strong>3 wasted cycles</strong> at 168MHz = 17.9ns penalty.
            </p>
            <div className="flex gap-1 mt-1">
              <span className="px-1.5 py-0.5 bg-rose-950 text-rose-300 rounded text-[9px] border border-rose-800">Fetch: WASTED</span>
              <span className="px-1.5 py-0.5 bg-rose-950 text-rose-300 rounded text-[9px] border border-rose-800">Decode: WASTED</span>
              <span className="px-1.5 py-0.5 bg-emerald-950 text-emerald-300 rounded text-[9px] border border-emerald-800">Execute: OK</span>
            </div>
          </div>
          <div className="p-3 bg-emerald-950/20 border border-emerald-800/30 rounded-lg space-y-1">
            <span className="text-[10px] font-bold text-emerald-300 uppercase block">✅ Thumb-2 ISA Advantage</span>
            <p className="text-[10px] text-zinc-400 font-sans leading-snug">
              ARM Cortex-M4 uses <strong>Thumb-2</strong>: a mix of 16-bit compact instructions and 32-bit full-width instructions in the SAME code stream. Result: <strong>26% better code density</strong> vs pure 32-bit ARM without sacrificing performance.
            </p>
            <div className="flex gap-1 mt-1 flex-wrap">
              <span className="px-1.5 py-0.5 bg-emerald-950 text-emerald-300 rounded text-[9px] border border-emerald-800">16-bit: MOV, B, CBZ</span>
              <span className="px-1.5 py-0.5 bg-cyan-950 text-cyan-300 rounded text-[9px] border border-cyan-800">32-bit: LDR, STR, PUSH</span>
            </div>
          </div>
        </div>

        {/* FPU Info */}
        <div className="p-3 bg-purple-950/20 border border-purple-800/30 rounded-lg">
          <span className="text-[10px] font-bold text-purple-300 uppercase block mb-1">🔢 FPU — Floating Point Unit (Cortex-M4 Only)</span>
          <p className="text-[10px] text-zinc-400 font-sans">
            The M4 adds a hardware <strong>single-precision FPU</strong> with 32 × 32-bit FP registers (S0–S31). Operations like <code>VADD.F32</code>, <code>VMUL.F32</code> execute in <strong>1–14 cycles</strong> instead of hundreds of cycles for software emulation. Critical for DSP, PID controllers, and sensor fusion.
          </p>
          <div className="flex gap-3 mt-2 text-[9px] font-mono">
            <span className="text-purple-300">VADD.F32: 1 cycle</span>
            <span className="text-purple-300">VMUL.F32: 3 cycles</span>
            <span className="text-purple-300">VSQRT.F32: 14 cycles</span>
            <span className="text-zinc-500">Software sqrt: ~200 cycles</span>
          </div>
        </div>
      </div>
    </div>
  );
}
