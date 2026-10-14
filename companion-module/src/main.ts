import {
	InstanceBase,
	InstanceStatus,
	type CompanionVariableValues,
	type SomeCompanionConfigField,
} from '@companion-module/base'
import { CuemuteClient } from './client.js'
import { GetConfigFields, type ModuleConfig } from './config.js'
import { UpdateActions, type ActionsSchema } from './actions.js'
import { UpdateFeedbacks, type FeedbacksSchema } from './feedbacks.js'
import { UpdatePresets } from './presets.js'
import { definitionsKey, variableDefinitions, variableValues, type Snapshot } from './state.js'
import { UpgradeScripts } from './upgrades.js'

export type ModuleSchema = {
	config: ModuleConfig
	secrets: undefined
	actions: ActionsSchema
	feedbacks: FeedbacksSchema
	variables: CompanionVariableValues
}

export { UpgradeScripts }

export default class ModuleInstance extends InstanceBase<ModuleSchema> {
	config!: ModuleConfig // set in init()
	snapshot: Snapshot | null = null
	#client: CuemuteClient | null = null
	#definitionsKey = ''

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig): Promise<void> {
		this.config = config
		this.#updateDefinitions()
		this.#connect()
	}

	async destroy(): Promise<void> {
		this.#client?.stop()
		this.#client = null
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		this.config = config
		this.#updateDefinitions() // the label used in preset text may have changed
		this.#connect()
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	// Sends a command to cuemute. A refusal (desk offline, Show mode...) goes to the log.
	async command(path: string, body?: unknown): Promise<void> {
		try {
			if (!this.#client) throw new Error('not configured')
			await this.#client.post(path, body)
		} catch (err) {
			this.log('warn', `${path}: ${(err as Error).message}`)
		}
	}

	#connect(): void {
		this.#client?.stop()
		this.snapshot = null
		const { host, port } = this.config
		if (!host) {
			this.updateStatus(InstanceStatus.BadConfig, 'Set the address of the Mac running cuemute')
			return
		}
		this.updateStatus(InstanceStatus.Connecting)
		this.#client = new CuemuteClient(host, port, {
			open: () => this.log('info', `Connected to cuemute at ${host}:${port}`),
			close: (reason) => {
				this.snapshot = null
				this.updateStatus(InstanceStatus.ConnectionFailure, `cuemute: ${reason}`)
				this.checkAllFeedbacks()
			},
			snapshot: (s) => this.#onSnapshot(s),
		})
		this.#client.start()
	}

	#onSnapshot(s: Snapshot): void {
		this.snapshot = s
		if (s.connection.state === 'connected') this.updateStatus(InstanceStatus.Ok)
		else this.updateStatus(InstanceStatus.UnknownWarning, `Desk ${s.connection.state}`)

		if (definitionsKey(s) !== this.#definitionsKey) this.#updateDefinitions()
		this.setVariableValues(variableValues(s))
		this.checkAllFeedbacks()
	}

	// Scene and channel lists appear in dropdowns, presets and variables.
	#updateDefinitions(): void {
		this.#definitionsKey = definitionsKey(this.snapshot)
		this.setVariableDefinitions(variableDefinitions(this.snapshot))
		UpdateActions(this)
		UpdateFeedbacks(this)
		UpdatePresets(this)
	}
}
