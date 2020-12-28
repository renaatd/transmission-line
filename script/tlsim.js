'use strict';
class TlSim {
    constructor() {
        this.log = function () { };
        this.Z0 = 50.0;
        this.Rg = 20.0;
        this.tRise = 1e-9;
        this.tPeriod = 20e-9;
        this.Rl = 1000;
        this.Cl = 5e-12;
        this.lineLength = 0.10;
        this.v = 2e8;
        this.ndz = 400;
        this.tStopSim = 100e-9;
        this.tStopWall = 10.0;
        this.generator = this.generator_step;
        this.updateLoad = this.updateLoadR;
        this.dz = -1;
        this.dt = -1;
        this.lUnit = -1;
        this.cUnit = -1;
        this.voltages = Array(0);
        this.currents = Array(0);
        this.currentLoad = -1;
        this.vGenPrev = -1;
        this.stepsDone = -1;
        this.noTimeSteps = -1;
        this.timeSteps = Array(0);
        this.terminalStepsDone = -1;
        this.timeStepsTerminal = Array(0);
        this.voltagesGeneratorTerminal = Array(0);
        this.voltagesLoadTerminal = Array(0);
        this.rhoGen = -1;
        this.rhoLoad = -1;
        this.initParameters();
    }
    initParameters() {
        this.lUnit = this.Z0 / this.v;
        this.cUnit = 1.0 / (this.Z0 * this.v);
        this.dz = this.lineLength / this.ndz;
        this.dt = this.dz / this.v;
        this.voltages = Array(this.ndz + 1).fill(0.0);
        this.currents = Array(this.ndz).fill(0.0);
        this.currentLoad = 0.0;
        this.vGenPrev = this.generator(0.0);
        this.stepsDone = 0;
        this.noTimeSteps = Math.floor(this.tStopSim / this.dt);
        this.timeSteps = Array(this.noTimeSteps);
        this.terminalStepsDone = 0;
        this.timeStepsTerminal = Array(TlSim.noTerminalVoltages);
        this.voltagesGeneratorTerminal = Array(TlSim.noTerminalVoltages);
        this.voltagesLoadTerminal = Array(TlSim.noTerminalVoltages);
        this.rhoGen = (this.Z0 == 0) ? NaN : (this.Rg - this.Z0) / (this.Rg + this.Z0);
        this.rhoLoad = (this.Z0 == 0) ? NaN : (this.Rl - this.Z0) / (this.Rl + this.Z0);
    }
    startSimulation() {
        this.initParameters();
        if (this.Z0 == 0) {
            this.log("Error: Z0 must be more than 0 Ohm.");
            return false;
        }
        this.log('Animation started');
        return true;
    }
    generator_step(simTime) {
        let relTimestamp = simTime % this.tPeriod;
        if (relTimestamp < this.tRise) {
            return relTimestamp / this.tRise;
        }
        else if (relTimestamp < this.tPeriod / 2.0) {
            return 1.0;
        }
        else if (relTimestamp < this.tPeriod / 2.0 + this.tRise) {
            relTimestamp = this.tPeriod / 2.0 + this.tRise - relTimestamp;
            return relTimestamp / this.tRise;
        }
        return 0.0;
    }
    generator_sine(simTime) {
        return Math.sin(2.0 * Math.PI * simTime / this.tPeriod);
    }
    set generatorIsSine(isSine) {
        this.generator = isSine ? this.generator_sine : this.generator_step;
    }
    updateLoadR() {
        let factor = this.dz / this.dt * this.Rl * this.cUnit;
        this.voltages[this.ndz] = ((factor - 1.0) * this.voltages[this.ndz]
            + 2.0 * this.Rl * this.currents[this.ndz - 1]) / (factor + 1.0);
    }
    updateLoadC() {
        let factor = this.dz / this.dt * this.cUnit + this.Cl / this.dt;
        let deltaVoltage = (2.0 * this.currents[this.ndz - 1] - this.currentLoad) / factor;
        this.voltages[this.ndz] += deltaVoltage;
        this.currentLoad = this.Cl / this.dt * deltaVoltage;
    }
    set loadIsR(isR) {
        this.updateLoad = isR ? this.updateLoadR : this.updateLoadC;
    }
    updateSimulation(timestamp_wall) {
        let stepsLimit = Math.floor(timestamp_wall / this.tStopWall * this.noTimeSteps);
        stepsLimit = Math.min(stepsLimit, this.noTimeSteps);
        for (; this.stepsDone < stepsLimit; this.stepsDone++) {
            const t_simulation = this.stepsDone * this.dt;
            this.timeSteps[this.stepsDone] = t_simulation;
            let vGenNow = this.generator(t_simulation);
            let vgenerator_sum = this.vGenPrev + vGenNow;
            let factor = this.dz / this.dt * this.Rg * this.cUnit;
            this.voltages[0] = ((factor - 1.0) * this.voltages[0]
                - 2.0 * this.Rg * this.currents[0]
                + vgenerator_sum) / (factor + 1.0);
            this.updateLoad();
            if (t_simulation >= this.terminalStepsDone * this.tStopSim / TlSim.noTerminalVoltages) {
                this.timeStepsTerminal[this.terminalStepsDone] = t_simulation;
                this.voltagesGeneratorTerminal[this.terminalStepsDone] = this.voltages[0];
                this.voltagesLoadTerminal[this.terminalStepsDone] = this.voltages[this.ndz];
                this.terminalStepsDone++;
            }
            factor = this.dt / (this.dz * this.cUnit);
            for (let i = 1; i < this.ndz; i++) {
                this.voltages[i] += factor * (this.currents[i - 1] - this.currents[i]);
            }
            factor = this.dt / (this.dz * this.lUnit);
            for (let i = 0; i < this.ndz; i++) {
                this.currents[i] += factor * (this.voltages[i] - this.voltages[i + 1]);
            }
            this.vGenPrev = vGenNow;
        }
    }
}
TlSim.noTerminalVoltages = 1000;
//# sourceMappingURL=tlsim.js.map