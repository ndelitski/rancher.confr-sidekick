import axios from 'axios';
import assert from 'assert';
import {merge, omit} from 'lodash';
import $url from 'url';
import {info, debug, error} from '../log';
import {json} from '../helpers';
export default class RancherMetadataClient {
  constructor({address = 'http://rancher-metadata', prefix = '2015-07-25'} = {}) {
    this.address = address;
    this.prefix = prefix;
  }

  async _request(options) {
    assert(options.url);

    try {
      const reqUrl = $url.resolve(this.address, options.url);
      debug(`requesting ${reqUrl}`);
      const res = await axios(merge(options, {
        url: $url.resolve(this.address, options.url),
      }));
      debug(json`returned ${reqUrl}:\n${res.data}`);
      return res.data
    }
    catch (resp) {
      throw new Error(json`RancherMetadataError: non-200 code response:\n${resp}`);
    }
  }

  async get(...path) {
    return await this._request({
      url: `/${this.prefix}/${path.join('/')}`
    });
  }
  async getJson(...path) {
    return await this._request({
      url: `/${this.prefix}/${path.join('/')}`,
      headers: {
        'Accept': 'application/json'
      },
      responseType: 'json'
    });
  }
  async getSelf() {
    return await this.getJson('self');
  }
  async getService() {
    const labels = await this.getJson('self/container/labels');
    return labels['io.confr.service_name'] || (await this.get('self/container/labels/io.rancher.stack_service.name')).split('/')[1];
  }
  async getVersion() {
    const labels = await this.getJson('self/container/labels');
    return labels.version || labels['io.confr.version'] || labels['io.ci.branch'];
  }
  async getStack() {
    return await this.get('self/stack/name');
  }
  async getEnvironment() {
    return await this.get('self/stack/environment_name');
  }
  async getDeploymentUnitLabel() {
    return await this.get('self/container/labels/io.rancher.service.deployment.unit');
  }
  async getLocation() {
    const service = await this.getService();
    const stack = await this.getStack();
    const version = await this.getVersion();
    const environment = await this.getEnvironment();

    return {stack, version, environment, service};
  }

}
