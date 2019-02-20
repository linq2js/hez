import { createElement } from "react";
import { render } from "react-dom";
import { act } from "react-dom/test-utils";
import { createState, createStore, useStore, Provider } from "./index";

let container;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  document.body.removeChild(container);
  container = null;
});

test("action dispatch handling should work properly", async () => {
  const store = createStore();
  const fromCallback = jest.fn(() => {});
  const toCallback = jest.fn(() => {});
  const toResult = {};

  function FromAction(state) {
    fromCallback(state);
    state.on(ToAction, toCallback);
  }

  function ToAction() {
    return toResult;
  }

  await store.dispatch(FromAction);
  await store.dispatch(ToAction);

  expect(fromCallback.mock.calls.length).toBe(1);
  expect(toCallback.mock.calls.length).toBe(1);
  expect(toCallback.mock.calls[0][1]).toBe(toResult);
});

test("should call reducer properly", () => {
  const initialState = {
    todos: []
  };
  const state = createState(initialState);
  const reducerCallback = jest.fn(value => value);

  state.reduce({
    todos: reducerCallback
  });
  expect(reducerCallback.mock.calls.length).toBe(1);
  expect(reducerCallback.mock.calls[0][0]).toBe(initialState.todos);
});

test("extract multiple values from store", () => {
  const initialState = {
    value1: 1,
    value2: 2
  };
  const store = createStore(initialState);

  const selectValue1 = state => state.value1;
  const selectValue2 = state => state.value2;

  const UseStoreTest = () => {
    const [value1, value2] = useStore([selectValue1, selectValue2]);
    const value3 = useStore(selectValue1);
    const obj = useStore({
      value1: selectValue1,
      value2: selectValue2
    });

    expect(value1).toBe(1);
    expect(value2).toBe(2);
    expect(value3).toBe(1);
    expect(obj.value1).toBe(1);
    expect(obj.value2).toBe(2);

    return true;
  };

  render(
    createElement(Provider, { store }, createElement(UseStoreTest)),
    container
  );
});
