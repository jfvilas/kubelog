/*
    This interface must match the one used by Kwirth
    We need to create a Kwirth package with:
        - LogConfig
        - Message formats, that is all messages send over the web socket
            - log text
            - status text
            - metrics
*/

export interface LogConfig {
    accessKey:string;
    timestamp:boolean;
    previous:boolean;
    maxMessages:number;
    view:string;
    scope:string;
    namespace:string;
    group:string;
    set:string;
    pod:string;
    container:string;
}