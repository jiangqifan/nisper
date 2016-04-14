// To run this file node should enable:
// '--harmony'
// '--harmony_destructuring'
// '--harmony_default_parameters'

var Nisp = require('nisp');
var Promise = require('yaku');
var retry = require('yaku/lib/retry');

class NisperError extends Error {
    constructor (msg, details) {
        super(msg);

        this.message = msg + '\n' + JSON.stringify(details);

        this.details = details;
    }
}

module.exports = ({
    sandbox,
    server,
    url,
    onConnection = (ws) => {
        return true;
    },
    retrySpan = 1000,
    timeout = 30 * 1000,
    retryCount = 10,
    onError = (err, nisp) => {
        console.error(err.stack, JSON.stringify(err.details, 0, 4)); // eslint-disable-line
    },
    encode = (data) => {
        return JSON.stringify(data, 0, 4);
    },
    decode = (data) => {
        return JSON.parse(data, 0, 4);
    }
}) => {

    var rpcSessions = {};

    function genId () {
        return Math.random().toString(32).slice(2);
    }

    function resend (ws, data, countDown) {
        if (countDown-- < 0) {
            onError(new NisperError('send failed', decode(data)));
            return;
        }

        try {
            ws.send(data);
        } catch (err) {
            setTimeout(resend, retrySpan, ws, data, countDown);
        }
    }

    function send (ws, msg) {
        var data = encode(msg);

        try {
            ws.send(data);
        } catch (err) {
            resend(ws, data, retryCount);
        }
    }

    var genOnMessage = (ws) => (msg) => {
        var data = decode(msg);
        var { type, id, nisp } = data;

        if (type === 'response') {
            if (rpcSessions[id])
                rpcSessions[id](data);
            return;
        }

        Nisp(nisp, sandbox).then(function (result) {
            send(ws, {
                type: 'response',
                id,
                result
            });
        }, function (err) {
            onError(err, nisp);

            send(ws, {
                type: 'response',
                id,
                error: {
                    id,
                    code: err.code,
                    message: err.message,
                    nisp: nisp
                }
            });
        });
    };

    var call = (ws, nisp, opts = {}) => {
        var id = genId();

        var callData = {
            type: 'request',
            id,
            nisp
        };

        send(ws, callData);

        return new Promise((resolve, reject) => {
            var tmr = setTimeout(() => {
                delete rpcSessions[id];
            }, opts.timeout || timeout);

            rpcSessions[id] = (data) => {
                clearTimeout(tmr);
                delete rpcSessions[id];

                if (data.error)
                    reject(new NisperError(
                        data.error.message,
                        data.error
                    ));
                else
                    resolve(data.result);
            };
        });
    };

    if (typeof WebSocket !== 'function') {
        WebSocket = require('ws');
    }

    if (server) {
        var wsServer = new WebSocket.Server({ server });

        wsServer.on('connection', (ws) => {
            if (!onConnection(wsServer, ws))
                return;

            ws.on('message', genOnMessage(ws));
        });

        return (nisp, filter = cs => cs) => {
            Promise.all(
                filter(wsServer.clients).map(ws => call(ws, nisp))
            );
        };
    } else {
        var ws;

        var connect = () => {
            try {
                ws = new WebSocket(url);
            } catch (err) {
                setTimeout(connect, retrySpan);
                return;
            }

            ws.onmessage = ({ data }) => genOnMessage(ws)(data);
            ws.onclose = () => {
                if (retrySpan !== 0) {
                    setTimeout(connect, retrySpan);
                }
            };
        };

        connect();

        return (nisp, opts) => call(ws, nisp, opts);
    }
};

module.exports.NisperError = NisperError;
