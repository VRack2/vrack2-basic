const { Device, Port, Rule } = require("vrack2-core");

class Unmixer extends Device {
  /**
   * @description Устройство-демикшер для разделения объединенного сигнала на отдельные каналы.
   *              Принимает объединенный сигнал и распределяет его по отдельным выходам
   *              в зависимости от номера канала.
   */

  // --- Параметры устройства ---
  checkOptions() {
    return {
      outputs: Rule.number().default(8).integer().min(1).max(64)
        .example(8)
        .description('Количество выходных каналов mix%d')
    };
  }

  // --- Входные порты ---
  inputs() {
    return {
      mixed: Port.standart()
        .description('Вход объединенного сигнала'),
      channel: Port.standart()
        .description('Вход номера канала для распределения'),
      gate: Port.standart()
        .description('Сигнальный вход для активации распределения')
    };
  }

  // --- Выходные порты ---
  outputs() {
    return {
      // Динамические выходы для отдельных каналов
      'mix%d': Port.standart().dynamic(this.options.outputs)
        .description('Выход для отдельного канала')
    };
  }

  // --- Инициализация ---
  preProcess() {
    // Обработчики для входных портов
    this.addInputHandler('mixed', (data) => {
      this.lastMixedValue = data;
    });

    this.addInputHandler('channel', (data) => {
      this.lastChannel = data;
    });

    this.addInputHandler('gate', (data) => {
      this.processUnmix(data);
    });
  }

  process() {
    this.lastMixedValue = null;
    this.lastChannel = null;
  }

  // --- Основная логика демикшера ---
  processUnmix() {
    // Если нет данных о канале или значении - выходим
    if (this.lastChannel === null || this.lastChannel === undefined || 
        this.lastMixedValue === null || this.lastMixedValue === undefined) {
      return;
    }

    const channel = Number(this.lastChannel);
    
    // Проверяем, что канал в допустимом диапазоне
    if (channel < 1 || channel > this.options.outputs) {
      this.notify(`Канал ${channel} вне диапазона 1-${this.options.outputs}`);
      return;
    }

    // Отправляем значение только на соответствующий канал
    const outputPortName = `mix${channel}`;
    
    this.ports.output[outputPortName].push(this.lastMixedValue);

    // Сбрасываем значения после обработки
    this.lastMixedValue = null;
    this.lastChannel = null;
  }
}

module.exports = Unmixer;