import fs from 'fs';
import path from 'path';
import {info, debug, error} from './log';
import {isString, pairs, keys, isObject} from 'lodash';
import crypto from 'crypto';
import {promisify, props} from 'bluebird';

const mkdirp = promisify(require('mkdirp'));

export default class ES6TemplateEngine {
  constructor({content} = {}) {
    if (content) {
      this._loading = this.load(content);
    }
  }

  async eval() {
    if (this._loading) {
      await this._loading;
    }

    if (!this._tmpl) {
      throw new Error('no template loaded to be evaled in the processor');
    }
    debug(`start evaluating template`);
    this._previousResult = this._result;
    this._result = await this._tmpl();
    let changed = false;
    for (let [filePath, content] of pairs(this._result)) {
      if (!isString(content)) {
        throw new Error(`${filePath} content resolved to non-string value: ${content}`);
      }
      if (!this._previousResult || this._previousResult[filePath] != content) {
        info(`file ${filePath} changed: ${content}`);
        this._writeResultFile(filePath, content);
        changed = true;
      }
    }
    if (this._previousResult && changed) {
      return changed;
    }
  }

  async _writeResultFile(filePath, content) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      await mkdirp(dir);
    }

    fs.writeFileSync(filePath, content, 'utf8');
  }

  async load(content) {
    const functions = keys(require('./template-functions'));

    content = `import {${functions.join(',')}} from "./template-functions"
import {props} from 'bluebird';
${content.replace(new RegExp('export\\s*default\\s*\\{'), 'export default async function template() { return await props({')} )}
`;
    const hashsum = await this.computeFileHash(content);
    if (this._prevTemplateHashsum !== hashsum) {
      if (this._prevTemplateHashsum) {
        info(`template hashsum changed from ${this._prevTemplateHashsum} to ${hashsum}`)
      }
      this._prevTemplateHashsum = hashsum;
      const fileName = `template-generated.${hashsum}.es6`;
      const filePath = path.join(__dirname, fileName);
      fs.writeFileSync(filePath, content, 'utf8');
      info(`loaded ${fileName}:\n${content}`);
      this._tmpl = require('./' + fileName);
    }
  }

  async computeFileHash(text) {
    return crypto
      .createHash('md5')
      .update(text, 'utf8')
      .digest('hex')
  }

  async cleanup () {
    const generatedFiles = fs.readdirSync(__dirname).filter((f) => f.match(/^template-generated/));
    info(`cleaning ${generatedFiles}`);
    for (let file of generatedFiles) {
      fs.unlinkSync(path.join(__dirname, file));
    }
  }
}
