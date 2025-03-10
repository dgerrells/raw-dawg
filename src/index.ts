const TypeBoolean = 0;
const TypeNumber = 1;
const TypeString = 2;
const TypeArray = 3;
const TypeObject = 4;
const TypeBackref = 5;
const TypeNull = 6;
const TypeUndefined = 7;

const packType = (type: number, metadata = 0) =>
  (type << 5) | (metadata & 0x1f);

const writeVarint = (offset: number, val: number, dataView: DataView) => {
  while (val >= 0x80) {
    dataView.setUint8(offset, (val & 0x7f) | 0x80);
    offset += 1;
    val >>>= 7;
  }
  dataView.setUint8(offset, val);
  offset += 1;

  return offset;
};

export function toRaw(data: any, bytes = new Uint8Array(10000)) {
  const stack: Array<any> = [];
  const backrefCache = new Map<any, number>();
  const dv = new DataView(bytes.buffer);
  let offset = 0;

  stack.push(data);

  while (stack.length > 0) {
    const val = stack.pop();
    const type = typeof val;

    switch (type) {
      case "boolean":
        dv.setUint8(offset++, packType(TypeBoolean, ~~val));
        break;
      case "number":
        dv.setUint8(offset++, packType(TypeNumber));
        dv.setFloat32(offset, val);
        offset += 4;
        break;
      case "undefined":
        dv.setUint8(offset++, packType(TypeUndefined));
        break;
      case "string":
        // note: this may not be worth trade off
        if (backrefCache.has(val)) {
          dv.setUint8(offset++, packType(TypeBackref));
          // @ts-ignore <--- we know that the val exists
          offset = writeVarint(offset, backrefCache.get(val), dv);
          break;
        }

        // add to backref cache
        backrefCache.set(val, backrefCache.size);

        dv.setUint8(offset++, packType(TypeString));
        offset = writeVarint(offset, val.length, dv);
        for (let i = 0; i < val.length; i++) {
          offset = writeVarint(offset, val.charCodeAt(i), dv);
        }
        break;
      case "object":
        if (null === val) {
          dv.setUint8(offset++, packType(TypeNull));
          break;
        }

        // check backref
        if (backrefCache.has(val)) {
          dv.setUint8(offset++, packType(TypeBackref));
          offset = writeVarint(offset, backrefCache.size, dv);
          break;
        }

        // save for backref
        backrefCache.set(val, backrefCache.size);

        //encoded in reverse order since stacking
        if (Array.isArray(val)) {
          dv.setUint8(offset++, packType(TypeArray));
          const length = val.length;
          offset = writeVarint(offset, length, dv);
          for (let i = length; i > 0; i--) {
            stack.push(val[i - 1]);
          }
          break;
        }

        //object
        dv.setUint8(offset++, packType(TypeObject));
        const keys = Object.keys(val);
        const length = keys.length;
        offset = writeVarint(offset, length, dv);
        //encoded in reverse order since stacking
        for (let i = length; i > 0; i--) {
          // reverse order since it is popped off
          stack.push(val[keys[i - 1]]);
          stack.push(keys[i - 1]);
        }
        break;
      default:
        throw `Unsupported type: ${type}`;
    }
  }

  return new Uint8Array(dv.buffer, 0, offset);
}

const readVarint = (dataView: DataView, box: { offset: number }) => {
  let result = 0;
  let shift = 0;

  while (true) {
    const byte = dataView.getUint8(box.offset);
    box.offset += 1;
    result |= (byte & 0x7f) << shift;
    shift += 7;
    if ((byte & 0x80) === 0) {
      break;
    }
  }

  return result;
};

export function fromRaw(bytes: Uint8Array) {
  const box = { offset: 0 };
  const backrefCache: Array<any> = [];
  const dv = new DataView(bytes.buffer);

  function readRaw() {
    const t = dv.getUint8(box.offset++);
    const type = t >> 5;
    const metadata = t & 0x1f;

    switch (type) {
      case TypeBackref:
        const index = readVarint(dv, box);
        return backrefCache[index];
      case TypeBoolean:
        return !!metadata;
      case TypeNumber:
        const val = dv.getFloat32(box.offset);
        box.offset += 4;
        return val;
      case TypeUndefined:
        return undefined;
      case TypeNull:
        return null;
      case TypeString:
        const strLen = readVarint(dv, box);
        const chars: string[] = [];
        for (let i = 0; i < strLen; i++) {
          chars.push(String.fromCharCode(readVarint(dv, box)));
        }
        const str = chars.join("");
        backrefCache[backrefCache.length] = str;
        return str;
      case TypeArray:
        const arrLen = readVarint(dv, box);
        const array: Array<any> = [];
        backrefCache[backrefCache.length] = array;
        for (let i = 0; i < arrLen; i++) {
          array.push(readRaw());
        }
        return array;
      case TypeObject:
        const objLen = readVarint(dv, box);
        const obj: Record<any, any> = {};
        backrefCache[backrefCache.length] = obj;
        for (let i = 0; i < objLen; i++) {
          obj[readRaw()] = readRaw();
        }
        return obj;
      default:
        throw `Unsupported type: ${type}`;
    }
  }

  return readRaw();
}