# Optional Modules

Optional features use separate entrypoints so they do not enter the core bundle unless imported.

## Delays

Use `delay()` as a state transition and mount the machine so a delay in the initial state can start:

```js
import { keepMount } from 'nanostores'
import { machine, state } from '@alexcarpenter/machine'
import { delay } from '@alexcarpenter/machine/delay'

const $toast = machine('visible', {
  visible: state({ on: [delay(3000, 'hidden')] }),
  hidden: state({ final: true })
})

keepMount($toast)
```

`delay(ms, target, options?)` accepts the same `guard`, `reduce`, and `action` options as an event transition. The timer is cleared on state exit or store unmount. Prefer it to an unmanaged `setTimeout()` for state transitions.

## Invoked services

Use `invoke()` in `entry` for a promise or callback service:

```js
import { keepMount } from 'nanostores'
import { machine, state, transition } from '@alexcarpenter/machine'
import { invoke } from '@alexcarpenter/machine/invoke'

const $user = machine(
  'loading',
  {
    loading: state({
      entry: invoke({
        src: ({ signal }) =>
          fetch('/api/user', { signal }).then(response => response.json()),
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
  },
  { user: null }
)

keepMount($user)
```

`src` receives the current snapshot plus `signal` and `send`. It can return a promise, nothing, or a cleanup function. Promise fulfillment sends the internal done event; rejection sends the internal error event. Use `done` and `error` targets to handle them. The reducer receives fulfillment data as `event.output` or rejection data as `event.error`.

Pass the provided `AbortSignal` to abortable work. On state exit or unmount, the signal is aborted, callback cleanup runs, and late promise results are ignored.

## Debugging

Use `debug()` during development and call its returned cleanup function:

```js
import { debug } from '@alexcarpenter/machine/debug'

const stop = debug($user, {
  event: true,
  name: 'user',
  snapshot: true
})

stop()
```

Pass `logger` to replace `console.debug`. Set `event` or `snapshot` to include those values after the formatted transition message.
