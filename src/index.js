// import ModuleComponent from './module.vue';

export default {
	id: 'import_excel',
	name: 'Excelden İçeri Aktar',
	icon: 'sheets_rtl',
	routes: [
		{
			path: '',
			component: () => import('./module.vue'),

		},
	],
};
