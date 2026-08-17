"use client";

import React, { useState, useEffect, useRef } from "react";

type PwmMode = "led" | "servo" | "motor";

const MODE_CONFIGS = {
  led: { label: "LED Dimming", freq: 1000, minDuty: 0, maxDuty: 100, unit: "%" },
  servo: { label: "Servo Motor (50Hz)", freq: 50, minDuty: 5, maxDuty: 10, unit: "% (5–10% = 0°–180°)" },
  motor: { label: "DC Motor (20kHz)", freq: 20000, minDuty: 0, maxDuty: 100, unit: "% speed" },
};

const TIMER_REGISTERS = [
  { name: "TIMx_PSC", desc: "Prescaler — divides the input clock", formula: "f_CK_CNT = f_TIM / (PSC + 1)" },
  { name: "TIMx_ARR", desc: "Auto-Reload Register — sets the period", formula: "f_PWM = f_CK_CNT / (ARR + 1)" },
  { name: "TIMx_CCR1", desc: "Capture/Compare Register — sets duty", formula: "Duty% = CCR1 / (ARR + 1) × 100" },
  { name: "TIMx_CR1", desc: "Control Reg 1 — enable counter", formula: "Bit 0: CEN (Counter Enable)" },
  { name: "TIMx_CCMR1", desc: "Capture/Compare Mode — PWM mode 1", formula: "Bits [6:4] = 110 → PWM Mode 1" },
  { name: "TIMx_CCER", desc: "Output Enable — connect to pin", formula: "Bit 0: CC1E (Channel 1 Enable)" },
];

