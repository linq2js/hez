import {
  createElement,
  createContext,
  memo,
  useEffect,
  useMemo,
  useState,
  useContext
} from "react";

if (!useMemo) {
  throw new Error(
    "This package requires React hooks. Please install React 16.7+"
  );
}

const defaultSelector = state => state;
const storeContext = createContext(null);
const isStoreProp = "@@store";

/**
 * create state manager
 */
export function createState(initialState = {}, onChange, injectedProps = {}) {
  let state = initialState;
  let proxyTarget = initialState;
  const api = {
    getState,
    setState,
    mergeState
  };

  function getState(prop) {
    return arguments.length
      ? typeof prop === "function"
        ? prop(state)
        : state[prop]
      : state;
  }

  function setState(...args) {
    if (args.length === 2) {
      // support state prop modifier
      // state.set('count', x => x + 1)
      const [prop, modifier] = args;
      const prevValue = state[prop];
      const nextValue = modifier(prevValue);
      if (nextValue !== prevValue) {
        // clone current state
        state = Array.isArray(state) ? state.slice() : Object.assign({}, state);
        state[prop] = nextValue;
        notify();
      }
    } else {
      let [nextState] = args;
      // support callback
      // state.set(state => doSomething)
      if (typeof nextState === "function") {
        nextState = nextState(state);
      }
      if (state === nextState) {
        return;
      }
      state = nextState;
      notify();
    }
  }

  function notify() {
    Object.assign(proxyTarget, state);
    onChange && onChange(state);
  }

  function mergeState(nextState) {
    if (typeof nextState === "function") {
      return mergeState(nextState(state));
    }
    let hasChange = false;
    // loop through all nextState props, detect any change
    Object.keys(nextState).some(key => {
      if (nextState[key] !== state[key]) {
        hasChange = true;
        return true;
      }
      return false;
    });
    if (!hasChange) return;
    setState(Object.assign({}, state, nextState));
  }

  return new Proxy(proxyTarget, {
    get(target, prop) {
      if (prop === "get") return getState;
      if (prop === "set") return setState;
      if (prop === "merge") return mergeState;
      if (prop in injectedProps) {
        const value = injectedProps[prop];
        // create wrapper for injected method
        if (typeof value === "function") {
          return (...args) => value(api, ...args);
        }
        return value;
      }
      return proxyTarget[prop];
    }
  });
}

/**
 * create store
 */
export function createStore(initialState = {}) {
  const subscribers = [];
  const stateProps = {};
  let state = initialState;
  let lastDispatchedAction;
  let shouldNotify = false;
  let dispatchingScopes = 0;

  function subscribe(subscriber) {
    let unsubscribed = false;
    subscribers.push(subscriber);
    // return unsubscribe
    return function() {
      if (unsubscribed) return;
      unsubscribed = true;
      const index = subscribers.indexOf(subscriber);
      if (index !== -1) {
        subscribers.splice(index, 1);
      }
    };
  }

  function getState() {
    return state;
  }

  function createStateForAction(action) {
    return createState(
      state,
      nextState => {
        state = nextState;
        notify(action.displayName || action.name);
      },
      stateProps
    );
  }

  function dispatch(action, ...args) {
    dispatchingScopes++;
    try {
      const actions = Array.isArray(action) ? action : [action];
      let lastResult;
      for (const action of actions) {
        lastResult = action(createStateForAction(action), ...args);
      }
      return lastResult;
    } finally {
      dispatchingScopes--;
      if (!dispatchingScopes && shouldNotify) {
        shouldNotify = false;
        notify(lastDispatchedAction);
      }
    }
  }

  function notify(action) {
    if (dispatchingScopes) {
      shouldNotify = true;
      lastDispatchedAction = action;
      return;
    }
    subscribers.forEach(subscriber => subscriber(getState(), { action }));
  }

  /**
   * inject state props
   */
  function inject(props) {
    Object.assign(stateProps, props);
  }

  return {
    getState,
    dispatch,
    subscribe,
    inject,
    [isStoreProp]: true
  };
}

/**
 * useActions(store, ...actions)
 * useActions(...actions)
 */
