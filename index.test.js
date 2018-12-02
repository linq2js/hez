import { createActionGroup, createState, createStore } from "./index";

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

test("should receive action(Function) for dynamic action creating", () => {
  const actionGroup = createActionGroup("ActionGroup", {});

  expect(typeof actionGroup.myAction).toBe("function");
  expect(actionGroup.myAction.displayName).toBe("ActionGroup.myAction");
});

test("should receive an error when trying to access un-accepted action", () => {
  const actionGroup = createActionGroup(
    "ActionGroup",
    ["AcceptedA", "AcceptedB"],
    {}
  );

  const callback = () => {
    const action = actionGroup.myAction;
  };

  expect(callback).toThrowError(
    "No action myAction is defined in this action group"
  );
});
