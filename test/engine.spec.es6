import ES6TemplateEngine from '../src/engine';
import fs from 'fs';
import path from 'path';
import RancherMetadataClient from '../src/backends/rancher-metadata';
import RedisClient from '../src/backends/redis';

describe('template functions', function() {
  const templateContent = fs.readFileSync(path.join(__dirname, 'templates', 'frontend.conf.es6'), 'utf8');
  const engine = new ES6TemplateEngine({content: templateContent});
  global.redis = new RedisClient({redis: {host: '192.168.99.100'}, location: {stack: 'frontend', service: 'frontend', environment: 'staging'}});
  global.metadata = new RancherMetadataClient();

  it('should use await tag function', async function() {
    await engine.eval();
    await engine.cleanup();
  });
});
