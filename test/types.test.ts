import { machine, state, transition } from '../index.js'
import { delay } from '../delay/index.js'
import { invoke } from '../invoke/index.js'

let $form = machine(
  'idle',
  {
    idle: state({
      on: [
        transition('submit', 'loading', {
          guard: ({ context }) => context.valid,
          reduce: ({ context, event }) => ({
            ...context,
            lastType: event.type
          })
        })
      ]
    }),
    loading: state({
      entry: [
        () => {},
        invoke({
          done: 'success',
          src: () => Promise.resolve()
        })
      ],
      on: [delay(1, 'success')]
    }),
    success: state({ final: true })
  },
  { lastType: '', valid: true }
)

$form.send('submit')
$form.send({ type: 'submit', value: 1 })

let snapshot = $form.get()
snapshot.context.valid satisfies boolean
snapshot.state satisfies 'idle' | 'loading' | 'success'
