<template>
	<private-view title="Importer un fichier Excel" class="import-excel-module">

		<div class="step">
			<h2>1. Choisissez la collection cible</h2>
			<VSelect v-model="selectedCollection" :items="collections" label="Collection"
				placeholder="Sélectionnez une collection" @update:modelValue="fetch" />
		</div>

		<div class="step">
			<h2>2. Importez un fichier Excel</h2>
			<VInput type="file" @change="handleFileUpload" accept=".xlsx, .xls" label="Fichier Excel"
				placeholder="Choisissez un fichier Excel" />
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
								<VSelect v-model="mapping[index]" :items="getAvailableFields(index)" clearable
									:fullWidth="false" :inline="true" placeholder="Champ" />
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
			<VButton v-if="selectedFile" @click="importFile" :disabled="!selectedFile || !selectedCollection"
				color="primary">
				Importer
			</VButton>
		</div>

		<div v-if="successMessage" class="alert success">{{ successMessage }}</div>
		<div v-if="errorMessage" class="alert error">{{ errorMessage }}</div>


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
			successMessage: '',
			errorMessage: '',
		};
	},
	mounted() {
		this.fetchCollections();
	},
	methods: {
		getAvailableFields(currentIndex) {
			const usedFields = Object.entries(this.mapping)
				.filter(([index, value]) => value && Number(index) !== currentIndex)
				.map(([, value]) => value);

			return this.contactFields.filter(field => !usedFields.includes(field));
		},

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

			this.successMessage = '';
			this.errorMessage = '';

			const reader = new FileReader();

			reader.onload = async (e) => {
				try {
					const data = new Uint8Array(e.target.result);
					const workbook = XLSX.read(data, { type: 'array' });
					const sheet = workbook.Sheets[workbook.SheetNames[0]];
					const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

					const itemsToCreate = rows.map((row) => {
						const payload = {};
						for (const [colIndex, field] of Object.entries(this.mapping)) {
							if (field) {
								const cell = row[colIndex];
								const value = cell !== undefined && cell !== null ? cell.toString().trim() : null;

								// N'inclut que les champs ayant une valeur non vide
								if (value !== '' && value !== null) {
									payload[field] = value;
								}
							}
						}
						return payload;
					}).filter(item => Object.keys(item).length > 0);


					if (itemsToCreate.length === 0) {
						this.errorMessage = 'Aucun item à importer. Vérifiez le mapping.';
						return;
					}

					const createdItems = await this.api.post(
						`/items/${this.selectedCollection}`,
						itemsToCreate
					);

					this.successMessage = `${createdItems.data.data.length} éléments importés avec succès.`;
					console.log('✅ Import réussi', createdItems);
				} catch (err) {
					console.error('❌ Erreur pendant l\'import (onload):', err);

					if (err.response?.data?.errors?.length) {
						this.errorMessage = err.response.data.errors
							.map(e => e.message)
							.join('\n');
					} else if (err.message) {
						this.errorMessage = err.message;
					} else {
						this.errorMessage = 'Une erreur est survenue pendant l’import.';
					}
				}
			};

			reader.readAsArrayBuffer(this.selectedFile);
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

.alert {
	padding: 12px;
	border-radius: 6px;
	margin-top: 16px;
	font-weight: 500;
}

.alert.success {
	background-color: #e6f9ed;
	color: #2e7d32;
	border: 1px solid #a5d6a7;
}

.alert.error {
	background-color: #fdecea;
	color: #c62828;
	border: 1px solid #ef9a9a;
	white-space: pre-wrap;
}


/* Responsive */
@media (max-width: 768px) {
	.mapping-row {
		flex-direction: column;
		align-items: flex-start;
	}
}
</style>
