#ifndef MOCK_HAL_H
#define MOCK_HAL_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* GPIO Functions */
void HAL_GPIO_WritePin(uint8_t pin, uint8_t state);
uint8_t HAL_GPIO_ReadPin(uint8_t pin);

/* Timing Functions */
void HAL_Delay(uint32_t ms);
uint32_t HAL_GetTick(void);

/* Analog Functions */
uint16_t HAL_ADC_Read(uint8_t channel);

/* Serial / UART Functions */
void HAL_UART_Transmit(const uint8_t *data, uint16_t len);
void HAL_UART_TransmitString(const char *str);

#ifdef __cplusplus
}
#endif

#endif /* MOCK_HAL_H */
