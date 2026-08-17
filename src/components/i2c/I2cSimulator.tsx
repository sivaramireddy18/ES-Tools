"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import I2cAnalyzer, { I2cRealtimeData, I2cDecodedPill } from "./I2cAnalyzer";
import I2cVirtualPeripherals, {
  EepromState,
  Tmp102State,
  Ds3231State,
} from "./I2cVirtualPeripherals";
import LiveNarrationBanner from "@/components/common/LiveNarrationBanner";
import BeginnerGuideModal from "@/components/common/BeginnerGuideModal";

interface I2cPacketLog {
  id: string;
  time: string;
  addr: string;
  mode: "WRITE" | "READ";
  reg: string;
  data: string;
  ack: boolean;
}

export default function I2cSimulator() {
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Master Controller Inputs
  const [devicePreset, setDevicePreset] = useState<"custom" | "eeprom" | "tmp102" | "ds3231">("eeprom");
  const [targetAddress, setTargetAddress] = useState<string>("0x50");
  const [opMode, setOpMode] = useState<"WRITE" | "READ">("WRITE");
  const [regAddress, setRegAddress] = useState<string>("0x00");
  const [dataPayload, setDataPayload] = useState<string>("0x48 0x65 0x6C 0x6C 0x6F"); // "Hello"
  const [animSpeed, setAnimSpeed] = useState<number>(1); // 1 = Normal, 0.5 = Slow-mo, 2 = Fast
  const [isContinuous, setIsContinuous] = useState<boolean>(false);

  // Fault Injection
  const [injectNack, setInjectNack] = useState<boolean>(false);
  const [missingPullUp, setMissingPullUp] = useState<boolean>(false);
  const [clockStretch, setClockStretch] = useState<boolean>(false);

  // Virtual Slave States
  const [eeprom, setEeprom] = useState<EepromState>({
    memory: new Uint8Array(256),
  });
  const [tmp102, setTmp102] = useState<Tmp102State>({ temperatureC: 25.0 });
  const [ds3231, setDs3231] = useState<Ds3231State>({ hours: 12, minutes: 34, seconds: 56 });

  // Clock timer for DS3231 RTC
  useEffect(() => {
    const timer = setInterval(() => {
      setDs3231((prev) => {
        let sec = prev.seconds + 1;
        let min = prev.minutes;
        let hr = prev.hours;
        if (sec >= 60) { sec = 0; min += 1; }
        if (min >= 60) { min = 0; hr += 1; }
        if (hr >= 24) hr = 0;
        return { hours: hr, minutes: min, seconds: sec };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ─── Real-Time Smooth Streaming Engine ────────────────────────────────────
  const [realtimeData, setRealtimeData] = useState<I2cRealtimeData>({
    sclHistory: new Array(100).fill(1.0),
    sdaHistory: new Array(100).fill(1.0),
    pills: [],
    currentPhase: "BUS IDLE",
    isStreaming: false,
  });

  const [packetLogs, setPacketLogs] = useState<I2cPacketLog[]>([]);

  // Engine Refs
  const sclTargetRef = useRef<number>(1.0);
  const sdaTargetRef = useRef<number>(1.0);
  const curSclRef = useRef<number>(1.0);
  const curSdaRef = useRef<number>(1.0);
  const isStreamingRef = useRef<boolean>(false);
  const transactionQueueRef = useRef<{ scl: number; sda: number; pill?: I2cDecodedPill; phase: string }[]>([]);
  const animFrameIdRef = useRef<number | null>(null);

  // Smooth Slew-Rate Interpolator Loop (~60 FPS)
  useEffect(() => {
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      // Slew rate smoothing (analog capacitance simulation)
      const slewSpeed = 25.0 * animSpeed; // transition rate
      curSclRef.current += (sclTargetRef.current - curSclRef.current) * Math.min(1, dt * slewSpeed);
      curSdaRef.current += (sdaTargetRef.current - curSdaRef.current) * Math.min(1, dt * slewSpeed);

      // Snap if very close
      if (Math.abs(sclTargetRef.current - curSclRef.current) < 0.02) curSclRef.current = sclTargetRef.current;
      if (Math.abs(sdaTargetRef.current - curSdaRef.current) < 0.02) curSdaRef.current = sdaTargetRef.current;

      // Update state history
      setRealtimeData((prev) => {
        const nextScl = [...prev.sclHistory.slice(-280), curSclRef.current];
        const nextSda = [...prev.sdaHistory.slice(-280), curSdaRef.current];
        return {
          ...prev,
          sclHistory: nextScl,
          sdaHistory: nextSda,
        };
      });

      animFrameIdRef.current = requestAnimationFrame(loop);
    };

    animFrameIdRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [animSpeed]);

  // Queue Step Sequencer Timer
  useEffect(() => {
    const stepIntervalMs = Math.max(20, Math.round(55 / animSpeed));

    const timer = setInterval(() => {
      if (transactionQueueRef.current.length > 0) {
        const nextStep = transactionQueueRef.current.shift()!;
        sclTargetRef.current = nextStep.scl;
        sdaTargetRef.current = missingPullUp ? 0.0 : nextStep.sda;

        setRealtimeData((prev) => {
          const nextPills = nextStep.pill
            ? [...prev.pills, { ...nextStep.pill, samplePos: prev.sclHistory.length }]
            : prev.pills;
          return {
            ...prev,
            pills: nextPills.slice(-15),
            currentPhase: nextStep.phase,
            isStreaming: true,
          };
        });
      } else {
        if (isStreamingRef.current) {
          isStreamingRef.current = false;
          setRealtimeData((prev) => ({
            ...prev,
            currentPhase: "BUS IDLE",
            isStreaming: false,
          }));

          // If continuous streaming is active, trigger next cycle
          if (isContinuous) {
            setTimeout(() => {
              executeTransaction();
            }, 600);
          }
        }
      }
    }, stepIntervalMs);

    return () => clearInterval(timer);
  }, [animSpeed, missingPullUp, isContinuous]);

  // Preset switch
  const handlePresetChange = (preset: typeof devicePreset) => {
    setDevicePreset(preset);
    if (preset === "eeprom") {
      setTargetAddress("0x50");
      setRegAddress("0x00");
      setDataPayload("0x48 0x65 0x6C 0x6C 0x6F");
    } else if (preset === "tmp102") {
      setTargetAddress("0x48");
      setRegAddress("0x00");
      setDataPayload("0x00");
    } else if (preset === "ds3231") {
      setTargetAddress("0x68");
      setRegAddress("0x00");
      setDataPayload("0x00");
    }
  };

  // ─── Generate and Queue Live Transaction Steps ────────────────────────────
  const executeTransaction = useCallback(() => {
    if (transactionQueueRef.current.length > 0) return; // already executing

    isStreamingRef.current = true;
    const queue: { scl: number; sda: number; pill?: I2cDecodedPill; phase: string }[] = [];

    let addrNum = parseInt(targetAddress.replace("0x", ""), 16) || 0x50;
    addrNum &= 0x7f;
    const isRead = opMode === "READ";
    const rwBit = isRead ? 1 : 0;
    const isAck = !injectNack;

    const bytesToTransmit: number[] = [];
    if (regAddress) bytesToTransmit.push(parseInt(regAddress.replace("0x", ""), 16) || 0);
    if (!isRead && dataPayload) {
      const parts = dataPayload.split(/\s+/).filter(Boolean);
      for (const p of parts) bytesToTransmit.push(parseInt(p.replace("0x", ""), 16) || 0);
    }

    // 1. Idle (SCL=1, SDA=1)
    for (let i = 0; i < 3; i++) queue.push({ scl: 1, sda: 1, phase: "BUS IDLE" });

    // 2. START Condition (SDA goes LOW while SCL is HIGH)
    queue.push({
      scl: 1,
      sda: 0,
      pill: { label: "START", color: "#22d3ee", samplePos: 0 },
      phase: "START CONDITION",
    });
    queue.push({ scl: 0, sda: 0, phase: "START TRANSITION" });

    // Helper: Push byte bit-by-bit
    const pushByte = (byteVal: number, label: string, color: string, isAckBit: boolean) => {
      // 8 bits
      for (let bit = 7; bit >= 0; bit--) {
        const bitVal = (byteVal >> bit) & 1;
        // SCL Low: Set SDA
        queue.push({ scl: 0, sda: bitVal, phase: `${label} [bit ${bit}: ${bitVal}]` });
        // SCL High: Sample SDA
        queue.push({ scl: 1, sda: bitVal, phase: `${label} [bit ${bit}: ${bitVal}] (SAMPLE)` });
      }

      // ACK / NACK Clock
      const ackVal = isAckBit ? 0 : 1;
      queue.push({
        scl: 0,
        sda: ackVal,
        pill: {
          label: isAckBit ? "ACK" : "NACK",
          color: isAckBit ? "#34d399" : "#f43f5e",
          samplePos: 0,
        },
        phase: isAckBit ? "SLAVE ACK" : "NACK (NO RESPONSE)",
      });

      // Clock stretch
      if (clockStretch) {
        for (let cs = 0; cs < 4; cs++) {
          queue.push({ scl: 0, sda: ackVal, phase: "CLOCK STRETCH (SLAVE HOLD SCL LOW)" });
        }
      }

      queue.push({ scl: 1, sda: ackVal, phase: isAckBit ? "ACK SAMPLE" : "NACK SAMPLE" });
      queue.push({ scl: 0, sda: ackVal, phase: "BYTE COMPLETED" });
    };

    // 3. Address Byte
    const addrByte = (addrNum << 1) | rwBit;
    pushByte(
      addrByte,
      `ADDR 0x${addrNum.toString(16).toUpperCase()} ${isRead ? "R" : "W"}`,
      "#38bdf8",
      isAck
    );

    // 4. Data / Register Bytes
    if (isAck) {
      if (isRead) {
        let readVal = 0x00;
        if (addrNum === 0x48) readVal = (Math.round(tmp102.temperatureC * 16) << 4 >> 8) & 0xff;
        else if (addrNum === 0x68) readVal = ds3231.seconds;
        else if (addrNum === 0x50) readVal = eeprom.memory[parseInt(regAddress.replace("0x", ""), 16) || 0] || 0;

        pushByte(readVal, `DATA READ 0x${readVal.toString(16).toUpperCase()}`, "#a855f7", true);
      } else {
        bytesToTransmit.forEach((b, idx) => {
          pushByte(
            b,
            idx === 0 ? `REG 0x${b.toString(16).toUpperCase()}` : `DATA 0x${b.toString(16).toUpperCase()}`,
            idx === 0 ? "#fbbf24" : "#a855f7",
            true
          );
        });

        // Write to virtual EEPROM
        if (addrNum === 0x50 && bytesToTransmit.length > 1) {
          const regAddrVal = bytesToTransmit[0];
          const newMem = new Uint8Array(eeprom.memory);
          for (let i = 1; i < bytesToTransmit.length; i++) {
            newMem[(regAddrVal + i - 1) % 256] = bytesToTransmit[i];
          }
          setEeprom({ memory: newMem });
        }
      }
    }

    // 5. STOP Condition (SDA rises while SCL is HIGH)
    queue.push({ scl: 0, sda: 0, phase: "STOP SETUP" });
    queue.push({
      scl: 1,
      sda: 0,
      pill: { label: "STOP", color: "#f43f5e", samplePos: 0 },
      phase: "STOP CONDITION",
    });
    queue.push({ scl: 1, sda: 1, phase: "BUS IDLE" });

    for (let i = 0; i < 3; i++) queue.push({ scl: 1, sda: 1, phase: "BUS IDLE" });

    transactionQueueRef.current = queue;

    // Append log
    const now = new Date().toTimeString().split(" ")[0];
    setPacketLogs((prev) => [
      {
        id: `${Date.now()}`,
        time: now,
        addr: `0x${addrNum.toString(16).toUpperCase()}`,
        mode: opMode,
        reg: regAddress || "N/A",
        data: isRead ? "(Read Data)" : dataPayload || "N/A",
        ack: isAck,
      },
      ...prev.slice(0, 15),
    ]);
  }, [
    targetAddress,
    opMode,
    regAddress,
    dataPayload,
    injectNack,
    clockStretch,
    tmp102.temperatureC,
    ds3231.seconds,
    eeprom.memory,
  ]);

  return (
    <div className="w-full h-full flex flex-col bg-[#060709] font-mono text-zinc-200 select-none overflow-hidden">
      {/* Top Banner Toolbar */}
      <div className="h-10 px-4 bg-[#0d0e14] border-b border-zinc-800/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse" />
          <span className="text-xs font-bold text-cyan-300 tracking-wider">
            I2C 2-WIRE BUS VALIDATION BENCH
          </span>
          <span className="text-[10px] text-zinc-500 hidden sm:inline">
            // LIVE ROLLING 60 FPS SIGNAL ENGINE
          </span>
        </div>

        {/* Speed & Stream Mode Controls */}
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
        protocol="i2c"
        currentPhase={realtimeData.currentPhase}
        isStreaming={realtimeData.isStreaming}
        onOpenGuide={() => setIsGuideOpen(true)}
      />

      {/* Beginner Guide Modal */}
      <BeginnerGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        initialTopic="i2c"
      />

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[25%_50%_25%] overflow-hidden bg-[#060709]">
        {/* ────────── LEFT: Master Controller ────────── */}
        <section className="h-full border-r border-zinc-800/80 bg-[#0c0e14] p-3.5 space-y-3 overflow-y-auto">
          <div className="border-b border-zinc-800 pb-1.5 flex justify-between items-center">
            <span className="text-[11px] font-bold text-zinc-300 tracking-wide flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-sm bg-cyan-400" />
              I2C MASTER CONTROLLER
            </span>
            <span className="text-[9px] text-cyan-400 font-bold">
              {realtimeData.isStreaming ? "● TRANSMITTING" : "○ READY"}
            </span>
          </div>

          {/* Preset Chips */}
          <div className="space-y-1">
            <label className="text-[9px] text-zinc-500 uppercase font-semibold block">
              Quick Target Preset
            </label>
            <div className="grid grid-cols-3 gap-1">
              <button
                onClick={() => handlePresetChange("eeprom")}
                className={`py-1 text-[9px] rounded font-bold transition-colors cursor-pointer ${
                  devicePreset === "eeprom"
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                    : "bg-zinc-900 text-zinc-500 border border-zinc-800"
                }`}
              >
                EEPROM [0x50]
              </button>
              <button
                onClick={() => handlePresetChange("tmp102")}
                className={`py-1 text-[9px] rounded font-bold transition-colors cursor-pointer ${
                  devicePreset === "tmp102"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-zinc-900 text-zinc-500 border border-zinc-800"
                }`}
              >
                TMP102 [0x48]
              </button>
              <button
                onClick={() => handlePresetChange("ds3231")}
                className={`py-1 text-[9px] rounded font-bold transition-colors cursor-pointer ${
                  devicePreset === "ds3231"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    : "bg-zinc-900 text-zinc-500 border border-zinc-800"
                }`}
              >
                DS3231 [0x68]
              </button>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-2 text-[11px]">
            <div>
              <label className="text-[9px] text-zinc-500 uppercase block font-semibold mb-0.5">
                Target 7-Bit Slave Address (Hex)
              </label>
              <input
                type="text"
                value={targetAddress}
                onChange={(e) => setTargetAddress(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#12151e] border border-zinc-700/80 rounded text-cyan-300 font-bold focus:outline-none focus:border-cyan-400"
                placeholder="0x50"
              />
            </div>

            <div>
              <label className="text-[9px] text-zinc-500 uppercase block font-semibold mb-0.5">
                Operation Mode (R / W)
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setOpMode("WRITE")}
                  className={`py-1.5 rounded font-bold text-[10px] cursor-pointer ${
                    opMode === "WRITE"
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400"
                      : "bg-zinc-900 text-zinc-500 border border-zinc-800"
                  }`}
                >
                  WRITE (R/W=0)
                </button>
                <button
                  onClick={() => setOpMode("READ")}
                  className={`py-1.5 rounded font-bold text-[10px] cursor-pointer ${
                    opMode === "READ"
                      ? "bg-purple-500/20 text-purple-300 border border-purple-400"
                      : "bg-zinc-900 text-zinc-500 border border-zinc-800"
                  }`}
                >
                  READ (R/W=1)
                </button>
              </div>
            </div>

            <div>
              <label className="text-[9px] text-zinc-500 uppercase block font-semibold mb-0.5">
                Register / Memory Address (Hex)
              </label>
              <input
                type="text"
                value={regAddress}
                onChange={(e) => setRegAddress(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#12151e] border border-zinc-700/80 rounded text-zinc-200 focus:outline-none focus:border-cyan-400"
                placeholder="0x00"
              />
            </div>

            {opMode === "WRITE" && (
              <div>
                <label className="text-[9px] text-zinc-500 uppercase block font-semibold mb-0.5">
                  Data Bytes (Hex Space-Separated)
                </label>
                <input
                  type="text"
                  value={dataPayload}
                  onChange={(e) => setDataPayload(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#12151e] border border-zinc-700/80 rounded text-emerald-300 font-bold focus:outline-none focus:border-cyan-400"
                  placeholder="0x48 0x65 0x6C 0x6C 0x6F"
                />
              </div>
            )}
          </div>

          {/* Fault Injection Panel */}
          <div className="p-2.5 bg-[#0a0c10] border border-zinc-800/80 rounded space-y-2">
            <span className="text-[9px] font-bold text-rose-400 uppercase block">
              ⚠ Bus Fault Injection Tests
            </span>
            <div className="space-y-1.5 text-[10px]">
              <label className="flex items-center gap-2 cursor-pointer text-zinc-400">
                <input
                  type="checkbox"
                  checked={injectNack}
                  onChange={(e) => setInjectNack(e.target.checked)}
                  className="rounded accent-rose-500"
                />
                <span>Simulate NACK on Address</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-zinc-400">
                <input
                  type="checkbox"
                  checked={missingPullUp}
                  onChange={(e) => setMissingPullUp(e.target.checked)}
                  className="rounded accent-rose-500"
                />
                <span>Missing Pull-Up Resistors (GND Float)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-zinc-400">
                <input
                  type="checkbox"
                  checked={clockStretch}
                  onChange={(e) => setClockStretch(e.target.checked)}
                  className="rounded accent-rose-500"
                />
                <span>Slave Clock Stretching</span>
              </label>
            </div>
          </div>

          {/* Transmit Button */}
          <button
            onClick={executeTransaction}
            className="w-full py-3 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-zinc-950 font-bold rounded text-xs tracking-wider shadow-[0_0_15px_rgba(34,211,238,0.3)] cursor-pointer transition-all active:scale-[0.98]"
          >
            ⚡ STREAM I2C TRANSACTION
          </button>
        </section>

        {/* ────────── CENTER: Live Oscilloscope Waveform ────────── */}
        <section className="h-full border-r border-zinc-800/80 bg-[#080a0e] flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden relative">
            <I2cAnalyzer data={realtimeData} />
          </div>

          {/* Bus Traffic Table */}
          <div className="h-44 border-t border-zinc-800/80 bg-[#0c0e14] p-3 flex flex-col overflow-hidden space-y-1.5">
            <div className="flex justify-between items-center text-[10px] font-bold text-zinc-400">
              <span>I2C BUS TRANSACTION TRAFFIC LOG</span>
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
                  No I2C transactions captured. Click [STREAM I2C TRANSACTION] to capture bus frame.
                </div>
              ) : (
                packetLogs.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between bg-[#080a0e] p-1.5 rounded border border-zinc-800/60"
                  >
                    <span className="text-zinc-500">{p.time}</span>
                    <span className="text-cyan-400 font-bold">{p.addr}</span>
                    <span className={p.mode === "WRITE" ? "text-amber-400" : "text-purple-400"}>
                      {p.mode}
                    </span>
                    <span className="text-zinc-400">Reg: {p.reg}</span>
                    <span className="text-emerald-400 truncate max-w-[120px]">{p.data}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded font-bold text-[9px] ${
                        p.ack ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                      }`}
                    >
                      {p.ack ? "ACK ✓" : "NACK ✕"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* ────────── RIGHT: Virtual Slaves ────────── */}
        <section className="h-full bg-[#0c0e14] p-3.5 overflow-hidden flex flex-col">
          <I2cVirtualPeripherals
            eeprom={eeprom}
            tmp102={tmp102}
            setTmp102={setTmp102}
            ds3231={ds3231}
          />
        </section>
      </div>
    </div>
  );
}
