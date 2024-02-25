import { fromBase64, fromHex } from "@cosmjs/encoding";
import {
  fromRfc3339WithNanoseconds,
  ReadonlyDateWithNanoseconds,
  tendermint34,
} from "@cosmjs/tendermint-rpc";
import test from "ava";

import {
  heightGreater,
  parseHeightAttribute,
  parsePacketsFromEvents,
  parsePacketsFromTendermintEvents,
  parseRevisionNumber,
  secondsFromDateNanos,
  timeGreater,
  timestampFromDateNanos,
} from "./utils";

test("parsePacketsFromEvents", (t) => {
  // From https://gist.github.com/webmaster128/14d273b3b462c1c653f51e3e1edb8cd5
  const events: tendermint34.Event[] = [
    {
      type: "coin_spent",
      attributes: [
        {
          key: fromBase64("c3BlbmRlcg=="),
          value: fromBase64(
            "anVubzEwMHM0NXM0aDk0cWRrY2FmbW1ycWZsdGxyZ3lxd3luNmUwNWp4Mg==",
          ),
        },
        {
          key: fromBase64("YW1vdW50"),
          value: fromBase64("MzY5NDV1anVub3g="),
        },
      ],
    },
    {
      type: "coin_received",
      attributes: [
        {
          key: fromBase64("cmVjZWl2ZXI="),
          value: fromBase64(
            "anVubzE3eHBmdmFrbTJhbWc5NjJ5bHM2Zjg0ejNrZWxsOGM1bHh0cW12cA==",
          ),
        },
        {
          key: fromBase64("YW1vdW50"),
          value: fromBase64("MzY5NDV1anVub3g="),
        },
      ],
    },
    {
      type: "transfer",
      attributes: [
        {
          key: fromBase64("cmVjaXBpZW50"),
          value: fromBase64(
            "anVubzE3eHBmdmFrbTJhbWc5NjJ5bHM2Zjg0ejNrZWxsOGM1bHh0cW12cA==",
          ),
        },
        {
          key: fromBase64("c2VuZGVy"),
          value: fromBase64(
            "anVubzEwMHM0NXM0aDk0cWRrY2FmbW1ycWZsdGxyZ3lxd3luNmUwNWp4Mg==",
          ),
        },
        {
          key: fromBase64("YW1vdW50"),
          value: fromBase64("MzY5NDV1anVub3g="),
        },
      ],
    },
    {
      type: "message",
      attributes: [
        {
          key: fromBase64("c2VuZGVy"),
          value: fromBase64(
            "anVubzEwMHM0NXM0aDk0cWRrY2FmbW1ycWZsdGxyZ3lxd3luNmUwNWp4Mg==",
          ),
        },
      ],
    },
    {
      type: "tx",
      attributes: [
        {
          key: fromBase64("ZmVl"),
          value: fromBase64("MzY5NDV1anVub3g="),
        },
      ],
    },
    {
      type: "tx",
      attributes: [
        {
          key: fromBase64("YWNjX3NlcQ=="),
          value: fromBase64(
            "anVubzEwMHM0NXM0aDk0cWRrY2FmbW1ycWZsdGxyZ3lxd3luNmUwNWp4Mi8xMjQ5Mg==",
          ),
        },
      ],
    },
    {
      type: "tx",
      attributes: [
        {
          key: fromBase64("c2lnbmF0dXJl"),
          value: fromBase64(
            "Sm42eW9WYlFPdFIxWlNHRW1lQmQ4c2VaOTl5RHlqdlJ2eU8rR1hGL1FGaDh3bzR2Tm5EckFFUzNxNmk0Sy9XTnhhdkNFRDAxVXNSK0hJYVB2djdRNkE9PQ==",
          ),
        },
      ],
    },
    {
      type: "message",
      attributes: [
        {
          key: fromBase64("YWN0aW9u"),
          value: fromBase64("L2Nvc213YXNtLndhc20udjEuTXNnRXhlY3V0ZUNvbnRyYWN0"),
        },
      ],
    },
    {
      type: "message",
      attributes: [
        {
          key: fromBase64("bW9kdWxl"),
          value: fromBase64("d2FzbQ=="),
        },
        {
          key: fromBase64("c2VuZGVy"),
          value: fromBase64(
            "anVubzEwMHM0NXM0aDk0cWRrY2FmbW1ycWZsdGxyZ3lxd3luNmUwNWp4Mg==",
          ),
        },
      ],
    },
    {
      type: "execute",
      attributes: [
        {
          key: fromBase64("X2NvbnRyYWN0X2FkZHJlc3M="),
          value: fromBase64(
            "anVubzE0eWYyNHBmY3pjc2xjaGRyMDR1NXAyeXc5enhmNmN2czN2aGU5cjlzcmY1cGc2eTJwN25xZHFuN2tu",
          ),
        },
      ],
    },
    {
      type: "execute",
      attributes: [
        {
          key: fromBase64("X2NvbnRyYWN0X2FkZHJlc3M="),
          value: fromBase64(
            "anVubzFlN3ZzNzZtYXJrc2h1czM5ZXlmZWZoMnkzdDlndWdlNHQwa3ZxeWEzcTZ2YW1nc2VqaDRxOGx4dHE5",
          ),
        },
      ],
    },
    {
      type: "wasm",
      attributes: [
        {
          key: fromBase64("X2NvbnRyYWN0X2FkZHJlc3M="),
          value: fromBase64(
            "anVubzFlN3ZzNzZtYXJrc2h1czM5ZXlmZWZoMnkzdDlndWdlNHQwa3ZxeWEzcTZ2YW1nc2VqaDRxOGx4dHE5",
          ),
        },
        {
          key: fromBase64("YWN0aW9u"),
          value: fromBase64("ZXhlY3V0ZV9nZXRfbmV4dF9yYW5kb21uZXNz"),
        },
      ],
    },
    {
      type: "send_packet",
      attributes: [
        {
          key: fromBase64("cGFja2V0X2NoYW5uZWxfb3JkZXJpbmc="),
          value: fromBase64("T1JERVJfVU5PUkRFUkVE"),
        },
        {
          key: fromBase64("cGFja2V0X2Nvbm5lY3Rpb24="),
          value: fromBase64("Y29ubmVjdGlvbi0zMQ=="),
        },
        {
          key: fromBase64("cGFja2V0X2RhdGE="),
          value: fromBase64(
            "eyJhZnRlciI6IjE2NjYxNjkwMDM0MTM1NzgyNjkiLCJzZW5kZXIiOiJqdW5vMTR5ZjI0cGZjemNzbGNoZHIwNHU1cDJ5dzl6eGY2Y3ZzM3ZoZTlyOXNyZjVwZzZ5MnA3bnFkcW43a24iLCJqb2JfaWQiOiJzaW1vbi1yb2xsLTEifQ==",
          ),
        },
        {
          key: fromBase64("cGFja2V0X2RhdGFfaGV4"),
          value: fromBase64(
            "N2IyMjYxNjY3NDY1NzIyMjNhMjIzMTM2MzYzNjMxMzYzOTMwMzAzMzM0MzEzMzM1MzczODMyMzYzOTIyMmMyMjczNjU2ZTY0NjU3MjIyM2EyMjZhNzU2ZTZmMzEzNDc5NjYzMjM0NzA2NjYzN2E2MzczNmM2MzY4NjQ3MjMwMzQ3NTM1NzAzMjc5NzczOTdhNzg2NjM2NjM3NjczMzM3NjY4NjUzOTcyMzk3MzcyNjYzNTcwNjczNjc5MzI3MDM3NmU3MTY0NzE2ZTM3NmI2ZTIyMmMyMjZhNmY2MjVmNjk2NDIyM2EyMjczNjk2ZDZmNmUyZDcyNmY2YzZjMmQzMTIyN2Q=",
          ),
        },
        {
          key: fromBase64("cGFja2V0X2RzdF9jaGFubmVs"),
          value: fromBase64("Y2hhbm5lbC0xMA=="),
        },
        {
          key: fromBase64("cGFja2V0X2RzdF9wb3J0"),
          value: fromBase64(
            "d2FzbS5ub2lzMWo3bTRmNjhscnVjZWc1eHEzZ2ZrZmRnZGd6MDJ2aHZscTJwNjd2Zjl2M2h3ZHlkYWF0M3NhanpjeTU=",
          ),
        },
        {
          key: fromBase64("cGFja2V0X3NlcXVlbmNl"),
          value: fromBase64("NzUyNA=="),
        },
        {
          key: fromBase64("cGFja2V0X3NyY19jaGFubmVs"),
          value: fromBase64("Y2hhbm5lbC00Mg=="),
        },
        {
          key: fromBase64("cGFja2V0X3NyY19wb3J0"),
          value: fromBase64(
            "d2FzbS5qdW5vMWU3dnM3Nm1hcmtzaHVzMzlleWZlZmgyeTN0OWd1Z2U0dDBrdnF5YTNxNnZhbWdzZWpoNHE4bHh0cTk=",
          ),
        },
        {
          key: fromBase64("cGFja2V0X3RpbWVvdXRfaGVpZ2h0"),
          value: fromBase64("MC0w"),
        },
        {
          key: fromBase64("cGFja2V0X3RpbWVvdXRfdGltZXN0YW1w"),
          value: fromBase64("MTY2NjE3MjYwMDQxMzU3ODI2OQ=="),
        },
      ],
    },
    {
      type: "execute",
      attributes: [
        {
          key: fromBase64("X2NvbnRyYWN0X2FkZHJlc3M="),
          value: fromBase64(
            "anVubzFlN3ZzNzZtYXJrc2h1czM5ZXlmZWZoMnkzdDlndWdlNHQwa3ZxeWEzcTZ2YW1nc2VqaDRxOGx4dHE5",
          ),
        },
      ],
    },
    {
      type: "wasm",
      attributes: [
        {
          key: fromBase64("X2NvbnRyYWN0X2FkZHJlc3M="),
          value: fromBase64(
            "anVubzFlN3ZzNzZtYXJrc2h1czM5ZXlmZWZoMnkzdDlndWdlNHQwa3ZxeWEzcTZ2YW1nc2VqaDRxOGx4dHE5",
          ),
        },
        {
          key: fromBase64("YWN0aW9u"),
          value: fromBase64("ZXhlY3V0ZV9nZXRfbmV4dF9yYW5kb21uZXNz"),
        },
      ],
    },
    {
      type: "send_packet",
      attributes: [
        {
          key: fromBase64("cGFja2V0X2NoYW5uZWxfb3JkZXJpbmc="),
          value: fromBase64("T1JERVJfVU5PUkRFUkVE"),
        },
        {
          key: fromBase64("cGFja2V0X2Nvbm5lY3Rpb24="),
          value: fromBase64("Y29ubmVjdGlvbi0zMQ=="),
        },
        {
          key: fromBase64("cGFja2V0X2RhdGE="),
          value: fromBase64(
            "eyJhZnRlciI6IjE2NjYxNjkwMDM0MTM1NzgyNjkiLCJzZW5kZXIiOiJqdW5vMTR5ZjI0cGZjemNzbGNoZHIwNHU1cDJ5dzl6eGY2Y3ZzM3ZoZTlyOXNyZjVwZzZ5MnA3bnFkcW43a24iLCJqb2JfaWQiOiJzaW1vbi1yb2xsLTIifQ==",
          ),
        },
        {
          key: fromBase64("cGFja2V0X2RhdGFfaGV4"),
          value: fromBase64(
            "N2IyMjYxNjY3NDY1NzIyMjNhMjIzMTM2MzYzNjMxMzYzOTMwMzAzMzM0MzEzMzM1MzczODMyMzYzOTIyMmMyMjczNjU2ZTY0NjU3MjIyM2EyMjZhNzU2ZTZmMzEzNDc5NjYzMjM0NzA2NjYzN2E2MzczNmM2MzY4NjQ3MjMwMzQ3NTM1NzAzMjc5NzczOTdhNzg2NjM2NjM3NjczMzM3NjY4NjUzOTcyMzk3MzcyNjYzNTcwNjczNjc5MzI3MDM3NmU3MTY0NzE2ZTM3NmI2ZTIyMmMyMjZhNmY2MjVmNjk2NDIyM2EyMjczNjk2ZDZmNmUyZDcyNmY2YzZjMmQzMjIyN2Q=",
          ),
        },
        {
          key: fromBase64("cGFja2V0X2RzdF9jaGFubmVs"),
          value: fromBase64("Y2hhbm5lbC0xMA=="),
        },
        {
          key: fromBase64("cGFja2V0X2RzdF9wb3J0"),
          value: fromBase64(
            "d2FzbS5ub2lzMWo3bTRmNjhscnVjZWc1eHEzZ2ZrZmRnZGd6MDJ2aHZscTJwNjd2Zjl2M2h3ZHlkYWF0M3NhanpjeTU=",
          ),
        },
        {
          key: fromBase64("cGFja2V0X3NlcXVlbmNl"),
          value: fromBase64("NzUyNQ=="),
        },
        {
          key: fromBase64("cGFja2V0X3NyY19jaGFubmVs"),
          value: fromBase64("Y2hhbm5lbC00Mg=="),
        },
        {
          key: fromBase64("cGFja2V0X3NyY19wb3J0"),
          value: fromBase64(
            "d2FzbS5qdW5vMWU3dnM3Nm1hcmtzaHVzMzlleWZlZmgyeTN0OWd1Z2U0dDBrdnF5YTNxNnZhbWdzZWpoNHE4bHh0cTk=",
          ),
        },
        {
          key: fromBase64("cGFja2V0X3RpbWVvdXRfaGVpZ2h0"),
          value: fromBase64("MC0w"),
        },
        {
          key: fromBase64("cGFja2V0X3RpbWVvdXRfdGltZXN0YW1w"),
          value: fromBase64("MTY2NjE3MjYwMDQxMzU3ODI2OQ=="),
        },
      ],
    },
    {
      type: "execute",
      attributes: [
        {
          key: fromBase64("X2NvbnRyYWN0X2FkZHJlc3M="),
          value: fromBase64(
            "anVubzFlN3ZzNzZtYXJrc2h1czM5ZXlmZWZoMnkzdDlndWdlNHQwa3ZxeWEzcTZ2YW1nc2VqaDRxOGx4dHE5",
          ),
        },
      ],
    },
    {
      type: "wasm",
      attributes: [
        {
          key: fromBase64("X2NvbnRyYWN0X2FkZHJlc3M="),
          value: fromBase64(
            "anVubzFlN3ZzNzZtYXJrc2h1czM5ZXlmZWZoMnkzdDlndWdlNHQwa3ZxeWEzcTZ2YW1nc2VqaDRxOGx4dHE5",
          ),
        },
        {
          key: fromBase64("YWN0aW9u"),
          value: fromBase64("ZXhlY3V0ZV9nZXRfbmV4dF9yYW5kb21uZXNz"),
        },
      ],
    },
    {
      type: "send_packet",
      attributes: [
        {
          key: fromBase64("cGFja2V0X2NoYW5uZWxfb3JkZXJpbmc="),
          value: fromBase64("T1JERVJfVU5PUkRFUkVE"),
        },
        {
          key: fromBase64("cGFja2V0X2Nvbm5lY3Rpb24="),
          value: fromBase64("Y29ubmVjdGlvbi0zMQ=="),
        },
        {
          key: fromBase64("cGFja2V0X2RhdGE="),
          value: fromBase64(
            "eyJhZnRlciI6IjE2NjYxNjkwMDM0MTM1NzgyNjkiLCJzZW5kZXIiOiJqdW5vMTR5ZjI0cGZjemNzbGNoZHIwNHU1cDJ5dzl6eGY2Y3ZzM3ZoZTlyOXNyZjVwZzZ5MnA3bnFkcW43a24iLCJqb2JfaWQiOiJzaW1vbi1yb2xsLTMifQ==",
          ),
        },
        {
          key: fromBase64("cGFja2V0X2RhdGFfaGV4"),
          value: fromBase64(
            "N2IyMjYxNjY3NDY1NzIyMjNhMjIzMTM2MzYzNjMxMzYzOTMwMzAzMzM0MzEzMzM1MzczODMyMzYzOTIyMmMyMjczNjU2ZTY0NjU3MjIyM2EyMjZhNzU2ZTZmMzEzNDc5NjYzMjM0NzA2NjYzN2E2MzczNmM2MzY4NjQ3MjMwMzQ3NTM1NzAzMjc5NzczOTdhNzg2NjM2NjM3NjczMzM3NjY4NjUzOTcyMzk3MzcyNjYzNTcwNjczNjc5MzI3MDM3NmU3MTY0NzE2ZTM3NmI2ZTIyMmMyMjZhNmY2MjVmNjk2NDIyM2EyMjczNjk2ZDZmNmUyZDcyNmY2YzZjMmQzMzIyN2Q=",
          ),
        },
        {
          key: fromBase64("cGFja2V0X2RzdF9jaGFubmVs"),
          value: fromBase64("Y2hhbm5lbC0xMA=="),
        },
        {
          key: fromBase64("cGFja2V0X2RzdF9wb3J0"),
          value: fromBase64(
            "d2FzbS5ub2lzMWo3bTRmNjhscnVjZWc1eHEzZ2ZrZmRnZGd6MDJ2aHZscTJwNjd2Zjl2M2h3ZHlkYWF0M3NhanpjeTU=",
          ),
        },
        {
          key: fromBase64("cGFja2V0X3NlcXVlbmNl"),
          value: fromBase64("NzUyNg=="),
        },
        {
          key: fromBase64("cGFja2V0X3NyY19jaGFubmVs"),
          value: fromBase64("Y2hhbm5lbC00Mg=="),
        },
        {
          key: fromBase64("cGFja2V0X3NyY19wb3J0"),
          value: fromBase64(
            "d2FzbS5qdW5vMWU3dnM3Nm1hcmtzaHVzMzlleWZlZmgyeTN0OWd1Z2U0dDBrdnF5YTNxNnZhbWdzZWpoNHE4bHh0cTk=",
          ),
        },
        {
          key: fromBase64("cGFja2V0X3RpbWVvdXRfaGVpZ2h0"),
          value: fromBase64("MC0w"),
        },
        {
          key: fromBase64("cGFja2V0X3RpbWVvdXRfdGltZXN0YW1w"),
          value: fromBase64("MTY2NjE3MjYwMDQxMzU3ODI2OQ=="),
        },
      ],
    },
  ];

  // See https://testnet.mintscan.io/juno-testnet/txs/F64B8C6A320A9C25FD1EA60B00194817B069C9CBEF19B736117D9339F33F2E51
  // for packet logs
  const packets = parsePacketsFromTendermintEvents(events);
  t.is(packets.length, 3);
  const [packet0, packet1, packet2] = packets;
  t.deepEqual(packet0, {
    sequence: BigInt(7524),
    sourcePort:
      "wasm.juno1e7vs76markshus39eyfefh2y3t9guge4t0kvqya3q6vamgsejh4q8lxtq9",
    sourceChannel: "channel-42",
    destinationPort:
      "wasm.nois1j7m4f68lruceg5xq3gfkfdgdgz02vhvlq2p67vf9v3hwdydaat3sajzcy5",
    destinationChannel: "channel-10",
    data: fromHex(
      "7b226166746572223a2231363636313639303033343133353738323639222c2273656e646572223a226a756e6f3134796632347066637a63736c636864723034753570327977397a7866366376733376686539723973726635706736793270376e7164716e376b6e222c226a6f625f6964223a2273696d6f6e2d726f6c6c2d31227d",
    ),
    timeoutHeight: {
      revisionHeight: BigInt("0"),
      revisionNumber: BigInt("0"),
    },
    timeoutTimestamp: BigInt("1666172600413578269"),
  });
  t.deepEqual(packet1, {
    sequence: BigInt(7525),
    sourcePort:
      "wasm.juno1e7vs76markshus39eyfefh2y3t9guge4t0kvqya3q6vamgsejh4q8lxtq9",
    sourceChannel: "channel-42",
    destinationPort:
      "wasm.nois1j7m4f68lruceg5xq3gfkfdgdgz02vhvlq2p67vf9v3hwdydaat3sajzcy5",
    destinationChannel: "channel-10",
    data: fromHex(
      "7b226166746572223a2231363636313639303033343133353738323639222c2273656e646572223a226a756e6f3134796632347066637a63736c636864723034753570327977397a7866366376733376686539723973726635706736793270376e7164716e376b6e222c226a6f625f6964223a2273696d6f6e2d726f6c6c2d32227d",
    ),
    timeoutHeight: {
      revisionHeight: BigInt("0"),
      revisionNumber: BigInt("0"),
    },
    timeoutTimestamp: BigInt("1666172600413578269"),
  });
  t.deepEqual(packet2, {
    sequence: BigInt(7526),
    sourcePort:
      "wasm.juno1e7vs76markshus39eyfefh2y3t9guge4t0kvqya3q6vamgsejh4q8lxtq9",
    sourceChannel: "channel-42",
    destinationPort:
      "wasm.nois1j7m4f68lruceg5xq3gfkfdgdgz02vhvlq2p67vf9v3hwdydaat3sajzcy5",
    destinationChannel: "channel-10",
    data: fromHex(
      "7b226166746572223a2231363636313639303033343133353738323639222c2273656e646572223a226a756e6f3134796632347066637a63736c636864723034753570327977397a7866366376733376686539723973726635706736793270376e7164716e376b6e222c226a6f625f6964223a2273696d6f6e2d726f6c6c2d33227d",
    ),
    timeoutHeight: {
      revisionHeight: BigInt("0"),
      revisionNumber: BigInt("0"),
    },
    timeoutTimestamp: BigInt("1666172600413578269"),
  });
});

