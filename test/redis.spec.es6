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

  it('should hierarchicaly get key value', async function() {
    const redis = new RedisClient({redis: {host: '192.168.99.100'}, location: {stack: 'some-service', service: 'some-stack', environment: 'some-env'}});

    await redis._client.setAsync('/conf/files/rootfile', 'foo');
    expect(await redis.tryGet('files/rootfile')).to.eql('foo');
  });
});
