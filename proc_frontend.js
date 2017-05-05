

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

redis_telemetry.init_telemetry(redis, PROC_TYPE, metrics).then ((proc_key, proc_id) => {

    

    let node_connections = new Map(), // Map of all WebSocket connected clients
        sendclients = (type, msg) => { // Send keyspace updates to WebSocket clients
        for (let [key, value] of node_connections) {
        value.ws.send(JSON.stringify(Object.assign({type: type}, msg)))
        }
    }

    let  work_requests_in_queue = new Map(), // Map of all REST 'WORK' requests (value=response)
        work_requests_start_time = new Map()

    ////////////////////////////////////////////////////////////// Subscribe to updates & send to usesers *FRONTEND ONLY*

    // Redis Notifications (https://redis.io/topics/notifications) its not reliable
    // require CONFIG SET notify-keyspace-events Khx
    // K = Keyspace notifications allows node_connections to listen for all events for a key
    // E = Eventspace notifcations, listen for all keys for a specified event (del etc)
    // h = calture 'hash' key events
    // x = capture expiry
    if (!process.env.REDIS_URL) {
        // cannot issue CONFIG against Azure Redis, need to set keyspace in 'advanced settings' in portal
        redis.config("SET", "notify-keyspace-events", "Khx");
    }
    
    const [ redis_b, redis_db ] = redis_telemetry.init_redis(process.env.REDIS_URL)
    const SUBSCRIBE_CHANNEL_PATTERN = `__keyspace@${redis_db}__:${NOTIFICATION_KEYPREFIX}*:*`,
          WORK_COMPLETE_SUB = `${proc_key}:${WORK_TYPE}`

    redis_b.psubscribe(SUBSCRIBE_CHANNEL_PATTERN, WORK_COMPLETE_SUB,  (err, count) => {
        if (err) {
        console.log (`redis_b error ${JSON.stringify(err)}`);
        exit (1);
        } else
        console.log (`redis_b (${count}) now subscribed to ${SUBSCRIBE_CHANNEL_PATTERN} & ${WORK_COMPLETE_SUB}`);
    })
    redis_b.on("connect", (c) => console.log ('redis_b connected'));
    redis_b.on("ready", (c) => console.log ('redis_b ready'));
    redis_b.on("error", (c) => console.log (`redis_b error ${c}`));
    redis_b.on('pmessage', function (pattern, channel, message) {
        //console.log (`redis_b: message "${channel}":  "${message}"`);

        if (channel == WORK_COMPLETE_SUB) {

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


    ////////////////////////////////////////////////////////////// WebServer/WebSocket *FRONTEND ONLY*
    const WebSocket = require('ws'),
            http = require('http'),
            serveStatic = require('serve-static'),
            useragent = require('express-useragent'),
            serve = serveStatic('dist', {'index': ['index.html']}),
            port = process.env.PORT || 9090,
            httpServer = http.createServer( (request, response) => 
    {
        console.log (`request (static) : ${request.url}`)
        serve(request, response, () => {
        console.log (`request (incoming) : ${request && request.url}`)
        if (request) {
            var fullpath = request.url.substr(1),
                toppath = fullpath.split('/')[0];

            if (toppath == WORK_TYPE) {
            console.log('doing work')
            metrics.requestsstarted++
            work_requests_in_queue.set (metrics.requestsstarted, response)
            work_requests_start_time.set (metrics.requestsstarted, Date.now())
            redis.lpush (WORK_TYPE, JSON.stringify({node: CURRENT_NODE_KEY, key: metrics.requestsstarted, worktype: WORK_COMPLETE_SUB})).then((succ) => {
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
            if (mobj.type == "JOIN") {

                let joined = new Date().getTime()
                if (node_connections.has(client_key)) {
                    joined = node_connections.get(client_key).joined
                } else {
                    node_connections.set (client_key, {ws: ws, joined: joined})
                }
                
                var conn_info = { 
                    type: "JOINED",
                    name: mobj.name,
                    process_type: PROC_TYPE,
                    ping: new Date().getTime() - mobj.time,
                    server: proc_key,
                    connected_for: Math.round ( (new Date().getTime() - joined)/1000),
                    platform: `${ua.platform}/${ua.os}/${ua.browser}`, 
                    isMobile: ua.isMobile, 
                }
                redis.multi()
                .hmset (client_key, conn_info)
                .expire(client_key, 180 * 60)
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

