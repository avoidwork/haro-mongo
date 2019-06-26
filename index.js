"use strict";

const mongodb = require("mongodb"),
	{URL} = require("url");

function prepare (arg, id) {
	const o = arg;

	o[id] = o._id;
	delete o._id;

	return o;
}

async function connect (host) {
	return new Promise((resolve, reject) => {
		mongodb.connect(host, {useNewUrlParser: true}, (err, arg) => {
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
		const parsed = new URL(host.includes(",") ? host.replace(/\/.*,/, "//") : host),
			client = await connect(host),
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
				coll.updateOne({_id: key}, Object.keys(data).filter(i => i.startsWith("$")).length > 0 ? data : {$set: data}, {w: 1, safe: true, upsert: true}, (err, arg) => {
					client.close();

					if (err !== null) {
						reject(err);
					} else {
						resolve(arg);
					}
				});
			} else {
				client.close();
				Promise.all(store.reduce((a, v) => [...a, cmd(host, store, "set", v[store.key], v, true)], [], true)).then(resolve, reject);
			}
		}
	});
}

module.exports = async (store, op, key, data) => await cmd(store.adapters.mongo, store, op, key, data, key !== undefined && store.has(key), store.key || "id");
