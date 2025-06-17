<template>
	<private-view title="Importer un fichier Excel" class="import-excel-module">

		<div class="step">
			<h2>1. Choisissez la collection cible</h2>
			<VSelect
				v-model="selectedCollection"
				:items="collections"
				label="Collection"
				placeholder="Sélectionnez une collection"
				@update:modelValue="fetch"
			/>
		</div>

		<div class="step">
			<h2>2. Importez un fichier Excel</h2>
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
	<h2>3. Aperçu & Mapping</h2>
	<p class="info-text">Attribuez un champ à chaque colonne, puis vérifiez les données : </p>
	<div class="table-container">
		<table class="preview-table">
			<thead>
				<tr>
					<th v-for="(col, colIndex) in previewData[0]" :key="'header-' + colIndex">
						Col {{ colIndex }}
					</th>
				</tr>
				<tr>
					<th v-for="(col, index) in previewData[0]" :key="'mapping-' + index">
						<VSelect
							v-model="mapping[index]"
							:items="contactFields"
							clearable
							:fullWidth="false"
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
			<h2>5. Importer</h2>
			<VButton v-if="selectedFile" @click="importFile" :disabled="!selectedFile || !selectedCollection" color="primary">
				Importer
			</VButton>
		</div>


	</private-view>
</template>

<script>
import * as XLSX from 'xlsx';
import { useApi, useStores } from '@directus/extensions-sdk';

export default {
	setup() {
		const api = useApi();
		return { api };
	},
	data() {
		return {
			selectedFile: null,
			previewData: [],
			mapping: {},
			contactFields: [],
			collections: [],
			selectedCollection: null,
		};
	},
	mounted() {
		this.fetchCollections();
	},
	methods: {
		async fetchCollections() {
			try {
				// const response = await this.api.get('/collections');
				// this.collections = response.data.data.map(col => col.collection);
				// this.selectedCollection = this.collections[0] || null;

				// if (this.selectedCollection) {
				// 	await this.fetchFields(this.selectedCollection);
				// }
				const { useCollectionsStore } = useStores();
				const collectionsStore = useCollectionsStore();
				this.collections = collectionsStore.visibleCollections.map(
					(col) => col.collection
				);
				this.selectedCollection = this.collections[0] || null;

				if (this.selectedCollection) {
					await this.fetchFields(this.selectedCollection);
				}

				console.log('✅ Collections récupérées :', this.collections);


			} catch (err) {
				console.error('❌ Erreur lors de la récupération des collections :', err);
			}
		},

		async fetchFields(collection) {
			try {
				const response = await this.api.get(`/fields/${collection}`);
				this.contactFields = response.data.data
					.filter(f => !f.field.startsWith('$'))
					.map(f => f.field);

				console.log(`✅ Champs récupérés pour ${collection} :`, this.contactFields);
			} catch (err) {
				console.error(`❌ Erreur lors de la récupération des champs pour ${collection} :`, err);
			}
		},

		handleFileUpload(event) {
			const file = event.target.files[0];
			if (!file) return;

			this.selectedFile = file;

			const reader = new FileReader();
			reader.onload = (e) => {
				const data = new Uint8Array(e.target.result);
				const workbook = XLSX.read(data, { type: 'array' });
				const sheet = workbook.Sheets[workbook.SheetNames[0]];
				const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

				this.previewData = rows.slice(0, 5);

				// Initialiser mapping vide
				const cols = this.previewData[0]?.length || 0;
				for (let i = 0; i < cols; i++) {
					this.mapping[i] = '';
				}
			};
			reader.readAsArrayBuffer(file);
		},

		async importFile() {
			if (!this.selectedFile || !this.selectedCollection) return;

			try {
				const reader = new FileReader();

				reader.onload = async (e) => {
					const data = new Uint8Array(e.target.result);
					const workbook = XLSX.read(data, { type: 'array' });
					const sheet = workbook.Sheets[workbook.SheetNames[0]];
					const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

					const itemsToCreate = rows.map((row) => {
						const payload = {};
						for (const [colIndex, field] of Object.entries(this.mapping)) {
							if (field) {
								payload[field] = row[colIndex];
							}
						}
						return payload;
					}).filter(item => Object.keys(item).length > 0);

					if (itemsToCreate.length === 0) {
						alert('Aucun item à importer, vérifiez le mapping.');
						return;
					}

					const createdItems = await this.api.post(`/items/${this.selectedCollection}`, itemsToCreate);

					console.log(`✅ ${itemsToCreate.length} éléments créés dans ${this.selectedCollection}`, createdItems);
					alert(`Import terminé ! ${createdItems.data.data.length} éléments créés.`);
				};

				reader.readAsArrayBuffer(this.selectedFile);

			} catch (err) {
				console.error('❌ Erreur pendant l\'import :', err);
				alert('Erreur pendant l\'import');
			}
		},

		async fetch(collection) {
			await this.fetchFields(collection);
		}
	}
};
</script>



<style scoped>
.headline {
	font-size: 1.4rem;
	font-weight: bold;
	margin-bottom: 24px;
	line-height: 1.6;
}

.step {
	margin-bottom: 32px;
}

.step h2 {
	font-size: 1.1rem;
	font-weight: 600;
	margin-bottom: 12px;
}

.info-text {
	font-size: 0.9rem;
	color: #666;
	margin-top: 4px;
}

.table-container {
	overflow-x: auto;
	border: 1px solid #ccc;
	border-radius: 6px;
}

.preview-table {
	width: 100%;
	border-collapse: collapse;
	font-size: 0.9rem;
}

.preview-table th,
.preview-table td {
	padding: 8px 12px;
	border: 1px solid #ccc;
	text-align: left;
}

.preview-table th {
	background-color: #f5f5f5;
	font-style: italic;
	color: #555;
}

.mapping-row {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 12px;
	margin-bottom: 12px;
}

.mapping-row label {
	min-width: 120px;
	font-weight: 500;
}

/* Responsive */
@media (max-width: 768px) {
	.mapping-row {
		flex-direction: column;
		align-items: flex-start;
	}
}
</style>
