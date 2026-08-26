# Framework Bindings

Use the official Nano Stores binding for the consumer's framework. A machine is an ordinary Nano Stores store whose snapshot contains `state`, `context`, and `done`.

## React

Install `@nanostores/react`, then subscribe with `useStore`:

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

Keep reusable machine stores in their own module. Read the subscribed snapshot during render and send events through the store. Do not wrap the machine in an invented `useMachine` hook.

## Other frameworks

Use the matching Nano Stores package and its normal store subscription API:

- Preact: `@nanostores/preact`
- Vue: `@nanostores/vue`
- Svelte: Nano Stores are compatible with Svelte's store contract
- Solid: `@nanostores/solid`

Do not add a machine-library-specific adapter. The binding mounts the store, so initial entry handlers, always transitions, delays, and invokes can start when the component subscribes.
