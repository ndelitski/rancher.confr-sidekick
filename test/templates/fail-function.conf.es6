export default async function () {
  return {
    '/etc/rancher-dns/config.json': {
      content: await file('config.json'),
      reload: true
    }
  }
}
