import { deepStrictEqual, equal, throws } from 'node:assert/strict'
import { test } from 'node:test'
import { cleanStores, keepMount } from 'nanostores'
import { machine, state, transition } from '../index.js'

test('changes state on event', () => {
  let $machine = machine('off', {
    off: state(transition('toggle', 'on')),
    on: state(transition('toggle', 'off'))
  })

  $machine.send('toggle')
  equal($machine.get().state, 'on')
})

test('ignores unknown events', () => {
  let $machine = machine('idle', {
    idle: state(transition('start', 'active')),
    active: state()
  })

  $machine.send('stop')
  equal($machine.get().state, 'idle')
})

test('supports guards and reducers', () => {
  let $machine = machine(
    'idle',
    {
      idle: state(
        transition('submit', 'done', {
          guard: ({ context }) => context.valid,
          reduce: ({ context }) => ({ ...context, count: context.count + 1 })
        })
      ),
      done: state({ final: true })
    },
    { count: 0, valid: false }
  )

  $machine.send('submit')
  deepStrictEqual($machine.get(), {
    context: { count: 0, valid: false },
    done: false,
    state: 'idle'
  })

  $machine.set({
    context: { count: 0, valid: true },
    done: false,
    state: 'idle'
  })
  $machine.send('submit')
  deepStrictEqual($machine.get(), {
    context: { count: 1, valid: true },
    done: true,
    state: 'done'
  })
})

test('runs exit, entry, and action in order', () => {
  let calls = []
  let $machine = machine('idle', {
    idle: state({
      exit() {
        calls.push('exit')
      },
      on: [
        transition('start', 'active', {
          action() {
            calls.push('action')
          }
        })
      ]
    }),
    active: state({
      entry() {
        calls.push('entry')
      }
    })
  })

  $machine.send('start')
  deepStrictEqual(calls, ['exit', 'entry', 'action'])
})

test('supports multiple entry handlers and cleans up starters', () => {
  let calls = []
  let $machine = machine('idle', {
    idle: state(transition('start', 'active')),
    active: state({
      entry: [
        () => {
          calls.push('entry')
        },
        {
          start() {
            calls.push('start')
            return () => {
              calls.push('cleanup')
            }
          }
        }
      ],
      on: [transition('stop', 'idle')]
    })
  })

  $machine.send('start')
  $machine.send('stop')
  deepStrictEqual(calls, ['entry', 'start', 'cleanup'])
})

test('runs always transitions on mount and after entering state', () => {
  let $machine = machine(
    'checking',
    {
      checking: state({
        always: transition(null, 'ready', {
          guard: ({ context }) => context.ok
        })
      }),
      ready: state()
    },
    { ok: true }
  )

  keepMount($machine)
  equal($machine.get().state, 'ready')
  cleanStores($machine)
})

test('throws on unknown initial states in development', () => {
  throws(() => {
    machine('missing', {
      idle: state()
    })
  }, /unknown initial state "missing"/)
})

test('throws on unknown transition targets in development', () => {
  throws(() => {
    machine('idle', {
      idle: state(transition('start', 'missing'))
    })
  }, /unknown transition target "missing"/)
})

test('throws on invalid events in development', () => {
  let $machine = machine('idle', {
    idle: state()
  })

  throws(() => {
    $machine.send({})
  }, /event must be a string or object with a string type/)
})

test('stops sending from final states', () => {
  let $machine = machine('idle', {
    idle: state(transition('finish', 'done')),
    done: state({
      final: true,
      on: [transition('reset', 'idle')]
    })
  })

  $machine.send('finish')
  $machine.send('reset')
  equal($machine.get().state, 'done')
})

test('throws on always transition loops in development', () => {
  let $machine = machine(
    'a',
    {
      a: state({ always: transition(null, 'b') }),
      b: state({ always: transition(null, 'a') })
    },
    undefined,
    { loopLimit: 2 }
  )

  throws(() => {
    keepMount($machine)
  }, /always transition loop limit/)
  cleanStores($machine)
})