export default function TimerSimulator() {
  const [psc, setPsc] = useState(167);       // prescaler
  const [arr, setArr] = useState(999);       // auto-reload
  const [ccr, setCcr] = useState(499);       // compare value
  const [pwmMode, setPwmMode] = useState<PwmMode>("led");
  const [activeTab, setActiveTab] = useState<"pwm" | "input_capture" | "output_compare" | "registers">("pwm");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const phaseRef = useRef(0);

  const timClk = 168; // MHz (APB1 timer clock = 84*2=168 or APB2=168)
  const cntClk = timClk / (psc + 1); // MHz
  const pwmFreq = (cntClk * 1e6) / (arr + 1); // Hz
  const dutyPct = ((ccr + 1) / (arr + 1)) * 100;
  const period_us = 1e6 / pwmFreq;
  const highTime_us = period_us * (dutyPct / 100);

  // Compute register values
  const pscReg = `0x${psc.toString(16).toUpperCase().padStart(4, "0")}`;
  const arrReg = `0x${arr.toString(16).toUpperCase().padStart(4, "0")}`;
  const ccrReg = `0x${ccr.toString(16).toUpperCase().padStart(4, "0")}`;

  // PWM Waveform Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width, H = canvas.height;
    const duty = dutyPct / 100;

    const draw = () => {
      ctx.fillStyle = "#05070a";
      ctx.fillRect(0, 0, W, H);

      // Grid
      ctx.strokeStyle = "#1e2332";
      ctx.lineWidth = 0.5;
      for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += H / 4) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      const cycles = 4;
      const cycleW = W / cycles;
      const yHigh = H * 0.15;
      const yLow = H * 0.75;
      const yMid = H * 0.5;

      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 2;
      ctx.shadowColor = "#22d3ee";
      ctx.shadowBlur = 6;
      ctx.beginPath();

      for (let c = 0; c < cycles; c++) {
        const xStart = c * cycleW;
        const xHigh = xStart + cycleW * duty;
        const xEnd = xStart + cycleW;

        if (c === 0) ctx.moveTo(xStart, yHigh);
        ctx.lineTo(xHigh, yHigh);
        ctx.lineTo(xHigh, yLow);
        ctx.lineTo(xEnd, yLow);
        ctx.lineTo(xEnd, yHigh);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Duty label
      ctx.fillStyle = "#22d3ee";
      ctx.font = "bold 10px monospace";
      ctx.fillText(`${dutyPct.toFixed(1)}% duty`, 6, H - 6);

      // HIGH / LOW labels
      ctx.fillStyle = "#34d399";
      ctx.font = "9px monospace";
      ctx.fillText("3.3V (HIGH)", 4, yHigh - 4);
      ctx.fillStyle = "#f43f5e";
      ctx.fillText("0V (LOW)", 4, yLow + 12);

      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [dutyPct]);

  const fmtFreq = (f: number) => f >= 1e6 ? `${(f/1e6).toFixed(2)} MHz` : f >= 1e3 ? `${(f/1e3).toFixed(2)} kHz` : `${f.toFixed(2)} Hz`;

  return (
    <div className="flex flex-col h-full bg-[#080a0e] text-zinc-200 font-mono text-xs overflow-y-auto">
      {/* Header */}
      <div className="p-3 bg-orange-950/20 border-b border-orange-800/30 shrink-0 flex items-center justify-between">
        <div>
          <span className="text-[11px] font-bold text-orange-300 uppercase block">⏱ TIM2 / TIM3 — Hardware Timer & PWM Simulator</span>
          <p className="text-zinc-400 text-[10px] font-sans mt-0.5">Hardware timers count clock pulses. At overflow or compare match, they generate interrupts or PWM signals — entirely in hardware, 0% CPU!</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex border-b border-zinc-800 bg-[#0d1017] px-2 pt-1 gap-1 shrink-0 overflow-x-auto">
        {[
          { id: "pwm", label: "⚡ PWM Output" },
          { id: "input_capture", label: "📏 Input Capture" },
          { id: "output_compare", label: "🔔 Output Compare" },
          { id: "registers", label: "📋 Register Map" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as typeof activeTab)}
            className={`px-3 py-1.5 text-[10px] font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === t.id
                ? "border-orange-400 text-orange-300 bg-[#141824]"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 p-3 space-y-3 overflow-y-auto">
        {/* ── PWM Tab ── */}
        {activeTab === "pwm" && (
          <>
            {/* Mode Selector */}
            <div className="flex gap-2">
              {(Object.entries(MODE_CONFIGS) as [PwmMode, typeof MODE_CONFIGS.led][]).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => setPwmMode(k)}
                  className={`flex-1 py-2 rounded border text-[10px] font-bold cursor-pointer transition-all ${
                    pwmMode === k ? "bg-orange-500/20 border-orange-400 text-orange-200" : "bg-zinc-900 border-zinc-800 text-zinc-500"
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Controls */}
              <div className="bg-[#0d1017] border border-zinc-800 rounded-lg p-3 space-y-3">
                <span className="text-[10px] font-bold text-zinc-400 uppercase">Timer Register Controls</span>

                {[
                  { label: "PSC — Prescaler", val: psc, set: setPsc, min: 0, max: 65535, info: `Input clock: ${fmtFreq(cntClk * 1e6)}` },
                  { label: "ARR — Auto-Reload (Period)", val: arr, set: setArr, min: 1, max: 65535, info: `PWM Freq: ${fmtFreq(pwmFreq)}` },
                  { label: "CCR — Compare (Duty)", val: ccr, set: setCcr, min: 0, max: arr, info: `Duty: ${dutyPct.toFixed(1)}%` },
                ].map((s) => (
                  <div key={s.label}>
                    <div className="flex justify-between text-[9px] mb-0.5">
                      <span className="text-zinc-500">{s.label}</span>
                      <span className="text-orange-300">{s.info}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range" min={s.min} max={s.max} value={s.val}
                        onChange={(e) => s.set(parseInt(e.target.value))}
                        className="flex-1 h-1.5 accent-orange-400 cursor-pointer"
                      />
                      <span className="text-[10px] text-zinc-300 w-10 text-right">{s.val}</span>
                    </div>
                  </div>
                ))}

                {/* Live Stats */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800">
                  {[
                    { label: "PWM Frequency", val: fmtFreq(pwmFreq) },
                    { label: "Duty Cycle", val: `${dutyPct.toFixed(2)}%` },
                    { label: "Period", val: `${period_us >= 1000 ? (period_us/1000).toFixed(2)+"ms" : period_us.toFixed(1)+"µs"}` },
                    { label: "HIGH time", val: `${highTime_us >= 1000 ? (highTime_us/1000).toFixed(2)+"ms" : highTime_us.toFixed(1)+"µs"}` },
                  ].map((s) => (
                    <div key={s.label} className="bg-[#080a0e] rounded border border-zinc-800 p-2">
                      <div className="text-[9px] text-zinc-500">{s.label}</div>
                      <div className="text-[12px] font-bold text-orange-300">{s.val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Waveform */}
              <div className="bg-[#050709] border border-zinc-800 rounded-lg p-2 space-y-2">
                <span className="text-[10px] font-bold text-zinc-400 uppercase">PWM Waveform (PA0 — TIM2_CH1)</span>
                <canvas ref={canvasRef} width={400} height={160} className="w-full rounded" />

                {/* Visual LED */}
                <div className="flex items-center gap-3 p-2 bg-[#0d1017] rounded border border-zinc-800">
                  <div
                    className="w-8 h-8 rounded-full border-2 transition-all duration-100"
                    style={{
                      backgroundColor: `rgba(250, 204, 21, ${dutyPct / 100})`,
                      borderColor: dutyPct > 0 ? "#facc15" : "#3f3f46",
                      boxShadow: dutyPct > 10 ? `0 0 ${dutyPct * 0.4}px #facc15` : "none",
                    }}
                  />
                  <div className="text-[10px]">
                    <div className="text-zinc-400">LED Brightness</div>
                    <div className="text-amber-300 font-bold">{dutyPct.toFixed(0)}% ({(3.3 * dutyPct / 100).toFixed(2)}V avg)</div>
                  </div>
                </div>

                {/* C Code */}
                <div className="bg-[#060709] rounded border border-zinc-800 p-2">
                  <div className="text-[9px] text-zinc-500 mb-1">Generated C Code (STM32 HAL):</div>
                  <pre className="text-[9px] text-cyan-300 overflow-x-auto">{`TIM2->PSC = ${psc};   // Prescaler
TIM2->ARR = ${arr};  // Period
TIM2->CCR1 = ${ccr}; // Duty cycle
TIM2->CR1 |= TIM_CR1_CEN; // Start!
// Output: PA0 (TIM2_CH1, AF1)`}</pre>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── Input Capture Tab ── */}
        {activeTab === "input_capture" && (
          <div className="space-y-3">
            <div className="p-3 bg-sky-950/20 border border-sky-800/30 rounded-lg">
              <span className="text-[11px] font-bold text-sky-300 uppercase block mb-1">📏 Input Capture — Measure External Signal Timing</span>
              <p className="text-[10px] font-sans text-zinc-400">
                Input Capture mode captures the value of the timer counter (CNT) at the exact moment an edge (rising or falling) is detected on a GPIO pin.
                This lets you <strong>measure pulse widths, frequencies, and RPM</strong> with microsecond precision.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[10px]">
              {[
                { title: "Frequency Measurement", steps: ["Configure TIM pin in AF mode", "Set CCMR1: CC1S=01 (input on TI1)", "Set CCER: CC1P=0 (rising edge)", "Read CCR1 on each capture interrupt", "Freq = TIM_CLK / (CCR1_2 - CCR1_1)"], code: "uint32_t f = TIM_CLK / (CCR1_now - CCR1_prev);" },
                { title: "Pulse Width Measurement", steps: ["First capture on rising edge → save CCR1_rise", "Reconfigure: CC1P=1 (falling edge)", "Second capture on falling edge → save CCR1_fall", "Width = (CCR1_fall - CCR1_rise) / TIM_CLK", "Use for ultrasonic HC-SR04, RC servo, PWM in"], code: "uint32_t us = (fall - rise) / (TIM_CLK / 1e6);" },
              ].map((s) => (
                <div key={s.title} className="bg-[#0d1017] border border-zinc-800 rounded-lg p-3 space-y-2">
                  <span className="font-bold text-sky-300">{s.title}</span>
                  <ol className="space-y-1">
                    {s.steps.map((step, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-sky-500 font-bold shrink-0">{i + 1}.</span>
                        <span className="text-zinc-400 font-sans">{step}</span>
                      </li>
                    ))}
                  </ol>
                  <pre className="text-[9px] bg-[#060709] p-2 rounded border border-zinc-800 text-cyan-300">{s.code}</pre>
                </div>
              ))}
            </div>
            <div className="p-3 bg-amber-950/20 border border-amber-800/30 rounded-lg text-[10px]">
              <span className="font-bold text-amber-300 block mb-1">🔧 Real-World Use: HC-SR04 Ultrasonic Distance Sensor</span>
              <p className="text-zinc-400 font-sans">Send a 10µs trigger pulse → sensor fires ultrasonic burst → ECHO pin goes HIGH for (distance × 2 / 343m/s) → Input Capture measures ECHO width → distance = pulse_us × 0.0171 cm</p>
              <pre className="text-[9px] text-cyan-300 mt-1">{`// Typical result: 5000µs ECHO pulse → 5000 * 0.0171 = 85.5cm`}</pre>
            </div>
          </div>
        )}

        {/* ── Output Compare Tab ── */}
        {activeTab === "output_compare" && (
          <div className="space-y-3">
            <div className="p-3 bg-emerald-950/20 border border-emerald-800/30 rounded-lg">
              <span className="text-[11px] font-bold text-emerald-300 uppercase block mb-1">🔔 Output Compare — Generate Precise Timing Events</span>
              <p className="text-[10px] font-sans text-zinc-400">
                In Output Compare mode, the timer fires an interrupt (or toggles a pin) when CNT matches CCR. No PWM — just a one-shot or repeating event at exact hardware timing with no jitter.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[10px]">
              {[
                { mode: "OC Toggle", desc: "Pin toggles on each match. Creates a square wave without PWM logic.", use: "Bit-banging custom protocols, tone generation" },
                { mode: "OC Set/Reset", desc: "Pin goes HIGH on match, stays HIGH. ISR manually resets.", use: "One-shot delay triggers, stepper pulses" },
                { mode: "OC Force", desc: "Ignore CCR, force pin state immediately via software.", use: "Emergency stop, override outputs" },
              ].map((m) => (
                <div key={m.mode} className="bg-[#0d1017] border border-zinc-800 rounded-lg p-3 space-y-2">
                  <span className="font-bold text-emerald-300">{m.mode}</span>
                  <p className="text-zinc-400 font-sans">{m.desc}</p>
                  <div className="text-[9px] text-amber-300">Use: {m.use}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Register Map Tab ── */}
        {activeTab === "registers" && (
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-zinc-400 uppercase">TIM2 Register Reference (Base: 0x40000000)</span>
            {TIMER_REGISTERS.map((r) => (
              <div key={r.name} className="grid grid-cols-1 md:grid-cols-3 gap-2 p-2.5 bg-[#0d1017] rounded border border-zinc-800">
                <span className="font-bold text-orange-300">{r.name}</span>
                <span className="text-zinc-400 font-sans text-[10px]">{r.desc}</span>
                <span className="text-cyan-300 font-mono text-[9px]">{r.formula}</span>
              </div>
            ))}
            <div className="p-3 bg-[#0d1017] border border-zinc-800 rounded-lg">
              <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-2">Complete TIM2 CH1 PWM Init (Bare-Metal C)</span>
              <pre className="text-[9px] text-cyan-300 overflow-x-auto">{`// 1. Enable TIM2 clock
RCC->APB1ENR |= RCC_APB1ENR_TIM2EN;

// 2. Set prescaler and auto-reload
TIM2->PSC = ${psc};    // Counter clock = 168MHz / (${psc}+1) = ${fmtFreq(cntClk * 1e6)}
TIM2->ARR = ${arr};  // PWM period → freq = ${fmtFreq(pwmFreq)}

// 3. Set compare value (duty cycle)
TIM2->CCR1 = ${ccr};  // Duty = ${dutyPct.toFixed(1)}%

// 4. Configure PWM mode 1 on channel 1
TIM2->CCMR1 |= (6 << TIM_CCMR1_OC1M_Pos) | TIM_CCMR1_OC1PE;

// 5. Enable output on CH1
TIM2->CCER |= TIM_CCER_CC1E;

// 6. Enable counter
TIM2->CR1 |= TIM_CR1_CEN;

// PA0 must be configured as AF1 (TIM2_CH1)!`}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
