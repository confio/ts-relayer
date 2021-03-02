import fs, { appendFileSync } from 'fs';
import os from 'os';
import path from 'path';

import Ajv, { JSONSchemaType } from 'ajv';
import yaml from 'js-yaml';

import { appFile } from '../../constants';
import { App } from '../types';

export function loadAndValidateApp(home: string) {
  const appFilePath = path.join(home, appFile);

  if (!fs.existsSync(appFilePath)) {
    return null;
  }

  if (!fs.lstatSync(appFilePath).isFile()) {
    throw new Error(`${appendFileSync} must be a file.`);
  }

  const app = yaml.load(fs.readFileSync(path.join(home, appFile), 'utf-8'));

  const ajv = new Ajv({ allErrors: true });
  const schema: JSONSchemaType<App> = {
    type: 'object',
    additionalProperties: false,
    required: [],
    properties: {
      src: { type: 'string', nullable: true, default: null },
      dest: { type: 'string', nullable: true },
      mnemonic: { type: 'string', nullable: true },
      keyFile: { type: 'string', nullable: true },
    },
  };
  const validate = ajv.compile(schema);

  if (!validate(app)) {
    const errors = (validate.errors ?? []).map(
      ({ dataPath, message }) => `"${dataPath}" ${message}`
    );
    throw new Error([`${appFile} validation failed.`, ...errors].join(os.EOL));
  }

  return app;
}
