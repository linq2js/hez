import { createState, createStore } from "./index";

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
  expect(reducerCallback.mock.calls[0][1]).toBe(state.get());
});
