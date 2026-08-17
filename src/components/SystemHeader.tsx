import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHardwareBus } from "@/context/HardwareBusContext";
import BeginnerGuideModal, { ProtocolGuideType } from "@/components/common/BeginnerGuideModal";

export default function SystemHeader() {
  const pathname = usePathname();
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  let targetStatus = "POWERED_OFF";
  try {
    const bus = useHardwareBus();
    targetStatus = bus.targetStatus;
  } catch {
    // If used outside HardwareBusProvider, default to nominal
  }

  // Click outside listener for the dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const mainLinks = [
    { href: "/", label: "BENCH (DUT)", tag: "JTAG/WASM" },
    { href: "/lab", label: "LAB SETUP", tag: "HARDWARE" },
    { href: "/learn", label: "📚 LEARN PATH", tag: "CURRICULUM" },
  ];

  const dropdownLinks = [
    { href: "/mcu", label: "MCU Silicon", tag: "Cortex-M4", icon: "🏛️" },
    { href: "/i2c", label: "I2C Bus", tag: "2-Wire", icon: "💬" },
    { href: "/spi", label: "SPI Bus", tag: "4-Wire", icon: "🔄" },
    { href: "/uart", label: "UART Serial", tag: "TTL/RS232", icon: "📨" },
    { href: "/timers", label: "Timers & PWM", tag: "TIM2/TIM3", icon: "⏱️" },
    { href: "/adc", label: "ADC & DAC", tag: "Analog", icon: "🎚️" },
    { href: "/interrupts", label: "Interrupts", tag: "NVIC/EXTI", icon: "🔔" },
    { href: "/programming", label: "C Patterns", tag: "Embedded C", icon: "⚙️" },
  ];

  const getGuideTopic = (): ProtocolGuideType => {
    if (pathname === "/i2c") return "i2c";
    if (pathname === "/spi") return "spi";
    if (pathname === "/uart") return "uart";
    return "bench";
  };

  const isDropdownActive = dropdownLinks.some(link => pathname === link.href);

  return (
    <>
      <header className="h-11 px-4 bg-[#0d0e14] border-b border-zinc-800/80 flex items-center justify-between shrink-0 z-30 select-none">
        {/* Left: Brand + Suite Links */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5 group cursor-pointer">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
            </span>
            <span className="text-[12px] font-bold tracking-[0.08em] text-cyan-300 uppercase group-hover:text-cyan-200 transition-colors">
              VALIDATION SUITE
            </span>
          </Link>

          <span className="text-zinc-700 text-xs select-none hidden md:inline">│</span>

          {/* Protocol Nav Tabs */}
          <nav className="flex items-center gap-1">
            {mainLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold flex items-center gap-1.5 transition-all duration-150 ${
                    isActive
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_8px_rgba(34,211,238,0.2)]"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-transparent"
                  }`}
                >
                  <span>{link.label}</span>
                  <span className={`text-[8px] px-1 py-0.2 rounded font-normal ${
                    isActive ? "bg-cyan-900/60 text-cyan-200" : "bg-zinc-800 text-zinc-500"
                  }`}>
                    {link.tag}
                  </span>
                </Link>
              );
            })}

            {/* Dropdown Tab */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold flex items-center gap-1 transition-all duration-150 cursor-pointer ${
                  isDropdownActive || isDropdownOpen
                    ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/30"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-transparent"
                }`}
              >
                <span>🔌 SIMULATORS</span>
                <span className={`text-[8px] transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`}>
                  ▼
                </span>
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute left-0 mt-2.5 w-56 rounded-lg bg-[#0e111a]/95 border border-zinc-800 shadow-[0_10px_35px_rgba(0,0,0,0.6)] backdrop-blur-md overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="p-1.5 flex flex-col gap-0.5">
                    {dropdownLinks.map((link) => {
                      const isActive = pathname === link.href;
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setIsDropdownOpen(false)}
                          className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold flex items-center justify-between transition-colors ${
                            isActive
                              ? "bg-cyan-500/20 text-cyan-200"
                              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span>{link.icon}</span>
                            <span>{link.label}</span>
                          </span>
                          <span className="text-[8px] font-normal text-zinc-500 bg-zinc-900 px-1 py-0.2 rounded">
                            {link.tag}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </nav>
        </div>

        {/* Right: Beginner Guide Button + Status */}
        <div className="flex items-center gap-2.5 text-[10px] font-mono">
          {/* Beginner Guide Trigger */}
          <button
            onClick={() => setIsGuideOpen(true)}
            className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded font-bold flex items-center gap-1.5 cursor-pointer shadow-[0_0_8px_rgba(251,191,36,0.2)] transition-colors"
          >
            <span>🎓</span>
            <span>BEGINNER GUIDE</span>
          </button>

          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-zinc-900/80 rounded border border-zinc-800/80 hidden sm:flex">
            <span className="text-zinc-500 uppercase">SYS:</span>
            <span className="text-emerald-400 font-semibold">ONLINE</span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#090b10] rounded border border-zinc-800/80">
            <span className={`w-1.5 h-1.5 rounded-full ${
              targetStatus === "RUNNING" ? "bg-emerald-400 shadow-[0_0_4px_#34d399]" :
              targetStatus === "FLASHING" ? "bg-amber-400 animate-pulse" :
              targetStatus === "HALTED" ? "bg-rose-400" : "bg-cyan-400"
            }`} />
            <span className="text-zinc-300 font-semibold uppercase">
              {pathname === "/" ? targetStatus : "ACTIVE SIM"}
            </span>
          </div>
        </div>
      </header>

      {/* Beginner Guide Modal */}
      <BeginnerGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        initialTopic={getGuideTopic()}
      />
    </>
  );
}
