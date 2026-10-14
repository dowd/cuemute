import { describe, expect, it } from 'vitest'
import { channelChoices, definitionsKey, sceneChoices, variableDefinitions, variableValues, type Snapshot } from './state.js'

const snapshot = (): Snapshot => ({
	show: {
		name: 'Into the Woods',
		channels: [
			{ number: 1, name: 'Baker' },
			{ number: 2, name: '' },
		],
		scenes: [
			{ id: 'a', number: '1', name: 'Prologue', lineRef: 'p1', notes: '' },
			{ id: 'b', number: '1A', name: 'Witch', lineRef: "p6 'Greens!'", notes: 'fast' },
			{ id: 'c', number: '', name: '', lineRef: '', notes: '' },
		],
	},
	cursor: { current: 'a', next: 'b' },
	mode: 'show',
	live: { 'input:1': true, 'input:2': false },
	connection: { type: 'qu', state: 'connected', synced: true, info: '' },
})

describe('variables', () => {
	it('describes the current and next scene and each channel', () => {
		expect(variableValues(snapshot())).toEqual({
			show: 'Into the Woods',
			mode: 'show',
			desk: 'connected',
			current: '1 Prologue',
			current_number: '1',
			current_name: 'Prologue',
			next: '1A Witch',
			next_number: '1A',
			next_name: 'Witch',
			next_line: "p6 'Greens!'",
			next_notes: 'fast',
			ch_1_name: 'Baker',
			ch_1_muted: true,
			ch_2_name: 'Ch 2',
			ch_2_muted: false,
		})
	})

	it('is empty before the first GO and at the end', () => {
		const s = snapshot()
		s.cursor = { current: null, next: null }
		const v = variableValues(s)
		expect([v.current, v.next, v.next_line]).toEqual(['', '', ''])
	})

	it('defines every variable it sets', () => {
		const defined = Object.keys(variableDefinitions(snapshot())).sort()
		expect(Object.keys(variableValues(snapshot())).sort()).toEqual(defined)
	})
})

describe('dropdowns', () => {
	it('lists scenes by label, falling back to position', () => {
		expect(sceneChoices(snapshot())).toEqual([
			{ id: 'a', label: '1 Prologue' },
			{ id: 'b', label: '1A Witch' },
			{ id: 'c', label: 'Scene 3' },
		])
		expect(channelChoices(snapshot())).toEqual([
			{ id: 1, label: '1 Baker' },
			{ id: 2, label: '2 Ch 2' },
		])
	})

	it('only changes key when scenes or channels change', () => {
		const s = snapshot()
		const key = definitionsKey(s)
		s.live['input:1'] = false
		s.cursor.next = 'c'
		expect(definitionsKey(s)).toBe(key)
		s.show.scenes[0]!.name = 'Opening'
		expect(definitionsKey(s)).not.toBe(key)
	})
})
