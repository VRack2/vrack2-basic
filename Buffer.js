const { readFileSync } = require("node:fs");
const path = require("node:path");
const { Device, Port, Rule } = require("vrack2-core");

class Buffer extends Device {
  /**
   * @description Устройство для буферизации сущностей (любых значений) в виде массива.
   *              Позволяет добавлять сущности, удалять старые (shift) и извлекать срез (slice) из начала буфера.
   */

  description(){
    return readFileSync(path.join(__dirname, 'Buffer.md')).toString('utf-8')
  }

  // --- Входные порты ---
  inputs() {
    return {
      entity: Port.standart()
        .description('Вход для добавления новой сущности в буфер'),
      shift: Port.standart()
        .description('Вход для указания количества элементов, которые нужно удалить из начала буфера'),
      slice: Port.standart()
        .description('Вход для указания количества элементов, которые нужно получить из начала буфера')
    };
  }

  // --- Выходные порты ---
  outputs() {
    return {
      entities: Port.standart()
        .description('Выход для массива значений, извлечённых из начала буфера командой slice')
    };
  }

  // --- Инициализация внутреннего состояния ---
  shares = { bufferCount: 0 };
  buffer = [];

  // --- Обработчики входных портов ---
  inputEntity(data) {
    this.buffer.push(data);
    this.updateBufferCount();
  }

  inputShift(count) {
    if (typeof count === 'number' && count > 0) {
      this.buffer.splice(0, Math.floor(count)); // Удаляем count элементов с начала
      this.updateBufferCount();
    }
  }

  inputSlice(count) {
    if (typeof count === 'number' && count > 0) {
      const actualCount = Math.min(count, this.buffer.length); // Ограничиваем длиной буфера
      const result = this.buffer.slice(0, actualCount);
      if (this.ports.output['entities'].connected) {
        this.ports.output['entities'].push(result);
      }
    }
  }

  // --- Внутренний метод для обновления счетчика и отправки shares ---
  updateBufferCount() {
    this.shares.bufferCount = this.buffer.length;
    this.render();
  }

  // --- Жизненный цикл ---
  process() {
    // Устанавливаем таймер для периодического обновления shares, как в оригинале
    setTimeout(() => {
      this.render();
    }, 1000);
  }
}

module.exports = Buffer;