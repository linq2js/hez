# Hez

Flux architecture for React app. Fast and easy to use.

Hez requires React hooks, so you must install react 16.7+ and react-dom 16.7+ packages

## Features

1. No reducer
2. No action creator
3. No context Provider
4. Simple and reusable action logic
5. Easy to write unit-test

## Hez in action

1. Compare to Redux https://codesandbox.io/s/53l6y55kmk

## Counter app

```jsx harmony
import React from "react";
import ReactDOM from "react-dom";
import { createStore, useStore, useActions } from "./hez";

const initialState = {
  count: 0
};

const store = createStore(initialState);

const Up = (state, value) => state.set({ count: state.count + value });
const Down = (state, value) => state.set({ count: state.count - value });
const AddTen = state => Up(state, 10);

const App = () => {
  const count = useStore(store, state => state.count);
  const [up, down, addTen] = useActions(store, Up, Down, AddTen);

  return (
    <div>
      <h1>{count}</h1>
      <button onClick={() => up(1)}>Up</button>
      <button onClick={() => down(1)}>Down</button>
      <button onClick={() => addTen()}>Add 10</button>
    </div>
  );
};

const rootElement = document.getElementById("hez-app");
ReactDOM.render(<App />, rootElement);
```

## Create a store

```jsx harmony
import { createStore } from "hez";

const store = createStore({
  todos: []
});
```

## Define an action

```jsx harmony
const AddTodo = (state, text) =>
  state.set({ ...state.get(), todos: state.todos.concat({ text }) });
```

## Dispatch an action

```jsx harmony
import { useActions } from "hez";

const AddTodoForm = () => {
  const [addTodo] = useActions(store, AddTodo);

  function handleClick() {
    addTodo("new todo");
  }

  return <button onClick={handleClick}>Add Todo</button>;
};
```

## Access state values

```jsx harmony
import { useStore } from "hez";

const TodoCount = () => {
  const count = useStore(store, state => state.todos.length);

  return <div>{count}</div>;
};
```

## Async actions

```jsx harmony
const SaveTodos = state => {
  return axios({ url: "save.todo.api", data: state.todos }).then(
    () => alert("succeeded"),
    () => alert("failed")
  );
};
```

## Reuse action logic

```jsx harmony
const AddOne = state => state.set({ value: state.value + 1 });
const AddTwo = state => {
  AddOne(state);
  AddOne(state);
};
```

## Using state.merge

```jsx harmony
const store = createStore({
  value1: 1,
  value2: 2
});

const Add1 = state =>
  state.set({
    ...state.get(),
    value1: state.value1 + 1
  });

// using merge will reduce your code
const Add2 = state =>
  state.merge({
    value2: state.value2 + 1
  });
```

## Unit Test

```jsx harmony
import { createState } from "hez";

const Add = ({ count, set }) => set({ count: count + 1 });

test("should increase count value by 1", () => {
  const state = createState({ count: 0 });
  Add(state);
  expect(state.count).toBe(1);
});
```
