import { deepStrictEqual, equal } from 'node:assert/strict'
import { test } from 'node:test'
import { machine, state, transition } from '../index.js'
import { debug } from '../debug/index.js'

test('logs transitions', () => {
  let calls = []
  let $machine = machine('idle', {
    idle: state(transition('start', 'active')),
    active: state()
  })

  let stop = debug($machine, {
    logger: (...args) => calls.push(args),
    name: 'test'
  })

  $machine.send('start')
  stop()

  deepStrictEqual(calls, [
    ['[test] idle -- start --> active']
  ])
})

test('can include snapshots and events', () => {
  let calls = []
  let $machine = machine(
    'idle',
    {
      idle: state(
        transition('submit', 'done', {
          reduce: ({ context, event }) => ({
            ...context,
            value: event.value
          })
        })
      ),
      done: state({ final: true })
    },
    { value: 0 }
  )

  debug($machine, {
    event: true,
    logger: (...args) => calls.push(args),
    name: 'form',
    snapshot: true
  })

  $machine.send({ type: 'submit', value: 1 })

  equal(calls[0][0], '[form] idle -- submit --> done')
  deepStrictEqual(calls[0][1], { type: 'submit', value: 1 })
  deepStrictEqual(calls[0][2], {
    from: {
      context: { value: 0 },
      done: false,
      state: 'idle'
    },
    to: {
      context: { value: 1 },
      done: true,
      state: 'done'
    }
  })
})

test('removes transition listener on stop', () => {
  let count = 0
  let $machine = machine('a', {
    a: state(transition('next', 'b')),
    b: state(transition('next', 'a'))
  })

  let stop = debug($machine, {
    logger: () => {
      count += 1
    }
  })

  $machine.send('next')
  stop()
  $machine.send('next')

  equal(count, 1)
})
