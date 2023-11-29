import { getBorderCharacters, table } from "table";

export function borderlessTable(data: (string | number)[][]) {
  return table(data, {
    border: getBorderCharacters(`void`),
    columnDefault: {
      paddingLeft: 0,
      paddingRight: 4,
    },
    drawHorizontalLine: () => {
      return false;
    },
  });
}
