# Import categories yourself

Open https://salmon-mule-212046.hostingersite.com/dashboard/categories and log in as admin.

## Files to use

- `category-csv-browser.js`: browser helper configured for this website.
- `RAMA Customer Categories - Ready to Import.csv`: the 124 original rows with the nine approved name substitutions applied. The original CSV is unchanged.

The substitutions are restricted to these query types and levels:

| Query type | Level | Original name | Import name |
| --- | --- | --- | --- |
| Inquiry | Subcategory | Cartridges | Cartridge |
| Inquiry | Subcategory | Product Pricing | Product Price |
| Communication | Child | Follow up through email | Email Follow Up |

## Load the helper

1. Open `category-csv-browser.js` in Notepad and copy the entire file.
2. On the Categories website, press F12 or Ctrl+Shift+I to open Developer Tools.
3. Choose Sources, then Snippets (it may be under the >> menu).
4. Create a new snippet named `category-import`, paste the helper, and press Ctrl+Enter to run it.
5. Switch to the Console tab. Loading the helper does not import data.

## Preview, import, verify

Run this in Console:

```js
await categoryCsv.preview()
```

Select `RAMA Customer Categories - Ready to Import.csv`. The preview reports rows, distinct entries, existing matches, and new entries. For this completed import, it should show 124 rows, 194 distinct entries, 194 existing matches, and zero new entries, provided the website has not changed.

To import the selected CSV, run:

```js
await categoryCsv.import()
```

Read and accept the confirmation. Keep the automatically downloaded before and finished JSON reports. If Chrome asks to allow multiple downloads, allow them for this operation. At completion, check for `completeRows: 124` and `incompleteRows: 0`. Refresh the Categories page.

Reimporting the prepared CSV reuses matching records and adds any missing parent links. It does not replace the whole category list, remove old categories, or rename existing records. Matching ignores capitalization and outer spaces within the same query type and level.

If you only want to inspect what would happen, stop after preview.

## Future CSVs

Keep these exact headers:

```csv
Type of Query,Query Category,Sub Category,Child Category
```

Each nonblank row needs all four values. Quote cells containing commas. Query types must already exist: add any missing type on the website's Query Types page before previewing. Communication, Complaint, and Inquiry already exist.

The helper does not automatically substitute names in future files. The prepared CSV contains the approved substitutions. The website may reject other similar names; inspect the finished report and decide their names before retrying.

Imports save requests individually. If an unexpected or network error interrupts an import, save the report and inspect the website before retrying; the last request may already have been saved. To download the report again:

```js
categoryCsv.downloadReport()
```

The helper uses your existing browser login token to call the application's API. It does not print the token or include it in reports. Keep the browser helper on your computer; no Hostinger deployment is needed.

The historical `salmon-incomplete-rows-2026-10-14.csv` records the initial nine blocked rows. They were subsequently resolved, as recorded in `salmon-conflict-resolution-2026-10-14.json`.
