# haro-mongo

[![build status](https://secure.travis-ci.org/avoidwork/haro-mongo.svg)](http://travis-ci.org/avoidwork/haro-mongo)

Harō is a modern immutable DataStore built with ES6 features, which can be wired to an API for a complete feedback loop.
It is un-opinionated, and offers a plug'n'play solution to modeling, searching, & managing data on the client, or server
(in RAM). It is a [partially persistent data structure](https://en.wikipedia.org/wiki/Persistent_data_structure), by maintaining version sets of records in `versions` ([MVCC](https://en.wikipedia.org/wiki/Multiversion_concurrency_control)).

***haro-mongo*** is a persistent storage adapter, providing 'auto saving' behavior, as well as the ability to `save()` & `load()` the entire DataStore.

If `store.key` is not set, the fail over "id" field will be `id`.

### How to use
Require the adapter & register it with `haro.register(key, fn)`. The key must match the `store.adapters` key.

```javascript
const haro = require('haro'),
    store = haro(null, {adapters: {mongo: "mongodb://localhost/mydb"}});

// Register the adapter
store.register('mongo', require('haro-mongo'));

// Ready to `load()`, `batch()` or `set()`!
```

## License
Copyright (c) 2019 Jason Mulligan
Licensed under the BSD-3 license
