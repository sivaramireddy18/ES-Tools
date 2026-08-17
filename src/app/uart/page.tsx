"use client";

import React from "react";
import SystemHeader from "@/components/SystemHeader";
import UartSimulator from "@/components/uart/UartSimulator";

export default function UartPage() {
  return (
    <main className="w-screen h-screen overflow-hidden bg-[#060709] flex flex-col font-mono">
      <SystemHeader />
      <div className="flex-1 overflow-hidden">
        <UartSimulator />
      </div>
    </main>
  );
}
