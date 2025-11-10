const { Device, Port, Rule } = require("vrack2-core");
const path = require("node:path");
const { readFileSync } = require("node:fs");

class Uniselector extends Device {
  /**
   * @description Последовательный переключатель. Устройство по получении сигнала на вход gate
   *              последовательно переключает активный выход, отправляя сигнал на один из N выходов gate1, gate2, ...
   *              Поддерживает остановку, запуск, сброс индекса и различные стратегии поведения при достижении конца.
   */

  // --- Метод для самодокументации ---
  description() {
    return readFileSync(path.join(__dirname, 'Uniselector.md')).toString('utf-8');
  }

  // --- Параметры устройства ---
  checkOptions() {
    return {
      doOnEnd: Rule.string().default('reset').enum(['reset', 'nothing', 'reverse'])
        .description('Действие после достижения последнего выхода: `reset` - вернуться к первому, `nothing` - остановиться, `reverse` - инвертировать направление'),
      outputs: Rule.number().default(16).integer().min(0) // Позволим 0 как крайний случай
        .description('Количество динамических выходов переключателя (gate1, gate2, ..., gateN)'),
      start: Rule.boolean().default(true)
        .description('Если true, переключатель начинает работу сразу после запуска'),
      resetSignal: Rule.boolean().default(true)
        .description('Если true, сигнал на входе `reset` также генерирует сигнал на текущем активном выходе')
    };
  }

  // --- Входные порты ---
  inputs() {
    return {
      gate: Port.standart()
        .description('Сигнальный вход для инициации переключения на следующий выход'),
      start: Port.standart()
        .description('Вход для возобновления работы переключателя'),
      stop: Port.standart()
        .description('Вход для остановки работы переключателя'),
      reset: Port.standart()
        .description('Вход для сброса индекса переключения к первому выходу')
    };
  }

  // --- Выходные порты ---
  outputs() {
    // Возвращаем динамические порты gate%d, где %d будет заменен на номер от 1 до this.options.outputs
    // Ключ порта 'gate%d' определяет маску, dynamic(this.options.outputs) указывает количество
    return {
      'gate%d': Port.standart().dynamic(this.options.outputs)
        .description('Динамический сигнальный выход переключателя')
    };
  }

  // --- Инициализация внутреннего состояния ---
  shares = {
    index: 1,
    action: false,
    reverse: false
  };

  // --- Метод жизненного цикла ---
  process() {
    if (this.options.start) {
      this.shares.action = true;
    }
    // Устанавливаем интервал для периодического обновления shares
    setInterval(() => {
      this.render();
    }, 5000);
  }

  // --- Метод для определения следующего индекса ---
  _incrementIndex() {
    if (this.shares.reverse) {
      if (this.shares.index === 1) {
        // Достигли начала в обратном направлении, меняем направление и шагаем вперед
        this.shares.reverse = false;
        this.shares.index = 2; // Шагаем к следующему, если outputs > 1
        // Если outputs = 1, останется на 1
        if (this.shares.index > this.options.outputs && this.options.outputs > 0) {
           this.shares.index = 1; // Защита если outputs = 1
        }
      } else {
        this.shares.index--;
      }
    } else {
      if (this.shares.index === this.options.outputs) {
        // Достигли конца
        switch (this.options.doOnEnd) {
          case 'reset':
            this.shares.index = 1;
            break;
          case 'nothing':
            // Индекс остается на последнем, действие останавливается
            this.shares.action = false;
            break;
          case 'reverse':
            this.shares.reverse = true;
            // Шагаем назад, если возможно
            if (this.options.outputs > 1) {
              this.shares.index--;
            }
            break;
          default:
            // На всякий случай, если enum сломается
            this.shares.index = 1;
        }
      } else {
        // Просто шагаем вперед
        this.shares.index++;
      }
    }
  }

  // --- Обработчики входных портов ---
  inputGate(data) {
    if (this.shares.action && this.options.outputs > 0) { // Проверяем, что.outputs > 0
      this._incrementIndex();
      this._outGate(data);
    }
  }

  inputStop() {
    this.shares.action = false;
    this.render();
  }

  inputStart() {
    this.shares.action = true;
    this.render();
  }

  inputReset() {
    this.shares.index = 1;
    this.shares.reverse = false;
    if (this.options.resetSignal && this.options.outputs > 0) {
      this._outGate(); // Отправляем сигнал при сбросе
    } else {
      this.render(); // Обновляем shares
    }
  }

  // --- Внутренний метод для отправки сигнала на активный выход ---
  _outGate(data = 1) { // Значение по умолчанию для сброса
    // Имя выхода формируется как gate + индекс
    const outputName = 'gate' + this.shares.index;
    // Проверяем, существует ли такой динамический выход и подключен ли он
    if (this.ports.output[outputName] && this.ports.output[outputName].connected) {
      this.ports.output[outputName].push(data);
    }
    this.render(); // Обновляем shares
  }
}

module.exports = Uniselector;
