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
const isActionGroupProp = "@@actionGroup";
const defaultInjectedProps = {};
const defaultState = {};
const noop = () => {};
let uniqueId = Math.floor(new Date().getTime() * Math.random());

/**
 * create state manager
 */
export function createState(
  initialStateOrAccessor = defaultState,
  onChange,
  injectedProps = defaultInjectedProps,
  addActionListener = noop
) {
  let localState =
    typeof initialStateOrAccessor === "function" ? {} : initialStateOrAccessor;
  const stateAccessor =
    typeof initialStateOrAccessor === "function"
      ? initialStateOrAccessor
      : () => localState;
  const api = {
    getState,
    setState,
    mergeState,
    addActionListener,
    reduceState
  };

  const shorthandApi = {
    get: getState,
    set: setState,
    merge: mergeState,
    on: addActionListener,
    reduce: reduceState
  };

  function getState(prop) {
    return arguments.length
      ? typeof prop === "function"
        ? prop(stateAccessor())
        : stateAccessor()[prop]
      : stateAccessor();
  }

  function setState(...args) {
    const state = stateAccessor();

    if (args.length === 2) {
      // support state prop modifier
      // state.set('count', x => x + 1)
      const [prop, modifier] = args;
      const prevValue = state[prop];
      const nextValue = modifier(prevValue);
      if (nextValue !== prevValue) {
        // clone current state
        const nextState = Array.isArray(state)
          ? state.slice()
          : Object.assign({}, state);
        nextState[prop] = nextValue;
        notify(nextState);
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
      notify(nextState);
    }
  }

  function notify(state) {
    onChange && onChange(state);
    localState = state;
  }

  function mergeState(nextState) {
    const state = stateAccessor();
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

  function reduceState(reducers = {}, ...args) {
    const state = stateAccessor();
    let nextState = state;
    Object.keys(reducers).forEach(key => {
      const reducer = reducers[key];
      const value = state[key];
      const nextValue = reducer(value, ...args);
      if (nextValue !== value) {
        if (state === nextState) {
          nextState = Object.assign({}, state);
        }
        nextState[key] = nextValue;
      }
    });

    setState(nextState);

    return nextState;
  }

  return new Proxy(
    {},
    {
      get(target, prop) {
        if (prop in shorthandApi) {
          return shorthandApi[prop];
        }
        if (prop in injectedProps) {
          const value = injectedProps[prop];
          // create wrapper for injected method
          if (typeof value === "function") {
            return (...args) => value(api, ...args);
          }
          return value;
        }
        return getState(prop);
      }
    }
  );
}

/**
 * create store
 */
export function createStore(initialState = {}) {
  const subscribers = [];
  const stateProps = {};
  const middlewares = [];
  const actionSubscriptions = {};
  const store = {
    getState,
    dispatch,
    subscribe,
    inject,
    use,
    [isStoreProp]: true
  };
  let hasActionSubscription;
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

  function addActionListener(action, handler) {
    const name =
      typeof action === "function" ? getType(action) : String(action);
    if (!(name in actionSubscriptions)) {
      actionSubscriptions[name] = [];
      actionSubscriptions[name].map = new WeakMap();
    }

    const list = actionSubscriptions[name];
    let unsubscribe = list.map.get(handler);
    if (unsubscribe) return unsubscribe;

    list.push(handler);
    hasActionSubscription = true;

    list.map.set(
      handler,
      (unsubscribe = () => {
        const index = list.indexOf(handler);
        if (index !== -1) {
          list.splice(index, 1);
        }
      })
    );

    return unsubscribe;
  }

  function notifyActionDispatch(action, state, result) {
    if (!hasActionSubscription) return;
    const name =
      typeof action === "function" ? getType(action) : String(action);
    const list = actionSubscriptions[name];
    list && list.forEach(subscriber => subscriber(state, result));
  }

  function getState() {
    return state;
  }

  function createStateForAction(action) {
    return createState(
      getState,
      nextState => {
        state = nextState;
        notify(getType(action));
      },
      stateProps,
      addActionListener
    );
  }

  function use(middleware) {
    middlewares.push(middleware);
  }

  function dispatch(action, ...args) {
    return middlewares.reduce((next, middleware) => {
      return (action, ...args) => middleware(next)(action, ...args);
    }, internalDispatch)(action, ...args);
  }

  function internalDispatch(action, ...args) {
    dispatchingScopes++;
    try {
      const actions = Array.isArray(action) ? action : [action];
      let lastResult;
      for (const action of actions) {
        const state = createStateForAction(action);
        lastResult = action(state, ...args);
        notifyActionDispatch(action, state, lastResult);
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

  return store;
}

/**
 * useActions(store, ...actions)
 * useActions(...actions)
 */
export const useActions = createStoreUtility((store, ...actions) => {
  return useMemo(() => {
    if (actions[0][isActionGroupProp] === true) {
      const actionGroup = actions[0];
      return actions.slice(1).map(actionType => {
        const action = actionGroup[actionType];
        return (...args) => store.dispatch(action, ...args);
      });
    }
    return actions.map(action => (...args) => store.dispatch(action, ...args));
  }, [store].concat(actions));
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

/***
 * createActionGroup(accept, reducer)
 * createActionGroup(reducer)
 * createActionGroup(name, accept, reducer)
 * createActionGroup(name, reducer)
 * @param args
 * @return {*}
 */
export function createActionGroup(...args) {
  let name, reducer, accept;
  if (args.length > 1) {
    // createActionGroup(name, accept, reducer)
    if (Array.isArray(args[1])) {
      name = args[0];
      accept = args[1];
      reducer = args[2];
    } else {
      // createActionGroup(accept, reducer)
      if (Array.isArray(args[0])) {
        name = "@@action_group_" + generateId();
        accept = args[0];
        reducer = args[1];
      } else {
        // createActionGroup(name, reducer)
        name = args[0];
        reducer = args[1];
        accept = typeof reducer === "function" ? [] : Object.keys(reducer);
      }
    }
  } else {
    // createActionGroup(reducer)
    name = "@@action_group_" + generateId();
    reducer = args[0];
    accept = typeof reducer === "function" ? [] : Object.keys(reducer);
  }

  const actionCache = {};

  return new Proxy(
    {},
    {
      get(target, prop) {
        if (prop === isActionGroupProp) return true;
        if (prop in actionCache) {
          return actionCache[prop];
        }

        if (accept.length && !accept.includes(prop)) {
          throw new Error(`No action ${prop} is defined in this action group`);
        }

        return (actionCache[prop] = createAction(
          name,
          typeof reducer === "function" ? reducer : reducer[prop],
          prop
        ));
      }
    }
  );
}

export function getType(action) {
  if (typeof action !== "function") {
    throw new Error("Invalid action. Action should be function type");
  }
  if (!action.displayName && action.name) {
    action.displayName = "@@action_" + generateId();
  }

  return action.displayName;
}

function createAction(name, reducer, prop) {
  const action =
    typeof reducer === "function"
      ? (state, payload) => {
          const prev = state.get();
          const next = reducer(prev, { type: prop, payload });
          if (next !== prev) {
            state.set(next);
          }
        }
      : (state, payload) => state.reduce(reducer, { type: prop, payload });
  action.displayName = name + "." + prop;
  return action;
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
  return obj && obj[isStoreProp] === true;
}

function generateId() {
  return uniqueId++;
}
