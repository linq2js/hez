import {
  createElement,
  createContext,
  memo,
  useLayoutEffect,
  useEffect,
  useMemo,
  useState,
  useContext,
  useRef
} from "react";

if (!useMemo) {
  throw new Error(
    "This package requires React hooks. Please install React 16.8+"
  );
}

export const loaderStatus = {
  new: 0,
  loading: 1,
  success: 2,
  fail: 3
};
const defaultSelector = state => state;
const storeContext = createContext(null);
export const objectTypeProp = "@@objectType";
export const objectTypes = {
  store: 1,
  actionGroup: 2
};
const defaultInjectedProps = {};
const defaultState = {};
const noop = () => {};
export const loaderContextProp = "@@context";
export const noChange = {};
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

    if (
      args.length === 2 &&
      (typeof args[0] !== "function" || args[0].___selector)
    ) {
      // support state prop modifier
      // state.set('count', x => x + 1)
      const [prop, modifier] = args;
      const prevValue = state[prop];
      const nextValue =
        typeof modifier === "function" ? modifier(prevValue) : modifier;
      if (nextValue !== prevValue) {
        // clone current state
        const nextState = Array.isArray(state)
          ? state.slice()
          : Object.assign({}, state);
        nextState[prop] = nextValue;
        notify(nextState);
      }
    } else {
      let nextState = resolveNextState(state, args);
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

  function resolveNextState(state, args) {
    if (typeof args[0] !== "function" || args.length < 2) {
      return args[0];
    }
    const resolvedPropValues = args
      .slice(0, args.length - 1)
      .map(selector => selector(state));
    return args[args.length - 1].apply(null, resolvedPropValues);
  }

  function mergeState(...args) {
    const state = stateAccessor();
    const nextState = resolveNextState(state, args);
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

export function createSelector(...args) {
  // create computed selector
  if (args.length > 1 && typeof args[1] === "function") {
    const selectors = args
      .slice(0, args.length - 1)
      .map(selector => createSelector(selector));
    let lastInputs, lastResult;
    return createSelector(state => {
      const inputs = selectors.map(s => s(state));
      // do not call selector twice if inputs does not change
      if (
        typeof lastInputs !== "undefined" &&
        inputs.every((value, index) => lastInputs[index] === value)
      ) {
        return lastResult;
      }
      lastInputs = inputs;
      return (lastResult = args[args.length - 1].apply(null, inputs));
    });
  }

  const [selector, defaultValue] = args;
  if (typeof selector === "string") {
    return Object.assign(
      createSelector(
        function(state) {
          // return prop name if no state specified
          if (typeof state === "undefined") return selector;
          return state[selector];
        },
        defaultValue
      ),
      {
        toString: () => selector
      }
    );
  }

  // avoid re-wrap selector multiple times
  if (selector.___selector) return selector;

  return Object.assign(
    state => {
      const propValue = selector(state);
      if (typeof propValue === "undefined") {
        return defaultValue;
      }

      return propValue;
    },
    {
      ___selector: true
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
  const dispatchers = new WeakMap();
  const store = {
    getState,
    dispatch,
    subscribe,
    inject,
    use,
    getDispatcher,
    [objectTypeProp]: objectTypes.store
  };
  let hasActionSubscription;
  let state = initialState;
  let lastDispatchedAction;
  let shouldNotify = false;
  let dispatchingScopes = 0;

  function getDispatcher(action) {
    let dispatcher = dispatchers.get(action);
    if (!dispatcher) {
      dispatcher = (...args) => dispatch(action, ...args);
      dispatchers.set(action, dispatcher);
    }

    return dispatcher;
  }

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

export const useAction = (...args) => useActions(...args)[0];

/**
 * useActions(store, ...actions)
 * useActions(...actions)
 */
export const useActions = createStoreUtility((store, ...actions) => {
  return useMemo(() => {
    if (typeof actions[0] !== "function") {
      const actionGroup = actions[0];
      const isReducerGroup = Object.keys(actionGroup).every(
        key => typeof actionGroup[key] === "function"
      );
      const cachedActions = {};
      return actions.slice(1).map(actionType => {
        return payload => {
          if (!(actionType in cachedActions)) {
            const action = actionGroup[actionType];
            // actionGroup contains multiple reducers
            // { prop1: reducer1, prop2: reducer2 }
            if (isReducerGroup) {
              cachedActions[actionType] = (state, payload) => {
                state.reduce(actionGroup, {
                  type: actionType,
                  payload
                });
              };
            } else {
              cachedActions[actionType] = (state, payload) => {
                state.reduce(action, { type: actionType, payload });
              };
            }
            cachedActions[actionType].displayName = actionType;
          }

          return store.dispatch(cachedActions[actionType], payload);
        };
      });
    }

    return actions.map(action => store.getDispatcher(action));
  }, [store].concat(actions));
});

/**
 * useStore(store, selector, ...cacheKeys)
 * useStore(selector, ...cacheKeys)
 * useStore(selectors, ...cacheKeys)
 * useStore(store, selectors, ...cacheKeys)
 */
export const useStore = createStoreUtility(
  (store, selector = defaultSelector, ...cacheKeys) => {
    const isMultipleSelectors = Array.isArray(selector);
    // extract selector keys if it is plain object
    const selectorKeys =
      isMultipleSelectors || typeof selector === "function"
        ? undefined
        : Object.keys(selector);
    const state = store.getState();
    const selectorWrapper = state =>
      isMultipleSelectors
        ? // extract multiple state values
        selector.map(subSelector => subSelector(state))
        : selectorKeys
        ? // extract values by object keys
        selectorKeys.reduce((obj, key) => {
          obj[key] = selector[key](state);
          return obj;
        }, {}) // extract single value
        : selector(state);

    const globalState = useMemo(() => selectorWrapper(state), [state]);
    let [localState, setLocalState] = useState(globalState);

    useLayoutEffect(() => {
      return store.subscribe(nextState => {
        let nextLocalState = selectorWrapper(nextState);
        // detect change
        const hasChange = isMultipleSelectors
          ? // compare local array and next array
          localState.some(
            (localValue, index) => nextLocalState[index] !== localValue
          )
          : selectorKeys
            ? selectorKeys.some(key => localState[key] !== nextLocalState[key])
            : nextLocalState !== localState;

        if (hasChange) {
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
        // callback requires props and Comp, it must return React element
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

export function createActionGroup(actions) {
  return actions;
}

export function getType(action) {
  if (typeof action !== "function") {
    throw new Error("Invalid action. Action should be function type");
  }
  if (!action.displayName && action.name) {
    action.displayName = action.name + "." + generateId();
  }

  return action.displayName;
}

export function memoize(f) {
  let lastResult;
  let lastArgs;

  return function(...args) {
    // call f on first time or args changed
    if (!lastArgs || lastArgs.some((value, index) => value !== args[index])) {
      lastArgs = args;
      lastResult = f(...lastArgs);
    }
    return lastResult;
  };
}

export function usePromise(
  factory,
  cacheKeys = [],
  { defaultValue, onSuccess, onFailure, currentValue } = {}
) {
  const [state, setState] = useState({ result: defaultValue });
  let isUnmount = false;

  async function effect() {
    // do nothing if nothing changed
    if (typeof currentValue !== "undefined" && defaultValue === currentValue) {
      return;
    }

    try {
      const result = await factory(...cacheKeys);
      !isUnmount &&
      setState({
        result
      });

      onSuccess && onSuccess(result, ...cacheKeys);
    } catch (error) {
      !isUnmount &&
      setState({
        error
      });

      onFailure && onFailure(error, ...cacheKeys);
    }
  }

  useLayoutEffect(() => {
    effect();

    return function() {
      isUnmount = true;
    };
  }, cacheKeys);

  return [state.result, state.error];
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
  return obj && obj[objectTypeProp] === objectTypes.store;
}

function generateId() {
  return uniqueId++;
}

/**
 * function loaderFactory(state, ...args) {
 *   return {
 *     loader: () => object,
 *     keys: [cacheKey1, cacheKey2],
 *     defaultValue: object
 *   }
 * }
 */
export const useLoader = createStoreUtility((store, loaderFactory, ...args) => {
  const [, setState] = useState();

  function forceRender() {
    setState({});
  }

  if (typeof loaderFactory === "function") {
    return useSingleLoader(store, loaderFactory, forceRender, args);
  }
  return useMultipleLoaders(store, loaderFactory, forceRender, args);
});

function useMultipleLoaders(store, loaderFactories, forceRender, args) {
  const ref = useRef(
    loaderFactories.map(loaderFactory =>
      evalLoaderContext(store, loaderFactory, args)
    )
  );

  useEffect(() => {
    for (const context of ref.current) {
      const itemRef = { current: context };
      // loader triggered by another component, we just listen when data loaded
      if (!tryExecuteLoader(itemRef, store, forceRender)) {
        if (itemRef.current.status === loaderStatus.loading) {
          // re-render component once data loaded
          itemRef.current.promise.then(forceRender);
        }
      }
    }
  });

  useEffect(() =>
    store.subscribe(() => {
      ref.current = loaderFactories.map(loaderFactory =>
        evalLoaderContext(store, loaderFactory, args)
      );
      if (ref.current.some(x => x.status === loaderStatus.new)) {
        forceRender();
      }
    })
  );

  return ref.current.map(context =>
    context.project ? context.project(context) : context
  );
}

function useSingleLoader(store, loaderFactory, forceRender, args) {
  const ref = useRef(evalLoaderContext(store, loaderFactory, args));

  useEffect(() => {
    // loader triggered by another component, we just listen when data loaded
    if (!tryExecuteLoader(ref, store, forceRender)) {
      if (ref.current.status === loaderStatus.loading) {
        // re-render component once data loaded
        ref.current.promise.then(forceRender);
      }
    }
  });

  useEffect(() =>
    store.subscribe(() => {
      ref.current = evalLoaderContext(store, loaderFactory, args);
      // there are somethings changed in cache keys, we should re-render component
      if (ref.current.status === loaderStatus.new) {
        forceRender();
      }
    })
  );

  return ref.current.project ? ref.current.project(ref.current) : ref.current;
}

function tryExecuteLoader(contextRef, store, forceRender) {
  if (contextRef.current.status === loaderStatus.new) {
    contextRef.current.status = loaderStatus.loading;
    // using object as lock to make sure loader was triggered in same phase
    // another triggering will create diff lock object so we must not re-render component
    const lock = contextRef.current;
    clearTimeout(contextRef.current.timerId);
    contextRef.current.promise = new Promise((resolve, reject) => {
      contextRef.current.timerId = setTimeout(async () => {
        if (lock !== contextRef.current) {
          return;
        }

        const promises = contextRef.current.require.map(context => {
          const ref = {
            current: context
          };
          tryExecuteLoader(ref, store, forceRender);
          return ref.current.promise;
        });

        const results = await Promise.all(promises);

        try {
          const payload = await store.dispatch(
            contextRef.current.loader,
            ...results,
            ...contextRef.current.keys
          );

          if (lock !== contextRef.current) {
            return;
          }

          contextRef.current.payload =
            // sometimes you dont want to update payload, just keep prev one
            payload === noChange ? contextRef.current.prevPayload : payload;
          contextRef.current.status = loaderStatus.success;
          setTimeout(() => resolve(contextRef.current.payload));
        } catch (e) {
          if (lock !== contextRef.current) {
            return;
          }
          contextRef.current.status = loaderStatus.fail;
          setTimeout(() => reject(e));
        } finally {
          if (lock === contextRef.current) {
            contextRef.current.done = true;
            forceRender();
          }
        }
      }, contextRef.current.debounce);
    });

    return true;
  }
  return false;
}

function evalLoaderContext(store, loaderFactory, args = []) {
  const {
    loader,
    keys = [],
    require = [],
    defaultValue,
    debounce = 50,
    project
  } = store.dispatch(loaderFactory, ...args) || {};

  let context = loaderFactory[loaderContextProp];
  const requiredLoaders = require.map(lf => evalLoaderContext(store, lf));

  if (
    !context ||
    // verify keys are modified or not
    context.keys.length !== keys.length ||
    context.keys.some((x, i) => x !== keys[i]) ||
    context.require.some((x, i) => x !== requiredLoaders[i])
  ) {
    return (loaderFactory[loaderContextProp] = context = {
      keys,
      require: requiredLoaders,
      status: loaderStatus.new,
      done: false,
      defaultValue,
      loader,
      debounce,
      project,
      prevPayload: context ? context.payload : undefined,
      forceReload() {
        if (!context) return;
        delete loaderFactory[loaderContextProp];
        context = null;
        store.dispatch(state => {
          state.set({
            ...store.getState()
          });
        });
      }
    });
  }

  return context;
}

export function withLoader(loaders, fallback) {
  const entries = Object.entries(loaders || {});
  const loaderFactories = entries.map(x => x[1]);
  return Comp => props => {
    const contexts = useLoader(loaderFactories);
    if (contexts.every(x => x.done)) {
      return createElement(Comp, {
        ...contexts.reduce(
          (newProps, context, index) => (
            (newProps[entries[index][0]] = context.payload), newProps
          ),
          {}
        ),
        ...props
      });
    }
    return fallback ? createElement(fallback, props) : null;
  };
}
