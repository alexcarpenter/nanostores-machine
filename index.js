import { atom, onMount } from 'nanostores'
import { ANY, findTransition, list, normalizeState, runStarts } from './shared.js'

let validate = (initial, states) => {
  if (!states[initial]) {
    throw new Error(`nanostores-machine unknown initial state "${initial}"`)
  }
  for (let stateName in states) {
    let config = states[stateName]
    for (let transition of config.on.concat(config.always)) {
      if (!states[transition.target]) {
        throw new Error(
          `nanostores-machine unknown transition target "${transition.target}"`
        )
      }
    }
  }
}

/* @__NO_SIDE_EFFECTS__ */
export let machine = (initial, states, context, opts = {}) => {
  if (process.env.NODE_ENV !== 'production') validate(initial, states)

  let stateConfig = states[initial]
  let $machine = atom({
    context,
    done: !!stateConfig?.final,
    state: initial
  })
  let cleanups = []
  let listeners = []
  let loopLimit = opts.loopLimit || 100

  let cleanDelay = () => {
    for (let cleanup of cleanups) cleanup()
    cleanups = []
  }

  let enter = (stateName, event, loop = 0) => {
    let config = states[stateName]
    for (let entry of list(config?.entry)) {
      if (typeof entry === 'function') entry({ ...$machine.get(), event })
    }
    if (config?.final) return

    runStarts($machine, config, cleanup => {
      cleanups.push(cleanup)
    })

    let next = findTransition(config.always, event, $machine.get())
    if (next) {
      if (loop >= loopLimit) {
        if (process.env.NODE_ENV !== 'production') {
          throw new Error('nanostores-machine always transition loop limit')
        }
        return
      }
      applyTransition(next, event, loop + 1)
    }
  }

  let applyTransition = (transition, event, loop = 0) => {
    let snapshot = $machine.get()
    let from = states[snapshot.state]
    let target = transition.target
    let to = states[target]
    let nextContext = transition.reduce
      ? transition.reduce({ ...snapshot, event })
      : snapshot.context

    cleanDelay()
    from?.exit?.({ ...snapshot, event })
    let nextSnapshot = {
      context: nextContext,
      done: !!to?.final,
      state: target
    }
    $machine.set(nextSnapshot)
    enter(target, event, loop)
    transition.action?.({ ...$machine.get(), event })
    for (let listener of listeners) {
      listener({
        event,
        from: snapshot,
        to: $machine.get()
      })
    }
  }

  $machine.send = event => {
    if (
      process.env.NODE_ENV !== 'production' &&
      typeof event !== 'string' &&
      typeof event?.type !== 'string'
    ) {
      throw new Error(
        'nanostores-machine event must be a string or object with a string type'
      )
    }

    let snapshot = $machine.get()
    if (snapshot.done) return

    let transition = findTransition(states[snapshot.state]?.on || [], event, snapshot)
    if (transition) applyTransition(transition, event)
  }

  onMount($machine, () => {
    enter(initial)
    return cleanDelay
  })

  $machine.listenTransitions = listener => {
    listeners.push(listener)
    return () => {
      let index = listeners.indexOf(listener)
      if (index !== -1) listeners.splice(index, 1)
    }
  }

  return $machine
}

/* @__NO_SIDE_EFFECTS__ */
export let state = (...args) => normalizeState(args)

/* @__NO_SIDE_EFFECTS__ */
export let setup = () => ({ machine, state, transition })

/* @__NO_SIDE_EFFECTS__ */
export let transition = (event, target, opts = {}) => ({
  action: opts.action,
  event: event == null ? ANY : event,
  guard: opts.guard,
  reduce: opts.reduce,
  target
})
