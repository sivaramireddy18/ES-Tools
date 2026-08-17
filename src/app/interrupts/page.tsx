"use client";

import React from "react";
import SystemHeader from "@/components/SystemHeader";
import NvicSimulator from "@/components/interrupts/NvicSimulator";

export default function InterruptsPage() {
  return (
    <main className="w-screen h-screen overflow-hidden bg-[#060709] flex flex-col font-mono">
      <SystemHeader />
      <div className="flex-1 overflow-hidden">
        <NvicSimulator />
      </div>
    </main>
  );
}
