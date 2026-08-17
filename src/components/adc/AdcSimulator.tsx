"use client";

import React, { useState, useEffect, useRef } from "react";

const SENSORS = [
  { name: "NTC Thermistor", vMin: 0.2, vMax: 3.1, unit: "°C", convert: (v: number) => ((3.3 - v) / 3.3 * 100).toFixed(1) },
  { name: "Potentiometer", vMin: 0.0, vMax: 3.3, unit: "%", convert: (v: number) => (v / 3.3 * 100).toFixed(1) },
  { name: "LDR (Light)", vMin: 0.0, vMax: 3.0, unit: "lux", convert: (v: number) => (v / 3.3 * 1000).toFixed(0) },
  { name: "Hall Effect (Current)", vMin: 0.5, vMax: 2.8, unit: "A", convert: (v: number) => ((v - 1.65) / 0.185).toFixed(2) },
];

const MODES = [
  { id: "single", label: "Single Conversion", desc: "ADC converts once when triggered, then stops. CPU must re-trigger for next reading." },
  { id: "continuous", label: "Continuous Conversion", desc: "ADC automatically restarts after each conversion. CPU polls DR register or waits for DMA." },
  { id: "scan", label: "Scan Mode", desc: "ADC converts a sequence of channels one after another (e.g., CH0, CH1, CH2). Each result stored via DMA." },
];

