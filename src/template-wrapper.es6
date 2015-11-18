import {props} from 'bluebird';

export default async function wrap(templateFileName) {
    const tmpl = require(`./${templateFileName}`);



    return await props(tmpl);
}
