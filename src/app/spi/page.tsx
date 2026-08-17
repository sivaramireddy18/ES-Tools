"use client";

import React from "react";
import SystemHeader from "@/components/SystemHeader";
import SpiSimulator from "@/components/spi/SpiSimulator";

export default function SpiPage() {
  return (
    <main className="w-screen h-screen overflow-hidden bg-[#060709] flex flex-col font-mono">
      <SystemHeader />
      <div className="flex-1 overflow-hidden">
        <SpiSimulator />
      </div>
    </main>
  );
}
