"use client";

import React, { useEffect, useRef } from "react";

export interface SpiRealtimeData {
  sckHistory: number[];
  mosiHistory: number[];
  misoHistory: number[];
  csHistory: number[];
  mode: number;
  currentPhase: string;
  isStreaming: boolean;
}

interface Props {
  data: SpiRealtimeData;
}

export default function SpiAnalyzer({ data }: Props) {
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
    const channels = 4;
    const chHeight = height / channels;

    const channelMeta = [
      { name: "CH0: SCK", color: "#22d3ee", data: data.sckHistory },
      { name: "CH1: MOSI", color: "#34d399", data: data.mosiHistory },
      { name: "CH2: MISO", color: "#f43f5e", data: data.misoHistory },
      { name: "CH3: CS/SS", color: "#fbbf24", data: data.csHistory },
    ];

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

    channelMeta.forEach((ch, idx) => {
      const yOffset = idx * chHeight;
      const yHigh = yOffset + chHeight * 0.22;
      const yLow = yOffset + chHeight * 0.78;
      const range = yLow - yHigh;

      // Channel Gutter
      ctx.fillStyle = "#0b0d14";
      ctx.fillRect(0, yOffset, gutterW, chHeight);
      ctx.strokeStyle = "#1a1e2a";
      ctx.strokeRect(0, yOffset, gutterW, chHeight);
      ctx.fillStyle = ch.color;
      ctx.font = "bold 9px monospace";
      ctx.fillText(ch.name, 6, yOffset + chHeight * 0.44);

      const latestVal = ch.data.length > 0 ? ch.data[ch.data.length - 1] : 0;
      ctx.fillStyle = latestVal > 0.5 ? ch.color : "#475569";
      ctx.fillText(latestVal > 0.5 ? "3.3V (H)" : "0.0V (L)", 6, yOffset + chHeight * 0.74);

      // Baseline guideline
      ctx.strokeStyle = "#141926";
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(gutterW, yLow);
      ctx.lineTo(width, yLow);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Smooth Trace with Glow
      if (ch.data.length > 0) {
        ctx.strokeStyle = ch.color;
        ctx.lineWidth = 2;
        ctx.shadowColor = `${ch.color}40`;
        ctx.shadowBlur = 6;
        ctx.beginPath();

        const startIdx = Math.max(0, ch.data.length - maxSamples);
        const displayCount = ch.data.length - startIdx;
        const xOffset = gutterW + (maxSamples - displayCount) * xStep;

        for (let i = 0; i < displayCount; i++) {
          const x = xOffset + i * xStep;
          const normalized = ch.data[startIdx + i]; // 0.0 to 1.0
          const y = yLow - normalized * range;

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Channel divider
      ctx.strokeStyle = "#171a24";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, yOffset + chHeight);
      ctx.lineTo(width, yOffset + chHeight);
      ctx.stroke();
    });

    // Active Phase Indicator
    if (data.isStreaming) {
      const scanX = width - 1;
      ctx.strokeStyle = "#34d399";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(scanX, 0);
      ctx.lineTo(scanX, height);
      ctx.stroke();

      ctx.fillStyle = "#1e293b";
      ctx.fillRect(width - 160, 6, 152, 20);
      ctx.strokeStyle = "#34d399";
      ctx.strokeRect(width - 160, 6, 152, 20);
      ctx.fillStyle = "#34d399";
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
