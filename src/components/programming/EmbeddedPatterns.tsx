"use client";

import React, { useState } from "react";

const BIT_OPS = [
  { op: "SET a bit", macro: "#define SET_BIT(reg, bit)   ((reg) |=  (1U << (bit)))", example: "SET_BIT(GPIOA->ODR, 5);   // PA5 = HIGH", desc: "OR-mask forces bit to 1 without touching other bits." },
  { op: "CLEAR a bit", macro: "#define CLR_BIT(reg, bit)   ((reg) &= ~(1U << (bit)))", example: "CLR_BIT(GPIOA->ODR, 5);   // PA5 = LOW", desc: "AND with inverted mask forces bit to 0." },
  { op: "TOGGLE a bit", macro: "#define TGL_BIT(reg, bit)   ((reg) ^=  (1U << (bit)))", example: "TGL_BIT(GPIOA->ODR, 5);   // PA5 flip", desc: "XOR flips the bit regardless of current state." },
  { op: "READ a bit", macro: "#define READ_BIT(reg, bit)  (((reg) >> (bit)) & 1U)", example: "uint8_t s = READ_BIT(GPIOA->IDR, 13); // button", desc: "Shift right then mask gives 0 or 1." },
  { op: "SET field", macro: "#define SET_FIELD(reg, mask, val) \\\n  ((reg) = ((reg) & ~(mask)) | ((val) & (mask)))", example: "// Set MODER[3:2] = 01 (output mode)\nSET_FIELD(GPIOA->MODER, 0x0C, 0x04);", desc: "Clear the field first, then OR in the new value." },
];

const PATTERNS = [
  {
    title: "State Machine (Non-Blocking)",
    color: "cyan",
    code: `typedef enum {
  STATE_IDLE,
  STATE_BLINK_ON,
  STATE_BLINK_OFF,
  STATE_FAST_BLINK,
} LedState;

static LedState state = STATE_IDLE;
static uint32_t lastTick = 0;

void ledStateMachine(void) {
  uint32_t now = HAL_GetTick();
  switch (state) {
    case STATE_IDLE:
      // Wait for button press
      if (!HAL_GPIO_ReadPin(BUTTON_PORT, BUTTON_PIN))
        state = STATE_BLINK_ON;
      break;

    case STATE_BLINK_ON:
      HAL_GPIO_WritePin(LED_PORT, LED_PIN, GPIO_PIN_SET);
      if (now - lastTick >= 500) {
        lastTick = now;
        state = STATE_BLINK_OFF;
      }
      break;

    case STATE_BLINK_OFF:
      HAL_GPIO_WritePin(LED_PORT, LED_PIN, GPIO_PIN_RESET);
      if (now - lastTick >= 500) {
        lastTick = now;
        state = STATE_BLINK_ON;  // loop
      }
      break;
  }
}

// In main():  while(1) { ledStateMachine(); otherTask(); }`,
    desc: "State machines replace delay() and while() loops. The CPU is never blocked — it checks state and returns immediately, allowing other tasks to run.",
  },
  {
    title: "Ring Buffer (UART RX)",
    color: "emerald",
    code: `#define BUF_SIZE 256  // Must be power of 2!
typedef struct {
  uint8_t  data[BUF_SIZE];
  uint16_t head;  // Written by ISR
  uint16_t tail;  // Read by main()
} RingBuf;

static RingBuf rxBuf = {0};

// Called from USART1_IRQHandler
void ringBuf_push(uint8_t byte) {
  uint16_t nextHead = (rxBuf.head + 1) & (BUF_SIZE - 1);
  if (nextHead != rxBuf.tail) { // Not full
    rxBuf.data[rxBuf.head] = byte;
    rxBuf.head = nextHead;
  }
  // else: buffer overflow → drop byte (or assert)
}

// Called from main() loop
int ringBuf_pop(uint8_t *out) {
  if (rxBuf.head == rxBuf.tail) return 0; // Empty
  *out = rxBuf.data[rxBuf.tail];
  rxBuf.tail = (rxBuf.tail + 1) & (BUF_SIZE - 1);
  return 1;
}`,
    desc: "A ring (circular) buffer lets an ISR push bytes at interrupt speed while main() pops them at any rate — without locking or dynamic allocation.",
  },
  {
    title: "Function Pointer Callbacks",
    color: "amber",
    code: `// Generic timer driver with user callback
typedef void (*TimerCallback_t)(void);

static TimerCallback_t userCb = NULL;

void timer_registerCallback(TimerCallback_t cb) {
  userCb = cb;
}

void TIM2_IRQHandler(void) {
  TIM2->SR &= ~TIM_SR_UIF; // Clear flag
  if (userCb) userCb();    // Call user code!
}

// ── User application code ──
void myTimerHandler(void) {
  toggleLed();
  sendHeartbeat();
}

void main(void) {
  timer_init(1000); // 1kHz
  timer_registerCallback(myTimerHandler);
  while(1) { /* main loop free */ }
}`,
    desc: "Function pointers decouple hardware drivers from application code. The driver doesn't know what the user wants to do — it just calls the registered callback.",
  },
  {
    title: "CMSIS Struct Register Access",
    color: "purple",
    code: `// CMSIS defines peripherals as C structs.
// Never use magic numbers — use named fields!

// BAD — magic numbers, unreadable, breaks on different MCU
*(volatile uint32_t*)0x40020000 |= (1 << 10);

// GOOD — CMSIS struct (defined in stm32f4xx.h)
typedef struct {
  __IO uint32_t MODER;   // 0x00: Mode register
  __IO uint32_t OTYPER;  // 0x04: Output type
  __IO uint32_t OSPEEDR; // 0x08: Output speed
  __IO uint32_t PUPDR;   // 0x0C: Pull-up/down
  __IO uint32_t IDR;     // 0x10: Input data
  __IO uint32_t ODR;     // 0x14: Output data
  __IO uint32_t BSRR;    // 0x18: Bit set/reset
  __IO uint32_t LCKR;    // 0x1C: Lock register
  __IO uint32_t AFR[2];  // 0x20: Alt function
} GPIO_TypeDef;

#define GPIOA ((GPIO_TypeDef *) 0x40020000UL)

// Now readable, portable, type-safe:
GPIOA->MODER |= GPIO_MODER_MODER5_0;  // PA5 output`,
    desc: "CMSIS (Cortex Microcontroller Software Interface Standard) defines every peripheral as a C struct. This gives you type safety, IntelliSense, and readable code.",
  },
  {
    title: "Memory Sections (.text, .data, .bss)",
    color: "rose",
    code: `// .text section — code and read-only constants
// Stored in Flash, executed in-place
const uint8_t lookupTable[256] = { ... }; // .rodata

// .data section — initialized variables
// Stored in Flash (LMA), copied to SRAM (VMA) at startup
uint32_t counter = 42;        // .data

// .bss section — zero-initialized variables  
// Only space reserved in SRAM, Flash footprint = 0
uint8_t rxBuffer[4096];       // .bss (zeroed by startup)

// Heap (malloc) and Stack grow from opposite ends of SRAM!
// Stack grows DOWN from top of SRAM: 0x20020000
// Heap grows UP from end of .bss

// Check sizes:
// arm-none-eabi-size firmware.elf
//    text    data     bss     dec
//   32456    1024    8192   41672`,
    desc: "Understanding memory sections is critical for embedded: Flash is precious (code + consts), SRAM is fast (variables + stack). The linker script controls section placement.",
  },
];

