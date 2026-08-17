"use client";

import React from "react";
import SystemHeader from "@/components/SystemHeader";
import TimerSimulator from "@/components/timers/TimerSimulator";

export default function TimersPage() {
  return (
    <main className="w-screen h-screen overflow-hidden bg-[#060709] flex flex-col font-mono">
      <SystemHeader />
      <div className="flex-1 overflow-hidden">
        <TimerSimulator />
      </div>
    </main>
  );
}
