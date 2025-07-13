<template>
	<private-view title="Importer un fichier Excel" class="import-excel-module">
		<div class="step">
			<h2>1️⃣ Choisissez la collection cible</h2>
			<h2>Trad : {{ t('step1') }}</h2>
			<VSelect v-model="selectedCollection" :items="collections" item-text="label" item-value="value"
				label="Collection" @update:modelValue="fetchFields" />
		</div>

		<div class="step">
			<h2>2️⃣ Importez un fichier Excel</h2>
			<VInput type="file" @change="handleFileUpload" accept=".xlsx, .xls" label="Fichier Excel"
				placeholder="Choisissez un fichier Excel" />
			<p class="info-text">Formats acceptés : .xlsx, .xls</p>
		</div>

		<div v-if="previewData.length" class="step">
			<h2>3️⃣ Mappage des colonnes</h2>
			<p class="info-text">Associez chaque colonne du fichier à un champ dans la base de données. Un aperçu des
				premières lignes est affiché.</p>

			<div class="mapping-table">
				<div class="mapping-row header">
					<div class="column">Colonne source</div>
					<div class="column">Exemple de données</div>
					<div class="column">Champ cible</div>
				</div>

				<div v-for="(col, index) in previewData[0]" :key="'mapping-row-' + index" class="mapping-row">
					<div class="column">Colonne {{ index + 1 }}</div>

					<div class="column example-data">
						<div v-for="row in previewData.slice(0, 3)" :key="'example-' + index + '-' + row[index]">
							{{ row[index] }}
						</div>
					</div>

					<div class="column">
						<VSelect v-model="mapping[index]" :items="getAvailableFields(index)" item-text="label"
							item-value="value" clearable placeholder="Champ" />
					</div>
				</div>
			</div>
		</div>


		<div v-if="selectedFile" class="step">
			<h2>4️⃣ Importer</h2>
			<VButton @click="importFile" :disabled="!selectedCollection" color="primary">
				Importer
			</VButton>
		</div>

		<div v-if="successMessage" class="alert success">{{ successMessage }}</div>
		<div v-if="errorMessage" class="alert error">{{ errorMessage }}</div>
	</private-view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useApi, useStores } from '@directus/extensions-sdk';
import * as XLSX from 'xlsx';
import { useI18n } from 'vue-i18n';
import { resolveLocale } from '../shared/i18n';

// Stores et API
const api = useApi();
const { useCollectionsStore } = useStores();
const collectionsStore = useCollectionsStore();

// État
const selectedCollection = ref(null);
const collections = ref([]);
const contactFields = ref([]);
const selectedFile = ref(null);
const previewData = ref([]);
const mapping = ref({});
const successMessage = ref('');
const errorMessage = ref('');
const projectLanguage = ref('en-US');

// 🔄 Récupère la langue du projet
async function fetchProjectInfo() {
  try {
    const response = await api.get('/server/info');
    projectLanguage.value = response.data.data.project.default_language || 'en-US';
    console.log('✅ Langue du projet :', projectLanguage.value);
  } catch (err) {
    console.error('❌ Impossible de récupérer la langue du projet', err);
  }
}

// Accès à la langue via le store Directus
// const { useSettingsStore } = useStores();
// const settingsStore = useSettingsStore();
// const defaultLanguage = resolveLocale(settingsStore.settings?.default_language || 'en');

// Traductions locales
const messages = {
  'en-US': {
    choose_collection: 'Choose target collection',
    import_excel: 'Upload an Excel file',
    preview_mapping: 'Preview & Mapping',
    import_button: 'Import',
    choose_file: 'Choose an Excel file',
    success: 'Import successful.',
    error: 'An error occurred during import.',
    step1: '1️⃣ Choose the target collection',
    step2: '2️⃣ Upload an Excel file',
    step3: '3️⃣ Preview & Mapping',
    step4: '4️⃣ Import',
    accepted_formats: 'Accepted formats: .xlsx, .xls',
    no_valid_items: 'No valid items to import. Check the mapping.',
    column: 'Column',
    field: 'Field',
    imported_success: 'items imported successfully.',
  },
  'fr_FR': {
    choose_collection: 'Choisissez la collection cible',
    import_excel: 'Importez un fichier Excel',
    preview_mapping: 'Aperçu & Mapping',
    import_button: 'Importer',
    choose_file: 'Choisissez un fichier Excel',
    success: 'Import réussi.',
    error: 'Une erreur est survenue pendant l’import.',
    step1: '1️⃣ Choisissez la collection cible',
    step2: '2️⃣ Importez un fichier Excel',
    step3: '3️⃣ Aperçu & Mapping',
    step4: '4️⃣ Importer',
    accepted_formats: 'Formats acceptés : .xlsx, .xls',
    no_valid_items: 'Aucun élément valide à importer. Vérifiez le mapping.',
    column: 'Colonne',
    field: 'Champ',
    imported_success: 'éléments importés avec succès.',
  },
};

