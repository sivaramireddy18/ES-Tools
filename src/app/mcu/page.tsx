"use client";

import React from "react";
import SystemHeader from "@/components/SystemHeader";
import McuArchitectureViewer from "@/components/mcu/McuArchitectureViewer";

export default function McuPage() {
  return (
    <main className="w-screen h-screen overflow-hidden bg-[#060709] flex flex-col font-mono">
      <SystemHeader />
      <div className="flex-1 overflow-hidden">
        <McuArchitectureViewer />
      </div>
    </main>
  );
}
