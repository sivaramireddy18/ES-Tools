"use client";

import React, { useState } from "react";

interface Props {
  currentPhase: string;
  protocol: "i2c" | "spi" | "uart" | "bench";
  isStreaming: boolean;
  onOpenGuide: () => void;
}

export default function LiveNarrationBanner({
  currentPhase,
  protocol,
  isStreaming,
  onOpenGuide,
}: Props) {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Translate technical phase names into plain English layman explanations
  const getLaymanExplanation = () => {
    const phaseUpper = (currentPhase || "").toUpperCase();

    if (protocol === "i2c") {
      if (phaseUpper.includes("IDLE")) {
        return "The bus is currently quiet. Both SCL (Clock) and SDA (Data) are sitting high at 3.3V pulled up by resistors, ready for a transaction.";
      }
      if (phaseUpper.includes("START")) {
        return "1. START Condition: Master pulled the Data wire LOW while Clock is still HIGH. This alerts all chips on the bus: 'Listen up, message starting!'";
      }
      if (phaseUpper.includes("ADDR")) {
        return "2. Calling Chip Address: Master is shouting the 7-bit device address over the Data line with each clock tick. Every chip checks if it's their name.";
      }
      if (phaseUpper.includes("ACK")) {
        return "3. Slave Acknowledgment (ACK): The target chip heard its address and pulled the Data line LOW to say: 'Yes, I am here and ready!'";
      }
      if (phaseUpper.includes("NACK")) {
        return "3. No Response (NACK): No chip answered or the chip was busy! The Data line stayed HIGH (Logic 1).";
      }
      if (phaseUpper.includes("REG") || phaseUpper.includes("DATA")) {
        return "4. Transferring Data Bytes: 8 electrical pulses are transferring actual data bits into the chip's internal memory register.";
      }
      if (phaseUpper.includes("STRETCH")) {
        return "Clock Stretching: The slave chip is busy processing and is physically holding SCL LOW to tell the Master: 'Hold on a second, wait for me!'";
      }
      if (phaseUpper.includes("STOP")) {
        return "5. STOP Condition: Data wire releases from LOW to HIGH while Clock is HIGH. The conversation is officially finished and the line is free.";
      }
    }

    if (protocol === "spi") {
      if (phaseUpper.includes("IDLE")) {
        return "SPI bus is idle. Chip Select (CS) is HIGH so all slave chips are in low-power sleep mode.";
      }
      if (phaseUpper.includes("ASSERT")) {
        return "1. Chip Select (CS) pulled LOW: Master wakes up the selected peripheral chip so it listens to the incoming clock pulses.";
      }
      if (phaseUpper.includes("BYTE") || phaseUpper.includes("SAMPLE") || phaseUpper.includes("SHIFT")) {
        return "2. Full-Duplex Bit Swapping: On each clock edge, Master pushes 1 bit out on MOSI while the Slave simultaneously pushes 1 bit back on MISO!";
      }
      if (phaseUpper.includes("DEASSERT")) {
        return "3. Chip Select (CS) pulled HIGH: Master finished the transfer and puts the peripheral chip back to sleep.";
      }
    }

    if (protocol === "uart") {
      if (phaseUpper.includes("IDLE")) {
        return "Serial line is in IDLE state (held constantly at Logic 1 / 3.3V Mark). No data is currently moving.";
      }
      if (phaseUpper.includes("START")) {
        return "1. START Bit: Voltage drops from 3.3V to 0V (Space). This tells the receiver's internal timer to start its stopwatch!";
      }
      if (phaseUpper.includes("DATA")) {
        return "2. Data Bits: 8 individual voltage pulses are arriving in sequence representing an ASCII character (e.g. letter 'A').";
      }
      if (phaseUpper.includes("PARITY")) {
        return "3. Parity Bit: A math checksum bit checking whether the number of 1s is even or odd to detect electrical noise errors.";
      }
      if (phaseUpper.includes("STOP")) {
        return "4. STOP Bit: Line returns to 3.3V (Mark) to signal that the character packet has completely arrived.";
      }
    }

    return isStreaming
      ? `Processing hardware state: ${currentPhase}`
      : "Ready. Click transmit to stream signals and see real-time step-by-step explanations here!";
  };

  return (
    <div className="bg-[#0b0e17] border-b border-zinc-800/80 px-4 py-2 flex items-center justify-between text-xs select-none transition-all">
      <div className="flex items-center gap-3 flex-1 min-w-0 pr-3">
        <div className="flex items-center gap-2 shrink-0">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]" />
          <span className="text-[10px] font-bold tracking-wider text-cyan-300 font-mono uppercase">
            LIVE EXPLAINER:
          </span>
        </div>

        <p className="text-[11px] text-zinc-300 font-sans truncate font-medium">
          {getLaymanExplanation()}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onOpenGuide}
          className="px-2.5 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded text-[10px] font-mono font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-[0_0_8px_rgba(34,211,238,0.15)]"
        >
          <span>🎓</span>
          <span>HOW IT WORKS (FOR BEGINNERS)</span>
        </button>
      </div>
    </div>
  );
}
