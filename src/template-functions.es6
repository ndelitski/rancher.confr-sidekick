import {all} from 'bluebird';

export async function key(path) {
  if (path.match(/^self/)) {
    return await metadata.get(path);
  } else {
    return await redis.tryGet(path, {buffer: true});
  }
}

export async function file(fileName) {
  return await redis.tryGet(`files/${fileName}`);
}

export async function aw(strings, ...values) {
  let sum = '';
  let results = await all(values);
  strings.forEach((frag, i) => {
    sum += frag + (results[i] ?  results[i] : '');
  });
  return sum;
}
