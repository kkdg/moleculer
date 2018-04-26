const ServiceBroker = require("../../src/service-broker");

const Stream = require("stream");

describe("Test to send stream as ctx.param", () => {

	let b1 = new ServiceBroker({
		namespace: "test-1",
		transporter: "Fake",
		nodeID: "node-1"
	});

	let b2 = new ServiceBroker({
		namespace: "test-1",
		transporter: "Fake",
		nodeID: "node-2"
	});

	let FLOW = [];

	b2.createService({
		name: "file",
		actions: {
			save(ctx) {
				expect(ctx.params).toBeInstanceOf(Stream.Readable);
				ctx.params.on("data", msg => FLOW.push(msg.toString()));
				ctx.params.on("error", err => FLOW.push("<ERROR:" + err.message + ">"));
				ctx.params.on("end", () => FLOW.push("<END>"));

				return "OK";
			}
		}
	});

	const stream = new Stream.Readable({
		read() {}
	});

	beforeAll(() => Promise.all([b1.start(), b2.start()]));
	afterAll(() => Promise.all([b1.stop(), b2.stop()]));

	it("should receive stream on b2", () => {
		FLOW = [];
		return b1.Promise.resolve()
			.then(() => b1.call("file.save", stream))
			.then(res => expect(res).toBe("OK"))
			.then(() => stream.push("first chunk"))
			.delay(100)
			.then(() => {
				expect(FLOW).toEqual([
					"first chunk"
				]);
				stream.push(Buffer.from("second chunk"));
			})
			.delay(100)
			.then(() => {
				expect(FLOW).toEqual([
					"first chunk",
					"second chunk"
				]);
				stream.emit("end");
			})
			.delay(100)
			.then(() => {
				expect(FLOW).toEqual([
					"first chunk",
					"second chunk",
					"<END>"
				]);
			});
	});

	it.skip("should receive stream & handle error", () => {
		FLOW = [];
		return b1.Promise.resolve()
			.then(() => b1.call("file.save", stream))
			.then(res => expect(res).toBe("OK"))
			.then(() => stream.push("first chunk"))
			.delay(100)
			.then(() => {
				expect(FLOW).toEqual([
					"first chunk"
				]);
				stream.emit("error", new Error("Something happened"));
			})
			.delay(100)
			.then(() => {
				expect(FLOW).toEqual([
					"first chunk",
					"<ERROR>"
				]);
				stream.emit("end");
			})
			.delay(100)
			.then(() => {
				expect(FLOW).toEqual([
					"first chunk",
					"second chunk",
					"<END>"
				]);
			});
	});

});

describe("Test to receive a stream as response", () => {

	let b1 = new ServiceBroker({
		namespace: "test-2",
		transporter: "Fake",
		nodeID: "node-1"
	});

	let b2 = new ServiceBroker({
		namespace: "test-2",
		transporter: "Fake",
		nodeID: "node-2"
	});

	const stream = new Stream.Readable({
		read() {}
	});

	b2.createService({
		name: "file",
		actions: {
			get(ctx) {
				return stream;
			}
		}
	});

	beforeAll(() => Promise.all([b1.start(), b2.start()]));
	afterAll(() => Promise.all([b1.stop(), b2.stop()]));

	it("should receive stream", () => {
		const FLOW = [];
		return b1.Promise.resolve()
			.then(() => b1.call("file.get"))
			.then(res => {
				expect(res).toBeInstanceOf(Stream.Readable);
				res.on("data", msg => FLOW.push(msg.toString()));
				res.on("error", err => FLOW.push("<ERROR:" + err.message + ">"));
				res.on("end", () => FLOW.push("<END>"));
			})
			.then(() => stream.push("first chunk"))
			.delay(100)
			.then(() => {
				expect(FLOW).toEqual([
					"first chunk"
				]);
				stream.push(Buffer.from("second chunk"));
			})
			.delay(100)
			.then(() => {
				expect(FLOW).toEqual([
					"first chunk",
					"second chunk"
				]);
				stream.emit("end");
			})
			.delay(100)
			.then(() => {
				expect(FLOW).toEqual([
					"first chunk",
					"second chunk",
					"<END>"
				]);
			});
	});

	it("should receive stream & handle error", () => {
		const FLOW = [];
		return b1.Promise.resolve()
			.then(() => b1.call("file.get"))
			.then(res => {
				expect(res).toBeInstanceOf(Stream.Readable);
				res.on("data", msg => FLOW.push(msg.toString()));
				res.on("error", err => FLOW.push("<ERROR:" + err.message + ">"));
				res.on("end", () => FLOW.push("<END>"));
			})
			.then(() => stream.push("first chunk"))
			.delay(100)
			.then(() => {
				expect(FLOW).toEqual([
					"first chunk"
				]);
				stream.emit("error", new Error("Something happened"));
			})
			.delay(100)
			.then(() => {
				expect(FLOW).toEqual([
					"first chunk",
					"<ERROR:Something happened (NodeID: node-2)>",
					"<END>"
				]);
			});
	});

});

