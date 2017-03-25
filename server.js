const 
      os = require ('os'),
      NODE_HOSTNAME = os.hostname(),
      Redis = require('ioredis'),
      REDIS_DB = "4",
      redis_url = `redis://localhost:6379/${REDIS_DB}`,
      redis = new Redis(redis_url, {
        enableOfflineQueue: true,
        reconnectOnError: function (err) {
          console.log(`redis reconnectOnError ${err}`);
        },
        retryStrategy: function (times) {
          var delay = Math.min(times * 2, 2000);
          return delay;
        }
      }),
      redis_subscibe = new Redis(redis_url, {
        enableOfflineQueue: true,
        reconnectOnError: function (err) {
          console.log(`redis reconnectOnError ${err}`);
        },
        retryStrategy: function (times) {
          var delay = Math.min(times * 2, 2000);
          return delay;
        }
      })

redis.on("connect", (c) => console.log ('redis connected'));
redis.on("ready", (c) => console.log ('redis ready'));
redis.on("error", (c) => console.log (`error ${c}`));

////////////////////////////////////////////////////////////// Redis Process
// Record this node process in HASH_CURRENT_PROCESSES_KEY
const NOTIFICATION_KEYPREFIX = "kapp_",
      NODE_PING_INTERVAL = 20,
      HASH_CURRENT_PROCESSES_KEY = NOTIFICATION_KEYPREFIX+"node",
      HASH_CURRENT_USERS_KEY = NOTIFICATION_KEYPREFIX+"user",
      STARTED = new Date().getTime()

var CURRENT_NODE_KEY,
    PROCESS_NUMBER = 0,
    requestscomplete = 0,
    requestsstarted = 0,
    requestsavgtime = 0

redis.incr(`${HASH_CURRENT_PROCESSES_KEY}:cntr`).then((r) => {
  PROCESS_NUMBER = r;
  CURRENT_NODE_KEY = `${HASH_CURRENT_PROCESSES_KEY}:${PROCESS_NUMBER}`
  let updateRedisProcess = () => {
    let reqcomp = requestscomplete,
        reqopen = requestsstarted,
        reqtime = requestsavgtime;
    requestscomplete = 0; requestsstarted = 0; requestsavgtime = 0;
    //console.log (`write node status: ${PROCESS_NUMBER}`);
    redis
      .multi() // Marks the start of a transaction block. Subsequent commands will be queued for atomic execution using EXEC.
      .hmset (CURRENT_NODE_KEY, {
        "starttime": STARTED,
        "hostname": NODE_HOSTNAME,
        "uptime": Math.round((new Date().getTime() - STARTED)/1000),
        "users": node_connections.size,
        "reqcomp": reqcomp,
        "reqopen": reqopen,
        "reqtime": reqtime
      })
      .expire(CURRENT_NODE_KEY, (NODE_PING_INTERVAL * 1000) + 2)
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

})
////////////////////////////////////////////////////////////// Redis Process


////////////////////////////////////////////////////////////// Redis Notifications
// Redis Notifications (https://redis.io/topics/notifications) its not reliable
// require CONFIG SET notify-keyspace-events Khx
// K = Keyspace notifications allows node_connections to listen for all events for a key
// E = Eventspace notifcations, listen for all keys for a specified event (del etc)
// h = calture 'hash' key events
// x = capture expiry
redis.config("SET", "notify-keyspace-events", "Khgx");

const SUBSCRIBE_CHANNEL_PATTERN = `__keyspace@${REDIS_DB}__:${NOTIFICATION_KEYPREFIX}*:*`;
redis_subscibe.psubscribe(SUBSCRIBE_CHANNEL_PATTERN,  (err, count) => {
  if (err) {
    console.log (`redis_subscibe error ${JSON.stringify(err)}`);
    exit (1);
  } else
    console.log (`redis_subscibe (${count}) now subscribed to {${SUBSCRIBE_CHANNEL_PATTERN}`);
})
redis_subscibe.on("connect", (c) => console.log ('redis_subscibe connected'));
redis_subscibe.on("ready", (c) => console.log ('redis_subscibe ready'));
redis_subscibe.on("error", (c) => console.log (`redis_subscibe error ${c}`));
redis_subscibe.on('pmessage', function (pattern, channel, message) {
  console.log (`redis_subscibe: message "${channel}":  "${message}"`);

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
});
////////////////////////////////////////////////////////////// Redis Notifications




let node_connections = new Map()

const WebSocket = require('ws'),
      http = require('http'),
      serveStatic = require('serve-static'),
      useragent = require('express-useragent'),
      serve = serveStatic('public', {'index': ['index.html']}),
      port = process.env.PORT || 9090,
      httpServer = http.createServer( (request, response) => 
{
	console.log (`request (static) : ${request.url}`)
	serve(request, response, () => {
		console.log (`request (incoming) : ${request && request.url}`)
		if (request) {
        response.writeHead(404) ;
				response.end();
    }
  })
}).listen(port);
console.log (`listening to port ${port}`)


const wss = new WebSocket.Server({
  perMessageDeflate: false,
  server : httpServer
});

let sendclients = (type, msg) => {
  for (let [key, value] of node_connections) {
    value.ws.send(JSON.stringify(Object.assign({type: type}, msg)))
  }
}

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
        .expire(client_key, 180 * 60 * 1000)
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