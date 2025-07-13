<template>
  <private-view title="Importer un fichier Excel" class="import-excel-module">
    <div class="step">
      <h2>1️⃣ Choisissez la collection cible</h2>
      <VSelect
        v-model="selectedCollection"
        :items="collections"
        item-text="label"
        item-value="value"
        label="Collection"
        placeholder="Sélectionnez une collection"
        @update:modelValue="fetchFields"
      />
    </div>

    <div class="step">
      <h2>2️⃣ Importez un fichier Excel</h2>
      <VInput
        type="file"
        @change="handleFileUpload"
        accept=".xlsx, .xls"
        label="Fichier Excel"
        placeholder="Choisissez un fichier Excel"
      />
      <p class="info-text">Formats acceptés : .xlsx, .xls</p>
    </div>

    <div v-if="previewData.length" class="step">
      <h2>3️⃣ Aperçu & Mapping</h2>
      <p class="info-text">Associez chaque colonne au champ cible :</p>
      <div class="table-container">
        <table class="preview-table">
          <thead>
            <tr>
              <th v-for="(col, colIndex) in previewData[0]" :key="'header-' + colIndex">
                Colonne {{ colIndex + 1 }}
              </th>
            </tr>
            <tr>
              <th v-for="(col, index) in previewData[0]" :key="'mapping-' + index">
                <VSelect
                  v-model="mapping[index]"
                  :items="getAvailableFields(index)"
                  item-text="label"
                  item-value="value"
                  clearable
                  :inline="true"
                  placeholder="Champ"
                />
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, rowIndex) in previewData" :key="rowIndex">
              <td v-for="(col, colIndex) in row" :key="colIndex">{{ col }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="selectedFile" class="step">
      <h2>4️⃣ Importer</h2>
      <VButton
        @click="importFile"
        :disabled="!selectedCollection"
        color="primary"
      >
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

.table-container {
  overflow-x: auto;
  border: 1px solid var(--theme--border-normal);
  border-radius: 6px;
}

.preview-table {
  width: 100%;
  border-collapse: collapse;
}

.preview-table th,
.preview-table td {
  border: 1px solid var(--theme--border-normal);
  padding: 8px;
}

.preview-table th {
  background: var(--theme--background-subdued);
  color: var(--theme--foreground);
  font-weight: 600;
}

.preview-table td {
  background: var(--theme--background);
  color: var(--theme--foreground);
}

.alert {
  padding: 12px 46px;
  border-radius: 6px;
  margin-top: 16px;
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