import { setup } from '../index.js'
import {
  machine as nestedMachine,
  state as nestedState,
  transition as nestedTransition
} from '../nested/index.js'

interface LoginContext {
  username: string
}

type LoginEvent =
  | { type: 'submit'; username: string }
  | { type: 'cancel' }

let typed = setup<LoginContext, LoginEvent>()

let $login = typed.machine(
  'idle',
  {
    idle: typed.state(
      typed.transition('submit', 'submitting', {
        guard: ({ event }) => {
          // THROWS Property 'missing' does not exist
          return event.missing.length > 0
        }
      })
    ),
    submitting: typed.state(
      typed.transition('cancel', 'idle')
    )
  },
  { username: '' }
)

// THROWS Argument of type '"submit"' is not assignable
$login.send('submit')

// THROWS Property 'username' is missing
$login.send({ type: 'submit' })

// THROWS Type '"missing"' is not assignable
typed.transition('missing', 'idle')

// THROWS __invalid_transition_targets__
typed.machine(
  'idle',
  {
    idle: typed.state(
      typed.transition('submit', 'missing')
    )
  },
  { username: '' }
)

// THROWS __invalid_transition_targets__
nestedMachine(
  'auth',
  {
    auth: nestedState({
      initial: 'idle',
      states: {
        idle: nestedState(
          nestedTransition('submit', 'auth.missing')
        )
      }
    })
  }
)
