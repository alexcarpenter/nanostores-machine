export let delay = (ms, target, opts = {}) => ({
  action: opts.action,
  event: `machine:delay:${ms}`,
  guard: opts.guard,
  reduce: opts.reduce,
  start($machine) {
    let id = setTimeout(() => {
      $machine.send({
        type: `machine:delay:${ms}`
      })
    }, ms)
    return () => clearTimeout(id)
  },
  target
})
