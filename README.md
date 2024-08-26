# Kubelog Plugin

This package is a Backstage plugin for viewing Kubernetes logs via Kwirth.

This Backstage plugin allows you to view Kubernetes logs associated to your entity directly inside your Backstage instance. It's very important to understand that for this plugin to work you need to install Kwirth on your Kubernetes cluster, that is, this plugin is just another front end for [Kwirth](https://jfvilas.github.io/kwirth).

Kwirth is a really-easy-to-use log exporting system for Kubernetes that runs in only one pod (*no database is needed*). Refer to Kwirth GitHub project for [info on installation](https://github.com/jfvilas/kwirth?tab=readme-ov-file#installation). Kwirth installation is *one command away* from you.

You can access [Kwirth project here](https://github.com/jfvilas/kwirth).

## What is this plugin for?
This Backstage plugin add Backstage a feature for browsing Kubernetes logs of entities directly inside Backstage frontend application. The plugin will be enabled for any entity taht is corectly tagged (according to Backstage Kubernetes core feature) and its correpsonding Kubernetes resources are found on any of the clusters that have been added to Backstage.

When Kubelog is correctly installed and configured you will have a chance to view Kubernetes logs on your Backstage like in this sample:

![kubelog-running](https://raw.githubusercontent.com/jfvilas/kubelog/master/images/kubelog-running.png)

The this forntend plugin includes just the visualization of logs information, but all the configuration, and specially **permission settings**, are done in the backend plugin and the app-config YAML. You can restrict access to pods, namespaces, clusters, etc... buy configuring permissions to be used by the backend plugin.

The backend plugin is only responsible for configuration and permissions, all the capabilities related with log viewing are implemente en the frontend plugin, who establishes the connections to the Kwirth instance.


## How does it work?
Let's explain this by following a user working sequence:

1. A Backstage user searchs for an entity in the Backstage.
2. In the entity page there will be a new tab named 'KUBELOG'.
3. When the user clicks on KUBELOG the frontend plugin sends a request to the backend plugin asking for logging information on several Kubernetes clusters.
4. The backend plugin sends requests to the Kwirth instances that are running on all the clusters added to Backstage. These requests ask for the following: *'Tell me all the podos that are labeled with the kubernetes-id label and do correspond with the entity I'm looking for'*. In response to this query, each cluster answers with a list of pods and the namespaces where they are running.
5. The backend plugin check the permissions of the connected user and prunes the pods list removing the ones that the user has not access to.
6. With the final pod list, the backend plugin sends several request to the Kwirth instances on the clusters asking for an API Key specific for viewing the logs of the pods.
7. With all this information, the backend builds a unique response containing all the pods the user have access to, and the API keys to access the logs.

If everyting is correctly configured and tagged, the user should see a list of clusters, and when selecting a cluster he should see a list of namespaces where the entity is running.

## Installation
1. Install corresponding Backstage backend plugin [more information here](https://www.npmjs.com/package/@jfvilas/plugin-kubelog-backend).

2. Install this Backstage frontend plugin:

    ```bash
    # From your Backstage root directory
    yarn --cwd packages/app add @jfvilas/plugin-kubelog @jfvilas/plugin-kubelog-common
    ```

3. Make sure the [Kubelog backend plugin](https://www.npmjs.com/package/@jfvilas/plugin-kubelog-backend#configure) is installed and configured.

4. Restart your Backstage instance.

## Configuration: Entity Pages

1. Add the plugin as a tab to your Entity pages:

    Firstly, import the plugin module.
    ```typescript
    // In packages/app/src/components/catalog/EntityPage.tsx
    import { EntityKubelogContent, isKubelogAvailable } from '@jfvilas/plugin-kubelog';
    ```

    Then, add a tab to your EntityPage.
    ````jsx
    // Note: Add to any other Pages as well (e.g. defaultEntityPage and webSiteEntityPage)
    const serviceEntityPage = (
      <EntityLayout>
        {/* other tabs... */}
        <EntityLayout.Route if={isKubelogAvailable} path="/kubelog" title="Kubelog">
          <EntityKubelogContent />
        </EntityLayout.Route>
      </EntityLayout>
    ```

2. Add `backstage.io/kubernetes-id` annotation to your `catalog-info.yaml` for the entities deployed to Kubernetes whose logs you want to be 'viewable' on Backstage. This is the same annotation that the Kubernetes core plugin uses, so, maybe you already have added it to your components.

    ```yaml
    metadata:
      annotations:
        backstage.io/kubernetes-id: entity-name
    ```

3. Add proper **labels** to your Kubernetes objects so Backstage can *link* forward and backward the Backstage entities with the Kubernetes objects. To do this, you need to add `labels` to your Kubernetes YAML objects (please, don't get confused: **annotations in Backstage YAML, labels in Kubernetes YAML**). This is an example of a typical Kubernetes deployment with the required label:

    ```yaml
    apiVersion: apps/v1
    kind: Deployment
    metadata:
      name: ijkl
      labels:
        backstage.io/kubernetes-id: ijkl
    spec:
      selector:
        matchLabels:
          app: 'ijkl'
      template:
        metadata:
          name: 'ijkl-pod'
          labels:
            app: ijkl
            backstage.io/kubernetes-id: ijkl
        spec:
          containers:
            - name: ijkl
              image: your-OCI-image
        ...    
    ```

    Please note that the kubernetes-id label is **on the deployment** and on the **spec pod template** also.

## Ready, set, go!
If you followed all these steps and our work is well done (not sure on this), you would see a 'Kubelog' tab in your **Entity Page**, like this one:

![kubelog-tab](https://raw.githubusercontent.com/jfvilas/kubelog/master/images/kubelog-tab.png)

When you access the tab, if you have not yet tagged your entities you would see a message like this one explaning how to do that:

![notfound](https://raw.githubusercontent.com/jfvilas/kubelog/master/images/kubelog-notfound.png)

Once you tagged your entities and your Kubernetes objects, you should see something similar to this:

![available](https://raw.githubusercontent.com/jfvilas/kubelog/master/images/kubelog-available.png)

Kubelog is ready to show logs!!

Just *select the cluster* on the cluster card and eventually set the *options* you want for the log streaming. On the new card that will appear on right, you will see all the Kubernetes namespaces available and a stream control (download, play, pause and stop). *Select a namespace*, *click PLAY* button and you will see your log **refreshing in real-time**.

![running](https://raw.githubusercontent.com/jfvilas/kubelog/master/images/kubelog-running.png)

Feel free to open issues and ask for more features.

##  Roadmap
 - Add permissions for viewing and operating in a separate way.
 - Add ability to restart pod (depending on user permissions).
 - Show all namespaces (even if the user has not access to view logs), and user would be allowed to only select permitted namespaces.