# Core API

## Create a machine

Compose a flat state map with `machine()`, `state()`, and `transition()`:

```js
import { machine, state, transition } from '@alexcarpenter/machine'

export const $toggle = machine('off', {
  off: state(transition('toggle', 'on')),
  on: state(transition('toggle', 'off'))
})
```

The initial state and every transition target must be a key in the state map. Unknown events are ignored. Events can be strings or objects with a string `type`:

```js
$toggle.send('toggle')
$toggle.send({ type: 'toggle' })
```

## Add context and transition behavior

Pass initial context as the third argument. A guard decides whether a transition runs, a reducer returns the next context, and an action runs after the target state is entered:

```js
const $request = machine(
  'idle',
  {
    idle: state(transition('submit', 'loading', {
      guard: ({ context }) => context.valid,
      reduce: ({ context, event }) => ({
        ...context,
        query: event.query
      }),
      action: ({ context }) => analytics.track('submit', context.query)
    })),
    loading: state()
  },
  { query: '', valid: true }
)
```

Return the complete next context from `reduce`; do not mutate the existing context. Callback arguments contain `{ state, context, done, event }`.

For a taken transition, guards and reducers run before the state changes, the source state's `exit` runs before target entry processing, and the transition `action` runs afterward.

## Use TypeScript inference

Use `setup<Context, Event>()` when event payloads and context should be checked:

```ts
import { setup } from '@alexcarpenter/machine'

interface LoginContext {
  username: string
}

type LoginEvent =
  | { type: 'submit'; username: string }
  | { type: 'cancel' }

const typed = setup<LoginContext, LoginEvent>()

export const $login = typed.machine(
  'idle',
  {
    idle: typed.state(typed.transition('submit', 'submitting', {
      reduce: ({ context, event }) => ({
        ...context,
        username: event.username
      })
    })),
    submitting: typed.state(typed.transition('cancel', 'idle'))
  },
  { username: '' }
)
```

Keep `typed.machine`, `typed.state`, and `typed.transition` together. For an object event with payload, send the complete object rather than only its type string.

## Read and subscribe

Treat the result as a Nano Stores writable atom. `$machine.get()` returns:

```js
{
  state,
  context,
  done
}
```

Use `listen()` or `subscribe()` directly outside a UI framework. Use the framework's Nano Stores binding in UI code.

Observe completed transitions with `listenTransitions()` and call its returned cleanup function:

```js
const stop = $machine.listenTransitions(({ event, from, to }) => {
  console.log(event, from.state, to.state)
})

stop()
```

## Configure lifecycle

Use the object form of `state()` for `entry`, `exit`, `on`, `always`, or `final`:

```js
const $flow = machine('checking', {
  checking: state({
    entry: () => console.log('checking'),
    exit: () => console.log('checked'),
    always: transition(null, 'ready', {
      guard: ({ context }) => context.ready
    }),
    on: [transition('cancel', 'cancelled')]
  }),
  ready: state({ final: true }),
  cancelled: state({ final: true })
}, { ready: true })
```

`entry` accepts one handler or an array. `on` and `always` accept one transition or an array. Use `null` as the event for an always transition. A final state sets `done: true` and ignores further events.

The initial state's lifecycle begins when the Nano Store mounts. Subscribe to the machine or use `keepMount($machine)` when initial entry work must start without a UI subscriber. Pass `{ loopLimit }` as the fourth `machine()` argument only when overriding the default always-transition loop protection is intentional.
