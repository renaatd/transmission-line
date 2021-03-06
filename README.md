# transmission-line
## What
This is a simulation in the browser of a wave traveling on a transmission line.
The simulation uses the FDTD method.

## How
The implementation is written in TypeScript. Vue is used for most of the user
interaction.  Chart.js is used for plotting.

The simulation object `model` and the Chart.js objects are not part of the Vue
object, to avoid any extra delays from the reactivity system.  The slowest part
of the animation is drawing the chart. Chart.js is not really designed for
animation at 60 frames per second, but hey, it works !

The simulation object `model` knows nothing about Vue or the animation. It can
log messages to the UI via an injected log function.

## Building
```
# install typescript globally
npm install typescript -g 

npm install
npx tsc
```

The code doesn't use modules. `tsc` is configured to output one Javascript
file. Vue and Chart.js are sourced from a CDN.

## Contact
Email: renaatd at fastmail dot com

