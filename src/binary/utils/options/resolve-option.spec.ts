import test from "ava";

import { InvalidOptionError } from "../../exceptions/InvalidOptionError";

import { resolveOption } from "./resolve-option";

const stringOption1 = "string option 1";
const stringOption2 = "string option 2";
const functionWithString = () => "function option";
const functionWithNumber = () => 5;
const functionWithNull = () => {
  return null;
};

test("leftmost defined option takes precedence", (t) => {
  const option1 = resolveOption("option")(undefined, undefined, stringOption1);
  t.is(option1, stringOption1);

  const option2 = resolveOption("option")(stringOption2, undefined, undefined);
  t.is(option2, stringOption2);

  const option3 = resolveOption("option")(
    stringOption2,
    stringOption1,
    stringOption1,
    stringOption1,
    undefined,
  );
  t.is(option3, stringOption2);

  const option4 = resolveOption("option", { integer: true })(10, 5, 1);
  t.is(option4, 10);

  const option5 = resolveOption("option", { integer: true })("7", "4", 1);
  t.is(option5, 7);

  const option6 = resolveOption("option", { integer: true })(
    null,
    null,
    undefined,
    null,
    4,
    "7",
  );
  t.is(option6, 4);
});

test("resolves function arguments", (t) => {
  const option1 = resolveOption("option")(
    undefined,
    functionWithString,
    stringOption1,
  );
  t.is(option1, "function option");

  const option2 = resolveOption("option")(
    functionWithString,
    undefined,
    undefined,
  );
  t.is(option2, "function option");

  const option3 = resolveOption("option")(
    undefined,
    functionWithNull,
    functionWithString,
    stringOption1,
    undefined,
  );
  t.is(option3, "function option");

  const option4 = resolveOption("option", { integer: true })(
    undefined,
    functionWithNull,
    functionWithNumber,
    stringOption1,
    undefined,
  );
  t.is(option4, 5);

  const option5 = resolveOption("option", { integer: true })(
    functionWithNumber,
    undefined,
    null,
    stringOption1,
    undefined,
  );
  t.is(option5, 5);
});

test("returns null for undefined/null options", (t) => {
  const option1 = resolveOption("option")(
    undefined,
    functionWithNull,
    null,
    undefined,
    functionWithNull,
  );
  t.is(option1, null);

  const option2 = resolveOption("option")(undefined, null, undefined);
  t.is(option2, null);

  const option3 = resolveOption("option")(
    functionWithNull,
    functionWithNull,
    functionWithNull,
  );
  t.is(option3, null);
});

test("returns null for undefined/null options (integers)", (t) => {
  const option1 = resolveOption("option", { integer: true })(
    undefined,
    functionWithNull,
    null,
    undefined,
    functionWithNull,
  );
  t.is(option1, null);

  const option2 = resolveOption("option", { integer: true })(
    undefined,
    null,
    undefined,
  );
  t.is(option2, null);

  const option3 = resolveOption("option", { integer: true })(
    functionWithNull,
    functionWithNull,
    functionWithNull,
  );
  t.is(option3, null);
});

test("throws if resolved value is not an integer", (t) => {
  const option1 = () =>
    resolveOption("option", { integer: true })(
      "Abcdefgh",
      stringOption1,
      () => null,
      undefined,
    );
  t.throws(option1, {
    instanceOf: InvalidOptionError,
    message: /must be an integer/,
  });

  const option2 = () =>
    resolveOption("option", { integer: true })(
      null,
      "seven",
      () => null,
      undefined,
    );
  t.throws(option2, {
    instanceOf: InvalidOptionError,
    message: /must be an integer/,
  });
});

test("throws if all options are undefined or null", (t) => {
  const option1 = () =>
    resolveOption("option", { required: true })(
      undefined,
      null,
      () => null,
      undefined,
    );
  t.throws(option1, { instanceOf: InvalidOptionError, message: /is required/ });

  const option2 = () =>
    resolveOption("option", { required: true, integer: true })(
      undefined,
      null,
      () => null,
      undefined,
    );
  t.throws(option2, { instanceOf: InvalidOptionError, message: /is required/ });
});
