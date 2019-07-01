"use strict";
const SchemaInspector = require('../lib/ajv-inspector');
const sinon = require('sinon');
const request = require('request');

module.exports = {
  unit: {
    inspector: {
      setUp(cb) {
        this.stubs = [];
        this.stubs.push(sinon.stub(request, 'get', (uri, options, callback) => {
          let res = {};
          if (uri === 'fake.json') {
            res = {
              statusCode: 200,
              data: {success: true}
            };
          }
          else if (uri === 'fail.json') {
            res = {
              statusCode: 500,
              data: {success: false}
            };
          }
          else if (uri === 'parseFail.json') {
            res = {
              statusCode: 200,
              data: {}
            };
            return callback(null, res, "{");
          }
          else {
            res = {
              statusCode: 200,
              data: require(`./mocks/${uri}`)
            };
          }
          callback(null, res, JSON.stringify(res.data));
        }));

        this.inspector = new SchemaInspector({
          "$ref": "reltio-series.json"
        }, {loadSchema: SchemaInspector.httpSchemaLoader});
        cb();
      },
      tearDown(cb) {
        this.stubs.forEach(stub => stub.restore());
        cb();
      },
      httpSchemaLoader(test) {
        test.expect(1);
        SchemaInspector.httpSchemaLoader('fake.json')
          .then(data => {
            test.ok(data.success === true);
            test.done();
          });
      },
      httpSchemaLoaderCache(test) {
        test.expect(1);
        // Make a second call to load from cache.
        SchemaInspector.httpSchemaLoader('fake.json')
          .then(data => {
            test.ok(data.success === true);
            test.done();
          });
      },
      httpSchemaLoaderFail(test) {
        test.expect(1);
        SchemaInspector.httpSchemaLoader('fail.json')
          .catch(err => {
            test.equal('Loading error: 500', err.message);
            test.done();
          });
      },
      httpSchemaLoaderParseFail(test) {
        test.expect(1);
        SchemaInspector.httpSchemaLoader('parseFail.json')
          .catch(() => {
            test.ok(true);
            test.done();
          });
      },
      compileFail(test) {
        // Required properties cannot be empty.
        const inspector = new SchemaInspector({
          properties: []
        }, {loadSchema: SchemaInspector.httpSchemaLoader});
        inspector.compile()
          .then(null, err => {
            test.ok(!!err.message);
            test.done();
          });
      },
      missingReference(test) {
        test.expect(1);
        test.throws(() => this.inspector._recurse(['fake'], {
          schema: {}
        }, null), Error);
        test.done();
      },
      referenceFail(test) {
        test.expect(2);
        test.throws(() => this.inspector._recurse(['fake'], {
          schema: {
            '$ref': 'nope!'
          },
          refs: {}
        }, null), Error);

        this.inspector.compile()
          .then(() => {
            this.inspector.inspect('ratings.[item].fake');
          })
          .catch(() => {
            test.ok(true);
            test.done();
          });
      },
      constant(test) {
        test.expect(1);
        test.equal('[item]', SchemaInspector.arrayItemLabel);
        test.done();
      },
      inspect(test) {
        test.expect(9);
        const paths = [
          {path: 'shortDescription', type: 'array'},
          {path: 'shortDescription.[item]', type: 'object'},
          {path: 'shortDescription.[item].locale', type: 'string'},
          {path: 'shortDescription.[item].descriptionValue', type: 'string'},
          {
            path: ['currentTuneIn', '[item]', 'customObject', 'lorem'],
            type: 'number'
          },
          {path: 'currentTuneIn.[item].endTime', type: 'string'},
          {path: 'currentTuneIn.[item]', type: 'object'},
          {path: 'currentTuneIn', type: 'array'},
          {path: 'ratings.[item].systemValue', type: 'string'}
        ];
        this.inspector.compile()
          .then(() => {
            paths.forEach(path => {
              test.equal(this.inspector.inspect(path.path).type, path.type);
            });
            test.done();
          });
      }
    }
  }
};
