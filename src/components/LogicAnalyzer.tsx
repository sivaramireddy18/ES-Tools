"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";

// ─── Ring Buffer (O(1) push, no Array.shift()) ──────────────────────────────

interface RingBuffer {
  data: Uint8Array;
  head: number;
  count: number;
}

function createRingBuffer(capacity: number): RingBuffer {
  return { data: new Uint8Array(capacity), head: 0, count: 0 };
}

function ringPush(rb: RingBuffer, value: number): void {
  rb.data[rb.head] = value;
  rb.head = (rb.head + 1) % rb.data.length;
  if (rb.count < rb.data.length) rb.count++;
}

function ringGet(rb: RingBuffer, index: number): number {
  if (index < 0 || index >= rb.count) return 0;
  const capacity = rb.data.length;
  const start = (rb.head - rb.count + capacity) % capacity;
  return rb.data[(start + index) % capacity];
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface LogicAnalyzerProps {
  sab?: SharedArrayBuffer | null;
  timebase?: number;
  isPaused?: boolean;
}

const NUM_CHANNELS = 8;
const MAX_SAMPLES = 500;

const CHANNEL_COLORS = [
  "#22d3ee", // D0: Cyan
  "#34d399", // D1: Emerald
  "#f43f5e", // D2: Rose
  "#fbbf24", // D3: Amber
  "#a855f7", // D4: Purple
  "#38bdf8", // D5: Sky Blue
  "#f97316", // D6: Orange
  "#ec4899", // D7: Pink
];

const CHANNEL_LABELS = [
  "D0: CLK", "D1: BEAT", "D2: UART", "D3: PWM",
  "D4: AUX0", "D5: AUX1", "D6: AUX2", "D7: AUX3",
];

const LogicAnalyzer: React.FC<LogicAnalyzerProps> = ({
  sab,
  timebase = 20,
  isPaused = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);

  // O(1) ring buffers — one per channel, allocated once
  const buffersRef = useRef<RingBuffer[]>(
    Array.from({ length: NUM_CHANNELS }, () => createRingBuffer(MAX_SAMPLES))
  );

  // Interactive state
  const [mouseX, setMouseX] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<boolean[]>(new Array(NUM_CHANNELS).fill(false));
  const [visibleSamples, setVisibleSamples] = useState(MAX_SAMPLES);

  // Mouse handlers for cursor crosshair
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMouseX(e.clientX - rect.left);
  }, []);

  const handleMouseLeave = useCallback(() => setMouseX(null), []);

  // Zoom via mouse wheel
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    setVisibleSamples((prev) => {
      const delta = e.deltaY > 0 ? 50 : -50;
      return Math.max(50, Math.min(MAX_SAMPLES, prev + delta));
    });
  }, []);

  // Toggle channel collapse
  const toggleChannel = useCallback((ch: number) => {
    setCollapsed((prev) => {
      const next = [...prev];
      next[ch] = !next[ch];
      return next;
    });
  }, []);

  // ── Main render loop ──
  useEffect(() => {
    if (!sab || !canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const sabView = new Uint8Array(sab);

    const renderLoop = () => {
      // 1. SAMPLE: push into ring buffers (O(1) per channel)
      if (!isPaused) {
        for (let ch = 0; ch < NUM_CHANNELS; ch++) {
          ringPush(buffersRef.current[ch], sabView[ch] > 0 ? 1 : 0);
        }
      }

      // 2. High-DPI scaling
      const dpr = window.devicePixelRatio || 1;
      const cssW = container.clientWidth;
      const cssH = container.clientHeight;

      if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
        canvas.width = cssW * dpr;
        canvas.height = cssH * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // 3. RENDER
      drawWaveforms(ctx, cssW, cssH);

      ctx.restore();

      // 4. Loop
      requestRef.current = requestAnimationFrame(renderLoop);
    };

    requestRef.current = requestAnimationFrame(renderLoop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [sab, isPaused, timebase, collapsed, visibleSamples, mouseX]);

  // ── Drawing ──
  const drawWaveforms = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Background
    ctx.fillStyle = "#080a0e";
    ctx.fillRect(0, 0, width, height);

    const gutterW = 60;
    const traceW = width - gutterW;
    const activeChannels = collapsed.map((c, i) => (!c ? i : -1)).filter((i) => i >= 0);
    const numActive = activeChannels.length || 1;
    const collapsedH = 14; // height of a collapsed channel row
    const numCollapsed = NUM_CHANNELS - activeChannels.length;
    const availableH = height - numCollapsed * collapsedH;
    const chH = availableH / numActive;

    // ── Vertical timebase grid ──
    ctx.strokeStyle = "#111520";
    ctx.lineWidth = 1;
    const gridSpacing = Math.max(15, (40 / (timebase || 20)) * 25);
    for (let x = gutterW; x < width; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    let yPos = 0;

    for (let ch = 0; ch < NUM_CHANNELS; ch++) {
      const isCollapsed = collapsed[ch];
      const rowH = isCollapsed ? collapsedH : chH;
      const buf = buffersRef.current[ch];
      const color = CHANNEL_COLORS[ch];

      // ── Gutter ──
      ctx.fillStyle = isCollapsed ? "#0a0c10" : "#0e1018";
      ctx.fillRect(0, yPos, gutterW, rowH);

      // Gutter right border
      ctx.strokeStyle = "#1a1e2a";
      ctx.beginPath();
      ctx.moveTo(gutterW, yPos);
      ctx.lineTo(gutterW, yPos + rowH);
      ctx.stroke();

      // Label (clickable area hint)
      ctx.fillStyle = color;
      ctx.font = isCollapsed ? "bold 9px monospace" : "bold 10px monospace";
      ctx.fillText(
        CHANNEL_LABELS[ch],
        5,
        yPos + rowH / 2 + (isCollapsed ? 3 : 4)
      );

      // ── Collapsed state indicator ──
      if (isCollapsed) {
        ctx.fillStyle = "#333";
        ctx.font = "8px monospace";
        ctx.fillText("▶", gutterW - 12, yPos + rowH / 2 + 3);
      }

      // ── Waveform trace ──
      if (!isCollapsed && buf.count > 0) {
        const yHigh = yPos + rowH * 0.18;
        const yLow = yPos + rowH * 0.82;

        // Baseline guide
        ctx.strokeStyle = "#151a25";
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(gutterW, yLow);
        ctx.lineTo(width, yLow);
        ctx.stroke();
        ctx.setLineDash([]);

        // ── Draw the waveform ──
        const samplesToShow = Math.min(buf.count, visibleSamples);
        const startIdx = buf.count - samplesToShow;
        const xStep = traceW / visibleSamples;

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();

        for (let i = 0; i < samplesToShow; i++) {
          const val = ringGet(buf, startIdx + i);
          const x = gutterW + (visibleSamples - samplesToShow + i) * xStep;
          const y = val === 1 ? yHigh : yLow;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            const prevVal = ringGet(buf, startIdx + i - 1);
            const prevY = prevVal === 1 ? yHigh : yLow;
            if (prevY !== y) ctx.lineTo(x, prevY); // Vertical edge
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();

        // ── Latest value badge ──
        const latest = ringGet(buf, buf.count - 1);
        ctx.font = "bold 9px monospace";
        ctx.fillStyle = latest === 1 ? color : "#404040";
        ctx.fillText(latest === 1 ? "H" : "L", gutterW - 14, yPos + rowH * 0.52 + 3);

        // ── Glow line at top/bottom for active signals ──
        if (latest === 1) {
          ctx.strokeStyle = color + "30";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(gutterW, yHigh);
          ctx.lineTo(width, yHigh);
          ctx.stroke();
        }
      }

      // ── Channel divider ──
      ctx.strokeStyle = "#12161f";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, yPos + rowH);
      ctx.lineTo(width, yPos + rowH);
      ctx.stroke();

      yPos += rowH;
    }

    // ── Cursor crosshair ──
    if (mouseX !== null && mouseX > gutterW && mouseX < width) {
      // Vertical cursor line
      ctx.strokeStyle = "#ffffff30";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(mouseX, 0);
      ctx.lineTo(mouseX, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Sample index tooltip
      const sampleIdx = Math.floor(((mouseX - gutterW) / traceW) * visibleSamples);
      ctx.fillStyle = "#1a1e28ee";
      ctx.fillRect(mouseX + 4, 4, 78, 20);
      ctx.strokeStyle = "#333a4a";
      ctx.strokeRect(mouseX + 4, 4, 78, 20);
      ctx.fillStyle = "#a0a0b0";
      ctx.font = "9px monospace";
      ctx.fillText(`Sample: ${sampleIdx}`, mouseX + 10, 17);
    }
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-[#080a0e] relative overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Channel toggle buttons overlay */}
      <div className="absolute top-1 left-1 flex flex-col gap-px pointer-events-auto z-10">
        {Array.from({ length: NUM_CHANNELS }, (_, ch) => (
          <button
            key={ch}
            onClick={() => toggleChannel(ch)}
            className="w-[56px] h-[13px] text-[8px] font-mono rounded-sm opacity-0 hover:opacity-80 transition-opacity cursor-pointer"
            style={{ backgroundColor: `${CHANNEL_COLORS[ch]}15` }}
            title={collapsed[ch] ? `Show ${CHANNEL_LABELS[ch]}` : `Hide ${CHANNEL_LABELS[ch]}`}
          />
        ))}
      </div>
    </div>
  );
};

export default LogicAnalyzer;
