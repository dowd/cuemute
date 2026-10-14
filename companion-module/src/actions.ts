import type ModuleInstance from './main.js'
import { channelChoices, isMuted, sceneChoices } from './state.js'

export type ActionsSchema = {
	go: { options: Record<string, never> }
	back: { options: Record<string, never> }
	fire_scene: { options: { scene: string } }
	channel_mute: { options: { channel: number; state: 'mute' | 'unmute' | 'toggle' } }
	mode: { options: { mode: 'show' | 'edit' | 'toggle' } }
}

export function UpdateActions(self: ModuleInstance): void {
	const scenes = sceneChoices(self.snapshot)
	const channels = channelChoices(self.snapshot)

	self.setActionDefinitions({
		go: {
			name: 'GO',
			description: 'Fire the next scene',
			options: [],
			callback: async () => self.command('/go'),
		},
		back: {
			name: 'Back',
			description: 'Move the next scene back one. Sends nothing to the desk.',
			options: [],
			callback: async () => self.command('/back'),
		},
		fire_scene: {
			name: 'Fire scene',
			description: 'Jump to a scene and fire it',
			options: [
				{
					id: 'scene',
					type: 'dropdown',
					label: 'Scene',
					choices: scenes,
					default: scenes[0]?.id ?? '',
				},
			],
			callback: async (e) => self.command(`/jump/${encodeURIComponent(e.options.scene)}`),
		},
		channel_mute: {
			name: 'Mute channel',
			description: 'Mute, unmute or toggle one channel. Not stored in any scene.',
			options: [
				{
					id: 'channel',
					type: 'dropdown',
					label: 'Channel',
					choices: channels,
					default: channels[0]?.id ?? 1,
					allowCustom: true,
					regex: '/^\\d+$/',
				},
				{
					id: 'state',
					type: 'dropdown',
					label: 'State',
					choices: [
						{ id: 'toggle', label: 'Toggle' },
						{ id: 'mute', label: 'Mute' },
						{ id: 'unmute', label: 'Unmute' },
					],
					default: 'toggle',
				},
			],
			callback: async (e) => {
				const channel = Number(e.options.channel)
				const muted = e.options.state === 'toggle' ? !isMuted(self.snapshot, channel) : e.options.state === 'mute'
				await self.command(`/channels/${channel}/mute`, { muted })
			},
		},
		mode: {
			name: 'Show or Edit mode',
			options: [
				{
					id: 'mode',
					type: 'dropdown',
					label: 'Mode',
					choices: [
						{ id: 'show', label: 'Show' },
						{ id: 'edit', label: 'Edit' },
						{ id: 'toggle', label: 'Toggle' },
					],
					default: 'show',
				},
			],
			callback: async (e) => {
				const mode =
					e.options.mode === 'toggle' ? (self.snapshot?.mode === 'show' ? 'edit' : 'show') : e.options.mode
				await self.command('/mode', { mode })
			},
		},
	})
}