const MEMORY_MAP = [
  { section: ".text (code)", location: "Flash (0x08000000)", size: "Your compiled code", desc: "ARM instructions, Thumb-2 opcodes. Executed directly from Flash via ART accelerator." },
  { section: ".rodata (consts)", location: "Flash", size: "const tables, strings", desc: "Literal pools, lookup tables, string constants. Read-only, never modified." },
  { section: ".data (init vars)", location: "Flash + SRAM", size: "Non-zero globals", desc: "Stored in Flash, startup code (startup_xxx.s) copies to SRAM before main()." },
  { section: ".bss (zero vars)", location: "SRAM only", size: "Zero-init globals", desc: "No Flash cost — startup code zeroes this SRAM region. uint8_t buf[4096] costs nothing in Flash." },
  { section: "Heap", location: "SRAM", size: "malloc() allocations", desc: "Grows upward. Avoid in embedded — fragmentation, no free() guarantee, hard to debug." },
  { section: "Stack", location: "SRAM top", size: "Local vars + ISR frames", desc: "Grows downward. Overflow is silent corruption! Size with -Wstack-usage or MPU." },
];

export default function EmbeddedPatterns() {
  const [activeTab, setActiveTab] = useState<"bits" | "patterns" | "memory">("bits");
  const [selectedPattern, setSelectedPattern] = useState(0);
  const [bitReg, setBitReg] = useState(0b00000000);
  const [bitPos, setBitPos] = useState(3);

  const afterSet = bitReg | (1 << bitPos);
  const afterClr = bitReg & ~(1 << bitPos);
  const afterTgl = bitReg ^ (1 << bitPos);
  const bitVal = (bitReg >> bitPos) & 1;

  const colorMap: Record<string, string> = {
    cyan: "border-cyan-400 bg-cyan-950/20 text-cyan-200",
    emerald: "border-emerald-400 bg-emerald-950/20 text-emerald-200",
    amber: "border-amber-400 bg-amber-950/20 text-amber-200",
    purple: "border-purple-400 bg-purple-950/20 text-purple-200",
    rose: "border-rose-400 bg-rose-950/20 text-rose-200",
  };

  const fmtBin = (n: number) => n.toString(2).padStart(8, "0").split("").join(" ");
  const fmtHex = (n: number) => "0x" + n.toString(16).toUpperCase().padStart(2, "0");

  return (
    <div className="flex flex-col h-full bg-[#080a0e] text-zinc-200 font-mono text-xs overflow-y-auto">
      <div className="p-3 bg-violet-950/20 border-b border-violet-800/30 shrink-0">
        <span className="text-[11px] font-bold text-violet-300 uppercase block">💻 Embedded C Programming Patterns & Reference</span>
        <p className="text-zinc-400 text-[10px] font-sans mt-0.5">Core C techniques for embedded: bit manipulation, non-blocking state machines, ring buffers, callbacks, CMSIS registers, and memory layout.</p>
      </div>

      <div className="flex border-b border-zinc-800 bg-[#0d1017] px-2 pt-1 gap-1 shrink-0">
        {[
          { id: "bits", label: "⚙ Bit Manipulation" },
          { id: "patterns", label: "🏗 Code Patterns" },
          { id: "memory", label: "🗂 Memory Layout" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as typeof activeTab)}
            className={`px-3 py-1.5 text-[10px] font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === t.id
                ? "border-violet-400 text-violet-300 bg-[#141824]"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 p-3 space-y-3 overflow-y-auto">
        {/* ── Bit Manipulation ── */}
        {activeTab === "bits" && (
          <>
            {/* Interactive calculator */}
            <div className="bg-[#0d1017] border border-zinc-800 rounded-lg p-3 space-y-3">
              <span className="text-[10px] font-bold text-zinc-400 uppercase">🔢 Live Bit Manipulation Calculator</span>

              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <div className="text-[9px] text-zinc-500 mb-1">Register value (click bits to toggle)</div>
                  <div className="flex gap-1">
                    {Array.from({ length: 8 }, (_, i) => {
                      const bit = 7 - i;
                      const val = (bitReg >> bit) & 1;
                      return (
                        <button
                          key={bit}
                          onClick={() => setBitReg((r) => r ^ (1 << bit))}
                          className={`w-7 h-7 rounded border font-bold text-[11px] cursor-pointer transition-all ${
                            val ? "bg-cyan-500 border-cyan-400 text-zinc-900" : "bg-zinc-900 border-zinc-700 text-zinc-600"
                          }`}
                        >
                          {val}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-1 mt-0.5">
                    {Array.from({ length: 8 }, (_, i) => (
                      <div key={i} className="w-7 text-center text-[8px] text-zinc-600">{7 - i}</div>
                    ))}
                  </div>
                  <div className="text-[9px] text-cyan-300 mt-1 font-mono">{fmtHex(bitReg)} = {fmtBin(bitReg)}</div>
                </div>

                <div>
                  <div className="text-[9px] text-zinc-500 mb-1">Target bit position</div>
                  <input
                    type="range" min={0} max={7} value={bitPos}
                    onChange={(e) => setBitPos(parseInt(e.target.value))}
                    className="w-32 h-1.5 accent-violet-400 cursor-pointer"
                  />
                  <div className="text-violet-300 text-[10px] font-bold mt-0.5">bit {bitPos} = {bitVal}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                {[
                  { op: "SET bit", result: afterSet, color: "emerald", macro: `|= (1 << ${bitPos})` },
                  { op: "CLEAR bit", result: afterClr, color: "rose", macro: `&= ~(1 << ${bitPos})` },
                  { op: "TOGGLE bit", result: afterTgl, color: "amber", macro: `^= (1 << ${bitPos})` },
                  { op: "READ bit", result: bitVal, color: "cyan", macro: `>> ${bitPos} & 1U` },
                ].map((op) => (
                  <div key={op.op} className={`p-2 rounded border ${colorMap[op.color]} space-y-1`}>
                    <div className="font-bold text-[9px] uppercase">{op.op}</div>
                    <div className="font-mono">{fmtHex(op.result)}</div>
                    <div className="text-[8px]">{fmtBin(op.result)}</div>
                    <div className="text-[8px] opacity-70 font-mono">{op.macro}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Macro cheatsheet */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-zinc-400 uppercase">Macro Cheatsheet (Copy-paste ready)</span>
              {BIT_OPS.map((b) => (
                <div key={b.op} className="bg-[#0d1017] border border-zinc-800 rounded-lg p-3 space-y-1">
                  <div className="font-bold text-violet-300 text-[10px]">{b.op}</div>
                  <pre className="text-[9px] text-cyan-300 bg-[#050709] p-2 rounded border border-zinc-800">{b.macro}</pre>
                  <pre className="text-[9px] text-emerald-300 bg-[#050709] p-1.5 rounded border border-zinc-800">{b.example}</pre>
                  <p className="text-[9px] text-zinc-500 font-sans">{b.desc}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Patterns ── */}
        {activeTab === "patterns" && (
          <div className="flex gap-3 h-full">
            {/* Sidebar */}
            <div className="w-48 shrink-0 space-y-1.5">
              {PATTERNS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedPattern(i)}
                  className={`w-full p-2.5 rounded-lg border text-left text-[10px] font-bold cursor-pointer transition-all ${
                    selectedPattern === i
                      ? colorMap[p.color]
                      : "bg-zinc-900/60 border-zinc-800 text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {p.title}
                </button>
              ))}
            </div>

            {/* Detail */}
            <div className="flex-1 space-y-3 overflow-y-auto">
              {(() => {
                const p = PATTERNS[selectedPattern];
                return (
                  <>
                    <div className={`p-3 rounded-lg border ${colorMap[p.color]}`}>
                      <span className="font-bold text-[11px] block">{p.title}</span>
                      <p className="text-[10px] font-sans mt-1 opacity-90">{p.desc}</p>
                    </div>
                    <pre className="text-[9px] text-cyan-300 bg-[#050709] p-3 rounded border border-zinc-800 overflow-x-auto leading-relaxed">{p.code}</pre>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* ── Memory Layout ── */}
        {activeTab === "memory" && (
          <div className="space-y-3">
            <div className="p-3 bg-violet-950/20 border border-violet-800/30 rounded-lg text-[10px]">
              <span className="font-bold text-violet-300 uppercase block mb-1">🗂 STM32F4 Memory Map Overview</span>
              <p className="text-zinc-400 font-sans">The linker script assigns each data type to a memory region. Flash is non-volatile (survives power off). SRAM is fast but volatile. Understanding this lets you minimize Flash usage and avoid stack overflows.</p>
            </div>

            {/* Visual memory bar */}
            <div className="bg-[#050709] border border-zinc-800 rounded-lg p-3">
              <span className="text-[9px] font-bold text-zinc-500 uppercase block mb-2">Visual Memory Layout (SRAM: 192KB total)</span>
              <div className="flex h-8 rounded overflow-hidden border border-zinc-800 text-[8px] font-bold">
                {[
                  { label: ".data", pct: 8, bg: "bg-cyan-500" },
                  { label: ".bss", pct: 20, bg: "bg-emerald-500" },
                  { label: "Heap ↑", pct: 15, bg: "bg-amber-500" },
                  { label: "FREE", pct: 37, bg: "bg-zinc-800" },
                  { label: "Stack ↓", pct: 20, bg: "bg-rose-500" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className={`${s.bg} flex items-center justify-center text-zinc-900 transition-all`}
                    style={{ width: `${s.pct}%` }}
                  >
                    {s.label}
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[8px] text-zinc-500 mt-0.5">
                <span>0x20000000</span>
                <span>0x20030000 (top)</span>
              </div>
            </div>

            <div className="space-y-2">
              {MEMORY_MAP.map((m) => (
                <div key={m.section} className="grid grid-cols-1 md:grid-cols-4 gap-2 p-2.5 bg-[#0d1017] rounded border border-zinc-800 text-[10px]">
                  <span className="font-bold text-violet-300">{m.section}</span>
                  <span className="text-cyan-400 font-mono text-[9px]">{m.location}</span>
                  <span className="text-amber-300 text-[9px]">{m.size}</span>
                  <span className="text-zinc-400 font-sans">{m.desc}</span>
                </div>
              ))}
            </div>

            <div className="p-3 bg-rose-950/20 border border-rose-800/30 rounded-lg">
              <span className="font-bold text-rose-300 uppercase block mb-1 text-[10px]">⚠ Stack Overflow Detection</span>
              <pre className="text-[9px] text-cyan-300">{`// Canary method — check for stack corruption
#define STACK_CANARY 0xDEADBEEF
uint32_t *stackTop = (uint32_t*)0x20020000;
*stackTop = STACK_CANARY;

void checkStack(void) {
  if (*stackTop != STACK_CANARY) {
    // Stack overflow detected! Handle it.
    Error_Handler();
  }
}

// GCC: Add to build flags for runtime check:
// -fstack-usage -Wstack-usage=256`}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
