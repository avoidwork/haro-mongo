"use strict";

const mongodb = require("mongodb"),
	url = require("url");

function prepare (arg, id) {
	const o = arg;

	o[id] = o._id;
	delete o._id;

	return o;
}

async function connect (host) {
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

async function cmd (host, store, op, key, data, record, id) {
	return new Promise(async (resolve, reject) => {
		const parsed = url.parse(host),
			client = await connect(`${parsed.protocol}//${parsed.host}${parsed.port !== null ? ":" + parsed.port : ""}`),
			db = client.db(parsed.pathname.replace(/^\//, "")),
			coll = db.collection(store.id);

		if (op === "get") {
			if (record) {
				coll.find({_id: key}).limit(1).toArray((err, recs) => {
					client.close();

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
					client.close();

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
				client.close();

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
					client.close();

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
					client.close();
					resolve(result);
				}, err => {
					client.close();
					reject(err);
				});
			}
		}
	});
}

module.exports = async (store, op, key, data) => await cmd(store.adapters.mongo, store, op, key, data, key !== undefined && store.has(key), store.key || "id");
