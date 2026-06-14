import type { WritableAtom } from 'nanostores'

export type EventObject = { type: string; [key: string]: unknown }
export type Event = string | EventObject

export interface Snapshot<State extends string, Context> {
  state: State
  context: Context
  done: boolean
}

export interface CallbackArgs<
  State extends string,
  Context,
  MachineEvent extends Event | undefined
> extends Snapshot<State, Context> {
  event: MachineEvent
}

export interface TransitionOptions<
  State extends string = string,
  Context = any,
  MachineEvent extends Event | undefined = Event
> {
  guard?: (args: CallbackArgs<State, Context, MachineEvent>) => boolean
  reduce?: (args: CallbackArgs<State, Context, MachineEvent>) => Context
  action?: (args: CallbackArgs<State, Context, MachineEvent>) => void
}

export interface Transition<
  EventType extends string | null,
  Target extends string,
  State extends string = string,
  Context = any
> {
  event: EventType
  target: Target
  guard?: TransitionOptions<State, Context>['guard']
  reduce?: TransitionOptions<State, Context>['reduce']
  action?: TransitionOptions<State, Context>['action']
  start?: (machine: MachineStore<State, Context>) => () => void
}

export interface EntryStart<State extends string = string, Context = any> {
  start(machine: MachineStore<State, Context>): () => void
  transitions?: Transition<string | null, string, State, Context>[]
}

export interface StateConfig<State extends string = string, Context = any> {
  on?: Transition<string | null, string, State, Context> | Transition<string | null, string, State, Context>[]
  always?: Transition<string | null, string, State, Context> | Transition<string | null, string, State, Context>[]
  entry?:
    | ((args: CallbackArgs<State, Context, Event | undefined>) => void)
    | EntryStart<State, Context>
    | Array<
        | ((args: CallbackArgs<State, Context, Event | undefined>) => void)
        | EntryStart<State, Context>
      >
  exit?: (args: CallbackArgs<State, Context, Event | undefined>) => void
  final?: boolean
}

export interface MachineStore<State extends string, Context>
  extends WritableAtom<Snapshot<State, Context>> {
  send(event: Event): void
}

export function machine<
  const States extends Record<string, StateConfig>,
  Initial extends keyof States & string,
  Context = undefined
>(
  initial: Initial,
  states: States,
  context?: Context,
  opts?: { loopLimit?: number }
): MachineStore<keyof States & string, Context>

export function state<
  State extends string = string,
  Context = any
>(
  ...transitions: Transition<string | null, string, State, Context>[]
): StateConfig<State, Context>

export function state<
  State extends string = string,
  Context = any
>(config: StateConfig<State, Context>): StateConfig<State, Context>

export function transition<
  EventType extends string | null,
  Target extends string,
  State extends string = string,
  Context = any
>(
  event: EventType,
  target: Target,
  opts?: TransitionOptions<State, Context, EventType extends string ? { type: EventType } : undefined>
): Transition<EventType, Target, State, Context>
