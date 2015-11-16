import fs from 'fs';
import path from 'path';
import {info, trace, error} from './log';
import {pairs} from 'lodash';
import crypto from 'crypto';
import {promisify} from 'bluebird';

const mkdirp = promisify(require('mkdirp'));

export default class TemplateProcessor {
  constructor({content} = {}) {
    if (content) {
      this._loading = this.load(content);
    }
  }

  async eval() {
    if (this._loading) {
      await this._loading;
    }

    if (!this._tmplFn) {
      throw new Error('no template loaded to be evaled in the processor');
    }

    info(`processing templates`);
    this._previousResult = this._result;
    this._result = await this._tmplFn();
    let changed = false;
    let needReload = false;
    for (let [filePath, {content, reload}] of pairs(this._result)) {
      if (!this._previousResult || this._previousResult[filePath].content != content) {
        info(`file ${filePath} changed: ${content}`);
        this._writeResultFile(filePath, content);
        needReload = needReload || reload;
        changed = true;
      }
    }
    if (this._previousResult && changed && needReload) {
      this.emit('changed');
      return true;
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
    content = 'import {aw, key} from "./template-functions"\n' + content;
    const fileName = `template-generated.${await this.computeFileHash(content)}.es6`;
    fs.writeFileSync(path.join(__dirname, fileName), content, 'utf8');
    this._tmplFn = require('./' + fileName);
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
