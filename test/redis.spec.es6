import RedisClient from '../src/backends/redis';

describe('redis', function() {
  const redis = new RedisClient({redis: {host: '192.168.99.100'}, location: {stack: 'frontend', service: 'frontend', environment: 'staging'}});
	it('should not buffer multiple key requests if no buffer option', async function() {
		const results = [
      await redis.get('files/config.json'),
      await redis.get('backend'),
      await redis.get('realtime')
    ];
    console.log('results: ', results);
	});

  it('should buffer multiple key requests if with buffer option', async function() {
    const results = await Promise.all([
      redis.tryGet('files/config.json', {buffer: true}),
      redis.tryGet('backend', {buffer: true}),
      redis.tryGet('realtime', {buffer: true})
    ]);

    const results2 = await redis.tryGet([
      'files/config.json',
      'backend',
      'realtime'
    ], {buffer: true});

    expect(results).to.eql(results2);
    console.log('results: ', results);
  });

  describe('hierarchic get', async function() {
    const test = function(location, path) {
      return async function () {
        const redis = new RedisClient({redis: {host: '192.168.99.100'}, location});
        const key = `/conf/${path ? path + '/' : ''}files/rootfile2`;
        await redis._client.setAsync(key, 'foo');
        expect(await redis.tryGet('files/rootfile2')).to.eql('foo');
        await redis._client.delAsync(key);
      }
    };

    it('should get root value', test({
      stack: 'stack',
      service: 'service',
      environment: 'env'
    }));

    it('should get stack value', test({
      stack: 'stack',
      service: 'service',
      environment: 'env'
    }, 'stack'));

    it('should get stack+env value when service not specified', test({
      stack: 'stack',
      environment: 'env'
    }, 'stack/env'));

    it('should get stack+env value when service specified', test({
      stack: 'stack',
      service: 'service',
      environment: 'env'
    }, 'stack/env'));
  });
});
