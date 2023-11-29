import fs from "fs";

import test from "ava";
import sinon from "sinon";

import { Options, run } from "./keys-generate";

const fsWriteFileSync = sinon.stub(fs, "writeFileSync");
const consoleLog = sinon.stub(console, "log");

test.beforeEach(() => {
  sinon.reset();

  fsWriteFileSync.returns();
});

test("generates mnemonic to stdout", (t) => {
  const options: Options = {
    keyFile: null,
  };

  run(options);

  t.assert(consoleLog.calledOnce);
  t.assert(consoleLog.calledWithMatch(/[\\w ]+/));
  t.assert(fsWriteFileSync.notCalled);
});

test("generates mnemonic to file", (t) => {
  const options: Options = {
    keyFile: "/home/user/mnemonic.txt",
  };

  run(options);

  const [path, contents] = fsWriteFileSync.getCall(0).args;
  t.is(path, options.keyFile ?? "");
  t.regex(contents as string, /[\\w ]+/);

  t.assert(consoleLog.calledOnce);
  t.assert(consoleLog.calledWithMatch(/Saved mnemonic to/));
});
