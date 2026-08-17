"use client";

import React from "react";
import SystemHeader from "@/components/SystemHeader";
import RealisticLabSetup from "@/components/lab/RealisticLabSetup";

export default function LabPage() {
  return (
    <main className="w-screen h-screen overflow-hidden bg-[#060709] flex flex-col font-mono">
      <SystemHeader />
      <div className="flex-1 overflow-hidden">
        <RealisticLabSetup />
      </div>
    </main>
  );
}
