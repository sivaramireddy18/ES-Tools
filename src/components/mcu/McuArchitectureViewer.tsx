"use client";

import React, { useState, useEffect } from "react";
import CpuPipelineViewer from "./CpuPipelineViewer";
import ClockTreeViewer from "./ClockTreeViewer";
import DmaDeepDiveViewer from "./DmaDeepDiveViewer";

export type McuSubTab =
  | "bus_matrix_routing"
  | "routing_flow"
  | "gpio_schematic"
  | "block_diagram"
  | "memory_map"
  | "cpu_pipeline"
  | "clock_tree"
  | "dma_deep_dive";

interface RoutingScenario {
  id: string;
  name: string;
  category: "GPIO" | "UART" | "SPI" | "I2C" | "INTERRUPT" | "DMA";
  cCode: string;
  asmCode: string;
  steps: {
    title: string;
    description: string;
    activeBlocks: string[];
    registerEffect: string;
  }[];
}

const SCENARIOS: RoutingScenario[] = [
  {
    id: "gpio_write",
    name: "1. CPU Writes to GPIO Output Pin (LED Turn ON)",
    category: "GPIO",
    cCode: "GPIOA->BSRR = GPIO_PIN_0; // Set Pin PA0 High",
    asmCode: "LDR R0, =0x40020018\nMOV R1, #1\nSTR R1, [R0] // Write 1 to BSRR",
    steps: [
      {
        title: "Step 1: Instruction Fetch from Flash",
        description: "CPU Core issues an instruction fetch on the 32-bit I-Code Bus. Flash Memory (0x08000000) delivers the STR instruction @ 168MHz.",
        activeBlocks: ["flash", "cpu", "ibus"],
        registerEffect: "PC = 0x080001A4 | Instruction = STR R1, [R0]",
      },
      {
        title: "Step 2: AHB1 Bus Transaction",
        description: "CPU executes STR. The 32-bit Data Bus routes address 0x40020018 through the Multi-AHB Bus Matrix to GPIOA.",
        activeBlocks: ["cpu", "bus_matrix", "ahb1", "gpioa"],
        registerEffect: "AHB1 Clock = 168MHz | Target = GPIOA_BSRR (0x40020018)",
      },
      {
        title: "Step 3: Atomic Bit Set Register (BSRR)",
        description: "Writing bit 0 of BSRR atomically sets bit 0 of the Output Data Register (GPIOA_ODR) without read-modify-write.",
        activeBlocks: ["gpioa"],
        registerEffect: "GPIOA_BSRR = 0x00000001 → GPIOA_ODR[0] = 1",
      },
      {
        title: "Step 4: Silicon Output Driver Conduction",
        description: "ODR bit 1 turns ON high-side P-MOS FET transistor in Pin PA0 output buffer, connecting metal pin to +3.3V VDD.",
        activeBlocks: ["gpioa", "pin_pa0"],
        registerEffect: "P-MOS FET = ON | N-MOS FET = OFF | Voltage V_PA0 = +3.3V",
      },
    ],
  },
  {
    id: "uart_tx",
    name: "2. UART Peripheral Transmits Serial Data",
    category: "UART",
    cCode: "USART1->DR = 'A'; // Transmit ASCII 'A' (0x41)",
    asmCode: "LDR R0, =0x40011004\nMOV R1, #0x41\nSTR R1, [R0] // Write to USART1_DR",
    steps: [
      {
        title: "Step 1: CPU Writes to USART1 Data Register",
        description: "CPU stores 0x41 into USART1_DR (0x40011004) via the APB2 High-Speed Peripheral Bus (84MHz).",
        activeBlocks: ["cpu", "bus_matrix", "apb2", "usart1"],
        registerEffect: "USART1_DR = 0x00000041 | Transmit Data Register Full (TXE=0)",
      },
      {
        title: "Step 2: Transfer to Hardware Shift Register",
        description: "USART1 hardware logic transfers the byte 0x41 from buffer into the 8-bit Transmit Shift Register and asserts TXE flag.",
        activeBlocks: ["usart1"],
        registerEffect: "USART1_SR[TXE] = 1 (Ready for next byte) | Shift Register = 01000001b",
      },
      {
        title: "Step 3: Alternate Function (AF7) Pin Routing",
        description: "Pin PA9 is configured in AF7 (USART1_TX). AF multiplexer connects Shift Register output directly to Push-Pull pad.",
        activeBlocks: ["usart1", "af_mux", "pin_pa9"],
        registerEffect: "GPIOA_AFRH[AF7] active | Pin PA9 = USART1_TX",
      },
      {
        title: "Step 4: Serial Bitstream Clocking Out",
        description: "Baud rate prescaler (BRR) clocks out START (0V) → 8 data bits (LSB first) → STOP (3.3V) onto pin PA9 @ 115,200 baud.",
        activeBlocks: ["pin_pa9"],
        registerEffect: "Pin PA9 toggles serial waveform: 0 → 1 0 0 0 0 0 1 0 → 1",
      },
    ],
  },
  {
    id: "spi_transfer",
    name: "3. SPI Controller High-Speed 42MHz Transfer",
    category: "SPI",
    cCode: "SPI1->DR = 0x9F; // Send JEDEC Read Command",
    asmCode: "LDR R0, =0x4001300C\nMOV R1, #0x9F\nSTR R1, [R0] // Write SPI1_DR",
    steps: [
      {
        title: "Step 1: Write to SPI1 Data Register",
        description: "CPU writes command byte 0x9F to SPI1_DR over the APB2 Bus (84MHz).",
        activeBlocks: ["cpu", "bus_matrix", "apb2", "spi1"],
        registerEffect: "SPI1_DR = 0x9F | SPI1_SR[TXE] = 0",
      },
      {
        title: "Step 2: Hardware Shift Register Clocking",
        description: "SPI1 hardware clock generator pulses the SCK line at 42MHz (APB2 / 2).",
        activeBlocks: ["spi1"],
        registerEffect: "SCK = 42MHz Pulse Train | Mode 0 (CPOL=0, CPHA=0)",
      },
      {
        title: "Step 3: AF5 Multiplexing to Physical Pins",
        description: "16-to-1 AF multiplexer routes SPI1 signals: PA5 (SCK), PA7 (MOSI), and PA6 (MISO).",
        activeBlocks: ["spi1", "af_mux", "pin_pa5", "pin_pa7", "pin_pa6"],
        registerEffect: "PA5 = SCK Output | PA7 = MOSI Output | PA6 = MISO Input",
      },
      {
        title: "Step 4: Full-Duplex Bit Swapping",
        description: "On each clock pulse, 1 bit shifts out on MOSI (PA7) while 1 bit shifts in from flash memory on MISO (PA6).",
        activeBlocks: ["pin_pa7", "pin_pa6"],
        registerEffect: "MOSI transmits 0x9F | MISO receives Manufacturer ID 0xEF",
      },
    ],
  },
  {
    id: "i2c_opendrain",
    name: "4. I2C Bus Open-Drain Signal Transmission",
    category: "I2C",
    cCode: "I2C1->DR = 0x50; // Send Slave Address 0x50",
    asmCode: "LDR R0, =0x40005410\nMOV R1, #0x50\nSTR R1, [R0]",
    steps: [
      {
        title: "Step 1: APB1 Bus Write to I2C1",
        description: "CPU accesses I2C1 peripheral at 0x40005400 via the APB1 Peripheral Bus (42MHz).",
        activeBlocks: ["cpu", "bus_matrix", "apb1", "i2c1"],
        registerEffect: "I2C1_DR = 0x50 (7-bit address 0101000b + W)",
      },
      {
        title: "Step 2: Open-Drain Driver Configuration",
        description: "GPIO pins PB6 (SCL) and PB7 (SDA) set to Open-Drain (OTYPER=1). High-side P-MOS transistors disconnected!",
        activeBlocks: ["i2c1", "af_mux", "pin_pb6", "pin_pb7"],
        registerEffect: "GPIOB_OTYPER[6,7] = 1 (Open-Drain) | AF4 (I2C1)",
      },
      {
        title: "Step 3: START Condition Generation",
        description: "I2C1 turns ON N-MOS transistor on PB7 to pull SDA LOW while PB6 (SCL) is pulled HIGH by external 4.7kΩ resistor.",
        activeBlocks: ["pin_pb7"],
        registerEffect: "PB7 (SDA) pulled to 0.0V GND by N-MOS | PB6 (SCL) = 3.3V",
      },
      {
        title: "Step 4: Wire-AND Bus Arbitration & ACK",
        description: "Because pins are Open-Drain, slave can pull SDA LOW during 9th clock tick to send ACK without short circuit.",
        activeBlocks: ["pin_pb7", "pin_pb6"],
        registerEffect: "Slave pulls SDA to 0V → I2C1_SR1[ADDR] set → ACK Received!",
      },
    ],
  },
  {
    id: "button_interrupt",
    name: "5. External Button Push Triggers Hardware Interrupt (EXTI)",
    category: "INTERRUPT",
    cCode: "void EXTI15_10_IRQHandler() {\n  EXTI->PR = EXTI_PR_PR13; // Clear flag\n}",
    asmCode: "EXTI15_10_IRQHandler:\nLDR R0, =0x40013C14\nMOV R1, #0x2000\nSTR R1, [R0]\nBX LR",
    steps: [
      {
        title: "Step 1: Mechanical Switch Presses Pin PC13",
        description: "User presses onboard blue button. Voltage on pin PC13 drops from +3.3V (held by pull-up) to 0.0V GND.",
        activeBlocks: ["pin_pc13"],
        registerEffect: "Physical Pin PC13 voltage drops: 3.3V → 0.0V (Falling Edge)",
      },
      {
        title: "Step 2: Schmitt Trigger & EXTI Edge Detector",
        description: "Schmitt trigger cleans voltage drop. EXTI hardware edge detector flags falling edge on Line 13.",
        activeBlocks: ["pin_pc13", "exti"],
        registerEffect: "EXTI_PR[13] = 1 (Pending Interrupt Flag Set)",
      },
      {
        title: "Step 3: NVIC Hardware Priority Arbitration",
        description: "NVIC receives hardware interrupt request, saves CPU registers to stack in 12 clock cycles, and vectors CPU to ISR.",
        activeBlocks: ["exti", "nvic", "cpu"],
        registerEffect: "NVIC_ICPR = EXTI15_10 Channel | CPU enters Handler Mode",
      },
      {
        title: "Step 4: CPU Executes Interrupt Service Routine (ISR)",
        description: "CPU halts main loop and immediately executes button handler code to toggle LED or register state.",
        activeBlocks: ["cpu", "flash"],
        registerEffect: "PC jumps to 0x080002F0 (EXTI15_10_IRQHandler)",
      },
    ],
  },
  {
    id: "dma_stream",
    name: "6. DMA (Direct Memory Access) Moves Data with 0% CPU",
    category: "DMA",
    cCode: "DMA2_Stream0->CR |= DMA_SxCR_EN; // Start Stream",
    asmCode: "LDR R0, =0x40026410\nLDR R1, [R0]\nORR R1, R1, #1\nSTR R1, [R0]",
    steps: [
      {
        title: "Step 1: Peripheral Signals DMA Request",
        description: "ADC1 finishes 12-bit conversion and fires hardware DMA request line directly to DMA2 Stream 0.",
        activeBlocks: ["adc1", "dma2"],
        registerEffect: "ADC1_DR = 0x0A3F (2.11V) → DMA Request Asserted",
      },
      {
        title: "Step 2: DMA Controller Arbitrates AHB Bus",
        description: "DMA2 takes master control of AHB1 Bus Matrix without interrupting CPU Core.",
        activeBlocks: ["dma2", "bus_matrix", "ahb1"],
        registerEffect: "DMA2 Master of AHB1 | CPU continues math in parallel",
      },
      {
        title: "Step 3: Direct Transfer to SRAM Buffer",
        description: "DMA copies 16-bit ADC reading directly from 0x4001204C into 0x20000400 in SRAM1 in 2 clock cycles.",
        activeBlocks: ["dma2", "sram"],
        registerEffect: "SRAM1[0x20000400] = 0x0A3F | Zero CPU Cycles Consumed!",
      },
    ],
  },
];

