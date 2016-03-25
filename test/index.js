"use strict";
const SchemaInspector = require('../lib/ajv-inspector');
const sinon = require('sinon');
const request = require('request');

module.exports = {
  unit: {
    inspector: {
      setUp(cb) {
        this.stubs = [];
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
        test.expect(2);
        this.stubs.push(sinon.stub(request, 'get', (uri, options, cb) => {
          const res = {
            statusCode: 200,
            data: {success: true}
          };
          cb(null, res, JSON.stringify(res.data));
        }));
        SchemaInspector.httpSchemaLoader('fake.json', (err, data) => {
          test.ok(!err);
          test.ok(data.success === true);
          test.done();
        });
      },
      inspect(test) {
        test.expect(3);
        const paths = {
          'currentTuneIn.[item].endTime': 'string',
          'currentTuneIn.[item]': 'object',
          'currentTuneIn': 'array'
        };
        this.stubs.push(sinon.stub(request, 'get', (uri, options, cb) => {
          const res = {
            statusCode: 200,
            data: require(`./mocks/${uri}`)
          };
          cb(null, res, JSON.stringify(res.data));
        }));
        this.inspector.compile()
          .then(() => {
            Object.keys(paths).forEach(key => {
              test.equal(this.inspector.inspect(key), paths[key]);
            });
            test.done();
          })
          .catch(test.done);
      }
    }
  }
};
