const { Device, Port, Rule } = require("vrack2-core");
const path = require("node:path");
const { readFileSync } = require("node:fs");

class ChannelFilter extends Device {
  /**
   * @description Устройство для фильтрации данных на основе идентификатора канала.
   *              Устройство пропускает данные только с разрешенных каналов (если список include задан)
   *              или блокирует данные с запрещенных каналов (если список except задан).
   */

  description() {
    return readFileSync(path.join(__dirname, 'ChannelFilter.md')).toString('utf-8');
  }

  // --- Параметры устройства ---
  checkOptions() {
    return {
      include: Rule.array().default([]).content(Rule.any())
        .example([1, 2, 3, 4, 5])
        .description('Список разрешенных идентификаторов каналов. Если список пуст, фильтрация по нему не производится.'),
      except: Rule.array().default([]).content(Rule.any())
        .description('Список запрещенных идентификаторов каналов. Если список пуст, фильтрация по нему не производится.')
    };
  }

  // --- Входные порты ---
  inputs() {
    return {
      unit: Port.standart()
        .description('Вход для значения, которое будет фильтроваться'),
      channel: Port.standart()
        .description('Вход для идентификатора канала, по которому будет производиться фильтрация'),
      gate: Port.standart()
        .description('Сигнальный вход, инициирующий проверку и возможную отправку результата')
    };
  }

  // --- Выходные порты ---
  outputs() {
    return {
      unit: Port.standart()
        .description('Выход для отправки значения, если канал прошел фильтрацию'),
      channel: Port.standart()
        .description('Выход для отправки идентификатора канала, если он прошел фильтрацию'),
      gate: Port.standart()
        .description('Выход для отправки сигнала, если канал прошел фильтрацию')
    };
  }

  // --- Инициализация внутреннего состояния ---
  unit = 0;
  channel = 1; // Инициализируем значение по умолчанию

  // --- Обработчики входных портов ---
  inputUnit(data) {
    this.unit = data;
  }

  inputChannel(data) {
    this.channel = data;
  }

  inputGate(data) {
    this._outGate(data);
  }

  // --- Внутренний метод для проверки и отправки ---
  _outGate(data) {
    const channel = this.channel;
    const includeList = this.options.include;
    const exceptList = this.options.except;

    // Проверяем, разрешен ли канал
    // Если список include не пуст и канал не в нем, блокируем
    const isIncludeListActive = includeList.length > 0;
    const isChannelIncluded = includeList.includes(channel);

    // Проверяем, запрещен ли канал
    // Если список except не пуст и канал в нем, блокируем
    const isChannelExcluded = exceptList.length > 0 && exceptList.includes(channel);

    // Логика фильтрации: блокировать, если (активен список include И канал не в нем) ИЛИ (канал в списке except)
    if ((isIncludeListActive && !isChannelIncluded) || isChannelExcluded) {
      return; // Канал не прошел фильтрацию
    }

    // Отправляем данные на выходы, если они подключены
    this.ports.output['unit'].push(this.unit);
    this.ports.output['channel'].push(channel);
    this.ports.output['gate'].push(data);
  }
}

module.exports = ChannelFilter;
