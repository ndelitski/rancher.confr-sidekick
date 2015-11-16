import assert from 'assert';
import redisLib from 'redis';
import {first, compact, isArray} from 'lodash';
import {promisifyAll, delay, all} from 'bluebird';
import {info, trace, error} from '../log';

promisifyAll(redisLib.RedisClient.prototype);
promisifyAll(redisLib.Multi.prototype);
const KEY_PREFIX = '/conf/';
export default class RedisClient {
  static keysBufferingTime = 200;

  constructor({redis, location: {stack, version, environment, service}}) {
    assert(redis.host, '`redis.host` is missing');
    this._stack = stack;
    this._version = version;
    this._environment = environment;
    this._service = service;
    this._redis = redisLib.createClient(redis);
    this._bufferedKeys = [];
  }

  _buffer(v) {
    trace(`${v} added to buffer`);
    if (this._bufferedKeys.length == 0) {
      trace('start buffering');
      this._buffering = (async () => {
        await delay(RedisClient.keysBufferingTime);
        trace(`flush buffer\n${this._bufferedKeys}`);
        const multi = this._redis.multi();
        for (let k of this._bufferedKeys) multi.get(k);
        this._bufferedKeys = [];
        return await multi.execAsync();
      })();
    }
    this._bufferedKeys.push(v);
  }

  /**
   * Will try to find
   * @param path
   * @param buffer
   * @returns {*}
   */
  async tryGet(path, {buffer = false} = {}) {
    if (isArray(path)) {
      return await all(path).map((p) => this.tryGet(p, {buffer}));
    }

    const searchedKeys = this.suggestKeys(path);

    // pushing to buffer and wait until buffer flush
    if (buffer) {
      let startIndex = this._bufferedKeys.length;
      for (let p of searchedKeys) {
        this._buffer(p);
      }
      const res = first((await this._buffering).slice(startIndex, startIndex + searchedKeys.length + 1), (v) => !!v);
      if (!res) {
        throw new Error(`key ${path} was not found in paths:\n${searchedKeys.join('\n')}`);
      }
      return res;
    }
    // invoke immeaditealy
    else {
      const multi = this._redis.multi();
      for (let p of searchedKeys) multi.get(p);
      const res = first(await multi.execAsync(), (v) => !!v);
      if (!res) {
        throw new Error(`key ${path} was not found in paths:\n${searchedKeys.join('\n')}`);
      }
      return res;
    }
  }

  /**
   * Strict way of getting key value. Search in /conf/:stack/:service/:environment/
   * @param key
   * @returns {*}
   */
  async get(key) {
    return await this._redis.getAsync(KEY_PREFIX + compact([this._stack, this._service, this._environment, this._version, key]).join('/'))
  }

  suggestKeys(path) {
    const paths = [];
    const fullPath = [this._stack, this._service, this._environment, this._version];
    for (var i = fullPath.length - 1; i >= 0; i--) {
      var item = fullPath[i];
      if (item) {
        paths.push(KEY_PREFIX + fullPath.slice(0, i + 1).concat(path).join('/'));
      }
    }
    paths.push(KEY_PREFIX + path);
    return paths;
  }

  async watch() {

  }
}
