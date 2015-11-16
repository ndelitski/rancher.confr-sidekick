export async function key(path) {
  if (path.match(/^self/)) {
    return await metadata.get(path);
  } else {
    return await redis.get(path, {buffer: true});
  }
}