export default function McuArchitectureViewer() {
  const [activeTab, setActiveTab] = useState<McuSubTab>("bus_matrix_routing");
  const [selectedScenario, setSelectedScenario] = useState<RoutingScenario>(SCENARIOS[0]);
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);

  // Bus Matrix Crossbar State
  const [masterIbusActive, setMasterIbusActive] = useState<boolean>(true);
  const [masterDbusActive, setMasterDbusActive] = useState<boolean>(true);
  const [masterSbusActive, setMasterSbusActive] = useState<boolean>(true);
  const [masterDma1Active, setMasterDma1Active] = useState<boolean>(true);
  const [masterDma2Active, setMasterDma2Active] = useState<boolean>(true);

  // Interactive GPIO State
  const [gpioMode, setGpioMode] = useState<"OUTPUT_PUSHPULL" | "OUTPUT_OPENDRAIN" | "INPUT_FLOATING" | "INPUT_PULLUP" | "ANALOG">("OUTPUT_PUSHPULL");
  const [odrBit, setOdrBit] = useState<number>(1);
  const [pinVoltage, setPinVoltage] = useState<number>(3.3);
  const [selectedAf, setSelectedAf] = useState<string>("GPIO");

  const isOutput = gpioMode.startsWith("OUTPUT");
  const isOpenDrain = gpioMode === "OUTPUT_OPENDRAIN";
  const isPullUp = gpioMode === "INPUT_PULLUP";
  const isAnalog = gpioMode === "ANALOG";

  const pmosOn = isOutput && !isOpenDrain && odrBit === 1;
  const nmosOn = isOutput && odrBit === 0;
  const schmittTriggerActive = !isAnalog;
  const idrBit = pinVoltage >= 2.0 ? 1 : 0;

  // Auto-step timer for scenario
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setCurrentStepIdx((prev) => (prev + 1) % selectedScenario.steps.length);
    }, 2800);
    return () => clearInterval(timer);
  }, [isPlaying, selectedScenario]);

  const curStep = selectedScenario.steps[currentStepIdx] || selectedScenario.steps[0];
  const isBlockActive = (blockId: string) => curStep.activeBlocks.includes(blockId);

  return (
    <div className="flex flex-col h-full bg-[#080a0e] text-zinc-200 font-mono text-xs select-none overflow-hidden">
      {/* ── Sub Navigation Tabs ── */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 bg-[#0d1017] px-3 pt-2 shrink-0 overflow-x-auto">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab("bus_matrix_routing")}
            className={`px-3 py-1.5 text-[10px] font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "bus_matrix_routing"
                ? "border-cyan-400 text-cyan-300 bg-[#121622]"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            ⚡ ARM CORTEX-M4 INTERNAL BUS ROUTING
          </button>
          <button
            onClick={() => setActiveTab("routing_flow")}
            className={`px-3 py-1.5 text-[10px] font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "routing_flow"
                ? "border-emerald-400 text-emerald-300 bg-[#121622]"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            🔄 SILICON SIGNAL ROUTING SIMULATOR
          </button>
          <button
            onClick={() => setActiveTab("gpio_schematic")}
            className={`px-3 py-1.5 text-[10px] font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "gpio_schematic"
                ? "border-amber-400 text-amber-300 bg-[#121622]"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            🔬 GPIO PIN SILICON SCHEMATIC (CIRCUIT LEVEL)
          </button>
          <button
            onClick={() => setActiveTab("block_diagram")}
            className={`px-3 py-1.5 text-[10px] font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "block_diagram"
                ? "border-purple-400 text-purple-300 bg-[#121622]"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            🏛️ COMPLETE MCU SILICON DIE
          </button>
          <button
            onClick={() => setActiveTab("memory_map")}
            className={`px-3 py-1.5 text-[10px] font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "memory_map"
                ? "border-sky-400 text-sky-300 bg-[#121622]"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            🗺️ 32-BIT MEMORY BUS & REGISTER MAP
          </button>
          <button
            onClick={() => setActiveTab("cpu_pipeline")}
            className={`px-3 py-1.5 text-[10px] font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "cpu_pipeline"
                ? "border-rose-400 text-rose-300 bg-[#121622]"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            🔬 CPU PIPELINE
          </button>
          <button
            onClick={() => setActiveTab("clock_tree")}
            className={`px-3 py-1.5 text-[10px] font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "clock_tree"
                ? "border-orange-400 text-orange-300 bg-[#121622]"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            🕐 CLOCK TREE
          </button>
          <button
            onClick={() => setActiveTab("dma_deep_dive")}
            className={`px-3 py-1.5 text-[10px] font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "dma_deep_dive"
                ? "border-fuchsia-400 text-fuchsia-300 bg-[#121622]"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            🚀 DMA DEEP-DIVE
          </button>
        </div>

        <span className="text-[9px] text-zinc-500 font-mono hidden xl:inline px-2">
          MULTI-LAYER AHB & APB CROSSBAR MATRIX
        </span>
      </div>

      {/* ── Tab 1: ARM Cortex-M4 Internal Bus Matrix Routing ── */}
      {activeTab === "bus_matrix_routing" && (
        <div className="flex-1 p-3 overflow-y-auto space-y-3 font-mono text-xs">
          <div className="p-3 bg-cyan-950/20 border border-cyan-800/40 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <span className="font-bold text-cyan-300 text-[11px] uppercase block">
                ⚡ ARM Cortex-M4 Multi-Layer AHB/APB Crossbar Bus Interconnect
              </span>
              <p className="text-zinc-300 text-[11px] font-sans">
                The ARM Cortex-M4 uses a <strong>Multi-Layer AHB Crossbar Bus Matrix</strong> allowing masters (CPU I-Bus, D-Bus, S-Bus, DMA1, DMA2) to talk to slaves (Flash, SRAM1, SRAM2, Peripherals) <strong>in parallel at the exact same clock cycle @ 168 MHz with zero contention!</strong>
              </p>
            </div>
            <span className="px-2 py-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded text-[10px] shrink-0 font-bold">
              168 MHz BUS MATRIX
            </span>
          </div>

          {/* Master Controller Toggles */}
          <div className="bg-[#0d1017] p-3 rounded-lg border border-zinc-800 space-y-2">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
              Toggle Active Bus Masters to Test Parallel Crossbar Pathways:
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[10px]">
              {[
                { label: "CPU I-Code (Flash Fetch)", active: masterIbusActive, set: setMasterIbusActive, desc: "Fetches code instructions" },
                { label: "CPU D-Code (Literals)", active: masterDbusActive, set: setMasterDbusActive, desc: "Reads literal tables & vectors" },
                { label: "CPU S-Bus (RAM/Peripherals)", active: masterSbusActive, set: setMasterSbusActive, desc: "Reads/writes variables & regs" },
                { label: "DMA1 Master (UART/I2C/SPI)", active: masterDma1Active, set: setMasterDma1Active, desc: "Streams serial data to RAM" },
                { label: "DMA2 Master (ADC/High-Speed)", active: masterDma2Active, set: setMasterDma2Active, desc: "Transfers 2.4MSPS ADC data" },
              ].map((m, idx) => (
                <button
                  key={idx}
                  onClick={() => m.set(!m.active)}
                  className={`p-2 rounded text-left border transition-all cursor-pointer ${
                    m.active
                      ? "bg-cyan-500/20 text-cyan-200 border-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.2)]"
                      : "bg-[#090b10] text-zinc-600 border-zinc-800"
                  }`}
                >
                  <span className="font-bold block">{m.active ? "● " : "○ "}{m.label}</span>
                  <span className="text-[9px] text-zinc-400 font-sans block mt-0.5">{m.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Crossbar Interconnect Diagram */}
          <div className="p-3 bg-[#05070a] border border-zinc-800 rounded-lg space-y-3">
            <div className="flex justify-between items-center border-b border-zinc-800/80 pb-2">
              <span className="text-xs font-bold text-zinc-200 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                INTERACTIVE 8x8 MULTI-LAYER CROSSBAR MATRIX ROUTING
              </span>
              <span className="text-[10px] text-emerald-400 font-bold">
                Concurrent Throughput: {((masterIbusActive ? 1 : 0) + (masterDbusActive ? 1 : 0) + (masterSbusActive ? 1 : 0) + (masterDma1Active ? 1 : 0) + (masterDma2Active ? 1 : 0)) * 672} MB/s
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* Active Masters Column */}
              <div className="space-y-2">
                <span className="text-cyan-400 font-bold text-[10px] uppercase block border-b border-zinc-800 pb-1">
                  1. BUS MASTERS (Initiate 32-bit Transfers)
                </span>

                <div className={`p-2.5 rounded border transition-all ${masterIbusActive ? "bg-cyan-950/30 border-cyan-500 text-cyan-200" : "bg-zinc-900/30 border-zinc-800 text-zinc-600"}`}>
                  <div className="flex justify-between font-bold">
                    <span>M1: Cortex-M4 I-Code Bus</span>
                    <span>{masterIbusActive ? "ACTIVE (168MHz)" : "IDLE"}</span>
                  </div>
                  <span className="text-[9px] text-zinc-400 font-sans block mt-0.5">
                    Routes directly to Flash I-Code Interface (ART Accelerator Cache)
                  </span>
                </div>

                <div className={`p-2.5 rounded border transition-all ${masterDbusActive ? "bg-sky-950/30 border-sky-500 text-sky-200" : "bg-zinc-900/30 border-zinc-800 text-zinc-600"}`}>
                  <div className="flex justify-between font-bold">
                    <span>M2: Cortex-M4 D-Code Bus</span>
                    <span>{masterDbusActive ? "ACTIVE (168MHz)" : "IDLE"}</span>
                  </div>
                  <span className="text-[9px] text-zinc-400 font-sans block mt-0.5">
                    Reads constants, literal pools, and vector jump addresses in Flash ROM
                  </span>
                </div>

                <div className={`p-2.5 rounded border transition-all ${masterSbusActive ? "bg-emerald-950/30 border-emerald-500 text-emerald-200" : "bg-zinc-900/30 border-zinc-800 text-zinc-600"}`}>
                  <div className="flex justify-between font-bold">
                    <span>M3: Cortex-M4 System (S-Bus)</span>
                    <span>{masterSbusActive ? "ACTIVE (168MHz)" : "IDLE"}</span>
                  </div>
                  <span className="text-[9px] text-zinc-400 font-sans block mt-0.5">
                    Accesses SRAM1 (112KB), SRAM2 (16KB), and Peripherals via AHB/APB bridges
                  </span>
                </div>

                <div className={`p-2.5 rounded border transition-all ${masterDma1Active ? "bg-purple-950/30 border-purple-500 text-purple-200" : "bg-zinc-900/30 border-zinc-800 text-zinc-600"}`}>
                  <div className="flex justify-between font-bold">
                    <span>M4: DMA1 Controller (8 Streams)</span>
                    <span>{masterDma1Active ? "ACTIVE (168MHz)" : "IDLE"}</span>
                  </div>
                  <span className="text-[9px] text-zinc-400 font-sans block mt-0.5">
                    Transfers APB1 peripherals (USART2/3, I2C1/2, SPI2/3) directly to SRAM
                  </span>
                </div>

                <div className={`p-2.5 rounded border transition-all ${masterDma2Active ? "bg-amber-950/30 border-amber-500 text-amber-200" : "bg-zinc-900/30 border-zinc-800 text-zinc-600"}`}>
                  <div className="flex justify-between font-bold">
                    <span>M5: DMA2 Controller (8 Streams)</span>
                    <span>{masterDma2Active ? "ACTIVE (168MHz)" : "IDLE"}</span>
                  </div>
                  <span className="text-[9px] text-zinc-400 font-sans block mt-0.5">
                    Transfers APB2 peripherals (USART1, SPI1, ADC1, TIM1) with 0% CPU load
                  </span>
                </div>
              </div>

              {/* Target Slaves Column */}
              <div className="space-y-2">
                <span className="text-emerald-400 font-bold text-[10px] uppercase block border-b border-zinc-800 pb-1">
                  2. BUS SLAVES (Targets Connected via Matrix)
                </span>

                <div className="p-2.5 bg-[#0d1017] rounded border border-zinc-800 space-y-1">
                  <div className="flex justify-between text-cyan-300 font-bold">
                    <span>S1: Flash Memory I-Code Bus</span>
                    <span>0x08000000 (1MB)</span>
                  </div>
                  <span className="text-[9px] text-zinc-400 font-sans block">
                    Connected to M1 (I-Code). Features 128-bit ART Accelerator™ for 0-wait state execution.
                  </span>
                </div>

                <div className="p-2.5 bg-[#0d1017] rounded border border-zinc-800 space-y-1">
                  <div className="flex justify-between text-sky-300 font-bold">
                    <span>S2: Flash Memory D-Code Bus</span>
                    <span>0x08000000</span>
                  </div>
                  <span className="text-[9px] text-zinc-400 font-sans block">
                    Connected to M2 (D-Code). Reads literal data and tables without blocking instruction fetch!
                  </span>
                </div>

                <div className="p-2.5 bg-[#0d1017] rounded border border-zinc-800 space-y-1">
                  <div className="flex justify-between text-emerald-300 font-bold">
                    <span>S3: Main SRAM1 (112 KB)</span>
                    <span>0x20000000</span>
                  </div>
                  <span className="text-[9px] text-zinc-400 font-sans block">
                    Connected to M3 (S-Bus), M4 (DMA1), and M5 (DMA2). Round-robin arbiter prevents lockup.
                  </span>
                </div>

                <div className="p-2.5 bg-[#0d1017] rounded border border-zinc-800 space-y-1">
                  <div className="flex justify-between text-amber-300 font-bold">
                    <span>S4: AHB1 Peripheral Bridge (168MHz)</span>
                    <span>0x40020000</span>
                  </div>
                  <span className="text-[9px] text-zinc-400 font-sans block">
                    Routes GPIOA-GPIOI ports, CRC, RCC, and DMA controller registers.
                  </span>
                </div>

                <div className="p-2.5 bg-[#0d1017] rounded border border-zinc-800 space-y-1">
                  <div className="flex justify-between text-purple-300 font-bold">
                    <span>S5: APB1 / APB2 Peripheral Bridges</span>
                    <span>0x40000000 / 0x40010000</span>
                  </div>
                  <span className="text-[9px] text-zinc-400 font-sans block">
                    APB1 Prescaler (42MHz for I2C, SPI2, USART2) & APB2 Prescaler (84MHz for USART1, SPI1, ADC).
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 2: Silicon Signal Routing Simulator ── */}
      {activeTab === "routing_flow" && (
        <div className="flex-1 p-3 overflow-y-auto space-y-3">
          {/* Scenario Selector Bar */}
          <div className="bg-[#0c0e16] p-3 rounded-lg border border-zinc-800 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Select Hardware Signal Routing Scenario:
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPlaying((p) => !p)}
                  className={`px-2.5 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                    isPlaying
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  }`}
                >
                  {isPlaying ? "⏸ PAUSE ANIMATION" : "▶ PLAY ANIMATION"}
                </button>
                <button
                  onClick={() => setCurrentStepIdx((p) => (p + 1) % selectedScenario.steps.length)}
                  className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] font-bold cursor-pointer"
                >
                  STEP ➔
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-1.5">
              {SCENARIOS.map((sc) => (
                <button
                  key={sc.id}
                  onClick={() => {
                    setSelectedScenario(sc);
                    setCurrentStepIdx(0);
                  }}
                  className={`p-2 rounded text-left transition-all border cursor-pointer ${
                    selectedScenario.id === sc.id
                      ? "bg-cyan-500/20 text-cyan-200 border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.2)]"
                      : "bg-zinc-900/60 text-zinc-400 border-zinc-800/80 hover:text-zinc-200"
                  }`}
                >
                  <span className="text-[8px] font-bold px-1 py-0.2 rounded bg-zinc-800 text-cyan-300 inline-block mb-1">
                    {sc.category}
                  </span>
                  <span className="text-[10px] font-bold block truncate font-sans">
                    {sc.name.split(". ")[1]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Main Silicon Block Routing Diagram */}
          <div className="p-3 bg-[#05070a] border border-zinc-800 rounded-lg space-y-3">
            <div className="flex justify-between items-center border-b border-zinc-800/80 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]" />
                <span className="text-xs font-bold text-zinc-200">
                  {selectedScenario.name}
                </span>
              </div>
              <span className="text-[10px] text-cyan-400 font-bold">
                Step {currentStepIdx + 1} of {selectedScenario.steps.length}: {curStep.title}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-[10px]">
              <div className="space-y-2">
                <div
                  className={`p-3 rounded-lg border transition-all duration-300 ${
                    isBlockActive("flash")
                      ? "bg-amber-500/25 border-amber-400 text-amber-200 shadow-[0_0_15px_#f59e0b] scale-102"
                      : "bg-[#0c0e16] border-zinc-800 text-zinc-500"
                  }`}
                >
                  <span className="font-bold block">1MB FLASH ROM (0x08000000)</span>
                  <span className="text-[9px] text-zinc-400 font-sans block mt-0.5">
                    Non-volatile C/WASM firmware code & Interrupt Vector Table.
                  </span>
                </div>

                <div
                  className={`p-3 rounded-lg border transition-all duration-300 ${
                    isBlockActive("sram")
                      ? "bg-emerald-500/25 border-emerald-400 text-emerald-200 shadow-[0_0_15px_#34d399] scale-102"
                      : "bg-[#0c0e16] border-zinc-800 text-zinc-500"
                  }`}
                >
                  <span className="font-bold block">192KB SRAM (0x20000000)</span>
                  <span className="text-[9px] text-zinc-400 font-sans block mt-0.5">
                    Fast volatile stack, heap, and DMA buffer memory.
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div
                  className={`p-3.5 rounded-lg border transition-all duration-300 ${
                    isBlockActive("cpu")
                      ? "bg-cyan-500/25 border-cyan-400 text-cyan-200 shadow-[0_0_15px_#22d3ee] scale-102"
                      : "bg-[#0c0e16] border-zinc-800 text-zinc-500"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold">ARM CORTEX-M4 CORE</span>
                    <span className="text-[8px] px-1 bg-cyan-950 rounded border border-cyan-800 text-cyan-300">168 MHz</span>
                  </div>
                  <span className="text-[9px] text-zinc-400 font-sans block mt-0.5">
                    ALU, FPU, Registers (R0-R15), Program Counter (PC), SysTick Timer.
                  </span>
                </div>

                <div
                  className={`p-2.5 rounded-lg border transition-all duration-300 ${
                    isBlockActive("nvic") || isBlockActive("exti")
                      ? "bg-rose-500/25 border-rose-400 text-rose-200 shadow-[0_0_15px_#f43f5e] scale-102"
                      : "bg-[#0c0e16] border-zinc-800 text-zinc-500"
                  }`}
                >
                  <span className="font-bold block">NVIC & EXTI CONTROLLER</span>
                  <span className="text-[9px] text-zinc-400 font-sans block mt-0.5">
                    82 prioritized interrupt lines with 12-cycle zero-jitter entry.
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div
                  className={`p-2.5 rounded-lg border transition-all duration-300 ${
                    isBlockActive("bus_matrix") || isBlockActive("ahb1") || isBlockActive("apb1") || isBlockActive("apb2")
                      ? "bg-blue-500/25 border-blue-400 text-blue-200 shadow-[0_0_15px_#3b82f6] scale-102"
                      : "bg-[#0c0e16] border-zinc-800 text-zinc-500"
                  }`}
                >
                  <span className="font-bold block">MULTI-AHB BUS MATRIX</span>
                  <span className="text-[9px] text-zinc-400 font-sans block mt-0.5">
                    AHB1 (168MHz), APB2 (84MHz), APB1 (42MHz) crossbar switches.
                  </span>
                </div>

                <div
                  className={`p-2.5 rounded-lg border transition-all duration-300 ${
                    isBlockActive("gpioa") || isBlockActive("usart1") || isBlockActive("spi1") || isBlockActive("i2c1") || isBlockActive("dma2") || isBlockActive("adc1")
                      ? "bg-purple-500/25 border-purple-400 text-purple-200 shadow-[0_0_15px_#a855f7] scale-102"
                      : "bg-[#0c0e16] border-zinc-800 text-zinc-500"
                  }`}
                >
                  <span className="font-bold block">HARDWARE PERIPHERALS</span>
                  <span className="text-[9px] text-zinc-400 font-sans block mt-0.5">
                    {isBlockActive("gpioa") ? "● GPIOA Active" : ""}
                    {isBlockActive("usart1") ? "● USART1 Active" : ""}
                    {isBlockActive("spi1") ? "● SPI1 Active" : ""}
                    {isBlockActive("i2c1") ? "● I2C1 Active" : ""}
                    {isBlockActive("dma2") ? "● DMA2 Active" : ""}
                    {isBlockActive("adc1") ? "● ADC1 Active" : ""}
                    {!isBlockActive("gpioa") && !isBlockActive("usart1") && !isBlockActive("spi1") && !isBlockActive("i2c1") && !isBlockActive("dma2") && !isBlockActive("adc1") ? "Peripheral Registers" : ""}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div
                  className={`p-2.5 rounded-lg border transition-all duration-300 ${
                    isBlockActive("af_mux")
                      ? "bg-amber-500/25 border-amber-400 text-amber-200 shadow-[0_0_15px_#f59e0b] scale-102"
                      : "bg-[#0c0e16] border-zinc-800 text-zinc-500"
                  }`}
                >
                  <span className="font-bold block">16-TO-1 AF MULTIPLEXER</span>
                  <span className="text-[9px] text-zinc-400 font-sans block mt-0.5">
                    Routes physical pin between standard GPIO, UART, SPI, I2C, PWM.
                  </span>
                </div>

                <div
                  className={`p-3 rounded-lg border transition-all duration-300 ${
                    isBlockActive("pin_pa0") || isBlockActive("pin_pa9") || isBlockActive("pin_pa5") || isBlockActive("pin_pa7") || isBlockActive("pin_pa6") || isBlockActive("pin_pb6") || isBlockActive("pin_pb7") || isBlockActive("pin_pc13")
                      ? "bg-emerald-500/30 border-emerald-400 text-emerald-200 shadow-[0_0_20px_#34d399] scale-105"
                      : "bg-[#0c0e16] border-zinc-800 text-zinc-500"
                  }`}
                >
                  <span className="font-bold text-emerald-300 block">PHYSICAL METAL CHIP PINS</span>
                  <span className="text-[9px] text-zinc-300 font-mono block mt-0.5">
                    {isBlockActive("pin_pa0") ? "⚡ PIN PA0 (3.3V OUTPUT)" : ""}
                    {isBlockActive("pin_pa9") ? "⚡ PIN PA9 (USART1_TX)" : ""}
                    {isBlockActive("pin_pa5") ? "⚡ PIN PA5 (SPI1_SCK)" : ""}
                    {isBlockActive("pin_pa7") ? "⚡ PIN PA7 (SPI1_MOSI)" : ""}
                    {isBlockActive("pin_pa6") ? "⚡ PIN PA6 (SPI1_MISO)" : ""}
                    {isBlockActive("pin_pb6") ? "⚡ PIN PB6 (I2C1_SCL)" : ""}
                    {isBlockActive("pin_pb7") ? "⚡ PIN PB7 (I2C1_SDA)" : ""}
                    {isBlockActive("pin_pc13") ? "⚡ PIN PC13 (BUTTON INPUT)" : ""}
                    {!isBlockActive("pin_pa0") && !isBlockActive("pin_pa9") && !isBlockActive("pin_pa5") && !isBlockActive("pin_pa7") && !isBlockActive("pin_pa6") && !isBlockActive("pin_pb6") && !isBlockActive("pin_pb7") && !isBlockActive("pin_pc13") ? "Bonding Wire & Pads" : ""}
                  </span>
                </div>
              </div>
            </div>

            {/* Live Step Explanation */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-2 border-t border-zinc-800">
              <div className="p-3 bg-[#0d1017] rounded-lg border border-zinc-800 space-y-1">
                <span className="text-[10px] font-bold text-cyan-300 uppercase block">
                  📖 Real-Time Plain English Hardware Explanation:
                </span>
                <p className="text-[11px] text-zinc-300 font-sans leading-relaxed">
                  {curStep.description}
                </p>
                <div className="pt-2 text-[10px] text-emerald-400 font-mono">
                  <strong>Silicon Bus State:</strong> {curStep.registerEffect}
                </div>
              </div>

              <div className="p-3 bg-[#0d1017] rounded-lg border border-zinc-800 space-y-1 font-mono text-[10px]">
                <span className="text-zinc-500 uppercase font-bold block">
                  Firmware C & Assembly Execution:
                </span>
                <div className="p-2 bg-[#050608] rounded border border-zinc-800/80 text-cyan-300 font-bold">
                  {selectedScenario.cCode}
                </div>
                <div className="p-2 bg-[#050608] rounded border border-zinc-800/80 text-zinc-400 whitespace-pre font-mono text-[9px]">
                  {selectedScenario.asmCode}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 3: GPIO Silicon Schematic ── */}
      {activeTab === "gpio_schematic" && (
        <div className="flex-1 p-3 overflow-y-auto space-y-3">
          <div className="p-3 bg-cyan-950/20 border border-cyan-800/40 rounded-lg flex justify-between items-center text-xs">
            <div>
              <span className="font-bold text-cyan-300 font-mono text-[11px] uppercase block">
                🔬 Inside a Microcontroller GPIO Pin (Silicon Gate Level)
              </span>
              <p className="text-zinc-400 text-[11px] font-sans">
                Every physical GPIO pin on an MCU contains ESD protection diodes, Push-Pull MOS transistors, a Schmitt trigger, pull-up/down resistors, and an Alternate Function Multiplexer.
              </p>
            </div>
          </div>

          {/* Interactive Controls */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 bg-[#0d1017] p-3 rounded-lg border border-zinc-800 text-[11px]">
            <div>
              <label className="text-[9px] text-zinc-500 uppercase font-bold block mb-1">
                GPIO Mode (MODER + OTYPER)
              </label>
              <select
                value={gpioMode}
                onChange={(e) => setGpioMode(e.target.value as typeof gpioMode)}
                className="w-full p-1.5 bg-[#12151e] border border-zinc-700 rounded text-cyan-300 font-bold focus:outline-none cursor-pointer"
              >
                <option value="OUTPUT_PUSHPULL">Output: Push-Pull (LED/Standard)</option>
                <option value="OUTPUT_OPENDRAIN">Output: Open-Drain (I2C / Wire-AND)</option>
                <option value="INPUT_PULLUP">Input: Internal Pull-Up (Button)</option>
                <option value="INPUT_FLOATING">Input: Floating (High-Z)</option>
                <option value="ANALOG">Analog: ADC / DAC Input</option>
              </select>
            </div>

            {isOutput && (
              <div>
                <label className="text-[9px] text-zinc-500 uppercase font-bold block mb-1">
                  Output Data Register (ODR bit)
                </label>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    onClick={() => {
                      setOdrBit(1);
                      if (!isOpenDrain) setPinVoltage(3.3);
                    }}
                    className={`py-1.5 rounded font-bold text-[10px] cursor-pointer ${
                      odrBit === 1
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400 font-bold shadow-[0_0_8px_#22d3ee]"
                        : "bg-zinc-900 text-zinc-500 border border-zinc-800"
                    }`}
                  >
                    LOGIC 1 (3.3V)
                  </button>
                  <button
                    onClick={() => {
                      setOdrBit(0);
                      setPinVoltage(0.0);
                    }}
                    className={`py-1.5 rounded font-bold text-[10px] cursor-pointer ${
                      odrBit === 0
                        ? "bg-rose-500/20 text-rose-300 border border-rose-400 font-bold shadow-[0_0_8px_#f43f5e]"
                        : "bg-zinc-900 text-zinc-500 border border-zinc-800"
                    }`}
                  >
                    LOGIC 0 (0.0V)
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="text-[9px] text-zinc-500 uppercase font-bold block mb-1">
                External Pin Voltage (V_PIN)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.0"
                  max="3.3"
                  step="0.1"
                  value={pinVoltage}
                  onChange={(e) => setPinVoltage(parseFloat(e.target.value))}
                  className="flex-1 accent-cyan-400 cursor-pointer"
                />
                <span className="text-cyan-400 font-bold font-mono w-12 text-right">
                  {pinVoltage.toFixed(1)}V
                </span>
              </div>
            </div>

            <div>
              <label className="text-[9px] text-zinc-500 uppercase font-bold block mb-1">
                Alternate Function Multiplexer (AFR)
              </label>
              <select
                value={selectedAf}
                onChange={(e) => setSelectedAf(e.target.value)}
                className="w-full p-1.5 bg-[#12151e] border border-zinc-700 rounded text-amber-300 font-bold focus:outline-none cursor-pointer"
              >
                <option value="GPIO">AF0: Standard GPIO (ODR / IDR)</option>
                <option value="USART1_TX">AF7: USART1_TX (Serial Transmit)</option>
                <option value="SPI1_SCK">AF5: SPI1_SCK (Clock Line)</option>
                <option value="I2C1_SDA">AF4: I2C1_SDA (Data Open-Drain)</option>
                <option value="TIM1_CH1">AF1: TIM1_CH1 (PWM Output)</option>
              </select>
            </div>
          </div>

          <div className="p-3 bg-[#05070a] border border-zinc-800 rounded-lg space-y-3">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 text-[10px]">
              <div className="p-3 bg-[#0d1017] rounded-lg border border-zinc-800 space-y-2">
                <span className="text-cyan-400 font-bold uppercase block border-b border-zinc-800/80 pb-1">
                  1. Output Driver Stage (Push-Pull / Open-Drain)
                </span>
                <div className={`p-2 rounded border transition-all ${
                  pmosOn
                    ? "bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-[0_0_8px_#22d3ee]"
                    : "bg-[#090b10] border-zinc-800 text-zinc-600"
                }`}>
                  <div className="flex justify-between">
                    <span className="font-bold">P-MOS Transistor (High-Side):</span>
                    <span>{pmosOn ? "CONDUCTING (ON)" : "OFF (OPEN)"}</span>
                  </div>
                  <span className="text-[9px] text-zinc-400 font-sans block mt-0.5">
                    Connects Pin to +3.3V VDD when ODR=1. (Disabled in Open-Drain mode!).
                  </span>
                </div>
                <div className={`p-2 rounded border transition-all ${
                  nmosOn
                    ? "bg-rose-500/20 border-rose-400 text-rose-200 shadow-[0_0_8px_#f43f5e]"
                    : "bg-[#090b10] border-zinc-800 text-zinc-600"
                }`}>
                  <div className="flex justify-between">
                    <span className="font-bold">N-MOS Transistor (Low-Side):</span>
                    <span>{nmosOn ? "CONDUCTING (ON)" : "OFF (OPEN)"}</span>
                  </div>
                  <span className="text-[9px] text-zinc-400 font-sans block mt-0.5">
                    Pulls Pin down to 0.0V GND when ODR=0.
                  </span>
                </div>
              </div>

              <div className="p-3 bg-[#0d1017] rounded-lg border border-zinc-800 space-y-2">
                <span className="text-amber-400 font-bold uppercase block border-b border-zinc-800/80 pb-1">
                  2. Protection Diodes & Pull Resistors
                </span>
                <div className="p-2 bg-[#090b10] rounded border border-zinc-800 text-zinc-300">
                  <span className="font-bold text-amber-300 block mb-0.5">ESD Clamping Diodes:</span>
                  <p className="text-[9px] text-zinc-400 font-sans">
                    Two reverse-biased diodes clamp voltages above 3.6V or below -0.3V into the power rails.
                  </p>
                </div>
                <div className={`p-2 rounded border transition-all ${
                  isPullUp
                    ? "bg-amber-500/20 border-amber-400 text-amber-200 shadow-[0_0_8px_#f59e0b]"
                    : "bg-[#090b10] border-zinc-800 text-zinc-600"
                }`}>
                  <div className="flex justify-between">
                    <span className="font-bold">40 kΩ Pull-Up Resistor:</span>
                    <span>{isPullUp ? "ENABLED" : "DISABLED"}</span>
                  </div>
                  <span className="text-[9px] text-zinc-400 font-sans block mt-0.5">
                    Pulls floating input line weakly to 3.3V so switches read 1 when unpressed.
                  </span>
                </div>
              </div>

              <div className="p-3 bg-[#0d1017] rounded-lg border border-zinc-800 space-y-2">
                <span className="text-emerald-400 font-bold uppercase block border-b border-zinc-800/80 pb-1">
                  3. Input Buffer (Schmitt Trigger)
                </span>
                <div className={`p-2 rounded border transition-all ${
                  schmittTriggerActive
                    ? "bg-emerald-500/20 border-emerald-400 text-emerald-200 shadow-[0_0_8px_#34d399]"
                    : "bg-[#090b10] border-zinc-800 text-zinc-600"
                }`}>
                  <div className="flex justify-between">
                    <span className="font-bold">Schmitt Trigger (Hysteresis):</span>
                    <span>{schmittTriggerActive ? "ACTIVE" : "BYPASSED (ANALOG)"}</span>
                  </div>
                  <p className="text-[9px] text-zinc-400 font-sans mt-0.5">
                    Converts noisy analog input into crisp digital 0/1. High threshold VIH = 2.0V, Low threshold VIL = 0.8V.
                  </p>
                </div>
                <div className="p-2 bg-[#090b10] rounded border border-zinc-800 flex justify-between items-center">
                  <span className="text-zinc-400 font-bold">Input Data Register (IDR):</span>
                  <span className={`px-2 py-0.5 rounded font-mono font-bold text-xs ${
                    idrBit === 1 ? "bg-emerald-500/30 text-emerald-300 border border-emerald-500/50" : "bg-zinc-800 text-zinc-500"
                  }`}>
                    BIT = {idrBit} ({pinVoltage >= 2.0 ? "HIGH" : "LOW"})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 4: Complete MCU Silicon Die Block Diagram ── */}
      {activeTab === "block_diagram" && (
        <div className="flex-1 p-3 overflow-y-auto space-y-3 font-sans text-xs">
          <div className="p-3 bg-emerald-950/20 border border-emerald-800/40 rounded-lg">
            <span className="font-bold text-emerald-300 font-mono text-[11px] uppercase block mb-1">
              🏛️ Inside the 32-Bit Microcontroller Die (ARM Cortex-M4 Silicon Architecture)
            </span>
            <p className="text-zinc-300 text-[11px]">
              A microcontroller (MCU) is a self-contained computer on a single silicon chip containing CPU Core, Ultra-Fast Buses (AHB / APB), Memory (Flash + SRAM), and Hardware Peripherals.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 text-[11px]">
            <div className="p-3 bg-[#0d1017] rounded-lg border border-cyan-800/60 space-y-2">
              <span className="font-bold text-cyan-300 font-mono uppercase block border-b border-cyan-800/40 pb-1">
                1. Processor Core (CPU)
              </span>
              <ul className="space-y-1 text-zinc-400 text-[10px] list-disc list-inside font-mono">
                <li><strong>ARM Cortex-M4</strong> 32-bit core @ 168 MHz</li>
                <li><strong>Registers:</strong> R0–R15 (SP, LR, PC)</li>
                <li><strong>FPU:</strong> Single-precision Hardware Math</li>
                <li><strong>NVIC:</strong> 82 prioritized interrupt channels</li>
                <li><strong>SysTick:</strong> 24-bit system tick timer for RTOS</li>
              </ul>
            </div>

            <div className="p-3 bg-[#0d1017] rounded-lg border border-emerald-800/60 space-y-2">
              <span className="font-bold text-emerald-300 font-mono uppercase block border-b border-emerald-800/40 pb-1">
                2. Multi-AHB Bus Matrix
              </span>
              <ul className="space-y-1 text-zinc-400 text-[10px] list-disc list-inside font-mono">
                <li><strong>I-Bus:</strong> Fetches code instructions from Flash</li>
                <li><strong>D-Bus:</strong> Reads constants and literal pools</li>
                <li><strong>S-Bus:</strong> Accesses SRAM and Peripherals</li>
                <li><strong>AHB1/AHB2:</strong> 168 MHz High-Performance Bus</li>
                <li><strong>APB1 / APB2:</strong> 42 MHz / 84 MHz Peripheral Buses</li>
              </ul>
            </div>

            <div className="p-3 bg-[#0d1017] rounded-lg border border-amber-800/60 space-y-2">
              <span className="font-bold text-amber-300 font-mono uppercase block border-b border-amber-800/40 pb-1">
                3. Memory Hierarchy
              </span>
              <ul className="space-y-1 text-zinc-400 text-[10px] list-disc list-inside font-mono">
                <li><strong>Flash ROM (1 MB):</strong> Non-volatile firmware @ <code>0x08000000</code></li>
                <li><strong>SRAM (192 KB):</strong> Volatile variables/stack @ <code>0x20000000</code></li>
                <li><strong>CCM RAM (64 KB):</strong> Core-Coupled Memory for zero-wait state execution</li>
                <li><strong>Boot ROM:</strong> Factory DFU bootloader in system memory</li>
              </ul>
            </div>

            <div className="p-3 bg-[#0d1017] rounded-lg border border-purple-800/60 space-y-2">
              <span className="font-bold text-purple-300 font-mono uppercase block border-b border-purple-800/40 pb-1">
                4. Hardware Peripherals
              </span>
              <ul className="space-y-1 text-zinc-400 text-[10px] list-disc list-inside font-mono">
                <li><strong>GPIO:</strong> Ports A, B, C, D, E (16 pins each)</li>
                <li><strong>SPI 1/2/3:</strong> Full-Duplex serial up to 42 MHz</li>
                <li><strong>I2C 1/2/3:</strong> Standard, Fast, and SMBus modes</li>
                <li><strong>USART 1/2/3/6:</strong> Async serial with DMA</li>
                <li><strong>ADC 1/2/3:</strong> 12-bit analog SAR (2.4 MSPS)</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 5: 32-Bit Memory Map ── */}
      {activeTab === "memory_map" && (
        <div className="flex-1 p-3 overflow-y-auto space-y-3 font-mono text-xs">
          <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-lg">
            <span className="font-bold text-amber-300 font-mono text-[11px] uppercase block mb-1">
              🗺️ 32-Bit Flat Memory Address Space (0x00000000 - 0xFFFFFFFF = 4 GB)
            </span>
            <p className="text-zinc-300 text-[11px] font-sans">
              In ARM Cortex-M microcontrollers, every hardware peripheral, register, RAM byte, and Flash instruction shares one continuous 32-bit address space.
            </p>
          </div>

          <div className="bg-[#0d1017] rounded-lg border border-zinc-800 overflow-hidden text-[11px]">
            <div className="grid grid-cols-4 p-2 bg-[#141824] border-b border-zinc-800 font-bold text-zinc-400 text-[10px]">
              <span>ADDRESS RANGE</span>
              <span>REGION NAME</span>
              <span>BUS / CLOCK</span>
              <span>DESCRIPTION</span>
            </div>

            {[
              { addr: "0x0800 0000 - 0x080F FFFF", name: "FLASH MEMORY (1MB)", bus: "I-Code / D-Code", desc: "Non-volatile program code & constants" },
              { addr: "0x2000 0000 - 0x2001 BFFF", name: "SRAM1 (112KB)", bus: "System Bus (168MHz)", desc: "Heap, global variables & data" },
              { addr: "0x2001 C000 - 0x2001 FFFF", name: "SRAM2 (16KB)", bus: "System Bus (168MHz)", desc: "Ethernet & USB buffer memory" },
              { addr: "0x4002 0000 - 0x4002 03FF", name: "GPIOA REGISTERS", bus: "AHB1 Bus (168MHz)", desc: "GPIOA_MODER, ODR, IDR, BSRR, AFR" },
              { addr: "0x4002 0400 - 0x4002 07FF", name: "GPIOB REGISTERS", bus: "AHB1 Bus (168MHz)", desc: "GPIOB_MODER, ODR, IDR, BSRR, AFR" },
              { addr: "0x4001 1000 - 0x4001 13FF", name: "USART1 PERIPHERAL", bus: "APB2 Bus (84MHz)", desc: "USART_SR, DR, BRR (Baud), CR1" },
              { addr: "0x4001 3000 - 0x4001 33FF", name: "SPI1 PERIPHERAL", bus: "APB2 Bus (84MHz)", desc: "SPI_CR1 (Mode), SR, DR (Shift Reg)" },
              { addr: "0x4000 5400 - 0x4000 57FF", name: "I2C1 PERIPHERAL", bus: "APB1 Bus (42MHz)", desc: "I2C_CR1, CR2, OAR1, DR, SR1, SR2" },
              { addr: "0xE000 E000 - 0xE000 EFFF", name: "CORTEX-M4 INTERNAL", bus: "Private Bus (168MHz)", desc: "NVIC Interrupts, SysTick, MPU Core Regs" },
            ].map((row, idx) => (
              <div
                key={idx}
                className="grid grid-cols-4 p-2 border-b border-zinc-800/40 text-[10px] hover:bg-zinc-900/40 font-mono"
              >
                <span className="text-cyan-400 font-bold">{row.addr}</span>
                <span className="text-emerald-300 font-bold">{row.name}</span>
                <span className="text-amber-300">{row.bus}</span>
                <span className="text-zinc-400 font-sans">{row.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab 6: CPU Pipeline ── */}
      {activeTab === "cpu_pipeline" && (
        <div className="flex-1 overflow-hidden">
          <CpuPipelineViewer />
        </div>
      )}

      {/* ── Tab 7: Clock Tree ── */}
      {activeTab === "clock_tree" && (
        <div className="flex-1 overflow-hidden">
          <ClockTreeViewer />
        </div>
      )}

      {/* ── Tab 8: DMA Deep-Dive ── */}
      {activeTab === "dma_deep_dive" && (
        <div className="flex-1 overflow-hidden">
          <DmaDeepDiveViewer />
        </div>
      )}
    </div>
  );
}
