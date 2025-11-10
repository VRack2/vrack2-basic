const { readFileSync } = require("node:fs");
const path = require("node:path");
const { Device, Port, Rule } = require("vrack2-core");

class Aggregate extends Device {
  /**
   * @description Формирует максимальное, минимальное и среднее значение на основе буфера семплов.
   *              Устройство агрегирует данные по каналам, накапливая определенное количество значений
   *              и вычисляя статистику по завершении цикла агрегации.
   */

  description(){
    return readFileSync(path.join(__dirname, 'Aggregate.md')).toString('utf-8')
  }

  // --- Параметры устройства ---
  checkOptions() {
    return {
      samples: Rule.number().default(32).integer().min(1)
        .description('Количество семплов, на основе которых вычисляется статистика'),
      cyclicBuffer: Rule.boolean().default(false)
        .description('true - перезаписывает значения в буфере по кругу, false - ждет полного накопления буфера перед вычислением')
    };
  }

  // --- Входные порты ---
  inputs() {
    return {
      unit: Port.standart()
        .description('Вход для числового значения, подлежащего агрегации'),
      channel: Port.standart()
        .description('Вход для идентификатора канала, по которому происходит агрегация'),
      gate: Port.standart()
        .description('Сигнальный вход, инициирующий вычисление и отправку результатов')
    };
  }

  // --- Выходные порты ---
  outputs() {
    return {
      max: Port.standart()
        .description('Выход для максимального значения из буфера'),
      min: Port.standart()
        .description('Выход для минимального значения из буфера'),
      avg: Port.standart()
        .description('Выход для среднего значения из буфера'),
      channel: Port.standart() 
        .description('Выход для идентификатора канала, по которому были вычислены результаты'),
      gate: Port.standart()
        .description('Выход сигнала, указывающего на завершение цикла агрегации и отправку результатов')
    };
  }

  // --- Инициализация внутреннего состояния ---
  buffer = {};
  index = {};
  currentChannel = 1;
  currentUnit = 0;

  // --- Обработчики входных портов ---
  inputUnit(data) {
    this.currentUnit = data;
    // Если порт 'gate' не подключен, автоматически инициируем вычисление
    if (!this.ports.output['gate'].connected) {
      this.inputGate(1);
    }
  }

  inputChannel(data) {
    this.currentChannel = data;
  }

  inputGate(data) {
    if (data === undefined) data = 1;

    // Инициализируем буфер для канала, если он еще не существует
    if (!this.buffer[this.currentChannel]) {
      this.buffer[this.currentChannel] = [];
      this.index[this.currentChannel] = 0;
    }

    if (this.options.cyclicBuffer) {
      // Режим циклического буфера
      this.buffer[this.currentChannel].push(this.currentUnit);
      if (this.buffer[this.currentChannel].length > this.options.samples) {
        this.buffer[this.currentChannel].shift(); // Удаляем самый старый элемент
      }
      // Отправляем результат сразу после добавления, если буфер полон
      if (this.buffer[this.currentChannel].length === this.options.samples) {
        this._sendResults(data);
      }
    } else {
      // Режим ожидания накопления
      this.index[this.currentChannel]++;
      this.buffer[this.currentChannel].push(this.currentUnit);
      if (this.index[this.currentChannel] >= this.options.samples) {
        this._sendResults(data);
        // Сбрасываем буфер и индекс для следующего цикла
        this.buffer[this.currentChannel] = [];
        this.index[this.currentChannel] = 0;
      }
    }
  }

  // --- Внутренний метод для вычисления и отправки результатов ---
  _sendResults(data) {
    const channelBuffer = this.buffer[this.currentChannel];

    if (channelBuffer.length === 0) return; // Защита от деления на 0 и пустого массива

    // Вычисления производятся ТОЛЬКО если соответствующий выход подключен
    if (this.ports.output['max'].connected) {
      const max = Math.max(...channelBuffer);
      this.ports.output['max'].push(max);
    }
    if (this.ports.output['min'].connected) {
      const min = Math.min(...channelBuffer);
      this.ports.output['min'].push(min);
    }
    if (this.ports.output['avg'].connected) {
      const avg = channelBuffer.reduce((sum, val) => sum + val, 0) / channelBuffer.length;
      this.ports.output['avg'].push(avg);
    }

    // Отправка канала и сигнала всегда, если подключены
    if (this.ports.output['channel'].connected) this.ports.output['channel'].push(this.currentChannel);
    if (this.ports.output['gate'].connected) this.ports.output['gate'].push(data);
    
  }
}

module.exports = Aggregate;
// --- Конец файла ---