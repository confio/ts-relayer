import test from "ava";

import { getDefaultHomePath } from "./get-default-home-path";

const processEnvCopy = { ...process.env };

test.beforeEach(() => {
  process.env = processEnvCopy;
});

test("returns path if $HOME variable is set", (t) => {
  process.env.HOME = "/home/user";
  t.is(getDefaultHomePath(), "/home/user/.ibc-setup");

  process.env.HOME = "/home/pathEndingWithSlash/";
  t.is(getDefaultHomePath(), "/home/pathEndingWithSlash/.ibc-setup");
});

test("throws if $HOME variable is undefined", (t) => {
  delete process.env.HOME;

  t.throws(() => getDefaultHomePath(), {
    instanceOf: Error,
    message: /is not set/,
  });
});
