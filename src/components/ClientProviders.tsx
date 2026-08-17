"use client";

import React from "react";
import { HardwareBusProvider } from "@/context/HardwareBusContext";

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return <HardwareBusProvider>{children}</HardwareBusProvider>;
}
