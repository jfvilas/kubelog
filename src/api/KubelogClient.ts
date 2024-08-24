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
import { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import { KubelogApi } from './types';
import { Entity } from '@backstage/catalog-model';
import { Resources } from '@jfvilas/plugin-kubelog-common';

export interface KubelogClientOptions {
  discoveryApi: DiscoveryApi;
  fetchApi: FetchApi;
}

export class KubelogClient implements KubelogApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;

  constructor(options: KubelogClientOptions) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
  }

  /**
   * 
   * @param entity 
   * @returns an array of clusters (with their correpsonding info) and a pod list for each, where the entity has been dicovered
   */
  async getResources(entity:Entity): Promise<Resources> {
    const baseUrl = await this.discoveryApi.getBaseUrl('kubelog');
    const targetUrl = `${baseUrl}/start`;

    var payload=JSON.stringify(entity);
    const result = await this.fetchApi.fetch(targetUrl, {method:'POST', body:payload, headers:{'Content-Type':'application/json'}});
    const data = await result.json() as Resources;

    if (!result.ok) {
      throw new Error(`error`);
    }
    return data;
  }

}
