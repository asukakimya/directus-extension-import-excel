# Directus Extension: Import Excel

📥 A Directus custom module to import `.xlsx` Excel files without headers and map them manually to a collection's fields.

## Features

- Upload `.xlsx` files via custom interface
- Manual mapping of file columns to Directus fields
- Compatible with collections like `contacts`, `users`, etc.
- Designed for back-office/admin import workflows

## Installation

1. Clone the repository into your Directus `extensions/modules` folder:

```bash
git clone https://github.com/FazCodeFR/directus-extension-import-excel.git ./extensions/modules/import-excel
```

2. Restart your Directus instance to load the new module.
3. Navigate to the Directus admin panel and find the "Import Excel" module in the modules section.
4. Configure the module settings as needed.
5. Use the module to upload `.xlsx` files and map columns to your collection fields.
## Usage
1. Go to the "Import Excel" module in the Directus admin panel.
2. Upload your `.xlsx` file.
3. Map the columns from your Excel file to the fields in your Directus collection.
4. Click "Import" to start the import process.

## Contributing
Contributions are welcome! If you find a bug or have a feature request, please open an issue on the GitHub repository.

## License
This project is licensed under the MIT License.



## Compatibility
Tested with Directus v11.8.0