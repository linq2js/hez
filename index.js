import { createElement, memo, useEffect, useMemo, useState } from "react";

if (!useMemo) {
  throw new Error(
    "This package requires React hooks. Please install React 16.7+"
  );
}

const defaultSelector = state => state;

/**
 * create state manager
 */
export function createState(initialState = {}, onChange) {
  let state = initialState;
  let proxyTarget = initialState;

  function getState(prop) {
    return arguments.length
      ? typeof prop === "function"
        ? prop(state)
        : state[prop]
      : state;
  }

  function setState(nextState) {
    if (typeof nextState === "function") {
      return setState(nextState(state));
    }
    if (state === nextState) {
      return;
    }
    state = nextState;
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
      return proxyTarget[prop];
    }
  });
}

/**
 * create store
 */
export function createStore(initialState = {}) {
  const subscribers = [];
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
    return createState(state, nextState => {
      state = nextState;
      console.log(111);
      notify(action.displayName || action.name);
    });
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

  return {
    getState,
    dispatch,
    subscribe
  };
}

export function useActions(store, ...actions) {
  return useMemo(
    () => actions.map(action => (...args) => store.dispatch(action, ...args)),
    [store].concat(actions)
  );
}

export function useStore(store, selector = defaultSelector, ...cacheKeys) {
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

export function useStoreMemo(
  store,
  cacheKeysSelector,
  stateSelector = state => state,
  ...extraCacheKeys
) {
  if (Array.isArray(cacheKeysSelector)) {
    const selectors = cacheKeysSelector;
    cacheKeysSelector = (...args) =>
      selectors.map(selector => selector(...args));
  }
  const cacheKeys = useStore(store, cacheKeysSelector).concat(extraCacheKeys);
  return useMemo(() => stateSelector(...cacheKeys), cacheKeys);
}

export function withState(store, selector, cacheKeyFactory) {
  return Component => {
    const MemoComponent = memo(Component);

    return memo(props => {
      const nextProps = useStore(
        store,
        state => selector(state, props),
        ...((cacheKeyFactory && cacheKeyFactory(props)) || [])
      );

      return createElement(MemoComponent, nextProps);
    });
  };
}

export function withActions(store, actions) {
  const keys = Object.keys(actions);
  const values = Object.values(actions);
  return Component => {
    const MemoComponent = memo(Component);
    return memo(props => {
      const nextProps = {};
      const mappedActions = useActions(store, ...values);
      mappedActions.forEach(
        (mappedAction, index) => (nextProps[keys[index]] = mappedAction)
      );
      return createElement(MemoComponent, Object.assign(nextProps, props));
    });
  };
}

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
