---
name: use-nanostores-machine
description: Build or update consumer applications with the @alexcarpenter/machine package. Use when implementing flat state machines backed by Nano Stores in JavaScript or TypeScript, connecting them to React or another Nano Stores UI binding, modeling typed events and context, or adding guards, reducers, lifecycle callbacks, always transitions, delays, invoked async services, or transition debugging.
---

# Use Nano Stores Machine

Use the published `@alexcarpenter/machine` API. Inspect the consumer project's framework, package manager, TypeScript usage, and existing conventions before changing code.

## Route the task

- Read [core-api.md](references/core-api.md) for every task that creates, types, reads, or sends events to a machine.
- Read [framework-bindings.md](references/framework-bindings.md) when connecting a machine to React or another UI framework.
- Read [optional-modules.md](references/optional-modules.md) only when the task needs delays, invoked promises or callbacks, or transition logging.

## Install

Install both the package and its Nano Stores peer dependency:

```sh
pnpm add nanostores @alexcarpenter/machine
```

Use the consumer project's package manager. Install the appropriate Nano Stores framework binding separately, such as `@nanostores/react` for React.

## Implement

1. Model a small, flat set of states with `machine()`, `state()`, and `transition()`.
2. Use `setup<Context, Event>()` for TypeScript applications that need strong context and event inference.
3. Keep a reusable machine store outside UI components when its state should survive component renders.
4. Subscribe through the consumer framework's Nano Stores binding and send events through the machine store.
5. Import timers, async services, and debugging only from their documented subpaths.
6. Mount a machine when its initial state's entry work, always transition, delay, or invoke must start without a prior event.

Do not invent XState APIs or features. This package does not export `createMachine`, `useMachine`, `assign`, actors, nested states, parallel states, or an XState compatibility layer.

## Verify

Check that:

1. All imports are exported by `@alexcarpenter/machine`, a documented helper subpath, Nano Stores, or the selected framework binding.
2. Every initial state and transition target exists in the flat state map.
3. Event objects have a string `type`; typed object events include their required payload.
4. Reducers return the complete next context instead of mutating it.
5. Initial lifecycle work is mounted through a subscription, framework binding, or `keepMount()` when necessary.
6. Delay and invoke helpers are cleaned up by state exit or store unmount rather than duplicated with unmanaged effects.
7. Generated code passes the consumer project's type checks and tests.