test("parsePacketsFromTxEvents works for one packet", (t) => {
  // curl -sS "https://juno-testnet-rpc.polkachu.com/tx?hash=0x502E6F4AEA3FB185DD894D0DC14E013C45E6F52AC00A0B5224F6876A1CA107DB" | jq .result.tx_result.log -r
  // and then replace \" with \\" to get the correct JavaScript escaping
  const events = JSON.parse(
    '[{"type":"execute","attributes":[{"key":"_contract_address","value":"juno19pam0vncl2s3etn4e7rqxvpq2gkyu9wg2czfvsph6dgvp00fsrxqzjt5sr"},{"key":"_contract_address","value":"juno1e7vs76markshus39eyfefh2y3t9guge4t0kvqya3q6vamgsejh4q8lxtq9"}]},{"type":"message","attributes":[{"key":"action","value":"/cosmwasm.wasm.v1.MsgExecuteContract"},{"key":"module","value":"wasm"},{"key":"sender","value":"juno100s45s4h94qdkcafmmrqfltlrgyqwyn6e05jx2"}]},{"type":"send_packet","attributes":[{"key":"packet_channel_ordering","value":"ORDER_UNORDERED"},{"key":"packet_connection","value":"connection-31"},{"key":"packet_data","value":"{\\"after\\":\\"1666164035856871113\\",\\"sender\\":\\"juno19pam0vncl2s3etn4e7rqxvpq2gkyu9wg2czfvsph6dgvp00fsrxqzjt5sr\\",\\"job_id\\":\\"dapp-1-1666164017\\"}"},{"key":"packet_data_hex","value":"7b226166746572223a2231363636313634303335383536383731313133222c2273656e646572223a226a756e6f313970616d30766e636c32733365746e34653772717876707132676b797539776732637a66767370683664677670303066737278717a6a74357372222c226a6f625f6964223a22646170702d312d31363636313634303137227d"},{"key":"packet_dst_channel","value":"channel-10"},{"key":"packet_dst_port","value":"wasm.nois1j7m4f68lruceg5xq3gfkfdgdgz02vhvlq2p67vf9v3hwdydaat3sajzcy5"},{"key":"packet_sequence","value":"7489"},{"key":"packet_src_channel","value":"channel-42"},{"key":"packet_src_port","value":"wasm.juno1e7vs76markshus39eyfefh2y3t9guge4t0kvqya3q6vamgsejh4q8lxtq9"},{"key":"packet_timeout_height","value":"0-0"},{"key":"packet_timeout_timestamp","value":"1666167632856871113"}]},{"type":"wasm","attributes":[{"key":"_contract_address","value":"juno1e7vs76markshus39eyfefh2y3t9guge4t0kvqya3q6vamgsejh4q8lxtq9"},{"key":"action","value":"execute_get_next_randomness"}]}]',
  );
  const packets = parsePacketsFromEvents(events);
  t.is(packets.length, 1);
  t.deepEqual(packets[0], {
    sequence: BigInt(7489),
    sourcePort:
      "wasm.juno1e7vs76markshus39eyfefh2y3t9guge4t0kvqya3q6vamgsejh4q8lxtq9",
    sourceChannel: "channel-42",
    destinationPort:
      "wasm.nois1j7m4f68lruceg5xq3gfkfdgdgz02vhvlq2p67vf9v3hwdydaat3sajzcy5",
    destinationChannel: "channel-10",
    data: fromHex(
      "7b226166746572223a2231363636313634303335383536383731313133222c2273656e646572223a226a756e6f313970616d30766e636c32733365746e34653772717876707132676b797539776732637a66767370683664677670303066737278717a6a74357372222c226a6f625f6964223a22646170702d312d31363636313634303137227d",
    ),
    timeoutHeight: {
      revisionHeight: BigInt("0"),
      revisionNumber: BigInt("0"),
    },
    timeoutTimestamp: BigInt("1666167632856871113"),
  });
});

