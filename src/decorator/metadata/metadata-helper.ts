import { ModelConstructor } from '../../model/model-constructor'
import { KEY_MODEL } from '../impl/model/key-model.const'
import { Metadata } from './metadata'
import { ModelMetadata } from './model-metadata.model'
import { PropertyMetadata } from './property-metadata.model'

export function metadataForClass<T>(modelClass: ModelConstructor<T>): Metadata<T> {
  return new Metadata(modelClass)
}

export function metadataForModel<T>(modelClass: ModelConstructor<T>): ModelMetadata<T> {
  const modelMetadata = Reflect.getMetadata(KEY_MODEL, modelClass)
  if (!modelMetadata) {
    throw new Error(`make sure the @Model decorator is present on the model ${modelClass.name}`)
  }

  return modelMetadata
}

/**
 *
 * @param {ModelConstructor<T>} modelClass
 * @param {keyof T} propertyKey Either the name of the property or the name of the
 * @returns {PropertyMetadata<T>}
 */
export function metadataForProperty<T>(
  modelClass: ModelConstructor<T>,
  propertyKey: keyof T | string,
): PropertyMetadata<T> | null {
  if (modelClass) {
    const modelMetadata: ModelMetadata<T> = Reflect.getMetadata(KEY_MODEL, modelClass)

    if (modelClass && !modelMetadata) {
      throw new Error(
        `make sure the @Model decorator was added to the given modelClass ${
          Object.hasOwnProperty('name') ? (<any>modelClass).name : modelClass
        }, was not able to find model metadata`,
      )
    }

    if (modelMetadata.properties) {
      return (
        modelMetadata.properties.find(property => property.name === propertyKey || property.nameDb === propertyKey) ||
        null
      )
    }
  }
  return null
}
