"use strict";

const mongodb = require("mongodb");

function prepare (arg, id) {
	let o = arg;

	o[id] = o._id;
	delete o._id;

	return o;
}

async function db (host) {
	return new Promise((resolve, reject) => {
		mongodb.connect(host, (err, arg) => {
			if (err) {
				reject(err);
			} else {
				resolve(arg);
			}
		});
	});
}

async function collection (d, id) {
	return new Promise((resolve, reject) => {
		d.collection(id, (e, c) => {
			if (e) {
				reject(e);
			} else {
				resolve(c);
			}
		});
	});
}

async function cmd (host, store, op, key, data, record, id) {
	return new Promise(async (resolve, reject) => {
		const conn = await db(host),
			coll = await collection(conn, store.id);

		if (op === "get") {
			if (record) {
				coll.find({_id: key}).limit(1).toArray((err, recs) => {
					conn.close();

					if (err !== null) {
						reject(err);
					} else if (recs.length === 0) {
						resolve(null);
					} else {
						resolve(prepare(recs[0], id));
					}
				});
			} else {
				coll.find({}).toArray((err, recs) => {
					conn.close();

					if (err !== null) {
						reject(err);
					} else {
						resolve(recs.map(i => prepare(i, id)));
					}
				});
			}
		}

		if (op === "remove") {
			coll.remove(record ? {_id: key} : {}, {safe: true}, (err, arg) => {
				conn.close();

				if (err !== null) {
					reject(err);
				} else {
					resolve(arg);
				}
			});
		}

		if (op === "set") {
			if (record) {
				coll.update({_id: key}, data, {w: 1, safe: true, upsert: true}, (err, arg) => {
					conn.close();

					if (err !== null) {
						reject(err);
					} else {
						resolve(arg);
					}
				});
			} else {
				const deferreds = [];

				store.forEach(function (v, k) {
					deferreds.push(new Promise((resolve2, reject2) => {
						coll.update({_id: k}, v, {w: 1, safe: true, upsert: true}, (err, arg) => {
							if (err !== null) {
								reject2(err);
							} else {
								resolve2(arg);
							}
						});
					}));
				});

				Promise.all(deferreds).then(result => {
					conn.close();
					resolve(result);
				}, err => {
					conn.close();
					reject(err);
				});
			}
		}
	});
}

module.exports = async (store, op, key, data) => await cmd(store.adapters.mongo, store, op, key, data, key !== undefined && store.has(key), store.key || "id");
