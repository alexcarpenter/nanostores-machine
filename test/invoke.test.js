import { deepStrictEqual, equal } from 'node:assert/strict'
import { test } from 'node:test'
import { cleanStores, keepMount } from 'nanostores'
import { machine, state, transition } from '../index.js'
import { invoke } from '../invoke/index.js'

test('transitions on invoked promise resolve', async () => {
  let $machine = machine('loading', {
    loading: state({
      entry: invoke({
        done: 'success',
        src: () => Promise.resolve('ok')
      })
    }),
    success: state({ final: true })
  })

  keepMount($machine)
  await Promise.resolve()
  deepStrictEqual($machine.get(), {
    context: undefined,
    done: true,
    state: 'success'
  })
  cleanStores($machine)
})

test('transitions on invoked promise rejection', async () => {
  let $machine = machine('loading', {
    loading: state({
      entry: invoke({
        error: 'failure',
        src: () => Promise.reject(new Error('no'))
      })
    }),
    failure: state({ final: true })
  })

  keepMount($machine)
  await Promise.resolve()
  await Promise.resolve()
  equal($machine.get().state, 'failure')
  cleanStores($machine)
})

test('passes invoke output to reducers', async () => {
  let $machine = machine(
    'loading',
    {
      loading: state({
        entry: invoke({
          done: 'success',
          reduce: ({ context, event }) => ({
            ...context,
            value: event.output
          }),
          src: () => Promise.resolve(2)
        })
      }),
      success: state({ final: true })
    },
    { value: 0 }
  )

  keepMount($machine)
  await Promise.resolve()
  deepStrictEqual($machine.get().context, { value: 2 })
  cleanStores($machine)
})

test('ignores invoked promise result after state exit', async () => {
  let resolve
  let $machine = machine('loading', {
    loading: state({
      entry: invoke({
        done: 'success',
        src: () =>
          new Promise(done => {
            resolve = done
          })
      }),
      on: [transition('cancel', 'idle')]
    }),
    idle: state(),
    success: state({ final: true })
  })

  keepMount($machine)
  $machine.send('cancel')
  resolve('late')
  await Promise.resolve()
  equal($machine.get().state, 'idle')
  cleanStores($machine)
})

test('aborts invoked promise on cleanup when supported', () => {
  let aborted = false
  let $machine = machine('loading', {
    loading: state({
      entry: invoke({
        src: ({ signal }) => {
          signal.addEventListener('abort', () => {
            aborted = true
          })
        }
      })
    })
  })

  keepMount($machine)
  cleanStores($machine)
  equal(aborted, true)
})
