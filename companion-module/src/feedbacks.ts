import type ModuleInstance from './main.js'
import { channelChoices, deskConnected, isMuted, sceneChoices } from './state.js'

export type FeedbacksSchema = {
	channel_muted: { type: 'boolean'; options: { channel: number } }
	desk_disconnected: { type: 'boolean'; options: Record<string, never> }
	show_mode: { type: 'boolean'; options: Record<string, never> }
	scene_is: { type: 'boolean'; options: { scene: string; which: 'current' | 'next' } }
}

export const RED = 0xcc0000
export const GREEN = 0x00a040
export const AMBER = 0xc08000
export const WHITE = 0xffffff
export const BLACK = 0x000000

export function UpdateFeedbacks(self: ModuleInstance): void {
	const scenes = sceneChoices(self.snapshot)
	const channels = channelChoices(self.snapshot)

	self.setFeedbackDefinitions({
		channel_muted: {
			type: 'boolean',
			name: 'Channel is muted',
			description: 'Live state from the desk, including changes made by hand',
			defaultStyle: { bgcolor: RED, color: WHITE },
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
			],
			callback: (fb) => isMuted(self.snapshot, Number(fb.options.channel)),
		},
		desk_disconnected: {
			type: 'boolean',
			name: 'Desk or cuemute not connected',
			description: 'GO does nothing while this is on',
			defaultStyle: { bgcolor: RED, color: WHITE },
			options: [],
			callback: () => !deskConnected(self.snapshot),
		},
		show_mode: {
			type: 'boolean',
			name: 'Show mode',
			defaultStyle: { bgcolor: GREEN, color: WHITE },
			options: [],
			callback: () => self.snapshot?.mode === 'show',
		},
		scene_is: {
			type: 'boolean',
			name: 'Scene is current or next',
			defaultStyle: { bgcolor: AMBER, color: BLACK },
			options: [
				{
					id: 'scene',
					type: 'dropdown',
					label: 'Scene',
					choices: scenes,
					default: scenes[0]?.id ?? '',
				},
				{
					id: 'which',
					type: 'dropdown',
					label: 'Is',
					choices: [
						{ id: 'next', label: 'Next' },
						{ id: 'current', label: 'Last fired' },
					],
					default: 'next',
				},
			],
			callback: (fb) => {
				const cursor = self.snapshot?.cursor
				return !!cursor && cursor[fb.options.which] === fb.options.scene
			},
		},
	})
}
