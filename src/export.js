import ExcelJS from "exceljs";

const TABLES = ["tournament", "player", "game", "standing"];

async function exportToXlsx(pool, outputPath) {

    const workbook = new ExcelJS.Workbook();

    for (const table of TABLES) {

        const result = await pool.request().query(`SELECT * FROM ${table}`);
        const rows = result.recordset;
        const sheet = workbook.addWorksheet(table);

        if (rows.length > 0) {

            const keys = Object.keys(rows[0]);
            sheet.columns = keys.map(key => ({header: key, key: key, width: 20}));
            sheet.addRows(rows);

        }

    }


    await workbook.xlsx.writeFile(outputPath);
    console.log(`Exported ${TABLES.length} tables to ${outputPath}`)
};

export { exportToXlsx };