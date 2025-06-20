// import ModuleComponent from './module.vue';

export default {
	id: 'custom',
	name: 'Excel Yükle',
	icon: 'upload',
	routes: [
		{
			path: '',
			component: () => import('./module.vue'),

		},
	],
};
