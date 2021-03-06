'use strict';
const {map, find, propEq, pipeP, filter} = require('ramda');
const get = require('./get');
const createElement = require('./post')('elements');
const makePath = element => `elements/${element.key}`;
const update = require('./update');

module.exports = async (elements) => {
    const endpointElements = await pipeP(get, filter(propEq('private', true)))('elements');
    map(async element => {
        let endpointElement = find(propEq('key', element.key))(endpointElements);
        if (endpointElement) {
            await update(makePath(endpointElement), element);
            console.log(`Updated Element: ${endpointElement.key}`)
        } else {
            await createElement(element);
            console.log(`Created Element: ${element.key}`)
        }
    })(elements);
}

