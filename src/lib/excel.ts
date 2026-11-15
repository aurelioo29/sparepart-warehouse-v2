import ExcelJS from "exceljs";

export type ExcelColumn = {
  header: string;
  key: string;
  width?: number;
};

export type ExcelRow = Record<
  string,
  string | number | boolean | null | undefined
>;

type ExcelResponseParams = {
  filename: string;
  sheetName: string;
  columns: ExcelColumn[];
  rows: ExcelRow[];
};

export async function excelResponse({
  filename,
  sheetName,
  columns,
  rows,
}: ExcelResponseParams) {
  const workbook = new ExcelJS.Workbook();

  workbook.creator = "Sparepart Warehouse";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(sheetName);

  worksheet.columns = columns.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width || 20,
  }));

  worksheet.getRow(1).font = {
    bold: true,
  };

  worksheet.getRow(1).alignment = {
    vertical: "middle",
    horizontal: "center",
  };

  worksheet.getRow(1).height = 22;

  worksheet.addRows(rows);

  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };

      cell.alignment = {
        vertical: "middle",
        wrapText: true,
      };

      if (rowNumber === 1) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb: "FFE5E7EB",
          },
        };
      }
    });
  });

  worksheet.views = [
    {
      state: "frozen",
      ySplit: 1,
    },
  ];

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
