

const NOTIFICATION_KEYPREFIX = "kapp_",
      PROC_TYPE = "FRONTEND",
      WORK_TYPE = "dowork"
      

const redis_telemetry = require('./lib/redis_telemetry')

var metrics = {
    requestscomplete: 0,
    requestsstarted: 0,
    lastreqtime: 0
}

const [ redis ] = redis_telemetry.init_redis(process.env.REDIS_URL)
const [ redis_b, redis_db ] = redis_telemetry.init_redis(process.env.REDIS_URL)

redis_telemetry.init_telemetry(redis, PROC_TYPE, metrics).then (([proc_key, proc_id]) => {
    console.log (`Telemetry started for ${proc_key} (id=${proc_id})`)

    // -----------------------------------------------------------------------------------
    // ------------------------------------------- PUSH NOTIFICATIONS TO CONNECTED CLIENTS

    let node_connections = new Map(), // Map of all WebSocket connected clients
        sendclients = (type, msg) => { // Send keyspace updates to WebSocket clients
        for (let [key, value] of node_connections) {
        value.ws.send(JSON.stringify(Object.assign({type: type}, msg)))
        }
    }

    let  work_requests_in_queue = new Map(), // Map of all REST 'WORK' requests (value=response)
        work_requests_start_time = new Map()


    // Redis Notifications (https://redis.io/topics/notifications)
    // K = Keyspace notifications allows node_connections to listen for all events for a key
    // h = capture 'hash' key events, g = Generic commands (like DEL),  x = capture expiry
    if (!process.env.REDIS_URL) {
        // cannot issue CONFIG against Azure Redis, need to set keyspace in 'advanced settings' in portal
        redis.config("SET", "notify-keyspace-events", "Khxg");
    }
    
    
    const notify_keyspace = `__keyspace@${redis_db}__:${NOTIFICATION_KEYPREFIX}*:*`,
          notify_channel = `${proc_key}:${WORK_TYPE}`

    redis_b.psubscribe(notify_keyspace, notify_channel,  (err, count) => {
        if (err) {
        console.log (`redis_b error ${JSON.stringify(err)}`);
        exit (1);
        } else
        console.log (`redis_b (${count}) now subscribed to ${notify_keyspace} & ${notify_channel}`);
    })

    redis_b.on('pmessage', function (pattern, channel, message) {
        //console.log (`redis_b: message "${channel}":  "${message}"`);

        if (channel == notify_channel) {

        let {key, status} = JSON.parse(message),
            response = work_requests_in_queue.get(key)
        metrics.requestscomplete++
        metrics.lastreqtime = (Date.now() - work_requests_start_time.get(key))/1000
        response.end (`complete ${status}`)
        } else {
        let rediskey = channel.substr(channel.indexOf ('__:')+3),
            [key, _id] = rediskey.split(':');
        if (message === "hset") {
            redis.hgetall (rediskey).then((data) => {
            //notify_polls (_id, {'key': key, 'op': 'update', 'id': _id, 'data': data}, false);
            sendclients('UPDATEKEY', {key: key, 'id': _id, 'data': data})
            })
        } else if (message === "expired" || message === "del") {
            sendclients('REMOVEKEY', {key: key, 'id': _id})
            //notify_polls (_id, {'key': key, 'op': 'remove', 'id': _id,}, true);
        }
        }
    });


    // -----------------------------------------------------------------------------------
    // ----------------------------------------------------------------- HTTP & WS Servers
    const WebSocket = require('ws'),
            http = require('http'),
            serveStatic = require('serve-static'),
            useragent = require('express-useragent'),
            servestatic = serveStatic('dist', {'index': ['index.html']}),
            port = process.env.PORT || 9090,
            httpServer = http.createServer( (request, response) => 
    {
        console.log (`request (static) : ${request.url}`)

        // server Static website
        servestatic(request, response, () => {
        console.log (`request (incoming) : ${request && request.url}`)
        if (request) {
            var fullpath = request.url.substr(1),
                toppath = fullpath.split('/')[0];

            // REST server
            if (toppath == WORK_TYPE) {
                console.log('doing work')
                metrics.requestsstarted++
                work_requests_in_queue.set (metrics.requestsstarted, response)
                work_requests_start_time.set (metrics.requestsstarted, Date.now())
                redis.lpush (WORK_TYPE, JSON.stringify({node: proc_key, key: metrics.requestsstarted, notify_channel: notify_channel})).then((succ) => {
                    console.log (`LPUSH'd work : ${succ}`)
                })
            } else {
                response.writeHead(404) ;
                response.end();
            }
        }
        })
    }).listen(port);
    console.log (`listening to port ${port}`)

    // Web Socket Server
    const wss = new WebSocket.Server({
        perMessageDeflate: false,
        server : httpServer
    });

    wss.on('connection', function connection(ws) {

        let {rurl, headers} = ws.upgradeReq,
            ua = useragent.parse(headers['user-agent']),
            client_key = `${NOTIFICATION_KEYPREFIX}USERS:${proc_id}-${node_connections.size}`
        console.log (`connected ${client_key}`)

        ws.on('message', (message) => {
            console.log(`received: ${JSON.stringify(message)}`);
            let mobj = JSON.parse(message)

            // user JOIN & keep-alive
            if (mobj.type == "JOIN") {

                let joined = new Date().getTime()
                if (node_connections.has(client_key)) { // already joined, its a keep alive
                    joined = node_connections.get(client_key).joined
                } else { // a new user!
                    node_connections.set (client_key, {ws: ws, joined: joined})
                }
                
                const KEEPALIVE_INTERVAL = 10

                var conn_info = { 
                    type: "JOINED",
                    interval: KEEPALIVE_INTERVAL,
                    name: mobj.name,
                    process_type: PROC_TYPE,
                    ping: new Date().getTime() - mobj.time,
                    server: proc_key,
                    connected_for: Math.round ( (new Date().getTime() - joined)/1000),
                    platform: `${ua.platform}/${ua.os}/${ua.browser}`, 
                    isMobile: ua.isMobile, 
                }

                // update redis hash
                redis.multi()
                .hmset (client_key, conn_info)
                .expire(client_key, KEEPALIVE_INTERVAL + 2)
                .exec((err, res) => {  // Executes all previously queued commands in a transaction
                    if (err) {
                    console.log (`error ${err}`)
                    }
                });

                ws.send (JSON.stringify(conn_info))
            }
        })

        ws.on('close', function close() {
        if (node_connections.has (client_key)) {
            // dont send any more messages
            node_connections.delete (client_key)
            // inform other clients
            redis.del(client_key).then (() => {
            console.log(`disconnected ${client_key}`)
            })
        }
        })

    });

})

