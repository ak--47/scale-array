
# ⚖️ ScaleArray

ScaleArray is a Node.js module that allows you to handle large arrays efficiently by storing them in memory and flushing items to disk as json when they reach a certain length. 

Because ScaleArray presents it's API as a regular array, you can use familiar array methods like `map`, `filter`, `reduce`, and `forEach` to process and transform large datasets with ease. 

File I/O is _synchronous_, so you do not need to worry about race conditions or asynchronous callbacks; essentially: 

- when you `push()` items onto the array, if the array grows larger than `maxSize`, it will the contents of the array to disk before continuing.

- when you `pop()` items from the array, it will load the contents of the array from disk if it is not already in memory.

this means you can work with large datasets as if they were in memory, without worrying about memory constraints.

## Installation

```sh
npm install scale-array
```

## Features

- **In-Memory Array Handling**: Manipulate large arrays as if they are in memory.
- **Automatic Disk Flushing**: Automatically flushes arrays to disk when they exceed a specified size.
- **Iterable and Transformable**: Iterate, map, filter, reduce, and flatten large datasets easily.
- **Customizable**: Specify the maximum in-memory size, file paths, and more.

## Usage

### Basic Example

```javascript
const ScalableArray = require('scalable-array');

const options = {
  name: 'myArray',
  writePath: './data',
  maxSize: 5 // Flush to disk after 5 items
};

const myScalingArray = new ScalableArray(options);

// Add some items
myScalingArray.push({ item: 1 });
myScalingArray.push({ item: 2 });
myScalingArray.push({ item: 3 });
myScalingArray.push({ item: 4 });
myScalingArray.push({ item: 5 });

console.log(`Array length: ${myScalingArray.length}`); // 5
console.log(`Files written: ${myScalingArray.files}`) // 1
console.log(`In-memory array: ${myScalingArray.array.length}`); // 0

// Retrieve items
const consumedData = [];
	for (const item of myScalingArray.consume()) {
		consumedData.push(item);
	}

console.log(`Array length: ${myScalingArray.length}`); // 0
console.log(`Files written: ${myScalingArray.files}`) // 0
console.log(`In-memory array: ${myScalingArray.array.length}`); // 0
console.log(`Consumed data: ${consumedData}`); // [{ item: 1 }, { item: 2 }, { item: 3 }, { item: 4 }, { item: 5 }]
```

### Iterate Over Items

```javascript
for (const item of array) {
  console.log(item);
}
```

### Transform Data

```javascript
// Map items to a new array
const mappedArray = array.map(item => ({ ...item, mapped: true }));
for (const item of mappedArray) {
  console.log(item); // { item: 1, mapped: true }, etc.
}

// Filter items into a new array
const filteredArray = array.filter(item => item.item % 2 === 0);
for (const item of filteredArray) {
  console.log(item); // { item: 2 }, etc.
}
```

### Reduce Data

```javascript
const sum = array.reduce((acc, item) => acc + item.item, 0);
console.log(`Sum of items: ${sum}`); // 15
```

### Flatten Nested Arrays

```javascript
const nestedArray = new ScalableArray({ writePath: './data', maxSize: 2 });
nestedArray.push([1, [2, [3, 4]]]);
const flatArray = nestedArray.flat(2);
console.log(flatArray.toArray()); // [1, 2, 3, 4]
```

## API

### Constructor

```javascript
const array = new ScalableArray(options);
```

- `options.name` (string): The name of the ScalableArray instance.
- `options.writePath` (string): The path to write the JSON files to.
- `options.maxSize` (number): The maximum size of the in-memory array before flushing.

### Methods

- `push(item)`: Adds an item (or an array of items) to the array, flushing to disk if necessary.
- `shift()`: Removes and returns the first item from the array.
- `flush(force = false)`: Flushes the current array to disk.
- `clear()`: Clears the array and deletes all files.
- `forEach(callback)`: Applies a function to each item in the array.
- `map(callback, name)`: Maps each item in the array to a new ScalableArray.
- `filter(callback, name)`: Filters items into a new ScalableArray.
- `reduce(callback, initialValue, name)`: Reduces the array to a single value.
- `flat(depth = 1, name)`: Flattens nested arrays into a new ScalableArray.
- `toArray(consumeOriginal = false)`: Collects all values in the array and returns a full array.

### Properties

- `length`: The total number of items in the array.
- `files`: The list of file paths where data has been flushed.
- `writePath`: The current write path.
- `name`: The name of the ScalableArray instance.
- `maxSize`: The maximum size of the in-memory array before flushing.

### Static Methods

- `ScalableArray.memCheck(percent = 0.75)`: Checks memory usage and triggers garbage collection if usage exceeds the specified percentage.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

MIT License

