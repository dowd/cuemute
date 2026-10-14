import type { CompanionPresetDefinitions, CompanionPresetSection } from '@companion-module/base'
import { BLACK, GREEN, RED, WHITE } from './feedbacks.js'
import type ModuleInstance from './main.js'
import type { ModuleSchema } from './main.js'
import { channelName, sceneGroups, sceneLabel } from './state.js'

const DARK = 0x202020

export function UpdatePresets(self: ModuleInstance): void {
	const v = (name: string) => `$(${self.label}:${name})`
	const presets: CompanionPresetDefinitions<ModuleSchema> = {}

	presets.go = {
		type: 'simple',
		name: 'GO, showing the next scene',
		style: { text: `GO\n${v('next_number')}`, size: '18', color: WHITE, bgcolor: GREEN },
		steps: [{ down: [{ actionId: 'go', options: {} }], up: [] }],
		feedbacks: [{ feedbackId: 'desk_disconnected', options: {}, style: { bgcolor: RED, color: WHITE } }],
	}
	presets.back = {
		type: 'simple',
		name: 'Back',
		style: { text: 'BACK', size: '18', color: WHITE, bgcolor: DARK },
		steps: [{ down: [{ actionId: 'back', options: {} }], up: [] }],
		feedbacks: [],
	}
	presets.next = {
		type: 'simple',
		name: 'Next scene name and line',
		style: { text: `${v('next')}\n${v('next_line')}`, size: 'auto', color: WHITE, bgcolor: BLACK },
		steps: [],
		feedbacks: [],
	}
	// Shaped for a wide, short display such as the Stream Deck Neo's info strip
	// (248x58, can't be pressed): no top bar, the line only, red if GO won't work.
	presets.next_line = {
		type: 'simple',
		name: 'Next cue line (Stream Deck Neo info strip)',
		style: { text: v('next_line'), size: 'auto', color: WHITE, bgcolor: BLACK, show_topbar: false },
		steps: [],
		feedbacks: [{ feedbackId: 'desk_disconnected', options: {}, style: { bgcolor: RED, color: WHITE } }],
	}
	presets.mode = {
		type: 'simple',
		name: 'Show / Edit mode toggle',
		style: { text: v('mode'), size: '18', color: WHITE, bgcolor: DARK },
		steps: [{ down: [{ actionId: 'mode', options: { mode: 'toggle' } }], up: [] }],
		feedbacks: [{ feedbackId: 'show_mode', options: {}, style: { bgcolor: GREEN, color: WHITE } }],
	}
	presets.desk = {
		type: 'simple',
		name: 'Desk connection',
		style: { text: `DESK\n${v('desk')}`, size: '14', color: WHITE, bgcolor: GREEN },
		steps: [],
		feedbacks: [{ feedbackId: 'desk_disconnected', options: {}, style: { bgcolor: RED, color: WHITE } }],
	}

	const channelIds: string[] = []
	for (const c of self.snapshot?.show.channels ?? []) {
		const id = `channel_${c.number}`
		channelIds.push(id)
		presets[id] = {
			type: 'simple',
			name: `Toggle mute: ${c.number} ${channelName(c)}`,
			style: { text: v(`ch_${c.number}_name`), size: 'auto', color: WHITE, bgcolor: DARK },
			steps: [{ down: [{ actionId: 'channel_mute', options: { channel: c.number, state: 'toggle' } }], up: [] }],
			feedbacks: [
				{ feedbackId: 'channel_muted', options: { channel: c.number }, style: { bgcolor: RED, color: WHITE } },
			],
		}
	}

	// one preset section per group of scenes, in show order
	const sceneSections: CompanionPresetSection<ModuleSchema>[] = []
	let position = 0
	for (const [g, run] of sceneGroups(self.snapshot).entries()) {
		const ids: string[] = []
		for (const s of run.scenes) {
			position++
			const id = `scene_${s.id}`
			const label = sceneLabel(s) || `Scene ${position}`
			ids.push(id)
			presets[id] = {
				type: 'simple',
				name: `Fire scene ${label}`,
				style: { text: label, size: 'auto', color: WHITE, bgcolor: DARK },
				steps: [{ down: [{ actionId: 'fire_scene', options: { scene: s.id } }], up: [] }],
				feedbacks: [
					{
						feedbackId: 'scene_is',
						options: { scene: s.id, which: 'current' },
						style: { bgcolor: GREEN, color: WHITE },
					},
				],
			}
		}
		sceneSections.push({
			id: `scenes_${g}`,
			name: run.group ? `Scenes: ${run.group}` : 'Scenes',
			description: 'Fire a scene directly. Green when it is the last fired.',
			definitions: ids,
		})
	}

	const structure: CompanionPresetSection<ModuleSchema>[] = [
		{
			id: 'show_control',
			name: 'Show control',
			definitions: ['go', 'back', 'next', 'next_line', 'mode', 'desk'],
		},
		{
			id: 'channels',
			name: 'Channels',
			description: 'One button per show channel. Red when muted on the desk. Press to toggle.',
			definitions: channelIds,
		},
		...sceneSections,
	]

	self.setPresetDefinitions(structure, presets)
}
