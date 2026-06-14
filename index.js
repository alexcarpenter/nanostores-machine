import { atom, onMount } from 'nanostores'

const ANY = Symbol()

let typeOf = event => (typeof event === 'string' ? event : event.type)

let list = value => (Array.isArray(value) ? value : value ? [value] : [])

let entryTransitions = entry => {
  let transitions = []
  for (let item of list(entry)) {
    transitions = transitions.concat(list(item?.transitions))
  }
  return transitions
}

let normalizeState = args => {
  if (
    args.length === 1 &&
    !args[0]?.event &&
    !args[0]?.target &&
    !args[0]?.start
  ) {
    let config = args[0]
    return {
      always: list(config.always),
      entry: config.entry,
      exit: config.exit,
      final: !!config.final,
      on: list(config.on).concat(entryTransitions(config.entry))
    }
  }
  return {
    always: [],
    final: false,
    on: args
  }
}

let findTransition = (transitions, event, snapshot) => {
  for (let transition of transitions) {
    if (transition.event === ANY || transition.event === typeOf(event)) {
      if (!transition.guard || transition.guard({ ...snapshot, event })) {
        return transition
      }
    }
  }
}

let runStarts = ($machine, stateConfig, cleanups) => {
  for (let entry of list(stateConfig.entry)) {
    if (entry.start) {
      cleanups.push(entry.start($machine))
    }
  }
  for (let transition of stateConfig.on) {
    if (transition.start) {
      cleanups.push(transition.start($machine))
    }
  }
}

let validate = (initial, states) => {
  if (!states[initial]) {
    throw new Error(`nanostores-machines unknown initial state "${initial}"`)
  }
  for (let stateName in states) {
    let config = states[stateName]
    for (let transition of config.on.concat(config.always)) {
      if (!states[transition.target]) {
        throw new Error(
          `nanostores-machines unknown transition target "${transition.target}"`
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

    runStarts($machine, config, cleanups)

    let next = findTransition(config.always, event, $machine.get())
    if (next) {
      if (loop >= loopLimit) {
        if (process.env.NODE_ENV !== 'production') {
          throw new Error('nanostores-machines always transition loop limit')
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
    $machine.set({
      context: nextContext,
      done: !!to?.final,
      state: target
    })
    enter(target, event, loop)
    transition.action?.({ ...$machine.get(), event })
  }

  $machine.send = event => {
    if (
      process.env.NODE_ENV !== 'production' &&
      typeof event !== 'string' &&
      typeof event?.type !== 'string'
    ) {
      throw new Error(
        'nanostores-machines event must be a string or object with a string type'
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

  return $machine
}

/* @__NO_SIDE_EFFECTS__ */
export let state = (...args) => normalizeState(args)

/* @__NO_SIDE_EFFECTS__ */
export let transition = (event, target, opts = {}) => ({
  action: opts.action,
  event: event == null ? ANY : event,
  guard: opts.guard,
  reduce: opts.reduce,
  target
})
