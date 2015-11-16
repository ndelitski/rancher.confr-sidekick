import _, {isObject, pluck, find, filter} from 'lodash';
import {info, debug, error} from './log';
import Promise, {all, delay, promisifyAll} from 'bluebird';
import assert from 'assert';
import RancherMetadataClient from './backends/rancher-metadata';
import RedisClient from './backends/redis';
import Docker from 'dockerode';
import Processor from './processor';
import fs from 'fs';
import path from 'path';

(async () => {
  const config = await require('./config');
  info(json`started with config:\n${config}`);
  assert(typeof config.interval == 'number', '`interval` should be a number');
  assert(config.docker, '`docker` is missing');
  assert(config.docker.socket || config.docker.tcp, '`docker.tcp` or `docker.socket` is missing');
  assert(config.docker.tcp && config.docker.tcp.host, '`docket.tcp.host` is missing');
  assert(config.docker.tcp && config.docker.tcp.certPath, '`docket.tcp.certPath` is missing');

  const metadata = new RancherMetadataClient();
  const location = await metadata.getLocation();
  const {stack, service, environment, version} = location;
  debug(json`started in:\n ${location}`);

  let dockerOpts;
  if (config.docker.socket) {
    dockerOpts = {socketPath: config.docker.socket}
  } else if (config.docker.tcp) {
    dockerOpts = {
      protocol: 'https',
      host: config.docker.tcp.host,
      port: config.docker.tcp.port || 2376,
      ca: fs.readFileSync(path.join(config.docker.tcp.certPath, 'ca.pem')),
      cert: fs.readFileSync(path.join(config.docker.tcp.certPath, 'cert.pem')),
      key: fs.readFileSync(path.join(config.docker.tcp.certPath, 'key.pem'))
    }
  }

  debug(json`initializing docker client with options:\n ${dockerOpts}`);
  const docker = promisifyAll(new Docker(dockerOpts));
  const containers = await docker.listContainersAsync();
  const deploymentUnit = await metadata.getDeploymentUnitLabel();
  debug(`deployment unit is ${deploymentUnit}`);
  const instanceContainers = filter(containers, ({Labels}) => Labels['io.rancher.service.deployment.unit'] == deploymentUnit);
  debug(json`instance containers found:\n${instanceContainers}`);
  const targetContainer = find(instanceContainers, ({Labels}) => Labels['io.rancher.stack_service.name'] == `${stack}/${service}`);
  info(json`found target container:\n${targetContainer}`);
  if (!targetContainer) {
    throw new Error(`target container not found`);
  }

  const redis = new RedisClient({redis: config.redis, location});
  exposeGlobal(); // dirty hack for awhile

  await checkDockerSocket();
  let confn = new Processor();

  process.on('SIGINT', cleanup);

  while (true) {
    await confn.load(await redis.tryGet('files/conf.es6'));
    const changed = await confn.eval();
    if (changed) {
      await reloadContainer();
    }
    await delay(config.interval);
  }

  function exposeGlobal() {
    global.redis = redis;
    global.metadata = metadata;
  }

  async function checkDockerSocket() {
    info('checking for docker socket');
  }

  async function reloadContainer() {
    info('requested to reload container');
  }

  function cleanup() {
    confn.cleanup();
  }

})();

process.on('unhandledRejection', handleError);

function handleError(err) {
  error(err);
  process.exit(1);
}

function json(strings, ...values) {
  let result = '';
  strings.forEach((fragment, i) => {
    let value = values[i];
    result += fragment + (isObject(value) ? stringify(value) : value || '')
  });
  return result;
}

function stringify(obj) {
  return JSON.stringify(obj, null, 4);
}
