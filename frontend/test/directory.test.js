import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildSteps, CONSOLES } from '../src/demo.js';
import { availableTypes, matchesCheat } from '../src/filters.js';

const cheats = JSON.parse(readFileSync(new URL('../cheats.json', import.meta.url), 'utf8'));

test('a category selection combines categories and narrows with additional filters', () => {
  const category = new Set(['Player', 'Weapons']);
  const sub = new Set();
  const status = new Set();
  const filters = { q: '', category, sub, status };
  assert.equal(cheats.filter(cheat => matchesCheat(cheat, filters)).length, 19);
  assert.ok(availableTypes(cheats, category).includes('Ammo'));
  assert.ok(!availableTypes(cheats, new Set(['Player'])).includes('Ammo'));
  sub.add('Ammo');
  status.add('discovered');
  assert.deepEqual(cheats.filter(cheat => matchesCheat(cheat, filters)).map(cheat => cheat.id),
    ['max-ammo', 'infinite-ammo', 'no-reload']);
});

test('controller steps preserve adjacent repeated inputs and console-specific labels', () => {
  const cheat = cheats.find(cheat => cheat.id === 'drunk');
  assert.equal(cheats.length, 61);
  assert.equal(cheats.filter(cheat => cheat.discovered).length, 19);
  const steps = buildSteps(cheat.input, CONSOLES[1][1]);
  assert.equal(steps[1].text, 'Hold LB and press RB');
  assert.deepEqual(steps.slice(2).map(step => step.dir), cheat.input);
  assert.deepEqual(steps.slice(5, 7).map(step => step.dir), ['Up', 'Up']);
  assert.equal(buildSteps(cheat.input, CONSOLES[0][1])[1].text, 'Hold L1 and press R1');
});
