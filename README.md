# Confn

Confn is Сonfd powered by NodeJS :D.

## under development

## Features
 - Who love JS and write code in template.
 - Auto-reload configured application. Gracefully restart container paired with a sidekick when configuration changes (have restart options - signal, timeout). 
 - Environment-aware. Keys are fetched in `environment<-stack<-service<-version` order. You can specify some common settings on stack level and override some of them on service or version level 
 - Rancher-friendly. Intended to use only as configuration sidekick in Rancher environment for confd replacement.

## Template
```js
export default async function () {
  const proxy_set_header = `proxy_set_header        Host            \$host;
        proxy_set_header        X-Real-IP       \$remote_addr;
        proxy_set_header        X-Forwarded-For \$proxy_add_x_forwarded_for;
`;
  return {
    '/tmp/synccloud.frontend/config.json': {
      content: await key('files/config.json'),
      reload: true
    },
    '/tmp/nginx/conf.d/nginx.conf': {
      content: await aw`
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
  }
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
 - `aw` is a tag function. resolve all promises in template expressions



## Roadmap
 - Optional redis. Use rancher `metadata` section for redis backend replacement
  
