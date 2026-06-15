import { deepStrictEqual, equal, throws } from 'node:assert/strict'
import { test } from 'node:test'
import { cleanStores, keepMount } from 'nanostores'
import { debug } from '../debug/index.js'
import { delay } from '../delay/index.js'
import { invoke } from '../invoke/index.js'
import { machine, onDone, state, transition } from '../nested/index.js'

test('resolves nested initial states', () => {
  let $machine = machine('auth', {
    auth: state({
      initial: 'idle',
      states: {
        idle: state()
      }
    })
  })

  deepStrictEqual($machine.get(), {
    context: undefined,
    done: false,
    state: 'auth.idle'
  })
})

test('transitions with explicit dot-path targets', () => {
  let $machine = machine('auth', {
    auth: state({
      initial: 'idle',
      states: {
        idle: state(transition('submit', 'auth.loading')),
        loading: state()
      }
    })
  })

  $machine.send('submit')
  equal($machine.get().state, 'auth.loading')
})

test('falls back to parent transitions', () => {
  let $machine = machine('auth', {
    auth: state({
      initial: 'loading',
      on: [transition('cancel', 'signedOut')],
      states: {
        loading: state(),
        retrying: state()
      }
    }),
    signedOut: state()
  })

  $machine.send('cancel')
  equal($machine.get().state, 'signedOut')
})

test('prefers leaf transitions over parent transitions', () => {
  let $machine = machine('auth', {
    auth: state({
      initial: 'idle',
      on: [transition('cancel', 'signedOut')],
      states: {
        idle: state(transition('cancel', 'auth.confirm')),
        confirm: state()
      }
    }),
    signedOut: state()
  })

  $machine.send('cancel')
  equal($machine.get().state, 'auth.confirm')
})

test('runs leaf lifecycle', () => {
  let calls = []
  let $machine = machine('auth', {
    auth: state({
      initial: 'idle',
      states: {
        idle: state({
          entry: () => calls.push('idle entry'),
          exit: () => calls.push('idle exit'),
          on: [transition('submit', 'auth.loading')]
        }),
        loading: state({
          entry: () => calls.push('loading entry')
        })
      }
    })
  })

  keepMount($machine)
  $machine.send('submit')
  deepStrictEqual(calls, [
    'idle entry',
    'idle exit',
    'loading entry'
  ])
  cleanStores($machine)
})

test('cleans up starters for exited nested states', () => {
  let calls = []
  let $machine = machine('auth', {
    auth: state({
      initial: 'idle',
      states: {
        idle: state({
          entry: {
            start() {
              calls.push('start')
              return () => calls.push('cleanup')
            }
          },
          on: [transition('submit', 'auth.loading')]
        }),
        loading: state()
      }
    })
  })

  keepMount($machine)
  $machine.send('submit')
  deepStrictEqual(calls, ['start', 'cleanup'])
  cleanStores($machine)
})

test('runs always transitions in nested states', () => {
  let $machine = machine('auth', {
    auth: state({
      initial: 'checking',
      states: {
        checking: state({
          always: transition(null, 'auth.ready')
        }),
        ready: state()
      }
    })
  })

  keepMount($machine)
  equal($machine.get().state, 'auth.ready')
  cleanStores($machine)
})

test('runs parent onDone when a child reaches final', () => {
  let $machine = machine(
    'auth',
    {
      auth: state({
        initial: 'idle',
        onDone: onDone('complete', {
          reduce: ({ context, event }) => ({
            ...context,
            completed: event.state
          })
        }),
        states: {
          idle: state(transition('finish', 'auth.success')),
          success: state({ final: true })
        }
      }),
      complete: state({ final: true })
    },
    { completed: '' }
  )

  $machine.send('finish')
  deepStrictEqual($machine.get(), {
    context: { completed: 'auth.success' },
    done: true,
    state: 'complete'
  })
})

test('lets ancestors handle events when onDone does not transition', () => {
  let $machine = machine('auth', {
    auth: state({
      initial: 'idle',
      on: [transition('reset', 'auth.idle')],
      onDone: onDone('complete', {
        guard: () => false
      }),
      states: {
        idle: state(transition('finish', 'auth.success')),
        success: state({
          final: true,
          on: [transition('edit', 'auth.idle')]
        })
      }
    }),
    complete: state()
  })

  $machine.send('finish')
  equal($machine.get().state, 'auth.success')
  $machine.send('edit')
  equal($machine.get().state, 'auth.success')
  $machine.send('reset')
  equal($machine.get().state, 'auth.idle')
})

test('supports delay and invoke inside nested states', async () => {
  let $machine = machine('flow', {
    flow: state({
      initial: 'waiting',
      states: {
        waiting: state({
          on: [delay(5, 'flow.loading')]
        }),
        loading: state({
          entry: invoke({
            done: 'flow.complete',
            src: () => Promise.resolve()
          })
        }),
        complete: state({ final: true })
      }
    })
  })

  keepMount($machine)
  await new Promise(resolve => setTimeout(resolve, 10))
  await Promise.resolve()
  equal($machine.get().state, 'flow.complete')
  cleanStores($machine)
})

test('debug logs dot-path states', () => {
  let calls = []
  let $machine = machine('auth', {
    auth: state({
      initial: 'idle',
      states: {
        idle: state(transition('submit', 'auth.loading')),
        loading: state()
      }
    })
  })

  debug($machine, {
    logger: message => calls.push(message),
    name: 'nested'
  })
  $machine.send('submit')

  deepStrictEqual(calls, ['[nested] auth.idle -- submit --> auth.loading'])
})

test('validates nested configs in development', () => {
  throws(() => {
    machine('auth', {
      auth: state({
        initial: 'missing',
        states: {
          idle: state()
        }
      })
    })
  }, /unknown initial state "auth.missing"/)

  throws(() => {
    machine('auth', {
      auth: state({
        initial: 'bad.name',
        states: {
          'bad.name': state()
        }
      })
    })
  }, /state names cannot contain "\."/)

  throws(() => {
    machine('auth', {
      auth: state({
        initial: 'idle',
        states: {
          idle: state(transition('go', 'auth.missing'))
        }
      })
    })
  }, /unknown transition target "auth.missing"/)
})
