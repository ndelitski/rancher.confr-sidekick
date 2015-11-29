import ES6TemplateEngine from '../src/engine';
import fs from 'fs';
import path from 'path';
import RancherMetadataClient from '../src/backends/rancher-metadata';
import RedisClient from '../src/backends/redis';

describe('template functions', function() {
  global.redis = new RedisClient({redis: {host: '192.168.99.100'}, location: {stack: 'frontend', service: 'frontend', environment: 'staging'}});
  global.metadata = new RancherMetadataClient();
  let engine;

  it('should process template exports hash', async function() {
    engine = await loadEngine('frontend');
    await engine.eval();
  });

  it('should fail if template is a function', async function() {
    engine = await loadEngine('fail-function');

    await assert.throwAsync(async () => {
      await engine.eval();
    });
  });

  it('should fail if template is an array', async function() {
    engine = await loadEngine('fail-function');

    await assert.throwAsync(async () => {
      await engine.eval();
    });
  });

  it('should rerender handle changes in keys', async function() {
    engine = await loadEngine('render-changes');

    await redis._client.setAsync('/conf/frontend/frontend/staging/files/some-text-file', 'foo');

    await engine.eval();
    const result = engine._result['/tmp/plain.conf'];
    expect(result).to.eql('foo');
    await redis._client.setAsync('/conf/frontend/frontend/staging/files/some-text-file', 'bar');
    expect(await engine.eval()).to.eql(true);
    const result2 = engine._result['/tmp/plain.conf'];
    expect(result2).to.eql('bar');
  });

  after(async function() {
    await engine.cleanup();
  });

  function loadEngine(templateName) {
    const templateContent = fs.readFileSync(path.join(__dirname, 'templates', `${templateName}.conf.es6`), 'utf8');
    return new ES6TemplateEngine({content: templateContent});
  }
});
