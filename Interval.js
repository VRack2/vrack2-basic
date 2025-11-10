const { Device, Port, Rule } = require("vrack2-core");
const path = require("node:path");
const { readFileSync } = require("node:fs");

class Interval extends Device {
  /**
   * @description Устройство для генерации регулярных сигналов с заданным интервалом.
   *              Устройство может быть запущено и остановлено через соответствующие входы.
   */

  description() {
    return readFileSync(path.join(__dirname, 'Interval.md')).toString('utf-8');
  }

  // --- Параметры устройства ---
  checkOptions() {
    return {
      timeout: Rule.number().require().integer().min(1).default(1000)
        .description('Интервал в миллисекундах между сигналами'),
      start: Rule.boolean().require().default(true)
        .description('Если true, устройство начинает генерацию сигналов сразу после запуска')
    };
  }

  // --- Входные порты ---
  inputs() {
    return {
      start: Port.standart()
        .description('Вход для сигнала запуска генерации сигналов'),
      stop: Port.standart()
        .description('Вход для сигнала остановки генерации сигналов')
    };
  }

  // --- Выходные порты ---
  outputs() {
    return {
      gate: Port.standart()
        .description('Выход для отправки регулярного сигнала')
    };
  }

  // --- Инициализация внутреннего состояния ---
  timer = false;

  // --- Метод жизненного цикла ---
  process() {
    if (this.options.start === true) this.inputStart();
  }

  _startTimer() {
    if (this.timer === false) {
      // Используем this.options.timeout
      this.timer = setInterval(() => {
        this.ports.output['gate'].push(1);
      }, this.options.timeout);
    }
  }

  inputStart() { this._startTimer(); }

  inputStop() {
    if (this.timer === false) return
    clearInterval(this.timer);
    this.timer = false;
  }
}

module.exports = Interval;
