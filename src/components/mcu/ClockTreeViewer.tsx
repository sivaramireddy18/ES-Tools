"use client";

import React, { useState } from "react";

interface ClockNode {
  id: string;
  label: string;
  freq: number; // in MHz
  source: string;
  color: string;
  x: number;
  y: number;
  desc: string;
}

export default function ClockTreeViewer() {
  const [hsi, setHsi] = useState(true); // HSI = 16MHz internal, HSE = 8MHz external
  const [pllM, setPllM] = useState(8);   // HSI/M = VCO input
  const [pllN, setPllN] = useState(168); // VCO freq = input * N
  const [pllP, setPllP] = useState(2);   // SYSCLK = VCO / P
  const [ahbDiv, setAhbDiv] = useState(1);
  const [apb1Div, setApb1Div] = useState(4);
  const [apb2Div, setApb2Div] = useState(2);

  const sourceFreq = hsi ? 16 : 8; // MHz
  const vcoInput = sourceFreq / pllM;
  const vcoFreq = vcoInput * pllN;
  const sysclk = vcoFreq / pllP;
  const hclk = sysclk / ahbDiv;
  const apb1 = hclk / apb1Div;
  const apb2 = hclk / apb2Div;
  const apb1Timer = apb1Div > 1 ? apb1 * 2 : apb1; // TIM clock doubles if APB prescaler != 1
  const apb2Timer = apb2Div > 1 ? apb2 * 2 : apb2;
  const flashLatency = sysclk <= 30 ? 0 : sysclk <= 60 ? 1 : sysclk <= 90 ? 2 : sysclk <= 120 ? 3 : sysclk <= 150 ? 4 : 5;
  const currentMa = 10 + (sysclk / 168) * 70; // rough mA estimate

  const isVcoValid = vcoInput >= 1 && vcoInput <= 2 && vcoFreq >= 100 && vcoFreq <= 432;
  const isSysclkValid = sysclk <= 168 && isVcoValid;

  const fmt = (f: number) => f >= 1000 ? `${(f / 1000).toFixed(3)} GHz` : f >= 1 ? `${f.toFixed(1)} MHz` : `${(f * 1000).toFixed(0)} kHz`;

  const NodeBox = ({ label, freq, color, desc, badge }: { label: string; freq: number; color: string; desc: string; badge?: string }) => (
    <div className={`p-2.5 rounded-lg border ${color} space-y-0.5 text-center`}>
      <div className="text-[9px] font-bold uppercase text-zinc-400">{label}</div>
      <div className="font-bold text-[13px]">{fmt(freq)}</div>
      {badge && <span className="text-[8px] px-1 bg-black/30 rounded">{badge}</span>}
      <div className="text-[9px] text-zinc-500 font-sans leading-snug mt-1">{desc}</div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-[#080a0e] text-zinc-200 font-mono text-xs overflow-y-auto">
      {/* Header */}
      <div className="p-3 bg-sky-950/20 border-b border-sky-800/30 shrink-0">
        <span className="text-[11px] font-bold text-sky-300 uppercase block">
          🕐 RCC Clock Tree — Reset & Clock Control (Interactive)
        </span>
        <p className="text-zinc-400 text-[10px] font-sans mt-0.5">
          The PLL multiplies a low-frequency oscillator to derive the 168MHz SYSCLK. All peripheral buses are divided from it. Drag the sliders to see how every clock changes in real time.
        </p>
      </div>

      <div className="flex-1 p-3 space-y-3">
        {/* Validation Alerts */}
        {!isVcoValid && (
          <div className="p-2 bg-rose-950/40 border border-rose-500/50 rounded text-rose-300 text-[10px]">
            ⚠ VCO Input must be 1–2 MHz (currently {vcoInput.toFixed(2)} MHz). Increase PLLM. VCO freq must be 100–432 MHz (currently {vcoFreq.toFixed(0)} MHz).
          </div>
        )}
        {isSysclkValid && sysclk > 150 && (
          <div className="p-2 bg-emerald-950/40 border border-emerald-500/50 rounded text-emerald-300 text-[10px]">
            ✅ SYSCLK = {sysclk.toFixed(0)} MHz — Maximum performance mode. Flash latency = {flashLatency} wait states. Estimated current draw: {currentMa.toFixed(0)} mA.
          </div>
        )}

        {/* Clock Source + PLL Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-[#0d1017] border border-zinc-800 rounded-lg p-3 space-y-3">
            <span className="text-[10px] font-bold text-zinc-400 uppercase">1. Clock Source Selection</span>

            <div className="flex gap-2">
              <button
                onClick={() => setHsi(true)}
                className={`flex-1 py-2 rounded border text-[10px] font-bold cursor-pointer transition-all ${hsi ? "bg-cyan-500/20 border-cyan-400 text-cyan-200" : "bg-zinc-900 border-zinc-800 text-zinc-500"}`}
              >
                HSI — 16 MHz<br /><span className="font-normal text-[9px]">Internal RC Oscillator</span>
              </button>
              <button
                onClick={() => setHsi(false)}
                className={`flex-1 py-2 rounded border text-[10px] font-bold cursor-pointer transition-all ${!hsi ? "bg-amber-500/20 border-amber-400 text-amber-200" : "bg-zinc-900 border-zinc-800 text-zinc-500"}`}
              >
                HSE — 8 MHz<br /><span className="font-normal text-[9px]">External Crystal (Nucleo)</span>
              </button>
            </div>

            <div className="p-2 bg-[#060709] rounded border border-zinc-800/60 text-[9px] text-zinc-400 font-sans">
              <strong className="text-zinc-300">HSI:</strong> Always-on, no external components, ±1% accuracy. Good for UART.<br />
              <strong className="text-zinc-300">HSE:</strong> Requires external crystal, higher accuracy (&lt;0.01%), required for USB.
            </div>
          </div>

          <div className="bg-[#0d1017] border border-zinc-800 rounded-lg p-3 space-y-2">
            <span className="text-[10px] font-bold text-zinc-400 uppercase">2. PLL Configuration</span>

            {[
              { label: "PLLM (÷ divider, 2–63)", val: pllM, set: setPllM, min: 2, max: 63, desc: `VCO Input: ${vcoInput.toFixed(2)} MHz (target: 1–2 MHz)` },
              { label: "PLLN (× multiplier, 50–432)", val: pllN, set: setPllN, min: 50, max: 432, desc: `VCO Frequency: ${vcoFreq.toFixed(0)} MHz (target: 100–432 MHz)` },
              { label: "PLLP (÷ SYSCLK divider: 2/4/6/8)", val: pllP, set: setPllP, min: 1, max: 4, desc: `SYSCLK = ${sysclk.toFixed(0)} MHz` },
            ].map((s) => (
              <div key={s.label}>
                <div className="flex justify-between text-[9px] text-zinc-500 mb-0.5">
                  <span>{s.label}</span>
                  <span className={s.label.includes("PLLP") && !isSysclkValid ? "text-rose-400" : "text-cyan-400"}>{s.desc}</span>
                </div>
                <input
                  type="range" min={s.min} max={s.max} value={s.val}
                  onChange={(e) => {
                    let v = parseInt(e.target.value);
                    if (s.label.includes("PLLP")) v = [1, 2, 3, 4][Math.min(3, Math.max(0, Math.round((v - 1) / 1)))];
                    s.set(v);
                  }}
                  className="w-full h-1.5 accent-cyan-400 cursor-pointer"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Bus Prescalers */}
        <div className="bg-[#0d1017] border border-zinc-800 rounded-lg p-3 space-y-2">
          <span className="text-[10px] font-bold text-zinc-400 uppercase">3. AHB / APB Bus Prescalers</span>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { label: "AHB Prescaler (HPRE)", val: ahbDiv, set: setAhbDiv, options: [1,2,4,8,16,64,128,256,512], result: `HCLK = ${hclk.toFixed(0)} MHz`, color: "text-cyan-400" },
              { label: "APB1 Prescaler (PPRE1)", val: apb1Div, set: setApb1Div, options: [1,2,4,8,16], result: `APB1 = ${apb1.toFixed(0)} MHz | TIM = ${apb1Timer.toFixed(0)} MHz`, color: "text-purple-400" },
              { label: "APB2 Prescaler (PPRE2)", val: apb2Div, set: setApb2Div, options: [1,2,4,8,16], result: `APB2 = ${apb2.toFixed(0)} MHz | TIM = ${apb2Timer.toFixed(0)} MHz`, color: "text-emerald-400" },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-[9px] text-zinc-500 mb-1">{s.label}</div>
                <select
                  value={s.val}
                  onChange={(e) => s.set(parseInt(e.target.value))}
                  className="w-full p-1 bg-[#0c0e16] border border-zinc-700 rounded text-[10px] text-zinc-200 cursor-pointer"
                >
                  {s.options.map((o) => <option key={o} value={o}>÷ {o}</option>)}
                </select>
                <div className={`text-[9px] mt-1 ${s.color}`}>{s.result}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Visual Clock Tree */}
        <div className="bg-[#050709] border border-zinc-800 rounded-lg p-3 space-y-2">
          <span className="text-[10px] font-bold text-zinc-300 uppercase">📊 Live Clock Tree</span>

          {/* Row 1: Source */}
          <div className="flex justify-center">
            <NodeBox
              label={hsi ? "HSI Oscillator" : "HSE Crystal"}
              freq={sourceFreq}
              color="border-amber-500 bg-amber-500/10 text-amber-200"
              desc={hsi ? "Internal RC, always available" : "External 8MHz XTAL on Nucleo"}
              badge={hsi ? "±1% accuracy" : "±0.01% accuracy"}
            />
          </div>

          <div className="flex justify-center text-zinc-500">↓ ÷{pllM} (PLLM)</div>

          {/* Row 2: VCO Input → PLL → SYSCLK */}
          <div className="flex justify-center gap-4 items-center flex-wrap">
            <NodeBox
              label="VCO Input"
              freq={vcoInput}
              color={isVcoValid ? "border-sky-500 bg-sky-500/10 text-sky-200" : "border-rose-500 bg-rose-500/10 text-rose-300"}
              desc="Must be 1–2 MHz for stable PLL lock"
            />
            <span className="text-zinc-500">→ ×{pllN} (PLLN) →</span>
            <NodeBox
              label="VCO Output"
              freq={vcoFreq}
              color={isVcoValid ? "border-purple-500 bg-purple-500/10 text-purple-200" : "border-rose-500 bg-rose-500/10 text-rose-300"}
              desc="100–432 MHz range for PLL"
            />
            <span className="text-zinc-500">→ ÷{pllP * 2} (PLLP) →</span>
            <NodeBox
              label="SYSCLK"
              freq={sysclk}
              color={isSysclkValid ? "border-cyan-400 bg-cyan-500/20 text-cyan-200" : "border-rose-500 bg-rose-500/10 text-rose-300"}
              desc="System clock — feeds all buses"
              badge={`${flashLatency}WS flash`}
            />
          </div>

          <div className="flex justify-center text-zinc-500">↓ ÷{ahbDiv} (HPRE)</div>

          {/* Row 3: HCLK */}
          <div className="flex justify-center">
            <NodeBox label="HCLK (AHB)" freq={hclk} color="border-cyan-500/60 bg-cyan-500/10 text-cyan-300" desc="CPU clock, DMA, Flash, SRAM, GPIO" />
          </div>

          {/* Row 4: APB buses */}
          <div className="flex justify-center gap-8 flex-wrap">
            <div className="text-center space-y-1">
              <div className="text-[9px] text-zinc-500">÷{apb1Div}</div>
              <NodeBox label="APB1 Peripherals" freq={apb1} color="border-purple-500/60 bg-purple-500/10 text-purple-300" desc="I2C, SPI2/3, USART2-5, TIM2-14" />
              <div className="text-[9px] text-purple-400">TIM clock: {fmt(apb1Timer)}</div>
            </div>
            <div className="text-center space-y-1">
              <div className="text-[9px] text-zinc-500">÷{apb2Div}</div>
              <NodeBox label="APB2 Peripherals" freq={apb2} color="border-emerald-500/60 bg-emerald-500/10 text-emerald-300" desc="USART1, SPI1, ADC, TIM1/8, EXTI" />
              <div className="text-[9px] text-emerald-400">TIM clock: {fmt(apb2Timer)}</div>
            </div>
          </div>
        </div>

        {/* Power vs Performance */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { label: "Current Draw", val: `~${currentMa.toFixed(0)} mA`, desc: "From VDD supply (3.3V). Higher frequency = more dynamic power dissipation (P = C·V²·f).", color: "text-amber-300 border-amber-800/40 bg-amber-950/20" },
            { label: "Flash Wait States", val: `${flashLatency} WS`, desc: flashLatency === 0 ? "Zero-wait — CPU runs at Flash speed." : `CPU must wait ${flashLatency} cycles per flash access. ART Accelerator pre-fetches to hide latency.`, color: "text-sky-300 border-sky-800/40 bg-sky-950/20" },
            { label: "Overclocked?", val: sysclk > 168 ? "⚠ YES" : "✅ NO", desc: sysclk > 168 ? "STM32F4 max is 168 MHz. Overclocking voids warranty and may corrupt flash." : "Within spec. Safe for production use.", color: sysclk > 168 ? "text-rose-300 border-rose-800/40 bg-rose-950/20" : "text-emerald-300 border-emerald-800/40 bg-emerald-950/20" },
          ].map((c) => (
            <div key={c.label} className={`p-3 rounded-lg border ${c.color} space-y-1`}>
              <div className="text-[9px] font-bold uppercase">{c.label}</div>
              <div className="font-bold text-[14px]">{c.val}</div>
              <p className="text-[9px] text-zinc-500 font-sans">{c.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
