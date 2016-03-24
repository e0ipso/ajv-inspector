"use strict";
const SchemaInspector = require('../lib/ajv-inspector');

module.exports = {
  unit: {
    inspector: {
      setUp(cb) {
        this.inspector = new SchemaInspector({
          "$ref": "reltio-series.json"
        }, {loadSchema: (uri, callback) => callback(null, require(`./mocks/${uri}`))});
        cb();
      },
      construct(test) {
        test.expect(3);
        const paths = {
          'currentTuneIn.[item].endTime': 'string',
          'currentTuneIn.[item]': 'object',
          'currentTuneIn': 'array'
        };
        this.inspector.compile()
          .then(() => {
            Object.keys(paths).forEach(key => {
              test.equal(this.inspector.inspect(key), paths[key])
            });
            test.done();
          })
          .catch(test.done);
      }
    }
  }
};
