/**
 * @typedef CoreConfig
 * @property {true} master
 * @property {"full-dev" | "dev" | "prod"} dev
 * @property {number} listen
 * @property {string[]} envAddition
 * @property {{name:string,pattern:string,operation: () => {}}[]} schedule
 * @property {{"process" : [],"post-process" : [],"pre-terminate" : []}} perform
 * @property {false} cors
 * @property {{devOverride:true, type : "on" | "off" | "bunyan-dev" | "bunyan", bunyan : { name : string, baseLevel: "trace" | "debug" | "info" | "warn" | "error" | "fatal" }}} logger
 * @property {{logger:string, secret:string}} directories
 * @property {{filename: string, keys: string[], additional: {}}} secret
 * @property {{enable:false, reqKey: string, reqValue: string}} oauth
 */
