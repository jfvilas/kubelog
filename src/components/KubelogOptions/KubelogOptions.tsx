import CardHeader from "@material-ui/core/CardHeader";
import Checkbox from "@material-ui/core/Checkbox";
import Divider from "@material-ui/core/Divider";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Grid from "@material-ui/core/Grid";
import React from "react";
import { useState } from "react";

/**
 * 
 * @param options A JSON with the curren toptions
 * @param disabled if true the options will be shown disabled
 * @returns onChange is fired sending back the new options JSON
 */
const KubelogOptions = (props: {
    options:any;
    disabled:boolean;
    onChange:(options:{}) => void;
  }) => {
  const [options, setOptions] = useState<any>(props.options);

  const handleChange = (change:any) => {
    var a = {...options,...change}
    setOptions(a);
    props.onChange(a);
  }

  return (
    <>
      <CardHeader title={'Options'}/>
      <Divider style={{marginTop:8}}/>
      <Grid container direction='column' spacing={0}>
        <Grid item >
          <FormControlLabel style={{marginLeft:8}} label="Add timestamp" control={<Checkbox checked={options.timestamp} onChange={() => handleChange({timestamp:!options.timestamp})} disabled={props.disabled}/>} />
        </Grid>
        <Grid item >
          <FormControlLabel style={{marginLeft:8}} control={<Checkbox checked={options.previous} onChange={() => handleChange({previous:!options.previous})} />} label="Show previous" disabled={props.disabled}/>
        </Grid>
        <Grid item >
          <FormControlLabel style={{marginLeft:8}} control={<Checkbox checked={options.follow} onChange={() => handleChange({follow:!options.follow})} />} label="Follow log" disabled={props.disabled}/>
        </Grid>
      </Grid>
    </>
  );
};

export { KubelogOptions }