export const useActions = createStoreUtility((store, ...actions) => {
  return useMemo(
    () => actions.map(action => (...args) => store.dispatch(action, ...args)),
    [store].concat(actions)
  );
});

/**
 * useStore(store, selector, ...cacheKeys)
 * useStore(selector, ...cacheKeys)
 */
export const useStore = createStoreUtility(
  (store, selector = defaultSelector, ...cacheKeys) => {
    const state = store.getState();
    const globalState = useMemo(() => selector(state), [state]);
    let [localState, setLocalState] = useState(globalState);

    useEffect(() => {
      return store.subscribe(nextState => {
        let nextLocalState = selector(nextState);
        if (nextLocalState !== localState) {
          setLocalState((localState = nextLocalState));
        }
      });
    }, cacheKeys);
    return localState;
  }
);

/**
 * useStoreMemo(store, cacheKeysSelector, stateSelector, ...extraCacheKeys)
 * useStoreMemo(cacheKeysSelector, stateSelector, ...extraCacheKeys)
 */
export const useStoreMemo = createStoreUtility(
  (
    store,
    cacheKeysSelector,
    stateSelector = state => state,
    ...extraCacheKeys
  ) => {
    if (Array.isArray(cacheKeysSelector)) {
      const selectors = cacheKeysSelector;
      cacheKeysSelector = (...args) =>
        selectors.map(selector => selector(...args));
    }
    const cacheKeys = useStore(store, cacheKeysSelector).concat(extraCacheKeys);
    return useMemo(() => stateSelector(...cacheKeys), cacheKeys);
  }
);

/**
 * withState(store, selector, cacheKeyFactory)
 * withState(selector, cacheKeyFactory)
 */
export const withState = createStoreHoc(
  (Component, props, initialData, store, selector, cacheKeyFactory) => {
    const nextProps = useStore(
      store,
      state => selector(state, props),
      ...((cacheKeyFactory && cacheKeyFactory(props)) || [])
    );

    return createElement(Component, nextProps);
  }
);

/**
 * withActions(store, actions)
 * withActions(actions)
 */
export const withActions = createStoreHoc(
  (Component, props, { keys, values }, store) => {
    const nextProps = {};
    const mappedActions = useActions(store, ...values);
    mappedActions.forEach(
      (mappedAction, index) => (nextProps[keys[index]] = mappedAction)
    );
    return createElement(Component, Object.assign(nextProps, props));
  },
  actions => ({
    keys: Object.keys(actions),
    values: Object.values(actions)
  })
);

export function compose(...functions) {
  if (functions.length === 0) {
    return arg => arg;
  }

  if (functions.length === 1) {
    return functions[0];
  }

  return functions.reduce((a, b) => (...args) => a(b(...args)));
}

export function hoc(...callbacks) {
  return callbacks.reduce(
    (nextHoc, callback) => Component => {
      const MemoComponent = memo(Component);

      return props => {
        if (callback.length > 1) {
          return callback(props, MemoComponent);
        }
        let newProps = callback(props);
        if (newProps === false) return null;
        if (!newProps) {
          newProps = props;
        }

        return createElement(MemoComponent, newProps);
      };
    },
    Component => Component
  );
}

export function Provider({ store, children }) {
  return createElement(storeContext.Provider, { value: store, children });
}

function createStoreUtility(callback) {
  return (...args) => {
    const store = useContext(storeContext);
    if (isStore(args[0])) {
      return callback(...args);
    }
    return callback(...[store].concat(args));
  };
}

function createStoreHoc(callback, initializer) {
  return (...args) => {
    const hasStore = isStore(args[0]);
    // call initializer without store if any
    const initializedData =
      initializer && initializer(...(hasStore ? args.slice(1) : args));

    return Component => {
      const MemoComponent = memo(Component);
      return memo(props => {
        const store = useContext(storeContext);
        return callback(
          MemoComponent,
          props,
          initializedData,
          ...(hasStore ? args : [store].concat(args))
        );
      });
    };
  };
}

function isStore(obj) {
  return obj && obj[isStoreProp];
}
