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
import { accessKeySerialize, ANNOTATION_KUBELOG_LOCATION, isKubelogAvailable, Pod, Resources } from '@jfvilas/plugin-kubelog-common';
import { MissingAnnotationEmptyState, useEntity } from '@backstage/plugin-catalog-react';

// kubelog
import { kubelogApiRef } from '../../api';
import { Message } from '../../model/Message';
import { ComponentNotFound, ErrorType } from '../ComponentNotFound';

// Material-UI
import { makeStyles, Theme } from '@material-ui/core/styles';
import { Grid, Box } from '@material-ui/core';
import { Card, CardHeader, CardContent } from '@material-ui/core';
import { ListItem, ListItemText, List } from '@material-ui/core';
import { Chip, Checkbox, FormControlLabel, Snackbar } from '@material-ui/core';
import Divider from '@material-ui/core/Divider';
import IconButton from '@material-ui/core/IconButton';
import Typography from '@material-ui/core/Typography';

// Icons
import PlayIcon from '@material-ui/icons/PlayArrow';
import PauseIcon from '@material-ui/icons/Pause';
import StopIcon from '@material-ui/icons/Stop';
import CloseIcon from '@material-ui/icons/Close';
import DownloadIcon from '@material-ui/icons/CloudDownload';
import KueblogLogo from '../../assets/kubelog-logo.svg';


const LOG_MAX_MESSAGES=1000;
const useStyles = makeStyles((_theme: Theme) => ({
  chipBox: {
    display: 'flex',
    marginTop: '8px',
  },
}));

/**
 * 
 * @param resources An array of resources obtained form the backend
 * @param selectedClusterName the cluster the user just clicked
 * @param onSelect an event that is fired when the user selects another cluster
 * @returns onSelect is fired
 */
const KubelogClusterList = (props: {
  resources: Resources[];
  selectedClusterName: string;
  onSelect:(name:string|undefined) => void;
}) => {

  const classes=useStyles();
  const { resources, selectedClusterName, onSelect } = props;

  return (
    <>
      <CardHeader title={'Clusters'}/>
      
      <Divider style={{marginTop:8}}/>

      <List dense>
        {resources.map((cluster, idx) => (
          <ListItem button key={idx} selected={selectedClusterName === cluster.name} onClick={() => onSelect(cluster.name)}>
            <ListItemText
              primary={cluster.name}
              secondary={
                <Box className={classes.chipBox}>
                  <Typography style={{fontSize:12}}>
                    {cluster.title}
                  </Typography>
                </Box>
              }
            />
          </ListItem>
        ))}
      </List>
    </>
  );
};

/**
 * 
 * @param options A JSON with the curren toptions
 * @param diabled if true the options will be shown disabled
 * @returns onChange is fired sending back the new options JSON
 */
const KubelogOptions = (props: {
    options:any;
    disabled:boolean;
    onChange:(options:{}) => void;
  }) => {
  const [opt, setOpt] = useState<any>(props.options);

  const handleChange = (change:any) => {
    var a = {...opt,...change}
    props.onChange(a);
    setOpt(a);
  }

  return (
    <>
      <CardHeader title={'Options'}/>
      <Divider style={{marginTop:8}}/>
      <Grid container direction='column' spacing={0}>
        <Grid item >
          <FormControlLabel style={{marginLeft:8}} label="Add timestamp" control={<Checkbox checked={opt.timestamp} onChange={() => handleChange({timestamp:!opt.timestamp})} disabled={props.disabled}/>} />
        </Grid>
        <Grid item >
          <FormControlLabel style={{marginLeft:8}} control={<Checkbox checked={opt.previous} onChange={() => handleChange({previous:!opt.previous})} />} label="Show previous" disabled={props.disabled}/>
        </Grid>
      </Grid>
    </>
  );
};


