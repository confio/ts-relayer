import fs from "fs";
import os from "os";

import Ajv, { JSONSchemaType } from "ajv";
import yaml from "js-yaml";

import { registryFile } from "../constants";
import { Registry } from "../types";

export function loadAndValidateRegistry(filepath: string): Registry {
  const registry = yaml.load(fs.readFileSync(filepath, "utf-8"));

  const ajv = new Ajv({ allErrors: true });
  const schema: JSONSchemaType<Registry> = {
    type: "object",
    required: ["chains", "version"],
    additionalProperties: false,
    properties: {
      version: {
        type: "number",
      },
      chains: {
        type: "object",
        minProperties: 2,
        required: [],
        additionalProperties: false,
        patternProperties: {
          "^(.*)$": {
            type: "object",
            required: ["chain_id", "gas_price", "prefix", "rpc"],
            additionalProperties: false,
            properties: {
              chain_id: { type: "string" },
              prefix: { type: "string" },
              gas_price: { type: "string" },
              faucet: { type: "string", nullable: true },
              hd_path: { type: "string", nullable: true },
              ics20_port: { type: "string", nullable: true },
              rpc: { type: "array", items: { type: "string" }, minItems: 1 },
              estimated_block_time: { type: "number", nullable: true },
              estimated_indexer_time: { type: "number", nullable: true },
            },
          },
        },
      },
    },
  };
  const validate = ajv.compile(schema);
  if (!validate(registry)) {
    const errors = (validate.errors ?? []).map(
      ({ dataPath, message }) => `"${dataPath}" ${message}`,
    );
    throw new Error(
      [`${registryFile} validation failed.`, ...errors].join(os.EOL),
    );
  }

  return registry;
}
