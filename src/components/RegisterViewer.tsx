"use client";

import React, { useEffect, useState } from "react";
import { useHardwareBus } from "@/context/HardwareBusContext";

export default function RegisterViewer() {
  const { sharedMemory } = useHardwareBus();
  const [regs, setRegs] = useState({
    portA: 0,
    portB: 0,
    systick: 0,
    uptimeMs: 0,
    adc0: 0,
    pwm: 0,
    uartTxPtr: 0,
    uartRxPtr: 0,
  });

  useEffect(() => {
    if (!sharedMemory) return;
    const sabView = new Uint8Array(sharedMemory);
    let animId: number;

    const poll = () => {
      // Decode Port A byte
      let pA = 0;
      for (let i = 0; i < 8; i++) {
        if (sabView[i] > 0) pA |= 1 << i;
      }
      // Decode Port B byte
      let pB = 0;
      for (let i = 0; i < 8; i++) {
        if (sabView[i + 8] > 0) pB |= 1 << i;
      }

      // 32-bit uptime in ms from bytes 17..20
      const uptime =
        sabView[17] |
        (sabView[18] << 8) |
        (sabView[19] << 16) |
        (sabView[20] << 24);

      setRegs({
        portA: pA,
        portB: pB,
        systick: sabView[16],
        uptimeMs: uptime,
        adc0: sabView[21],
        pwm: sabView[22],
        uartTxPtr: sabView[64],
        uartRxPtr: sabView[97],
      });

      animId = requestAnimationFrame(poll);
    };

    animId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(animId);
  }, [sharedMemory]);

  return (
    <div className="flex flex-col h-full bg-[#080a0e] text-zinc-300 font-mono text-[10px] p-2.5 space-y-2.5 overflow-y-auto select-none">
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-1.5 shrink-0">
        <div className="flex items-center gap-1.5 font-bold tracking-wider text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-sm bg-emerald-400" />
          <span>MCU PERIPHERAL REGISTERS</span>
        </div>
        <span className="text-[9px] text-zinc-500">ARM Cortex-M4 Mapped</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* GPIOA_ODR */}
        <div className="p-2 bg-[#10131c] rounded border border-zinc-800 space-y-1">
          <div className="flex justify-between text-zinc-400 font-bold">
            <span>GPIOA_ODR</span>
            <span className="text-cyan-400 font-mono">0x{regs.portA.toString(16).toUpperCase().padStart(2, "0")}</span>
          </div>
          <div className="grid grid-cols-8 gap-0.5 text-center">
            {Array.from({ length: 8 }, (_, idx) => {
              const bit = (regs.portA >> (7 - idx)) & 1;
              return (
                <div key={idx} className="flex flex-col items-center">
                  <span className="text-[8px] text-zinc-600">D{7 - idx}</span>
                  <span
                    className={`w-3 h-3.5 rounded-xs flex items-center justify-center text-[8px] font-bold ${
                      bit === 1 ? "bg-cyan-500 text-zinc-950 shadow-[0_0_6px_#22d3ee]" : "bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    {bit}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* GPIOB_IDR */}
        <div className="p-2 bg-[#10131c] rounded border border-zinc-800 space-y-1">
          <div className="flex justify-between text-zinc-400 font-bold">
            <span>GPIOB_IDR</span>
            <span className="text-amber-400 font-mono">0x{regs.portB.toString(16).toUpperCase().padStart(2, "0")}</span>
          </div>
          <div className="grid grid-cols-8 gap-0.5 text-center">
            {Array.from({ length: 8 }, (_, idx) => {
              const bit = (regs.portB >> (7 - idx)) & 1;
              return (
                <div key={idx} className="flex flex-col items-center">
                  <span className="text-[8px] text-zinc-600">P{7 - idx}</span>
                  <span
                    className={`w-3 h-3.5 rounded-xs flex items-center justify-center text-[8px] font-bold ${
                      bit === 1 ? "bg-amber-500 text-zinc-950 shadow-[0_0_6px_#f59e0b]" : "bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    {bit}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Timers & Telemetry */}
      <div className="grid grid-cols-3 gap-2">
        {/* SysTick */}
        <div className="p-2 bg-[#10131c] rounded border border-zinc-800 space-y-0.5">
          <span className="text-zinc-500 text-[9px] block">SYSTICK_VAL</span>
          <span className="text-xs text-cyan-300 font-bold font-mono">
            0x{regs.systick.toString(16).toUpperCase().padStart(2, "0")}
          </span>
          <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden mt-1">
            <div
              className="bg-cyan-400 h-full transition-all duration-75"
              style={{ width: `${(regs.systick / 255) * 100}%` }}
            />
          </div>
        </div>

        {/* ADC Channel 0 */}
        <div className="p-2 bg-[#10131c] rounded border border-zinc-800 space-y-0.5">
          <span className="text-zinc-500 text-[9px] block">ADC1_DR (CH0)</span>
          <span className="text-xs text-emerald-300 font-bold font-mono">
            {((regs.adc0 / 255) * 3.3).toFixed(2)}V
          </span>
          <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden mt-1">
            <div
              className="bg-emerald-400 h-full transition-all duration-75"
              style={{ width: `${(regs.adc0 / 255) * 100}%` }}
            />
          </div>
        </div>

        {/* PWM Duty Register */}
        <div className="p-2 bg-[#10131c] rounded border border-zinc-800 space-y-0.5">
          <span className="text-zinc-500 text-[9px] block">TIM2_CCR1 (PWM)</span>
          <span className="text-xs text-purple-300 font-bold font-mono">
            {Math.round((regs.pwm / 255) * 100)}%
          </span>
          <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden mt-1">
            <div
              className="bg-purple-400 h-full transition-all duration-75"
              style={{ width: `${(regs.pwm / 255) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* System Uptime & Serial Stats */}
      <div className="p-2 bg-[#10131c] rounded border border-zinc-800 flex items-center justify-between">
        <div className="space-y-0.5">
          <span className="text-zinc-500 text-[9px] block">UPTIME (32-BIT CLOCK)</span>
          <span className="text-xs text-zinc-200 font-bold">
            {(regs.uptimeMs / 1000).toFixed(2)}s ({regs.uptimeMs} ms)
          </span>
        </div>
        <div className="text-right space-y-0.5">
          <span className="text-zinc-500 text-[9px] block">UART BUFFER POINTERS</span>
          <span className="text-[10px] text-zinc-300 font-bold">
            TX_HEAD: <span className="text-cyan-400">0x{regs.uartTxPtr.toString(16).toUpperCase()}</span> | RX_HEAD: <span className="text-emerald-400">0x{regs.uartRxPtr.toString(16).toUpperCase()}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
