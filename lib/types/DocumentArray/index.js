'use strict';

/*!
 * Module dependencies.
 */

const ArrayMethods = require('../array/methods');
const DocumentArrayMethods = require('./methods');
const Document = require('../../document');

const arrayAtomicsSymbol = require('../../helpers/symbols').arrayAtomicsSymbol;
const arrayAtomicsBackupSymbol = require('../../helpers/symbols').arrayAtomicsBackupSymbol;
const arrayParentSymbol = require('../../helpers/symbols').arrayParentSymbol;
const arrayPathSymbol = require('../../helpers/symbols').arrayPathSymbol;
const arraySchemaSymbol = require('../../helpers/symbols').arraySchemaSymbol;

const _basePush = Array.prototype.push;

/**
 * DocumentArray constructor
 *
 * @param {Array} values
 * @param {String} path the path to this array
 * @param {Document} doc parent document
 * @api private
 * @return {MongooseDocumentArray}
 * @inherits MongooseArray
 * @see http://bit.ly/f6CnZU
 */

function MongooseDocumentArray(values, path, doc) {
  const arr = [];

  const internals = {
    [arrayAtomicsSymbol]: {},
    [arrayAtomicsBackupSymbol]: void 0,
    [arrayPathSymbol]: path,
    [arraySchemaSymbol]: void 0,
    [arrayParentSymbol]: void 0
  };

  if (Array.isArray(values)) {
    if (values[arrayPathSymbol] === path &&
        values[arrayParentSymbol] === doc) {
      internals[arrayAtomicsSymbol] = Object.assign({}, values[arrayAtomicsSymbol]);
    }
    values.forEach(v => {
      _basePush.call(arr, v);
    });
  }
  internals[arrayPathSymbol] = path;

  // Because doc comes from the context of another function, doc === global
  // can happen if there was a null somewhere up the chain (see #3020 && #3034)
  // RB Jun 17, 2015 updated to check for presence of expected paths instead
  // to make more proof against unusual node environments
  if (doc && doc instanceof Document) {
    internals[arrayParentSymbol] = doc;
    internals[arraySchemaSymbol] = doc.schema.path(path);

    // `schema.path()` doesn't drill into nested arrays properly yet, see
    // gh-6398, gh-6602. This is a workaround because nested arrays are
    // always plain non-document arrays, so once you get to a document array
    // nesting is done. Matryoshka code.
    while (internals[arraySchemaSymbol] != null &&
        internals[arraySchemaSymbol].$isMongooseArray &&
        !internals[arraySchemaSymbol].$isMongooseDocumentArray) {
      internals[arraySchemaSymbol] = internals[arraySchemaSymbol].casterConstructor;
    }
  }

  const proxy = new Proxy(arr, {
    get: function(target, prop) {
      if (prop === 'isMongooseArray' ||
          prop === 'isMongooseArrayProxy' ||
          prop === 'isMongooseDocumentArray' ||
          prop === 'isMongooseDocumentArrayProxy') {
        return true;
      }
      if (prop === '__array') {
        return arr;
      }
      if (prop === 'set') {
        return set;
      }
      if (internals.hasOwnProperty(prop)) {
        return internals[prop];
      }
      if (DocumentArrayMethods.hasOwnProperty(prop)) {
        return DocumentArrayMethods[prop];
      }
      if (ArrayMethods.hasOwnProperty(prop)) {
        return ArrayMethods[prop];
      }

      return arr[prop];
    },
    set: function(target, prop, value) {
      if (typeof prop === 'string' && /^\d+$/.test(prop)) {
        set.call(proxy, prop, value);
      } else if (internals.hasOwnProperty(prop)) {
        internals[prop] = value;
      } else {
        arr[prop] = value;
      }

      return true;
    }
  });

  return proxy;
}

function set(i, val, skipModified) {
  const arr = this.__array;
  if (skipModified) {
    arr[i] = val;
    return arr;
  }
  const value = DocumentArrayMethods._cast.call(this, val, i);
  arr[i] = value;
  DocumentArrayMethods._markModified.call(this, i);
  return arr;
}

/*!
 * Module exports.
 */

module.exports = MongooseDocumentArray;