test("can parse revision numbers", (t) => {
  const musselnet = parseRevisionNumber("musselnet-4");
  t.is(musselnet, 4n);

  const numerific = parseRevisionNumber("numers-123-456");
  t.is(numerific, 456n);

  const nonums = parseRevisionNumber("hello");
  t.is(nonums, 0n);

  const nonums2 = parseRevisionNumber("hello-world");
  t.is(nonums2, 0n);
});

test("can parse strange revision numbers", (t) => {
  // all of these should give 0
  const strangers = [
    "",
    "-",
    "hello-",
    "hello-123-",
    "hello-0123",
    "hello-00123",
    "hello-1.23",
  ];
  for (const strange of strangers) {
    const rev = parseRevisionNumber(strange);
    t.is(rev, 0n, strange);
  }
});

function nanosFromDateTime(time: ReadonlyDateWithNanoseconds): bigint {
  const stamp = timestampFromDateNanos(time);
  return stamp.seconds * 1_000_000_000n + BigInt(stamp.nanos);
}

test("time-based timeouts properly", (t) => {
  const time1 = fromRfc3339WithNanoseconds("2021-03-12T12:34:56.123456789Z");
  const time2 = fromRfc3339WithNanoseconds("2021-03-12T12:36:56.543543543Z");
  const time3 = fromRfc3339WithNanoseconds("2021-03-12T12:36:13Z");

  const sec1 = secondsFromDateNanos(time1);
  const nanos1 = nanosFromDateTime(time1);
  const sec2 = secondsFromDateNanos(time2);
  const nanos2 = nanosFromDateTime(time2);

  const greaterThanNull = timeGreater(undefined, secondsFromDateNanos(time1));
  t.is(greaterThanNull, true);

  const greaterThanPast = timeGreater(nanos2, sec1);
  t.is(greaterThanPast, true);
  const greaterThanFuture = timeGreater(nanos1, sec2);
  t.is(greaterThanFuture, false);

  // nanos seconds beat seconds if present
  const greaterThanSelfWithNanos = timeGreater(nanos1, sec1);
  t.is(greaterThanSelfWithNanos, true);
  const greaterThanSelf = timeGreater(
    nanosFromDateTime(time3),
    secondsFromDateNanos(time3),
  );
  t.is(greaterThanSelf, false);
});