export const EntityKubelogContent = () => { 
  const { entity } = useEntity();
  const kubelogApi = useApi(kubelogApiRef);
  const [resources, setResources] = useState<Resources[]>([]);
  const [selectedClusterName, setSelectedClusterName] = useState('');
  const [namespaceList, setNamespaceList] = useState<string[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState('');
  const [showError, setShowError] = useState('');
  const [started, setStarted] = useState(false);
  const [stopped, setStopped] = useState(true);
  const paused=useRef<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingMessages, setPendingMessages] = useState<Message[]>([]);
  const [websocket, setWebsocket] = useState<WebSocket>();
  const [kubelogOptions, setKubelogOptions ] = useState<any>({timestamp:false, previous:false});
  const preRef = useRef<HTMLPreElement|null>(null);

  const { loading, error } = useAsync ( async () => {
    var data = await kubelogApi.getResources(entity);
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
      clickStop();
    }
  }

  const selectNamespace = (ns:string) => {
    setSelectedNamespace(ns);
    setMessages([{type:'log',text:'Press PLAY on top-right button to start viewing your log.'}]);
    clickStop();
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

    var msg=new Message(e.text);
    if (msg.type==='error') {
      setShowError(msg.text);
      return;
    }

    if (paused.current) {
      setPendingMessages((prev) => [ ...prev, msg ]);
    }
    else {
      setMessages((prev) => {
        while (prev.length>LOG_MAX_MESSAGES-1) {
          prev.splice(0,1);
        }
        return [ ...prev, msg ]
      });
    }
  }

  const websocketOnOpen = (ws:WebSocket, options:any) => {
    var cluster=resources.find(cluster => cluster.name===selectedClusterName);
    if (!cluster) {
      //show warning
      return;
    }
    var pod=(cluster.data as Pod[]).find(p => p.namespace===selectedNamespace);
    console.log(pod);

    if (!pod) {
      // show error
      return;
    }
    console.log(`WS connected`);
    var payload={ 
      accessKey:accessKeySerialize(pod.accessKey!),
      scope:'filter',
      namespace:selectedNamespace,
      set:'',
      pod:pod.name,
      container:'',
      timestamp:options.timestamp,
      previous:options.previous,
      maxMessages:LOG_MAX_MESSAGES
    };
    console.log(JSON.stringify(payload));
    ws.send(JSON.stringify(payload));
  }

  const startLogViewer = (options:any) => {
    var cluster=resources.find(cluster => cluster.name===selectedClusterName);
    if (!cluster) {
      //show wargning
      return;
    }

    var ws = new WebSocket(cluster.url);
    ws.onopen = () => websocketOnOpen(ws, options); 
    ws.onmessage = (event) => websocketOnChunk(event);
    ws.onclose = (event) => websocketOnClose(event);
    setWebsocket(ws);
    setMessages([]);
  }

  const websocketOnClose = (_event:any) => {
    console.log(`WS disconnected`);
  }

  const stopLogViewer = () => {
    messages.push({type:'log',text:'============================================================================================================================'});
    websocket?.close();
  }

  const changeLogConfig = (options:any) => {
    setKubelogOptions(options);
    if (started) {
      clickStop();
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

    return (
        <Content>
        { showError!=='' && 
            <Snackbar 
                message={`An error has ocurred: ${showError}`}
                open={true}
                autoHideDuration={3000}
                anchorOrigin={{ vertical:'top', horizontal:'center' }}
                action={ 
                    <IconButton size="small" aria-label="close" color="inherit" onClick={() => setShowError('')}>
                    <CloseIcon fontSize="small" />
                    </IconButton>
                }>
            </Snackbar>
        }

        { loading && <Progress/> }

        {!isKubelogAvailable(entity) && !loading && error && (
            <WarningPanel title={'An error has ocurred while obtaining data from kuebernetes clusters.'} message={error?.message} />
        )}

        {!isKubelogAvailable(entity) && !loading && (
            <MissingAnnotationEmptyState readMoreUrl='https://kubelog.github.com' annotation={ANNOTATION_KUBELOG_LOCATION}/>
        )}

        { isKubelogAvailable(entity) && !loading && resources && resources.length===0 &&
            <ComponentNotFound error={ErrorType.NO_CLUSTERS} entity={entity}/>
        }

        { isKubelogAvailable(entity) && !loading && resources && resources.length>0 && resources.reduce( (sum,cluster) => sum+cluster.data.length, 0)===0 &&
            <ComponentNotFound error={ErrorType.NO_PODS} entity={entity}/>
        }

        { isKubelogAvailable(entity) && !loading && resources && resources.length>0 && resources.reduce( (sum,cluster) => sum+cluster.data.length, 0)>0 &&
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
                                <KubelogOptions options={kubelogOptions} onChange={changeLogConfig} disabled={selectedNamespace==='' || paused.current}/>
                            </Card>
                        </Grid>
                </Grid>
            </Grid>
            <Grid item xs={10} style={{marginTop:-8}}>

            { !selectedClusterName && 
                <img src={KueblogLogo} alt="No cluster selected" style={{ left:'40%', marginTop:'10%', width:'20%', position:'relative' }} />
            }

            { selectedClusterName &&
                <>
                        <Card style={{ maxHeight:'70vh'}}>
                            <CardHeader
                                title={selectedClusterName}
                                style={{marginTop:-4, marginBottom:4, flexShrink:0}}
                                action={<>
                                    <IconButton title="download" onClick={handleDownload}>
                                        <DownloadIcon />
                                    </IconButton>
                                    <IconButton onClick={() => clickStart(kubelogOptions)} aria-label="Play" disabled={started || !paused || selectedNamespace===''} title="play">
                                        <PlayIcon />
                                    </IconButton>
                                    <IconButton onClick={clickPause} aria-label="Pause" title="pause" disabled={!((started && !paused.current) && selectedNamespace!=='')}>
                                        <PauseIcon />
                                    </IconButton>
                                    <IconButton onClick={clickStop} aria-label="Pause" title="pause" disabled={stopped || selectedNamespace===''}>
                                        <StopIcon />
                                    </IconButton>
                                </>}
                            />
                            
                            <Typography style={{marginLeft:16, marginBottom:4}}>
                            {
                                namespaceList.map (ns => <Chip label={ns as string} onClick={() => selectNamespace(ns as string)} size='small' color='primary' variant={ns===selectedNamespace?'default':'outlined'}/>)
                            }
                            </Typography>
                            <Divider/>
                            <CardContent style={{ overflow: 'auto' }}>
                                <pre ref={preRef}>
                                    { messages.map (m => m.text+'\n') }
                                </pre>
                            </CardContent>
                        </Card>
                </>
            }

            </Grid>
            </Grid>
        }

        </Content>

    );
};