describe("Test duplex streaming", () => {

	let b1 = new ServiceBroker({
		namespace: "test-3",
		transporter: "Fake",
		nodeID: "node-1"
	});

	let b2 = new ServiceBroker({
		namespace: "test-3",
		transporter: "Fake",
		nodeID: "node-2"
	});

	const stream = new Stream.Readable({
		read() {}
	});

	b2.createService({
		name: "file",
		actions: {
			convert(ctx) {
				const pass = new Stream.Transform({
					transform: function (chunk, encoding, done) {
						this.push(chunk.toString().toUpperCase());
						return done();
					}
				});
				return ctx.params.pipe(pass);
			}
		}
	});

	beforeAll(() => Promise.all([b1.start(), b2.start()]));
	afterAll(() => Promise.all([b1.stop(), b2.stop()]));

	it("should send & receive stream", () => {
		const FLOW = [];
		return b1.Promise.resolve()
			.then(() => b1.call("file.convert", stream))
			.then(res => {
				expect(res).toBeInstanceOf(Stream.Readable);
				res.on("data", msg => FLOW.push(msg.toString()));
				res.on("error", err => FLOW.push("<ERROR:" + err.message + ">"));
				res.on("end", () => FLOW.push("<END>"));
			})
			.then(() => stream.push("first chunk"))
			.delay(100)
			.then(() => {
				expect(FLOW).toEqual([
					"FIRST CHUNK"
				]);
				stream.push(Buffer.from("second chunk"));
			})
			.delay(100)
			.then(() => {
				expect(FLOW).toEqual([
					"FIRST CHUNK",
					"SECOND CHUNK"
				]);
				stream.emit("end");
			})
			.delay(100)
			.then(() => {
				expect(FLOW).toEqual([
					"FIRST CHUNK",
					"SECOND CHUNK",
					"<END>"
				]);
			});
	});

	it.skip("should receive stream & handle error", () => {
		const FLOW = [];
		return b1.Promise.resolve()
			.then(() => b1.call("file.convert"))
			.then(res => {
				expect(res).toBeInstanceOf(Stream.Readable);
				res.on("data", msg => FLOW.push(msg.toString()));
				res.on("error", err => FLOW.push("<ERROR:" + err.message + ">"));
				res.on("end", () => FLOW.push("<END>"));
			})
			.then(() => stream.push("first chunk"))
			.delay(100)
			.then(() => {
				expect(FLOW).toEqual([
					"first chunk"
				]);
				stream.emit("error", new Error("Something happened"));
			})
			.delay(100)
			.then(() => {
				expect(FLOW).toEqual([
					"first chunk",
					"<ERROR:Something happened (NodeID: node-2)>",
					"<END>"
				]);
			});
	});

});
