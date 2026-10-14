import type { Snapshot } from './state.js'

export interface ClientEvents {
	snapshot: (s: Snapshot) => void
	open: () => void
	close: (reason: string) => void
}

// Talks to one cuemute server: live snapshots over its WebSocket, commands
// over its HTTP API. Reconnects until stopped.
export class CuemuteClient {
	readonly #base: string
	readonly #ws: string
	readonly #on: ClientEvents
	readonly #reconnectMs: number
	#socket: WebSocket | null = null
	#timer: ReturnType<typeof setTimeout> | undefined
	#stopped = false

	constructor(host: string, port: number, on: ClientEvents, reconnectMs = 2000) {
		this.#base = `http://${host}:${port}/api`
		this.#ws = `ws://${host}:${port}/ws`
		this.#on = on
		this.#reconnectMs = reconnectMs
	}

	start(): void {
		this.#stopped = false
		this.#open()
	}

	stop(): void {
		this.#stopped = true
		clearTimeout(this.#timer)
		const socket = this.#socket
		this.#socket = null
		socket?.close()
	}

	// Sends a command. Throws with cuemute's own message on an error status.
	async post(path: string, body?: unknown): Promise<void> {
		const res = await fetch(this.#base + path, {
			method: 'POST',
			headers: body === undefined ? {} : { 'content-type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body),
			signal: AbortSignal.timeout(3000),
		})
		if (!res.ok) {
			const data = (await res.json().catch(() => null)) as { error?: string } | null
			throw new Error(data?.error ?? `cuemute answered ${res.status}`)
		}
	}

	#open(): void {
		const socket = new WebSocket(this.#ws)
		this.#socket = socket
		let failure = ''
		socket.addEventListener('open', () => this.#on.open())
		socket.addEventListener('message', (e) => {
			try {
				this.#on.snapshot(JSON.parse(String(e.data)) as Snapshot)
			} catch {
				// not a snapshot; ignore
			}
		})
		socket.addEventListener('error', (e) => {
			failure = (e as ErrorEvent).message || 'connection failed'
		})
		socket.addEventListener('close', () => {
			if (this.#socket !== socket) return // stopped, or replaced
			this.#socket = null
			this.#on.close(failure || 'connection closed')
			if (!this.#stopped) this.#timer = setTimeout(() => this.#open(), this.#reconnectMs)
		})
	}
}
