const fs = require('node:fs');
const path = require('node:path');

const sizes = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192,
};

const resDir = path.resolve(__dirname, '..', 'app', 'src', 'main', 'res');

// Base64-encoded minimal 1x1 PNG with brand color (#d4836a)
// We'll scale it up to the needed dimensions
function createMinimalPNG(size) {
    // Create a valid PNG file with the given size and a simple icon
    // This generates a solid-color PNG with the brand color

    // PNG signature
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

    // IHDR chunk
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(size, 0);    // width
    ihdrData.writeUInt32BE(size, 4);    // height
    ihdrData.writeUInt8(8, 8);          // bit depth
    ihdrData.writeUInt8(2, 9);          // color type (RGB)
    ihdrData.writeUInt8(0, 10);         // compression
    ihdrData.writeUInt8(0, 11);         // filter
    ihdrData.writeUInt8(0, 12);         // interlace

    const ihdr = createChunk('IHDR', ihdrData);

    // IDAT chunk - raw image data
    // Each row: filter byte (0) + RGB pixels
    const rowSize = 1 + size * 3;
    const rawData = Buffer.alloc(rowSize * size);

    const r = 0xd4, g = 0x83, b = 0x6a; // brand color

    for (let y = 0; y < size; y++) {
        const rowOffset = y * rowSize;
        rawData[rowOffset] = 0; // no filter
        for (let x = 0; x < size; x++) {
            const pixelOffset = rowOffset + 1 + x * 3;
            rawData[pixelOffset] = r;
            rawData[pixelOffset + 1] = g;
            rawData[pixelOffset + 2] = b;
        }
    }

    const zlib = require('node:zlib');
    const compressed = zlib.deflateSync(rawData);
    const idat = createChunk('IDAT', compressed);

    // IEND chunk
    const iend = createChunk('IEND', Buffer.alloc(0));

    return Buffer.concat([signature, ihdr, idat, iend]);
}

function createChunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);

    const typeBuffer = Buffer.from(type, 'ascii');
    const crcData = Buffer.concat([typeBuffer, data]);

    const crc = crc32(crcData);
    const crcBuffer = Buffer.alloc(4);
    crcBuffer.writeUInt32BE(crc);

    return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function crc32(data) {
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
        crc ^= data[i];
        for (let j = 0; j < 8; j++) {
            if (crc & 1) {
                crc = (crc >>> 1) ^ 0xedb88320;
            } else {
                crc >>>= 1;
            }
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
}

for (const [dir, size] of Object.entries(sizes)) {
    const dirPath = path.join(resDir, dir);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }

    const png = createMinimalPNG(size);
    fs.writeFileSync(path.join(dirPath, 'ic_launcher.png'), png);
    fs.writeFileSync(path.join(dirPath, 'ic_launcher_round.png'), png);
    console.log(`Created ${dir}/ic_launcher.png (${size}x${size})`);
}

console.log('Launcher icons generated successfully!');
