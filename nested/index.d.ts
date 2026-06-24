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

type SendEvent<MachineEvent> = MachineEvent | EmptyEventName<MachineEvent>

type LiteralString<Value> = Value extends string
  ? string extends Value
    ? never
    : Value
  : never

type PrefixPath<Prefix extends string, Name extends string> = Prefix extends ''
  ? Name
  : `${Prefix}.${Name}`

type NestedPaths<States, Prefix extends string = ''> = {
  [Name in keyof States & string]: States[Name] extends StateConfig<
    any,
    any,
    any,
    any,
    infer Children,
    any
  >
    ? | PrefixPath<Prefix, Name>
      | (Children extends object
          ? NestedPaths<Children, PrefixPath<Prefix, Name>>
          : never)
    : PrefixPath<Prefix, Name>
}[keyof States & string]

type TransitionTarget<Value> = Value extends Transition<any, infer Target, any, any, any>
  ? LiteralString<Target>
  : Value extends OnDoneTransition<infer Target, any, any>
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
  any,
  infer Children,
  infer OnDone
>
  ? | Targets<On>
    | Targets<Always>
    | EntryTargets<Entry>
    | Targets<OnDone>
    | (Children extends object ? AllTargets<Children> : never)
  : never

type AllTargets<States> = {
  [Name in keyof States]: StateTargets<States[Name]>
}[keyof States]

type InvalidTargets<States> = Exclude<AllTargets<States>, NestedPaths<States>>

type TargetCheck<States> = InvalidTargets<States> extends never
  ? unknown
  : { __invalid_transition_targets__: InvalidTargets<States> }

export interface Snapshot<State extends string, Context> {
  state: State
  context: Context
  done: boolean
}

export interface CompletionEvent<State extends string = string, Context = any> {
  type: 'nanostores-machine:done'
  state: State
  context: Context
}

export interface CallbackArgs<
  State extends string,
  Context,
  MachineEvent extends Event | CompletionEvent | undefined
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

export interface OnDoneOptions<
  State extends string = string,
  Context = any
> {
  guard?: (args: CallbackArgs<State, Context, CompletionEvent<State, Context>>) => boolean
  reduce?: (args: CallbackArgs<State, Context, CompletionEvent<State, Context>>) => Context
  action?: (args: CallbackArgs<State, Context, CompletionEvent<State, Context>>) => void
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

export interface OnDoneTransition<
  Target extends string,
  State extends string = string,
  Context = any
> {
  event: 'nanostores-machine:done'
  target: Target
  guard?: OnDoneOptions<State, Context>['guard']
  reduce?: OnDoneOptions<State, Context>['reduce']
  action?: OnDoneOptions<State, Context>['action']
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
  Context = any,
  Children = undefined,
  OnDone = OnDoneTransition<string, any, any>
> {
  on?: MaybeArray<On>
  always?: MaybeArray<Always>
  entry?: MaybeArray<Entry>
  exit?: (args: CallbackArgs<string, Context, Event | undefined>) => void
  final?: boolean
  initial?: Children extends object ? keyof Children & string : string
  states?: Children
  onDone?: MaybeArray<OnDone>
}

export interface MachineStore<
  State extends string,
  Context,
  MachineEvent extends Event = Event
> extends WritableAtom<Snapshot<State, Context>> {
  send(event: SendEvent<MachineEvent>): void
  matches(state: State): boolean
  listenTransitions(
    listener: (transition: {
      event: SendEvent<MachineEvent> | CompletionEvent<State, Context>
      from: Snapshot<State, Context>
      to: Snapshot<State, Context>
    }) => void
  ): () => void
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
): MachineStore<NestedPaths<States>, Context>

export function state<
  const StateTransitions extends Transition<string | null, string, any, any, any>[]
>(
  ...transitions: StateTransitions
): StateConfig<StateTransitions, never, never>

export function state<const Config extends StateConfig<any, any, any, any, any, any>>(
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

export function onDone<
  Target extends string,
  State extends string = string,
  Context = any
>(
  target: Target,
  opts?: OnDoneOptions<State, Context>
): OnDoneTransition<Target, State, Context>

export interface TypedSetup<Context, MachineEvent extends Event> {
  machine<
    const States extends object,
    Initial extends keyof States & string
  >(
    initial: Initial,
    states: States & TargetCheck<States>,
    context: Context,
    opts?: { loopLimit?: number }
  ): MachineStore<NestedPaths<States>, Context, MachineEvent>

  state<
    const StateTransitions extends Transition<string | null, string, any, any, any>[]
  >(
    ...transitions: StateTransitions
  ): StateConfig<StateTransitions, never, never, Context>

  state<const Config extends StateConfig<any, any, any, Context, any, any>>(
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

  onDone<
    Target extends string,
    State extends string = string
  >(
    target: Target,
    opts?: OnDoneOptions<State, Context>
  ): OnDoneTransition<Target, State, Context>
}

export function setup<
  Context,
  MachineEvent extends Event = Event
>(): TypedSetup<Context, MachineEvent>
