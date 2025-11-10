const { Device, Port, Rule } = require("vrack2-core");
const path = require("node:path");
const { readFileSync } = require("node:fs");

class Delay extends Device {

  description() {
    return readFileSync(path.join(__dirname, 'Delay.md')).toString('utf-8');
  }

  checkOptions() {
    return {
      timers: Rule.array()
        .default([{ timeout: 1000, relative: true }])
        .content(Rule.object().fields({
          timeout: Rule.number().integer().min(0).require(),
          relative: Rule.boolean().require()
        }))
        .description('Массив таймеров')
    };
  }

  inputs() {
    if (!this.options.timers) this.options.timers = []
    return {
      'gate%d': Port.standart().dynamic(this.options.timers.length)
        .description('Сигнальный вход')
    };
  }

  outputs() {
    if (!this.options.timers) this.options.timers = []
    return {
      'gate%d': Port.standart().dynamic(this.options.timers.length)
        .description('Сигнальный выход')
    };
  }

  shares = {
    timers: {}
  };

  timers = {};
  gates = {};

  preProcess() {
    for (let port = 1, index = 0; port <= this.options.timers.length; port++, index++) {
      this.shares.timers[port] = { timeout: false, gate: false };
      this.gates[port] = null;

      this.addInputHandler('gate' + port, (data) => {
        this.inputGate(data, port, index);
      });
    }
  }

  process() {
    for (let port = 1, index = 0; port <= this.options.timers.length; port++, index++) {
      if (this.options.timers[index].relative) {
        this.startTimer(port, index);
      }
    }
  }

  inputGate(data, port, index) {
    this.shares.timers[port].gate = true;
    this.gates[port] = data;

    if (this.timers[port]) return;

    if (this.options.timers[index].relative) {
      if (this.shares.timers[port].timeout) {
        this.outGate(port, index);
      }
    } else {
      this.startTimer(port, index);
    }

    this.render();
  }

  startTimer(port, index) {
    this.timers[port] = setTimeout(() => {
      this.shares.timers[port].timeout = true;

      if (this.options.timers[index].relative) {
        if (this.shares.timers[port].gate) {
          this.outGate(port, index);
        }
      } else {
        this.outGate(port, index);
      }

      this.timers[port] = false;
      this.render();
    }, this.options.timers[index].timeout);
  }

  outGate(port, index) {
    this.shares.timers[port].timeout = false;
    this.shares.timers[port].gate = false;

    if (this.ports.output['gate' + port].connected) {
      this.ports.output['gate' + port].push(this.gates[port]);
    }

    if (this.options.timers[index].relative) {
      this.startTimer(port, index);
    }

    this.render();
  }
};

module.exports = Delay