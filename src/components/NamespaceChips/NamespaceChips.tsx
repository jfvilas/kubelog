import { ClusterValidPods } from "@jfvilas/plugin-kubelog-common";
import Chip from "@material-ui/core/Chip";
import React from "react";

const NamespaceChips = (props: {
    resources: ClusterValidPods[]
    selectedClusterName: string
    selectedNamespace:string
    namespaceList: string[]
    onSelect:(name:string) => void
    }) => {

    var cluster=props.resources.find(cluster => cluster.name===props.selectedClusterName);
    return <>{
        props.namespaceList.map ((ns,index) => {
            var existsAccessKey = cluster?.data.some(p => p.namespace===ns && (p.accessKey || p.viewAccessKey));
            if (existsAccessKey)
                return <Chip component={'span'} key={index} label={ns as string} onClick={() => props.onSelect(ns as string)} variant={ns===props.selectedNamespace?'default':'outlined'} size='small' color='primary' />
            else
                return <Chip component={'span'} key={index} label={ns as string} size='small' color='secondary' variant={'outlined'}/>
        })
    }</>
  }

  export { NamespaceChips }