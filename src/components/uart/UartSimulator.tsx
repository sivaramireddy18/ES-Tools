"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import UartAnalyzer, { UartRealtimeData } from "./UartAnalyzer";
import UartTerminal, { UartTerminalMessage } from "./UartTerminal";
import LiveNarrationBanner from "@/components/common/LiveNarrationBanner";
import BeginnerGuideModal from "@/components/common/BeginnerGuideModal";

export default function UartSimulator() {
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Transceiver Settings
  const [masterBaud, setMasterBaud] = useState<number>(115200);
  const [receiverBaud, setReceiverBaud] = useState<number>(115200);
  const [dataBits, setDataBits] = useState<number>(8);
  const [parity, setParity] = useState<"None" | "Even" | "Odd">("None");
  const [stopBits, setStopBits] = useState<number>(1);
  const [txText, setTxText] = useState<string>("Hello, MCU!");
  const [animSpeed, setAnimSpeed] = useState<number>(1);
  const [isContinuous, setIsContinuous] = useState<boolean>(false);

  // Active Bit Tracking for Cable Animation
  const [activeChar, setActiveChar] = useState<string>("H");
  const [currentBit, setCurrentBit] = useState<number>(0);

  // Flow Control
  const [useFlowControl, setUseFlowControl] = useState<boolean>(false);
  const [ctsActive, setCtsActive] = useState<boolean>(true);

  // ─── Real-Time Smooth Streaming Engine ────────────────────────────────────
  const [realtimeData, setRealtimeData] = useState<UartRealtimeData>({
    txHistory: new Array(100).fill(1.0),
    rxHistory: new Array(100).fill(1.0),
    baudRate: 115200,
    currentPhase: "LINE IDLE (MARK)",
    isStreaming: false,
    hasFramingError: false,
  });

  const [logs, setLogs] = useState<UartTerminalMessage[]>([
    {
      id: "init",
      time: "00:00:00.100",
      type: "INFO",
      text: "UART Transceiver online @ 115200 baud 8N1",
      hex: "",
    },
  ]);

  // Engine Refs
  const txTargetRef = useRef<number>(1.0);
  const rxTargetRef = useRef<number>(1.0);
  const curTxRef = useRef<number>(1.0);
  const curRxRef = useRef<number>(1.0);
  const isStreamingRef = useRef<boolean>(false);
  const transactionQueueRef = useRef<{
    tx: number;
    rx: number;
    phase: string;
    char?: string;
    bitIdx?: number;
    completedChar?: string;
    isError?: boolean;
  }[]>([]);
  const animFrameIdRef = useRef<number | null>(null);

  // 60 FPS Slew-Rate Interpolator
  useEffect(() => {
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      const slewSpeed = 30.0 * animSpeed;
      curTxRef.current += (txTargetRef.current - curTxRef.current) * Math.min(1, dt * slewSpeed);
      curRxRef.current += (rxTargetRef.current - curRxRef.current) * Math.min(1, dt * slewSpeed);

      if (Math.abs(txTargetRef.current - curTxRef.current) < 0.02) curTxRef.current = txTargetRef.current;
      if (Math.abs(rxTargetRef.current - curRxRef.current) < 0.02) curRxRef.current = rxTargetRef.current;

      setRealtimeData((prev) => ({
        ...prev,
        txHistory: [...prev.txHistory.slice(-280), curTxRef.current],
        rxHistory: [...prev.rxHistory.slice(-280), curRxRef.current],
      }));

      animFrameIdRef.current = requestAnimationFrame(loop);
    };

    animFrameIdRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [animSpeed]);

  // Step Sequencer
  useEffect(() => {
    const stepIntervalMs = Math.max(20, Math.round(45 / animSpeed));

    const timer = setInterval(() => {
      if (transactionQueueRef.current.length > 0) {
        const nextStep = transactionQueueRef.current.shift()!;
        txTargetRef.current = nextStep.tx;
        rxTargetRef.current = nextStep.rx;

        if (nextStep.char !== undefined) setActiveChar(nextStep.char);
        if (nextStep.bitIdx !== undefined) setCurrentBit(nextStep.bitIdx);

        setRealtimeData((prev) => ({
          ...prev,
          baudRate: masterBaud,
          currentPhase: nextStep.phase,
          isStreaming: true,
          hasFramingError: masterBaud !== receiverBaud,
        }));

        if (nextStep.completedChar) {
          const now = new Date().toTimeString().split(" ")[0];
          const isErr = masterBaud !== receiverBaud;
          const displayChar = isErr
            ? String.fromCharCode(Math.floor(Math.random() * 26) + 65)
            : nextStep.completedChar;

          setLogs((prev) => [
            ...prev,
            {
              id: `${Date.now()}-${Math.random()}`,
              time: now,
              type: isErr ? "ERROR" : "RX",
              text: `Received Byte: '${displayChar}' (ASCII ${displayChar.charCodeAt(0)})`,
              hex: `0x${displayChar.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`,
            },
          ]);
        }
      } else {
        if (isStreamingRef.current) {
          isStreamingRef.current = false;
          setRealtimeData((prev) => ({
            ...prev,
            currentPhase: "LINE IDLE (MARK)",
            isStreaming: false,
          }));

          if (isContinuous) {
            setTimeout(() => {
              executeTransmit();
            }, 600);
          }
        }
      }
    }, stepIntervalMs);

    return () => clearInterval(timer);
  }, [animSpeed, masterBaud, receiverBaud, isContinuous]);

  // ─── Generate Serial Frame Queue ──────────────────────────────────────────
  const executeTransmit = useCallback(() => {
    if (transactionQueueRef.current.length > 0) return;

    isStreamingRef.current = true;
    const isMismatch = masterBaud !== receiverBaud;
    const queue: {
      tx: number;
      rx: number;
      phase: string;
      char?: string;
      bitIdx?: number;
      completedChar?: string;
      isError?: boolean;
    }[] = [];

    const now = new Date().toTimeString().split(" ")[0];

    // Log TX Action
    const bytes: number[] = [];
    for (let i = 0; i < txText.length; i++) bytes.push(txText.charCodeAt(i));
    const hexStr = bytes
      .map((b) => `0x${b.toString(16).toUpperCase().padStart(2, "0")}`)
      .join(" ");

    setLogs((prev) => [
      ...prev,
      {
        id: `tx-${Date.now()}`,
        time: now,
        type: "TX",
        text: `Transmitting Payload: "${txText}"`,
        hex: hexStr,
      },
    ]);

    // 1. Idle Line (Mark = 1)
    for (let i = 0; i < 3; i++) {
      queue.push({ tx: 1, rx: 1, phase: "LINE IDLE (MARK)", char: txText[0] || "H", bitIdx: 0 });
    }

    // Process each character in string
    txText.split("").forEach((char) => {
      const b = char.charCodeAt(0);

      // START BIT (0)
      queue.push({
        tx: 0,
        rx: 0,
        phase: `START BIT (SPACE: 0) ['${char}']`,
        char,
        bitIdx: 1,
      });
      queue.push({
        tx: 0,
        rx: isMismatch ? 1 : 0,
        phase: `START BIT ['${char}']`,
        char,
        bitIdx: 1,
      });

      // DATA BITS (LSB to MSB)
      let parityCount = 0;
      for (let bit = 0; bit < dataBits; bit++) {
        const bitVal = (b >> bit) & 1;
        if (bitVal === 1) parityCount++;
        const rxBitVal = isMismatch && Math.random() > 0.4 ? 1 - bitVal : bitVal;

        queue.push({
          tx: bitVal,
          rx: rxBitVal,
          phase: `DATA BIT ${bit}: ${bitVal} ['${char}']`,
          char,
          bitIdx: 2 + bit,
        });
      }

      // PARITY BIT
      if (parity !== "None") {
        let parityBit = 0;
        if (parity === "Even") parityBit = parityCount % 2 === 0 ? 0 : 1;
        else if (parity === "Odd") parityBit = parityCount % 2 === 0 ? 1 : 0;

        queue.push({
          tx: parityBit,
          rx: isMismatch ? 1 - parityBit : parityBit,
          phase: `PARITY BIT: ${parityBit} (${parity})`,
          char,
          bitIdx: 2 + dataBits,
        });
      }

      // STOP BIT (1)
      for (let s = 0; s < stopBits; s++) {
        queue.push({
          tx: 1,
          rx: isMismatch ? 0 : 1,
          phase: `STOP BIT (MARK: 1) ['${char}']`,
          char,
          bitIdx: 2 + dataBits + (parity !== "None" ? 1 : 0) + s,
          completedChar: s === stopBits - 1 ? char : undefined,
        });
      }

      // Inter-character gap
      queue.push({ tx: 1, rx: 1, phase: "INTER-FRAME IDLE", char, bitIdx: 10 });
    });

    for (let i = 0; i < 3; i++) {
      queue.push({ tx: 1, rx: 1, phase: "LINE IDLE (MARK)", char: txText[0] || "H", bitIdx: 0 });
    }

    transactionQueueRef.current = queue;
  }, [txText, masterBaud, receiverBaud, dataBits, parity, stopBits]);

  return (
    <div className="w-full h-full flex flex-col bg-[#060709] font-mono text-zinc-200 select-none overflow-hidden">
      {/* Header Toolbar */}
      <div className="h-10 px-4 bg-[#0d0e14] border-b border-zinc-800/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse" />
          <span className="text-xs font-bold text-cyan-300 tracking-wider">
            UART / USART ASYNCHRONOUS SERIAL BENCH
          </span>
          <span className="text-[10px] text-zinc-500 hidden sm:inline">
            // LIVE 60 FPS BIT STREAM ENGINE
          </span>
        </div>

        {/* Speed & Stream Controls */}
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
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold"
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
        protocol="uart"
        currentPhase={realtimeData.currentPhase}
        isStreaming={realtimeData.isStreaming}
        onOpenGuide={() => setIsGuideOpen(true)}
      />

      {/* Beginner Guide Modal */}
      <BeginnerGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        initialTopic="uart"
      />

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[25%_50%_25%] overflow-hidden bg-[#060709]">
        {/* ────────── LEFT: UART Transceiver Controller ────────── */}
        <section className="h-full border-r border-zinc-800/80 bg-[#0c0e14] p-3.5 space-y-3 overflow-y-auto">
          <div className="border-b border-zinc-800 pb-1.5 flex justify-between items-center">
            <span className="text-[11px] font-bold text-zinc-300 tracking-wide flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-sm bg-cyan-400" />
              TRANSMITTER SETTINGS
            </span>
            <span className="text-[9px] text-cyan-400 font-bold">
              {realtimeData.isStreaming ? "● STREAMING" : "○ READY"}
            </span>
          </div>

          {/* Master Baud Rate Selector */}
          <div className="space-y-1">
            <label className="text-[9px] text-zinc-500 uppercase font-semibold block">
              Transmitter (TX) Baud Rate
            </label>
            <select
              value={masterBaud}
              onChange={(e) => setMasterBaud(parseInt(e.target.value, 10))}
              className="w-full px-2.5 py-1.5 bg-[#12151e] border border-zinc-700/80 rounded text-cyan-300 font-bold focus:outline-none focus:border-cyan-400 cursor-pointer text-xs"
            >
              {[9600, 19200, 38400, 57600, 115200, 921600].map((b) => (
                <option key={b} value={b}>
                  {b} baud
                </option>
              ))}
            </select>
          </div>

          {/* Receiver Baud Rate Selector (for Glitch Simulation) */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[9px] text-zinc-500 uppercase font-semibold">
                Receiver (RX) Baud Rate
              </label>
              {masterBaud !== receiverBaud && (
                <span className="text-[8px] text-rose-400 font-bold animate-pulse">
                  MISMATCH!
                </span>
              )}
            </div>
            <select
              value={receiverBaud}
              onChange={(e) => setReceiverBaud(parseInt(e.target.value, 10))}
              className={`w-full px-2.5 py-1.5 bg-[#12151e] border rounded font-bold focus:outline-none cursor-pointer text-xs ${
                masterBaud !== receiverBaud
                  ? "border-rose-500 text-rose-400"
                  : "border-zinc-700/80 text-emerald-300"
              }`}
            >
              {[9600, 19200, 38400, 57600, 115200, 921600].map((b) => (
                <option key={b} value={b}>
                  {b} baud
                </option>
              ))}
            </select>
          </div>

          {/* Data Bits, Parity, Stop Bits */}
          <div className="grid grid-cols-3 gap-1.5 text-[10px]">
            <div>
              <label className="text-[8px] text-zinc-500 uppercase block mb-0.5 font-bold">
                DATA BITS
              </label>
              <select
                value={dataBits}
                onChange={(e) => setDataBits(parseInt(e.target.value, 10))}
                className="w-full p-1 bg-[#12151e] border border-zinc-700/80 rounded text-zinc-300"
              >
                {[7, 8, 9].map((d) => (
                  <option key={d} value={d}>
                    {d} bits
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[8px] text-zinc-500 uppercase block mb-0.5 font-bold">
                PARITY
              </label>
              <select
                value={parity}
                onChange={(e) => setParity(e.target.value as typeof parity)}
                className="w-full p-1 bg-[#12151e] border border-zinc-700/80 rounded text-zinc-300"
              >
                <option value="None">None (N)</option>
                <option value="Even">Even (E)</option>
                <option value="Odd">Odd (O)</option>
              </select>
            </div>

            <div>
              <label className="text-[8px] text-zinc-500 uppercase block mb-0.5 font-bold">
                STOP BITS
              </label>
              <select
                value={stopBits}
                onChange={(e) => setStopBits(parseInt(e.target.value, 10))}
                className="w-full p-1 bg-[#12151e] border border-zinc-700/80 rounded text-zinc-300"
              >
                <option value={1}>1 bit</option>
                <option value={2}>2 bits</option>
              </select>
            </div>
          </div>

          {/* TX Payload Input */}
          <div className="space-y-1">
            <label className="text-[9px] text-zinc-500 uppercase font-semibold block">
              ASCII Message Payload
            </label>
            <input
              type="text"
              value={txText}
              onChange={(e) => setTxText(e.target.value)}
              className="w-full px-2.5 py-2 bg-[#12151e] border border-zinc-700/80 rounded text-cyan-300 font-bold focus:outline-none focus:border-cyan-400 text-xs"
              placeholder="Hello, MCU!"
            />
          </div>

          {/* Hardware Flow Control */}
          <div className="p-2.5 bg-[#0a0c10] border border-zinc-800 rounded space-y-2 text-[10px]">
            <span className="text-[9px] font-bold text-zinc-400 uppercase block">
              Hardware Flow Control (RTS / CTS)
            </span>
            <label className="flex items-center gap-2 cursor-pointer text-zinc-400">
              <input
                type="checkbox"
                checked={useFlowControl}
                onChange={(e) => setUseFlowControl(e.target.checked)}
                className="rounded accent-cyan-500"
              />
              <span>Enable RTS/CTS Handshake</span>
            </label>
            {useFlowControl && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-zinc-500">CTS Line State:</span>
                <button
                  onClick={() => setCtsActive((c) => !c)}
                  className={`px-2 py-0.5 rounded font-bold text-[9px] cursor-pointer ${
                    ctsActive
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                  }`}
                >
                  {ctsActive ? "CTS ACTIVE (CLEAR TO SEND)" : "CTS INACTIVE (BLOCKED)"}
                </button>
              </div>
            )}
          </div>

          {/* Transmit Button */}
          <button
            onClick={executeTransmit}
            disabled={useFlowControl && !ctsActive}
            className="w-full py-3 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-zinc-950 font-bold rounded text-xs tracking-wider shadow-[0_0_15px_rgba(34,211,238,0.3)] cursor-pointer transition-all active:scale-[0.98] disabled:opacity-40"
          >
            ⚡ STREAM SERIAL FRAME
          </button>
        </section>

        {/* ────────── CENTER: Live Oscilloscope Waveform ────────── */}
        <section className="h-full border-r border-zinc-800/80 bg-[#080a0e] flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden relative">
            <UartAnalyzer data={realtimeData} />
          </div>
        </section>

        {/* ────────── RIGHT: Terminal Console with Cable Visualizer ────────── */}
        <section className="h-full bg-[#0c0e14] p-3.5 overflow-hidden flex flex-col">
          <UartTerminal
            logs={logs}
            clearLogs={() => setLogs([])}
            masterBaud={masterBaud}
            receiverBaud={receiverBaud}
            isMismatch={masterBaud !== receiverBaud}
            isStreaming={realtimeData.isStreaming}
            activeChar={activeChar}
            currentBit={currentBit}
          />
        </section>
      </div>
    </div>
  );
}
