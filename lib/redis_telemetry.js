const 
      os = require ('os'),
      Redis = require('ioredis'),
      NOTIFICATION_KEYPREFIX = "kapp_",
      NODE_PING_INTERVAL = 1


exports.init_redis = (url) => {
    const 
        redis_url = url || `redis://localhost:6379/4`,
        tls = (url != null),
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
        redis_init_obj_ext = tls ? Object.assign( {}, redis_init_obj, {tls: {}}) : redis_init_obj
        redis = new Redis(redis_url, redis_init_obj_ext)
    // 'enable_offline_queue' default is 'true', 
    // automatically queues any commands you send before the connection is ready (not need to wait).

    redis.on("connect ", (c) => console.log ('redis connected'));
    redis.on("ready", (c) => console.log ('redis ready'));
    redis.on("error", (c) => console.log (`error ${c}`));

    return [ redis,  redis_url.substr(redis_url.length - 1)]
}


////////////////////////////////////////////////////////////// Register Process to Redis *ALL TYPES*

exports.init_telemetry = (redis, proc_type, metrics) => {
    return new Promise((acc,rej) => {
        const hash_process_key = NOTIFICATION_KEYPREFIX + proc_type
        redis.incr(`${hash_process_key}:cntr`).then((proc_id) => {
            const proc_key = `${hash_process_key}:${proc_id}`,
                started = new Date().getTime()

            let updateRedisProcess = (metrics) => {
                //console.log (`write node status: ${PROCESS_NUMBER}`);
                redis
                .multi() // Marks the start of a transaction block. Subsequent commands will be queued for atomic execution using EXEC.
                .hmset (proc_key, {
                    "starttime": started,
                    "hostname": os.hostname(),
                    "processtype": proc_type,
                    "processid": proc_key, 
                    "uptime": Math.round((new Date().getTime() - started)/1000),
                //  "users": node_connections.size,
                    "reqcomp": metrics.requestscomplete,
                    "reqopen": metrics.requestsstarted - metrics.requestscomplete,
                    "lastreqtm": metrics.lastreqtime
                })
                .expire(proc_key, NODE_PING_INTERVAL + 1)
                .exec((err, res) => {  // Executes all previously queued commands in a transaction
                    if (err) {
                    console.log (`error ${err}`)
                    }
                });
            }

            updateRedisProcess(metrics)

            setInterval ((metrics) => {
                updateRedisProcess(metrics)
            }, NODE_PING_INTERVAL * 1000, metrics)

            acc(proc_key, proc_id)
        })
    })
}



