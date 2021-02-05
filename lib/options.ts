import { Sandbox } from 'nisp'
import { Server } from 'http'
import * as WebSocket from '../types/ws'
import { extend } from './utils'

export type Options = {
    httpServer?: Server
    url?: string
    sandbox?: Sandbox,
    onOpen?: (ws: WebSocket, req: any) => any
    onError?: (err: any) => void
    onRequest?: (req: any, res: any) => any
    error?: (err: any) => any
    isAutoReconnect?: boolean
    binaryType?: 'arraybuffer'
    retrySpan?: number
    timeout?: number
    encode?:(data: any) => any
    decode?:(data: any) => any
    wsOptions?: WebSocket.IServerOptions
    isDebug?: boolean
}

export default (opts: Options) => {
    return extend({
        httpServer: null,
        url: null,
        sandbox: {},
        onOpen(ws) {
            return ws;
        },
        onError(err) {
            console.error(err)
        },
        onRequest(req) {
            return req;
        },
        error(err) {
            return err + ''
        },
        isAutoReconnect: true,
        binaryType: 'arraybuffer',
        retrySpan: 1000,
        timeout: 1000 * 60 * 2, // 2 minutes
        encode(data) {
            return JSON.stringify(data);
        },
        decode(data) {
            return JSON.parse(data + '');
        },
        wsOptions: {},
        isDebug: false
    }, opts) as Options;
}
