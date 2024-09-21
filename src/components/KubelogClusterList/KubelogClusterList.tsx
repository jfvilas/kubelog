import Box from "@material-ui/core/Box";
import CardHeader from "@material-ui/core/CardHeader";
import Divider from "@material-ui/core/Divider";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import Typography from "@material-ui/core/Typography";
import React from "react";
import { makeStyles, Theme } from '@material-ui/core/styles';
import { ClusterValidPods } from '@jfvilas/plugin-kubelog-common';

const useStyles = makeStyles((_theme: Theme) => ({
    clusterBox: {
      display: 'flex',
      marginTop: '8px',
    },
}));
   
const KubelogClusterList = (props: {
    resources: ClusterValidPods[];
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
          {resources.map((cluster, index) => (
            <ListItem button key={index} selected={selectedClusterName === cluster.name} onClick={() => onSelect(cluster.name)} disabled={cluster.data.length===0}>
              <ListItemText
                primary={cluster.name}
                secondary={
                  <Box component={'span'} className={classes.clusterBox}>
                    <Typography component={'span'} style={{fontSize:12}}>
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

  export { KubelogClusterList }