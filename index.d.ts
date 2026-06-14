import type { WritableAtom } from 'nanostores'

export type EventObject = { type: string; [key: string]: unknown }
export type Event = string | EventObject
type MaybeArray<Value> = Value | Value[]

type EventName<MachineEvent> = MachineEvent extends string
  ? MachineEvent
  : MachineEvent extends { type: infer Type extends string }
    ? Type
    : never

type EventFor<MachineEvent, Type> = MachineEvent extends string
  ? Type extends MachineEvent
    ? Type
    : never
  : MachineEvent extends { type: Type }
    ? MachineEvent
    : never

type EmptyEventName<MachineEvent> = MachineEvent extends string
  ? MachineEvent
  : MachineEvent extends { type: infer Type extends string }
    ? Exclude<keyof MachineEvent, 'type'> extends never
      ? Type
      : never
    : never

type SendEvent<MachineEvent> =
  | MachineEvent
  | EmptyEventName<MachineEvent>

type LiteralString<Value> = Value extends string
  ? string extends Value
    ? never
    : Value
  : never

type TransitionTarget<Value> = Value extends Transition<any, infer Target, any, any, any>
  ? LiteralString<Target>
  : never

type Targets<Value> = Value extends readonly unknown[]
  ? TransitionTarget<Value[number]>
  : TransitionTarget<Value>

type EntryTargets<Value> = Value extends readonly unknown[]
  ? EntryTargets<Value[number]>
  : Value extends EntryStart<any, any, infer EntryTransitions>
    ? Targets<EntryTransitions>
    : never

type StateTargets<Value> = Value extends StateConfig<
  infer On,
  infer Always,
  infer Entry,
  any
>
  ? Targets<On> | Targets<Always> | EntryTargets<Entry>
  : never

type AllTargets<States> = {
  [Name in keyof States]: StateTargets<States[Name]>
}[keyof States]

type InvalidTargets<States> = Exclude<AllTargets<States>, keyof States & string>

type TargetCheck<States> = InvalidTargets<States> extends never
  ? unknown
  : { __invalid_transition_targets__: InvalidTargets<States> }

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
  Type extends string | null,
  Target extends string,
  State extends string = string,
  Context = any,
  MachineEvent extends Event | undefined = Event
> {
  event: Type
  target: Target
  guard?: TransitionOptions<State, Context, MachineEvent>['guard']
  reduce?: TransitionOptions<State, Context, MachineEvent>['reduce']
  action?: TransitionOptions<State, Context, MachineEvent>['action']
  start?: (machine: MachineStore<State, Context>) => () => void
}

export interface EntryStart<
  State extends string = string,
  Context = any,
  EntryTransitions = Transition<string | null, string, State, Context>
> {
  start(machine: MachineStore<State, Context>): () => void
  transitions?: EntryTransitions[]
}

export interface StateConfig<
  On = Transition<string | null, string, any, any, any>,
  Always = Transition<string | null, string, any, any, any>,
  Entry =
    | ((args: CallbackArgs<string, any, Event | undefined>) => void)
    | EntryStart,
  Context = any
> {
  on?: MaybeArray<On>
  always?: MaybeArray<Always>
  entry?: MaybeArray<Entry>
  exit?: (args: CallbackArgs<string, Context, Event | undefined>) => void
  final?: boolean
}

export interface MachineStore<
  State extends string,
  Context,
  MachineEvent extends Event = Event
> extends WritableAtom<Snapshot<State, Context>> {
  send(event: SendEvent<MachineEvent>): void
}

export function machine<
  const States extends object,
  Initial extends keyof States & string,
  Context = undefined
>(
  initial: Initial,
  states: States & TargetCheck<States>,
  context?: Context,
  opts?: { loopLimit?: number }
): MachineStore<keyof States & string, Context>

export function state<
  const StateTransitions extends Transition<string | null, string, any, any, any>[]
>(
  ...transitions: StateTransitions
): StateConfig<StateTransitions, never, never>

export function state<const Config extends StateConfig>(
  config: Config
): Config

export function transition<
  Type extends string | null,
  Target extends string,
  State extends string = string,
  Context = any
>(
  event: Type,
  target: Target,
  opts?: TransitionOptions<
    State,
    Context,
    Type extends string ? { type: Type } : undefined
  >
): Transition<
  Type,
  Target,
  State,
  Context,
  Type extends string ? { type: Type } : undefined
>

export interface TypedSetup<Context, MachineEvent extends Event> {
  machine<
    const States extends object,
    Initial extends keyof States & string
  >(
    initial: Initial,
    states: States & TargetCheck<States>,
    context: Context,
    opts?: { loopLimit?: number }
  ): MachineStore<keyof States & string, Context, MachineEvent>

  state<
    const StateTransitions extends Transition<string | null, string, any, any, any>[]
  >(
    ...transitions: StateTransitions
  ): StateConfig<StateTransitions, never, never, Context>

  state<const Config extends StateConfig<any, any, any, Context>>(
    config: Config
  ): Config

  transition<
    Type extends EventName<MachineEvent> | null,
    Target extends string,
    State extends string = string
  >(
    event: Type,
    target: Target,
    opts?: TransitionOptions<
      State,
      Context,
      Type extends null ? undefined : EventFor<MachineEvent, Type>
    >
  ): Transition<
    Type,
    Target,
    State,
    Context,
    Type extends null ? undefined : EventFor<MachineEvent, Type>
  >
}

export function setup<
  Context,
  MachineEvent extends Event = Event
>(): TypedSetup<Context, MachineEvent>
