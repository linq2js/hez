"use strict";

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _react = require("react");

var _reactDom = require("react-dom");

var _testUtils = require("react-dom/test-utils");

var _index = require("./index");

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

var container = void 0;

beforeEach(function () {
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(function () {
  document.body.removeChild(container);
  container = null;
});

test("action dispatch handling should work properly", _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
  var store, fromCallback, toCallback, toResult, FromAction, ToAction;
  return regeneratorRuntime.wrap(function _callee$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          ToAction = function ToAction() {
            return toResult;
          };

          FromAction = function FromAction(state) {
            fromCallback(state);
            state.on(ToAction, toCallback);
          };

          store = (0, _index.createStore)();
          fromCallback = jest.fn(function () {});
          toCallback = jest.fn(function () {});
          toResult = {};
          _context.next = 8;
          return store.dispatch(FromAction);

        case 8:
          _context.next = 10;
          return store.dispatch(ToAction);

        case 10:

          expect(fromCallback.mock.calls.length).toBe(1);
          expect(toCallback.mock.calls.length).toBe(1);
          expect(toCallback.mock.calls[0][1]).toBe(toResult);

        case 13:
        case "end":
          return _context.stop();
      }
    }
  }, _callee, undefined);
})));

test("should call reducer properly", function () {
  var initialState = {
    todos: []
  };
  var state = (0, _index.createState)(initialState);
  var reducerCallback = jest.fn(function (value) {
    return value;
  });

  state.reduce({
    todos: reducerCallback
  });
  expect(reducerCallback.mock.calls.length).toBe(1);
  expect(reducerCallback.mock.calls[0][0]).toBe(initialState.todos);
});

test("extract multiple values from store", function () {
  var initialState = {
    value1: 1,
    value2: 2
  };
  var store = (0, _index.createStore)(initialState);

  var selectValue1 = function selectValue1(state) {
    return state.value1;
  };
  var selectValue2 = function selectValue2(state) {
    return state.value2;
  };

  var UseStoreTest = function UseStoreTest() {
    var _useStore = (0, _index.useStore)([selectValue1, selectValue2]),
        _useStore2 = _slicedToArray(_useStore, 2),
        value1 = _useStore2[0],
        value2 = _useStore2[1];

    var value3 = (0, _index.useStore)(selectValue1);
    var obj = (0, _index.useStore)({
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

  (0, _reactDom.render)((0, _react.createElement)(_index.Provider, { store: store }, (0, _react.createElement)(UseStoreTest)), container);
});

test("selector should work with default value properly", function () {
  var selectValue = (0, _index.createSelector)("value", 1);
  var initialState = {};
  var value = selectValue(initialState);
  expect(value).toBe(1);
});

test("computed selector should work properly", function () {
  var calls = 0;
  var selectA = (0, _index.createSelector)("a", 1);
  var selectB = (0, _index.createSelector)("b", 2);
  var selectSumOfAB = (0, _index.createSelector)(selectA, selectB, function (a, b) {
    calls++;
    return a + b;
  });
  var initialState = {};
  var value1 = selectSumOfAB(initialState);
  expect(value1).toBe(3);
  // first call
  expect(calls).toBe(1);

  var value2 = selectSumOfAB(initialState);
  expect(value2).toBe(value1);
  // do not call selector twice if inputs does not change
  expect(calls).toBe(1);
});

test("Using set state with computed modifier", function () {
  var selectA = (0, _index.createSelector)("a", 1);
  var selectB = (0, _index.createSelector)("b", 2);

  var state = (0, _index.createState)({});
  state.set(selectA, selectB, function (a, b) {
    return {
      sum: a + b
    };
  });

  expect(state.get()).toEqual({ sum: 3 });
});

test("Using merge state with computed modifier", function () {
  var selectA = (0, _index.createSelector)("a", 1);
  var selectB = (0, _index.createSelector)("b", 2);

  var state = (0, _index.createState)({
    other: 1
  });
  state.merge(selectA, selectB, function (a, b) {
    return {
      sum: a + b
    };
  });

  expect(state.get()).toEqual({ sum: 3, other: 1 });
});

test("selector can be use as prop name", function () {
  var $name = (0, _index.createSelector)("name");
  var value1 = _defineProperty({}, $name, "test");
  var state = (0, _index.createState)({});

  state.set($name, "test");

  expect(value1).toEqual({ name: "test" });
  expect(state.get()).toEqual({ name: "test" });
});
//# sourceMappingURL=index.test.js.map