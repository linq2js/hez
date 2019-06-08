import { createElement } from "react";
import { render } from "react-dom";
import { act } from "react-dom/test-utils";

import {
  createState,
  createStore,
  useStore,
  Provider,
  createSelector,
  memoize,
  useActions,
  useLoader
} from "./index";

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

  act(() => {
    render(
      createElement(Provider, { store }, createElement(UseStoreTest)),
      container
    );
  });
});

test("selector should work with default value properly", () => {
  const selectValue = createSelector(
    "value",
    1
  );
  const initialState = {};
  const value = selectValue(initialState);
  expect(value).toBe(1);
});

test("computed selector should work properly", () => {
  let calls = 0;
  const selectA = createSelector(
    "a",
    1
  );
  const selectB = createSelector(
    "b",
    2
  );
  const selectSumOfAB = createSelector(
    selectA,
    selectB,
    (a, b) => {
      calls++;
      return a + b;
    }
  );
  const initialState = {};
  const value1 = selectSumOfAB(initialState);
  expect(value1).toBe(3);
  // first call
  expect(calls).toBe(1);

  const value2 = selectSumOfAB(initialState);
  expect(value2).toBe(value1);
  // do not call selector twice if inputs does not change
  expect(calls).toBe(1);
});

test("Using set state with computed modifier", () => {
  const selectA = createSelector(
    "a",
    1
  );
  const selectB = createSelector(
    "b",
    2
  );

  const state = createState({});
  state.set(selectA, selectB, (a, b) => ({
    sum: a + b
  }));

  expect(state.get()).toEqual({ sum: 3 });
});

test("Using merge state with computed modifier", () => {
  const selectA = createSelector(
    "a",
    1
  );
  const selectB = createSelector(
    "b",
    2
  );

  const state = createState({
    other: 1
  });
  state.merge(selectA, selectB, (a, b) => ({
    sum: a + b
  }));

  expect(state.get()).toEqual({ sum: 3, other: 1 });
});

test("selector can be use as prop name", () => {
  const $name = createSelector("name");
  const value1 = { [$name]: "test" };
  const state = createState({});

  state.set($name, "test");

  expect(value1).toEqual({ name: "test" });
  expect(state.get()).toEqual({ name: "test" });
});

test("memoized function should call only once if arguments has no change", () => {
  let counter = 0;
  const memoizedCounter = memoize(() => counter++);

  memoizedCounter();
  memoizedCounter();
  memoizedCounter();

  expect(counter).toBe(1);
});

test("should re-use action dispatcher", () => {
  const store = createStore();

  const DoSomething = () => {};

  const UseActionsTest = () => {
    const [action1] = useActions(DoSomething);
    const [action2] = useActions(DoSomething);

    expect(action1).toBe(action2);

    return "nothing";
  };

  act(() => {
    render(
      createElement(Provider, { store }, createElement(UseActionsTest)),
      container
    );
  });
});

const ProductListLoader = (state, callback) => {
  return {
    defaultValue: false,
    loader: async () => {
      const products = [{ id: 1 }, { id: 2 }];
      state.set({
        products
      });

      callback(products);

      return products;
    }
  };
};

test("useLoader", () => {
  return new Promise(resolve => {
    const store = createStore();

    const ProductList = () => {
      const products = useLoader(ProductListLoader, products => {
        expect(products.length).toBe(2);
        setTimeout(resolve);
      });

      return JSON.stringify(products);
    };

    act(() => {
      render(
        createElement(
          Provider,
          { store },
          createElement(
            "div",
            {},
            createElement(ProductList),
            createElement(ProductList)
          )
        ),
        container
      );
    });
  });
});
