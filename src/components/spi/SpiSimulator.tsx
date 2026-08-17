"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import SpiAnalyzer, { SpiRealtimeData } from "./SpiAnalyzer";
import SpiShiftRegister from "./SpiShiftRegister";
import SpiVirtualPeripherals, {
  W25Q128State,
  Mcp3008State,
  Max7219State,
} from "./SpiVirtualPeripherals";
import LiveNarrationBanner from "@/components/common/LiveNarrationBanner";
import BeginnerGuideModal from "@/components/common/BeginnerGuideModal";

interface SpiPacketLog {
  id: string;
  time: string;
  cs: string;
  mode: number;
  tx: string;
  rx: string;
}

export default function SpiSimulator() {
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Controller Settings
  const [spiMode, setSpiMode] = useState<number>(0);
  const [bitOrder, setBitOrder] = useState<"MSB" | "LSB">("MSB");
  const [selectedChip, setSelectedChip] = useState<"CS0" | "CS1" | "CS2">("CS0");
  const [mosiPayload, setMosiPayload] = useState<string>("0x9F 0x00 0x00 0x00");
  const [animSpeed, setAnimSpeed] = useState<number>(1);
  const [isContinuous, setIsContinuous] = useState<boolean>(false);

  // Shift Register State
  const [masterByte, setMasterByte] = useState<number>(0x9f);
  const [slaveByte, setSlaveByte] = useState<number>(0xef);
  const [activeBit, setActiveBit] = useState<number>(0);
  const [isTransferring, setIsTransferring] = useState<boolean>(false);

  // Virtual Peripherals State
  const [flash] = useState<W25Q128State>({
    jedecId: [0xef, 0x40, 0x18],
    flashMemory: new Uint8Array(256),
  });

  const [adc, setAdc] = useState<Mcp3008State>({
    channels: [512, 256, 768, 100, 900, 350, 420, 800],
  });

  const [matrix, setMatrix] = useState<Max7219State>({
    matrix: [0x3c, 0x42, 0xa5, 0x81, 0xa5, 0x99, 0x42, 0x3c],
  });

  // ─── Real-Time Smooth Streaming Engine ────────────────────────────────────
  const [realtimeData, setRealtimeData] = useState<SpiRealtimeData>({
    sckHistory: new Array(100).fill(0.0),
    mosiHistory: new Array(100).fill(0.0),
    misoHistory: new Array(100).fill(0.0),
    csHistory: new Array(100).fill(1.0),
    mode: 0,
    currentPhase: "BUS IDLE",
    isStreaming: false,
  });

  const [packetLogs, setPacketLogs] = useState<SpiPacketLog[]>([]);

  // Engine Refs
  const sckTargetRef = useRef<number>(0.0);
  const mosiTargetRef = useRef<number>(0.0);
  const misoTargetRef = useRef<number>(0.0);
  const csTargetRef = useRef<number>(1.0);

  const curSckRef = useRef<number>(0.0);
  const curMosiRef = useRef<number>(0.0);
  const curMisoRef = useRef<number>(0.0);
  const curCsRef = useRef<number>(1.0);

  const isStreamingRef = useRef<boolean>(false);
  const transactionQueueRef = useRef<{
    sck: number;
    mosi: number;
    miso: number;
    cs: number;
    phase: string;
    mByte?: number;
    sByte?: number;
    bitIdx?: number;
  }[]>([]);
  const animFrameIdRef = useRef<number | null>(null);

  // 60 FPS Slew-Rate Interpolator
  useEffect(() => {
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      const slewSpeed = 28.0 * animSpeed;
      curSckRef.current += (sckTargetRef.current - curSckRef.current) * Math.min(1, dt * slewSpeed);
      curMosiRef.current += (mosiTargetRef.current - curMosiRef.current) * Math.min(1, dt * slewSpeed);
      curMisoRef.current += (misoTargetRef.current - curMisoRef.current) * Math.min(1, dt * slewSpeed);
      curCsRef.current += (csTargetRef.current - curCsRef.current) * Math.min(1, dt * slewSpeed);

      if (Math.abs(sckTargetRef.current - curSckRef.current) < 0.02) curSckRef.current = sckTargetRef.current;
      if (Math.abs(mosiTargetRef.current - curMosiRef.current) < 0.02) curMosiRef.current = mosiTargetRef.current;
      if (Math.abs(misoTargetRef.current - curMisoRef.current) < 0.02) curMisoRef.current = misoTargetRef.current;
      if (Math.abs(csTargetRef.current - curCsRef.current) < 0.02) curCsRef.current = csTargetRef.current;

      setRealtimeData((prev) => ({
        ...prev,
        sckHistory: [...prev.sckHistory.slice(-280), curSckRef.current],
        mosiHistory: [...prev.mosiHistory.slice(-280), curMosiRef.current],
        misoHistory: [...prev.misoHistory.slice(-280), curMisoRef.current],
        csHistory: [...prev.csHistory.slice(-280), curCsRef.current],
      }));

      animFrameIdRef.current = requestAnimationFrame(loop);
    };

    animFrameIdRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [animSpeed]);

  // Queue Step Sequencer Timer
  useEffect(() => {
    const stepIntervalMs = Math.max(20, Math.round(50 / animSpeed));

    const timer = setInterval(() => {
      if (transactionQueueRef.current.length > 0) {
        const nextStep = transactionQueueRef.current.shift()!;
        sckTargetRef.current = nextStep.sck;
        mosiTargetRef.current = nextStep.mosi;
        misoTargetRef.current = nextStep.miso;
        csTargetRef.current = nextStep.cs;

        if (nextStep.mByte !== undefined) setMasterByte(nextStep.mByte);
        if (nextStep.sByte !== undefined) setSlaveByte(nextStep.sByte);
        if (nextStep.bitIdx !== undefined) setActiveBit(nextStep.bitIdx);

        setRealtimeData((prev) => ({
          ...prev,
          mode: spiMode,
          currentPhase: nextStep.phase,
          isStreaming: true,
        }));
      } else {
        if (isStreamingRef.current) {
          isStreamingRef.current = false;
          setIsTransferring(false);
          setRealtimeData((prev) => ({
            ...prev,
            currentPhase: "BUS IDLE",
            isStreaming: false,
          }));

          if (isContinuous) {
            setTimeout(() => {
              executeSpiTransfer();
            }, 600);
          }
        }
      }
    }, stepIntervalMs);

    return () => clearInterval(timer);
  }, [animSpeed, spiMode, isContinuous]);

  // ─── Generate SPI Transfer Queue ──────────────────────────────────────────
  const executeSpiTransfer = useCallback(() => {
    if (transactionQueueRef.current.length > 0) return;

    isStreamingRef.current = true;
    setIsTransferring(true);

    const queue: {
      sck: number;
      mosi: number;
      miso: number;
      cs: number;
      phase: string;
      mByte?: number;
      sByte?: number;
      bitIdx?: number;
    }[] = [];

    const txBytes = mosiPayload
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => parseInt(p.replace("0x", ""), 16) || 0);

    const rxBytes: number[] = [];

    const cpol = spiMode === 2 || spiMode === 3 ? 1 : 0;
    const cpha = spiMode === 1 || spiMode === 3 ? 1 : 0;

    // 1. CS Idle High
    for (let i = 0; i < 3; i++) {
      queue.push({ sck: cpol, mosi: 0, miso: 0, cs: 1, phase: "BUS IDLE" });
    }

    // 2. Assert CS (Active LOW)
    queue.push({ sck: cpol, mosi: 0, miso: 0, cs: 0, phase: `ASSERT CS (${selectedChip})` });

    // Process Bytes
    txBytes.forEach((txByte, byteIdx) => {
      let rxByte = 0x00;
      if (selectedChip === "CS0") {
        if (byteIdx === 1) rxByte = flash.jedecId[0];
        else if (byteIdx === 2) rxByte = flash.jedecId[1];
        else if (byteIdx === 3) rxByte = flash.jedecId[2];
      } else if (selectedChip === "CS1") {
        if (byteIdx === 1) rxByte = (adc.channels[0] >> 8) & 0x03;
        else if (byteIdx === 2) rxByte = adc.channels[0] & 0xff;
      } else if (selectedChip === "CS2") {
        if (byteIdx === 1 && txBytes.length >= 2) {
          const rowAddr = (txBytes[0] - 1) & 0x07;
          const newMatrix = [...matrix.matrix];
          newMatrix[rowAddr] = txByte;
          setMatrix({ matrix: newMatrix });
        }
      }
      rxBytes.push(rxByte);

      // Bit transmission (8 bits)
      for (let bit = 0; bit < 8; bit++) {
        const bitPos = bitOrder === "MSB" ? 7 - bit : bit;
        const mosiBit = (txByte >> bitPos) & 1;
        const misoBit = (rxByte >> bitPos) & 1;

        if (cpha === 0) {
          queue.push({
            sck: cpol,
            mosi: mosiBit,
            miso: misoBit,
            cs: 0,
            phase: `BYTE ${byteIdx + 1} [bit ${bit}: MOSI=${mosiBit}, MISO=${misoBit}]`,
            mByte: txByte,
            sByte: rxByte,
            bitIdx: bit,
          });
          queue.push({
            sck: 1 - cpol,
            mosi: mosiBit,
            miso: misoBit,
            cs: 0,
            phase: `BYTE ${byteIdx + 1} [SAMPLE EDGE]`,
            mByte: txByte,
            sByte: rxByte,
            bitIdx: bit,
          });
        } else {
          queue.push({
            sck: 1 - cpol,
            mosi: mosiBit,
            miso: misoBit,
            cs: 0,
            phase: `BYTE ${byteIdx + 1} [SHIFT EDGE]`,
            mByte: txByte,
            sByte: rxByte,
            bitIdx: bit,
          });
          queue.push({
            sck: cpol,
            mosi: mosiBit,
            miso: misoBit,
            cs: 0,
            phase: `BYTE ${byteIdx + 1} [SAMPLE EDGE]`,
            mByte: txByte,
            sByte: rxByte,
            bitIdx: bit,
          });
        }
      }
    });

    // 3. Deassert CS (High)
    queue.push({ sck: cpol, mosi: 0, miso: 0, cs: 1, phase: "DEASSERT CS (IDLE)" });
    for (let i = 0; i < 3; i++) {
      queue.push({ sck: cpol, mosi: 0, miso: 0, cs: 1, phase: "BUS IDLE" });
    }

    transactionQueueRef.current = queue;

    // Append log
    const now = new Date().toTimeString().split(" ")[0];
    setPacketLogs((prev) => [
      {
        id: `${Date.now()}`,
        time: now,
        cs: selectedChip,
        mode: spiMode,
        tx: txBytes.map((b) => `0x${b.toString(16).toUpperCase().padStart(2, "0")}`).join(" "),
        rx: rxBytes.map((b) => `0x${b.toString(16).toUpperCase().padStart(2, "0")}`).join(" "),
      },
      ...prev.slice(0, 15),
    ]);
  }, [
    mosiPayload,
    selectedChip,
    spiMode,
    bitOrder,
    flash.jedecId,
    adc.channels,
    matrix.matrix,
  ]);

  return (
    <div className="w-full h-full flex flex-col bg-[#060709] font-mono text-zinc-200 select-none overflow-hidden">
      {/* Header Toolbar */}
      <div className="h-10 px-4 bg-[#0d0e14] border-b border-zinc-800/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
          <span className="text-xs font-bold text-emerald-300 tracking-wider">
            SPI 4-WIRE SERIAL PERIPHERAL INTERFACE BENCH
          </span>
          <span className="text-[10px] text-zinc-500 hidden sm:inline">
            // LIVE 60 FPS FULL-DUPLEX ENGINE
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-zinc-500">SPEED:</span>
          {[
            { label: "0.5x Slow-Mo", val: 0.5 },
            { label: "1.0x Real-Time", val: 1 },
            { label: "2.0x Fast", val: 2 },
          ].map((s) => (
            <button
              key={s.val}
              onClick={() => setAnimSpeed(s.val)}
              className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                animSpeed === s.val
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold"
                  : "bg-zinc-900 text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {s.label}
            </button>
          ))}

          <button
            onClick={() => setIsContinuous((c) => !c)}
            className={`px-2.5 py-0.5 rounded font-bold border transition-colors cursor-pointer ${
              isContinuous
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_8px_rgba(52,211,153,0.3)]"
                : "bg-zinc-900 text-zinc-500 border-zinc-800"
            }`}
          >
            {isContinuous ? "● CONTINUOUS" : "○ SINGLE-SHOT"}
          </button>
        </div>
      </div>

      {/* Live Layman Narration Banner */}
      <LiveNarrationBanner
        protocol="spi"
        currentPhase={realtimeData.currentPhase}
        isStreaming={realtimeData.isStreaming}
        onOpenGuide={() => setIsGuideOpen(true)}
      />

      {/* Beginner Guide Modal */}
      <BeginnerGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        initialTopic="spi"
      />

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[25%_50%_25%] overflow-hidden bg-[#060709]">
        {/* ────────── LEFT: Master Controller ────────── */}
        <section className="h-full border-r border-zinc-800/80 bg-[#0c0e14] p-3.5 space-y-3 overflow-y-auto">
          <div className="border-b border-zinc-800 pb-1.5 flex justify-between items-center">
            <span className="text-[11px] font-bold text-zinc-300 tracking-wide flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-sm bg-emerald-400" />
              SPI MASTER CONTROLLER
            </span>
            <span className="text-[9px] text-emerald-400 font-bold">
              Mode {spiMode} (CPOL={spiMode >= 2 ? 1 : 0}, CPHA={spiMode % 2 === 1 ? 1 : 0})
            </span>
          </div>

          {/* Mode Selector */}
          <div className="space-y-1">
            <label className="text-[9px] text-zinc-500 uppercase font-semibold block">
              SPI Mode (Clock Polarity & Phase)
            </label>
            <div className="grid grid-cols-4 gap-1">
              {[0, 1, 2, 3].map((m) => (
                <button
                  key={m}
                  onClick={() => setSpiMode(m)}
                  className={`py-1 text-[9px] rounded font-bold cursor-pointer transition-colors ${
                    spiMode === m
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_6px_rgba(52,211,153,0.3)]"
                      : "bg-zinc-900 text-zinc-500 border border-zinc-800"
                  }`}
                >
                  Mode {m}
                </button>
              ))}
            </div>
          </div>

          {/* Chip Select */}
          <div className="space-y-1">
            <label className="text-[9px] text-zinc-500 uppercase font-semibold block">
              Active Slave Select (CS)
            </label>
            <div className="grid grid-cols-3 gap-1">
              <button
                onClick={() => {
                  setSelectedChip("CS0");
                  setMosiPayload("0x9F 0x00 0x00 0x00");
                }}
                className={`py-1 text-[9px] rounded font-bold cursor-pointer ${
                  selectedChip === "CS0"
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                    : "bg-zinc-900 text-zinc-500 border border-zinc-800"
                }`}
              >
                CS0: W25Q128
              </button>
              <button
                onClick={() => {
                  setSelectedChip("CS1");
                  setMosiPayload("0x01 0x80 0x00");
                }}
                className={`py-1 text-[9px] rounded font-bold cursor-pointer ${
                  selectedChip === "CS1"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-zinc-900 text-zinc-500 border border-zinc-800"
                }`}
              >
                CS1: MCP3008
              </button>
              <button
                onClick={() => {
                  setSelectedChip("CS2");
                  setMosiPayload("0x01 0xFF");
                }}
                className={`py-1 text-[9px] rounded font-bold cursor-pointer ${
                  selectedChip === "CS2"
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                    : "bg-zinc-900 text-zinc-500 border border-zinc-800"
                }`}
              >
                CS2: MAX7219
              </button>
            </div>
          </div>

          {/* Bit Order & Payload */}
          <div className="space-y-2 text-[11px]">
            <div>
              <label className="text-[9px] text-zinc-500 uppercase block font-semibold mb-0.5">
                Bit Order
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setBitOrder("MSB")}
                  className={`py-1 rounded font-bold text-[10px] cursor-pointer ${
                    bitOrder === "MSB"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400"
                      : "bg-zinc-900 text-zinc-500 border border-zinc-800"
                  }`}
                >
                  MSB FIRST
                </button>
                <button
                  onClick={() => setBitOrder("LSB")}
                  className={`py-1 rounded font-bold text-[10px] cursor-pointer ${
                    bitOrder === "LSB"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400"
                      : "bg-zinc-900 text-zinc-500 border border-zinc-800"
                  }`}
                >
                  LSB FIRST
                </button>
              </div>
            </div>

            <div>
              <label className="text-[9px] text-zinc-500 uppercase block font-semibold mb-0.5">
                MOSI Payload Bytes (Hex)
              </label>
              <input
                type="text"
                value={mosiPayload}
                onChange={(e) => setMosiPayload(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#12151e] border border-zinc-700/80 rounded text-emerald-300 font-bold focus:outline-none focus:border-emerald-400"
                placeholder="0x9F 0x00 0x00 0x00"
              />
            </div>
          </div>

          {/* Shift Register Live Component */}
          <SpiShiftRegister
            masterByte={masterByte}
            slaveByte={slaveByte}
            activeBit={activeBit}
            isTransferring={isTransferring}
            bitOrder={bitOrder}
          />

          {/* Transmit Button */}
          <button
            onClick={executeSpiTransfer}
            className="w-full py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 text-zinc-950 font-bold rounded text-xs tracking-wider shadow-[0_0_15px_rgba(52,211,153,0.3)] cursor-pointer transition-all active:scale-[0.98]"
          >
            ⚡ STREAM SPI TRANSFER
          </button>
        </section>

        {/* ────────── CENTER: Live Oscilloscope Waveform ────────── */}
        <section className="h-full border-r border-zinc-800/80 bg-[#080a0e] flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden relative">
            <SpiAnalyzer data={realtimeData} />
          </div>

          {/* Traffic Logs */}
          <div className="h-44 border-t border-zinc-800/80 bg-[#0c0e14] p-3 flex flex-col overflow-hidden space-y-1.5">
            <div className="flex justify-between items-center text-[10px] font-bold text-zinc-400">
              <span>SPI BUS PACKET TRAFFIC LOG</span>
              <button
                onClick={() => setPacketLogs([])}
                className="text-[9px] text-zinc-600 hover:text-zinc-300 cursor-pointer"
              >
                Clear
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 font-mono text-[10px] scrollbar-thin scrollbar-thumb-zinc-800">
              {packetLogs.length === 0 ? (
                <div className="text-zinc-600 text-center py-4">
                  No SPI transfers captured. Click [STREAM SPI TRANSFER] to capture bus frame.
                </div>
              ) : (
                packetLogs.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between bg-[#080a0e] p-1.5 rounded border border-zinc-800/60"
                  >
                    <span className="text-zinc-500">{p.time}</span>
                    <span className="text-cyan-400 font-bold">{p.cs}</span>
                    <span className="text-zinc-400">Mode {p.mode}</span>
                    <span className="text-emerald-400 font-bold truncate max-w-[140px]">
                      TX: {p.tx}
                    </span>
                    <span className="text-rose-400 font-bold truncate max-w-[140px]">
                      RX: {p.rx}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* ────────── RIGHT: Virtual SPI Peripherals ────────── */}
        <section className="h-full bg-[#0c0e14] p-3.5 overflow-hidden flex flex-col">
          <SpiVirtualPeripherals
            flash={flash}
            adc={adc}
            setAdc={setAdc}
            matrix={matrix}
          />
        </section>
      </div>
    </div>
  );
}
