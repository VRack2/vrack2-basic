const { Device, Port, Rule } = require("vrack2-core");
const path = require("node:path");
const { readFileSync } = require("node:fs");

class Differ extends Device {
  /**
   * @description Устройство для обнаружения изменений значения на входе.
   *              Сравнивает новое значение с последним сохраненным для конкретного канала.
   *              Если значение изменилось, отправляет новое значение, канал и сигнал на соответствующие выходы.
   */

  description() {
    return readFileSync(path.join(__dirname, 'Differ.md')).toString('utf-8');
  }

  // --- Входные порты ---
  inputs() {
    return {
      unit: Port.standart()
        .description('Вход для значения, которое будет сравниваться'),
      channel: Port.standart()
        .description('Вход для идентификатора канала, по которому отслеживается изменение'),
      gate: Port.standart()
        .description('Сигнальный вход, инициирующий проверку и возможную отправку результата')
    };
  }

  // --- Выходные порты ---
  outputs() {
    return {
      unit: Port.standart()
        .description('Выход для отправки нового значения, если оно отличается от предыдущего'),
      channel: Port.standart()
        .description('Выход для отправки идентификатора канала, в котором произошло изменение'),
      gate: Port.standart()
        .description('Выход для отправки сигнала, если произошло изменение')
    };
  }

  // --- Инициализация внутреннего состояния ---
  channel = 1;
  unit = 0;
  state = {};

  // --- Обработчики входных портов ---
  inputUnit(data) {
    this.unit = data;
    // Если порт 'gate' не подключен, автоматически инициируем проверку
    if (!this.ports.output['gate'].connected) this.inputGate(1);
  }

  inputChannel(data) {
    this.channel = data;
  }

  inputGate(data) {
    this._outGate(data);
  }

  // --- Внутренний метод для проверки и отправки ---
  _outGate(data) {
    const currentChannel = this.channel;
    // Инициализируем состояние для канала, если его еще не было
    if (this.state[currentChannel] === undefined) this.state[currentChannel] = this.unit;
    
    // Если значение не изменилось, выходим
    if (this.state[currentChannel] === this.unit) return;
    // Обновляем сохраненное значение
    this.state[currentChannel] = this.unit;
    // Отправляем новые значения на выходы, если они подключены
    this.ports.output['unit'].push(this.state[currentChannel]);    
    this.ports.output['channel'].push(currentChannel);
    this.ports.output['gate'].push(data);
  }
}

module.exports = Differ;