<template>
  <private-view title="Excel Dosyası İçe Aktar" class="import-excel-module">
    <div class="step">
      <h2>1️⃣ Koleksiyon Seç</h2>
      <VSelect v-model="selectedCollection" :items="collections" item-text="label" item-value="value" label="Koleksiyon" placeholder="Bir koleksiyon seçin" @update:modelValue="fetchFields" />
    </div>

    <div class="step">
      <h2>2️⃣ Excel Dosyası Seç</h2>
      <VInput type="file" @change="handleFileUpload" accept=".xlsx,.xls" label="Excel dosyası" placeholder="Excel dosyası seçin" />
      <p class="info-text">Sadece .xlsx veya .xls formatı desteklenir.</p>
    </div>

    <div v-if="previewData.length" class="step">
      <h2>3️⃣ Alan Eşle</h2>
      <p>Her sütunu hedef alana eşleştir:</p>
      <div class="table-container">
        <table class="preview-table">
          <thead>
            <tr>
              <th v-for="(col, colIndex) in previewData[0]" :key="'header-' + colIndex">Sütun {{ colIndex + 1 }}</th>
            </tr>
            <tr>
              <th v-for="(col, index) in previewData[0]" :key="'mapping-' + index">
                <VSelect v-model="mapping[index]" :items="contactFields" clearable :inline="true" placeholder="Sütun seçin" />
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
      <h2>4️⃣ Yükle</h2>
      <VButton @click="importFile" :disabled="!selectedCollection" color="primary"> Yükle </VButton>
    </div>

    <div v-if="successMessage" class="alert success">{{ successMessage }}</div>
    <div v-if="errorMessage" class="alert error">{{ errorMessage }}</div>
  </private-view>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useApi, useStores } from "@directus/extensions-sdk";
import * as XLSX from "xlsx";

const api = useApi();
const { useSettingsStore, useCollectionsStore } = useStores();
const settingsStore = useSettingsStore();
const collectionsStore = useCollectionsStore();
// const projectLanguage = computed(() => settingsStore.settings.project_language || "en-US");

const rawCollections = computed(() => collectionsStore.visibleCollections.filter((col) => col.schema && col.schema.name));

const collections = computed(
  () =>
    rawCollections.value.map((col) => {
      // let label = col.collection;
      // const translations = col.meta?.translations;
      // if (Array.isArray(translations) && translations.length > 0) {
      //   const match = translations.find((t) => t.language === projectLanguage.value);
      //   if (match?.translation) label = match.translation;
      // }
      return {
        value: col.collection,
        label: col.name,
      };
    })
);

const selectedCollection = ref(null);
const contactFields = ref([]);
const selectedFile = ref(null);
const previewData = ref([]);
const mapping = ref({});
const successMessage = ref("");
const errorMessage = ref("");

onMounted(async () => {
  selectedCollection.value = collections.value[0]?.value || null;
  if (selectedCollection.value) {
    await fetchFields(selectedCollection.value);
  }
});

async function fetchFields(collection) {
  try {
    const response = await api.get(`/fields/${collection}`);
    contactFields.value = response.data.data.filter((f) => !f.field.startsWith("$")).map((f) => f.field);
  } catch (err) {
    console.error(`Alanlar alınamadı: ${err}`);
  }
}

function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  selectedFile.value = file;

  const reader = new FileReader();
  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    previewData.value = rows.slice(0, 5);

    const cols = previewData.value[0]?.length || 0;
    mapping.value = {};
    for (let i = 0; i < cols; i++) mapping.value[i] = "";
  };
  reader.readAsArrayBuffer(file);
}

async function importFile() {
  if (!selectedFile.value || !selectedCollection.value) return;
  successMessage.value = "";
  errorMessage.value = "";

  try {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      const items = rows
        .map((row) => {
          const obj = {};
          for (const [colIndex, field] of Object.entries(mapping.value)) {
            if (field) obj[field] = row[colIndex];
          }
          return obj;
        })
        .filter((item) => Object.keys(item).length > 0);

      if (items.length === 0) {
        errorMessage.value = "Geçerli veri bulunamadı. Eşleştirme doğru mu?";
        return;
      }

      const result = await api.post(`/items/${selectedCollection.value}`, items);
      successMessage.value = `${result.data.data.length} kayıt başarıyla yüklendi.`;
    };
    reader.readAsArrayBuffer(selectedFile.value);
  } catch (err) {
    console.error(err);
    errorMessage.value = "Yükleme sırasında bir hata oluştu.";
  }
}
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
  padding: 12px;
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
