import path from 'path';
import fs from 'fs';
import {promisify} from 'bluebird';
import {info} from './log';
import axios from 'axios';

const readFile = promisify(fs.readFile);
const DEFAULT_CONFIG_FILE = path.join(__dirname, '../config.json');

export default (async function resolveConfig() {
  if (fs.existsSync(DEFAULT_CONFIG_FILE)) {
    info(`reading config from file ${DEFAULT_CONFIG_FILE}`);
    return await fileSource(DEFAULT_CONFIG_FILE);
  } else {
    info('trying to compose config from env variables');
    return await envSource();
  }
})()

async function fileSource(filePath) {
  const contents = await readFile(filePath, 'utf8');
  const parsed = JSON.parse(contents);
  return parsed;
}

async function envSource() {
  const {
    CONFR_REDIS_HOST,
    CONFR_REDIS_PORT,
    CONFR_REDIS_PASS,
    CONFR_REDIS_TLS,
    CONFR_INTERVAL,
    CONFR_DOCKER_SOCKET
  } = process.env;

  return {
    redis: {
      host: CONFR_REDIS_HOST,
      port: parseInt(CONFR_REDIS_PORT) || 6379,
      password: CONFR_REDIS_PASS,
      tls: CONFR_REDIS_TLS ? true : undefined
    },
    interval: parseInt(CONFR_INTERVAL) || 5000,
    docker: {
      socket: CONFR_DOCKER_SOCKET || '/var/run/docker.sock'
    }
  }
}
