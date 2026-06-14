# Nano Stores Machines

Tiny flat state machines for [Nano Stores](https://github.com/nanostores/nanostores).

* **Small.** Core is checked by Size Limit and has no runtime dependencies except
  Nano Stores.
* **Nano Stores native.** A machine is a store with `get()`, `listen()`,
  `subscribe()`, and `send()`.
* **Tree-shakable.** Timers and async services live in separate entrypoints.
* **Flat by design.** No actors, nested states, parallel states, or XState
  compatibility layer in core.

```js
import { machine, state, transition } from 'nanostores-machines'

export const $toggle = machine('off', {
  off: state(transition('toggle', 'on')),
  on: state(transition('toggle', 'off'))
})

$toggle.send('toggle')
$toggle.get() //=> { state: 'on', context: undefined, done: false }
```

## Install

```sh
pnpm add nanostores nanostores-machines
```

## Guide

### Context

```js
export const $form = machine(
  'idle',
  {
    idle: state(
      transition('submit', 'loading', {
        guard: ({ context }) => context.valid,
        reduce: ({ context, event }) => ({
          ...context,
          submittedAt: event.time
        })
      })
    ),
    loading: state({ final: true })
  },
  { valid: true }
)

$form.send({ type: 'submit', time: Date.now() })
```

### Lifecycle

```js
const $request = machine('idle', {
  idle: state(transition('start', 'loading')),
  loading: state({
    entry: () => console.log('loading'),
    exit: () => console.log('done'),
    on: [transition('resolve', 'success')]
  }),
  success: state({ final: true })
})
```

Lifecycle work is lazy. Entry handlers, delays, and invokes start when the
machine is mounted by `listen()`, `subscribe()`, `useStore()`, or `keepMount()`.

### Always

```js
const $session = machine('checking', {
  checking: state({
    always: transition(null, 'signedIn', {
      guard: ({ context }) => context.user != null
    })
  }),
  signedIn: state(),
  signedOut: state()
}, {
  user: { id: '1' }
})
```

Always transitions run when a state is entered. A loop limit protects against
infinite transient cycles.

### Delays

Timer support is optional:

```js
import { delay } from 'nanostores-machines/delay'

const $toast = machine('visible', {
  visible: state({
    on: [delay(3000, 'hidden')]
  }),
  hidden: state({ final: true })
})
```

### Invoke

Promise and callback services are optional:

```js
import { invoke } from 'nanostores-machines/invoke'

const $user = machine('loading', {
  loading: state({
    entry: invoke({
      src: ({ signal }) => fetch('/api/user', { signal }).then(r => r.json()),
      done: 'ready',
      error: 'failed',
      reduce: ({ context, event }) => ({
        ...context,
        user: event.output
      })
    })
  }),
  ready: state({ final: true }),
  failed: state(transition('retry', 'loading'))
}, {
  user: undefined
})
```

Invoke ignores late promise results after state exit and aborts the provided
`AbortSignal` on cleanup.

## Integration

### React

Use the normal Nano Stores React binding:

```tsx
import { useStore } from '@nanostores/react'
import { machine, state, transition } from 'nanostores-machines'

const $toggle = machine('off', {
  off: state(transition('toggle', 'on')),
  on: state(transition('toggle', 'off'))
})

export function ToggleButton() {
  let toggle = useStore($toggle)

  return (
    <button onClick={() => $toggle.send('toggle')}>
      {toggle.state === 'on' ? 'On' : 'Off'}
    </button>
  )
}
```

## API

### `machine(initial, states, context?, opts?)`

Creates a Nano Store machine. The store value is:

```ts
{
  state: string
  context: unknown
  done: boolean
}
```

The returned store has one extra method:

```ts
$machine.send(event)
```

Events can be strings or objects with a `type` string.

### `state(...transitions)`

Creates a state with event transitions.

```js
state(transition('toggle', 'on'))
```

### `state(config)`

Creates a state with lifecycle options.

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

Creates an event transition. `event` can be a string or `null` for `always`.

```js
transition('submit', 'loading', {
  guard: ({ context, event }) => true,
  reduce: ({ context, event }) => context,
  action: ({ context, event }) => {}
})
```

### `delay(ms, target, opts?)`

Creates a delayed transition from `nanostores-machines/delay`.

### `invoke(opts)`

Starts a promise or callback service from `nanostores-machines/invoke`.

```js
invoke({
  src: ({ context, signal, send }) => Promise.resolve(),
  done: 'ready',
  error: 'failed'
})
```

`src` can return a promise, nothing, or a cleanup function.

## Development Checks

Development builds throw for unknown initial states, unknown transition targets,
invalid event objects, and infinite `always` loops. Production builds can remove
these checks through `process.env.NODE_ENV`.
