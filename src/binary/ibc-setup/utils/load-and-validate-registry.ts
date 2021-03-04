import fs from 'fs';
import os from 'os';

import Ajv, { JSONSchemaType } from 'ajv';
import yaml from 'js-yaml';

import { registryFile } from '../../constants';
import { Registry } from '../types';

export function loadAndValidateRegistry(filepath: string) {
  const registry = yaml.load(fs.readFileSync(filepath, 'utf-8'));

  const ajv = new Ajv({ allErrors: true });
  const schema: JSONSchemaType<Registry> = {
    type: 'object',
    required: ['chains', 'version'],
    additionalProperties: false,
    properties: {
      version: {
        type: 'number',
      },
      chains: {
        type: 'object',
        minProperties: 2,
        required: [],
        additionalProperties: false,
        patternProperties: {
          '^(.*)$': {
            type: 'object',
            required: ['chain_id', 'gas_price', 'hd_path', 'prefix', 'rpc'],
            additionalProperties: false,
            properties: {
              chain_id: { type: 'string' },
              prefix: { type: 'string' },
              gas_price: { type: 'string' },
              hd_path: { type: 'string' },
              rpc: { type: 'array', items: { type: 'string' }, minItems: 1 },
            },
          },
        },
      },
    },
  };
  const validate = ajv.compile(schema);
  if (!validate(registry)) {
    const errors = (validate.errors ?? []).map(
      ({ dataPath, message }) => `"${dataPath}" ${message}`
    );
    throw new Error(
      [`${registryFile} validation failed.`, ...errors].join(os.EOL)
    );
  }

  return registry;
}
