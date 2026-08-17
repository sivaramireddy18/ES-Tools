#include "mock_hal.h"

// Replaces the infinite while(1) to allow cooperative multitasking in the browser
void loop(void) {
    // Read from DIP Switch 0 (Mapped to Pin 4 in our memory map)
    uint8_t switch_state = HAL_GPIO_ReadPin(4);
    
    // Write that state directly to LED 0 (Mapped to Pin 0)
    HAL_GPIO_WritePin(0, switch_state);
    
    // Heartbeat on Pin 1 to prove execution is running
    static uint8_t tick = 0;
    if (tick++ % 50 == 0) {
        uint8_t current = HAL_GPIO_ReadPin(1);
        HAL_GPIO_WritePin(1, !current); // Toggle
    }
}
