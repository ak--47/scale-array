
const path = require('path');
const ScaleArray = require('./index.js');
const writePath = path.resolve('./tmp');
const os = require('os');
const fs = require('fs');
const v8 = require('v8');
const { execSync } = require('child_process');

beforeAll(() => {
	if (!fs.existsSync(writePath)) {
		fs.mkdirSync(writePath);
	}
	else {
		execSync(`npm run prune`);
	}
});

afterAll(() => {
	execSync(`npm run prune`);
});

describe('scalable array', () => {
	test('correct defaults', () => {
		const s = new ScaleArray({});
		expect(s.name).not.toBe('scalable-array');
		expect(s.writePath).not.toBe(os.tmpdir());
		expect(s.writePath).toBe(writePath);
		expect(s.maxSize).toBe(250_000);
		expect(s.array).toEqual([]);
		expect(s.files).toEqual([]);
		expect(s.batch).toBe(0);
	});

	test('accepts values', () => {
		const options = {
			name: 'testArray',
			writePath: writePath,
			maxSize: 10
		};
		const s = new ScaleArray(options);
		expect(s.name).toBe('testArray');
		expect(s.writePath).toBe(writePath);
		expect(s.maxSize).toBe(10);
	});

	test('pushes() and flushes()', () => {
		const s = new ScaleArray({ writePath: writePath, maxSize: 2, name: 'scalable-array' });
		s.push({ item: 1 });
		s.push({ item: 2 });
		expect(s.length).toBe(2);
		expect(s.array.length).toBe(0);
		expect(s.batch).toBe(1);
		expect(s.files.length).toBe(1);
		expect(fs.existsSync(path.resolve(writePath, 'scalable-array_batch_1.json'))).toBe(true);
		s.push({ item: 3 });
		expect(s.length).toBe(3);
		expect(s.array.length).toBe(1);
		expect(s.batch).toBe(1);
		expect(s.files.length).toBe(1);

		s.push({ item: 4 });
		s.push({ item: 5 });
		expect(s.array.length).toBe(1);
		expect(s.batch).toBe(2);
		expect(fs.existsSync(path.resolve(writePath, 'scalable-array_batch_2.json'))).toBe(true);
		expect(s.array.length).toBe(1);

	});

	test('flush() works', () => {
		const s = new ScaleArray({ writePath: writePath, name: 'scalable-array', maxSize: 200 });
		s.push({ item: 1 });
		s.flush();
		const filePath = path.resolve(writePath, 'scalable-array_batch_1.json');
		expect(fs.existsSync(filePath)).toBe(false);
		s.flush(true);
		expect(fs.existsSync(filePath)).toBe(true);
		const data = fs.readFileSync(filePath, 'utf8');
		expect(data).toBe(JSON.stringify({ item: 1 }));
		expect(s.array.length).toBe(0);
	});

	test('consume() works', async () => {
		const s = new ScaleArray({ writePath: writePath, maxSize: 2 });
		s.push({ item: 1 });
		s.push({ item: 2 });
		s.push({ item: 3 });
		s.flush();
		const consumedData = [];
		for (const item of s.consume()) {
			consumedData.push(item);
		}
		expect(consumedData).toEqual([{ item: 1 }, { item: 2 }, { item: 3 }]);
	});

	test('clear() works', () => {
		const s = new ScaleArray({ writePath: writePath });
		s.push({ item: 1 });
		s.clear();
		expect(s.array.length).toBe(0);
		expect(s.files.length).toBe(0);
		expect(s.batch).toBe(0);
		const filePath = path.join(writePath, 'scaleArray_batch_1.json');
		expect(fs.existsSync(filePath)).toBe(false);
	});

	test('push() works', () => {
		const scaleArray = new ScaleArray({ writePath: writePath });
		scaleArray.push([{ item: 1 }, { item: 2 }]);
		expect(scaleArray.array.length).toBe(2);
	});

	// New test for forEach method
	test('forEach()', () => {
		const scaleArray = new ScaleArray({ writePath: writePath, maxSize: 2 });
		scaleArray.push({ item: 1 });
		scaleArray.push({ item: 2 });
		scaleArray.push({ item: 3 });
		scaleArray.flush();

		const consumedData = [];
		scaleArray.forEach(item => {
			consumedData.push(item);
		});

		expect(consumedData.sort((a, b) => a.item - b.item)).toEqual([{ item: 1 }, { item: 2 }, { item: 3 }]);
	});

	// New test for for...of loop
	test('for of', () => {
		const scaleArray = new ScaleArray({ writePath: writePath, maxSize: 2 });
		scaleArray.push({ item: 1 });
		scaleArray.push({ item: 2 });
		scaleArray.push({ item: 3 });
		scaleArray.flush();

		const consumedData = [];
		for (const item of scaleArray) {
			consumedData.push(item);
		}

		expect(consumedData).toEqual([{ item: 1 }, { item: 2 }, { item: 3 }]);
	});


	test('toArray() collects', () => {
		const scaleArray = new ScaleArray({ writePath: writePath, maxSize: 2 });
		scaleArray.push({ item: 1 });
		scaleArray.push({ item: 2 });
		scaleArray.push({ item: 3 });
		scaleArray.flush();

		const result = scaleArray.toArray();
		expect(result).toEqual([{ item: 1 }, { item: 2 }, { item: 3 }]);
	});

	test('toArray() with empty', () => {
		const scaleArray = new ScaleArray({ writePath: writePath, maxSize: 2 });

		const result = scaleArray.toArray();
		expect(result).toEqual([]);
	});


	test('map() writes new files', () => {
		const scaleArray = new ScaleArray({ writePath: writePath, maxSize: 2 });
		scaleArray.push({ item: 1 });
		scaleArray.push({ item: 2 });
		scaleArray.push({ item: 3 });
		scaleArray.flush();

		const transformed = scaleArray.map(item => ({ ...item, mapped: true }));

		const result = transformed.toArray();
		expect(result).toEqual([{ item: 1, mapped: true }, { item: 2, mapped: true }, { item: 3, mapped: true }]);
	});

	test('forEach() mutates', () => {
		const scaleArray = new ScaleArray({ writePath: writePath, maxSize: 2 });
		scaleArray.push({ item: 1 });
		scaleArray.push({ item: 2 });
		scaleArray.push({ item: 3 });


		scaleArray.forEach(item => {
			item.mutated = true;
		});

		//resort by item #
		const result = scaleArray.toArray().sort((a, b) => a.item - b.item);
		expect(result).toEqual([{ item: 1, mutated: true }, { item: 2, mutated: true }, { item: 3, mutated: true }]);
	});


	test('map() works', () => {
		const scaleArray = new ScaleArray({ writePath: writePath, maxSize: 2 });
		scaleArray.push({ item: 1 });
		scaleArray.push({ item: 2 });
		scaleArray.push({ item: 3 });
		scaleArray.flush();

		const mappedArray = scaleArray.map(item => ({ ...item, mapped: true }));

		const result = mappedArray.toArray();
		expect(result).toEqual([{ item: 1, mapped: true }, { item: 2, mapped: true }, { item: 3, mapped: true }]);
	});

	test('filter() works', () => {
		const scaleArray = new ScaleArray({ writePath: writePath, maxSize: 2 });
		scaleArray.push({ item: 1, keep: true });
		scaleArray.push({ item: 2, keep: false });
		scaleArray.push({ item: 3, keep: true });
		scaleArray.flush();

		const filteredArray = scaleArray.filter(item => item.keep, 'filteredArray');

		const result = filteredArray.toArray();
		expect(result).toEqual([{ item: 1, keep: true }, { item: 3, keep: true }]);
	});

	test('reduce() works', () => {
		const scaleArray = new ScaleArray({ writePath: writePath, maxSize: 2 });
		scaleArray.push({ value: 1 });
		scaleArray.push({ value: 2 });
		scaleArray.push({ value: 3 });
		scaleArray.flush();

		const reducedArray = scaleArray.reduce((acc, item) => acc + item.value, 0, 'reducedArray');

		const result = reducedArray.toArray();
		expect(result).toEqual([6]); // 1 + 2 + 3 = 6
	});

	test('flat() flattens nested arrays', () => {
		const scaleArray = new ScaleArray({ writePath: writePath, maxSize: 2 });
		scaleArray.push([1, 2, [3, 4]]);
		scaleArray.push([5, [6, 7], 8]);
		scaleArray.flush();

		const flattenedArray = scaleArray.flat(1);

		const result = flattenedArray.toArray();
		expect(result).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
	});

	test('flat() flattens deeply nested', () => {
		const scaleArray = new ScaleArray({ writePath: writePath, maxSize: 2 });
		scaleArray.push([1, [2, [3, [4, 5]]]]);
		scaleArray.flush();

		const flattenedArray = scaleArray.flat(2);

		const result = flattenedArray.toArray();
		expect(result).toEqual([1, 2, 3, 4, 5]);
	});

	test(`flat() doesn't break un-flat`, () => {
		const scaleArray = new ScaleArray({ writePath: writePath, maxSize: 2 });
		scaleArray.push(1);
		scaleArray.push(2);
		scaleArray.flush();

		const flattenedArray = scaleArray.flat(1);

		const result = flattenedArray.toArray();
		expect(result).toEqual([1, 2]);

	});

	test('length scales', () => {
		const scaleArray = new ScaleArray({ writePath: writePath, maxSize: 2 });
		scaleArray.push({ item: 1 });
		scaleArray.push({ item: 2 });
		scaleArray.push({ item: 3 });

		// At this point, one file should have been created with 2 items and 1 item should be in memory
		expect(scaleArray.length).toBe(3);

		scaleArray.flush();

		// Now, all 3 items should be in files
		expect(scaleArray.length).toBe(3);

		scaleArray.push({ item: 4 });

		// Now, 3 items in files and 1 item in memory
		expect(scaleArray.length).toBe(4);

		scaleArray.push({ item: 5 });

		// Now, 3 items in first file, 2 items in second file, and 0 items in memory
		expect(scaleArray.length).toBe(5);
	});


	// Test for pushing and shifting multiple items
	test('shift() removes items correctly', () => {
		const scaleArray = new ScaleArray({ writePath: writePath, maxSize: 2 });
		scaleArray.push({ item: 1 });
		scaleArray.push({ item: 2 });
		scaleArray.push({ item: 3 });

		expect(scaleArray.shift()).toEqual({ item: 3 });
		expect(scaleArray.shift()).toEqual({ item: 1 });
		expect(scaleArray.shift()).toEqual({ item: 2 });
		expect(scaleArray.shift()).toBeUndefined();
	});

	// Test for consuming with cleanup set to false
	test('consume() with cleanup false', async () => {
		const scaleArray = new ScaleArray({ writePath: writePath, maxSize: 2 });
		scaleArray.push({ item: 1 });
		scaleArray.push({ item: 2 });
		scaleArray.push({ item: 3 });
		scaleArray.flush();

		const consumedData = [];
		for (const item of scaleArray.consume(false)) {
			consumedData.push(item);
		}

		expect(consumedData).toEqual([{ item: 1 }, { item: 2 }, { item: 3 }]);
		expect(scaleArray.length).toBe(3); // Items should still be in array
	});

	// Test for handling errors during file read/write
	test('handles errors during file read/write', () => {
		const scaleArray = new ScaleArray({ writePath: writePath, maxSize: 2 });
		scaleArray.push({ item: 1 });
		scaleArray.push({ item: 2 });
		scaleArray.push({ item: 3 });
		scaleArray.flush();

		// Simulate a read error
		jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
			throw new Error('Simulated read error');
		});

		const consumedData = [];
		for (const item of scaleArray.consume()) {
			consumedData.push(item);
		}

		expect(consumedData).toEqual([]); // Should handle the error gracefully
		fs.readFileSync.mockRestore();
	});

	// Test for flushing when memory usage is high
	// todo: figure out how to actually test this
	// test('flushes when memory usage is high', () => {
	// 	const scaleArray = new scaleArray({ writePath: writePath, maxSize: 2 });
	// 	scaleArray.push({ item: 1 });
	// 	scaleArray.push({ item: 2 });
	// 	scaleArray.push({ item: 3 });
	// 	scaleArray.flush();

	// 	// Simulate high memory usage
	// 	jest.spyOn(v8, 'getHeapStatistics').mockReturnValue({
	// 		heap_size_limit: 100,
	// 		total_heap_size: 100,
	// 		used_heap_size: 90
	// 	});

	// 	scaleArray.memCheck(0.75);
		
	// 	expect(global.gc).toHaveBeenCalled();
	// 	v8.getHeapStatistics.mockRestore();
	// });

	// Test for iterator working correctly with mutations
	//todo: for of should not consume
	test('for of mutates', () => {
		const scaleArray = new ScaleArray({ writePath: writePath, maxSize: 2 });
		scaleArray.push({ item: 1 });
		scaleArray.push({ item: 2 });
		scaleArray.push({ item: 3 });
		scaleArray.flush();

		const consumedData = [];
		for (const item of scaleArray) {
			item.mutated = true;
			consumedData.push(item);
		}

		const result = scaleArray.toArray().sort((a, b) => a.item - b.item);
		expect(result).toEqual([{ item: 1, mutated: true }, { item: 2, mutated: true }, { item: 3, mutated: true }]);
	});

	// Test pushing empty array
	test('push() with empty array', () => {
		const scaleArray = new ScaleArray({ writePath: writePath });
		scaleArray.push([]);
		expect(scaleArray.array.length).toBe(0);
		expect(scaleArray.length).toBe(0);
	});

	// Test consume with no data
	test('consume() with no data', () => {
		const scaleArray = new ScaleArray({ writePath: writePath });
		const consumedData = [];
		for (const item of scaleArray.consume()) {
			consumedData.push(item);
		}
		expect(consumedData).toEqual([]);
	});

	// Test clear after flush
	test('clear() after flush', () => {
		const scaleArray = new ScaleArray({ writePath: writePath });
		scaleArray.push({ item: 1 });
		scaleArray.flush();
		scaleArray.clear();
		expect(scaleArray.array.length).toBe(0);
		expect(scaleArray.files.length).toBe(0);
		expect(scaleArray.batch).toBe(0);
	});

	// Test handling large items
	test('handles large items', () => {
		const largeItem = { item: 'x'.repeat(10 * 1024 * 1024) }; // 10 MB item
		const scaleArray = new ScaleArray({ writePath: writePath, maxSize: 1 });
		scaleArray.push(largeItem);
		scaleArray.push(largeItem);
		scaleArray.flush();
		expect(scaleArray.length).toBe(2);

		const result = scaleArray.toArray();
		expect(result.length).toBe(2);
		expect(result[0].item.length).toBe(10 * 1024 * 1024);
	});

	// Test maxSize boundary condition
	test('maxSize boundary condition', () => {
		const scaleArray = new ScaleArray({ writePath: writePath, maxSize: 3 });
		scaleArray.push({ item: 1 });
		scaleArray.push({ item: 2 });
		scaleArray.push({ item: 3 });
		expect(scaleArray.length).toBe(3);
		expect(scaleArray.array.length).toBe(0);
		scaleArray.push({ item: 4 });
		expect(scaleArray.array.length).toBe(1); 
		expect(scaleArray.files.length).toBe(1);
		scaleArray.push({ item: 5 });
		scaleArray.push({ item: 6 });
		expect(scaleArray.length).toBe(6); 
		expect(scaleArray.array.length).toBe(0); 
		scaleArray.push({ item: 7 });
		expect(scaleArray.files.length).toBe(2);
		expect(scaleArray.array.length).toBe(1); 
		expect(scaleArray.length).toBe(7); 
		
		
	});

});