/*
Copyright 2024 Julio Fernandez

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
import { kubelogApiRef, KubelogClient } from './api';
import { createApiFactory, createPlugin, createRoutableExtension } from '@backstage/core-plugin-api';
import { discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { rootRouteRef } from './routes';

export const kubelogPlugin = createPlugin({
  id: 'kubelog',  
  apis: [
    createApiFactory({
      api: kubelogApiRef,
      deps: {
        discoveryApi: discoveryApiRef,
        fetchApi: fetchApiRef,
      },
      factory({ discoveryApi, fetchApi }) {
        return new KubelogClient({ discoveryApi, fetchApi });
      },
    }),
  ],
  routes: {
    root: rootRouteRef
  }
});

export const EntityKubelogContent = kubelogPlugin.provide(
  createRoutableExtension({
    name: 'EntityKubelogContent',
    component: () =>
      import('./components/EntityKubelogContent').then(m => m.EntityKubelogContent),
    mountPoint: rootRouteRef
  })
);
