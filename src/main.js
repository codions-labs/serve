import Vue from 'vue'
import { mapGetters, mapActions } from 'vuex'
import toml from '@iarna/toml'
import cloneDeep from 'lodash/cloneDeep'

import App from './App.vue'
import router from './router'
import store from './store'
import './assets/Inter/inter.css'
import './assets/tailwind.css'

Vue.config.productionTip = false

new Vue({
    router,
    store,
    computed: {
        ...mapGetters({
            projects: 'projects/all',
        }),
    },
    methods: {
        ...mapActions({
            updateProjectStatus: 'projects/updateStatus',
            updateProjectSettings: 'projects/updateSettings',
            addMessage: 'messages/add',
        }),

        reloadProjectStatuses() {
            this.projects.forEach(project => {
                window.ipc.send('docker', {
                    id: project.id,
                    type: 'ps',
                    name: project.name,
                    path: project.path,
                })
            })
        },

        reloadProjectSettings() {
            this.projects.forEach(project => {
                window.ipc.send('filesystem', {
                    type: 'read',
                    id: project.id,
                    path: `${project.path}/serve.toml`,
                })

                window.ipc.send('git', {
                    type: 'remote',
                    id: project.id,
                    path: project.path,
                })
            })
        },
    },
    mounted() {
        window.ipc.receive('app', event => {
            if (event.type === 'focused') {
                this.reloadProjectStatuses()
                this.reloadProjectSettings()
            }
        })
        window.ipc.receive('message', message => {
            this.addMessage(message)
        })

        // Reload project status
        window.ipc.receive('docker', response => {
            if (response.type !== 'ps') {
                return
            }

            const project = this.projects.find(
                project => project.id == response.id
            )

            if (project.status !== response.value) {
                this.updateProjectStatus({ project, newStatus: response.value })
            }
        })

        window.ipc.receive('filesystem', response => {
            if (response.type !== 'read') {
                return
            }

            if (!this.projects.find(project => project.id === response.id)) {
                return
            }

            this.updateProjectSettings({
                id: response.id,
                settings: cloneDeep(toml.parse(response.value)),
            })
        })

        window.ipc.receive('git', response => {
            if (response.type !== 'remote') {
                return
            }

            const project = this.projects.find(
                project => project.id === response.id
            )

            this.updateProjectSettings({
                id: response.id,
                settings: { ...project, repository: response.content },
            })
        })

        this.reloadProjectStatuses()
        this.reloadProjectSettings()
    },
    render: h => h(App),
}).$mount('#app')
