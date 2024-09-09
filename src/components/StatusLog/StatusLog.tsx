import { Message } from "../../model/Message"
import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@material-ui/core';

const StatusLog = (props:{
        type:string
        statusMessages:Message[]
        onClear: (type:string) => void
        onClose: () => void
    }) => {

    return (
        <Dialog open={true}>
            <DialogTitle>
                Stauts: {props.type} 
            </DialogTitle>
            <DialogContent>
                { props.statusMessages.filter(m => m.type===props.type).map( (m,index) => <Typography key={index}>{m.timestamp}&nbsp;&nbsp;&nbsp;&nbsp;{m.text}</Typography>) }
            </DialogContent>
            <DialogActions>
                <Button onClick={() => props.onClear(props.type)} color='primary' variant='contained'>Clear</Button>
                <Button onClick={props.onClose} color='primary' variant='contained'>Close</Button>
            </DialogActions>
        </Dialog>
    )

}

export { StatusLog }