// --- devices/vendor/GenerateData.js ---
const { Device, Port, Rule } = require("vrack2-core");
const path = require("node:path");
const { readFileSync } = require("node:fs");

class GenerateData extends Device {
  /**
   * @description Устройство для генерации последовательности данных по заданному расписанию.
   *              Устройство получает массив данных с указанием значений и задержек.
   *              По команде (start) начинает отправлять значения на выход `unit` с заданными интервалами.
   *              Поддерживает остановку (stop) и сброс (reset) к начальному состоянию.
   */

  description() {
    return readFileSync(path.join(__dirname, 'GenerateData.md')).toString('utf-8');
  }

  // --- Параметры устройства ---
  checkOptions() {
    return {
      data: Rule.array()
        .require() // Поле обязательно
        .content(Rule.object().fields({
          value: Rule.any().require().description('Значение, которое будет отправлено'),
          timeout: Rule.number().require().integer().min(0).description('Задержка в миллисекундах перед отправкой следующего значения')
        }))
        .example([
          { value: 1, timeout: 1000 },
          { value: 2, timeout: 2000 },
          { value: 3, timeout: 1000 }
        ])
        .description('Массив объектов, каждый из которых содержит `value` (данные для отправки) и `timeout` (задержка в мс)'),
      autoStart: Rule.boolean().default(true)
        .description('Если true, устройство начинает работу сразу после запуска'),
      doOnEnd: Rule.string().default('reset')
        .description('Действие после достижения конца массива данных: `reset` - вернуться к началу, `nothing` - остановиться')
    };
  }

  // --- Входные порты ---
  inputs() {
    return {
      start: Port.standart()
        .description('Вход для сигнала запуска или продолжения генерации данных'),
      stop: Port.standart()
        .description('Вход для сигнала остановки генерации данных'),
      reset: Port.standart()
        .description('Вход для сигнала сброса состояния генерации к начальному (индекс 0)')
    };
  }

  // --- Выходные порты ---
  outputs() {
    return {
      unit: Port.standart()
        .description('Выход для отправки данных из массива `data`')
    };
  }

  // --- Инициализация внутреннего состояния ---
  shares = {
    start: false,
    index: 0
  };
  queueTimer = false;

  // --- Метод жизненного цикла ---
  process() {
    if (this.options.autoStart) {
      this.inputStart();
    }
    // Устанавливаем интервал для периодического обновления shares
    setInterval(() => {
      this.render();
    }, 3000);
  }

  // --- Обработчики входных портов ---
  inputStart() {
    if (this.shares.start) return; // Уже запущено
    this.shares.start = true;
    this._run();
  }

  inputStop() {
    if (!this.shares.start) return; // Не запущено
    if (this.queueTimer) {
      clearTimeout(this.queueTimer);
      this.queueTimer = false;
    }
    this.shares.start = false;
    this.render(); // Обновляем shares
  }

  inputReset() {
    if (this.queueTimer) {
      clearTimeout(this.queueTimer);
      this.queueTimer = false;
    }
    this.shares.index = 0;
    this.shares.start = false; // Сброс не запускает автоматически, но inputStart это делает
    this.inputStart(); // Сразу запускаем после сброса
  }

  // --- Внутренние методы ---
  _queueNext() {
    this.shares.index++;
    if (this.shares.index === this.options.data.length) {
      this.shares.index = 0; // Сброс индекса
      if (this.options.doOnEnd === 'nothing') {
        this.queueTimer = false;
        this.shares.start = false;
        this.render(); // Обновляем shares
        return; // Завершаем цикл
      }
    }
    this._run(); // Продолжаем цикл
    this.render(); // Обновляем shares
  }

  _run() {
    if (!this.shares.start) return; // Защита на случай, если stop был вызван между _queueNext и _run

    const currentData = this.options.data[this.shares.index];
    // Проверяем, что элемент массива валиден (на всякий случай)
    if (currentData && currentData.value !== undefined && typeof currentData.timeout === 'number') {
      // Очищаем предыдущий таймер, если он был
      if (this.queueTimer) {
        clearTimeout(this.queueTimer);
      }
      // Устанавливаем новый таймер
      this.queueTimer = setTimeout(() => {
        if (this.ports.output['unit'].connected) {
          this.ports.output['unit'].push(currentData.value);
        }
        this._queueNext();
      }, currentData.timeout);
    } else {
      // Логическая ошибка в данных, останавливаем устройство
      this.error(`Некорректные данные в массиве 'data' на индексе ${this.shares.index}`);
      this.inputStop();
    }
  }
}

module.exports = GenerateData;
// --- Конец файла ---