"use client";

import React, { useEffect, useRef } from "react";

export interface I2cDecodedPill {
  label: string;
  color: string;
  samplePos: number;
}

export interface I2cRealtimeData {
  sclHistory: number[]; // Circular or rolling history of SCL values (float 0.0 to 1.0 for smooth rise/fall)
  sdaHistory: number[]; // Float 0.0 to 1.0
  pills: I2cDecodedPill[];
  currentPhase: string;
  isStreaming: boolean;
}

interface Props {
  data: I2cRealtimeData;
}

export default function I2cAnalyzer({ data }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = container.clientHeight;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // Background with faint phosphor grid
    ctx.fillStyle = "#07090e";
    ctx.fillRect(0, 0, width, height);

    const gutterW = 68;
    const traceW = width - gutterW;
    const chHeight = (height - 36) / 2;

    // Timebase grid lines (rolling)
    ctx.strokeStyle = "#111522";
    ctx.lineWidth = 1;
    for (let x = gutterW; x < width; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height - 36);
      ctx.stroke();
    }

    const { sclHistory, sdaHistory, pills, currentPhase, isStreaming } = data;
    const maxSamples = 240;
    const xStep = traceW / maxSamples;

    // ───────────────── SCL Channel ─────────────────
    const ySclOffset = 0;
    const ySclHigh = ySclOffset + chHeight * 0.22;
    const ySclLow = ySclOffset + chHeight * 0.78;
    const sclRange = ySclLow - ySclHigh;

    // Gutter SCL
    ctx.fillStyle = "#0b0d14";
    ctx.fillRect(0, ySclOffset, gutterW, chHeight);
    ctx.strokeStyle = "#1a1e2a";
    ctx.strokeRect(0, ySclOffset, gutterW, chHeight);
    ctx.fillStyle = "#22d3ee";
    ctx.font = "bold 9px monospace";
    ctx.fillText("CH0: SCL", 6, ySclOffset + chHeight * 0.48);
    const curScl = sclHistory.length > 0 ? sclHistory[sclHistory.length - 1] : 1;
    ctx.fillStyle = curScl > 0.5 ? "#22d3ee" : "#475569";
    ctx.fillText(curScl > 0.5 ? "3.3V (H)" : "0.0V (L)", 6, ySclOffset + chHeight * 0.72);

    // SCL Baseline
    ctx.strokeStyle = "#141926";
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(gutterW, ySclLow);
    ctx.lineTo(width, ySclLow);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw SCL Trace with Smooth Slew Rate Curves
    if (sclHistory.length > 0) {
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 2;
      ctx.shadowColor = "rgba(34,211,238,0.4)";
      ctx.shadowBlur = 6;
      ctx.beginPath();

      const startIdx = Math.max(0, sclHistory.length - maxSamples);
      const displayCount = sclHistory.length - startIdx;
      const xOffset = gutterW + (maxSamples - displayCount) * xStep;

      for (let i = 0; i < displayCount; i++) {
        const x = xOffset + i * xStep;
        const normalizedVal = sclHistory[startIdx + i]; // 0.0 (low) to 1.0 (high)
        const y = ySclLow - normalizedVal * sclRange;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0; // reset shadow
    }

    // ───────────────── SDA Channel ─────────────────
    const ySdaOffset = chHeight;
    const ySdaHigh = ySdaOffset + chHeight * 0.22;
    const ySdaLow = ySdaOffset + chHeight * 0.78;
    const sdaRange = ySdaLow - ySdaHigh;

    // Gutter SDA
    ctx.fillStyle = "#0b0d14";
    ctx.fillRect(0, ySdaOffset, gutterW, chHeight);
    ctx.strokeStyle = "#1a1e2a";
    ctx.strokeRect(0, ySdaOffset, gutterW, chHeight);
    ctx.fillStyle = "#34d399";
    ctx.font = "bold 9px monospace";
    ctx.fillText("CH1: SDA", 6, ySdaOffset + chHeight * 0.48);
    const curSda = sdaHistory.length > 0 ? sdaHistory[sdaHistory.length - 1] : 1;
    ctx.fillStyle = curSda > 0.5 ? "#34d399" : "#475569";
    ctx.fillText(curSda > 0.5 ? "3.3V (H)" : "0.0V (L)", 6, ySdaOffset + chHeight * 0.72);

    // SDA Baseline
    ctx.strokeStyle = "#141926";
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(gutterW, ySdaLow);
    ctx.lineTo(width, ySdaLow);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw SDA Trace with Smooth Slew Rate Curves
    if (sdaHistory.length > 0) {
      ctx.strokeStyle = "#34d399";
      ctx.lineWidth = 2;
      ctx.shadowColor = "rgba(52,211,153,0.4)";
      ctx.shadowBlur = 6;
      ctx.beginPath();

      const startIdx = Math.max(0, sdaHistory.length - maxSamples);
      const displayCount = sdaHistory.length - startIdx;
      const xOffset = gutterW + (maxSamples - displayCount) * xStep;

      for (let i = 0; i < displayCount; i++) {
        const x = xOffset + i * xStep;
        const normalizedVal = sdaHistory[startIdx + i];
        const y = ySdaLow - normalizedVal * sdaRange;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // ───────────────── Event Annotation Track ─────────────────
    const yEventOffset = chHeight * 2;
    ctx.fillStyle = "#090b10";
    ctx.fillRect(0, yEventOffset, width, 36);
    ctx.strokeStyle = "#1c202d";
    ctx.beginPath();
    ctx.moveTo(0, yEventOffset);
    ctx.lineTo(width, yEventOffset);
    ctx.stroke();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 8px monospace";
    ctx.fillText("PROTOCOL DECODE", 6, yEventOffset + 22);

    // Render Pills
    const totalRecorded = sclHistory.length;
    pills.forEach((pill) => {
      const relIdx = totalRecorded - pill.samplePos;
      if (relIdx >= 0 && relIdx < maxSamples) {
        const x = width - relIdx * xStep;
        if (x > gutterW) {
          // Vertical guide line
          ctx.strokeStyle = `${pill.color}40`;
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, yEventOffset);
          ctx.stroke();
          ctx.setLineDash([]);

          // Pill box
          const pillWidth = Math.max(16, pill.label.length * 6 + 6);
          ctx.fillStyle = pill.color;
          ctx.fillRect(x - 2, yEventOffset + 6, pillWidth, 16);
          ctx.fillStyle = "#000000";
          ctx.font = "bold 8px monospace";
          ctx.fillText(pill.label, x + 2, yEventOffset + 17);
        }
      }
    });

    // ───────────────── Scanning Playhead / Status ─────────────────
    if (isStreaming) {
      // Glow cursor on the rightmost active edge
      const scanX = width - 1;
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(scanX, 0);
      ctx.lineTo(scanX, yEventOffset);
      ctx.stroke();

      // Current Phase Badge
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(width - 150, 6, 142, 20);
      ctx.strokeStyle = "#38bdf8";
      ctx.strokeRect(width - 150, 6, 142, 20);
      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 9px monospace";
      ctx.fillText(`● ${currentPhase}`, width - 142, 20);
    }

    ctx.restore();
  }, [data]);

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-[#07090e]">
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}
