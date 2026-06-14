import { machine, setup, state, transition } from '../index.js'
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

interface LoginContext {
  error?: string
  token?: string
  username: string
}

type LoginEvent =
  | { type: 'submit'; username: string }
  | { type: 'cancel' }
  | { type: 'resolve'; token: string }

let typed = setup<LoginContext, LoginEvent>()

let $login = typed.machine(
  'idle',
  {
    idle: typed.state(
      typed.transition('submit', 'submitting', {
        guard: ({ context, event }) => {
          context.username satisfies string
          event.username satisfies string
          return event.username.length > 0
        },
        reduce: ({ context, event }) => ({
          ...context,
          username: event.username
        })
      })
    ),
    submitting: typed.state({
      on: [
        typed.transition('cancel', 'idle'),
        typed.transition('resolve', 'success', {
          reduce: ({ context, event }) => ({
            ...context,
            token: event.token
          })
        })
      ]
    }),
    success: typed.state({ final: true })
  },
  { username: '' }
)

$login.send({ type: 'submit', username: 'alex' })
$login.send('cancel')
$login.send({ type: 'resolve', token: 'secret' })

let loginSnapshot = $login.get()
loginSnapshot.context.username satisfies string
loginSnapshot.state satisfies 'idle' | 'submitting' | 'success'
