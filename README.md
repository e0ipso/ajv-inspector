[![Build Status](https://travis-ci.org/e0ipso/ajv-inspector.svg?branch=master)](https://travis-ci.org/e0ipso/ajv-inspector)
[![Coverage Status](https://coveralls.io/repos/github/e0ipso/ajv-inspector/badge.svg?branch=master)](https://coveralls.io/github/e0ipso/ajv-inspector?branch=master)

This module allows you to inspect a JSON schema. Take a schema and request a path to drill donw into the schema to get the dereferenced schema.

This project is based on [ajv](https://github.com/epoberezkin/ajv) and leverages it to load and compile the JSON schemas.

You don't really need this if you are not using references in your schema.

## API
The first part is loading and compiling the schema, and *then* inspect the schema.

```js
const SchemaInspector = require('ajv-inspector');

const schemaObject = {
  '$schema': 'http://json-schema.org/draft-04/schema#',
  type: 'object',
  title: 'Person',
  requiredProperties: ['location'],
  properties: {
    location: {'$ref': 'http://json-schema.org/geo'},
    address: {'$ref': 'http://json-schema.org/address'},
    name: {
      description: 'The person name',
      type: 'string'
    }
  }
};

// Options are passed to ajv. In this case since we have to load
// data over HTTP we can use the loader helper.
const options = {loadSchema: SchemaInspector.httpSchemaLoader};
// Build the inspector with the schema.
const inspector = new SchemaInspector(schemaObject, options);
// Compile the schema.
inspector.compile()
  .then(() => {
    // You can now inspect the schema!
    console.log(inspector.inspect('location.latitude'));
    // Outputs: {type: 'number'}
  })
```

See the [unit tests](https://github.com/e0ipso/ajv-inspector/blob/master/test/index.js#L111-L130) for more details and examples.
