"use strict";

const Ajv = require('ajv');
const _ = require('lodash');
const request = require('request');

const globalSchemas = {};

/**
 * Main inspection class.
 *
 * @class AjvInspector
 */
class AjvInspector {

  static get arrayItemLabel() {
    return '[item]';
  }

  /**
   * Class constructor.
   *
   * @param {object} schema
   *   The schema to inspect.
   * @param {object} options
   *   The options for Ajv. Additional options for the inspector are added to
   *   the 'inspector' property inside of the options object.
   *
   * @return {void}
   */
  constructor(schema, options) {
    this.ajv = new Ajv(options);
    this.schema = schema;
    this.compiled = null;
  }

  /**
   * Compile the schema and store it in memory.
   *
   * @return {Promise}
   *   It resolves after the schema has been successfully compiled.
   */
  compile() {
    return new Promise((resolve, reject) => {
      this.ajv.compileAsync(this.schema, (err, validate) => {
        if (err) {
          return reject(err);
        }
        this.compiled = validate;
        // Return the compiled schema.
        resolve(validate);
      });
    });
  }

  /**
   * Compile the schema and store it in memory.
   *
   * @throws {Error}
   *   If schema cannot be compiled.
   *
   * @return {void}
   */
  compileSync() {
    const _compileSchema = object => {
      try {
        return this.ajv.compile(object);
      }
      catch (e) {
        const uri = e.missingSchema;
        let subSchema = {};
        this.ajv._opts.loadSchema(uri, (err, res) => subSchema = res);
        this.ajv.addSchema(subSchema, uri.replace(/#\/?$/, ''));
        return _compileSchema(object);
      }
    };
    this.compiled = _compileSchema(this.schema);
  }

  /**
   * Helper static method to load remote schemas.
   *
   * @todo Add some type of caching to avoid downloading every requires.
   *
   * @param {string} uri
   *   The URI for the schema to load.
   * @param {Function} callback
   *   The assync callback to call.
   *
   * @return {void}
   */
  static httpSchemaLoader(uri, callback) {
    if (typeof globalSchemas[uri] !== 'undefined') {
      callback(null, globalSchemas[uri]);
      return;
    }
    request.get(uri, {}, (err, res, body) => {
      if (err || res.statusCode >= 400) {
        return callback(err || new Error('Loading error: ' + res.statusCode));
      }
      try {
        globalSchemas[uri] = JSON.parse(body);
      }
      catch (error) {
        return callback(error);
      }
      callback(null, globalSchemas[uri]);
    });
  }

  /**
   * Inspect a path in the schema.
   *
   * This is the main method of the library. Pass a path and get the
   * dereferenced schema definition.
   *
   * @param {string|Array} path
   *   The path in the object. Uses the same syntax as lodash.get().
   * @param {validate} _subSchema
   *   The sub schema to initialize. Used internally for recursion purposes.
   *
   * @return {object}
   *   The schema definition for that path. Children definitions are not
   *   included.
   */
  inspect(path, _subSchema) {
    const pathParts = Array.isArray(path) ? path.join('.').split('.') : path.split('.');
    return this._recurse(pathParts, _subSchema || this.compiled);
  }

  /**
   * Helper method that recurses through the path.
   *
   * @param {string[]} pathParts
   *   Path parts.
   * @param {validate} subSchema
   *   The subSchema
   * @param {object} property
   *   The property in the hierarchy.
   *
   * @return {object}
   *   The leaf sub schema.
   */
  _recurse(pathParts, subSchema, property) {
    property = property || subSchema.schema;
    const path = pathParts.shift();
    if (typeof path === 'undefined' && property.type) {
      // We have reached the bottom of the recursion, start going up.
      return property;
    }
    // Arrays are a pain. If you find one, go down.
    if (property.type === 'array') {
      return this._recurse(pathParts, subSchema, property.items);
    }
    let schemaProperty = AjvInspector.extractSubProperty(property, path);
    // Schema property may be false because the property does not exist.
    if (!schemaProperty || !schemaProperty.type) {
      const dereferenced = AjvInspector.dereference(schemaProperty || property, subSchema);
      if (!schemaProperty) {
        // If there was no property it means that the $ref replaces the whole
        // schema. Therefore we retry with the same path but with the
        // dereferenced schema. If there was a property, but the property
        // could not be dereferenced, then we just continue down with the
        // dereferenced property.
        pathParts.unshift(path);
      }
      if (typeof dereferenced === 'function') {
        // Re-run the same path with the dereferenced schema.
        return this._recurse(pathParts, dereferenced);
      }
      schemaProperty = dereferenced;
    }
    return this._recurse(pathParts, subSchema, schemaProperty);
  }

  /**
   * Dereference an schema based on the $ref property.
   *
   * @param {object} property
   *   The current property
   * @param {validate} subSchema
   *   The current sub schema that needs dereferencing.
   *
   * @return {object|function}
   *   The dereferenced sub schema. If the return is an object, then it should
   *   be treated as a property and not as a schema.
   */
  static dereference(property, subSchema) {
    // Try to find the sub schema in the $ref.
    if (typeof property.$ref === 'undefined') {
      throw Error('Could not find the path or a $ref to it.');
    }
    const regexp = new RegExp(`.*${property.$ref}$`);
    const reference = Object.keys(subSchema.refs).filter(ref => ref.match(regexp)).shift();
    if (typeof reference === 'undefined') {
      throw Error('Could not find the path or a $ref to it.');
    }
    return subSchema.refVal[subSchema.refs[reference]];
  }

  /**
   * Extracts the sub-property for the given path.
   *
   * @param {object} property
   *   The parent property.
   * @param {string} path
   *   The path to the sub-property.
   *
   * @return {object|bool}
   *   The sub-property or false if not found.
   */
  static extractSubProperty(property, path) {
    const subProperty = _.get(property, ['properties', path], false);
    if (!subProperty && property.patternProperties) {
      // Check if any of the patterns apply to the given path.
      for (const pattern of Object.keys(property.patternProperties)) {
        // Remove the leading and trailing slashes.
        const regexp = new RegExp(pattern);
        if (path.match(regexp)) {
          return property.patternProperties[pattern];
        }
      }
    }
    return subProperty;
  }

}

module.exports = AjvInspector;
