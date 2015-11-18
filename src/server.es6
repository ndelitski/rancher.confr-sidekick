import _, {isObject, pluck, find, filter, indexBy, defaults, clone} from 'lodash';
import {info, debug, error} from './log';
import Promise, {all, delay, promisifyAll} from 'bluebird';
import assert from 'assert';
import RancherMetadataClient from './backends/rancher-metadata';
import RedisClient from './backends/redis';
import Docker from 'dockerode';
import ES6TemplateEngine from './engine';
import fs from 'fs';
import path from 'path';
import {json} from './helpers';

const RESTART_BATCH_SIZE = 2;

(async () => {
  const config = await require('./config');
  info(json`started with config:\n${config}`);
  assert(typeof config.interval == 'number', '`interval` should be a number');
  assert(config.docker, '`docker` is missing');
  assert(config.docker.socket || config.docker.tcp, '`docker.tcp` or `docker.socket` is missing');
  if (config.docker.tcp) {
    assert(config.docker.tcp && config.docker.tcp.host, '`docket.tcp.host` is missing');
    assert(config.docker.tcp && config.docker.tcp.certPath, '`docket.tcp.certPath` is missing');
  }

  const metadata = new RancherMetadataClient();
  const location = await metadata.getLocation();
  const self = await metadata.getSelf();
  debug(json`self: ${self}`);
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

  const redis = new RedisClient({redis: config.redis, location});
  exposeGlobal(); // dirty hack for template evaluation (have to find another way later)

  const engine = new ES6TemplateEngine();

  process.on('SIGINT', cleanup);
  while (true) {
    debug('poll template');
    await engine.load(await redis.tryGet('files/conf.es6'));
    const changed = await engine.eval();
    if (changed) {
      await restartMainContainer();
    }
    await delay(config.interval);
  }

  function exposeGlobal() {
    global.redis = redis;
    global.metadata = metadata;
  }

  let mainContainer;
  async function restartMainContainer(reloadCommands) {
    mainContainer = mainContainer || await getMainContainer()
    if (mainContainer.Labels['io.rancher.confr.restart'] == 'false') {
      debug('no need to restart main contaner due to `io.rancher.confr.restart`: false');
    }
    info('restarting main container...');

    const container = promisifyAll(docker.getContainer(mainContainer.Id));
    const createdIndex = self.create_index;
    const timeout = (Math.floor(createdIndex / RESTART_BATCH_SIZE) + 1) * 5000;
    await container.restartAsync({t: timeout});
  }

  function cleanup() {
    engine.cleanup();
  }

  async function getMainContainer() {
    const instanceContainers = filter(containers, ({Labels}) => Labels['io.rancher.service.deployment.unit'] == deploymentUnit);
    debug(json`instance containers found:\n${instanceContainers}`);
    const mainContainer = find(instanceContainers, ({Labels}) => Labels['io.rancher.stack_service.name'] == `${stack}/${service}`);
    info(json`found main container:\n${mainContainer}`);
    if (!mainContainer) {
      throw new Error(`main container not found`);
    }

    return mainContainer;
  }
})();

process.on('unhandledRejection', handleError);

function handleError(err) {
  error(err);
  process.exit(1);
}
