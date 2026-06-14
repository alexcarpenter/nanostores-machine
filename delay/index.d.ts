import type { Transition, TransitionOptions } from '../index.js'

export function delay<
  Target extends string,
  State extends string = string,
  Context = any
>(
  ms: number,
  target: Target,
  opts?: TransitionOptions<State, Context, { type: string }>
): Transition<string, Target, State, Context>
