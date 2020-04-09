'use strict';

const {pipe, pipeP, cond, prop, isNil, not, useWith, pathOr, head, uniq, isEmpty, forEach, values, type, __} = require('ramda');
const {keyBy} = require('lodash');
const readFile = require('../util/readFile');
const buildResourcesFromDir = require('../util/buildCommonResourcesFromDir');
const applyVersion = require('../util/applyVersion')
const { find, equals, keys, map, contains, reduce, propEq } = require('ramda');
const get = require('../util/get');
const create = require('../util/post')
const makePath = objectName => `organizations/objects/${objectName}/definitions`;
const makePath2 = (elementKey, objectName) => `organizations/elements/${elementKey}/transformations/${objectName}`;
const makePathGet = elementKey => `organizations/elements/${elementKey}/transformations`
const update = require('../util/update');
const createObjectDefinitions = require('../util/createObjectDefinitions');
const createTransformations = require('../util/createTransformations');

// Utils
const isNotNilAndEmpty = value => !isNil(value) && !isEmpty(value);
const isNilOrEmpty = value => isNil(value) || isEmpty(value);


const getObjectDefinitionsUrl = (vdrLevel, objectName, accountId, instanceId) => {
  switch (vdrLevel) {
    case 'organization::retrieve':
      return `organizations/objects/definitions`;
    case 'organization::create': 
    case 'organization::update': 
      return `organizations/objects/${objectName}/definitions`;
    case 'accounts::retrieve': 
      return `accounts/${accountId}/objects/definitions`;
    case 'instances::create': 
    case 'instances::update':
      return `accounts/objects/${objectName}/definitions`;
    case 'instances::retrieve': 
      return `instances/${instanceId}/objects/definitions`;
    case 'instances::create': 
    case 'instances::update': 
      return `instances/${instanceId}/objects/${objectName}/definitions`;
    default: 
      return null;
  }
}

const getObjectTransformationUrl = (vdrLevel, elementKey, objectName, accountId, instanceId) => {
  switch (vdrLevel) {
    case 'organization::retrieve':
      return `organizations/elements/${elementKey}/transformations`;
    case 'organization::create': 
    case 'organization::update': 
      return `organizations/elements/${elementKey}/transformations/${objectName}`;
    case 'accounts::retrieve': 
      return `accounts/${accountId}/objects/${vdrkey}/transformations`;
    case 'instances::create': 
    case 'instances::update':
      return `accounts/${accountId}/elements/${elementKey}/transformations/${objectName}`;
    case 'instances::retrieve': 
      return `instances/${instanceId}/transformations/${vdrkey}`;
    case 'instances::create': 
    case 'instances::update': 
      return `instances/${instanceId}/transformations/${objectName}`;
    default: 
      return null;
  }
}

const getObjectDefinitions = (uploadFileData, vdrName, level) => {
  let objectDefinitions = [];
  if (isNotNilAndEmpty(uploadFileData) && Array.isArray(uploadFileData)) {
    const normalizedUploadFileData = keyBy(uploadFileData, 'objectName');
    if (isNotNilAndEmpty(vdrName)) {
      const objectDefinitionsForVdrName = pathOr(
        [], [vdrName, 'objectDefinitions'], normalizedUploadFileData);
      isNotNilAndEmpty(objectDefinitionsForVdrName) &&
        objectDefinitionsForVdrName.forEach(objectDefinition => {
          objectDefinition.level === level && objectDefinitions.push(objectDefinition);
        });
    } else {
      const vdrsList = values(normalizedUploadFileData);
      isNotNilAndEmpty(vdrsList) &&
        vdrsList.forEach(vdr => {
          const vdrObjectDefinitions = vdr.objectDefinitions;
          vdrObjectDefinitions.forEach(objectDefinition => {
            objectDefinition.level === level && objectDefinitions.push(objectDefinition);
          });
        })
      }
    } else if (isNotNilAndEmpty(uploadFileData) && type(uploadFileData) === 'Object') {
      const objectDefinitionsList = uploadFileData.objectDefinitions;
      isNotNilAndEmpty(objectDefinitionsList) && 
        objectDefinitionsList.forEach(objectDefinition => {
          objectDefinition.level === level && objectDefinitions.push(objectDefinition);
        });
    }
  return objectDefinitions;
};


