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
        this.generate = this.generateStep;
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
        this.vGenPrev = this.generate(0.0);
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
    generateStep(simTime) {
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
    generateSine(simTime) {
        return Math.sin(2.0 * Math.PI * simTime / this.tPeriod);
    }
    set generatorIsSine(isSine) {
        this.generate = isSine ? this.generateSine : this.generateStep;
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
            let vGenNow = this.generate(t_simulation);
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
function roundX(x) {
    return Math.round((x + Number.EPSILON) * 1000) / 1000;
}
let model = new TlSim();
model.log = uiLogMessage;
let chartWave;
let chartWaveData;
let chartTerminals;
let chartTerminalsDataGenerator;
let chartTerminalsDataLoad;
let startTimeAnimation;
let frameCount;
function uiLogMessage(message) {
    app.$refs.logging.innerHTML += `${message}<BR>`;
}
function uiResetLog() {
    app.$refs.logging.innerHTML = "";
}
function uiInitChart() {
    let chartColors = {
        red: 'rgb(255, 0, 0)',
        orange: 'rgb(255, 159, 64)',
        yellow: 'rgb(255, 205, 86)',
        green: 'rgb(0, 128, 0)',
        blue: 'rgb(0, 0, 255)',
        purple: 'rgb(153, 102, 255)',
        grey: 'rgb(201, 203, 207)'
    };
    var ctxWave = document.getElementById('chart_wave').getContext('2d');
    chartWaveData = [{ x: 0, y: 0.0 }, { x: model.lineLength, y: 0.0 }];
    chartWave = new Chart(ctxWave, {
        type: 'line',
        data: {
            datasets: [{
                    borderColor: chartColors.blue,
                    data: chartWaveData,
                    pointStyle: 'line'
                }]
        },
        options: {
            title: {
                display: true,
                text: 'Voltage on transmission line',
            },
            tooltips: {
                enabled: false
            },
            legend: {
                display: false
            },
            elements: {
                line: {
                    fill: false,
                    tension: 0
                }
            },
            scales: {
                xAxes: [{ type: 'linear', ticks: { min: 0, max: model.lineLength, minRotation: 0, maxRotation: 0 }, scaleLabel: { display: true, labelString: "length (m)" } }],
                yAxes: [{ type: 'linear', ticks: { min: -1.0, max: 2.0 } }]
            },
            animation: {
                duration: 0
            },
            hover: {
                animationDuration: 0
            },
            responsiveAnimationDuration: 0
        }
    });
    var ctx_terminals = document.getElementById('chart_terminals').getContext('2d');
    chartTerminalsDataGenerator = [{ x: 0, y: 0.0 }, { x: roundX(model.tStopSim * 1e9), y: 0.0 }];
    chartTerminalsDataLoad = [{ x: 0, y: 0.0 }, { x: roundX(model.tStopSim * 1e9), y: 0.0 }];
    chartTerminals = new Chart(ctx_terminals, {
        type: 'line',
        data: {
            datasets: [
                { label: 'Generator', borderColor: chartColors.blue, data: chartTerminalsDataGenerator, pointStyle: 'line' },
                { label: 'Load', borderColor: chartColors.red, data: chartTerminalsDataLoad, pointStyle: 'line' }
            ]
        },
        options: {
            title: {
                display: true,
                text: 'Terminal voltages',
            },
            tooltips: {
                enabled: false
            },
            legend: {
                label: { fontSize: 10 }
            },
            elements: {
                line: {
                    fill: false,
                    tension: 0
                }
            },
            scales: {
                xAxes: [{
                        type: 'linear',
                        ticks: { min: 0, suggestedMax: roundX(model.tStopSim * 1e9), minRotation: 0, maxRotation: 0, precision: 2 },
                        scaleLabel: { display: true, labelString: 'time (ns)' }
                    }
                ],
                yAxes: [{ type: 'linear', ticks: { suggestedMin: -0.5, suggestedMax: 1.5 } }]
            },
            animation: {
                duration: 0
            },
            hover: {
                animationDuration: 0
            },
            responsiveAnimationDuration: 0
        }
    });
}
function uiUpdateWaveChart() {
    for (let i = 0; i <= model.ndz; i++) {
        chartWaveData[i].y = model.voltages[i];
    }
    chartWave.update(0);
}
function uiUpdateTerminalsChart() {
    chartTerminalsDataGenerator.length = 0;
    chartTerminalsDataLoad.length = 0;
    for (let i = 0; i <= model.terminalStepsDone; i++) {
        chartTerminalsDataGenerator.push({ x: roundX(model.timeStepsTerminal[i] * 1e9), y: model.voltagesGeneratorTerminal[i] });
        chartTerminalsDataLoad.push({ x: roundX(model.timeStepsTerminal[i] * 1e9), y: model.voltagesLoadTerminal[i] });
    }
    chartTerminals.update(0);
}
function uiRescaleCharts() {
    chartWaveData.length = 0;
    for (let i = 0; i <= model.ndz; i++) {
        chartWaveData.push({ x: i * model.lineLength / model.ndz, y: 0.0 });
    }
    chartWave.options.scales.xAxes[0].ticks.max = model.lineLength;
    chartWave.update(0);
    chartTerminalsDataGenerator.length = 0;
    chartTerminalsDataLoad.length = 0;
    chartTerminals.options.scales.xAxes[0].ticks.suggestedMax = roundX(model.tStopSim * 1e9);
    chartTerminals.update(0);
}
function uiStartAnimation() {
    uiResetLog();
    startTimeAnimation = undefined;
    frameCount = 0;
    if (!app.animationIsRunning) {
        window.requestAnimationFrame(uiAnimationStep);
    }
}
function uiAnimationStep(timestamp) {
    let elapsedWall;
    if (startTimeAnimation == undefined) {
        startTimeAnimation = timestamp;
        elapsedWall = 0;
        app.animationIsRunning = model.startSimulation();
        uiRescaleCharts();
    }
    else {
        elapsedWall = (timestamp - startTimeAnimation) / 1000.0;
        if (app.animationIsRunning) {
            model.updateSimulation(elapsedWall);
        }
        if (elapsedWall > model.tStopWall) {
            app.animationIsRunning = false;
        }
        frameCount++;
    }
    uiUpdateWaveChart();
    if (app.animationIsRunning) {
        window.requestAnimationFrame(uiAnimationStep);
    }
    else {
        uiUpdateTerminalsChart();
        uiLogMessage(`Animation stopped after ${elapsedWall.toFixed(1)} s.`);
        let frameRateFps = frameCount / elapsedWall;
        uiLogMessage(`Frame rate: ${frameRateFps.toFixed(1)} fps`);
    }
}
function uiShowFinal() {
    uiResetLog();
    if (app.animationIsRunning) {
        uiLogMessage("Error: request to show final results while animation is running");
        return;
    }
    const t0 = performance.now();
    model.startSimulation();
    model.updateSimulation(model.tStopWall + 1);
    const t1 = performance.now();
    uiRescaleCharts();
    uiUpdateWaveChart();
    uiUpdateTerminalsChart();
    uiLogMessage(`Elapsed time for calculating final results: ${model.stepsDone} steps in ${(t1 - t0).toFixed(1)} ms`);
}
var appClass = Vue.extend({
    mounted: function () {
        this.updateParameters();
        uiInitChart();
    },
    data: function () {
        return {
            Z0: 50,
            generatorType: "sine",
            Rg: 20,
            tRise: 1,
            tPeriod: 20,
            loadType: "R",
            Rload: 1000,
            Cload: 5,
            length: 10.0,
            v: 2,
            ndz: 400,
            tStopSim: 100,
            tStopWall: 15,
            lUnit: 0,
            cUnit: 0,
            tProp: 0,
            tStep: 0,
            nStep: 0,
            rhoGen: -2,
            rhoLoad: -2,
            animationIsRunning: false
        };
    },
    computed: {
        paramsBroken: function () {
            const isPositive = (currentValue) => typeof currentValue === "number" && currentValue >= 0;
            const params = [this.Z0, this.Rg, this.tRise, this.tPeriod, this.Rload, this.Cload,
                this.length, this.v, this.ndz, this.tStopSim, this.tStopWall];
            return !params.every(isPositive) || this.ndz < 1 || this.length <= 0.0;
        }
    },
    watch: {
        Z0: function (val) { this.updateParameters(); },
        generatorType: function (val) { this.updateParameters(); },
        Rg: function (val) { this.updateParameters(); },
        tRise: function (val) { this.updateParameters(); },
        tPeriod: function (val) { this.updateParameters(); },
        loadType: function (val) { this.updateParameters(); },
        Rload: function (val) { this.updateParameters(); },
        Cload: function (val) { this.updateParameters(); },
        length: function (val) { this.updateParameters(); },
        v: function (val) { this.updateParameters(); },
        ndz: function (val) { this.updateParameters(); },
        tStopSim: function (val) { this.updateParameters(); },
        tStopWall: function (val) { this.updateParameters(); },
    },
    methods: {
        startAnimation: function () { uiStartAnimation(); },
        stopAnimation: function () { this.animationIsRunning = false; },
        showFinal: function () { uiShowFinal(); },
        updateParameters: function () {
            if (this.animationIsRunning) {
                uiLogMessage("Stopping animation because of parameter change...");
                this.animationIsRunning = false;
            }
            if (this.paramsBroken) {
                this.lUnit = NaN;
                this.cUnit = NaN;
                this.tProp = NaN;
                this.tStep = NaN;
                this.nStep = NaN;
                this.rhoGen = NaN;
                this.rhoLoad = NaN;
                return;
            }
            model.Z0 = this.Z0;
            model.generatorIsSine = this.generatorType === "sine";
            model.Rg = this.Rg;
            model.tRise = this.tRise * 1e-9;
            model.tPeriod = this.tPeriod * 1e-9;
            model.loadIsR = this.loadType === "R";
            model.Rl = this.Rload;
            model.Cl = this.Cload * 1e-12;
            model.lineLength = this.length;
            model.v = this.v * 1e8;
            model.ndz = this.ndz;
            model.tStopSim = this.tStopSim * 1e-9;
            model.tStopWall = this.tStopWall;
            model.initParameters();
            this.lUnit = model.lUnit * 1e6;
            this.cUnit = model.cUnit * 1e9;
            this.tProp = model.lineLength / model.v * 1e9;
            this.tStep = model.dt * 1e12;
            this.nStep = model.noTimeSteps;
            this.rhoGen = model.rhoGen;
            this.rhoLoad = model.rhoLoad;
        }
    }
});
var app = new appClass().$mount('#app');
//# sourceMappingURL=transmission_line_numerical.js.map