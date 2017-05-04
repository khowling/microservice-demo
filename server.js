const 
      os = require ('os'),
      NODE_HOSTNAME = os.hostname(),
      Redis = require('ioredis'),
      REDIS_DB = "4",
      redis_url = process.env.REDIS_URL || `redis://localhost:6379/${REDIS_DB}`,
      redis_init_obj = {
        enableOfflineQueue: true,
        reconnectOnError: function (err) {
          console.log(`redis reconnectOnError ${err}`);
        },
        retryStrategy: function (times) {
          var delay = Math.min(times * 2, 2000);
          return delay;
        }
      },
      redis_init_obj_ext = process.env.REDIS_URL ? Object.assign( {}, redis_init_obj, {tls: {}}) : redis_init_obj,
      redis = new Redis(redis_url, redis_init_obj_ext),
      redis_subscibe = new Redis(redis_url, redis_init_obj_ext)

redis.on("connect", (c) => console.log ('redis connected'));
redis.on("ready", (c) => console.log ('redis ready'));
redis.on("error", (c) => console.log (`error ${c}`));

////////////////////////////////////////////////////////////// Register Process to Redis *ALL TYPES*
const NOTIFICATION_KEYPREFIX = "kapp_",
      NODE_PING_INTERVAL = 1,
      PROCESS_TYPE = process.argv[2] || 'FRONTEND',
      HASH_CURRENT_PROCESSES_KEY = NOTIFICATION_KEYPREFIX + PROCESS_TYPE,
      HASH_CURRENT_USERS_KEY = NOTIFICATION_KEYPREFIX + "USERS",
      STARTED = new Date().getTime()

redis.incr(`${HASH_CURRENT_PROCESSES_KEY}:cntr`).then((r) => {
  const PROCESS_NUMBER = r,
        CURRENT_NODE_KEY = `${HASH_CURRENT_PROCESSES_KEY}:${PROCESS_NUMBER}`
  var requestscomplete = 0,
      requestsstarted = 0,
      lastreqtime = 0

  let updateRedisProcess = () => {
    //console.log (`write node status: ${PROCESS_NUMBER}`);
    redis
      .multi() // Marks the start of a transaction block. Subsequent commands will be queued for atomic execution using EXEC.
      .hmset (CURRENT_NODE_KEY, {
        "starttime": STARTED,
        "hostname": NODE_HOSTNAME,
        "processtype": PROCESS_TYPE,
        "uptime": Math.round((new Date().getTime() - STARTED)/1000),
      //  "users": node_connections.size,
        "reqcomp": requestscomplete,
        "reqopen": requestsstarted - requestscomplete,
        "lastreqtm": lastreqtime
      })
      .expire(CURRENT_NODE_KEY, NODE_PING_INTERVAL + 2)
      .exec((err, res) => {  // Executes all previously queued commands in a transaction
        if (err) {
          console.log (`error ${err}`)
        }
      });
  }
  updateRedisProcess()
  setInterval (() => {
    updateRedisProcess()
  }, NODE_PING_INTERVAL * 1000)


  const WORK_TYPE = "dowork",
        WORK_COMPLETE_SUB = `${CURRENT_NODE_KEY}:${WORK_TYPE}`


  if (PROCESS_TYPE == "FRONTEND") {


    let node_connections = new Map(),
        work_requests_in_queue = new Map()
        work_requests_start_time = new Map()
    
    let sendclients = (type, msg) => {
      for (let [key, value] of node_connections) {
        value.ws.send(JSON.stringify(Object.assign({type: type}, msg)))
      }
    }

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
    const SUBSCRIBE_CHANNEL_PATTERN = `__keyspace@${REDIS_DB}__:${NOTIFICATION_KEYPREFIX}*:*`;
    redis_subscibe.psubscribe(SUBSCRIBE_CHANNEL_PATTERN, WORK_COMPLETE_SUB,  (err, count) => {
      if (err) {
        console.log (`redis_subscibe error ${JSON.stringify(err)}`);
        exit (1);
      } else
        console.log (`redis_subscibe (${count}) now subscribed to ${SUBSCRIBE_CHANNEL_PATTERN} & ${WORK_COMPLETE_SUB}`);
    })
    redis_subscibe.on("connect", (c) => console.log ('redis_subscibe connected'));
    redis_subscibe.on("ready", (c) => console.log ('redis_subscibe ready'));
    redis_subscibe.on("error", (c) => console.log (`redis_subscibe error ${c}`));
    redis_subscibe.on('pmessage', function (pattern, channel, message) {
      //console.log (`redis_subscibe: message "${channel}":  "${message}"`);

      if (channel == WORK_COMPLETE_SUB) {

        let {key, status} = JSON.parse(message),
            response = work_requests_in_queue.get(key)
        requestscomplete++
        lastreqtime = (Date.now() - work_requests_start_time.get(key))/1000
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
            requestsstarted++
            work_requests_in_queue.set (requestsstarted, response)
            work_requests_start_time.set (requestsstarted, Date.now())
            redis.lpush (WORK_TYPE, JSON.stringify({node: CURRENT_NODE_KEY, key: requestsstarted, worktype: WORK_COMPLETE_SUB})).then((succ) => {
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
          client_key = `${HASH_CURRENT_USERS_KEY}:${PROCESS_NUMBER}-${node_connections.size}`
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
          

          redis.multi()
            .hmset (client_key, { 
                name: mobj.name,
                process_key: `${PROCESS_NUMBER}`,
                ping: new Date().getTime() - mobj.time,
                server: NODE_HOSTNAME,
                connected_for: Math.round ( (new Date().getTime() - joined)/1000),
                platform: `${ua.platform}/${ua.os}/${ua.browser}`, 
                isMobile: ua.isMobile, 
              })
            .expire(client_key, 180 * 60)
            .exec((err, res) => {  // Executes all previously queued commands in a transaction
              if (err) {
                console.log (`error ${err}`)
              }
            });

          let joinmsg = JSON.stringify({type: "JOINED", name: mobj.name, ping: new Date().getTime() - mobj.time, server: `${NODE_HOSTNAME}:${PROCESS_NUMBER}`})
          // get current state NOTE: dont use 'keys' in production, will lock the database
          //redis.keys(`${HASH_CURRENT_PROCESSES_KEY}:[0-9]*`).then((data) => {
            
          //})
          ws.send (joinmsg)

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
  } else {
    console.log (`Staring backend process ${PROCESS_TYPE}`)
    var waiting_pop = false
    const listenforwork = () => {
      if (requestsstarted - requestscomplete <= 10 && waiting_pop == false) {
        waiting_pop = true;
        redis_subscibe.brpop(WORK_TYPE, 0).then((res) => {
          waiting_pop = false
          console.log (`RPOP'd work : ${res[1]}`)
          requestsstarted++
          
          let resobj = JSON.parse(res[1])
          setTimeout ((st) => {
            console.log (`Completed work : ${res[1]}`)
            redis.publish (resobj.worktype, JSON.stringify({key: resobj.key, status: "completed"}))
            requestscomplete++
            lastreqtime = (Date.now() - st)/1000
            listenforwork()
          }, (requestsstarted - requestscomplete)*100, Date.now())

          listenforwork()
        })
      }
    }
    listenforwork()
  }

})