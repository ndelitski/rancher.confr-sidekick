global.assert = require('chai').assert;
global.expect = require('chai').expect;

assert.throwAsync = async function(asyncFn, ...other) {
  let exc;

  try {
    await asyncFn();
  } catch (err) {
    exc = err;
  }

  assert.throw(() => {
    if (exc) {
      throw exc;
    }
  }, ...other);
};
