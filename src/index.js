// import ModuleComponent from './module.vue';

export default {
	id: 'custom',
	name: 'Import Excel',
	icon: 'upload',
	routes: [
		{
			path: '',
			component: () => import('./module.vue'),

		},
	],
};
