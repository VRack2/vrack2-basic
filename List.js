const { Device, Port, Rule } = require("vrack2-core");
const path = require("node:path");
const { readFileSync } = require("node:fs");

class List extends Device {
  /**
   * @description Преобразует числовое значение индекса в соответствующее ему значение из ассоциативного массива.
   *              Устройство принимает индекс, ищет ему соответствие в параметре `list` и отправляет найденное значение на выход.
   */

  description() {
    return readFileSync(path.join(__dirname, 'List.md')).toString('utf-8');
  }

  // --- Параметры устройства ---
  checkOptions() {
    return {
      list: Rule.object()
        .default({ 1: 'test' }) 
        .description('Ассоциативный объект, сопоставляющий числовые индексы с произвольными значениями')
        .example({ 
          1: '/metric/memory/max',
          2: '/metric/memory/avg',
          3: '/metric/memory/min'
        })
    };
  }

  // --- Входные порты ---
  inputs() {
    return {
      index: Port.standart()
        .description('Числовое значение индекса, используемое для поиска в списке'),
      gate: Port.standart()
        .description('Сигнальный вход, инициирующий поиск и отправку результата')
    };
  }

  // --- Выходные порты ---
  outputs() {
    return {
      value: Port.standart()
        .description('Выход для значения, найденного по индексу в списке'),
      gate: Port.standart()
        .description('Выход сигнала, указывающего на завершение поиска и отправку результата')
    };
  }

  // --- Инициализация внутреннего состояния ---
  unit = 0;

  // --- Обработчики входных портов ---
  inputIndex(data) {
    this.unit = data;
    // Если порт 'gate' не подключен, автоматически инициируем отправку
    if (!this.ports.output['gate'].connected) this._outGate(1);
  }

  inputGate(data) {
    this._outGate(data);
  }

  // --- Внутренний метод для отправки результата ---
  _outGate(data) {
    // Получаем значение из списка по сохраненному индексу
    // Если индекс отсутствует в списке, вернется undefined
    const resultValue = this.options.list[this.unit];
    // Отправляем найденное значение (или undefined) на выход 'value'
    this.ports.output['value'].push(resultValue);
    // Отправляем сигнал на выход 'gate'
    this.ports.output['gate'].push(data);
  }
}

module.exports = List;
