// Regresión de los eventos reales del mapa, sin dependencias externas.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const source = readFileSync(join(__dirname, '..', 'app.js'), 'utf8');
const events = source.slice(source.indexOf('  function setupMapEvents()'), source.indexOf('  function setupControls()'));

function fixture() {
  const handlers = new Map();
  const classes = new Set();
  const captures = new Set();
  const zooms = [];
  const state = { center: [100, 100], dragging: false, moved: false };
  let clock = 1000;
  let taps = 0;
  const map = {
    clientHeight: 600,
    addEventListener(type, fn) { handlers.set(type, fn); },
    getBoundingClientRect() { return { left: 0, top: 0 }; },
    setPointerCapture(id) { captures.add(id); },
    hasPointerCapture(id) { return captures.has(id); },
    releasePointerCapture(id) { captures.delete(id); },
    classList: { add: c => classes.add(c), remove: c => classes.delete(c) },
  };
  const context = vm.createContext({
    map, state, performance: { now: () => clock },
    document: { getElementById: () => ({ textContent: '' }) },
    mercator: (x, y) => [x, y], inverseMercator: (x, y) => [x, y],
    geoPoint: (x, y) => [x, y], render() {},
    changeZoom: (...args) => zooms.push(args),
    hitTest: () => ({ feature: {}, layer: {} }), selectFeature: () => { taps += 1; },
  });
  vm.runInContext(events + '\nsetupMapEvents();', context);
  function fire(type, props = {}) {
    const event = { pointerId: 1, button: 0, isPrimary: true, clientX: 100, clientY: 100,
      deltaY: 0, deltaMode: 0, target: { closest: () => null },
      preventDefault() { this.defaultPrevented = true; }, ...props };
    handlers.get(type)?.(event);
    return event;
  }
  return { fire, state, zooms, classes, captures, advance: n => { clock += n; }, taps: () => taps };
}

const cases = [
  ['rueda horizontal no altera zoom', () => {
    const f = fixture(); f.fire('wheel', { deltaY: 0, deltaX: 120 });
    assert.equal(f.zooms.length, 0);
  }],
  ['deltas finos se acumulan y el zoom conserva el cursor como ancla', () => {
    const f = fixture();
    for (let i = 0; i < 3; i++) f.fire('wheel', { deltaY: -20 });
    assert.equal(f.zooms.length, 0);
    f.fire('wheel', { deltaY: -20, clientX: 320, clientY: 240 });
    assert.deepEqual(f.zooms, [[1, 320, 240]]);
    f.fire('wheel', { deltaY: -120 });
    assert.equal(f.zooms.length, 1, 'la inercia inmediata no dispara otro nivel');
    f.advance(100); f.fire('wheel', { deltaY: -80 });
    assert.equal(f.zooms.length, 2);
  }],
  ['rueda en líneas y páginas también acerca o aleja', () => {
    const f = fixture(); f.fire('wheel', { deltaY: 3, deltaMode: 1 });
    assert.equal(f.zooms[0][0], -1);
    f.advance(200); f.fire('wheel', { deltaY: 3, deltaMode: 1 });
    assert.equal(f.zooms.length, 2, 'cada paso lento de una rueda en líneas responde');
    f.advance(200); f.fire('wheel', { deltaY: -1, deltaMode: 2 });
    assert.equal(f.zooms[2][0], 1);
  }],
  ['arrastre principal mueve el centro y no abre ficha', () => {
    const f = fixture(); f.fire('pointerdown');
    f.fire('pointermove', { clientX: 140, clientY: 120 }); f.fire('pointerup');
    assert.deepEqual(Array.from(f.state.center), [60, 80]);
    assert.equal(f.state.dragging, false); assert.equal(f.taps(), 0);
  }],
  ['cancelación libera el arrastre y permite empezar otro', () => {
    const f = fixture(); f.fire('pointerdown'); f.fire('pointercancel');
    assert.equal(f.state.dragging, false); assert.equal(f.classes.has('dragging'), false);
    f.fire('pointermove', { clientX: 200 });
    assert.deepEqual(Array.from(f.state.center), [100, 100]);
    f.fire('pointerdown', { pointerId: 2 }); assert.equal(f.state.dragging, true);
  }],
  ['pérdida de captura limpia el gesto', () => {
    const f = fixture(); f.fire('pointerdown'); f.fire('lostpointercapture');
    assert.equal(f.state.dragging, false);
  }],
  ['botón secundario y contactos adicionales no arrastran', () => {
    const f = fixture(); f.fire('pointerdown', { button: 2 });
    assert.equal(f.state.dragging, false);
    f.fire('pointerdown');
    f.fire('pointerdown', { pointerId: 2, isPrimary: false, clientX: 300 });
    f.fire('pointermove', { pointerId: 2, isPrimary: false, clientX: 400 });
    assert.deepEqual(Array.from(f.state.center), [100, 100]);
    f.fire('pointerup', { pointerId: 2 }); assert.equal(f.state.dragging, true);
    f.fire('pointerup'); assert.equal(f.state.dragging, false);
  }],
  ['clic sin arrastre sigue abriendo ficha', () => {
    const f = fixture(); f.fire('pointerdown'); f.fire('pointerup'); assert.equal(f.taps(), 1);
  }],
  ['controles del mapa no inician arrastre', () => {
    const f = fixture(); f.fire('pointerdown', { target: { closest: () => ({}) } });
    assert.equal(f.state.dragging, false);
  }],
];
let failures = 0;
for (const [name, test] of cases) {
  try { test(); console.log('OK:', name); }
  catch (error) { failures++; console.error('FALLO:', name, '\n ', error.message); }
}
if (failures) process.exitCode = 1;