test("height based timeouts properly", (t) => {
  const height1a = {
    revisionHeight: BigInt(12345),
    revisionNumber: BigInt(1),
  };
  const height1b = {
    revisionHeight: BigInt(14000),
    revisionNumber: BigInt(1),
  };
  const height2a = {
    revisionHeight: BigInt(600),
    revisionNumber: BigInt(2),
  };

  t.assert(heightGreater(height1b, height1a));
  t.assert(heightGreater(height2a, height1b));
  t.assert(heightGreater(undefined, height2a));

  t.false(heightGreater(height1b, height1b));
  t.false(heightGreater(height1a, height1b));
});

test("Properly determines height-based timeouts", (t) => {
  // proper heights
  t.deepEqual(parseHeightAttribute("1-34"), {
    revisionNumber: BigInt(1),
    revisionHeight: BigInt(34),
  });
  t.deepEqual(parseHeightAttribute("17-3456"), {
    revisionNumber: BigInt(17),
    revisionHeight: BigInt(3456),
  });

  // handles revision number 0 properly (this is allowed)
  t.deepEqual(parseHeightAttribute("0-1724"), {
    revisionNumber: BigInt(0),
    revisionHeight: BigInt(1724),
  });

  // missing heights
  t.is(parseHeightAttribute(""), undefined);
  t.is(parseHeightAttribute(), undefined);

  // bad format
  t.is(parseHeightAttribute("some-random-string"), undefined);

  // zero value is defined as missing
  t.is(parseHeightAttribute("0-0"), undefined);
});