const getObjectTransformations = (uploadFileData, name, level) => {
  let transformations = [];
  if (isNotNilAndEmpty(uploadFileData) && Array.isArray(uploadFileData)) {
    uploadFileData.forEach(vdr => {
      if (isNotNilAndEmpty(name) && vdr.objectName === name) {
        const vdrObjectTransformationList = vdr.transformations;
        forEach(vdrObjectTransformation => {
          const vdrObjectTransformationsElementKey = head(uniq(keys(vdrObjectTransformation)));
          const vdrObjectTransformationsValue = head(uniq(values(vdrObjectTransformation)));
          if (isNotNilAndEmpty(level) && isNotNilAndEmpty(vdrObjectTransformationsValue) && vdrObjectTransformationsValue.level === level) {
            transformations.push({...vdrObjectTransformationsValue, elementKey: vdrObjectTransformationsElementKey});
          }
        }, vdrObjectTransformationList);
      } else if (isNilOrEmpty(name)) {
        const vdrObjectTransformationList = vdr.transformations;
        forEach(vdrObjectTransformation => {
          const vdrObjectTransformationsElementKey = head(uniq(keys(vdrObjectTransformation)));
          const vdrObjectTransformationsValue = head(uniq(values(vdrObjectTransformation)));
          if (isNotNilAndEmpty(level) && isNotNilAndEmpty(vdrObjectTransformationsValue) && vdrObjectTransformationsValue.level === level) {
            transformations.push({...vdrObjectTransformationsValue, elementKey: vdrObjectTransformationsElementKey});
          }
        }, vdrObjectTransformationList);
      }
    });
  } else if (isNotNilAndEmpty(uploadFileData) && typeof uploadFileData === 'object') {
    if (isNotNilAndEmpty(name) && uploadFileData.objectName === name) {
      const vdrObjectTransformationList = uploadFileData.transformations;
      forEach(vdrObjectTransformation => {
        const vdrObjectTransformationsElementKey = head(uniq(keys(vdrObjectTransformation)));
        const vdrObjectTransformationsValue = head(uniq(values(vdrObjectTransformation)));
        if (isNotNilAndEmpty(level) && isNotNilAndEmpty(vdrObjectTransformationsValue) && vdrObjectTransformationsValue.level === level) {
          transformations.push({...vdrObjectTransformationsValue, elementKey: vdrObjectTransformationsElementKey});
        }
      }, vdrObjectTransformationList);
    } else if (isNilOrEmpty(name)) {
      const vdrObjectTransformationList = uploadFileData.transformations;
      forEach(vdrObjectTransformation => {
        const vdrObjectTransformationsElementKey = head(uniq(keys(vdrObjectTransformation)));
        const vdrObjectTransformationsValue = head(uniq(values(vdrObjectTransformation)));
        if (isNotNilAndEmpty(level) && isNotNilAndEmpty(vdrObjectTransformationsValue) && vdrObjectTransformationsValue.level === level) {
          transformations.push({...vdrObjectTransformationsValue, elementKey: vdrObjectTransformationsElementKey});
        }
      }, vdrObjectTransformationList);
    }
  }
  return transformations;
}

const postObjectDefinitions = async (objectDefinitions, level) => {
  let existingObjectDefinitions = [];
  try {
    existingObjectDefinitions = await get(getObjectDefinitionsUrl(`${level}::retrieve`));
  } catch (err) {
    console.log(err);
  }
  const normalizedObjectDefinitions = isNotNilAndEmpty(objectDefinitions)
    ? keyBy(objectDefinitions, 'objectName') : null;
  const normalizedExistingObjectDefinitions = isNotNilAndEmpty(existingObjectDefinitions) &&
    Array.isArray(existingObjectDefinitions) ? keyBy(existingObjectDefinitions, 'objectName')
    : (isNotNilAndEmpty(existingObjectDefinitions) && type(existingObjectDefinitions) === 'Object'
    ? existingObjectDefinitions : null);
  
  const objectNameListFromUploadFile = isNotNilAndEmpty(normalizedObjectDefinitions)
    ? keys(normalizedObjectDefinitions) : null;
    console.log(objectNameListFromUploadFile)
  const objectNameListFromExistingObjectDefinitions = 
    isNotNilAndEmpty(normalizedExistingObjectDefinitions) 
    ? keys(normalizedExistingObjectDefinitions) : null;
  
  forEach(async (objectName) => {
    const isExistingObjectDefinition = contains(objectName, objectNameListFromExistingObjectDefinitions);
    if (isExistingObjectDefinition) {
      await update(
        getObjectDefinitionsUrl(`${level}::update`, objectName),
        normalizedObjectDefinitions[objectName]
      );
      console.log(`Updated Object: ${objectName}`, objectName)
    } else {
      await create(
        getObjectDefinitionsUrl(`${level}::create`, objectName),
        normalizedObjectDefinitions[objectName]
      );
      console.log(`Created Object: ${objectName}`)
    }
  }, objectNameListFromUploadFile)  
  return objectDefinitions;
}


