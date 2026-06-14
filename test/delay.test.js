import { equal } from 'node:assert/strict'
import { test } from 'node:test'
import { cleanStores, keepMount } from 'nanostores'
import { machine, state } from '../index.js'
import { delay } from '../delay/index.js'

test('runs delay transitions', async () => {
  let $machine = machine('visible', {
    visible: state({
      on: [delay(5, 'hidden')]
    }),
    hidden: state({ final: true })
  })

  keepMount($machine)
  await new Promise(resolve => setTimeout(resolve, 10))
  equal($machine.get().state, 'hidden')
  cleanStores($machine)
})

test('clears delay on state exit', async () => {
  let $machine = machine('visible', {
    visible: state({
      on: [delay(20, 'hidden')]
    }),
    hidden: state({ final: true })
  })

  keepMount($machine)
  cleanStores($machine)
  await new Promise(resolve => setTimeout(resolve, 30))
  equal($machine.get().state, 'visible')
})
