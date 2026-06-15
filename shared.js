export const ANY = Symbol()

export let typeOf = event => (typeof event === 'string' ? event : event.type)

export let list = value => (Array.isArray(value) ? value : value ? [value] : [])

export let entryTransitions = entry => {
  let transitions = []
  for (let item of list(entry)) {
    transitions = transitions.concat(list(item?.transitions))
  }
  return transitions
}

export let normalizeState = (
  args,
  configExtra = () => ({}),
  transitionsExtra = () => ({})
) => {
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
      on: list(config.on).concat(entryTransitions(config.entry)),
      ...configExtra(config)
    }
  }
  return {
    always: [],
    final: false,
    on: args,
    ...transitionsExtra()
  }
}

export let findTransition = (transitions, event, snapshot) => {
  for (let transition of transitions) {
    if (transition.event === ANY || transition.event === typeOf(event)) {
      if (!transition.guard || transition.guard({ ...snapshot, event })) {
        return transition
      }
    }
  }
}

export let runStarts = ($machine, stateConfig, addCleanup) => {
  for (let entry of list(stateConfig.entry)) {
    if (entry.start) {
      addCleanup(entry.start($machine))
    }
  }
  for (let transition of stateConfig.on) {
    if (transition.start) {
      addCleanup(transition.start($machine))
    }
  }
}
