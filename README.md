# rancher-conf-sidekick

Configure Rancher service with a  `rancher-conf-sidekick` sidekick. Auto-restart main container, fetch template and settings directly from rancher-metadata, apply template changes on the fly. Combine with `rancher-conf-backend` to manage all service configurations from one place, one-click to apply, hierarchicaly stored (stack/service/environment:version)

## under development

## Features
 - Who love JS and write code in template. I really hate to write this unreadable shit:
```
{{with get "/self/service/name"}}{{if eq "elasticsearch-masters" .Value}}
discovery.zen.ping.unicast.hosts: {{range ls "/self/service/containers"}}{{ $containerName := getv (printf "/self/service/containers/%s" .)}}
- {{getv (printf "/containers/%s/primary_ip" $containerName)}}{{end}}
{{else}}
discovery.zen.ping.unicast.hosts: ["es-masters"]
{{end}}{{end}}
```
 - No need to build/manage config containers. Manage configurations not containers! Change ConfR template and conf-container will receive new version instantly! Change conf option in UI - changes in an application already processed!
 - Rancher-friendly. Intended to use only as configuration sidekick in Rancher environment for confd replacement.
 - Auto-reload configured application. Gracefully restart container paired with a sidekick in a batches when configuration changes
 - Environment-aware. Keys are fetched in `environment<-stack<-service<-version` order. You can specify some common settings on stack level and override some of them on service or version level 

## Examples & Usage
coming soon...
## Template
```js
const proxy_set_header = `proxy_set_header        Host            \$host;
        proxy_set_header        X-Real-IP       \$remote_addr;
        proxy_set_header        X-Forwarded-For \$proxy_add_x_forwarded_for;
`;

export default {
    '/tmp/synccloud.frontend/config.json': file('config.json'),
    '/tmp/nginx/conf.d/nginx.conf': async_`
upstream app {
  server localhost:${key('port')};
}

server {
    listen 80;

    client_max_body_size 100M;

    location ~ ^/api {
        proxy_pass ${key('backend')};
        ${proxy_set_header}
    }

    location ~ ^/echo {
        proxy_pass ${key('backend')};
        ${proxy_set_header}
    }

    location ~ ^/task/filedownload {
        proxy_pass ${key('backend')};
        ${proxy_set_header}
    }

    location / {
        proxy_pass http://app;

    }
}`
}
```

### Predefined template functions
 - `key` get key async
  - `key('self/service/name')` - get name of service from rancher metadata
  - `key('files/config.json')` - arbitrary path to redis key. transformed to something like this `/conf/:stack/:service/:?environment/:?version/your_path`
    will search in this order:
     - /conf/:stack/:service/:environment/:version/your_path
     - /conf/:stack/:service/:environment/:default_version(for example - master)/your_path
     - /conf/:stack/:service/:environment/your_path
     - /conf/:stack/:service/your_path
     - /conf/:stack/your_path
     - /conf/your_path
 - `file` get file contents async. works same way as `key`    
 - `async_` is a tag function. resolve all promises in template expressions


## Roadmap
 - Optional redis. Use rancher `metadata` section for redis backend replacement
 - ??? Ability to restart other services when this service have been restarted.
 - Expose backend used with ConfR containers for managing service configurations hierarchically
```
|-stacks                                
|  |-stackA
|  |  |-service1                       
|  |  |  |-conf.es6                     ConfR configuration template. Can be used for bootstraping haproxy, nginx, rabbitmq.conf and etc
|  |  |  |-arbitrary[@env#version].file Arbitrary file
|  |  |  |-config[@env#version].json    Json-file on a service level. May have @env and #version markers
|  |  |-compose[@environment].yml       Docker compose file for stack with all it services
|  |  |-config.json                     Json-file on a stack level. Will be merged to service-env-version files
|  |-stackB
```
