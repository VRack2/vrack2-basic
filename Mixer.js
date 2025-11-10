const { Device, Port, Rule } = require("vrack2-core");
const path = require("node:path");
const { readFileSync } = require("node:fs");

class Mixer extends Device {
  /**
   * @description Устройство-микшер для маршрутизации и объединения сигналов.
   *              Имеет настраиваемое количество обычных входов и FX-входов/выходов.
   *              Позволяет маршрутизировать сигналы с обычных входов на основной выход или на FX-выходы
   *              по заданным правилам маршрутизации.
   */

  // --- Метод для самодокументации ---
  description() {
    return readFileSync(path.join(__dirname, 'Mixer.md')).toString('utf-8');
  }

  // --- Параметры устройства ---
  checkOptions() {
    return {
      inputs: Rule.number().default(0).integer().min(0)
        .example(8)
        .description('Количество обычных входов mix%d'),
      inputsFX: Rule.number().default(0).integer().min(0)
        .example(8)
        .description('Количество FX входов fx%d.mix, fx%d.channel, fx%d.gate'),
      outputsFX: Rule.number().default(0).integer().min(0)
        .example(8)
        .description('Количество FX выходов fx%d.mix, fx%d.channel, fx%d.gate'),
      routes: Rule.object().default({})
        .example({ 2: 'fx1' })
        .description('Настройка маршрутизации: { "номер_обычного_входа": "название_выхода" | ["название_выхода", ...] }. "main" для основного выхода.')
    };
  }

  // --- Входные порты ---
  inputs() {
    return {
      // Динамические обычные входы mix%d
      'mix%d': Port.standart().dynamic(this.options.inputs)
        .description('Обычный вход для значения, маршрутизируемого по правилу routes'),
      // Динамические FX-входы
      'fx%d.mix': Port.standart().dynamic(this.options.inputsFX)
        .description('Вход значения для FX-группы'),
      'fx%d.channel': Port.standart().dynamic(this.options.inputsFX)
        .description('Вход номера канала для FX-группы'),
      'fx%d.gate': Port.standart().dynamic(this.options.inputsFX)
        .description('Сигнальный вход для FX-группы')
    };
  }

  // --- Выходные порты ---
  outputs() {
    return {
      // Основные выходы
      mixed: Port.standart()
        .description('Объединенный выход для основного сигнала'),
      channel: Port.standart()
        .description('Выход для номера канала основного сигнала'),
      gate: Port.standart()
        .description('Сигнальный выход для основного сигнала'),
      // Динамические FX-выходы
      'fx%d.mix': Port.standart().dynamic(this.options.outputsFX)
        .description('Выход значения для FX-группы'),
      'fx%d.channel': Port.standart().dynamic(this.options.outputsFX)
        .description('Выход номера канала для FX-группы'),
      'fx%d.gate': Port.standart().dynamic(this.options.outputsFX)
        .description('Сигнальный выход для FX-группы')
    };
  }

  // --- Инициализация внутреннего состояния ---
  FXUnits = {};
  FXChannels = {};

  // --- Метод жизненного цикла ---
  preProcess() {
    // --- Назначение обработчиков для обычных динамических входов mix%d ---
    for (let i = 1; i <= this.options.inputs; i++) {
      // Используем addInputHandler, как рекомендовано в документации
      this.addInputHandler(`mix${i}`, (data) => {
        // Логика маршрутизации из оригинального кода
        const route = this.options.routes[i];

        if (route === undefined) {
          this._outGate(i, data, 1);
          return
        }

        if (typeof route === 'string') {
          // Маршрут в одну цель
          if (route === 'main') this._outGate(i, data, 1);
          else this._outFX(route, i, data, 1);
        } else if (Array.isArray(route)) {
          // Маршрут в несколько целей
          for (const out of route) {
            if (out === 'main') this._outGate(i, data, 1);
            else this._outFX(out, i, data, 1);
          }
        }
      });
    }

    // --- Назначение обработчиков для FX-входов ---
    for (let i = 1; i <= this.options.inputsFX; i++) {
      // Используем addInputHandler для FX-входов
      this.addInputHandler(`fx${i}.mix`, (data) => {
        this.FXUnits[i] = data;
      });
      this.addInputHandler(`fx${i}.channel`, (data) => {
        this.FXChannels[i] = data;
      });
      this.addInputHandler(`fx${i}.gate`, (data) => {
        // gate может быть undefined, по умолчанию 1
        const gateData = (data !== undefined) ? data : 1;
        // Отправляем на основной выход, используя сохраненные значения
        this._outGate(this.FXChannels[i], this.FXUnits[i], gateData);
      });
    }
  }

  process() {
    // Проверка корректности маршрутов
    for (const indexStr in this.options.routes) {
      const index = parseInt(indexStr, 10);
      const route = this.options.routes[indexStr];

      // Проверяем, что индекс - это число и находится в диапазоне обычных входов
      if (isNaN(index) || index < 1 || index > this.options.inputs) {
        this.terminate(new Error(`Invalid route key (${indexStr} => ${route}) - index out of range or not a number`), "process");
      }

      // Проверяем, что маршрут - строка или массив строк
      let isValidRoute = false;
      if (typeof route === 'string') {
        isValidRoute = (route === 'main' || this._isValidFXOutputName(route));
      } else if (Array.isArray(route)) {
        isValidRoute = route.every(r => typeof r === 'string' && (r === 'main' || this._isValidFXOutputName(r)));
      }

      if (!isValidRoute) {
        this.terminate(new Error(`Invalid route value (${indexStr} => ${route}) - invalid output name or type`), "process");
      }

      // Проверяем подключение портов (для строковых маршрутов)
      if (typeof route === 'string' && route !== 'main') {
        const outputPortName = `${route}.mixed`;
        if (!this.ports.output[outputPortName]) {
          this.terminate(new Error(`Invalid route (${indexStr} => ${route}) - output port '${outputPortName}' does not exist`), 'process');
        }
      }
    }
  }

  // --- Внутренние методы ---
  _isValidFXOutputName(name) {
    // Проверяет, соответствует ли имя формату fx%d (где %d - число)
    const regex = /^fx\d+$/;
    return regex.test(name);
  }

  _outFX(fxName, channel, data, gate) {
    const mixPort = this.ports.output[`${fxName}.mix`];
    const channelPort = this.ports.output[`${fxName}.channel`];
    const gatePort = this.ports.output[`${fxName}.gate`];
    mixPort.push(data);
    channelPort.push(Number(channel));
    gatePort.push(gate);
  }

  _outGate(channel, data, gate) {
    this.ports.output['mixed'].push(data);
    this.ports.output['channel'].push(Number(channel));
    this.ports.output['gate'].push(gate);
  }
}

module.exports = Mixer;

