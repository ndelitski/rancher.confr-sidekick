import axios from 'axios';
import assert from 'assert';
import {merge, omit} from 'lodash';
import $url from 'url';

export default class RancherMetadataClient {
  constructor({address = 'rancher-metadata'} = {}) {
    this.address = address;
  }

  async _request(options) {
    assert(options.url);

    try {
      const res = await axios(merge(options, {
        url: $url.resolve(this.address, options.url),
        headers: this._auth ? {
          'Authorization': 'Basic ' + new Buffer(this._auth.user + ':' + this._auth.password).toString('base64')
        } : {},
      }));

      return res.data
    }
    catch (resp) {
      throw new Error('RancherClientError: non-200 code response ' + JSON.stringify(resp, null, 4));
    }
  }

  async get(...path) {
    return await this._request({
      url: `/${path.join['/']}`
    });
  }
  async getJson(...path) {
    return await this._request({
      url: `/${path.join['/']}`,
      responseType: 'json'
    });
  }
  async getService() {
    return await this.getJson('self/service');
  }
  async getVersion() {
    return (await this.getJson('self/container/labels')).version;
  }
  async getStack() {
    return await this.getJson('self/stack');
  }
  async getEnvironment() {
    return await this.getJson('self/environment');
  }
  async getDeploymentUnitLabel() {
    return await this.get('self/container/labels/io.rancher.service.deployment.unit');
  }
  async getLocation() {
    const service = (await this.getService()).replace(/-conf$/, ''); // dirty hack so far
    const stack = await this.getStack();
    const version = await this.getVersion();
    const environment = await this.getEnvironment();

    return {stack, version, environment, service};

    //return {
    //  stack: 'frontend',
    //  service: 'frontend',
    //  environment: 'staging'
    //}
  }

}
