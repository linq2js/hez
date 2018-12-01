# Hez

Flux architecture for React app. Fast and easy to use.

Hez requires React hooks, so you must install react 16.7+ and react-dom 16.7+ packages

## Features

1. No reducer
2. No action creator
3. Simple and reusable action logic
4. Easy to write unit-test

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

## Using state.set

```jsx harmony
const state = createState({ count: 0 });
state.set({ count: 1 }); // => 1
state.set("count", x => x + 1); // => 2
// state.set(prevState => nextState);
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

// state.merge(prevState => nextState);
```

## Using immhelper to update state

```jsx harmony
import update from "immhelper";
import { createState } from "hez";

const state = createState({ value1: 1, value2: 2, todos: [] });
state.set(
  update(state, {
    value1: ["set", 2],
    value2: ["set", 3],
    todos: ["push", "New Todo"]
  })
);

// shorthand
state.set(
  update({
    value1: ["set", 2],
    value2: ["set", 3],
    todos: ["push", "New Todo"]
  })
);
```

## Printing state

```jsx harmony
import { createState } from "hez";

const state = createState({ count: 1 });
console.log(state); // => [[Proxy]]
console.log(state.get()); // => { count: 1 }
```

## Access state props

```jsx harmony
import { createState } from "hez";

const state = createState({ count: 1 });
const { count } = state;
const count2 = state.count;
const count3 = state.get("count");
const count4 = state.get(x => x.count);
```

## Dispatching action and handling state change

```jsx harmony
import { createStore } from "hez";

const store = createStore({ count: 0 });

const Up = (state, value = 1) => state.set("count", x => x + value);

// handle change
store.subscribe((state, e) => {
  console.log(state, e.action);
});

store.dispatch(Up); // => { count: 1 }, Up
store.dispatch(Up, 2); // => { count: 3 }, Up
```

## Using useStore(store, selector, ...cacheKeys)

```jsx harmony
import React from "react";
import { createStore, useStore, withState } from "hez";

const store = createStore({
  todos: {
    1: "Item 1",
    2: "Item 2"
  }
});
const TodoItem = ({ id }) => {
  // component will re-render once state changed or received new id prop
  const text = useStore(store, state => state.todos[id], id);
  return <div>{text}</div>;
};

const TodoHoc = withState(
  store,
  (state, props) => ({
    text: state.todos[props.id]
  }),
  // cache key factory (optional) should return array
  props => [props.id]
);

const TodoItem = TodoHoc(props => <div>{props.text}</div>);
```

## Using useStoreMemo(store, cacheKeysSelector, stateSelector, ...extraCacheKeys)

```jsx harmony
import React from "react";
import { createStore } from "hez";

const store = createStore({
  ids: [1, 2],
  todos: {
    1: { text: "Item 1" },
    2: { text: "Item 2" }
  }
});

// selector
const selectIds = state => state.ids;
const selectTodos = state => state.todos;
const selectTodoList = (ids, todos) => ids.map(id => ({ id, ...todos[id] }));

const TodoList = () => {
  const todos = useStoreMemo(store, [selectIds, selectTodos], selectTodoList);

  return <div>{JSON.stringify(todos)}</div>;
};
```

## Using withActions

```jsx harmony
import React from "react";
import { withActions } from "hez";

const Up = () => {};
const Down = () => {};

const Counter = withActions(store, {
  up: Up,
  down: Down
})(({ up, down }) => (
  <div>
    <button onClick={up}>Up</button>
    <button onClick={down}>Down</button>
  </div>
));
```

## Using Provider to pass down store to component tree

As many frameworks, hez also supports Provider to passing down store

```jsx harmony
import React from "react";
import { Provider, createStore, useStore } from "hez";

const store = createStore();

const Counter = () => {
  // dont need to call useStore(store, state => state.count);
  const count = useStore(state => state.count);
  return <div>{count}</div>;
};

const App = () => (
  <Provider store={store}>
    <Counter />
  </Provider>
);
```

## State props injection

You can inject state utilize method by using store.inject

Using immhelper for updating state

```jsx harmony
import update from "immhelper";

const store = createStore({ todos: [] });

store.inject({
  update(state, ...args) {
    const { getState, setState, mergeState } = state;
    setState(update(getState(), ...args));
  }
});

const AddTodo = (state, text) => {
  state.update({
    todos: ["push", text]
  });
};
```

Using immer for updating state

```jsx harmony
import produce from "immer";

const store = createStore({ todos: [] });

store.inject({
  update(state, modifier) {
    const { getState, setState, mergeState } = state;
    setState(produce(getState(), modifier));
  }
});

const AddTodo = (state, text) => {
  state.update(draft => {
    draft.todos.push(text);
  });
};
```

## Listen another action dispatching

We can add listener which will be called when specified action dispatched. Use to clean up something

```jsx harmony
const Login = state => {
  LoadProfile(state);
  LoadSettings(state);
};

const Logout = state => {};

const LoadProfile = state => {
  state.merge({
    profile: {}
  });

  state.on(Logout, CleanProfile);
};

const LoadSettings = state => {
  state.merge({
    settings: {}
  });

  state.on(Logout, CleanSettings);
};

const CleanProfile = state => {
  state.merge({
    profile: undefined
  });
};

const CleanSettings = state => {
  state.merge({
    settings: undefined
  });
};
```

## Using reducer to update state

```jsx harmony
const state = createState({
  todos: []
});
const AddTodo1 = (state, text) => {
  state.reduce({
    todos: prev => [...prev, text]
  });
};

const AddTodo2 = (state, text) => {
  state.reduce(
    {
      todos: TodoReducers
    },
    {
      type: "add",
      payload: text
    }
  );
};

const TodoReducers = (state, action) => {
  if (action.type === "add") {
    return [...state, action.payload];
  }
  return state;
};
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

## Todo App
