
## environment

export REDIS_URL=redis://:<key>@k<name>.redis.cache.windows.net:6380/4

## run

set the port the browser will establish the websocket connection to (foreman user PORT=5000 to start frontend)

```DEV_PORT=5000```

build the frontend assets (in the ```/dist``` folder)

```npm run build```

start the backend processes (using foreman for deployment to deis)

```nf start```

## development

start the frontend web server process

```node ./server.js```

start the backend process

```node ./server.js WORKER```

set the port the browser will establish the websocket connection to (default 9090 if process.env.PORT not set)

```DEV_PORT=9090```

run the webpack built-in dev server

```npm run dev```


### objective ideas


- microservices example

- ticket ordering

- allocate a new set of tickets
 - 400 iphone, 300 windows phone

- users join.
 - grap tickets, select seating, payment.

- microservies for:
 - seat allocation
 - resevation frontend
 - payment

support desk - send a message

scale out - bottleneck