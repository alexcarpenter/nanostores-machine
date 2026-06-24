import { machine, setup, state, transition } from '../index.js'
import { debug } from '../debug/index.js'
import { delay } from '../delay/index.js'
import { invoke } from '../invoke/index.js'
import {
  machine as nestedMachine,
  onDone,
  setup as nestedSetup,
  state as nestedState,
  transition as nestedTransition
} from '../nested/index.js'

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

debug($login, {
  logger: message => {
    message satisfies string
  },
  name: 'login'
})

let $nested = nestedMachine(
  'auth',
  {
    auth: nestedState({
      initial: 'idle',
      onDone: onDone('complete', {
        reduce: ({ context, event }) => {
          event.type satisfies 'nanostores-machine:done'
          event.state satisfies string
          return {
            ...context,
            completed: event.state
          }
        }
      }),
      states: {
        idle: nestedState(nestedTransition('submit', 'auth.loading')),
        loading: nestedState(nestedTransition('resolve', 'auth.success')),
        success: nestedState({ final: true })
      }
    }),
    complete: nestedState({ final: true })
  },
  { completed: '' }
)

$nested.send('submit')
$nested.send({ type: 'resolve' })
$nested.matches('auth') satisfies boolean
$nested.matches('auth.loading') satisfies boolean

let nestedSnapshot = $nested.get()
nestedSnapshot.context.completed satisfies string
nestedSnapshot.state satisfies
  | 'auth'
  | 'auth.idle'
  | 'auth.loading'
  | 'auth.success'
  | 'complete'

let nestedTyped = nestedSetup<LoginContext, LoginEvent>()

let $nestedLogin = nestedTyped.machine(
  'auth',
  {
    auth: nestedTyped.state({
      initial: 'idle',
      states: {
        idle: nestedTyped.state(
          nestedTyped.transition('submit', 'auth.submitting', {
            reduce: ({ context, event }) => ({
              ...context,
              username: event.username
            })
          })
        ),
        submitting: nestedTyped.state(
          nestedTyped.transition('cancel', 'auth.idle')
        )
      }
    })
  },
  { username: '' }
)

$nestedLogin.send({ type: 'submit', username: 'alex' })
$nestedLogin.send('cancel')
