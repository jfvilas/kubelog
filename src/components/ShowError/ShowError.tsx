import React from 'react'
import IconButton from '@material-ui/core/IconButton'
import Snackbar from '@material-ui/core/Snackbar'
import CloseIcon from '@material-ui/icons/Close'

const ShowError = (props: {
    message: string
    onClose:() => void
    }) => {

    return (
        <Snackbar 
            message={`An error has ocurred: ${props.message}`}
            open={true}
            autoHideDuration={3000}
            anchorOrigin={{ vertical:'top', horizontal:'center' }}
            action={ 
                <IconButton size="small" aria-label="close" color="inherit" onClick={props.onClose}>
                    <CloseIcon fontSize="small" />
                </IconButton>
            }>
        </Snackbar>
    )
}

export { ShowError }