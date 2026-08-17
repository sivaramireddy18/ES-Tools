"use client";

import React, { useEffect, useRef } from "react";

export interface UartRealtimeData {
  txHistory: number[];
  rxHistory: number[];
  baudRate: number;
  currentPhase: string;
  isStreaming: boolean;
  hasFramingError: boolean;
}

interface Props {
  data: UartRealtimeData;
}

export default function UartAnalyzer({ data }: Props) {
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

    // Dark Background
    ctx.fillStyle = "#07090e";
    ctx.fillRect(0, 0, width, height);

    const gutterW = 68;
    const traceW = width - gutterW;
    const chHeight = height / 2;

    // Grid lines
    ctx.strokeStyle = "#111522";
    ctx.lineWidth = 1;
    for (let x = gutterW; x < width; x += 25) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    const maxSamples = 240;
    const xStep = traceW / maxSamples;

    // ───────────────── TX Channel ─────────────────
    const yTxOffset = 0;
    const yTxHigh = yTxOffset + chHeight * 0.22;
    const yTxLow = yTxOffset + chHeight * 0.78;
    const txRange = yTxLow - yTxHigh;

    ctx.fillStyle = "#0b0d14";
    ctx.fillRect(0, yTxOffset, gutterW, chHeight);
    ctx.strokeStyle = "#1a1e2a";
    ctx.strokeRect(0, yTxOffset, gutterW, chHeight);
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 9px monospace";
    ctx.fillText("CH0: TX", 6, yTxOffset + chHeight * 0.44);
    const curTx = data.txHistory.length > 0 ? data.txHistory[data.txHistory.length - 1] : 1;
    ctx.fillStyle = curTx > 0.5 ? "#38bdf8" : "#475569";
    ctx.fillText(curTx > 0.5 ? "MARK (1)" : "SPACE (0)", 6, yTxOffset + chHeight * 0.74);

    // TX Baseline
    ctx.strokeStyle = "#141926";
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(gutterW, yTxLow);
    ctx.lineTo(width, yTxLow);
    ctx.stroke();
    ctx.setLineDash([]);

    // TX Trace with Glow
    if (data.txHistory.length > 0) {
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      ctx.shadowColor = "rgba(56,189,248,0.4)";
      ctx.shadowBlur = 6;
      ctx.beginPath();

      const startIdx = Math.max(0, data.txHistory.length - maxSamples);
      const displayCount = data.txHistory.length - startIdx;
      const xOffset = gutterW + (maxSamples - displayCount) * xStep;

      for (let i = 0; i < displayCount; i++) {
        const x = xOffset + i * xStep;
        const normalized = data.txHistory[startIdx + i];
        const y = yTxLow - normalized * txRange;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // ───────────────── RX Channel ─────────────────
    const yRxOffset = chHeight;
    const yRxHigh = yRxOffset + chHeight * 0.22;
    const yRxLow = yRxOffset + chHeight * 0.78;
    const rxRange = yRxLow - yRxHigh;

    ctx.fillStyle = "#0b0d14";
    ctx.fillRect(0, yRxOffset, gutterW, chHeight);
    ctx.strokeStyle = "#1a1e2a";
    ctx.strokeRect(0, yRxOffset, gutterW, chHeight);
    ctx.fillStyle = data.hasFramingError ? "#f43f5e" : "#34d399";
    ctx.font = "bold 9px monospace";
    ctx.fillText("CH1: RX", 6, yRxOffset + chHeight * 0.44);
    const curRx = data.rxHistory.length > 0 ? data.rxHistory[data.rxHistory.length - 1] : 1;
    ctx.fillStyle = curRx > 0.5 ? (data.hasFramingError ? "#f43f5e" : "#34d399") : "#475569";
    ctx.fillText(curRx > 0.5 ? "MARK (1)" : "SPACE (0)", 6, yRxOffset + chHeight * 0.74);

    // RX Baseline
    ctx.strokeStyle = "#141926";
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(gutterW, yRxLow);
    ctx.lineTo(width, yRxLow);
    ctx.stroke();
    ctx.setLineDash([]);

    // RX Trace
    if (data.rxHistory.length > 0) {
      ctx.strokeStyle = data.hasFramingError ? "#f43f5e" : "#34d399";
      ctx.lineWidth = 2;
      ctx.shadowColor = data.hasFramingError ? "rgba(244,63,94,0.4)" : "rgba(52,211,153,0.4)";
      ctx.shadowBlur = 6;
      ctx.beginPath();

      const startIdx = Math.max(0, data.rxHistory.length - maxSamples);
      const displayCount = data.rxHistory.length - startIdx;
      const xOffset = gutterW + (maxSamples - displayCount) * xStep;

      for (let i = 0; i < displayCount; i++) {
        const x = xOffset + i * xStep;
        const normalized = data.rxHistory[startIdx + i];
        const y = yRxLow - normalized * rxRange;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Divider
    ctx.strokeStyle = "#171a24";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, chHeight);
    ctx.lineTo(width, chHeight);
    ctx.stroke();

    // Active Phase Indicator
    if (data.isStreaming) {
      const scanX = width - 1;
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(scanX, 0);
      ctx.lineTo(scanX, height);
      ctx.stroke();

      ctx.fillStyle = "#1e293b";
      ctx.fillRect(width - 160, 6, 152, 20);
      ctx.strokeStyle = data.hasFramingError ? "#f43f5e" : "#38bdf8";
      ctx.strokeRect(width - 160, 6, 152, 20);
      ctx.fillStyle = data.hasFramingError ? "#f43f5e" : "#38bdf8";
      ctx.font = "bold 9px monospace";
      ctx.fillText(`● ${data.currentPhase}`, width - 152, 20);
    }

    ctx.restore();
  }, [data]);

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-[#07090e]">
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}
