"use strict";

const deferred = require("tiny-defer");
const mongodb = require("mongodb");

function prepare (arg, id) {
	let o = arg;

	o[id] = o._id;
	delete o._id;
	return o;
}

function db (host) {
	let defer = deferred();

	mongodb.connect(host, function (e, arg) {
		if (e) {
			defer.reject(e);
		} else {
			defer.resolve(arg);
		}
	});

	return defer.promise;
}

function collection (d, id) {
	let defer = deferred();

	d.collection(id, function (e, c) {
		if (e) {
			defer.reject(e);
		} else {
			defer.resolve(c);
		}
	});

	return defer.promise;
}

function cmd (host, store, op, key, data, record, id) {
	let defer = deferred(),
		conn;

	function error (e) {
		if (conn) {
			conn.close();
		}

		defer.reject(e);
	}

	db(host).then(function (d) {
		conn = d;
		return collection(d, store.id);
	}, function (e) {
		throw e;
	}).then(function (coll) {
		let deferreds;

		if (op === "get") {
			if (record) {
				coll.find({_id: key}).limit(1).toArray(function (errr, recs) {
					conn.close();

					if (errr) {
						defer.reject(errr);
					} else if (recs.length === 0) {
						defer.resolve(null);
					} else {
						defer.resolve(prepare(recs[0], id));
					}
				});
			} else {
				coll.find({}).toArray(function (errr, recs) {
					conn.close();

					if (errr) {
						defer.reject(errr);
					} else {
						defer.resolve(recs.map(function (i) {
							return prepare(i, id);
						}));
					}
				});
			}
		}

		if (op === "remove") {
			coll.remove(record ? {_id: key} : {}, {safe: true}, function (errr, arg) {
				conn.close();

				if (errr) {
					defer.reject(errr);
				} else {
					defer.resolve(arg);
				}
			});
		}

		if (op === "set") {
			if (record) {
				coll.update({_id: key}, data, {
					w: 1,
					safe: true,
					upsert: true
				}, error);
			} else {
				deferreds = [];

				store.forEach(function (v, k) {
					let defer2 = deferred();

					deferreds.push(defer2.promise);
					coll.update({_id: k}, v, {
						w: 1,
						safe: true,
						upsert: true
					}, function (errrr, arg) {
						if (errrr) {
							defer2.reject(errrr);
						} else {
							defer2.resolve(arg);
						}
					});
				});

				Promise.all(deferreds).then(function (result) {
					conn.close();
					defer.resolve(result);
				}, function (errrr) {
					conn.close();
					defer.reject(errrr);
				});
			}
		}
	}, function (e) {
		defer.reject(e);
	});

	return defer.promise;
}

function adapter (store, op, key, data) {
	let defer = deferred();

	cmd(store.adapters.mongo, store, op, key, data, key !== undefined && store.has(key), store.key || "id").then(function (arg) {
		defer.resolve(arg);
	}, function (e) {
		defer.reject(e);
	});

	return defer.promise;
}

module.exports = adapter;
