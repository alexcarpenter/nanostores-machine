const DONE = 'nanostores-machines:invoke:done'
const ERROR = 'nanostores-machines:invoke:error'

let transition = (event, target, opts) => ({
  action: opts.action,
  event,
  guard: opts.guard,
  reduce: opts.reduce,
  target
})

export let invoke = opts => ({
  start($machine) {
    let active = true
    let controller = new AbortController()
    let cleanup
    let result = opts.src({
      ...$machine.get(),
      send: $machine.send,
      signal: controller.signal
    })

    if (result?.then) {
      result.then(
        output => {
          if (active) $machine.send({ output, type: DONE })
        },
        error => {
          if (active) $machine.send({ error, type: ERROR })
        }
      )
    } else if (typeof result === 'function') {
      cleanup = result
    }

    return () => {
      active = false
      controller.abort()
      cleanup?.()
    }
  },
  transitions: [
    opts.done && transition(DONE, opts.done, opts),
    opts.error && transition(ERROR, opts.error, opts)
  ].filter(Boolean)
})
