#include "mock_hal.h"

// Foreign Function Interface imports provided by runner.worker.ts
extern void __js_gpio_write(uint8_t pin, uint8_t state);
extern uint8_t __js_gpio_read(uint8_t pin);
extern void __js_delay_ms(uint32_t ms);
extern uint32_t __js_millis(void);
extern uint16_t __js_adc_read(uint8_t channel);
extern void putchar(char c);

void HAL_GPIO_WritePin(uint8_t pin, uint8_t state) {
    __js_gpio_write(pin, state);
}

uint8_t HAL_GPIO_ReadPin(uint8_t pin) {
    return __js_gpio_read(pin);
}

void HAL_Delay(uint32_t ms) {
    __js_delay_ms(ms);
}

uint32_t HAL_GetTick(void) {
    return __js_millis();
}

uint16_t HAL_ADC_Read(uint8_t channel) {
    return __js_adc_read(channel);
}

void HAL_UART_Transmit(const uint8_t *data, uint16_t len) {
    for (uint16_t i = 0; i < len; i++) {
        putchar((char)data[i]);
    }
}

void HAL_UART_TransmitString(const char *str) {
    while (*str) {
        putchar(*str++);
    }
}