export default function AdcSimulator() {
  const [voltage, setVoltage] = useState(1.65);
  const [sensorIdx, setSensorIdx] = useState(0);
  const [mode, setMode] = useState("single");
  const [converting, setConverting] = useState(false);
  const [adcValue, setAdcValue] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [noiseEnabled, setNoiseEnabled] = useState(true);
  const [samplingCycles, setSamplingCycles] = useState(84);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sensor = SENSORS[sensorIdx];
  const vref = 3.3;
  const resolution = 12;
  const maxCode = (1 << resolution) - 1;
  const lsb_mv = (vref / maxCode) * 1000;

  const getAdcCode = (v: number) => {
    const noise = noiseEnabled ? (Math.random() - 0.5) * 2 : 0; // ±1 LSB noise
    return Math.max(0, Math.min(maxCode, Math.round((v / vref) * maxCode + noise)));
  };

  const convert = () => {
    setConverting(true);
    const convTime_us = (samplingCycles + 12) / 21; // APB2=84MHz, ADC prescaler /4 = 21MHz
    setTimeout(() => {
      const code = getAdcCode(voltage);
      setAdcValue(code);
      setHistory((h) => [...h.slice(-79), code]);
      setConverting(false);
    }, 40);
  };

  useEffect(() => {
    if (mode === "continuous") {
      timerRef.current = setInterval(convert, 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [mode, voltage, noiseEnabled, samplingCycles]);

  // Draw history waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || history.length < 2) return;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = "#05070a";
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = "#1a1e2e";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = (H / 4) * i;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      ctx.fillStyle = "#3f4458";
      ctx.font = "8px monospace";
      ctx.fillText(`${(maxCode - (maxCode / 4) * i).toFixed(0)}`, 2, y + 9);
    }

    // Waveform
    ctx.strokeStyle = "#34d399";
    ctx.lineWidth = 1.5;
    ctx.shadowColor = "#34d399";
    ctx.shadowBlur = 4;
    ctx.beginPath();
    history.forEach((v, i) => {
      const x = (i / 79) * W;
      const y = H - (v / maxCode) * H;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.shadowBlur = 0;
  }, [history, maxCode]);

  const adcCode = adcValue ?? 0;
  const voltsBack = (adcCode / maxCode) * vref;
  const quantizationError_mv = Math.abs(voltage - voltsBack) * 1000;
  const convTime_us = (samplingCycles + 12) / 21;
  const sampleRate = 1e6 / convTime_us;

  return (
    <div className="flex flex-col h-full bg-[#080a0e] text-zinc-200 font-mono text-xs overflow-y-auto">
      <div className="p-3 bg-teal-950/20 border-b border-teal-800/30 shrink-0">
        <span className="text-[11px] font-bold text-teal-300 uppercase block">🎚 ADC — 12-bit Successive Approximation Converter (STM32F4)</span>
        <p className="text-zinc-400 text-[10px] font-sans mt-0.5">The ADC samples an analog voltage and converts it to a 12-bit digital number (0–4095). Resolution = VREF / 4096 = {lsb_mv.toFixed(3)} mV per LSB.</p>
      </div>

      <div className="flex-1 p-3 space-y-3 overflow-y-auto">
        {/* Sensor + Voltage Input */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-[#0d1017] border border-zinc-800 rounded-lg p-3 space-y-3">
            <span className="text-[10px] font-bold text-zinc-400 uppercase">Analog Input Source</span>

            <div className="grid grid-cols-2 gap-1.5">
              {SENSORS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => { setSensorIdx(i); setVoltage(1.65); setAdcValue(null); setHistory([]); }}
                  className={`p-2 rounded border text-[10px] font-bold cursor-pointer transition-all ${sensorIdx === i ? "bg-teal-500/20 border-teal-400 text-teal-200" : "bg-zinc-900 border-zinc-800 text-zinc-500"}`}
                >
                  {s.name}
                </button>
              ))}
            </div>

            <div>
              <div className="flex justify-between text-[9px] text-zinc-500 mb-1">
                <span>Input Voltage (PA1 — ADC1_IN1)</span>
                <span className="text-teal-300 font-bold">{voltage.toFixed(3)} V</span>
              </div>
              <input
                type="range" min={0} max={330} value={Math.round(voltage * 100)}
                onChange={(e) => setVoltage(parseInt(e.target.value) / 100)}
                className="w-full h-1.5 accent-teal-400 cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-zinc-600 mt-0.5">
                <span>0.000V (GND)</span>
                <span>3.300V (VREF)</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-[#060709] rounded border border-zinc-800">
                <div className="text-[9px] text-zinc-500">Sensor Reading</div>
                <div className="text-[12px] font-bold text-teal-300">{sensor.convert(voltage)} {sensor.unit}</div>
              </div>
              <div className="p-2 bg-[#060709] rounded border border-zinc-800">
                <div className="text-[9px] text-zinc-500">Voltage input</div>
                <div className="text-[12px] font-bold text-emerald-300">{voltage.toFixed(3)} V</div>
              </div>
            </div>
          </div>

          {/* Conversion Result */}
          <div className="bg-[#050709] border border-zinc-800 rounded-lg p-3 space-y-3">
            <span className="text-[10px] font-bold text-zinc-400 uppercase">12-bit SAR ADC Conversion Result</span>

            {/* Big Number */}
            <div className="text-center py-4 bg-[#0a0c12] rounded-lg border border-zinc-800">
              {converting ? (
                <div className="space-y-1">
                  <div className="text-[10px] text-amber-300 animate-pulse">⚡ CONVERTING...</div>
                  <div className="text-[9px] text-zinc-500">SAR algorithm running {resolution} comparisons</div>
                </div>
              ) : adcValue !== null ? (
                <>
                  <div className="text-[32px] font-bold text-teal-300">{adcValue}</div>
                  <div className="text-[10px] text-zinc-400">0x{adcValue.toString(16).toUpperCase().padStart(3, "0")} | 0b{adcValue.toString(2).padStart(12, "0")}</div>
                  <div className="text-[9px] text-emerald-400 mt-1">→ {voltsBack.toFixed(4)}V reconstructed</div>
                </>
              ) : (
                <div className="text-zinc-600 text-[10px]">Press CONVERT to sample</div>
              )}
            </div>

            {/* SAR bit ladder */}
            {adcValue !== null && (
              <div>
                <div className="text-[9px] text-zinc-500 mb-1">12-bit binary output (MSB first):</div>
                <div className="flex gap-0.5">
                  {Array.from({ length: 12 }, (_, i) => {
                    const bit = (adcValue >> (11 - i)) & 1;
                    return (
                      <div
                        key={i}
                        className={`flex-1 h-6 rounded text-[8px] font-bold flex items-center justify-center ${
                          bit ? "bg-teal-500 text-teal-900" : "bg-zinc-800 text-zinc-600"
                        }`}
                      >
                        {bit}
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[8px] text-zinc-600 mt-0.5">
                  <span>bit 11 (MSB, 1.65V)</span>
                  <span>bit 0 (LSB, {lsb_mv.toFixed(2)}mV)</span>
                </div>
              </div>
            )}

            {mode === "single" && (
              <button
                onClick={convert}
                disabled={converting}
                className="w-full py-2 bg-teal-500/20 hover:bg-teal-500/30 border border-teal-400 text-teal-200 rounded font-bold text-[10px] cursor-pointer transition-all disabled:opacity-40"
              >
                {converting ? "⚡ CONVERTING..." : "▶ TRIGGER CONVERSION"}
              </button>
            )}
          </div>
        </div>

        {/* Conversion Mode + Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-[#0d1017] border border-zinc-800 rounded-lg p-3 space-y-2">
            <span className="text-[10px] font-bold text-zinc-400 uppercase">Conversion Mode</span>
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`w-full p-2 rounded border text-left cursor-pointer transition-all ${mode === m.id ? "bg-teal-500/20 border-teal-400 text-teal-200" : "bg-zinc-900 border-zinc-800 text-zinc-500"}`}
              >
                <div className="font-bold text-[10px]">{m.label}</div>
                <div className="text-[9px] font-sans opacity-80 mt-0.5">{m.desc}</div>
              </button>
            ))}
          </div>

          <div className="bg-[#0d1017] border border-zinc-800 rounded-lg p-3 space-y-2">
            <span className="text-[10px] font-bold text-zinc-400 uppercase">Sampling Settings</span>

            <div>
              <div className="flex justify-between text-[9px] text-zinc-500 mb-0.5">
                <span>Sample Time (SMP bits)</span>
                <span className="text-teal-300">{samplingCycles} cycles → {convTime_us.toFixed(2)}µs → {(sampleRate / 1000).toFixed(0)} kSPS</span>
              </div>
              <select
                value={samplingCycles}
                onChange={(e) => setSamplingCycles(parseInt(e.target.value))}
                className="w-full p-1.5 bg-[#0c0e16] border border-zinc-700 rounded text-[10px] text-zinc-200 cursor-pointer"
              >
                {[3, 15, 28, 56, 84, 112, 144, 480].map((c) => (
                  <option key={c} value={c}>{c} cycles ({(1e6 / ((c + 12) / 21) / 1000).toFixed(0)} kSPS)</option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-[10px] text-zinc-400">
              <input type="checkbox" checked={noiseEnabled} onChange={(e) => setNoiseEnabled(e.target.checked)} className="accent-teal-400" />
              Simulate ADC noise (±1 LSB) — realistic hardware behavior
            </label>

            <div className="grid grid-cols-2 gap-2 text-[9px]">
              <div className="p-1.5 bg-[#060709] rounded border border-zinc-800">
                <div className="text-zinc-500">Resolution</div>
                <div className="text-teal-300 font-bold">{lsb_mv.toFixed(3)} mV/LSB</div>
              </div>
              <div className="p-1.5 bg-[#060709] rounded border border-zinc-800">
                <div className="text-zinc-500">Quantization error</div>
                <div className="text-amber-300 font-bold">±{(lsb_mv / 2).toFixed(3)} mV</div>
              </div>
            </div>
          </div>
        </div>

        {/* History Waveform */}
        {history.length > 5 && (
          <div className="bg-[#050709] border border-zinc-800 rounded-lg p-2 space-y-1">
            <span className="text-[10px] font-bold text-zinc-400 uppercase">ADC Sample History (Last 80 readings)</span>
            <canvas ref={canvasRef} width={800} height={100} className="w-full rounded" />
          </div>
        )}

        {/* C Code */}
        <div className="bg-[#0d1017] border border-zinc-800 rounded-lg p-3">
          <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-2">📋 ADC1 Single-Shot Init (Bare-Metal C)</span>
          <pre className="text-[9px] text-cyan-300 overflow-x-auto">{`// 1. Enable clocks
RCC->APB2ENR |= RCC_APB2ENR_ADC1EN;
RCC->AHB1ENR |= RCC_AHB1ENR_GPIOAEN;

// 2. PA1 → Analog mode
GPIOA->MODER |= (3 << (1*2)); // MODER[3:2] = 11 (Analog)

// 3. ADC prescaler /4 → 21 MHz ADC clock
ADC->CCR |= ADC_CCR_ADCPRE_0; // /4

// 4. 12-bit resolution, right-aligned
ADC1->CR1 = ADC_CR1_RES_0; // 12-bit default (00)
ADC1->CR2 = 0;              // Right-align (default)

// 5. Sample time: ${samplingCycles} cycles on Channel 1
ADC1->SMPR2 |= (${Math.round(Math.log2(samplingCycles/3))} << (3*1)); // SMP1 = ${samplingCycles}cyc

// 6. Select channel 1 (PA1), 1 conversion
ADC1->SQR3 = 1;   // Rank 1 = Channel 1
ADC1->SQR1 = 0;   // L = 0 (1 conversion)

// 7. Enable and trigger
ADC1->CR2 |= ADC_CR2_ADON;  // Enable ADC
ADC1->CR2 |= ADC_CR2_SWSTART; // Start conversion

// 8. Wait for EOC and read
while (!(ADC1->SR & ADC_SR_EOC));
uint16_t result = ADC1->DR;  // → ${adcValue ?? "XXXX"}`}</pre>
        </div>
      </div>
    </div>
  );
}