const postTransformations = async (transformations, level) => {
  forEach(async transformation => {
    const elementKey = transformation.elementKey;
    let existingObjectTransformation = [];
    try {
      existingObjectTransformation = await get(getObjectTransformationUrl(`${level}::retrieve`, elementKey));
    } catch (err) {/* ignore */}
    const objectNameListFromExistingObjectTransformation = uniq(keys(existingObjectTransformation));
    const isExistingTransformation = contains(transformation.objectName, objectNameListFromExistingObjectTransformation);
    if (isExistingTransformation) {
      await update(getObjectTransformationUrl(`${level}::update`, elementKey, transformation.objectName), transformation);
      console.log(`Updated Transformation: ${transformation.objectName} - ${elementKey}`)
    } else {
      await create(getObjectTransformationUrl(`${level}::create`, elementKey, transformation.objectName), transformation);
      console.log(`Created Transformation: ${transformation.objectName} - ${elementKey}`)
    }
  }, transformations);
  return transformations;
}

const cleanTransformation = (transformation, objectDefinitions) => {
    if (transformation && transformation.fields) {
      transformation.fields = reduce((fields, field) => {
            const definitionField = find(propEq("path", field.path))(objectDefinition.fields)
            if (definitionField) {
                field.type = definitionField ? definitionField.type : field.type
                return append(field, fields)
            } else {
                return fields 
            }
        })([], transformation.fields)
    }
    return transformation
}

const handleNameOption = options =>
  typeof pathOr(null, ['name'], options) === 'function' 
    ? null : pathOr(null, ['name'], options);

const getOptionsData = options => ({
  name: handleNameOption(options),
  level: pathOr(null, ['level'], options),
  accountId: pathOr(null, ['account'], options),
  instanceId: pathOr(null, ['instance'], options),
});

const postData = async (uploadFileData, options) => {
  const {name, level, accountId, instanceId} = getOptionsData(options);
  
  if (isNilOrEmpty(uploadFileData)) {
    console.log(`No such file or directory found in the path`);
    return;
  }

  if (isNilOrEmpty(level)) {
    await createObjectDefinitions(uploadFileData)
    await createTransformations(uploadFileData)
    return;
  }

  if (level === 'organization') {
    await postObjectDefinitions(getObjectDefinitions(uploadFileData, name, level), level);
    await postTransformations(getObjectTransformations(uploadFileData, name, level), level);
    return;
  } else if (level === 'account') {
    if (isNilOrEmpty(accountId)) {
      console.log(`The doctor could not find any account id, add an account id after -a to upload`);
      return;
    }
    await postObjectDefinitions(getObjectDefinitions(uploadFileData, name, level), level);
    await postTransformations(getObjectTransformations(uploadFileData, name, level));
    return;
  } else if (level === 'instance') {
    if (isNilOrEmpty(instanceId)) {
      console.log(`The doctor could not find any instance id, add an instance id after -a to upload`);
      return;
    }
    await postObjectDefinitions(getObjectDefinitions(uploadFileData, name, level), level);
    await postTransformations(getObjectTransformations(uploadFileData, name, level));
    return;
  }
}

//(fileName)
module.exports = options => {
  cond([
    [ 
      pipe(prop('file'), isNil, not),
      pipeP(useWith(readFile, [prop('file')]), applyVersion(__, options), uploadFileData => postData(uploadFileData, options))
    ],
    [
      pipe(prop('dir'), isNil, not),
      pipeP(useWith(buildResourcesFromDir, [prop('dir')]), applyVersion(__, options), uploadFileData => postData(uploadFileData, options))
    ]
  ])(options)
}
