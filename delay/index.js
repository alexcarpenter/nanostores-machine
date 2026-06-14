export let delay = (ms, target, opts = {}) => ({
  action: opts.action,
  event: `nanostores-machines:delay:${ms}`,
  guard: opts.guard,
  reduce: opts.reduce,
  start($machine) {
    let id = setTimeout(() => {
      $machine.send({
        type: `nanostores-machines:delay:${ms}`
      })
    }, ms)
    return () => clearTimeout(id)
  },
  target
})
