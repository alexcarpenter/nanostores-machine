import { machine as flatMachine, transition } from '../index.js'
import { list, normalizeState as normalize } from '../shared.js'

const DONE = 'nanostores-machine:done'

let normalizeState = args =>
  normalize(
    args,
    config => ({
      initial: config.initial,
      onDone: list(config.onDone),
      states: config.states
    }),
    () => ({ onDone: [] })
  )

let childPath = (parent, child) => (parent ? `${parent}.${child}` : child)

let getConfig = (states, path) => {
  let parts = path.split('.')
  let config = states[parts[0]]
  for (let i = 1; i < parts.length; i++) {
    config = config?.states?.[parts[i]]
  }
  return config
}

let resolveInitial = (states, path) => {
  let config = getConfig(states, path)
  while (config?.states) {
    path = childPath(path, config.initial)
    config = getConfig(states, path)
  }
  return path
}

let done = path => ({
  start($machine) {
    let snapshot = $machine.get()
    $machine.send({
      context: snapshot.context,
      state: path,
      type: DONE
    })
    return () => {}
  }
})

let retarget = (states, transitions) =>
  list(transitions).map(item => ({
    ...item,
    target: resolveInitial(states, item.target)
  }))

let flatten = (root, states, flat = {}, parent = '', parents = []) => {
  for (let name in states) {
    if (process.env.NODE_ENV !== 'production' && name.includes('.')) {
      throw new Error('nanostores-machine state names cannot contain "."')
    }

    let path = childPath(parent, name)
    let config = states[name]

    if (config.states) {
      if (
        process.env.NODE_ENV !== 'production' &&
        (!config.initial || !config.states[config.initial])
      ) {
        throw new Error(
          `nanostores-machine unknown initial state "${childPath(
            path,
            config.initial
          )}"`
        )
      }
      flatten(root, config.states, flat, path, parents.concat(config))
    } else {
      let parentConfig = parents[parents.length - 1]
      let entry = config.entry
      let on = config.final ? [] : retarget(root, config.on)

      if (config.final && parentConfig?.onDone.length) {
        entry = list(entry).concat(done(path))
        on = on.concat(retarget(root, parentConfig.onDone))
      }

      for (let i = parents.length - 1; i >= 0; i--) {
        on = on.concat(retarget(root, parents[i].on))
      }

      flat[path] = normalizeState([
        {
          always: config.final ? [] : retarget(root, config.always),
          entry,
          exit: config.exit,
          final: config.final && !parent,
          on
        }
      ])
    }
  }
  return flat
}

/* @__NO_SIDE_EFFECTS__ */
export let machine = (initial, states, context, opts) => {
  let $machine = flatMachine(
    resolveInitial(states, initial),
    flatten(states, states),
    context,
    opts
  )
  $machine.matches = query =>
    ($machine.get().state + '.').startsWith(query + '.')
  return $machine
}

/* @__NO_SIDE_EFFECTS__ */
export let onDone = (target, opts) => transition(DONE, target, opts)

/* @__NO_SIDE_EFFECTS__ */
export let state = (...args) => normalizeState(args)

/* @__NO_SIDE_EFFECTS__ */
export let setup = () => ({ machine, onDone, state, transition })

export { transition }
