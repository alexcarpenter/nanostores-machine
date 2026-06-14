import type {
  CallbackArgs,
  EntryStart,
  EventObject,
  TransitionOptions
} from '../index.js'

export interface InvokeArgs<State extends string, Context>
  extends CallbackArgs<State, Context, undefined> {
  send(event: string | EventObject): void
  signal: AbortSignal
}

export interface InvokeOptions<
  Done extends string | undefined = string | undefined,
  ErrorState extends string | undefined = string | undefined,
  State extends string = string,
  Context = any
> extends TransitionOptions<State, Context, EventObject> {
  src(args: InvokeArgs<State, Context>): Promise<unknown> | void | (() => void)
  done?: Done
  error?: ErrorState
}

export function invoke<
  Done extends string | undefined = string | undefined,
  ErrorState extends string | undefined = string | undefined,
  State extends string = string,
  Context = any
>(opts: InvokeOptions<Done, ErrorState, State, Context>): EntryStart<State, Context>
