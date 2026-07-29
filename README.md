# Nano Stores Machine

Tiny flat state machines for Nano Stores. Define states and transitions as a small store, then connect it to any UI framework or use it directly in JavaScript. The core keeps the model intentionally simple: no actors, nested states, parallel states, or XState compatibility layer.

- **Small.** The core measures `668 B` minified and brotlied with dependencies.
- **Nano Stores native.** A machine is a store with `get()`, `listen()`, `subscribe()`, `send()`, and transition listeners.
- **Predictable.** Guards decide whether transitions run; reducers update context; entry, exit, and action callbacks handle effects.
- **Modular.** Timers, async services, and debugging live in separate entrypoints.
- **Node.js.** Requires Node.js 20 or later.

```js
import { machine, state, transition } from '@alexcarpenter/machine'

const $toggle = machine('off', {
  off: state(transition('toggle', 'on')),
  on: state(transition('toggle', 'off'))
})

$toggle.send('toggle')
$toggle.get() //=> { state: 'on', context: undefined, done: false }
```

## Install

Requires Node.js 20 or later.

```sh
pnpm add nanostores @alexcarpenter/machine
```

## Guide

### Context and transitions

Pass an initial context as the third argument. Guards can read it and reducers can return the next context:

```js
import { machine, state, transition } from '@alexcarpenter/machine'

const $form = machine('idle', {
  idle: state(transition('submit', 'loading', {
    guard: ({ context }) => context.valid,
    reduce: ({ context, event }) => ({ ...context, submittedAt: event.time })
  })),
  loading: state({ final: true })
}, { valid: true })

$form.send({ type: 'submit', time: Date.now() })
```

Events can be strings or objects with a `type` string. A transition ignores events that are not configured for the current state.

For stronger context and event inference, create typed helpers with `setup()`:

```ts
import { setup } from '@alexcarpenter/machine'

interface LoginContext { username: string }
type LoginEvent =
  | { type: 'submit'; username: string }
  | { type: 'cancel' }

const { machine, state, transition } = setup<LoginContext, LoginEvent>()
const $login = machine('idle', {
  idle: state(transition('submit', 'submitting', {
    guard: ({ event }) => event.username.length > 0,
    reduce: ({ context, event }) => ({ ...context, username: event.username })
  })),
  submitting: state(transition('cancel', 'idle'))
}, { username: '' })

$login.send({ type: 'submit', username: 'alex' })
```

### Lifecycle

State configuration supports `entry`, `exit`, `on`, `always`, and `final`:

```js
import { keepMount } from 'nanostores'
import { machine, state, transition } from '@alexcarpenter/machine'

const $request = machine('idle', {
  idle: state(transition('start', 'loading')),
  loading: state({
    entry: () => console.log('loading'),
    exit: () => console.log('done'),
    on: [transition('resolve', 'success')]
  }),
  success: state({ final: true })
})

keepMount($request)
$request.send('start')
```

Lifecycle work is lazy. Entry handlers, delays, and invokes start when the machine is mounted by `listen()`, `subscribe()`, `useStore()`, or `keepMount()`.

### Always transitions

Always transitions run when a state is entered. A loop limit protects against infinite transient cycles:

```js
import { keepMount } from 'nanostores'
import { machine, state, transition } from '@alexcarpenter/machine'

const $session = machine('checking', {
  checking: state({
    always: transition(null, 'signedIn', {
      guard: ({ context }) => context.user != null
    })
  }),
  signedIn: state(),
  signedOut: state()
}, { user: { id: '1' } })

keepMount($session)
```

### Delays

Timer support is optional. A delay starts when its state is mounted and is cleaned up when the state exits:

```js
import { delay } from '@alexcarpenter/machine/delay'
import { keepMount } from 'nanostores'
import { machine, state } from '@alexcarpenter/machine'

const $toast = machine('visible', {
  visible: state({ on: [delay(3000, 'hidden')] }),
  hidden: state({ final: true })
})

keepMount($toast)
```

### Invoke

