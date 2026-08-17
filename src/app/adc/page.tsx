"use client";

import React from "react";
import SystemHeader from "@/components/SystemHeader";
import AdcSimulator from "@/components/adc/AdcSimulator";

export default function AdcPage() {
  return (
    <main className="w-screen h-screen overflow-hidden bg-[#060709] flex flex-col font-mono">
      <SystemHeader />
      <div className="flex-1 overflow-hidden">
        <AdcSimulator />
      </div>
    </main>
  );
}
