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
import React, { useRef, useState } from 'react';
import useAsync from 'react-use/esm/useAsync';

import { Content, Progress, WarningPanel } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { ANNOTATION_KUBELOG_LOCATION, isKubelogAvailable, PodData, ClusterValidPods } from '@jfvilas/plugin-kubelog-common';
import { MissingAnnotationEmptyState, useEntity } from '@backstage/plugin-catalog-react';

// kubelog
import { kubelogApiRef } from '../../api';
import { accessKeySerialize, StreamMessage } from '@jfvilas/kwirth-common';

// kubelog components
import { ComponentNotFound, ErrorType } from '../ComponentNotFound';
import { KubelogOptions } from '../KubelogOptions';
import { KubelogClusterList } from '../KubelogClusterList';
import { NamespaceChips } from '../NamespaceChips';
import { ShowError } from '../ShowError';
import { StatusLog } from '../StatusLog';


// Material-UI
import { Grid } from '@material-ui/core';
import { Card, CardHeader, CardContent } from '@material-ui/core';
import Divider from '@material-ui/core/Divider';
import IconButton from '@material-ui/core/IconButton';
import Typography from '@material-ui/core/Typography';

// Icons
import PlayIcon from '@material-ui/icons/PlayArrow';
import PauseIcon from '@material-ui/icons/Pause';
import StopIcon from '@material-ui/icons/Stop';
import RefreshIcon from '@material-ui/icons/Refresh';
import InfoIcon from '@material-ui/icons/Info';
import WarningIcon from '@material-ui/icons/Warning';
import ErrorIcon from '@material-ui/icons/Error';
import DownloadIcon from '@material-ui/icons/CloudDownload';
import KubelogLogo from '../../assets/kubelog-logo.svg';
import { LogConfig } from '../../model/LogConfig';
import { versionGreatOrEqualThan } from '../../tools';

const LOG_MAX_MESSAGES=1000;

