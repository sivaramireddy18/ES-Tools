"use client";

import React, { useState } from "react";
import McuArchitectureViewer from "@/components/mcu/McuArchitectureViewer";
import RealisticLabSetup from "@/components/lab/RealisticLabSetup";

export type ProtocolGuideType = "bench" | "lab" | "i2c" | "spi" | "uart" | "mcu";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialTopic?: ProtocolGuideType;
}

export default function BeginnerGuideModal({
  isOpen,
  onClose,
  initialTopic = "bench",
}: Props) {
  const [activeTopic, setActiveTopic] = useState<ProtocolGuideType>(initialTopic);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-mono select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0f121a] border border-cyan-500/40 rounded-xl max-w-4xl w-full max-h-[90vh] shadow-[0_0_40px_rgba(34,211,238,0.15)] flex flex-col overflow-hidden text-zinc-200"
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-[#141824] border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🎓</span>
            <div>
              <h2 className="text-xs font-bold text-cyan-300 tracking-wider uppercase">
                Beginner's Guide & Complete Hardware Deep-Dive
              </h2>
              <span className="text-[10px] text-zinc-400 font-sans block">
                Everything you need to know about microcontrollers, silicon internals, and GPIO routing — explained in plain English!
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center text-sm cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Topic Selector Tabs */}
        <div className="flex border-b border-zinc-800 bg-[#0c0e16] px-4 pt-2 gap-1.5 shrink-0 overflow-x-auto">
          {[
            { id: "lab", label: "🔬 Realistic Lab Setup", tag: "Board & Probes" },
            { id: "mcu", label: "🏛️ MCU & Bus Matrix", tag: "Silicon Gate Level" },
            { id: "bench", label: "🖥️ Validation Bench", tag: "Microcontroller Basics" },
            { id: "i2c", label: "💬 I2C Protocol", tag: "Walkie-Talkie Bus" },
            { id: "spi", label: "🔄 SPI Protocol", tag: "Conveyor Belt Bus" },
            { id: "uart", label: "📨 UART Serial", tag: "Morse Code Wire" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTopic(tab.id as ProtocolGuideType)}
              className={`px-3 py-1.5 rounded-t-md text-[11px] font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTopic === tab.id
                  ? "border-cyan-400 text-cyan-300 bg-[#141824]"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Topic Content Body */}
        <div className="flex-1 p-4 overflow-y-auto font-sans text-xs leading-relaxed space-y-4 text-zinc-300 scrollbar-thin scrollbar-thumb-zinc-800">
          {/* ════════════════ TOPIC: REALISTIC LAB SETUP ════════════════ */}
          {activeTopic === "lab" && (
            <div className="h-[520px]">
              <RealisticLabSetup />
            </div>
          )}

          {/* ════════════════ TOPIC: MCU SILICON ARCHITECTURE ════════════════ */}
          {activeTopic === "mcu" && (
            <div className="h-[520px]">
              <McuArchitectureViewer />
            </div>
          )}

          {/* ════════════════ TOPIC: VALIDATION BENCH ════════════════ */}
          {activeTopic === "bench" && (
            <div className="space-y-4 font-sans">
              <div className="p-3 bg-cyan-950/30 border border-cyan-800/40 rounded-lg">
                <span className="text-[11px] font-bold text-cyan-300 font-mono uppercase block mb-1">
                  💡 The Big Picture (What are we doing here?)
                </span>
                <p className="text-zinc-300 text-[11px]">
                  Imagine you wrote software (firmware) for a tiny computer chip (a microcontroller) that controls a microwave or a car dashboard. Before manufacturing a million chips, you need a <strong>Validation Bench</strong> to test if your code correctly turns on lights (LEDs), reads buttons (switches), and generates electrical signals.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-[10px]">
                <div className="p-3 bg-[#141824] rounded-lg border border-zinc-800 space-y-1">
                  <span className="text-emerald-400 font-bold block">1. What is a "WASM Firmware Binary"?</span>
                  <p className="text-zinc-400 font-sans text-[11px]">
                    It’s the compiled code written in C/C++ converted into WebAssembly. It acts like the brain inside the simulated chip.
                  </p>
                </div>
                <div className="p-3 bg-[#141824] rounded-lg border border-zinc-800 space-y-1">
                  <span className="text-cyan-400 font-bold block">2. What are "GPIO Pins"?</span>
                  <p className="text-zinc-400 font-sans text-[11px]">
                    <strong>General Purpose Input/Output</strong>. Think of them like electrical metal legs on the chip. Some legs send voltage (HIGH/3.3V = Light ON) and some legs sense voltage (Switch pressed).
                  </p>
                </div>
                <div className="p-3 bg-[#141824] rounded-lg border border-zinc-800 space-y-1">
                  <span className="text-amber-400 font-bold block">3. What is the "Logic Analyzer"?</span>
                  <p className="text-zinc-400 font-sans text-[11px]">
                    Like a hospital heart monitor (ECG), but for electricity! It draws square waves showing when each pin turns ON (high line) or OFF (low line) over time.
                  </p>
                </div>
                <div className="p-3 bg-[#141824] rounded-lg border border-zinc-800 space-y-1">
                  <span className="text-purple-400 font-bold block">4. What is the "Shared Memory Bus"?</span>
                  <p className="text-zinc-400 font-sans text-[11px]">
                    A shared chalkboard (1024 bytes). The CPU writes to byte 0 to turn on LED 0, and reads byte 4 to see if you flipped Switch 0!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════ TOPIC: I2C PROTOCOL ════════════════ */}
          {activeTopic === "i2c" && (
            <div className="space-y-4 font-sans">
              <div className="p-3 bg-cyan-950/30 border border-cyan-800/40 rounded-lg">
                <span className="text-[11px] font-bold text-cyan-300 font-mono uppercase block mb-1">
                  💡 I2C Analogy: The Classroom Walkie-Talkie
                </span>
                <p className="text-zinc-300 text-[11px]">
                  Imagine 10 students (sensors/chips) in a room connected by just <strong>two strings</strong>:
                  <br />• <strong>SCL (Clock)</strong>: A metronome ticking at a steady beat so everyone listens at the exact same millisecond.
                  <br />• <strong>SDA (Data)</strong>: The microphone where people speak words one letter (bit) at a time.
                </p>
              </div>

              <div className="space-y-2 text-[11px]">
                <h4 className="font-bold text-cyan-300 font-mono text-[10px] uppercase">
                  Step-by-Step Breakdown of an I2C Conversation:
                </h4>
                <div className="p-2.5 bg-[#141824] rounded border border-zinc-800 space-y-1.5">
                  <div className="flex gap-2">
                    <span className="text-cyan-400 font-bold shrink-0 font-mono">1. START:</span>
                    <span>The Master pulls the Data line down while Clock is HIGH. This is like shouting <em>"Hey everyone, quiet down, I'm talking!"</em></span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-sky-400 font-bold shrink-0 font-mono">2. ADDRESS:</span>
                    <span>The Master shouts a 7-bit name (e.g. <code>0x50</code> for the EEPROM memory chip) plus a Read/Write bit.</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-emerald-400 font-bold shrink-0 font-mono">3. ACK (Acknowledge):</span>
                    <span>The chip whose name was called pulls the Data line LOW to say <em>"I'm here, I hear you!"</em>. If no chip replies, you get a <strong>NACK (No Answer)</strong>.</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-purple-400 font-bold shrink-0 font-mono">4. DATA:</span>
                    <span>8 bits of real information are transferred (e.g., temperature reading or text letters).</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-rose-400 font-bold shrink-0 font-mono">5. STOP:</span>
                    <span>Data line goes from LOW to HIGH while Clock is HIGH. Master says <em>"Conversation over, line is free!"</em></span>
                  </div>
                </div>
              </div>

              <div className="p-2 bg-[#12151e] border border-amber-500/30 rounded text-[10px] text-amber-300">
                ⭐ <strong>Why are Pull-Up Resistors needed?</strong> I2C lines are "open-drain" — chips can only pull the wire DOWN to 0V. A tiny resistor acts like a spring pulling the wire back UP to 3.3V when no one is pulling it down!
              </div>
            </div>
          )}

          {/* ════════════════ TOPIC: SPI PROTOCOL ════════════════ */}
          {activeTopic === "spi" && (
            <div className="space-y-4 font-sans">
              <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-lg">
                <span className="text-[11px] font-bold text-emerald-300 font-mono uppercase block mb-1">
                  💡 SPI Analogy: The Dual Conveyor Belt
                </span>
                <p className="text-zinc-300 text-[11px]">
                  Unlike I2C where people take turns talking, <strong>SPI (Serial Peripheral Interface)</strong> is a high-speed conveyor belt. On every single tick of the clock, the Master pushes a bit to the Slave, and the Slave simultaneously pushes a bit back to the Master!
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 bg-[#141824] rounded border border-zinc-800">
                  <span className="font-bold text-cyan-400 font-mono text-[10px] block mb-1">SCK (Serial Clock)</span>
                  <p className="text-zinc-400 text-[10px]">
                    The heartbeat pulse generated by the Master chip. Speeds can easily reach 10–50 million pulses per second (10-50 MHz)!
                  </p>
                </div>
                <div className="p-2.5 bg-[#141824] rounded border border-zinc-800">
                  <span className="font-bold text-emerald-400 font-mono text-[10px] block mb-1">MOSI (Master Out Slave In)</span>
                  <p className="text-zinc-400 text-[10px]">
                    The wire carrying data outbound from the Master computer to the peripheral sensor or display.
                  </p>
                </div>
                <div className="p-2.5 bg-[#141824] rounded border border-zinc-800">
                  <span className="font-bold text-rose-400 font-mono text-[10px] block mb-1">MISO (Master In Slave Out)</span>
                  <p className="text-zinc-400 text-[10px]">
                    The return wire carrying data back from the sensor into the Master computer.
                  </p>
                </div>
                <div className="p-2.5 bg-[#141824] rounded border border-zinc-800">
                  <span className="font-bold text-amber-400 font-mono text-[10px] block mb-1">CS / SS (Chip Select)</span>
                  <p className="text-zinc-400 text-[10px]">
                    A dedicated wire for each chip. Master pulls CS LOW to wake up that specific chip before sending data.
                  </p>
                </div>
              </div>

              <div className="p-2.5 bg-[#141824] rounded border border-zinc-800 space-y-1 text-[11px]">
                <span className="font-bold text-emerald-300 font-mono text-[10px] uppercase block">
                  What are SPI Modes (0, 1, 2, 3)?
                </span>
                <p className="text-zinc-400 text-[10px]">
                  They simply define whether the clock sits at 0V or 3.3V when idle (<strong>CPOL: Polarity</strong>) and whether data is read on the rising edge or falling edge of the pulse (<strong>CPHA: Phase</strong>). Mode 0 is the most common standard in the world.
                </p>
              </div>
            </div>
          )}

          {/* ════════════════ TOPIC: UART SERIAL ════════════════ */}
          {activeTopic === "uart" && (
            <div className="space-y-4 font-sans">
              <div className="p-3 bg-cyan-950/30 border border-cyan-800/40 rounded-lg">
                <span className="text-[11px] font-bold text-cyan-300 font-mono uppercase block mb-1">
                  💡 UART Analogy: Morse Code with a Stopwatch
                </span>
                <p className="text-zinc-300 text-[11px]">
                  <strong>UART (Universal Asynchronous Receiver-Transmitter)</strong> has NO shared clock wire! Instead, both devices agree in advance on an exact timer speed called the <strong>Baud Rate</strong> (e.g. 115,200 bits per second).
                </p>
              </div>

              <div className="space-y-2 text-[11px]">
                <h4 className="font-bold text-cyan-300 font-mono text-[10px] uppercase">
                  Anatomy of a Single Serial Character Frame:
                </h4>
                <div className="p-2.5 bg-[#141824] rounded border border-zinc-800 space-y-1 text-[10px]">
                  <p><strong className="text-zinc-400">1. IDLE (Mark):</strong> The wire sits peacefully at 3.3V (Logic 1).</p>
                  <p><strong className="text-cyan-400">2. START BIT (Space):</strong> Voltage drops to 0V for exactly 1 bit-time. Receiver sees this and starts its internal stopwatch!</p>
                  <p><strong className="text-sky-300">3. 8 DATA BITS:</strong> 8 pulses representing the letter (e.g. 'A' = <code>01000001</code>) sent least-significant bit first.</p>
                  <p><strong className="text-amber-400">4. PARITY BIT (Optional):</strong> A simple math check bit to detect if electromagnetic noise flipped any 1s into 0s.</p>
                  <p><strong className="text-rose-400">5. STOP BIT:</strong> Line goes back to 3.3V for 1–2 bit-times so the receiver knows the letter is finished.</p>
                </div>
              </div>

              <div className="p-2 bg-[#12151e] border border-rose-500/30 rounded text-[10px] text-rose-300">
                ⚠ <strong>What is a Baud Rate Mismatch?</strong> If the transmitter speaks at 115,200 words/sec and the receiver listens at 9,600 words/sec, the receiver samples at the completely wrong times and receives total garbage text (e.g. <code>§g</code>) or Framing Errors! Test this in the UART simulator!
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-[#141824] border-t border-zinc-800 flex justify-between items-center shrink-0">
          <span className="text-[10px] text-zinc-500 font-mono">
            Embedded Systems Interactive Learning Engine
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-zinc-950 font-bold rounded text-xs tracking-wider cursor-pointer transition-all"
          >
            Got It! Return to Simulator
          </button>
        </div>
      </div>
    </div>
  );
}
