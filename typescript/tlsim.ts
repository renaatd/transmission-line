'use strict';

class TlSim {
    static readonly noTerminalVoltages = 1000;
/*  ===============
    Logging
    =============== */
    log: (msg: string) => void = function() {};

/*  ===============
    Input parameters
    =============== */

    Z0: number = 50.0; // [Ohm] transmission line impedance

    Rg: number = 20.0; // [Ohm] generator series impedance
    tRise: number = 1e-9; // [s] pulse generator: rise time, in simulation time
    tPeriod: number = 20e-9; // [s] sine/pulse generator: period, in simulation time

    Rl: number = 1000; // [Ohm] load series impedance
    Cl: number = 5e-12; // [pF] load series capacitance

    lineLength : number = 0.10; // [m] length transmission line
    v : number = 2e8; // [m/s] propagation speed in transmission line
    ndz : number = 400; // number of segments
    tStopSim: number = 100e-9; // [s] end time simulation, in simulation time
    tStopWall: number = 10.0; // [s] end time simulation, in wall clock time

    generator: (t: number) => number = this.generator_step;
    updateLoad: () => void = this.updateLoadR;

/*  ===============
    Helper parameters
    =============== */
    dz : number = -1; // [m] length of each segment
    dt : number = -1; // [s] time step size
    lUnit : number = -1; // [H/m] inductance per unit length
    cUnit : number = -1; // [F/m] capacitance per unit length

    voltages : number[] = Array(0); // [V] voltages in each of the ndz+1 points, at the edges of the segments
    currents : number[] = Array(0); // [A] current in the middle of each of the ndz segments
    currentLoad : number = -1; // [A] current in the load, only used for capacitve load
    vGenPrev : number = -1; // [V] generator voltage previous timestep
    stepsDone : number = -1; // No of steps already done

    noTimeSteps : number = -1; // Number of time steps till tstop_sim
    timeSteps : Array<number> = Array(0); // [s] time at each voltage step

    terminalStepsDone : number = -1;
    timeStepsTerminal : number[] = Array(0); // [s] time when terminal voltage is recorded
    voltagesGeneratorTerminal : number[] = Array(0); // [V] voltage at generator terminal, for each timestep
    voltagesLoadTerminal      : number[] = Array(0); // [V] voltage at load terminal, for each timestep 

/*  ===============
    Output only parameters
    =============== */
    rhoGen : number = -1;
    rhoLoad : number = -1;

/*  ===============
    Calculations
    =============== */
    constructor() {
        this.initParameters();
    }

    initParameters() {
        this.lUnit = this.Z0 / this.v;
        this.cUnit = 1.0 / (this.Z0 * this.v);

        this.dz = this.lineLength / this.ndz;
        // time step: use Courant limit
        this.dt = this.dz / this.v;

        this.voltages = Array(this.ndz+1).fill(0.0);
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

    generator_step(simTime: number) {
        let relTimestamp = simTime % this.tPeriod;
        if (relTimestamp < this.tRise) {
            return relTimestamp / this.tRise;
        } else if (relTimestamp < this.tPeriod / 2.0) {
            return 1.0;
        } else if (relTimestamp < this.tPeriod / 2.0 + this.tRise) {
            relTimestamp = this.tPeriod / 2.0 + this.tRise - relTimestamp;
            return relTimestamp / this.tRise;
        }
        return 0.0;
    }

    generator_sine(simTime: number) {
        return Math.sin(2.0 * Math.PI * simTime / this.tPeriod);
    }

    set generatorIsSine(isSine : boolean) {
        this.generator = isSine ? this.generator_sine : this.generator_step;
    }

    updateLoadR() {
        // resistive load: see "Analysis of multiconductor transmission lines", 2nd ed, Paul R. Clayton, 2008, equation 8.81b
        let factor = this.dz / this.dt * this.Rl * this.cUnit;
        this.voltages[this.ndz] = ((factor - 1.0) * this.voltages[this.ndz]
                        + 2.0 * this.Rl * this.currents[this.ndz-1]) / (factor + 1.0);
    }

    updateLoadC() {
        // capacitive load: see "Analysis of multiconductor transmission lines", 2nd ed, Paul R. Clayton, 2008, equation 9.65
        let factor = this.dz / this.dt * this.cUnit + this.Cl / this.dt;
        let deltaVoltage = (2.0 * this.currents[this.ndz-1] - this.currentLoad) / factor;
        this.voltages[this.ndz] += deltaVoltage;
        this.currentLoad = this.Cl / this.dt * deltaVoltage;
    }

    set loadIsR(isR : boolean) {
        this.updateLoad = isR ? this.updateLoadR : this.updateLoadC;
    }

    updateSimulation(timestamp_wall: number) {
        let stepsLimit = Math.floor(timestamp_wall / this.tStopWall * this.noTimeSteps);
        stepsLimit = Math.min(stepsLimit, this.noTimeSteps)
        for (; this.stepsDone < stepsLimit; this.stepsDone++) {
            const t_simulation = this.stepsDone * this.dt;
            this.timeSteps[this.stepsDone] = t_simulation;

            // boundary conditions generator / load
            // generator: see "Analysis of multiconductor transmission lines", 2nd ed, Paul R. Clayton, 2008, equation 8.81a
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

            // in the transmission line
            factor = this.dt / (this.dz * this.cUnit);
            for (let i = 1; i < this.ndz; i++) {
                this.voltages[i] += factor * (this.currents[i-1] - this.currents[i]);
            }
            factor = this.dt / (this.dz * this.lUnit);
            for (let i = 0; i < this.ndz; i++) {
                this.currents[i] += factor * (this.voltages[i] - this.voltages[i+1]);
            }

            this.vGenPrev = vGenNow;
        }
    }
}
