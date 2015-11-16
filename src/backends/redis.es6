import assert from 'assert';
import redis from 'redis';
import {promisifyAll, delay, first} from 'bluebird';

promisifyAll(redis.RedisClient.prototype);
promisifyAll(redis.Multi.prototype);

export default class RedisClient {
  static keysBufferingTime = 1000;
  constructor({redis, stack, version, environment, service}) {
    assert(redis.host, '`redis.host` is missing');
    this._stack = stack;
    this._version = version;
    this._environment = environment;
    this._service = service;
    this._redis = redis.createClient(redis);
    this._bufferedKeys = [];
    this._buffering = new Promise();
  }
  _buffer(v) {
    if (this._bufferedKeys.length == 0) {
      this._buffering = (async () => {
        await delay(RedisClient.keysBufferingTime);
        const multi = this._redis.multi();
        for (let k of this._bufferedKeys) multi.get(k);
        return await multi.execAsync();
      })();
    }
    this._bufferedKeys.push(v);
  }
  async get(path, {buffer = false}) {
    if (buffer) {
      let startIndex = this._bufferedKeys.length, endIndex;
      for (let p of this._searchPath(path)) {
        this._buffer('/conf/' + p);
      }
      endIndex = this._bufferedKeys.length;
      return first((await this._buffering).slice(startIndex, endIndex), (v) => !!v);
    } else {
      const multi = this._redis.multi();
      for (let p of this._searchPath(path)) multi.get(p);
      return await multi.execAsync();
    }
  }
  _searchPath(path) {
    const paths = [path];
    const fullPath = [this._environment, this._stack, this._service, this._version];
    for (var i = fullPath.length -1; i >= 0; i--) {
      var item = fullPath[i];
      if (item) {
        paths.push(fullPath.slice(0, i).concat(path).join('/'));
      }
    }
    return paths.reverse();
  }
  async watch() {

  }
}
