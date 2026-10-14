// What the module reads from cuemute's snapshots. A copy of the parts of
// @cuemute/core's Snapshot it uses, so the module builds on its own.

export interface Scene {
	id: string
	number: string
	name: string
	lineRef: string
	notes: string
}

export interface Channel {
	number: number
	name: string
}

export interface Snapshot {
	show: { name: string; channels: Channel[]; scenes: Scene[] }
	cursor: { current: string | null; next: string | null }
	mode: 'show' | 'edit'
	live: Record<string, boolean>
	connection: { type: string; state: 'disconnected' | 'connecting' | 'connected'; synced: boolean; info: string }
}

export type Variables = Record<string, string | number | boolean>

export const muteKey = (channel: number): string => `input:${channel}`

export function sceneLabel(scene: Scene | undefined): string {
	return scene ? [scene.number, scene.name].filter(Boolean).join(' ') : ''
}

export function findScene(s: Snapshot, id: string | null): Scene | undefined {
	return id === null ? undefined : s.show.scenes.find((x) => x.id === id)
}

export function channelName(c: Channel): string {
	return c.name || `Ch ${c.number}`
}

// Variable definitions: fixed ones, plus a name and state per show channel.
export function variableDefinitions(s: Snapshot | null): Record<string, { name: string }> {
	const defs: Record<string, { name: string }> = {
		show: { name: 'Show name' },
		mode: { name: 'Mode: show or edit' },
		desk: { name: 'Desk connection: connected, connecting or disconnected' },
		current: { name: 'Last fired scene: number and name' },
		current_number: { name: 'Last fired scene: number' },
		current_name: { name: 'Last fired scene: name' },
		next: { name: 'Next scene: number and name' },
		next_number: { name: 'Next scene: number' },
		next_name: { name: 'Next scene: name' },
		next_line: { name: 'Next scene: line reference' },
		next_notes: { name: 'Next scene: notes' },
	}
	for (const c of s?.show.channels ?? []) {
		defs[`ch_${c.number}_name`] = { name: `Channel ${c.number}: name` }
		defs[`ch_${c.number}_muted`] = { name: `Channel ${c.number}: true when muted` }
	}
	return defs
}

export function variableValues(s: Snapshot): Variables {
	const current = findScene(s, s.cursor.current)
	const next = findScene(s, s.cursor.next)
	const values: Variables = {
		show: s.show.name,
		mode: s.mode,
		desk: s.connection.state,
		current: sceneLabel(current),
		current_number: current?.number ?? '',
		current_name: current?.name ?? '',
		next: sceneLabel(next),
		next_number: next?.number ?? '',
		next_name: next?.name ?? '',
		next_line: next?.lineRef ?? '',
		next_notes: next?.notes ?? '',
	}
	for (const c of s.show.channels) {
		values[`ch_${c.number}_name`] = channelName(c)
		values[`ch_${c.number}_muted`] = s.live[muteKey(c.number)] === true
	}
	return values
}

export function isMuted(s: Snapshot | null, channel: number): boolean {
	return s?.live[muteKey(channel)] === true
}

export function deskConnected(s: Snapshot | null): boolean {
	return s?.connection.state === 'connected'
}

// Dropdown choices; scene ids are stable across renumbering and moves
export function sceneChoices(s: Snapshot | null): { id: string; label: string }[] {
	return (s?.show.scenes ?? []).map((x, i) => ({ id: x.id, label: sceneLabel(x) || `Scene ${i + 1}` }))
}

export function channelChoices(s: Snapshot | null): { id: number; label: string }[] {
	return (s?.show.channels ?? []).map((c) => ({ id: c.number, label: `${c.number} ${channelName(c)}` }))
}

// What decides the action and feedback lists, so they are only resent when it changes
export function definitionsKey(s: Snapshot | null): string {
	return JSON.stringify([sceneChoices(s), channelChoices(s)])
}
