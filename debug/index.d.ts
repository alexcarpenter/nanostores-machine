import type { Event, MachineStore, Snapshot } from '../index.js'

export interface DebugTransition<State extends string, Context> {
  event: Event
  from: Snapshot<State, Context>
  to: Snapshot<State, Context>
}

export interface DebugOptions {
  name?: string
  event?: boolean
  snapshot?: boolean
  logger?: (...args: any[]) => void
}

export function debug<State extends string, Context>(
  machine: MachineStore<State, Context>,
  opts?: DebugOptions
): () => void
