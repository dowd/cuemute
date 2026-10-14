import type { CompanionPresetDefinitions, CompanionPresetSection } from '@companion-module/base'
import { BLACK, GREEN, RED, WHITE } from './feedbacks.js'
import type ModuleInstance from './main.js'
import type { ModuleSchema } from './main.js'
import { channelName, sceneLabel } from './state.js'

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

	const sceneIds: string[] = []
	for (const [i, s] of (self.snapshot?.show.scenes ?? []).entries()) {
		const id = `scene_${s.id}`
		sceneIds.push(id)
		presets[id] = {
			type: 'simple',
			name: `Fire scene ${sceneLabel(s) || i + 1}`,
			style: { text: sceneLabel(s) || `Scene ${i + 1}`, size: 'auto', color: WHITE, bgcolor: DARK },
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

	const structure: CompanionPresetSection<ModuleSchema>[] = [
		{
			id: 'show_control',
			name: 'Show control',
			definitions: ['go', 'back', 'next', 'mode', 'desk'],
		},
		{
			id: 'channels',
			name: 'Channels',
			description: 'One button per show channel. Red when muted on the desk. Press to toggle.',
			definitions: channelIds,
		},
		{
			id: 'scenes',
			name: 'Scenes',
			description: 'Fire a scene directly. Green when it is the last fired.',
			definitions: sceneIds,
		},
	]

	self.setPresetDefinitions(structure, presets)
}
