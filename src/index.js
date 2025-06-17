// import ModuleComponent from './module.vue';

export default {
	id: 'custom',
	name: 'Téléversement',
	icon: 'upload',
	routes: [
		{
			path: '',
			component: () => import('./module.vue'),

		},
	],
};
