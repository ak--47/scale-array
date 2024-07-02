/**
 * @fileoverview ScaleArray is a class that allows you to store large arrays 
 * in memory and flush them to disk when they reach a certain size.
 * they can be iterated over and manipulated like a normal array.
 * the class is designed to be used with large datasets that don't fit in memory 
 * but can to be processed and transformed in chunks.
 * ScaleArray makes "scaling an array" to millions of items easy.
 */


const fs = require('fs');
const path = require('path');
const os = require('os');
const v8 = require('v8');
let { NODE_ENV = "unknown" } = process.env;


/** 
 * @typedef ScaleArrayOptions
 * @property {string} name - The name of the ScaleArray instance
 * @property {string} writePath - The path to write the json files to
 * @property {number} maxSize - The maximum size of the in-memory array before flushing
 * 
 */

class ScaleArray {
	/**
	 * @param  {ScaleArrayOptions} options
	 */
	constructor(options = {}) {
		this._name = options.name || generateName() || 'scalable-array';
		this._writePath = options.writePath || os.tmpdir();
		this._maxSize = options.maxSize || 250_000;
		this.array = [];
		this._files = [];
		this._fileLengths = [];
		this.batch = 0;
		({ NODE_ENV = "unknown" } = process.env);


		if (NODE_ENV === 'dev' || NODE_ENV === 'test') {
			this.writePath = path.resolve('./tmp');
		}


	}

	// Helper method to check if flushing to disk is needed
	_needsFlush() {
		return this.array.length >= this._maxSize;
	}

	// Flush current array to disk
	flush(force = false) {
		if (this.array.length === 0) return;
		if (!this._needsFlush() && !force) return;
		this.batch += 1;
		console.log(`SCALE []: flushing ${this._name} (part ${this.batch})`);
		const filePath = path.join(this._writePath, `${this._name}_batch_${this.batch}.json`);
		fs.writeFileSync(filePath, this.array.map(JSON.stringify).join('\n'));
		this._files.push(path.resolve(filePath));
		this._fileLengths.push(this.array.length);
		this.array = [];
		return filePath;
	}

	// Completely clear the array and delete all files
	clear() {
		this.array = [];
		this.batch = 0;
		// Delete all files
		if (!this._files.length) return;
		console.log(`SCALE []: Deleting ${this._files.length} files from ${this._name}`);
		for (const filePath of this._files) {
			if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
		}
		this._files = [];
		this._fileLengths = [];
	}

	// Push new item to the array, flush if maxSize exceeded
	push(item) {
		if (this._needsFlush()) {
			this.flush();
		}

		if (Array.isArray(item)) {
			this.array.push(...item);
		} else {
			this.array.push(item);
		}

		if (this._needsFlush()) {
			this.flush();
		}
	}

	// Pop an item from the array, or from the last file
	shift() {
		if (this.array.length > 0) {
			return this.array.shift(); // Use shift to get the first item
		} else if (this._files.length > 0) {
			const filePath = this._files[0];
			const data = fs.readFileSync(filePath, 'utf8');
			const items = data.trim().split('\n').map(JSON.parse);
			const item = items.shift(); // Use shift to get the first item

			if (items.length > 0) {
				fs.writeFileSync(filePath, items.map(JSON.stringify).join('\n'));
			} else {
				fs.unlinkSync(filePath);
				this._files.shift();
			}
			return item;
		} else {
			return undefined;
		}
	}






	*consume(cleanup = true) {
		// Check if flushing is needed before consuming
		if (this._needsFlush()) {
			this.flush();
		}

		if (this._files.length) {
			for (const filePath of this._files) {
				try {
					const data = fs.readFileSync(filePath, 'utf8');
					const items = data.trim().split('\n').map(JSON.parse);
					for (const item of items) {
						yield item;
					}
					if (cleanup) {
						try {
							fs.unlinkSync(filePath);
						} catch (err) {
							// noop
						}
					}
				} catch (err) {
					if (err.code === 'ENOENT') {
						continue; // Skip to the next file
					} else {
						console.error('Error reading file:', err);
						return; // Stop on read error
					}
				}
			}
		}

		// Yield the remaining items in the in-memory array
		if (this.array.length) {
			for (const item of this.array) {
				yield item;
			}
			if (cleanup) {
				this.array = [];
			}
		}
	}

	// Implementing Symbol.iterator to make ScaleArray iterable
	[Symbol.iterator]() {
		const iterator = this.consume();
		return {
			next: () => {
				const { value, done } = iterator.next();
				return { value, done };
			}
		};
	}

	forEach(callback) {
		const originalLength = this.length;
		const tempArray = [];
		const newFiles = [];
		const newFileLengths = [];

		for (let i = 0; i < originalLength; i++) {
			let item = this.shift();
			if (item !== undefined) {
				callback(item); // Mutate the item in place
				tempArray.push(item); // Store the mutated item
			}

			// Push items back when tempArray reaches maxSize
			if (tempArray.length >= this._maxSize) {
				this.array.push(...tempArray);
				const filePath = this.flush(); // Ensure data is flushed to disk if needed
				if (filePath) {
					newFiles.push(filePath);
					newFileLengths.push(tempArray.length);
				}
				tempArray.length = 0; // Clear tempArray
			}
		}

		// Push any remaining items in tempArray back to the ScaleArray
		if (tempArray.length > 0) {
			this.array.push(...tempArray);
			const filePath = this.flush();
			if (filePath) {
				newFiles.push(filePath);
				newFileLengths.push(tempArray.length);
			}
		}

		// Update _files and _fileLengths properties
		this._files = newFiles;
		this._fileLengths = newFileLengths;
	}

