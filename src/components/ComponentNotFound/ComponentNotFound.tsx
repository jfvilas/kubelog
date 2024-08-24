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
import React from 'react';
import { Entity } from '@backstage/catalog-model';
import { CodeSnippet } from '@backstage/core-components';
import { Button, Grid, Typography } from '@material-ui/core';
import KubelogComponentNotFound from '../../assets/kubelog-component-not-found.svg';
import { ANNOTATION_KUBELOG_LOCATION } from '@jfvilas/plugin-kubelog-common';

enum ErrorType {
  NO_PODS,
  NO_CLUSTERS
}

const KUBERNETES_YAML = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: '$entityName'
  description: '$entityDescription'
  labels:
    ${ANNOTATION_KUBELOG_LOCATION}: '$entityName'
spec:
  selector:
    matchLabels:
      app: '$entityName'
  template:
    metadata:
      name: '$entityName'-pod
      labels:
        app: '$entityName'
        ${ANNOTATION_KUBELOG_LOCATION}: '$entityName'
    spec:
      containers:
        - name: '$entityName'
          image: your-OCI-image
    ...`;

const ComponentNotFound = (props: {error: ErrorType, entity:Entity}) => {
    var text:string='';
    var content:JSX.Element=<CodeSnippet
      text={KUBERNETES_YAML.replaceAll('$entityName', props.entity.metadata.name).replaceAll('$entityDescription',props.entity.metadata.description!)}
      language="yaml"
      showLineNumbers
      highlightedNumbers={[7, 17]}
      customStyle={{ background: 'inherit' }}
    />;

    var nopodsMsg=`Although this component is well tagged, and we have found some clusters configured in Backstage, we were unable to find "${props.entity.metadata.name}" running on any pod. Maybe you need to tag Kubernetes objects (deployment and pod templates).`;
    var noclustersMsg=`Although this component has a correct 'kubernetes-id' in the ${props.entity.metadata.name} Component YAML, we couldn't find any cluster. Maybe you need to tag Kubernetes objects (deployments and pod templates).`;
  
    switch(props.error) {
      case ErrorType.NO_PODS:
        text=nopodsMsg;
        break;
      case ErrorType.NO_CLUSTERS:
        text=noclustersMsg;
        break;
    }

    return (<>
        <Grid container direction="row" justifyContent="flex-start" alignItems="flex-start" spacing={2} >
            <Grid item xs={6} md={6}>
                <Grid container direction="column">
                    <Grid item xs>
                    <Typography variant="h5">{'Component not found'}</Typography>
                    </Grid>
                    <Grid item xs>
                    <Typography variant="body1">{text}</Typography>
                    </Grid>
                    <Grid item xs>
                    {content}
                    </Grid>
                </Grid>
            </Grid>
            <img src={KubelogComponentNotFound} style={{ left:'10%', marginTop:'10%', width:'30%', position:'relative' }} />
        </Grid>
        <Button variant="contained" color="primary" target="_blank" href="https://backstage.io/docs/features/kubernetes/configuration#surfacing-your-kubernetes-components-as-part-of-an-entity">
            READ MORE
        </Button>
    </>);
}

export { ComponentNotFound, ErrorType }