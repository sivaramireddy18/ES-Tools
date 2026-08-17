"use client";

import React from "react";
import SystemHeader from "@/components/SystemHeader";
import I2cSimulator from "@/components/i2c/I2cSimulator";

export default function I2cPage() {
  return (
    <main className="w-screen h-screen overflow-hidden bg-[#060709] flex flex-col font-mono">
      <SystemHeader />
      <div className="flex-1 overflow-hidden">
        <I2cSimulator />
      </div>
    </main>
  );
}
