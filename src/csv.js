import { writeFile, mkdir} from "node:fs/promises";

// wrap a value safely for CSV: text gets quoted, internal quotes doubled
function escapeCsvValue(value) {
    if (value === null || value === undefined) {
        return "";
    };

    const text = String(value);
    // double any embedded quote, then wrap the whole field in quoutes
    return `"${text.replace(/"/g, '""')}"`;
};

// turn an array of row-objects into CSV text (header + data rows)
function toCsv(rows, columns) {

    const header = columns.join(",");
    const body = rows

        .map(row => columns.map(col => escapeCsvValue(row[col])).join(","))
        .join("\n");
    return `${header}\n${body}`;

};


async function writeCsv(folder, name, rows, columns) {
    await mkdir(folder, { recursive: true});
    const path = `${folder}/${name}.csv`;
    await writeFile(path, toCsv(rows, columns), "utf8");
    console.log(`Wrote ${rows.length} rows to ${path}`);

};

export {writeCsv}