const { t } = useI18n({
  locale: projectLanguage.value,
  messages,
});


// 🔄 Récupère les collections visibles
const availableCollections = computed(() =>
  collectionsStore.visibleCollections
    .filter((col) => col.schema && col.schema.name)
    .map((col) => ({
      value: col.collection,
      label: col.name,
    }))
);

// 🔄 Récupère les champs de la collection sélectionnée
async function fetchFields(collection) {
  try {
    const response = await api.get(`/fields/${collection}`);
    contactFields.value = response.data.data
      .filter((f) => !f.field.startsWith('$'))
      .map((f) => {
        let label = f.field;
        const translations = f.meta?.translations;
        if (Array.isArray(translations)) {
          const match = translations.find((t) => t.language === projectLanguage.value);
          if (match?.translation) label = match.translation;
        }
        return { value: f.field, label };
      });

    console.log(`✅ Champs récupérés pour ${collection} :`, contactFields.value);
  } catch (err) {
    console.error(`❌ Erreur lors de la récupération des champs pour ${collection} :`, err);
  }
}

// ⚙️ Filtrer les champs pour éviter les doublons dans le mapping
function getAvailableFields(currentIndex) {
  const usedFields = Object.entries(mapping.value)
    .filter(([index, value]) => value && Number(index) !== currentIndex)
    .map(([, value]) => value);

  return contactFields.value.filter(field => !usedFields.includes(field.value));
}

// 📤 Import du fichier Excel
async function importFile() {
  if (!selectedFile.value || !selectedCollection.value) return;

  successMessage.value = '';
  errorMessage.value = '';

  try {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      const items = rows.map((row) => {
        const payload = {};
        for (const [colIndex, field] of Object.entries(mapping.value)) {
          if (field) {
            const cell = row[colIndex];
            const value = cell !== undefined && cell !== null ? cell.toString().trim() : null;
            if (value !== '' && value !== null) {
              payload[field] = value;
            }
          }
        }
        return payload;
      }).filter(item => Object.keys(item).length > 0);

      if (items.length === 0) {
        errorMessage.value = 'Aucun élément valide à importer. Vérifiez le mapping.';
        return;
      }

      const result = await api.post(`/items/${selectedCollection.value}`, items);
      successMessage.value = `${result.data.data.length} éléments importés avec succès.`;
      console.log('✅ Import réussi', result);
    };
    reader.readAsArrayBuffer(selectedFile.value);
  } catch (err) {
    console.error('❌ Erreur lors de l’import :', err);
    errorMessage.value = err?.message || 'Une erreur est survenue pendant l’import.';
  }
}

// 📁 Gérer l'upload du fichier
function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  selectedFile.value = file;

  const reader = new FileReader();
  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    previewData.value = rows.slice(0, 5);

    const cols = previewData.value[0]?.length || 0;
    mapping.value = {};
    for (let i = 0; i < cols; i++) mapping.value[i] = '';
  };
  reader.readAsArrayBuffer(file);
}

// 🔁 Initialisation
onMounted(async () => {
  await fetchProjectInfo();
  collections.value = availableCollections.value;
  selectedCollection.value = collections.value[0]?.value || null;
  if (selectedCollection.value) {
    await fetchFields(selectedCollection.value);
  }
});
</script>

<style scoped>
.step {
  margin-bottom: 30px;
  padding: 0 46px;
}
.mapping-table {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
  width: 60%;
  max-width: 60%;
  padding-right: 20px;
  box-sizing: border-box;
}

.mapping-row {
  display: grid;
  grid-template-columns: 1fr 1fr 2fr; /* Adapte selon le nombre et la taille des colonnes */
  gap: 20px;
  align-items: center;
}

.mapping-row.header {
  font-weight: bold;
  border-bottom: 1px solid #ccc;
  padding-bottom: 5px;
}

.column {
  overflow-wrap: anywhere;
}

.example-data {
  font-family: monospace;
  /* background-color: #f8f8f8; */
  /* padding: 5px; */
  font-style: italic;
  font-size: 0.9em;
  border-radius: 4px;
}

/* Alertes */
.alert {
  padding: 12px 46px;
  border-radius: 6px;
  margin-top: 16px;
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
}

.alert.success {
  background: var(--theme--success-background, #e0ffe0);
  color: var(--theme--success-foreground, #067d06);
  border: 1px solid var(--theme--success-border, #9de89d);
}

.alert.error {
  background: var(--theme--danger-background, #ffe0e0);
  color: var(--theme--danger-foreground, #c00);
  border: 1px solid var(--theme--danger-border, #ef9a9a);
}
</style>
