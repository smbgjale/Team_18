// A minimal glTF 2.0 binary: a unit box (-0.5..0.5 on every axis) with one embedded JPEG
// on every face. The viewer scales it to the product's real width, depth and height.
// The front face (+Z) shows the photo upright. glTF's texture origin is the top-left.

const FACE_POSITIONS: number[][] = [
  // +Z front, then -Z, +X, -X, +Y, -Y. Four corners each, CCW from outside.
  [-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5],
  [0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5],
  [0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5],
  [-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5],
  [-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5],
  [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5],
];

const FACE_NORMALS: number[][] = [
  [0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1],
  [0, 0, -1], [0, 0, -1], [0, 0, -1], [0, 0, -1],
  [1, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0],
  [-1, 0, 0], [-1, 0, 0], [-1, 0, 0], [-1, 0, 0],
  [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0],
  [0, -1, 0], [0, -1, 0], [0, -1, 0], [0, -1, 0],
];

// v = 0 is the top of the image, so the bottom edge of each face is v = 1.
const CORNER_UV = [[0, 1], [1, 1], [1, 0], [0, 0]];
const TRIANGLES = [0, 1, 2, 0, 2, 3];

function f32(rows: number[][]) {
  const out = new Float32Array(rows.flat());
  return Buffer.from(out.buffer, out.byteOffset, out.byteLength);
}

export function buildTexturedBoxGlb(jpeg: Buffer): Buffer {
  if (jpeg.length < 4 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error("The texture must be a JPEG.");
  const positions = f32(FACE_POSITIONS);
  const normals = f32(FACE_NORMALS);
  const uvs = f32(FACE_POSITIONS.map((_, i) => CORNER_UV[i % 4]));
  const indexValues: number[] = [];
  for (let face = 0; face < 6; face++) for (const corner of TRIANGLES) indexValues.push(face * 4 + corner);
  const indexArray = new Uint16Array(indexValues);
  const indices = Buffer.from(indexArray.buffer, indexArray.byteOffset, indexArray.byteLength);
  const bin = Buffer.concat([positions, normals, uvs, indices, jpeg]);
  const at = (start: number, length: number, target?: number) => ({ buffer: 0, byteOffset: start, byteLength: length, ...(target ? { target } : {}) });
  const n0 = 0;
  const n1 = positions.length;
  const n2 = n1 + normals.length;
  const n3 = n2 + uvs.length;
  const n4 = n3 + indices.length;

  const doc = {
    asset: { version: "2.0", generator: "homely-ai" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: "product" }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 }] }],
    materials: [{
      pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 0.8 },
      doubleSided: true,
    }],
    textures: [{ source: 0 }],
    images: [{ bufferView: 4, mimeType: "image/jpeg" }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 24, type: "VEC3", min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] },
      { bufferView: 1, componentType: 5126, count: 24, type: "VEC3" },
      { bufferView: 2, componentType: 5126, count: 24, type: "VEC2" },
      { bufferView: 3, componentType: 5123, count: 36, type: "SCALAR" },
    ],
    bufferViews: [at(n0, positions.length, 34962), at(n1, normals.length, 34962), at(n2, uvs.length, 34962), at(n3, indices.length, 34963), at(n4, jpeg.length)],
    buffers: [{ byteLength: bin.length }],
  };

  const json = Buffer.from(JSON.stringify(doc));
  const jsonPad = (4 - (json.length % 4)) % 4;
  const jsonChunk = Buffer.concat([json, Buffer.alloc(jsonPad, 0x20)]);
  const binPad = (4 - (bin.length % 4)) % 4;
  const binChunk = Buffer.concat([bin, Buffer.alloc(binPad, 0)]);
  const total = 12 + 8 + jsonChunk.length + 8 + binChunk.length;
  const out = Buffer.alloc(total);
  out.write("glTF", 0, "utf8");
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(total, 8);
  let cursor = 12;
  out.writeUInt32LE(jsonChunk.length, cursor);
  out.writeUInt32LE(0x4e4f534a, cursor + 4);
  jsonChunk.copy(out, cursor + 8);
  cursor += 8 + jsonChunk.length;
  out.writeUInt32LE(binChunk.length, cursor);
  out.writeUInt32LE(0x004e4942, cursor + 4);
  binChunk.copy(out, cursor + 8);
  return out;
}
