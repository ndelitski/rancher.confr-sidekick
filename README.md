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
  const proxy_set_header = `
  proxy_set_header        Host            \$host;
  proxy_set_header        X-Real-IP       \$remote_addr;
  proxy_set_header        X-Forwarded-For \$proxy_add_x_forwarded_for;
`;
  return {
    '/etc/synccloud.frontend/config.json': {
      content: await key('files', 'config.json'),
      reload: true
    },
    '/etc/nginx/conf.d/nginx.conf': {
      content: await aw`
upstream app {
  server localhost:${key('port')};
}

server {
    listen 80;

    client_max_body_size ${key('nginx/maxFileSizeMB')}M;

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
}
      `
    }
  }
}


async function aw(strings, ...values) {
  let sum = '';
  for (let frag, i of strings) {
    sum += frag + (values.length <= i ? await values[i] : '');
  }
  return sum;
}

```