	// toArray method to collect all values in all files and return a full array
	toArray(consumeOriginal = false) {
		const result = [];
		for (const item of this.consume(consumeOriginal)) {
			result.push(item);
		}
		return result;
	}

	// map method to apply a function to each item and return a new ScaleArray
	map(callback, name) {
		const newArray = new ScaleArray({
			name: name || `${this._name}_mapped`,
			writePath: this._writePath,
			maxSize: this._maxSize
		});

		const iterator = this.consume(true);
		for (let item of iterator) {
			newArray.push(callback(item));
		}
		newArray.flush();
		return newArray;
	}


	// filter method to apply a function to each item and return a new ScaleArray
	filter(callback, name) {
		const filteredArray = new ScaleArray({
			name: name || `${this._name}_filtered`,
			writePath: this._writePath,
			maxSize: this._maxSize
		});

		const iterator = this.consume(true);
		for (let item of iterator) {
			if (callback(item)) {
				filteredArray.push(item);
			}
		}
		filteredArray.flush();
		return filteredArray;
	}


	// reduce method to apply a function to each item and return a new ScaleArray
	reduce(callback, initialValue, name) {
		let accumulator = initialValue;

		const iterator = this.consume(true);
		for (let item of iterator) {
			accumulator = callback(accumulator, item);
		}

		const reducedArray = new ScaleArray({
			name: name || `${this._name}_reduced`,
			writePath: this._writePath,
			maxSize: this._maxSize
		});

		reducedArray.push(accumulator);
		reducedArray.flush();
		return reducedArray;
	}


	flat(depth = 1, name) {
		const flattenArray = (arr, depth) => {
			if (depth === 0 || !Array.isArray(arr)) return arr;
			return arr.reduce((flat, toFlatten) => {
				return flat.concat(Array.isArray(toFlatten) ? flattenArray(toFlatten, depth - 1) : toFlatten);
			}, []);
		};

		const flattenedArray = new ScaleArray({
			name: name || `${this._name}_flattened`,
			writePath: this._writePath,
			maxSize: this._maxSize
		});

		const iterator = this.consume(true);
		for (let item of iterator) {
			const flattenedItems = flattenArray(item, depth);
			flattenedArray.push(flattenedItems);
		}
		flattenedArray.flush();
		return flattenedArray;
	}

	get length() {
		return this.array.length + this._fileLengths.reduce((acc, len) => acc + len, 0);
	}

	get files() {
		return this._files;
	}

	get writePath() {
		return this._writePath;
	}

	get name() {
		return this._name;
	}

	set writePath(newPath) {
		this._writePath = newPath;
	}

	set maxSize(newSize) {
		this._maxSize = newSize;
	}

	get maxSize() {
		return this._maxSize;
	}

	static memCheck(percent = 0.75) {
		const memoryUsage = process.memoryUsage();
		const totalHeapSize = memoryUsage.heapTotal;
		const usedHeapSize = memoryUsage.heapUsed;
		const heapLimit = v8.getHeapStatistics().heap_size_limit;

		if (usedHeapSize / totalHeapSize > percent || usedHeapSize / heapLimit > percent) {
			if (global.gc) {
				console.log(`SCALE []: Memory usage is high, triggering garbage collection`);
				global.gc();
			}
		}
	}
}


function generateName(words = 3, separator = "-") {
	const adjs = [
		"dark", "grim", "swift", "brave", "bold", "fiery", "arcane",
		"rugged", "calm", "wild", "brisk", "dusty", "mighty", "sly",
		"old", "ghostly", "frosty", "gilded", "murky", "grand", "sly",
		"quick", "cruel", "meek", "glum", "drunk", "slick", "bitter",
		"nimble", "sweet", "tart", "tough"
	];

	const nouns = [
		"mage", "inn", "imp", "bard", "witch", "drake", "knight", "brew",
		"keep", "blade", "beast", "spell", "tome", "crown", "ale", "bard",
		"joke", "maid", "elf", "orc", "throne", "quest", "scroll", "fey",
		"pixie", "troll", "giant", "vamp", "ogre", "cloak", "gem", "axe",
		"armor", "fort", "bow", "lance", "moat", "den"
	];

	const verbs = [
		"cast", "charm", "brawl", "brew", "haunt", "sail", "storm", "quest",
		"joust", "feast", "march", "scheme", "raid", "guard", "duel",
		"trick", "flee", "prowl", "forge", "explore", "vanish", "summon",
		"banish", "bewitch", "sneak", "chase", "ride", "fly", "dream", "dance"
	];

	const adverbs = [
		"boldly", "bravely", "slyly", "wisely", "fiercely", "stealthily", "proudly", "eagerly",
		"quietly", "loudly", "heroically", "craftily", "defiantly", "infamously", "cleverly", "dastardly"
	];

	const continuations = [
		"and", "of", "in", "on", "under", "over", "beyond", "within", "while", "during", "after", "before",
		"beneath", "beside", "betwixt", "betwain", "because", "despite", "although", "however", "nevertheless"
	];

	let string;
	const cycle = [adjs, nouns, verbs, adverbs, continuations];
	for (let i = 0; i < words; i++) {
		const index = i % cycle.length;
		const word = cycle[index][Math.floor(Math.random() * cycle[index].length)];
		if (!string) {
			string = word;
		} else {
			string += separator + word;
		}
	}

	return string;
};


module.exports = ScaleArray;