export const EntityKubelogContent = () => { 
    const { entity } = useEntity();
    const kubelogApi = useApi(kubelogApiRef);
    const [resources, setResources] = useState<ClusterValidPods[]>([]);
    const [selectedClusterName, setSelectedClusterName] = useState('');
    const [namespaceList, setNamespaceList] = useState<string[]>([]);
    const [selectedNamespace, setSelectedNamespace] = useState('');
    const [showError, setShowError] = useState('');  //+++ review if this is needed once we have errorMessages
    const [started, setStarted] = useState(false);
    const [stopped, setStopped] = useState(true);
    const paused=useRef<boolean>(false);
    const [messages, setMessages] = useState<StreamMessage[]>([]);
    const [statusMessages, setStatusMessages] = useState<StreamMessage[]>([]);
    const [pendingMessages, setPendingMessages] = useState<StreamMessage[]>([]);
    const [websocket, setWebsocket] = useState<WebSocket>();
    const kubelogOptionsRef = useRef<any>({timestamp:false, previous:false, follow:true});
    const [showStatusDialog, setShowStatusDialog] = useState(false);
    const [statusType, setStatusType] = useState('');
    const preRef = useRef<HTMLPreElement|null>(null);
    const lastRef = useRef<HTMLPreElement|null>(null);
    const [ backendVersion, setBackendVersion ] = useState<string>('');
    const { loading, error } = useAsync ( async () => {
      //var data = await kubelogApi.getResources(entity);  // old endpoint (no restart supported)
      if (backendVersion==='') setBackendVersion(await kubelogApi.getVersion());
      var data = await kubelogApi.requestAccess(entity,['view','restart']);
      setResources(data);
  });

    const clickStart = (options:any) => {
      if (!paused.current) {
        setStarted(true);
        paused.current=false;
        setStopped(false);
        startLogViewer(options);
      }
      else {
        setMessages( (prev) => [ ...prev, ...pendingMessages]);
        setPendingMessages([]);
        paused.current=false;
        setStarted(true);
      }
    }

    const clickPause = () => {
      setStarted(false);
      paused.current=true;
    }

    const clickStop = () => {
      setStarted(false);
      setStopped(true);
      paused.current=false;
      stopLogViewer();
    }

    const selectCluster = (name:string|undefined) => {
        if (name) {
            setSelectedClusterName(name);
            resources.filter(cluster => cluster.name===name).map ( x => {
                var namespaces=Array.from(new Set(x.data.map ( (p:any) => p.namespace))) as string[];
                setNamespaceList(namespaces);
            })
            setSelectedNamespace('');
            setMessages([{type:'log',text:'Select namespace in order to decide which pod logs to view.'}]);
            setStatusMessages([]);
            clickStop();
        }
    }

    const selectNamespace = (ns:string) => {
        if (selectedNamespace!==ns) {
            setSelectedNamespace(ns);
            setMessages([{type:'log',text:'Press PLAY on top-right button to start viewing your log.'}]);
            setStatusMessages([]);
            clickStop();
        }
    }

    const websocketOnChunk = (event:any) => {
        var e:any={};
        try {
            e=JSON.parse(event.data);
        }
        catch (err) {
            console.log(err);
            console.log(event.data);
            return;
        }

        var msg:StreamMessage={
            namespace: e.namespace,
            podName: e.podName,
            type: e.type,
            text: e.text,
            timestamp: e.timestamp?new Date(e.timestamp):undefined
        }
        switch (msg.type) {
            case 'info':
            case 'warning':
            case 'error':
                setStatusMessages ((prev) => [...prev, msg]);
                break;
            case 'log':
                if (paused.current) {
                    setPendingMessages((prev) => [ ...prev, msg ]);
                }
                else {
                    setMessages((prev) => {
                        while (prev.length>LOG_MAX_MESSAGES-1) {
                            prev.splice(0,1);
                        }
                        if (kubelogOptionsRef.current.follow && lastRef.current) lastRef.current.scrollIntoView({ behavior: 'instant', block: 'start' });
                        return [ ...prev, msg ]
                    });
                }        
                break;
            default:
                console.log(msg);
                setStatusMessages ((prev) => [...prev, {type:'error',text:'Invalid message type received: '+msg.type}]);
                break;
        }
    }

    const websocketOnOpen = (ws:WebSocket, options:any) => {
        var cluster=resources.find(cluster => cluster.name===selectedClusterName);
        if (!cluster) {
            //+++ setShowError(msg.text);
            return;
        }
        var pod=(cluster.data as PodData[]).find(p => p.namespace===selectedNamespace);

        if (!pod) {
            //+++ setShowError(msg.text);
            return;
        }
        console.log(`WS connected`)
        var payload:LogConfig={
            accessKey:accessKeySerialize(pod.accessKey || pod.viewAccessKey),
            scope:'view',
            namespace:selectedNamespace,
            set:'',
            group:'',
            pod:pod.name,
            container:'',
            view:'pod',
            timestamp:options.timestamp,
            previous:options.previous,
            maxMessages:LOG_MAX_MESSAGES
        };
        ws.send(JSON.stringify(payload));
    }

    const startLogViewer = (options:any) => {
        var cluster=resources.find(cluster => cluster.name===selectedClusterName);
        if (!cluster) {
            //+++ show wargning
            return;
        }

        try {
            var ws = new WebSocket(cluster.url);
            ws.onopen = () => websocketOnOpen(ws, options); 
            ws.onmessage = (event) => websocketOnChunk(event);
            ws.onclose = (event) => websocketOnClose(event);
            setWebsocket(ws);
            setMessages([]);
        }
        catch (err) {
            setMessages([ { type: 'error', text: `Error opening log stream: ${err}`} ]);
        }

    }

    const websocketOnClose = (_event:any) => {
      console.log(`WS disconnected`);
      setStarted(false);
      paused.current=false;
      setStopped(true);
    }

    const stopLogViewer = () => {
      messages.push({type:'log',text:'============================================================================================================================'});
      websocket?.close();
    }

    const changeLogConfig = (options:any) => {
        kubelogOptionsRef.current=options;
        if (started) {
            //clickStop();
            clickStart(options);
        }
    }

    const handleDownload = () => {
      var content=preRef.current!.innerHTML.replaceAll('<pre>','').replaceAll('</pre>','\n');
      var filename=selectedClusterName+'-'+selectedNamespace+'-'+entity.metadata.name+'.txt';
      var mimeType:string='text/plain';
  
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  
    const actionButtons = () => {
        var hasViewKey=false;
        var cluster=resources.find(cluster => cluster.name===selectedClusterName);
        if (cluster) {
            var podData = (cluster.data as PodData[]).find(p => p.namespace===selectedNamespace);
            hasViewKey = Boolean(podData?.viewAccessKey);
        }

        return <>
            <IconButton title='Download' onClick={handleDownload} disabled={messages.length<=1}>
                <DownloadIcon />
            </IconButton>
            <IconButton onClick={() => clickStart(kubelogOptionsRef.current)} title="Play" disabled={started || !paused || selectedNamespace===''||!hasViewKey}>
                <PlayIcon />
            </IconButton>
            <IconButton onClick={clickPause} title="Pause" disabled={!((started && !paused.current) && selectedNamespace!=='')}>
                <PauseIcon />
            </IconButton>
            <IconButton onClick={clickStop} title="Stop" disabled={stopped || selectedNamespace===''}>
                <StopIcon />
            </IconButton>
        </>;
    }

    const restartPod = () => {
        var cluster=resources.find(cluster => cluster.name===selectedClusterName);
        if (cluster) {
            var pod=(cluster.data as PodData[]).find(p => p.namespace===selectedNamespace)
            var url=cluster.url+`/managecluster/restartpod/${pod?.namespace}/${pod?.name}`
            var fetchOptions= {
                method:'POST',
                headers: {
                    Authorization: 'Bearer ' + accessKeySerialize (pod?.restartAccessKey!),
                    'Content-Type':'application/json',
                }
            }
            fetch (url, fetchOptions)
        }
    }

    const statusButtons = (title:string) => {
        const show = (type:string) => {
            setShowStatusDialog(true);
            setStatusType(type);
        }

        var cluster=resources.find(cluster => cluster.name===selectedClusterName);
        var existsRestartAccessKey = cluster?.data.some(p => p.namespace===selectedNamespace && p.restartAccessKey);

        return (
            <Grid container direction='row' >
                <Grid item>
                    <Typography variant='h5'>{title}</Typography>
                </Grid>
                <Grid item style={{marginTop:'-8px'}}>
                { versionGreatOrEqualThan(backendVersion,'0.9.0') &&
                    <IconButton title="Restart pod" disabled={!existsRestartAccessKey} onClick={restartPod}>
                        <RefreshIcon/>
                    </IconButton>
                }
                <IconButton title="info" disabled={!statusMessages.some(m=>m.type==='info')} onClick={() => show('info')}>
                    <InfoIcon style={{ color:statusMessages.some(m=>m.type==='info')?'blue':'#BDBDBD'}}/>
                </IconButton>
                <IconButton title="warning" disabled={!statusMessages.some(m=>m.type==='warning')} onClick={() => show('warning')} style={{marginLeft:'-16px'}}>
                    <WarningIcon style={{ color:statusMessages.some(m=>m.type==='warning')?'gold':'#BDBDBD'}}/>
                </IconButton>
                <IconButton title="error" disabled={!statusMessages.some(m=>m.type==='error')} onClick={() => show('error')} style={{marginLeft:'-16px'}}>
                    <ErrorIcon style={{ color:statusMessages.some(m=>m.type==='error')?'red':'#BDBDBD'}}/>
                </IconButton>
                </Grid>
            </Grid>
        )
    }

    const statusClear = (type:string) => {
        console.log('clear',type);
        setStatusMessages(statusMessages.filter(m=> m.type!==type));
        setShowStatusDialog(false);
    }
    
    return (<>
        <Content>
            { showError!=='' && <ShowError message={showError} onClose={() => setShowError('')}/> }

            { loading && <Progress/> }

            {!isKubelogAvailable(entity) && !loading && error && (
                <WarningPanel title={'An error has ocurred while obtaining data from kuebernetes clusters.'} message={error?.message} />
            )}

            {!isKubelogAvailable(entity) && !loading && (
                <MissingAnnotationEmptyState readMoreUrl='https://github.com/jfvilas/kubelog' annotation={ANNOTATION_KUBELOG_LOCATION}/>
            )}

            { isKubelogAvailable(entity) && !loading && resources && resources.length===0 &&
                <ComponentNotFound error={ErrorType.NO_CLUSTERS} entity={entity}/>
            }

            { isKubelogAvailable(entity) && !loading && resources && resources.length>0 && resources.reduce((sum,cluster) => sum+cluster.data.length, 0)===0 &&
                <ComponentNotFound error={ErrorType.NO_PODS} entity={entity}/>
            }

            { isKubelogAvailable(entity) && !loading && resources && resources.length>0 && resources.reduce((sum,cluster) => sum+cluster.data.length, 0)>0 &&
                <Grid container direction="row" spacing={3}>
                    <Grid container item xs={2}>
                        <Grid container direction='column' spacing={3}>
                            <Grid item>
                                <Card>
                                    <KubelogClusterList resources={resources} selectedClusterName={selectedClusterName} onSelect={selectCluster}/>
                                </Card>
                            </Grid>
                            <Grid item>
                                <Card>
                                    <KubelogOptions options={kubelogOptionsRef.current} onChange={changeLogConfig} disabled={selectedNamespace==='' || paused.current}/>
                                </Card>
                            </Grid>
                        </Grid>
                    </Grid>

                    <Grid item xs={10} style={{marginTop:-8}}>

                        { !selectedClusterName && 
                            <img src={KubelogLogo} alt="No cluster selected" style={{ left:'40%', marginTop:'10%', width:'20%', position:'relative' }} />
                        }

                        { selectedClusterName && <>
                            <Card style={{ maxHeight:'70vh'}}>
                                <CardHeader
                                    title={statusButtons(selectedClusterName)}
                                    style={{marginTop:-4, marginBottom:4, flexShrink:0}}
                                    action={actionButtons()}
                                />
                                
                                <Typography style={{marginLeft:16, marginBottom:4}}>
                                    <NamespaceChips namespaceList={namespaceList} onSelect={selectNamespace} resources={resources} selectedClusterName={selectedClusterName} selectedNamespace={selectedNamespace}/>
                                </Typography>
                                <Divider/>
                                <CardContent style={{ overflow: 'auto' }}>
                                    <pre ref={preRef}>
                                        { messages.map (m => m.text+'\n') }
                                    </pre>
                                    <span ref={lastRef}></span>
                                </CardContent>
                            </Card>
                        </>}

                    </Grid>
                </Grid>
            }
        </Content>

        { showStatusDialog && <StatusLog type={statusType} onClose={() => setShowStatusDialog(false)} statusMessages={statusMessages} onClear={statusClear}/>}
    </>)
}
