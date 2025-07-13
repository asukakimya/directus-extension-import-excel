import multer from 'multer';
import * as XLSX from 'xlsx';
import { createError } from '@directus/errors';

export default function registerEndpoint(router, { services, getSchema }) {
  const { ItemsService } = services;

  const storage = multer.memoryStorage();
  const upload = multer({ storage });

  router.post('/', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        throw createError('BAD_REQUEST', 'Fichier Excel manquant.', 400);
      }
      if (!req.body.collection) {
        throw createError('BAD_REQUEST', 'Collection cible manquante.', 400);
      }
      if (!req.body.mapping) {
        throw createError('BAD_REQUEST', 'Mapping manquant.', 400);
      }

      const schema = await getSchema();
      const collectionName = req.body.collection;
      const mapping = JSON.parse(req.body.mapping);

      const itemsService = new ItemsService(collectionName, {
        schema,
        accountability: req.accountability,
      });

      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      if (rows.length === 0) {
        throw createError('BAD_REQUEST', 'Fichier Excel vide.', 400);
      }

      const items = rows.map(row => {
        const item = {};
        for (const [colIndex, fieldName] of Object.entries(mapping)) {
          if (fieldName) {
            const value = row[colIndex];
            if (value !== undefined && value !== null && value !== '') {
              item[fieldName] = value;
            }
          }
        }
        return item;
      }).filter(item => Object.keys(item).length > 0);

      if (items.length === 0) {
        throw createError('BAD_REQUEST', 'Aucun élément valide à importer. Vérifiez le mapping.', 400);
      }

      const createdItems = await itemsService.createMany(items);

      res.json({
        message: `${createdItems.length} éléments importés avec succès.`,
        data: createdItems,
      });
    } catch (error) {
      console.error('Erreur import Excel :', error);
      if (error.statusCode) {
        res.status(error.statusCode).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Erreur interne lors de l’import Excel.' });
      }
    }
  });
}
