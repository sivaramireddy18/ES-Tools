"use client";

import React from "react";
import SystemHeader from "@/components/SystemHeader";
import EmbeddedPatterns from "@/components/programming/EmbeddedPatterns";

export default function ProgrammingPage() {
  return (
    <main className="w-screen h-screen overflow-hidden bg-[#060709] flex flex-col font-mono">
      <SystemHeader />
      <div className="flex-1 overflow-hidden">
        <EmbeddedPatterns />
      </div>
    </main>
  );
}