Promise and callback services are optional. Promise results can drive `done` or `error` transitions:

```js
import { invoke } from '@alexcarpenter/machine/invoke'
import { keepMount } from 'nanostores'
import { machine, state, transition } from '@alexcarpenter/machine'

const $user = machine('loading', {
  loading: state({
    entry: invoke({
      src: ({ signal }) => fetch('/api/user', { signal }).then(r => r.json()),
      done: 'ready', error: 'failed'
    })
  }),
  ready: state({ final: true }),
  failed: state(transition('retry', 'loading'))
})

keepMount($user)
```

Invoke ignores late promise results after state exit and aborts the provided `AbortSignal` during cleanup.

### Debug

Transition logging is optional:

```js
import { debug } from '@alexcarpenter/machine/debug'

const stop = debug($user, { name: 'user' })
stop()
```

The default output is:

```txt
[user] loading -- done --> ready
```

## Integration

### React

Install the Nano Stores React binding separately:

```sh
pnpm add @nanostores/react
```

Then connect the machine store with `useStore`:

```tsx
import { useStore } from '@nanostores/react'
import { machine, state, transition } from '@alexcarpenter/machine'

const $toggle = machine('off', {
  off: state(transition('toggle', 'on')),
  on: state(transition('toggle', 'off'))
})

export function ToggleButton() {
  const toggle = useStore($toggle)

  return (
    <button onClick={() => $toggle.send('toggle')}>
      {toggle.state === 'on' ? 'On' : 'Off'}
    </button>
  )
}
```

## API

### `machine(initial, states, context?, opts?)`

Creates a Nano Stores machine. The store value is:

```ts
{
  state: string
  context: unknown
  done: boolean
}
```

The returned store has these extra methods:

```ts
$machine.send(event)
$machine.listenTransitions(listener)
```

`send()` accepts strings or event objects. `listenTransitions()` returns a cleanup function.

### `setup<Context, Event>()`

Returns typed `machine`, `state`, and `transition` helpers. Use it when you want callback arguments and `send()` calls to be checked against your context and event union.

### `state(...transitions)`

Creates a state with event transitions:

```js
state(transition('toggle', 'on'))
```

### `state(config)`

Creates a state with lifecycle options:

```js
state({
  entry: [() => {}, invoke({ src, done: 'ready' })],
  exit: () => {},
  on: [transition('retry', 'loading')],
  always: transition(null, 'ready'),
  final: true
})
```

### `transition(event, target, opts?)`

Creates an event transition. `event` can be a string or `null` for `always`:

```js
transition('submit', 'loading', {
  guard: ({ context, event }) => true,
  reduce: ({ context, event }) => context,
  action: ({ context, event }) => {}
})
```

### `delay(ms, target, opts?)`

Creates a delayed transition from `@alexcarpenter/machine/delay`.

### `debug(machine, opts?)`

Logs transitions from `@alexcarpenter/machine/debug`. Options are:

```ts
{
  name?: string
  event?: boolean
  snapshot?: boolean
  logger?: (...args: any[]) => void
}
```

### `invoke(opts)`

Starts a promise or callback service from `@alexcarpenter/machine/invoke`:

```js
invoke({
  src: ({ context, signal, send }) => Promise.resolve(),
  done: 'ready',
  error: 'failed'
})
```

`src` can return a promise, nothing, or a cleanup function.

## Development

Clone the repository, install its dependencies, and run the complete check suite:

```sh
git clone https://github.com/alexcarpenter/machine.git
cd machine
pnpm install
pnpm test
```

The test command runs linting, runtime tests, type checks, and bundle-size checks. Development builds also throw for unknown initial states, unknown transition targets, invalid event objects, and infinite `always` loops. Production builds can remove these checks through `process.env.NODE_ENV`.

## License

MIT © Alex Carpenter

## Links

- [Repository](https://github.com/alexcarpenter/machine)
- [Issues](https://github.com/alexcarpenter/machine/issues)
- [Changelog](https://github.com/alexcarpenter/machine/blob/main/CHANGELOG.md)
