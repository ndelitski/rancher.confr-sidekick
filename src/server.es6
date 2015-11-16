import resolveConfig from './config';
import _, {pluck} from 'lodash';
import {info, trace, error} from './log';
import Promise, {all, delay} from 'bluebird';
import assert from 'assert';
import RancherMetadataClient from './backends/rancher-metadata';
import RedisClient from './backends/redis';
import fs from 'fs';
import path from 'path';

(async () => {
  const config = await resolveConfig();
  info(`started with config:\n${stringify(config)}`);
  assert(typeof config.interval == 'number', '`interval` should be a number');

  const metadata = new RancherMetadataClient();
  const {stack, version, environment, service} = await metadata.whereAmI();
  const redis = new RedisClient({redis: config.redis, location: {stack, version, environment, service}});
  exposeGlobal();
  await checkDockerSocket();
  let confn = await reloadConfN(await redis.get('confn.es6'));
  let result, previousResult;
  redis.watch(['confn.es6'], (key, value) => {
    if (key == 'confn.es6') {
      reloadConfN(value).then((evaled) => {
        confn = evaled;
      });
    }
  });

  while (true) {
    await process();
    await delay(config.interval);
  }

  function exposeGlobal() {
    global.redis = redis;
    global.metadata = metadata;
  }

  async function reloadConfN(content) {
    content = 'import {key} from "./template-functions"\n' + content;
    fs.writeFileSync(path.join(__dirname, 'template-generated.es6'), content, 'utf8');
    return require('./template-generated');
  }

  async function process() {
    info(`processing templates`);
    previousResult = result;
    result = await confn();
    let changed = false;
    let needReload = false;
    for (let [filePath, {content, reload}] of pairs(result)) {
      if (!previousResult || previousResult[filePath].content != content) {
        info(`file ${filePath} changed: ${content}`)
        fs.writeFileSync(filePath, content, 'utf8');
        needReload = needReload || reload;
        changed = true;
      }
    }
    if (previousResult && changed && needReload) {
      await reloadContainer();
    }
  }

  async function checkDockerSocket() {
    info('checking for docker socket');
  }

  async function reloadContainer() {
    info('requested to reload container');
  }
})();


process.on('unhandledRejection', handleError);

function handleError(err) {
  error(err);
  process.exit(1);
}

function stringify(obj) {
  return JSON.stringify(obj, null, 4);
}
