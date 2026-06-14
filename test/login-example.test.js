import { deepStrictEqual, equal } from 'node:assert/strict'
import { test } from 'node:test'
import { cleanStores, keepMount } from 'nanostores'
import { machine, state, transition } from '../index.js'
import { delay } from '../delay/index.js'
import { invoke } from '../invoke/index.js'

let tick = () => Promise.resolve()

test('supports a cancellable login workflow', async () => {
  let requests = []
  let login = ({ signal, username }) => {
    let request = {}
    requests.push(request)
    signal.addEventListener('abort', () => {
      request.aborted = true
    })
    return new Promise((resolve, reject) => {
      request.resolve = resolve
      request.reject = reject
      request.username = username
    })
  }

  let $login = machine(
    'idle',
    {
      idle: state(
        transition('submit', 'submitting', {
          guard: ({ event }) => event.username.length > 0,
          reduce: ({ context, event }) => ({
            ...context,
            error: undefined,
            token: undefined,
            username: event.username
          })
        })
      ),
      submitting: state({
        entry: invoke({
          done: 'success',
          error: 'failure',
          reduce: ({ context, event }) => ({
            ...context,
            error: event.error?.message,
            token: event.output?.token
          }),
          src: ({ context, signal }) =>
            login({
              signal,
              username: context.username
            })
        }),
        on: [transition('cancel', 'idle')]
      }),
      failure: state({
        on: [
          transition('submit', 'submitting', {
            guard: ({ event }) => event.username.length > 0,
            reduce: ({ context, event }) => ({
              ...context,
              error: undefined,
              username: event.username
            })
          }),
          delay(5, 'idle', {
            reduce: ({ context }) => ({
              ...context,
              error: undefined
            })
          })
        ]
      }),
      success: state({ final: true })
    },
    {
      error: undefined,
      token: undefined,
      username: ''
    }
  )

  keepMount($login)

  $login.send({ type: 'submit', username: '' })
  equal($login.get().state, 'idle')

  $login.send({ type: 'submit', username: 'alex' })
  equal($login.get().state, 'submitting')
  equal(requests[0].username, 'alex')

  $login.send('cancel')
  equal($login.get().state, 'idle')
  equal(requests[0].aborted, true)

  requests[0].resolve({ token: 'late' })
  await tick()
  equal($login.get().state, 'idle')
  equal($login.get().context.token, undefined)

  $login.send({ type: 'submit', username: 'alex' })
  requests[1].reject(new Error('Invalid password'))
  await tick()
  await tick()
  deepStrictEqual($login.get(), {
    context: {
      error: 'Invalid password',
      token: undefined,
      username: 'alex'
    },
    done: false,
    state: 'failure'
  })

  $login.send({ type: 'submit', username: 'alex' })
  equal($login.get().state, 'submitting')

  requests[2].resolve({ token: 'secret' })
  await tick()
  deepStrictEqual($login.get(), {
    context: {
      error: undefined,
      token: 'secret',
      username: 'alex'
    },
    done: true,
    state: 'success'
  })

  cleanStores($login)
})

test('login failure can clear its error after a delay', async () => {
  let $login = machine(
    'failure',
    {
      failure: state({
        on: [
          delay(5, 'idle', {
            reduce: ({ context }) => ({
              ...context,
              error: undefined
            })
          })
        ]
      }),
      idle: state()
    },
    { error: 'Invalid password' }
  )

  keepMount($login)
  await new Promise(resolve => setTimeout(resolve, 10))
  deepStrictEqual($login.get(), {
    context: { error: undefined },
    done: false,
    state: 'idle'
  })
  cleanStores($login)
})

test('login form example derives UI state from the machine snapshot', async () => {
  let requests = []
  let login = ({ signal, username }) => {
    let request = { username }
    requests.push(request)
    signal.addEventListener('abort', () => {
      request.aborted = true
    })
    return new Promise((resolve, reject) => {
      request.resolve = resolve
      request.reject = reject
    })
  }

  let $login = machine(
    'idle',
    {
      idle: state(
        transition('submit', 'submitting', {
          guard: ({ event }) => event.username.length > 0,
          reduce: ({ context, event }) => ({
            ...context,
            error: undefined,
            username: event.username
          })
        })
      ),
      submitting: state({
        entry: invoke({
          done: 'success',
          error: 'failure',
          reduce: ({ context, event }) => ({
            ...context,
            error: event.error?.message,
            token: event.output?.token
          }),
          src: ({ context, signal }) =>
            login({
              signal,
              username: context.username
            })
        }),
        on: [transition('cancel', 'idle')]
      }),
      failure: state({
        on: [
          transition('submit', 'submitting', {
            guard: ({ event }) => event.username.length > 0,
            reduce: ({ context, event }) => ({
              ...context,
              error: undefined,
              username: event.username
            })
          })
        ]
      }),
      success: state({ final: true })
    },
    {
      error: undefined,
      token: undefined,
      username: ''
    }
  )

  let view = () => {
    let login = $login.get()
    return {
      buttonDisabled: login.state === 'submitting',
      buttonText: login.state === 'submitting' ? 'Signing in' : 'Sign in',
      canCancel: login.state === 'submitting',
      error: login.context.error,
      username: login.context.username
    }
  }

  keepMount($login)

  deepStrictEqual(view(), {
    buttonDisabled: false,
    buttonText: 'Sign in',
    canCancel: false,
    error: undefined,
    username: ''
  })

  $login.send({ type: 'submit', username: '' })
  equal($login.get().state, 'idle')
  equal(requests.length, 0)

  $login.send({ type: 'submit', username: 'alex' })
  deepStrictEqual(view(), {
    buttonDisabled: true,
    buttonText: 'Signing in',
    canCancel: true,
    error: undefined,
    username: 'alex'
  })

  requests[0].reject(new Error('Invalid password'))
  await tick()
  await tick()
  deepStrictEqual(view(), {
    buttonDisabled: false,
    buttonText: 'Sign in',
    canCancel: false,
    error: 'Invalid password',
    username: 'alex'
  })

  $login.send({ type: 'submit', username: 'alex' })
  $login.send('cancel')
  equal(requests[1].aborted, true)
  deepStrictEqual(view(), {
    buttonDisabled: false,
    buttonText: 'Sign in',
    canCancel: false,
    error: undefined,
    username: 'alex'
  })

  $login.send({ type: 'submit', username: 'alex' })
  requests[2].resolve({ token: 'secret' })
  await tick()
  deepStrictEqual($login.get(), {
    context: {
      error: undefined,
      token: 'secret',
      username: 'alex'
    },
    done: true,
    state: 'success'
  })

  cleanStores($login)
})
