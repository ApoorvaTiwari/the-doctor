'use strict';

const createObjectDefinitions = require('../util/createObjectDefinitions');
const createTransformations = require('../util/createTransformations');
const readFile = require('../util/readFile');
const {pipeP, tap, prop} = require('ramda');

// (fileNamee)
module.exports = pipeP(
    readFile, 
    tap(pipeP(
        prop('objectDefinitions'),
        createObjectDefinitions
    )),
    tap(pipeP(
        prop('transformations'),
        createTransformations
    ))
);