let typeOf = event => (typeof event === 'string' ? event : event.type)

export let debug = ($machine, opts = {}) => {
  let logger = opts.logger || console.debug
  let name = opts.name || 'machine'

  return $machine.listenTransitions(({ event, from, to }) => {
    let message = `[${name}] ${from.state} -- ${typeOf(event)} --> ${to.state}`
    if (opts.event && opts.snapshot) {
      logger(message, event, { from, to })
    } else if (opts.event) {
      logger(message, event)
    } else if (opts.snapshot) {
      logger(message, { from, to })
    } else {
      logger(message)
    }
  })
}
